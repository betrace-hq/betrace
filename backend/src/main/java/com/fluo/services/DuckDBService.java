package com.fluo.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fluo.model.Span;
import com.fluo.model.Trace;
import io.quarkus.runtime.Startup;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * DuckDB service for hot trace storage.
 * Provides per-tenant embedded databases with 7-day retention.
 *
 * Architecture:
 * - Each tenant gets dedicated DuckDB file for physical isolation
 * - Shared database for system-wide data (rate limits)
 * - Automatic schema initialization
 * - Connection pooling per tenant
 */
@ApplicationScoped
@Startup
public class DuckDBService {

    private static final Logger log = LoggerFactory.getLogger(DuckDBService.class);

    @ConfigProperty(name = "fluo.duckdb.storage-path", defaultValue = "./data-duckdb")
    String storagePath;

    @ConfigProperty(name = "fluo.duckdb.hot-retention-days", defaultValue = "7")
    int hotRetentionDays;

    @ConfigProperty(name = "fluo.storage.system.ratelimits-path", defaultValue = "./data/system/ratelimits.duckdb")
    String sharedDbPath;

    @Inject
    ObjectMapper objectMapper;

    // Per-tenant connection pool with max size limit
    private static final int MAX_TENANT_CONNECTIONS = 1000;
    private final Map<UUID, TenantConnection> tenantConnections = new ConcurrentHashMap<>();

    // Shared database connection for system-wide data
    private Connection sharedConnection;

    /**
     * Wrapper for tenant connection with last access timestamp.
     */
    private static class TenantConnection {
        final Connection connection;
        volatile long lastAccessTime;

        TenantConnection(Connection connection) {
            this.connection = connection;
            this.lastAccessTime = System.currentTimeMillis();
        }

        void updateAccessTime() {
            this.lastAccessTime = System.currentTimeMillis();
        }
    }

    /**
     * Initialize shared database on startup.
     */
    void initializeSharedDatabase() {
        try {
            Path dbFile = Path.of(sharedDbPath);
            Files.createDirectories(dbFile.getParent());

            sharedConnection = DriverManager.getConnection("jdbc:duckdb:" + dbFile);
            log.info("Initialized shared DuckDB database at {}", dbFile);

        } catch (Exception e) {
            log.error("Failed to initialize shared DuckDB database", e);
            throw new RuntimeException("DuckDB shared database initialization failed", e);
        }
    }

    /**
     * Get or create DuckDB connection for tenant.
     * Implements LRU eviction when max connections reached.
     */
    private Connection getConnection(UUID tenantId) {
        TenantConnection tenantConn = tenantConnections.get(tenantId);

        if (tenantConn != null) {
            tenantConn.updateAccessTime();
            return tenantConn.connection;
        }

        // Check if we need to evict old connections
        if (tenantConnections.size() >= MAX_TENANT_CONNECTIONS) {
            evictLeastRecentlyUsedConnection();
        }

        // Create new connection
        TenantConnection newConn = tenantConnections.computeIfAbsent(tenantId, id -> {
            try {
                Path dbFile = Path.of(storagePath, tenantId + ".duckdb");
                Files.createDirectories(dbFile.getParent());

                Connection conn = DriverManager.getConnection("jdbc:duckdb:" + dbFile);
                initializeSchema(conn, tenantId);

                log.info("Initialized DuckDB connection for tenant {}", tenantId);
                return new TenantConnection(conn);

            } catch (Exception e) {
                log.error("Failed to open DuckDB for tenant: {}", tenantId, e);
                throw new RuntimeException("Failed to open DuckDB for tenant: " + tenantId, e);
            }
        });

        return newConn.connection;
    }

    /**
     * Evict least recently used connection to prevent resource exhaustion.
     */
    private void evictLeastRecentlyUsedConnection() {
        tenantConnections.entrySet().stream()
            .min(Comparator.comparingLong(e -> e.getValue().lastAccessTime))
            .ifPresent(oldest -> {
                UUID tenantId = oldest.getKey();
                TenantConnection conn = tenantConnections.remove(tenantId);

                if (conn != null) {
                    try {
                        conn.connection.close();
                        log.info("Evicted LRU connection for tenant {} (age: {}ms)",
                            tenantId,
                            System.currentTimeMillis() - conn.lastAccessTime);
                    } catch (SQLException e) {
                        log.warn("Error closing evicted connection for tenant {}", tenantId, e);
                    }
                }
            });
    }

    /**
     * Initialize trace storage schema if not exists.
     */
    private void initializeSchema(Connection conn, UUID tenantId) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS traces (
                    trace_id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    root_span_name TEXT,
                    duration_ms BIGINT,
                    service_name TEXT,
                    span_count INTEGER,
                    spans JSON NOT NULL,
                    resource_attributes JSON,
                    CONSTRAINT valid_trace_id CHECK (length(trace_id) = 32)
                );

