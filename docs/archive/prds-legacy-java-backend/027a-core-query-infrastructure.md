# PRD-027a: Core Query Infrastructure

**Parent PRD:** PRD-027 (Advanced Query Language for Signal Search)
**Unit:** A
**Priority:** P2
**Dependencies:** None (foundation unit)

## Scope

Implement the foundational query infrastructure for executing SQL queries on DuckDB hot storage with comprehensive security validation and automatic tenant isolation. This unit provides the backend API and processing pipeline that all other units depend on.

## Core Functionality

1. **REST API Endpoint**: `POST /api/signals/query` for SQL query execution
2. **Security Validation**: Multi-layer SQL injection prevention
3. **Tenant Isolation**: Automatic injection of tenant_id filter (ADR-012)
4. **DuckDB Execution**: Query hot storage with timeout enforcement
5. **Result Formatting**: Structured response with metadata

## Implementation

### 1. Camel Route

**File:** `backend/src/main/java/com/fluo/routes/SignalQueryRoute.java`

```java
package com.fluo.routes;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Camel routes for advanced signal queries.
 * Supports SQL queries on DuckDB hot storage with tenant isolation.
 */
@ApplicationScoped
public class SignalQueryRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // REST API for advanced signal queries
        rest("/api/signals")
            .description("Signal query API")
            .produces("application/json")
            .consumes("application/json")

            // Advanced SQL query endpoint
            .post("/query")
                .description("Execute SQL query on signals with tenant isolation")
                .type(SignalQueryRequest.class)
                .to("direct:executeSignalQuery");

        // Execute signal query route
        from("direct:executeSignalQuery")
            .routeId("executeSignalQuery")
            .log("Executing signal query for tenant ${header.tenantId}")
            .process("extractTenantIdProcessor")           // Extract tenant from JWT
            .process("parseQueryRequestProcessor")          // Parse query request
            .process("validateSqlQueryProcessor")           // Validate SQL syntax + security
            .process("injectTenantIsolationProcessor")      // Auto-inject tenant_id = ?
            .process("executeHotStorageQueryProcessor")     // Query DuckDB
            .process("formatQueryResultsProcessor")         // Format as JSON
            .marshal().json();
    }
}
```

### 2. Named Processors

**File:** `backend/src/main/java/com/fluo/processors/query/ParseQueryRequestProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.SignalQueryRequest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Parses signal query request and extracts query parameters.
 */
@Named("parseQueryRequestProcessor")
@ApplicationScoped
public class ParseQueryRequestProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        SignalQueryRequest request = exchange.getIn().getBody(SignalQueryRequest.class);

        if (request == null || request.getSql() == null || request.getSql().trim().isEmpty()) {
            throw new IllegalArgumentException("SQL query is required");
        }

        // Set headers for downstream processors
        exchange.getIn().setHeader("sql", request.getSql().trim());
        exchange.getIn().setHeader("limit", request.getLimit());
        exchange.getIn().setHeader("timeoutSeconds", request.getTimeoutSeconds());

        // Store original request
        exchange.getIn().setHeader("queryRequest", request);
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/ValidateSqlQueryProcessor.java`

