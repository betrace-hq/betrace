# PRD-002b: Hot Trace Storage

**Priority:** P0 (Blocks Production)
**Complexity:** Simple
**Personas:** All
**Dependencies:** PRD-002a (TigerBeetle for signal creation)
**Implementation Status:** ✅ READY - Clear scope, well-tested technology

## Problem

BeTrace currently has **no trace storage** - spans exist only in Drools working memory:
- **No Historical Queries:** Cannot investigate past traces, only current evaluation window
- **Limited Retention:** Traces in Drools expire after rule evaluation completes
- **No Trace Detail View:** Cannot drill into span attributes for signal investigation
- **Cannot Replay Rules:** No way to test rule changes against historical traces

**Impact:**
- ❌ Signals point to traces that no longer exist
- ❌ Cannot investigate root cause (trace context lost)
- ❌ Cannot validate rule changes (no historical replay)
- ❌ Limited to real-time detection only (no retroactive analysis)

**Current State:**
- `DroolsSpanProcessor.java` - Processes spans in-memory only
- No trace persistence after rule evaluation
- Tempo receives spans but BeTrace doesn't query Tempo

## Solution

### Technology Choice

**DuckDB** - Embedded analytical database with:
- **Columnar Storage:** Optimized for trace queries (filter by time, tenant, service)
- **JSON Support:** Native JSON columns for span attributes
- **Zero Ops:** Single-file database, no server process
- **SQL Interface:** Standard SQL for queries (no custom DSL)
- **Parquet Export:** Native support for archival (PRD-002c)

**Why DuckDB for Hot Trace Storage:**
- Trace queries are analytical (time-range scans, aggregations)
- JSON attributes need flexible schema (span attributes vary by service)
- Must handle 100K+ spans/day with sub-100ms query latency
- Need to export to Parquet for cold storage (DuckDB has native support)
- Zero deployment complexity (ADR-011 compliance)

**Out of Scope for this PRD:**
- ❌ Cold storage archival (see PRD-002d)
- ❌ Long-term retention >7 days (see PRD-002c)
- ❌ Real-time streaming queries (Drools handles that)

### Data Model

**Hot Storage Retention:** Last 7 days (configurable)

**Schema:**
```sql
CREATE TABLE traces (
    trace_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    root_span_name TEXT,
    duration_ms BIGINT,
    service_name TEXT,
    span_count INTEGER,
    spans JSON NOT NULL,  -- Array of span objects
    resource_attributes JSON,
    CONSTRAINT valid_trace_id CHECK (length(trace_id) = 32)
) STRICT;

CREATE INDEX idx_traces_tenant_time ON traces(tenant_id, timestamp DESC);
CREATE INDEX idx_traces_service ON traces(service_name, timestamp DESC);
CREATE INDEX idx_traces_duration ON traces(duration_ms DESC) WHERE duration_ms > 1000;
```

**Span JSON Structure:**
```json
{
  "spanId": "abc123",
  "parentSpanId": "xyz789",
  "name": "GET /api/signals",
  "kind": "SERVER",
  "startTimeUnixNano": 1704067200000000000,
  "endTimeUnixNano": 1704067200050000000,
  "attributes": {
    "http.method": "GET",
    "http.status_code": 200,
    "db.statement": "SELECT * FROM signals"
  },
  "events": [],
  "links": []
}
```

**Per-Tenant Isolation:**
- Each tenant gets dedicated DuckDB file: `./data-duckdb/{tenant-id}.duckdb`
- Physical isolation (no cross-tenant queries possible)
- Tenant ID from JWT enforced at route level (PRD-001)

### Backend Implementation

#### 1. DuckDB Service

