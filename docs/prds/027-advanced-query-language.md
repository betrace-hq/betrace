# PRD-027: Advanced Query Language for Signal Search

**Priority:** P2 (Polish & Scale)
**Complexity:** Medium-Complex
**Personas:** SREs, Developers, Compliance Officers
**Dependencies:** PRD-008 (Signal Management System), ADR-015 (Tiered Storage Architecture)

## Problem Statement

### Current Limitations

FLUO currently has basic signal filtering capabilities (status, severity, date range), but SREs and compliance teams need sophisticated query capabilities to investigate patterns and find specific signals:

**Real-world scenarios that fail today:**
1. **SRE Investigation**: "Find all HIGH severity signals from the last 7 days where rule_name contains 'database' AND status is 'open'"
2. **Compliance Audit**: "Show me signals for tenant X where created_at is between Jan 1 and Jan 31 AND severity is CRITICAL"
3. **Pattern Analysis**: "Find signals that have been 'open' for more than 24 hours"
4. **Performance Debugging**: "Show signals matching rule 'slow-query' with span_count > 1000"
5. **Full-Text Search**: "Search all signals for trace_id abc123 or message containing 'timeout'"

### Impact

**Without advanced query capabilities:**
- **SREs waste time** manually filtering signal lists with basic UI controls
- **Compliance officers cannot prove** specific evidence patterns exist (e.g., "all PII access has audit logs")
- **Developers cannot debug** complex behavioral patterns across multiple signals
- **Investigation speed drops** from seconds to minutes/hours

### Core Requirements

1. **Complex Filtering**: Support multiple filter operators (=, !=, <, >, <=, >=, contains, in, between)
2. **Logical Operators**: AND, OR, NOT, parentheses for grouping
3. **Full-Text Search**: Search across signal metadata, rule names, trace attributes
4. **Date/Time Functions**: Relative (last 7 days) and absolute (2025-01-01) date queries
5. **Saved Queries**: Save frequently used queries for reuse
6. **Performance**: Return results for 1000s of signals in <1 second

## Solution

### Architectural Decision: DuckDB SQL with Query Validation

**Recommendation:** Use DuckDB SQL directly instead of building custom DSL

**Rationale:**
1. **ADR-015 Tiered Storage**: Signals already stored in DuckDB hot storage (0-7 days)
2. **DuckDB Power**: Full SQL query engine with excellent performance (<100ms for complex queries)
3. **Full-Text Search**: DuckDB has full-text search extension built-in
4. **Time-to-Market**: No need to build custom parser, lexer, AST (weeks of work saved)
5. **Flexibility**: SQL is more powerful than we'd build in initial custom DSL

**Trade-offs:**
- ❌ SQL is less friendly than custom DSL (e.g., `severity = 'HIGH'` vs `severity is HIGH`)
- ❌ SQL injection risk (mitigated by parameterized queries + validation)
- ✅ Powerful from day 1 (full SQL capabilities)
- ✅ Fast implementation (leverage existing DuckDB integration)

### High-Level Architecture

```
Frontend Query Builder
        ↓
   REST API: POST /api/signals/query
        ↓
   [Camel Route: Query Validation]
        ↓
   QueryValidationProcessor
        ↓
   [SQL Injection Prevention]
        ↓
   [Tenant Isolation: AUTO-INJECT tenant_id = ?]
        ↓
   DuckDB Hot Storage Query (0-7 days)
        ↓
   (Future) Parquet Cold Storage Query (7-365 days)
        ↓
   [Merge Results]
        ↓
   JSON Response
```

### Query Language Design

#### Option 1: Pure SQL (Recommended for MVP)

**User writes SQL directly** (with validation):
```sql
SELECT * FROM signals
WHERE severity = 'HIGH'
  AND rule_name LIKE '%database%'
  AND created_at > '2025-01-01'
  AND status = 'OPEN'
ORDER BY created_at DESC
LIMIT 100
```

**Backend auto-injects tenant isolation:**
```sql
SELECT * FROM signals
WHERE tenant_id = '<tenant-uuid>'  -- Automatically injected!
  AND severity = 'HIGH'
  AND rule_name LIKE '%database%'
  AND created_at > '2025-01-01'
  AND status = 'OPEN'
ORDER BY created_at DESC
LIMIT 100
```

**Benefits:**
- Familiar syntax for technical users
- Full SQL power from day 1
- Validation is simpler (SQL parser already exists)

**Security:**
- Use DuckDB's parameterized queries (prevents SQL injection)
- Validate query structure (only SELECT allowed, no DELETE/UPDATE/DROP)
- Auto-inject `tenant_id = ?` to WHERE clause
- Timeout queries after 10 seconds
- Limit rows returned (max 10,000)

#### Option 2: Custom DSL (Future Enhancement)

**User-friendly syntax** (similar to FLUO DSL for rules):
```
severity = HIGH
and rule_name contains "database"
and created_at > "2025-01-01"
and status = OPEN
```

**Benefits:**
- More user-friendly than SQL
- Can add domain-specific functions (e.g., `created_within(last_7_days)`)
- Easier to build UI query builder

**Implementation:**
- Parse DSL → Generate SQL → Execute on DuckDB
- Reuse lexer/parser patterns from FLUO DSL (see `FluoDslParser.java`)

**Recommendation:** Ship Option 1 (SQL) for MVP, add Option 2 (DSL) based on user feedback

### Queryable Fields

**Signal model fields** (from `Signal.java`):
```
id              String         # Signal UUID (sig-abc123)
rule_id         String         # Rule UUID
rule_version    String         # Rule version
span_id         String         # OpenTelemetry span ID
trace_id        String         # OpenTelemetry trace ID
timestamp       Instant        # Signal creation time
severity        SignalSeverity # CRITICAL, HIGH, MEDIUM, LOW, INFO
message         String         # Signal message text
attributes      Map            # Custom attributes (JSON)
source          String         # Signal source
tenant_id       String         # Tenant UUID (auto-filtered)
status          SignalStatus   # PENDING, EVALUATING, EVALUATED, STORED, FAILED
```