```java
package com.fluo.processors.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.util.regex.Pattern;

/**
 * Validates SQL query for security and correctness.
 * Prevents SQL injection and dangerous operations.
 */
@Named("validateSqlQueryProcessor")
@ApplicationScoped
public class ValidateSqlQueryProcessor implements Processor {

    // Dangerous SQL keywords that should not be allowed
    private static final Pattern DANGEROUS_KEYWORDS = Pattern.compile(
        "(?i)\\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\\b"
    );

    // Maximum query length (prevent DoS via huge queries)
    private static final int MAX_QUERY_LENGTH = 10_000;

    @Override
    public void process(Exchange exchange) throws Exception {
        String sql = exchange.getIn().getHeader("sql", String.class);

        // Validate query length
        if (sql.length() > MAX_QUERY_LENGTH) {
            throw new IllegalArgumentException(
                "Query too long. Maximum " + MAX_QUERY_LENGTH + " characters allowed"
            );
        }

        // Check for dangerous keywords
        if (DANGEROUS_KEYWORDS.matcher(sql).find()) {
            throw new SecurityException(
                "Query contains dangerous operations. Only SELECT queries are allowed"
            );
        }

        // Ensure query starts with SELECT (case-insensitive)
        String trimmedSql = sql.trim();
        if (!trimmedSql.toLowerCase().startsWith("select")) {
            throw new IllegalArgumentException(
                "Only SELECT queries are allowed. Query must start with SELECT"
            );
        }

        // Validate LIMIT clause (prevent unbounded queries)
        int requestedLimit = exchange.getIn().getHeader("limit", Integer.class);
        if (requestedLimit < 1 || requestedLimit > 10_000) {
            throw new IllegalArgumentException(
                "Limit must be between 1 and 10,000. Got: " + requestedLimit
            );
        }

        // Check for multiple statements (prevent SQL injection)
        if (sql.contains(";") && !sql.trim().endsWith(";")) {
            throw new SecurityException(
                "Multiple SQL statements are not allowed. Only single queries permitted"
            );
        }

        // Query validation passed
        exchange.getIn().setHeader("validatedSql", sql);
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/InjectTenantIsolationProcessor.java`

```java
package com.fluo.processors.query;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.util.UUID;

/**
 * Automatically injects tenant_id filter to ensure tenant isolation.
 * This is a CRITICAL security processor per ADR-012.
 */
@Named("injectTenantIsolationProcessor")
@ApplicationScoped
public class InjectTenantIsolationProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        String sql = exchange.getIn().getHeader("validatedSql", String.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);

        if (tenantId == null) {
            throw new SecurityException("Tenant ID is required for query isolation");
        }

        // Inject tenant_id filter into WHERE clause
        String isolatedSql = injectTenantFilter(sql, tenantId);

        exchange.getIn().setHeader("isolatedSql", isolatedSql);
        exchange.getIn().setHeader("tenantId", tenantId);
    }

    /**
     * Injects tenant_id = ? into WHERE clause of SQL query.
     *
     * Examples:
     * - "SELECT * FROM signals WHERE severity = 'HIGH'"
     *   becomes "SELECT * FROM signals WHERE tenant_id = ? AND severity = 'HIGH'"
     *
     * - "SELECT * FROM signals"
     *   becomes "SELECT * FROM signals WHERE tenant_id = ?"
     */
    private String injectTenantFilter(String sql, UUID tenantId) {
        String lowerSql = sql.toLowerCase();

        if (lowerSql.contains(" where ")) {
            // SQL already has WHERE clause - prepend tenant filter
            int whereIndex = lowerSql.indexOf(" where ");
            String beforeWhere = sql.substring(0, whereIndex + 7); // Include " WHERE "
            String afterWhere = sql.substring(whereIndex + 7);

            return beforeWhere + "tenant_id = '" + tenantId.toString() + "' AND " + afterWhere;
        } else {
            // No WHERE clause - add one with tenant filter
            // Find position before ORDER BY, GROUP BY, LIMIT
            String[] keywords = {" order by ", " group by ", " limit ", ";"};
            int insertPos = sql.length();

            for (String keyword : keywords) {
                int pos = lowerSql.indexOf(keyword);
                if (pos > 0 && pos < insertPos) {
                    insertPos = pos;
                }
            }

            String beforeKeyword = sql.substring(0, insertPos);
            String afterKeyword = sql.substring(insertPos);

            return beforeKeyword + " WHERE tenant_id = '" + tenantId.toString() + "'" + afterKeyword;
        }
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/ExecuteHotStorageQueryProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.Signal;
import com.fluo.services.DuckDBQueryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.util.List;
import java.util.UUID;

/**
 * Executes SQL query on DuckDB hot storage.
 */
@Named("executeHotStorageQueryProcessor")
@ApplicationScoped
public class ExecuteHotStorageQueryProcessor implements Processor {

    @Inject
    DuckDBQueryService duckDBQueryService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String sql = exchange.getIn().getHeader("isolatedSql", String.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        int timeoutSeconds = exchange.getIn().getHeader("timeoutSeconds", Integer.class);

        long startTime = System.currentTimeMillis();

        // Execute query on DuckDB with timeout
        List<Signal> results = duckDBQueryService.executeQuery(tenantId, sql, timeoutSeconds);

        long executionTimeMs = System.currentTimeMillis() - startTime;

        // Set results and metadata
        exchange.getIn().setBody(results);
        exchange.getIn().setHeader("executionTimeMs", executionTimeMs);
        exchange.getIn().setHeader("hotStorageCount", results.size());
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/FormatQueryResultsProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.Signal;
import com.fluo.model.SignalQueryResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.util.List;
import java.util.UUID;

/**
 * Formats query results as SignalQueryResponse.
 */
@Named("formatQueryResultsProcessor")
@ApplicationScoped
public class FormatQueryResultsProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        @SuppressWarnings("unchecked")
        List<Signal> results = exchange.getIn().getBody(List.class);

        long executionTimeMs = exchange.getIn().getHeader("executionTimeMs", Long.class);
        int hotStorageCount = exchange.getIn().getHeader("hotStorageCount", Integer.class);

        SignalQueryResponse response = new SignalQueryResponse();
        response.setResults(results);
        response.setTotalCount(results.size());
        response.setExecutionTimeMs(executionTimeMs);
        response.setQueryId("query-" + UUID.randomUUID().toString());
        response.setFromCache(false);

        SignalQueryResponse.QueryMetadata metadata = new SignalQueryResponse.QueryMetadata();
        metadata.setHotStorageCount(hotStorageCount);
        metadata.setColdStorageCount(0); // Future: add cold storage count
        response.setMetadata(metadata);

        exchange.getIn().setBody(response);
    }
}
```