**`com/betrace/services/DuckDBService.java`:**
```java
@ApplicationScoped
public class DuckDBService {

    @ConfigProperty(name = "betrace.duckdb.storage-path", defaultValue = "./data-duckdb")
    String storagePath;

    @ConfigProperty(name = "betrace.duckdb.hot-retention-days", defaultValue = "7")
    int hotRetentionDays;

    // Per-tenant connection pool
    private final Map<UUID, Connection> connections = new ConcurrentHashMap<>();

    /**
     * Get or create DuckDB connection for tenant.
     */
    private Connection getConnection(UUID tenantId) {
        return connections.computeIfAbsent(tenantId, id -> {
            try {
                Path dbFile = Path.of(storagePath, tenantId + ".duckdb");
                Files.createDirectories(dbFile.getParent());

                Connection conn = DriverManager.getConnection("jdbc:duckdb:" + dbFile);
                initializeSchema(conn);
                return conn;
            } catch (Exception e) {
                throw new RuntimeException("Failed to open DuckDB for tenant: " + tenantId, e);
            }
        });
    }

    /**
     * Initialize schema if not exists.
     */
    private void initializeSchema(Connection conn) throws SQLException {
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
                    resource_attributes JSON
                ) STRICT;

                CREATE INDEX IF NOT EXISTS idx_traces_tenant_time
                ON traces(tenant_id, timestamp DESC);

                CREATE INDEX IF NOT EXISTS idx_traces_service
                ON traces(service_name, timestamp DESC);
            """);
        }
    }

    /**
     * Insert trace (called by Camel processor after rule evaluation).
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
            stmt.setString(1, trace.getTraceId());
            stmt.setString(2, tenantId.toString());
            stmt.setTimestamp(3, Timestamp.from(trace.getTimestamp()));
            stmt.setString(4, trace.getRootSpanName());
            stmt.setLong(5, trace.getDurationMs());
            stmt.setString(6, trace.getServiceName());
            stmt.setInt(7, trace.getSpans().size());
            stmt.setString(8, toJson(trace.getSpans()));
            stmt.setString(9, toJson(trace.getResourceAttributes()));

            stmt.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to insert trace: " + trace.getTraceId(), e);
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

            return traces;
        } catch (SQLException e) {
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
            throw new RuntimeException("Failed to get trace: " + traceId, e);
        }
    }

    /**
     * Delete traces older than retention period.
     */
    public int deleteOldTraces(UUID tenantId) {
        Instant cutoff = Instant.now().minus(hotRetentionDays, ChronoUnit.DAYS);

        String sql = "DELETE FROM traces WHERE tenant_id = ? AND timestamp < ?";

        try (PreparedStatement stmt = getConnection(tenantId).prepareStatement(sql)) {
            stmt.setString(1, tenantId.toString());
            stmt.setTimestamp(2, Timestamp.from(cutoff));

            return stmt.executeUpdate();
        } catch (SQLException e) {
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
            return parquetFile;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to export traces to Parquet", e);
        }
    }

    // Helper methods

    private String toJson(Object obj) {
        try {
            return new ObjectMapper().writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException("JSON serialization failed", e);
        }
    }

    private Trace resultSetToTrace(ResultSet rs) throws SQLException {
        return new Trace(
            rs.getString("trace_id"),
            UUID.fromString(rs.getString("tenant_id")),
            rs.getTimestamp("timestamp").toInstant(),
            rs.getString("root_span_name"),
            rs.getLong("duration_ms"),
            rs.getString("service_name"),
            parseSpansJson(rs.getString("spans")),
            parseAttributesJson(rs.getString("resource_attributes"))
        );
    }

    @PreDestroy
    public void closeConnections() {
        connections.values().forEach(conn -> {
            try {
                conn.close();
            } catch (SQLException e) {
                // Log but don't throw
            }
        });
    }
}
```

#### 2. Camel Route for Trace Ingestion

**`com/betrace/routes/TraceIngestionRoute.java`:**
```java
@ApplicationScoped
public class TraceIngestionRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Receive spans from OpenTelemetry collector
        from("direct:ingest-span")
            .routeId("ingestSpan")
            .process("extractTenantFromSpanProcessor")
            .to("direct:evaluate-rules")  // Drools rule evaluation
            .to("direct:store-trace");    // DuckDB storage

        // Store trace in DuckDB hot storage
        from("direct:store-trace")
            .routeId("storeTrace")
            .process("aggregateSpansToTraceProcessor")  // Group spans into trace
            .process("storeTraceInDuckDBProcessor")
            .process("emitTraceStoredMetricProcessor");

        // Query traces API
        rest("/api/traces")
            .get("/")
                .description("Query traces by time range")
                .param().name("start").type(RestParamType.query).required(true).endParam()
                .param().name("end").type(RestParamType.query).required(true).endParam()
                .param().name("limit").type(RestParamType.query).defaultValue("100").endParam()
                .to("direct:query-traces");

        from("direct:query-traces")
            .routeId("queryTraces")
            .process("extractTenantFromJWTProcessor")  // PRD-001 integration
            .process("queryTracesFromDuckDBProcessor")
            .marshal().json();

        rest("/api/traces")
            .get("/{traceId}")
                .description("Get trace by ID")
                .to("direct:get-trace");

        from("direct:get-trace")
            .routeId("getTrace")
            .process("extractTenantFromJWTProcessor")
            .process("getTraceByIdProcessor")
            .choice()
                .when(body().isNull())
                    .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(404))
                    .setBody(constant("{\"error\": \"Trace not found\"}"))
                .otherwise()
                    .marshal().json();
    }
}
```