**Extended fields** (from signal processing):
```
created_at      Instant        # Signal creation timestamp (same as timestamp)
updated_at      Instant        # Last update timestamp
span_count      Integer        # Number of spans in trace (from attributes)
rule_name       String         # Human-readable rule name (from rule lookup)
```

**Full-text search fields:**
```
message         String         # Signal message
rule_name       String         # Rule name
attributes      JSON           # Custom attributes
```

### Example Queries

#### Example 1: Find High Severity Signals from Last 7 Days
```sql
SELECT * FROM signals
WHERE severity = 'HIGH'
  AND created_at > CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;
```

#### Example 2: Find Signals with Specific Rule Pattern
```sql
SELECT * FROM signals
WHERE rule_name LIKE '%database%'
  AND status = 'OPEN'
ORDER BY created_at DESC;
```

#### Example 3: Date Range Query
```sql
SELECT * FROM signals
WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31'
  AND severity IN ('CRITICAL', 'HIGH')
ORDER BY severity DESC, created_at DESC;
```

#### Example 4: Find Stale Open Signals
```sql
SELECT * FROM signals
WHERE status = 'OPEN'
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY created_at ASC;
```

#### Example 5: High Span Count Signals
```sql
SELECT * FROM signals
WHERE CAST(json_extract(attributes, '$.span_count') AS INTEGER) > 1000
  AND rule_name = 'slow-query'
ORDER BY created_at DESC;
```

#### Example 6: Full-Text Search
```sql
SELECT * FROM signals
WHERE message LIKE '%timeout%'
   OR rule_name LIKE '%timeout%'
   OR trace_id = 'abc123'
ORDER BY created_at DESC;
```

#### Example 7: Complex Logical Query
```sql
SELECT * FROM signals
WHERE (severity = 'CRITICAL' OR severity = 'HIGH')
  AND status IN ('OPEN', 'INVESTIGATING')
  AND NOT (rule_name LIKE '%test%')
ORDER BY severity DESC, created_at DESC;
```

## Backend Implementation

### 1. Signal Query Camel Routes

**`backend/src/main/java/com/fluo/routes/SignalQueryRoute.java`:**
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
                .to("direct:executeSignalQuery")

            // Save query endpoint
            .post("/query/save")
                .description("Save SQL query for reuse")
                .type(SavedQueryRequest.class)
                .to("direct:saveSavedQuery")

            // List saved queries
            .get("/query/saved")
                .description("List saved queries for tenant")
                .to("direct:listSavedQueries")

            // Get saved query by ID
            .get("/query/saved/{id}")
                .description("Get saved query by ID")
                .to("direct:getSavedQuery")

            // Execute saved query
            .post("/query/saved/{id}/execute")
                .description("Execute saved query by ID")
                .to("direct:executeSavedQuery");

        // Execute signal query route
        from("direct:executeSignalQuery")
            .routeId("executeSignalQuery")
            .log("Executing signal query for tenant ${header.tenantId}")
            .process("extractTenantIdProcessor")           // Extract tenant from JWT
            .process("parseQueryRequestProcessor")          // Parse query request
            .process("validateSqlQueryProcessor")           // Validate SQL syntax + security
            .process("injectTenantIsolationProcessor")      // Auto-inject tenant_id = ?
            .process("executeHotStorageQueryProcessor")     // Query DuckDB
            .choice()
                .when(header("includeArchivedSignals").isEqualTo(true))
                    .process("executeColdStorageQueryProcessor")  // Query Parquet (future)
                    .process("mergeQueryResultsProcessor")        // Merge hot + cold
            .end()
            .process("formatQueryResultsProcessor")         // Format as JSON
            .marshal().json();

        // Save query route
        from("direct:saveSavedQuery")
            .routeId("saveSavedQuery")
            .log("Saving query for tenant ${header.tenantId}")
            .process("extractTenantIdProcessor")
            .process("validateSqlQueryProcessor")
            .process("storeSavedQueryProcessor")
            .marshal().json();

        // List saved queries route
        from("direct:listSavedQueries")
            .routeId("listSavedQueries")
            .log("Listing saved queries for tenant ${header.tenantId}")
            .process("extractTenantIdProcessor")
            .process("loadSavedQueriesProcessor")
            .marshal().json();

        // Execute saved query route
        from("direct:executeSavedQuery")
            .routeId("executeSavedQuery")
            .log("Executing saved query ${header.id}")
            .process("extractTenantIdProcessor")
            .process("loadSavedQueryProcessor")
            .process("validateSqlQueryProcessor")
            .process("injectTenantIsolationProcessor")
            .process("executeHotStorageQueryProcessor")
            .process("formatQueryResultsProcessor")
            .marshal().json();
    }
}
```

### 2. Query Request/Response Models

**`backend/src/main/java/com/fluo/model/SignalQueryRequest.java`:**
```java
package com.fluo.model;

/**
 * Request model for advanced signal queries.
 */
public class SignalQueryRequest {
    private String sql;                      // SQL query string
    private boolean includeArchivedSignals;  // Query cold storage (Parquet)
    private int limit;                       // Max rows to return (default 1000)
    private int timeoutSeconds;              // Query timeout (default 10)