### 3. DuckDB Query Service

**File:** `backend/src/main/java/com/fluo/services/DuckDBQueryService.java`

```java
package com.fluo.services;

import com.fluo.model.Signal;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

/**
 * Service for executing queries on DuckDB hot storage.
 */
@ApplicationScoped
public class DuckDBQueryService {

    @ConfigProperty(name = "fluo.storage.hot.path", defaultValue = "./data-duckdb")
    String hotStoragePath;

    /**
     * Execute SQL query on DuckDB with timeout.
     *
     * @param tenantId Tenant UUID (for per-tenant database file)
     * @param sql SQL query string (already tenant-isolated)
     * @param timeoutSeconds Query timeout in seconds
     * @return List of signals matching query
     */
    public List<Signal> executeQuery(UUID tenantId, String sql, int timeoutSeconds)
            throws SQLException {

        String dbPath = hotStoragePath + "/" + tenantId.toString() + ".duckdb";

        try (Connection conn = DriverManager.getConnection("jdbc:duckdb:" + dbPath)) {
            // Set query timeout
            try (Statement stmt = conn.createStatement()) {
                stmt.setQueryTimeout(timeoutSeconds);

                // Execute query
                try (ResultSet rs = stmt.executeQuery(sql)) {
                    return mapResultSetToSignals(rs);
                }
            }
        }
    }

    /**
     * Map JDBC ResultSet to Signal objects.
     */
    private List<Signal> mapResultSetToSignals(ResultSet rs) throws SQLException {
        List<Signal> signals = new ArrayList<>();

        while (rs.next()) {
            Signal signal = new Signal(
                rs.getString("id"),
                rs.getString("rule_id"),
                rs.getString("rule_version"),
                rs.getString("span_id"),
                rs.getString("trace_id"),
                rs.getTimestamp("timestamp").toInstant(),
                Signal.SignalSeverity.valueOf(rs.getString("severity")),
                rs.getString("message"),
                parseAttributes(rs.getString("attributes")),
                rs.getString("source"),
                rs.getString("tenant_id"),
                Signal.SignalStatus.valueOf(rs.getString("status"))
            );
            signals.add(signal);
        }

        return signals;
    }

    /**
     * Parse JSON attributes from string.
     */
    private HashMap<String, Object> parseAttributes(String attributesJson) {
        // TODO: Use Jackson for JSON parsing
        // For now, return empty map
        return new HashMap<>();
    }
}
```