                CREATE INDEX IF NOT EXISTS idx_traces_tenant_time
                ON traces(tenant_id, timestamp DESC);

                CREATE INDEX IF NOT EXISTS idx_traces_service
                ON traces(service_name, timestamp DESC);

                CREATE INDEX IF NOT EXISTS idx_traces_duration
                ON traces(duration_ms DESC) WHERE duration_ms > 1000;
            """);

            log.debug("Initialized trace storage schema for tenant {}", tenantId);
        }
    }

    /**
     * Insert trace (called after rule evaluation).
     */
    public void insertTrace(UUID tenantId, Trace trace) {
        String sql = """
            INSERT INTO traces
            (trace_id, tenant_id, timestamp, root_span_name, duration_ms,
             service_name, span_count, spans, resource_attributes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?::JSON, ?::JSON)
            ON CONFLICT (trace_id) DO NOTHING
        """;

        try (PreparedStatement stmt = getConnection(tenantId).prepareStatement(sql)) {
            stmt.setString(1, trace.traceId());
            stmt.setString(2, tenantId.toString());
            stmt.setTimestamp(3, Timestamp.from(trace.timestamp()));
            stmt.setString(4, trace.rootSpanName());
            stmt.setLong(5, trace.durationMs());
            stmt.setString(6, trace.serviceName());
            stmt.setInt(7, trace.getSpanCount());
            stmt.setString(8, objectMapper.writeValueAsString(trace.spans()));
            stmt.setString(9, objectMapper.writeValueAsString(trace.resourceAttributes()));

            stmt.executeUpdate();
            log.debug("Stored trace {} for tenant {}", trace.traceId(), tenantId);

        } catch (Exception e) {
            log.error("Failed to insert trace {}: {}", trace.traceId(), e.getMessage());
            throw new RuntimeException("Failed to insert trace: " + trace.traceId(), e);
        }
    }

    /**
     * Query traces by tenant and time range.
     */
    public List<Trace> queryTraces(UUID tenantId, Instant start, Instant end, int limit) {
        String sql = """
            SELECT * FROM traces
            WHERE tenant_id = ?
              AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp DESC
            LIMIT ?
        """;

        try (PreparedStatement stmt = getConnection(tenantId).prepareStatement(sql)) {
            stmt.setString(1, tenantId.toString());
            stmt.setTimestamp(2, Timestamp.from(start));
            stmt.setTimestamp(3, Timestamp.from(end));
            stmt.setInt(4, limit);

            ResultSet rs = stmt.executeQuery();
            List<Trace> traces = new ArrayList<>();

            while (rs.next()) {
                traces.add(resultSetToTrace(rs));
            }

            log.debug("Queried {} traces for tenant {} in range {} to {}",
                traces.size(), tenantId, start, end);

            return traces;

        } catch (SQLException e) {
            log.error("Failed to query traces for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to query traces", e);
        }
    }

    /**
     * Get trace by ID (for signal investigation).
     */
    public Optional<Trace> getTraceById(UUID tenantId, String traceId) {
        String sql = "SELECT * FROM traces WHERE trace_id = ? AND tenant_id = ?";

        try (PreparedStatement stmt = getConnection(tenantId).prepareStatement(sql)) {
            stmt.setString(1, traceId);
            stmt.setString(2, tenantId.toString());

            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return Optional.of(resultSetToTrace(rs));
            }

            return Optional.empty();

        } catch (SQLException e) {
            log.error("Failed to get trace {}: {}", traceId, e.getMessage());
            throw new RuntimeException("Failed to get trace: " + traceId, e);
        }
    }

    /**
     * Delete traces older than retention period.
     * Returns number of traces deleted.
     */
    public int deleteOldTraces(UUID tenantId) {
        Instant cutoff = Instant.now().minus(hotRetentionDays, ChronoUnit.DAYS);

        String sql = "DELETE FROM traces WHERE tenant_id = ? AND timestamp < ?";

        try (PreparedStatement stmt = getConnection(tenantId).prepareStatement(sql)) {
            stmt.setString(1, tenantId.toString());
            stmt.setTimestamp(2, Timestamp.from(cutoff));

            int deleted = stmt.executeUpdate();
            log.info("Deleted {} old traces for tenant {} (before {})", deleted, tenantId, cutoff);

            return deleted;

        } catch (SQLException e) {
            log.error("Failed to delete old traces for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to delete old traces", e);
        }
    }

    /**
     * Export traces to Parquet for archival (called by PRD-002d).
     */
    public Path exportToParquet(UUID tenantId, LocalDate date) {
        Path parquetFile = Path.of(storagePath, tenantId + "-" + date + ".parquet");

        String sql = """
            COPY (
                SELECT * FROM traces
                WHERE tenant_id = ?
                  AND DATE(timestamp) = ?
            ) TO ? (FORMAT PARQUET, COMPRESSION ZSTD)
        """;

        try (PreparedStatement stmt = getConnection(tenantId).prepareStatement(sql)) {
            stmt.setString(1, tenantId.toString());
            stmt.setString(2, date.toString());
            stmt.setString(3, parquetFile.toString());

            stmt.execute();
            log.info("Exported traces for tenant {} on {} to {}", tenantId, date, parquetFile);

            return parquetFile;

        } catch (SQLException e) {
            log.error("Failed to export traces to Parquet for tenant {}", tenantId, e);
            throw new RuntimeException("Failed to export traces to Parquet", e);
        }
    }

    /**
     * Execute SQL on shared database (for rate limiting, system-wide data).
     * Synchronized to prevent concurrent transaction conflicts.
     */
    public synchronized void executeOnSharedDb(String sql, Object... params) {
        if (sharedConnection == null) {
            initializeSharedDatabase();
        }

        try (PreparedStatement stmt = sharedConnection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                stmt.setObject(i + 1, params[i]);
            }
            stmt.execute();

        } catch (SQLException e) {
            log.error("Failed to execute on shared database: {}", sql, e);
            throw new RuntimeException("Shared database operation failed", e);
        }
    }

    /**
     * Query shared database (for rate limiting, system-wide data).
     * Synchronized to prevent concurrent transaction conflicts.
     */
    public synchronized List<Map<String, Object>> queryOnSharedDb(String sql, Object... params) {
        if (sharedConnection == null) {
            initializeSharedDatabase();
        }

        try (PreparedStatement stmt = sharedConnection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                stmt.setObject(i + 1, params[i]);
            }

            ResultSet rs = stmt.executeQuery();
            List<Map<String, Object>> results = new ArrayList<>();

            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                ResultSetMetaData metaData = rs.getMetaData();

                for (int i = 1; i <= metaData.getColumnCount(); i++) {
                    row.put(metaData.getColumnName(i), rs.getObject(i));
                }

                results.add(row);
            }

            return results;

        } catch (SQLException e) {
            log.error("Failed to query shared database: {}", sql, e);
            throw new RuntimeException("Shared database query failed", e);
        }
    }

    /**
     * Convert ResultSet row to Trace model.
     */
    private Trace resultSetToTrace(ResultSet rs) throws SQLException {
        try {
            String spansJson = rs.getString("spans");
            String resourceAttributesJson = rs.getString("resource_attributes");

            List<Span> spans = objectMapper.readValue(
                spansJson,
                new TypeReference<List<Span>>() {}
            );

            Map<String, Object> resourceAttributes = objectMapper.readValue(
                resourceAttributesJson,
                new TypeReference<Map<String, Object>>() {}
            );

            return new Trace(
                rs.getString("trace_id"),
                UUID.fromString(rs.getString("tenant_id")),
                rs.getTimestamp("timestamp").toInstant(),
                rs.getString("root_span_name"),
                rs.getLong("duration_ms"),
                rs.getString("service_name"),
                spans,
                resourceAttributes
            );

        } catch (Exception e) {
            throw new SQLException("Failed to deserialize trace JSON", e);
        }
    }

    /**
     * Close all database connections on shutdown.
     */
    @PreDestroy
    public void closeConnections() {
        tenantConnections.values().forEach(conn -> {
            try {
                conn.connection.close();
            } catch (SQLException e) {
                log.warn("Failed to close tenant connection", e);
            }
        });

        if (sharedConnection != null) {
            try {
                sharedConnection.close();
            } catch (SQLException e) {
                log.warn("Failed to close shared connection", e);
            }
        }

        log.info("Closed all DuckDB connections");
    }

    /**
     * Execute a transaction atomically on the shared database.
     * Handles BEGIN/COMMIT/ROLLBACK automatically.
     * <p>
     * This method is synchronized to prevent concurrent transaction conflicts.
     * Use this instead of manual BEGIN/COMMIT when you need transactional guarantees.
     *
     * @param transaction Callback that performs database operations
     * @return Result from the transaction callback
     * @throws RuntimeException if transaction fails
     */
    public synchronized <T> T executeTransaction(java.util.function.Supplier<T> transaction) {
        if (sharedConnection == null) {
            initializeSharedDatabase();
        }

        try {
            sharedConnection.setAutoCommit(false);
            T result = transaction.get();
            sharedConnection.commit();
            return result;
        } catch (Exception e) {
            try {
                sharedConnection.rollback();
            } catch (SQLException rollbackEx) {
                log.warn("Failed to rollback transaction", rollbackEx);
            }
            throw new RuntimeException("Transaction failed", e);
        } finally {
            try {
                sharedConnection.setAutoCommit(true);
            } catch (SQLException e) {
                log.warn("Failed to restore autocommit", e);
            }
        }
    }
}