#### 3. Processors

**`com/betrace/processors/storage/StoreTraceInDuckDBProcessor.java`:**
```java
@Named("storeTraceInDuckDBProcessor")
@ApplicationScoped
public class StoreTraceInDuckDBProcessor implements Processor {

    @Inject
    DuckDBService duckdb;

    @Inject
    ComplianceSpanProcessor complianceSpanProcessor;

    private static final Logger log = LoggerFactory.getLogger(StoreTraceInDuckDBProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        Trace trace = exchange.getIn().getBody(Trace.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);

        try {
            duckdb.insertTrace(tenantId, trace);

            // Emit compliance span for data storage (SOC2 CC7.1)
            complianceSpanProcessor.startComplianceSpan(
                "storage.trace.stored",
                SOC2Controls.CC7_1.class
            ).setAttribute("trace.id", trace.getTraceId())
             .setAttribute("tenant.id", tenantId.toString())
             .end();

            log.debug("Stored trace {} for tenant {}", trace.getTraceId(), tenantId);

        } catch (Exception e) {
            log.error("Failed to store trace {}: {}", trace.getTraceId(), e.getMessage());
            throw e;
        }
    }
}
```

**`com/betrace/processors/storage/QueryTracesFromDuckDBProcessor.java`:**
```java
@Named("queryTracesFromDuckDBProcessor")
@ApplicationScoped
public class QueryTracesFromDuckDBProcessor implements Processor {

    @Inject
    DuckDBService duckdb;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        Instant start = exchange.getIn().getHeader("start", Instant.class);
        Instant end = exchange.getIn().getHeader("end", Instant.class);
        int limit = exchange.getIn().getHeader("limit", Integer.class, 100);

        List<Trace> traces = duckdb.queryTraces(tenantId, start, end, limit);

        exchange.getIn().setBody(traces);
    }
}
```

#### 4. Configuration

**`application.properties`:**
```properties
# DuckDB Hot Storage
betrace.duckdb.storage-path=./data-duckdb
betrace.duckdb.hot-retention-days=7
```

**`pom.xml`:**
```xml
<dependency>
  <groupId>org.duckdb</groupId>
  <artifactId>duckdb_jdbc</artifactId>
  <version>0.9.2</version>
</dependency>
```

### Development Setup

**`flake.nix` - No changes needed** (DuckDB is embedded, no daemon process)

## Success Criteria

**Trace Storage:**
- [ ] Traces persist in per-tenant DuckDB files
- [ ] Query traces by time range (<100ms P95 latency)
- [ ] Get trace by ID for signal investigation
- [ ] Automatic cleanup of traces older than retention period
- [ ] Parquet export works (called by PRD-002d)

**Tenant Isolation:**
- [ ] Each tenant has dedicated DuckDB file
- [ ] Cross-tenant queries mathematically impossible
- [ ] Tenant ID from JWT enforced at route level

**Integration:**
- [ ] Spans flow: Collector → Drools → DuckDB
- [ ] Signals reference existing traces in DuckDB
- [ ] Trace detail view shows full span tree

**Testing:**
- [ ] DuckDB service unit tests (90% coverage)
- [ ] Processor unit tests
- [ ] Integration tests (end-to-end span ingestion)
- [ ] Performance tests (100K spans, <100ms query)

## Testing Requirements

**Unit Tests:**
```java
@Test
@DisplayName("Should store trace in DuckDB")
void testInsertTrace() {
    UUID tenantId = UUID.randomUUID();
    Trace trace = createTestTrace();

    duckdb.insertTrace(tenantId, trace);

    Optional<Trace> retrieved = duckdb.getTraceById(tenantId, trace.getTraceId());
    assertTrue(retrieved.isPresent());
    assertEquals(trace.getTraceId(), retrieved.get().getTraceId());
}

@Test
@DisplayName("Should query traces by time range")
void testQueryTraces() {
    UUID tenantId = UUID.randomUUID();

    // Insert 100 traces over 10 days
    for (int day = 0; day < 10; day++) {
        for (int i = 0; i < 10; i++) {
            Trace trace = createTestTrace(Instant.now().minus(day, ChronoUnit.DAYS));
            duckdb.insertTrace(tenantId, trace);
        }
    }

    // Query last 7 days
    List<Trace> recent = duckdb.queryTraces(
        tenantId,
        Instant.now().minus(7, ChronoUnit.DAYS),
        Instant.now(),
        100
    );

    assertEquals(70, recent.size());
}

@Test
@DisplayName("Should export traces to Parquet")
void testExportToParquet() throws Exception {
    UUID tenantId = UUID.randomUUID();
    LocalDate date = LocalDate.now();

    // Insert traces for today
    for (int i = 0; i < 1000; i++) {
        duckdb.insertTrace(tenantId, createTestTrace());
    }

    // Export to Parquet
    Path parquetFile = duckdb.exportToParquet(tenantId, date);

    assertTrue(Files.exists(parquetFile));
    assertTrue(Files.size(parquetFile) > 0);

    // Verify Parquet can be read
    List<Trace> exported = readParquetFile(parquetFile);
    assertEquals(1000, exported.size());
}
```