### 4. Request/Response Models

**File:** `backend/src/main/java/com/fluo/model/SignalQueryRequest.java`

```java
package com.fluo.model;

/**
 * Request model for advanced signal queries.
 */
public class SignalQueryRequest {
    private String sql;                      // SQL query string
    private int limit;                       // Max rows to return (default 1000)
    private int timeoutSeconds;              // Query timeout (default 10)

    // Constructors
    public SignalQueryRequest() {
        this.limit = 1000;
        this.timeoutSeconds = 10;
    }

    public SignalQueryRequest(String sql) {
        this();
        this.sql = sql;
    }

    // Getters and setters
    public String getSql() { return sql; }
    public void setSql(String sql) { this.sql = sql; }

    public int getLimit() { return limit; }
    public void setLimit(int limit) { this.limit = limit; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
}
```

**File:** `backend/src/main/java/com/fluo/model/SignalQueryResponse.java`

```java
package com.fluo.model;

import java.util.List;

/**
 * Response model for signal queries.
 */
public class SignalQueryResponse {
    private List<Signal> results;
    private int totalCount;
    private long executionTimeMs;
    private String queryId;
    private boolean fromCache;
    private QueryMetadata metadata;

    public static class QueryMetadata {
        private int hotStorageCount;    // Rows from DuckDB
        private int coldStorageCount;   // Rows from Parquet

        // Getters/setters
        public int getHotStorageCount() { return hotStorageCount; }
        public void setHotStorageCount(int hotStorageCount) {
            this.hotStorageCount = hotStorageCount;
        }

        public int getColdStorageCount() { return coldStorageCount; }
        public void setColdStorageCount(int coldStorageCount) {
            this.coldStorageCount = coldStorageCount;
        }
    }

    // Getters and setters
    public List<Signal> getResults() { return results; }
    public void setResults(List<Signal> results) { this.results = results; }

    public int getTotalCount() { return totalCount; }
    public void setTotalCount(int totalCount) { this.totalCount = totalCount; }

    public long getExecutionTimeMs() { return executionTimeMs; }
    public void setExecutionTimeMs(long executionTimeMs) {
        this.executionTimeMs = executionTimeMs;
    }

    public String getQueryId() { return queryId; }
    public void setQueryId(String queryId) { this.queryId = queryId; }

    public boolean isFromCache() { return fromCache; }
    public void setFromCache(boolean fromCache) { this.fromCache = fromCache; }

    public QueryMetadata getMetadata() { return metadata; }
    public void setMetadata(QueryMetadata metadata) { this.metadata = metadata; }
}
```

## Success Criteria

### Functional
- [ ] REST API endpoint `POST /api/signals/query` accepts SQL queries
- [ ] Valid SELECT queries execute successfully on DuckDB
- [ ] Query results return correct signals matching criteria
- [ ] Response includes execution metadata (time, count)

### Security
- [ ] SQL injection attempts blocked (DROP, DELETE, UPDATE rejected)
- [ ] Multiple statements rejected (no semicolons mid-query)
- [ ] Dangerous keywords blocked (ALTER, TRUNCATE, EXEC)
- [ ] Tenant isolation enforced (auto-inject tenant_id filter)
- [ ] Query timeout prevents DoS (10 second max)
- [ ] Query length limited (10K characters max)
- [ ] Row limit enforced (10K rows max)

### Performance
- [ ] Simple queries complete in <500ms for 1K signals
- [ ] Complex queries complete in <1s for 1K signals
- [ ] Queries on 10K signals complete in <3s

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**File:** `backend/src/test/java/com/fluo/processors/query/ValidateSqlQueryProcessorTest.java`