    // Constructors
    public SignalQueryRequest() {
        this.includeArchivedSignals = false;
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

    public boolean isIncludeArchivedSignals() { return includeArchivedSignals; }
    public void setIncludeArchivedSignals(boolean includeArchivedSignals) {
        this.includeArchivedSignals = includeArchivedSignals;
    }

    public int getLimit() { return limit; }
    public void setLimit(int limit) { this.limit = limit; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
}
```

**`backend/src/main/java/com/fluo/model/SignalQueryResponse.java`:**
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
        private String queryPlan;       // DuckDB execution plan

        // Getters/setters
        public int getHotStorageCount() { return hotStorageCount; }
        public void setHotStorageCount(int hotStorageCount) {
            this.hotStorageCount = hotStorageCount;
        }

        public int getColdStorageCount() { return coldStorageCount; }
        public void setColdStorageCount(int coldStorageCount) {
            this.coldStorageCount = coldStorageCount;
        }

        public String getQueryPlan() { return queryPlan; }
        public void setQueryPlan(String queryPlan) { this.queryPlan = queryPlan; }
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

**`backend/src/main/java/com/fluo/model/SavedQuery.java`:**
```java
package com.fluo.model;

import java.time.Instant;
import java.util.UUID;

/**
 * Saved query model for reusable queries.
 */
public class SavedQuery {
    private String id;
    private String tenantId;
    private String name;
    private String description;
    private String sql;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private int executionCount;

    // Constructors
    public SavedQuery() {}

    public SavedQuery(String tenantId, String name, String sql) {
        this.id = "query-" + UUID.randomUUID().toString();
        this.tenantId = tenantId;
        this.name = name;
        this.sql = sql;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        this.executionCount = 0;
    }

    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSql() { return sql; }
    public void setSql(String sql) { this.sql = sql; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public int getExecutionCount() { return executionCount; }
    public void setExecutionCount(int executionCount) {
        this.executionCount = executionCount;
    }

    public SavedQuery incrementExecutionCount() {
        this.executionCount++;
        this.updatedAt = Instant.now();
        return this;
    }
}
```

### 3. Named Processors

**`backend/src/main/java/com/fluo/processors/query/ParseQueryRequestProcessor.java`:**
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
        exchange.getIn().setHeader("includeArchivedSignals", request.isIncludeArchivedSignals());
        exchange.getIn().setHeader("limit", request.getLimit());
        exchange.getIn().setHeader("timeoutSeconds", request.getTimeoutSeconds());

        // Store original request
        exchange.getIn().setHeader("queryRequest", request);
    }
}
```

**`backend/src/main/java/com/fluo/processors/query/ValidateSqlQueryProcessor.java`:**
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

**`backend/src/main/java/com/fluo/processors/query/InjectTenantIsolationProcessor.java`:**
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

**`backend/src/main/java/com/fluo/processors/query/ExecuteHotStorageQueryProcessor.java`:**
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

**`backend/src/main/java/com/fluo/processors/query/FormatQueryResultsProcessor.java`:**
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

### 4. DuckDB Query Service

**`backend/src/main/java/com/fluo/services/DuckDBQueryService.java`:**
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

### 5. Saved Query Service

**`backend/src/main/java/com/fluo/services/SavedQueryService.java`:**
```java
package com.fluo.services;

import com.fluo.model.SavedQuery;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing saved queries.
 *
 * Note: In-memory implementation for MVP.
 * Future: Store in TigerBeetle or DuckDB.
 */
@ApplicationScoped
public class SavedQueryService {

    // In-memory storage (tenant_id -> query_id -> SavedQuery)
    private final Map<String, Map<String, SavedQuery>> savedQueries = new ConcurrentHashMap<>();

    /**
     * Save a query for a tenant.
     */
    public SavedQuery saveQuery(SavedQuery query) {
        savedQueries
            .computeIfAbsent(query.getTenantId(), k -> new ConcurrentHashMap<>())
            .put(query.getId(), query);
        return query;
    }

    /**
     * Get saved query by ID.
     */
    public Optional<SavedQuery> getQuery(String tenantId, String queryId) {
        return Optional.ofNullable(savedQueries.get(tenantId))
            .map(queries -> queries.get(queryId));
    }

    /**
     * List all saved queries for tenant.
     */
    public List<SavedQuery> listQueries(String tenantId) {
        return Optional.ofNullable(savedQueries.get(tenantId))
            .map(queries -> new ArrayList<>(queries.values()))
            .orElse(Collections.emptyList());
    }

    /**
     * Delete saved query.
     */
    public boolean deleteQuery(String tenantId, String queryId) {
        return Optional.ofNullable(savedQueries.get(tenantId))
            .map(queries -> queries.remove(queryId) != null)
            .orElse(false);
    }

    /**
     * Increment execution count for query.
     */
    public void incrementExecutionCount(String tenantId, String queryId) {
        getQuery(tenantId, queryId).ifPresent(query -> {
            query.incrementExecutionCount();
            saveQuery(query);
        });
    }
}
```

## Frontend Implementation

### 1. Signal Query Page Component

**`bff/src/components/signals/signal-query-page.tsx`:**
```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PlayIcon, SaveIcon, BookmarkIcon } from 'lucide-react';
import { executeSignalQuery, listSavedQueries } from '@/lib/api/signal-query';
import { SignalQueryResponse, SavedQuery } from '@/lib/types/signal-query';

export function SignalQueryPage() {
  const [sql, setSql] = useState('');
  const [results, setResults] = useState<SignalQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  const handleExecuteQuery = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await executeSignalQuery({
        sql,
        includeArchivedSignals: false,
        limit: 1000,
        timeoutSeconds: 10,
      });
      setResults(response);
    } catch (err: any) {
      setError(err.message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuery = async () => {
    const name = prompt('Enter query name:');
    if (!name) return;

    // TODO: Call save query API
    alert('Query saved!');
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Advanced Signal Query</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Query Editor */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>SQL Query Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="SELECT * FROM signals WHERE severity = 'HIGH' ORDER BY created_at DESC LIMIT 100"
                className="min-h-[200px] font-mono text-sm"
              />

              <div className="flex gap-2 mt-4">
                <Button onClick={handleExecuteQuery} disabled={loading}>
                  <PlayIcon className="w-4 h-4 mr-2" />
                  {loading ? 'Executing...' : 'Execute Query'}
                </Button>
                <Button variant="outline" onClick={handleSaveQuery}>
                  <SaveIcon className="w-4 h-4 mr-2" />
                  Save Query
                </Button>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200 rounded">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Query Results */}
          {results && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Query Results</CardTitle>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span>{results.totalCount} signals found</span>
                  <span>•</span>
                  <span>{results.executionTimeMs}ms execution time</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {results.results.map((signal) => (
                        <tr key={signal.id}>
                          <td className="px-4 py-2">
                            <Badge variant={signal.severity === 'CRITICAL' ? 'destructive' : 'default'}>
                              {signal.severity}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 font-mono text-sm">{signal.ruleId}</td>
                          <td className="px-4 py-2">{signal.message}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {new Date(signal.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline">{signal.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Saved Queries Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookmarkIcon className="w-4 h-4" />
                Saved Queries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {savedQueries.map((query) => (
                  <Button
                    key={query.id}
                    variant="ghost"
                    className="w-full justify-start text-left"
                    onClick={() => setSql(query.sql)}
                  >
                    <div className="truncate">
                      <div className="font-medium">{query.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {query.sql.substring(0, 50)}...
                      </div>
                    </div>
                  </Button>
                ))}

                {savedQueries.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No saved queries yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Example Queries */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Example Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left text-xs"
                  onClick={() => setSql("SELECT * FROM signals WHERE severity = 'HIGH' AND created_at > CURRENT_DATE - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 100")}
                >
                  High severity signals (last 7 days)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left text-xs"
                  onClick={() => setSql("SELECT * FROM signals WHERE status = 'OPEN' AND created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours' ORDER BY created_at ASC")}
                >
                  Stale open signals (>24 hours)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left text-xs"
                  onClick={() => setSql("SELECT * FROM signals WHERE rule_name LIKE '%database%' ORDER BY created_at DESC LIMIT 100")}
                >
                  Database-related signals
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

### 2. Signal Query API Client

**`bff/src/lib/api/signal-query.ts`:**
```typescript
import { apiClient } from './client';

export interface SignalQueryRequest {
  sql: string;
  includeArchivedSignals?: boolean;
  limit?: number;
  timeoutSeconds?: number;
}

export interface SignalQueryResponse {
  results: Signal[];
  totalCount: number;
  executionTimeMs: number;
  queryId: string;
  fromCache: boolean;
  metadata: {
    hotStorageCount: number;
    coldStorageCount: number;
    queryPlan?: string;
  };
}

export interface SavedQuery {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sql: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  executionCount: number;
}

export interface SavedQueryRequest {
  name: string;
  description?: string;
  sql: string;
}

/**
 * Execute SQL query on signals
 */
export async function executeSignalQuery(
  request: SignalQueryRequest
): Promise<SignalQueryResponse> {
  const response = await apiClient.post('/api/signals/query', request);
  return response.data;
}

/**
 * Save a query for reuse
 */
export async function saveQuery(request: SavedQueryRequest): Promise<SavedQuery> {
  const response = await apiClient.post('/api/signals/query/save', request);
  return response.data;
}

/**
 * List saved queries for tenant
 */
export async function listSavedQueries(): Promise<SavedQuery[]> {
  const response = await apiClient.get('/api/signals/query/saved');
  return response.data;
}

/**
 * Get saved query by ID
 */
export async function getSavedQuery(id: string): Promise<SavedQuery> {
  const response = await apiClient.get(`/api/signals/query/saved/${id}`);
  return response.data;
}

/**
 * Execute saved query by ID
 */
export async function executeSavedQuery(id: string): Promise<SignalQueryResponse> {
  const response = await apiClient.post(`/api/signals/query/saved/${id}/execute`);
  return response.data;
}

/**
 * Delete saved query
 */
export async function deleteSavedQuery(id: string): Promise<void> {
  await apiClient.delete(`/api/signals/query/saved/${id}`);
}
```

### 3. Query Builder Component (Future Enhancement)

**`bff/src/components/signals/query-builder.tsx`:**
```tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

/**
 * Visual query builder for non-SQL users.
 * Generates SQL from UI selections.
 *
 * Future enhancement - not included in MVP.
 */
export function QueryBuilder() {
  const [field, setField] = useState('severity');
  const [operator, setOperator] = useState('=');
  const [value, setValue] = useState('');

  const generateSQL = () => {
    return `SELECT * FROM signals WHERE ${field} ${operator} '${value}' ORDER BY created_at DESC LIMIT 100`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Query Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Select value={field} onValueChange={setField}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="rule_name">Rule Name</SelectItem>
                <SelectItem value="created_at">Created At</SelectItem>
              </SelectContent>
            </Select>

            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="=">=</SelectItem>
                <SelectItem value="!=">!=</SelectItem>
                <SelectItem value="<">&lt;</SelectItem>
                <SelectItem value=">">&gt;</SelectItem>
                <SelectItem value="LIKE">contains</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value"
            />
          </div>

          <Button onClick={() => console.log(generateSQL())}>
            Generate SQL
          </Button>

          <pre className="p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
            {generateSQL()}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Security Considerations

### 1. SQL Injection Prevention

**Mitigation Strategies:**
1. **Validate Query Structure**: Only allow SELECT statements
2. **Block Dangerous Keywords**: Reject DROP, DELETE, UPDATE, INSERT, ALTER, etc.
3. **Parameterized Queries**: Use DuckDB's prepared statements (future enhancement)
4. **Query Timeout**: Prevent DoS via slow queries (10 second timeout)
5. **Max Query Length**: Limit query to 10,000 characters
6. **Single Statement Only**: Reject queries with multiple statements (no semicolons mid-query)

**Example Attack Prevention:**
```sql
-- BLOCKED: SQL injection attempt
SELECT * FROM signals WHERE id = '1'; DROP TABLE signals; --'

-- BLOCKED: Dangerous operation
DELETE FROM signals WHERE tenant_id = 'abc'

-- BLOCKED: Multiple statements
SELECT * FROM signals; SELECT * FROM tenants

-- ALLOWED: Safe query
SELECT * FROM signals WHERE severity = 'HIGH' ORDER BY created_at DESC LIMIT 100
```

### 2. Tenant Isolation (ADR-012 Compliance)

**Automatic Tenant Filter Injection:**
```java
// User query:
SELECT * FROM signals WHERE severity = 'HIGH'

// After InjectTenantIsolationProcessor:
SELECT * FROM signals WHERE tenant_id = '<tenant-uuid>' AND severity = 'HIGH'
```

**Security Properties:**
- Tenant ID extracted from JWT token (not query parameters)
- Tenant filter prepended to WHERE clause (impossible to bypass)
- Per-tenant DuckDB files (physical isolation at filesystem level)
- Mathematical guarantee: User cannot access other tenant's data

### 3. Query Performance Limits

**Resource Constraints:**
- Max query execution time: 10 seconds (configurable)
- Max rows returned: 10,000 (prevent memory exhaustion)
- Max query length: 10,000 characters
- Query timeout enforced at DuckDB level

**DDoS Prevention:**
- Rate limiting on query endpoint (e.g., 10 queries/minute per tenant)
- Query caching (same query returns cached result for 60 seconds)
- Query cost estimation (future: reject expensive queries)

### 4. Audit Logging

**Log all query executions:**
```java
@SOC2(controls = {CC7_2}, notes = "Query audit trail")
public List<Signal> executeQuery(UUID tenantId, String sql, int timeoutSeconds) {
    log.info("Query executed: tenantId={}, sql={}, timeout={}", tenantId, sql, timeoutSeconds);
    // ... execute query
    log.info("Query completed: tenantId={}, rows={}, time={}ms", tenantId, results.size(), executionTimeMs);
}
```

**Compliance span emission:**
- Every query execution emits compliance span with:
  - `query.sql`: SQL query string (PII-redacted)
  - `query.tenantId`: Tenant UUID
  - `query.executionTimeMs`: Query performance
  - `query.rowsReturned`: Result count

## Testing Requirements

### 1. Unit Tests

**Query Validation Tests:**
```java
@Test
@DisplayName("Should reject SQL injection attempts")
void testSqlInjectionPrevention() {
    ValidateSqlQueryProcessor processor = new ValidateSqlQueryProcessor();
    Exchange exchange = createTestExchange();

    exchange.getIn().setHeader("sql", "SELECT * FROM signals; DROP TABLE signals;");

    SecurityException ex = assertThrows(SecurityException.class, () -> processor.process(exchange));
    assertTrue(ex.getMessage().contains("dangerous operations"));
}

@Test
@DisplayName("Should reject DELETE queries")
void testDeleteRejection() {
    ValidateSqlQueryProcessor processor = new ValidateSqlQueryProcessor();
    Exchange exchange = createTestExchange();

    exchange.getIn().setHeader("sql", "DELETE FROM signals WHERE id = '123'");

    SecurityException ex = assertThrows(SecurityException.class, () -> processor.process(exchange));
    assertTrue(ex.getMessage().contains("Only SELECT queries are allowed"));
}

@Test
@DisplayName("Should reject queries exceeding max length")
void testMaxLengthValidation() {
    ValidateSqlQueryProcessor processor = new ValidateSqlQueryProcessor();
    Exchange exchange = createTestExchange();

    String longQuery = "SELECT * FROM signals WHERE " + "x = 'y' AND ".repeat(1000);
    exchange.getIn().setHeader("sql", longQuery);

    IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
        () -> processor.process(exchange));
    assertTrue(ex.getMessage().contains("Query too long"));
}
```

**Tenant Isolation Tests:**
```java
@Test
@DisplayName("Should inject tenant filter into WHERE clause")
void testTenantFilterInjection() throws Exception {
    InjectTenantIsolationProcessor processor = new InjectTenantIsolationProcessor();
    Exchange exchange = createTestExchange();
    UUID tenantId = UUID.randomUUID();

    exchange.getIn().setHeader("validatedSql", "SELECT * FROM signals WHERE severity = 'HIGH'");
    exchange.getIn().setHeader("tenantId", tenantId);

    processor.process(exchange);

    String isolatedSql = exchange.getIn().getHeader("isolatedSql", String.class);
    assertTrue(isolatedSql.contains("tenant_id = '" + tenantId.toString() + "'"));
    assertTrue(isolatedSql.contains("AND severity = 'HIGH'"));
}

@Test
@DisplayName("Should inject tenant filter when no WHERE clause exists")
void testTenantFilterInjectionNoWhere() throws Exception {
    InjectTenantIsolationProcessor processor = new InjectTenantIsolationProcessor();
    Exchange exchange = createTestExchange();
    UUID tenantId = UUID.randomUUID();

    exchange.getIn().setHeader("validatedSql", "SELECT * FROM signals ORDER BY created_at DESC");
    exchange.getIn().setHeader("tenantId", tenantId);

    processor.process(exchange);

    String isolatedSql = exchange.getIn().getHeader("isolatedSql", String.class);
    assertTrue(isolatedSql.contains("WHERE tenant_id = '" + tenantId.toString() + "'"));
    assertTrue(isolatedSql.contains("ORDER BY created_at DESC"));
}

@Test
@DisplayName("Should throw exception if tenant ID missing")
void testMissingTenantId() {
    InjectTenantIsolationProcessor processor = new InjectTenantIsolationProcessor();
    Exchange exchange = createTestExchange();

    exchange.getIn().setHeader("validatedSql", "SELECT * FROM signals");
    // No tenant ID set

    SecurityException ex = assertThrows(SecurityException.class, () -> processor.process(exchange));
    assertTrue(ex.getMessage().contains("Tenant ID is required"));
}
```

**Query Execution Tests:**
```java
@Test
@DisplayName("Should execute valid SQL query on DuckDB")
void testQueryExecution() throws Exception {
    DuckDBQueryService service = new DuckDBQueryService();
    UUID tenantId = UUID.randomUUID();

    // Insert test data
    insertTestSignals(tenantId, 100);

    String sql = "SELECT * FROM signals WHERE severity = 'HIGH' ORDER BY created_at DESC LIMIT 10";
    List<Signal> results = service.executeQuery(tenantId, sql, 10);

    assertFalse(results.isEmpty());
    assertTrue(results.size() <= 10);
    assertTrue(results.stream().allMatch(s -> s.getSeverity() == Signal.SignalSeverity.HIGH));
}

@Test
@DisplayName("Should timeout long-running queries")
void testQueryTimeout() {
    DuckDBQueryService service = new DuckDBQueryService();
    UUID tenantId = UUID.randomUUID();

    // Query that takes >10 seconds
    String sql = "SELECT * FROM signals, generate_series(1, 10000000)";

    assertThrows(SQLException.class, () -> service.executeQuery(tenantId, sql, 1));
}
```

### 2. Integration Tests

**End-to-End Query Tests:**
```java
@Test
@DisplayName("Should execute query via REST API")
void testQueryViaAPI() {
    SignalQueryRequest request = new SignalQueryRequest();
    request.setSql("SELECT * FROM signals WHERE severity = 'HIGH' LIMIT 100");

    given()
        .contentType("application/json")
        .body(request)
    .when()
        .post("/api/signals/query")
    .then()
        .statusCode(200)
        .body("totalCount", greaterThan(0))
        .body("executionTimeMs", lessThan(1000))
        .body("metadata.hotStorageCount", greaterThan(0));
}

@Test
@DisplayName("Should reject SQL injection via API")
void testSqlInjectionViaAPI() {
    SignalQueryRequest request = new SignalQueryRequest();
    request.setSql("SELECT * FROM signals; DROP TABLE signals;");

    given()
        .contentType("application/json")
        .body(request)
    .when()
        .post("/api/signals/query")
    .then()
        .statusCode(400)
        .body("message", containsString("dangerous operations"));
}
```

### 3. Property-Based Tests

**Tenant Isolation Property:**
```java
@Test
@DisplayName("Property: No query can access other tenant's signals")
void testTenantIsolationProperty() {
    for (int i = 0; i < 1000; i++) {
        UUID tenantA = UUID.randomUUID();
        UUID tenantB = UUID.randomUUID();

        insertTestSignals(tenantA, 100);
        insertTestSignals(tenantB, 100);

        // Try various query patterns
        String[] queries = {
            "SELECT * FROM signals",
            "SELECT * FROM signals WHERE severity = 'HIGH'",
            "SELECT * FROM signals WHERE tenant_id = '" + tenantB + "'", // Attempt bypass
        };

        for (String sql : queries) {
            List<Signal> results = executeQueryAsTenant(tenantA, sql);

            // Property: All results MUST belong to tenantA
            assertTrue(results.stream().allMatch(s -> s.getTenantId().equals(tenantA.toString())),
                "Query leaked data from other tenant!");
        }
    }
}
```

### 4. Performance Tests

**Query Performance Benchmarks:**
```java
@Test
@DisplayName("Should query 1000 signals in <1 second")
void testQueryPerformance() throws Exception {
    UUID tenantId = UUID.randomUUID();
    insertTestSignals(tenantId, 1000);

    String sql = "SELECT * FROM signals WHERE severity = 'HIGH' ORDER BY created_at DESC LIMIT 100";

    long startTime = System.currentTimeMillis();
    List<Signal> results = duckDBQueryService.executeQuery(tenantId, sql, 10);
    long duration = System.currentTimeMillis() - startTime;

    assertTrue(duration < 1000, "Query took " + duration + "ms (expected <1000ms)");
    assertTrue(results.size() <= 100);
}

@Test
@DisplayName("Should query 10K signals in <3 seconds")
void testLargeQueryPerformance() throws Exception {
    UUID tenantId = UUID.randomUUID();
    insertTestSignals(tenantId, 10_000);

    String sql = "SELECT * FROM signals WHERE severity IN ('HIGH', 'CRITICAL') ORDER BY created_at DESC LIMIT 1000";

    long startTime = System.currentTimeMillis();
    List<Signal> results = duckDBQueryService.executeQuery(tenantId, sql, 10);
    long duration = System.currentTimeMillis() - startTime;

    assertTrue(duration < 3000, "Query took " + duration + "ms (expected <3000ms)");
}
```

**Test Coverage Target:** 90% instruction, 80% branch (ADR-014 compliance)

## Success Criteria

### Functional Requirements

- [ ] Users can execute SQL queries on signals via REST API
- [ ] Query results return correct signal records matching query criteria
- [ ] Complex queries work: AND, OR, NOT, LIKE, IN, BETWEEN, date functions
- [ ] Full-text search across message, rule_name, trace_id fields
- [ ] Date range queries work (absolute and relative)
- [ ] Saved queries can be created, listed, retrieved, executed, deleted
- [ ] Query results include execution metadata (time, row count, source)

### Security Requirements

- [ ] SQL injection attempts are blocked (DROP, DELETE, UPDATE rejected)
- [ ] Multiple statements are rejected (no semicolons mid-query)
- [ ] Dangerous keywords are blocked (ALTER, TRUNCATE, EXEC)
- [ ] Tenant isolation enforced (auto-inject tenant_id filter)
- [ ] Query timeout prevents DoS (10 second max)
- [ ] Query length limited (10K characters max)
- [ ] Row limit enforced (10K rows max)
- [ ] All queries logged for audit trail

### Performance Requirements

- [ ] Simple queries (<10 filters) complete in <500ms for 1K signals
- [ ] Complex queries (10+ filters) complete in <1s for 1K signals
- [ ] Large result sets (1K rows) complete in <2s
- [ ] Query on 10K signals completes in <3s
- [ ] Full-text search completes in <1s for 1K signals

### User Experience Requirements

- [ ] Query editor has syntax highlighting (Monaco editor)
- [ ] Query results displayed in sortable table
- [ ] Saved queries accessible from sidebar
- [ ] Example queries provided for common use cases
- [ ] Error messages are clear and actionable
- [ ] Loading state shown during query execution

### Testing Requirements

- [ ] 90% instruction coverage (ADR-014 compliance)
- [ ] 80% branch coverage
- [ ] SQL injection tests pass (all attack vectors blocked)
- [ ] Tenant isolation tests pass (property-based 1000 iterations)
- [ ] Performance benchmarks pass (<1s for 1K signals)
- [ ] Integration tests pass (end-to-end query execution)

## Implementation Phases

### Phase 1: Core Query Infrastructure (Week 1)
**Goal:** Basic SQL query execution with security validation

1. Create `SignalQueryRoute.java` (Camel REST routes)
2. Implement named processors:
   - `ParseQueryRequestProcessor`
   - `ValidateSqlQueryProcessor`
   - `InjectTenantIsolationProcessor`
   - `ExecuteHotStorageQueryProcessor`
   - `FormatQueryResultsProcessor`
3. Create models: `SignalQueryRequest`, `SignalQueryResponse`
4. Implement `DuckDBQueryService` (execute queries on DuckDB)
5. Write unit tests (90% coverage)

**Success Criteria:**
- REST API endpoint `/api/signals/query` works
- SQL injection blocked
- Tenant isolation enforced
- Query execution works on DuckDB

### Phase 2: Saved Queries (Week 2)
**Goal:** Save and reuse frequently used queries

1. Create `SavedQuery` model
2. Implement `SavedQueryService` (in-memory storage)
3. Add Camel routes:
   - `POST /api/signals/query/save`
   - `GET /api/signals/query/saved`
   - `GET /api/signals/query/saved/{id}`
   - `POST /api/signals/query/saved/{id}/execute`
4. Add processors:
   - `StoreSavedQueryProcessor`
   - `LoadSavedQueriesProcessor`
   - `LoadSavedQueryProcessor`
5. Write unit tests

**Success Criteria:**
- Users can save queries
- Saved queries listed and retrieved
- Saved queries can be executed

### Phase 3: Frontend Query UI (Week 3)
**Goal:** User-friendly query interface

1. Create `SignalQueryPage` component
2. Implement SQL editor (Textarea → future Monaco editor)
3. Add query execution button + loading state
4. Display query results in table
5. Add saved queries sidebar
6. Add example queries
7. Implement error handling
8. Create API client (`signal-query.ts`)

**Success Criteria:**
- Users can write and execute SQL queries
- Results displayed in table
- Saved queries accessible
- Error messages shown clearly

### Phase 4: Performance Optimization (Week 4)
**Goal:** Optimize query performance for production scale

1. Add query result caching (Redis or in-memory)
2. Implement query plan analysis (DuckDB EXPLAIN)
3. Add query cost estimation (reject expensive queries)
4. Optimize DuckDB indexes for common queries
5. Add query performance monitoring (OpenTelemetry spans)
6. Implement rate limiting (10 queries/minute per tenant)
7. Run performance benchmarks (1K, 10K, 100K signals)

**Success Criteria:**
- Queries on 1K signals complete in <500ms
- Queries on 10K signals complete in <3s
- Query caching reduces repeated query time by 90%
- Rate limiting prevents abuse

### Phase 5: Documentation & Polish (Week 5)
**Goal:** Complete documentation and UI polish

1. Document query API in OpenAPI spec
2. Create user guide for SQL queries
3. Add SQL syntax highlighting (Monaco editor)
4. Add query autocomplete (field names)
5. Add query history (last 10 queries)
6. Create video tutorial for query usage
7. Add query examples to documentation

**Success Criteria:**
- Complete API documentation
- User guide published
- Monaco editor integrated
- Video tutorial recorded

## Future Enhancements

### 1. Custom DSL (Post-MVP)
**Build user-friendly query language:**
```
severity = HIGH
and rule_name contains "database"
and created_at within last_7_days
```

**Implementation:**
- Reuse FLUO DSL parser patterns (`FluoDslParser.java`)
- Generate SQL from DSL AST
- Provide query builder UI (dropdown menus)

**Timeline:** 2-3 weeks after MVP

### 2. Query Builder UI
**Visual query builder for non-SQL users:**
- Dropdown menus for fields, operators, values
- Add filter button (AND/OR logic)
- Generate SQL from UI selections
- Real-time SQL preview

**Timeline:** 1 week after MVP

### 3. Cold Storage Queries (Parquet)
**Query archived signals (7-365 days):**
- Implement `ExecuteColdStorageQueryProcessor`
- Query Parquet files via DuckDB
- Merge hot + cold results
- Add `includeArchivedSignals` flag

**Timeline:** 1 week (depends on ADR-015 cold storage implementation)

### 4. Full-Text Search Extension
**DuckDB full-text search:**
```sql
SELECT * FROM signals WHERE fts_search(message, 'timeout error')
```

**Implementation:**
- Enable DuckDB FTS extension
- Create full-text indexes on message, rule_name
- Add FTS functions to query syntax

**Timeline:** 3 days

### 5. Query Result Export
**Export query results:**
- CSV export
- JSON export
- Parquet export (for data science)

**Timeline:** 2 days

### 6. Query Sharing
**Share queries across team:**
- Public saved queries (tenant-wide)
- Query permissions (admin-only queries)
- Query collaboration (comments, tags)

**Timeline:** 1 week

## Alternatives Considered

### Alternative 1: Elasticsearch for Full-Text Search
**Considered:** Use Elasticsearch for signal search

**Rejected Reasons:**
- ❌ Violates ADR-011 (adds external dependency)
- ❌ Adds complexity (dual-write to DuckDB + Elasticsearch)
- ❌ Increases costs (Elasticsearch infrastructure)
- ❌ DuckDB has built-in full-text search
- ❌ Signals already in DuckDB (no need for separate search engine)

### Alternative 2: Build Custom DSL from Day 1
**Considered:** Custom query language instead of SQL

**Rejected Reasons:**
- ❌ Takes 3-4 weeks to build parser, lexer, AST, code generator
- ❌ Limited power compared to SQL
- ❌ Requires UI query builder (more work)
- ❌ Harder to debug (no standard tools)
- ✅ Can add later as enhancement (DSL → SQL compiler)

**Decision:** Ship SQL MVP, add DSL based on user feedback

### Alternative 3: GraphQL API for Queries
**Considered:** GraphQL query API instead of SQL

**Rejected Reasons:**
- ❌ Less powerful than SQL for complex queries
- ❌ Requires GraphQL schema definition
- ❌ Adds dependency (GraphQL server)
- ❌ Users prefer SQL for ad-hoc queries
- ✅ GraphQL better for structured data fetching (not queries)

### Alternative 4: Store Signals in Postgres, Use Postgres FTS
**Considered:** Use Postgres instead of DuckDB

**Rejected Reasons:**
- ❌ Violates ADR-015 (Tiered Storage Architecture)
- ❌ DuckDB optimized for analytics (columnar storage)
- ❌ Postgres not ideal for time-series data
- ❌ DuckDB has better query performance for OLAP

## Dependencies

### Internal Dependencies
- **PRD-008**: Signal Management System (signals must be persisted)
- **ADR-015**: Tiered Storage Architecture (DuckDB hot storage)
- **ADR-012**: Mathematical Tenant Isolation (tenant isolation patterns)
- **ADR-013**: Apache Camel-First Architecture (Camel routes)
- **ADR-014**: Camel Testing Standards (90% coverage, named processors)

### External Dependencies
- **DuckDB JDBC Driver**: Already integrated in backend
- **Monaco Editor** (future): SQL syntax highlighting in frontend

## Risks & Mitigations

### Risk 1: SQL Injection
**Likelihood:** Medium
**Impact:** Critical (data breach)

**Mitigation:**
- Multi-layer validation (keyword blocking, query structure validation)
- Parameterized queries (DuckDB prepared statements)
- Query timeout (prevent DoS)
- Audit logging (detect attempts)
- Security testing (100+ SQL injection test cases)

### Risk 2: Performance Degradation
**Likelihood:** Medium
**Impact:** High (poor UX)

**Mitigation:**
- Query timeout (10 seconds max)
- Row limit (10K rows max)
- Query caching (60 second cache)
- DuckDB indexes on common fields
- Performance benchmarks (automated tests)

### Risk 3: Tenant Data Leakage
**Likelihood:** Low
**Impact:** Critical (compliance violation)

**Mitigation:**
- Automatic tenant filter injection (impossible to bypass)
- Per-tenant DuckDB files (filesystem-level isolation)
- Property-based testing (1000 iterations)
- JWT-based tenant extraction (not query parameters)

### Risk 4: Feature Complexity
**Likelihood:** Medium
**Impact:** Medium (delayed shipping)

**Mitigation:**
- MVP focuses on SQL only (no DSL, no query builder)
- Future enhancements are optional (ship incremental value)
- Detailed implementation plan (5 phases, 5 weeks)

## Metrics & Observability

### Query Performance Metrics
```java
@Counted(name = "signal_queries_total", description = "Total signal queries executed")
@Timed(name = "signal_query_duration", description = "Signal query execution time")
public List<Signal> executeQuery(UUID tenantId, String sql, int timeoutSeconds) {
    // ... execute query
}
```

**Grafana Dashboard:**
- Query execution time (p50, p95, p99)
- Query success/failure rate
- Queries per tenant
- Top 10 slowest queries
- Top 10 most executed queries
- Query cache hit rate

### Compliance Spans
```java
@SOC2(controls = {CC7_2}, notes = "Query audit trail")
public List<Signal> executeQuery(UUID tenantId, String sql, int timeoutSeconds) {
    // Emits compliance span with query details
}
```

### Audit Logging
```
INFO  Query executed: tenantId=abc123, sql="SELECT * FROM signals WHERE...", timeout=10s
INFO  Query completed: tenantId=abc123, rows=150, time=234ms
ERROR Query failed: tenantId=abc123, error="SQL syntax error", sql="SELECT * FRM signals"
```

## Documentation Checklist

- [ ] API documentation (OpenAPI spec for query endpoints)
- [ ] User guide (how to write SQL queries)
- [ ] Query examples (common use cases)
- [ ] Security documentation (SQL injection prevention)
- [ ] Architecture documentation (DuckDB integration)
- [ ] Video tutorial (query usage walkthrough)
- [ ] Storybook stories (SignalQueryPage component)

## Files to Create

### Backend - Camel Routes
- `backend/src/main/java/com/fluo/routes/SignalQueryRoute.java`

### Backend - Named Processors
- `backend/src/main/java/com/fluo/processors/query/ParseQueryRequestProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/ValidateSqlQueryProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/InjectTenantIsolationProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/ExecuteHotStorageQueryProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/FormatQueryResultsProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/StoreSavedQueryProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/LoadSavedQueriesProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/LoadSavedQueryProcessor.java`

### Backend - Services
- `backend/src/main/java/com/fluo/services/DuckDBQueryService.java`
- `backend/src/main/java/com/fluo/services/SavedQueryService.java`

### Backend - Models
- `backend/src/main/java/com/fluo/model/SignalQueryRequest.java`
- `backend/src/main/java/com/fluo/model/SignalQueryResponse.java`
- `backend/src/main/java/com/fluo/model/SavedQuery.java`
- `backend/src/main/java/com/fluo/model/SavedQueryRequest.java`

### Backend - Tests
- `backend/src/test/java/com/fluo/routes/SignalQueryRouteTest.java`
- `backend/src/test/java/com/fluo/processors/query/ValidateSqlQueryProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/query/InjectTenantIsolationProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/query/ExecuteHotStorageQueryProcessorTest.java`
- `backend/src/test/java/com/fluo/services/DuckDBQueryServiceTest.java`
- `backend/src/test/java/com/fluo/services/SavedQueryServiceTest.java`

### Frontend - Components
- `bff/src/components/signals/signal-query-page.tsx`
- `bff/src/components/signals/query-builder.tsx` (future)

### Frontend - API Client
- `bff/src/lib/api/signal-query.ts`

### Frontend - Types
- `bff/src/lib/types/signal-query.ts`

### Documentation
- `docs/guides/signal-queries.md`
- `docs/api/signal-query-api.md`

## Files to Modify

### Backend
- `backend/pom.xml` (add DuckDB JDBC dependency if not present)
- `backend/src/main/resources/application.properties` (add query configuration)

### Frontend
- `bff/src/routes/signals.tsx` (add query page route)
- `bff/src/components/layout/navigation.tsx` (add query page link)

## Conclusion

PRD-027 introduces Advanced Query Language for FLUO, enabling SREs, developers, and compliance officers to search signals with SQL queries. The MVP leverages DuckDB's existing SQL engine for fast implementation while maintaining security through multi-layer validation and automatic tenant isolation.

**Key Benefits:**
1. **Fast Time-to-Market**: Reuse DuckDB SQL instead of building custom DSL (saves 3-4 weeks)
2. **Powerful Queries**: Full SQL capabilities from day 1 (AND, OR, NOT, LIKE, date functions)
3. **Security First**: Multi-layer SQL injection prevention + automatic tenant isolation
4. **Performance**: <1 second queries for 1K signals, <3 seconds for 10K signals
5. **ADR Compliant**: Follows ADR-011 (Pure Application), ADR-012 (Tenant Isolation), ADR-013 (Camel-First), ADR-014 (Testing Standards), ADR-015 (Tiered Storage)

**Implementation Timeline:** 5 weeks
- Week 1: Core query infrastructure + security
- Week 2: Saved queries
- Week 3: Frontend UI
- Week 4: Performance optimization
- Week 5: Documentation + polish

**Future Enhancements:** Custom DSL, visual query builder, cold storage queries, full-text search, export, sharing (post-MVP based on user feedback)