**Performance Tests:**
```java
@Test
@DisplayName("Should query 100K traces in <100ms")
void testQueryPerformance() {
    UUID tenantId = UUID.randomUUID();

    // Insert 100K traces
    for (int i = 0; i < 100_000; i++) {
        duckdb.insertTrace(tenantId, createTestTrace());
    }

    // Query with time range
    Instant start = Instant.now();
    List<Trace> results = duckdb.queryTraces(
        tenantId,
        Instant.now().minus(1, ChronoUnit.HOURS),
        Instant.now(),
        100
    );
    Duration elapsed = Duration.between(start, Instant.now());

    assertThat(results).hasSize(100);
    assertThat(elapsed.toMillis()).isLessThan(100);
}
```

## Minimum Test Coverage Targets

- **Overall Instruction Coverage:** 90%
- **Overall Branch Coverage:** 80%
- **Critical Services:** 95% instruction coverage
  - `DuckDBService`
  - All storage processors

## Files to Create

**Backend Services:**
- `backend/src/main/java/com/betrace/services/DuckDBService.java`

**Camel Routes:**
- `backend/src/main/java/com/betrace/routes/TraceIngestionRoute.java`

**Processors:**
- `backend/src/main/java/com/betrace/processors/storage/StoreTraceInDuckDBProcessor.java`
- `backend/src/main/java/com/betrace/processors/storage/QueryTracesFromDuckDBProcessor.java`
- `backend/src/main/java/com/betrace/processors/storage/GetTraceByIdProcessor.java`
- `backend/src/main/java/com/betrace/processors/storage/AggregateSpansToTraceProcessor.java`

**Models:**
- `backend/src/main/java/com/betrace/model/Trace.java`

**Tests:**
- `backend/src/test/java/com/betrace/services/DuckDBServiceTest.java`
- `backend/src/test/java/com/betrace/routes/TraceIngestionRouteTest.java`
- `backend/src/test/java/com/betrace/processors/storage/StorageProcessorsTest.java`
- `backend/src/test/java/com/betrace/services/TraceQueryPerformanceTest.java`

## Files to Modify

**Backend:**
- `backend/pom.xml` - Add DuckDB dependency
- `backend/src/main/resources/application.properties` - Add DuckDB config

## Implementation Notes

**DuckDB Advantages:**
- **Zero Ops:** No daemon, no cluster, just a file
- **Fast Queries:** Columnar storage optimized for analytical queries
- **JSON Support:** Native JSON columns for flexible span attributes
- **Parquet Export:** Native support for archival (PRD-002c)
- **SQL Interface:** Standard SQL, no custom DSL

**Per-Tenant Files:**
- Physical isolation (no multi-tenancy bugs possible)
- Independent retention policies
- Easy backup/restore (copy single file)
- No cross-tenant query performance impact

**Query Patterns:**
- Time range scans (most common): Index on (tenant_id, timestamp)
- Service filtering: Index on (service_name, timestamp)
- Trace ID lookup: Primary key on trace_id

**Retention:**
- Automatic cleanup via scheduled Camel route (timer:cleanup)
- Configurable retention period (default 7 days)
- Traces older than retention → archived to cold storage (PRD-002d)

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - DuckDB as library, no daemon
- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Per-tenant files
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - All storage via routes
- **[ADR-014: Camel Testing Standards](../adrs/014-camel-testing-and-organization-standards.md)** - 90% coverage

## Dependencies

**Requires:**
- PRD-001: Authentication (tenant ID from JWT)
- PRD-002a: TigerBeetle (signals reference traces)

**Blocks:**
- PRD-002d: Trace Archival Pipeline (exports from DuckDB)

## Future Enhancements

- **Full-Text Search:** DuckDB FTS extension for span attribute search
- **Aggregation Queries:** Pre-compute trace statistics (P95, error rate)
- **Span Sampling:** Store only sampled spans for high-volume services
- **JSON Indexing:** Index specific span attributes for faster queries