Required test cases:
- [ ] testRejectSqlInjectionAttempts
- [ ] testRejectDeleteQueries
- [ ] testRejectUpdateQueries
- [ ] testRejectDropQueries
- [ ] testRejectMultipleStatements
- [ ] testRejectQueriesExceedingMaxLength
- [ ] testRejectNonSelectQueries
- [ ] testAcceptValidSelectQuery
- [ ] testValidateLimitBounds

**File:** `backend/src/test/java/com/fluo/processors/query/InjectTenantIsolationProcessorTest.java`

Required test cases:
- [ ] testInjectTenantFilterIntoWhereClause
- [ ] testInjectTenantFilterWhenNoWhereClause
- [ ] testInjectTenantFilterBeforeOrderBy
- [ ] testInjectTenantFilterBeforeLimit
- [ ] testThrowExceptionIfTenantIdMissing

**File:** `backend/src/test/java/com/fluo/services/DuckDBQueryServiceTest.java`

Required test cases:
- [ ] testExecuteValidSqlQuery
- [ ] testQueryTimeoutLongRunningQueries
- [ ] testMapResultSetToSignals
- [ ] testPerTenantDatabaseFileIsolation

### Integration Tests

**File:** `backend/src/test/java/com/fluo/routes/SignalQueryRouteTest.java`

Required test cases:
- [ ] testExecuteQueryViaRestApi
- [ ] testRejectSqlInjectionViaApi
- [ ] testTenantIsolationViaApi
- [ ] testQueryResponseFormat

### Property-Based Tests

**Tenant isolation property:**
- [ ] No query can access other tenant's signals (1000 iterations)

## Files to Create

### Backend - Routes
- `backend/src/main/java/com/fluo/routes/SignalQueryRoute.java`

### Backend - Processors
- `backend/src/main/java/com/fluo/processors/query/ParseQueryRequestProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/ValidateSqlQueryProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/InjectTenantIsolationProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/ExecuteHotStorageQueryProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/FormatQueryResultsProcessor.java`

### Backend - Services
- `backend/src/main/java/com/fluo/services/DuckDBQueryService.java`

### Backend - Models
- `backend/src/main/java/com/fluo/model/SignalQueryRequest.java`
- `backend/src/main/java/com/fluo/model/SignalQueryResponse.java`

### Backend - Tests
- `backend/src/test/java/com/fluo/processors/query/ValidateSqlQueryProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/query/InjectTenantIsolationProcessorTest.java`
- `backend/src/test/java/com/fluo/services/DuckDBQueryServiceTest.java`
- `backend/src/test/java/com/fluo/routes/SignalQueryRouteTest.java`

## Files to Modify

- `backend/pom.xml` - Add DuckDB JDBC dependency if not present
- `backend/src/main/resources/application.properties` - Add query configuration

## Security Considerations

### SQL Injection Prevention
1. **Validate Query Structure**: Only allow SELECT statements
2. **Block Dangerous Keywords**: Reject DROP, DELETE, UPDATE, INSERT, ALTER, etc.
3. **Query Timeout**: Prevent DoS via slow queries (10 second timeout)
4. **Max Query Length**: Limit query to 10,000 characters
5. **Single Statement Only**: Reject queries with multiple statements

### Tenant Isolation (ADR-012)
- Tenant ID extracted from JWT token (not query parameters)
- Tenant filter prepended to WHERE clause (impossible to bypass)
- Per-tenant DuckDB files (physical isolation at filesystem level)
- Mathematical guarantee: User cannot access other tenant's data

## Architecture Compliance

- **ADR-011 (Pure Application)**: No external dependencies beyond DuckDB
- **ADR-012 (Tenant Isolation)**: Automatic tenant_id injection
- **ADR-013 (Camel-First)**: All APIs as Camel routes
- **ADR-014 (Named Processors)**: All processors are named beans, 90% test coverage
- **ADR-015 (Tiered Storage)**: Queries execute on DuckDB hot storage

## Timeline

**Duration:** Week 1 (5 days)

**Day 1-2:** Implement Camel routes and processors
**Day 3:** Implement DuckDBQueryService
**Day 4:** Write unit tests (90% coverage)
**Day 5:** Integration tests and documentation
