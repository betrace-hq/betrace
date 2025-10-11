# PRD-027d: Performance Optimization

**Parent PRD:** PRD-027 (Advanced Query Language for Signal Search)
**Unit:** D
**Priority:** P2
**Dependencies:** Unit A (Core Query Infrastructure), Unit B (Saved Queries), Unit C (Frontend Query UI)

## Scope

Optimize query performance through caching, rate limiting, cost estimation, and indexing to ensure the query system scales to production workloads. This unit focuses on making the existing query infrastructure performant and resilient.

## Core Functionality

1. **Query Result Caching**: Cache query results to reduce repeated executions
2. **Rate Limiting**: Prevent query abuse (max 10 queries/minute per tenant)
3. **Query Cost Estimation**: Estimate and reject expensive queries
4. **DuckDB Indexing**: Create indexes on frequently queried fields
5. **Performance Monitoring**: OpenTelemetry metrics for query performance
6. **Query Plan Analysis**: Expose EXPLAIN plans for debugging

## Implementation

### 1. Query Cache Service

**File:** `backend/src/main/java/com/fluo/services/QueryCacheService.java`

```java
package com.fluo.services;

import com.fluo.model.SignalQueryResponse;
import jakarta.enterprise.context.ApplicationScoped;
import java.security.MessageDigest;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Instant;
import java.time.Duration;

/**
 * In-memory cache for query results.
 *
 * Cache key: SHA-256(tenantId + sql)
 * Cache TTL: 60 seconds (configurable)
 */
@ApplicationScoped
public class QueryCacheService {

    private static final Duration CACHE_TTL = Duration.ofSeconds(60);

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    static class CacheEntry {
        SignalQueryResponse response;
        Instant expiresAt;

        CacheEntry(SignalQueryResponse response, Instant expiresAt) {
            this.response = response;
            this.expiresAt = expiresAt;
        }

        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    /**
     * Get cached query result if available and not expired.
     */
    public Optional<SignalQueryResponse> get(String tenantId, String sql) {
        String cacheKey = generateCacheKey(tenantId, sql);
        CacheEntry entry = cache.get(cacheKey);

        if (entry != null && !entry.isExpired()) {
            SignalQueryResponse response = entry.response;
            response.setFromCache(true);
            return Optional.of(response);
        }

        // Remove expired entry
        if (entry != null) {
            cache.remove(cacheKey);
        }

        return Optional.empty();
    }

    /**
     * Cache query result.
     */
    public void put(String tenantId, String sql, SignalQueryResponse response) {
        String cacheKey = generateCacheKey(tenantId, sql);
        Instant expiresAt = Instant.now().plus(CACHE_TTL);
        cache.put(cacheKey, new CacheEntry(response, expiresAt));
    }

    /**
     * Invalidate cache for tenant (e.g., when new signals arrive).
     */
    public void invalidateTenant(String tenantId) {
        cache.entrySet().removeIf(entry -> entry.getKey().startsWith(tenantId));
    }

    /**
     * Clear all cache entries.
     */
    public void clear() {
        cache.clear();
    }

    /**
     * Generate cache key: SHA-256(tenantId + sql).
     */
    private String generateCacheKey(String tenantId, String sql) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String input = tenantId + ":" + sql;
            byte[] hash = digest.digest(input.getBytes());
            return bytesToHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate cache key", e);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder hexString = new StringBuilder();
        for (byte b : bytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }

    /**
     * Get cache statistics.
     */
    public CacheStats getStats() {
        long totalEntries = cache.size();
        long expiredEntries = cache.values().stream().filter(CacheEntry::isExpired).count();
        return new CacheStats(totalEntries, expiredEntries);
    }

    public static class CacheStats {
        public final long totalEntries;
        public final long expiredEntries;

        public CacheStats(long totalEntries, long expiredEntries) {
            this.totalEntries = totalEntries;
            this.expiredEntries = expiredEntries;
        }
    }
}
```

### 2. Rate Limiting Service

**File:** `backend/src/main/java/com/fluo/services/QueryRateLimitService.java`

```java
package com.fluo.services;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import java.time.Duration;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Rate limiter for query execution.
 *
 * Limit: 10 queries per minute per tenant
 */
@ApplicationScoped
public class QueryRateLimitService {

    private static final int MAX_QUERIES_PER_MINUTE = 10;
    private static final Duration WINDOW_DURATION = Duration.ofMinutes(1);

    // Tenant ID -> queue of query timestamps
    private final ConcurrentHashMap<String, Queue<Instant>> queryTimestamps = new ConcurrentHashMap<>();

    /**
     * Check if tenant can execute query.
     *
     * @throws RateLimitExceededException if rate limit exceeded
     */
    public void checkRateLimit(String tenantId) throws RateLimitExceededException {
        Queue<Instant> timestamps = queryTimestamps.computeIfAbsent(
            tenantId,
            k -> new ConcurrentLinkedQueue<>()
        );

        Instant now = Instant.now();
        Instant windowStart = now.minus(WINDOW_DURATION);

        // Remove timestamps outside window
        timestamps.removeIf(ts -> ts.isBefore(windowStart));

        // Check rate limit
        if (timestamps.size() >= MAX_QUERIES_PER_MINUTE) {
            throw new RateLimitExceededException(
                "Rate limit exceeded: max " + MAX_QUERIES_PER_MINUTE + " queries per minute"
            );
        }

        // Record this query
        timestamps.add(now);
    }

    /**
     * Get remaining queries for tenant in current window.
     */
    public int getRemainingQueries(String tenantId) {
        Queue<Instant> timestamps = queryTimestamps.get(tenantId);
        if (timestamps == null) {
            return MAX_QUERIES_PER_MINUTE;
        }

        Instant now = Instant.now();
        Instant windowStart = now.minus(WINDOW_DURATION);

        long queriesInWindow = timestamps.stream()
            .filter(ts -> ts.isAfter(windowStart))
            .count();

        return (int) (MAX_QUERIES_PER_MINUTE - queriesInWindow);
    }

    public static class RateLimitExceededException extends Exception {
        public RateLimitExceededException(String message) {
            super(message);
        }
    }
}
```

### 3. Query Cost Estimator

**File:** `backend/src/main/java/com/fluo/services/QueryCostEstimator.java`

```java
package com.fluo.services;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.regex.Pattern;

/**
 * Estimates query cost and rejects expensive queries.
 */
@ApplicationScoped
public class QueryCostEstimator {

    private static final int MAX_COST = 1000;

    // Patterns that indicate expensive operations
    private static final Pattern CARTESIAN_PRODUCT = Pattern.compile(
        "(?i)\\bFROM\\s+\\w+\\s*,\\s*\\w+"
    );
    private static final Pattern LIKE_WILDCARD_PREFIX = Pattern.compile(
        "(?i)LIKE\\s+'%"
    );

    /**
     * Estimate query cost (simple heuristic).
     *
     * Cost factors:
     * - Base cost: 10
     * - Each WHERE clause: +5
     * - Each JOIN: +20
     * - Cartesian product: +500
     * - LIKE '%...': +100
     * - ORDER BY: +10
     */
    public int estimateCost(String sql) {
        int cost = 10; // Base cost

        String lowerSql = sql.toLowerCase();

        // Count WHERE clauses
        int whereCount = countOccurrences(lowerSql, " where ");
        cost += whereCount * 5;

        // Count JOINs
        int joinCount = countOccurrences(lowerSql, " join ");
        cost += joinCount * 20;

        // Check for cartesian product (FROM table1, table2)
        if (CARTESIAN_PRODUCT.matcher(sql).find()) {
            cost += 500;
        }

        // Check for LIKE '%...' (expensive full table scan)
        if (LIKE_WILDCARD_PREFIX.matcher(sql).find()) {
            cost += 100;
        }

        // Check for ORDER BY
        if (lowerSql.contains(" order by ")) {
            cost += 10;
        }

        return cost;
    }

    /**
     * Check if query cost exceeds maximum.
     */
    public void validateCost(String sql) throws QueryTooExpensiveException {
        int cost = estimateCost(sql);
        if (cost > MAX_COST) {
            throw new QueryTooExpensiveException(
                "Query too expensive (cost: " + cost + ", max: " + MAX_COST + ")"
            );
        }
    }

    private int countOccurrences(String text, String pattern) {
        int count = 0;
        int index = 0;
        while ((index = text.indexOf(pattern, index)) != -1) {
            count++;
            index += pattern.length();
        }
        return count;
    }

    public static class QueryTooExpensiveException extends Exception {
        public QueryTooExpensiveException(String message) {
            super(message);
        }
    }
}
```

### 4. Performance Processors

**File:** `backend/src/main/java/com/fluo/processors/query/CheckQueryCacheProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.SignalQueryResponse;
import com.fluo.services.QueryCacheService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Checks query cache before execution.
 */
@Named("checkQueryCacheProcessor")
@ApplicationScoped
public class CheckQueryCacheProcessor implements Processor {

    @Inject
    QueryCacheService queryCacheService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);
        String sql = exchange.getIn().getHeader("sql", String.class);

        var cachedResult = queryCacheService.get(tenantId, sql);

        if (cachedResult.isPresent()) {
            // Return cached result and skip execution
            exchange.getIn().setBody(cachedResult.get());
            exchange.getIn().setHeader("fromCache", true);
            exchange.setProperty("skipExecution", true);
        }
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/CacheQueryResultProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.SignalQueryResponse;
import com.fluo.services.QueryCacheService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Caches query result after execution.
 */
@Named("cacheQueryResultProcessor")
@ApplicationScoped
public class CacheQueryResultProcessor implements Processor {

    @Inject
    QueryCacheService queryCacheService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);
        String sql = exchange.getIn().getHeader("sql", String.class);
        SignalQueryResponse response = exchange.getIn().getBody(SignalQueryResponse.class);

        queryCacheService.put(tenantId, sql, response);
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/CheckRateLimitProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.services.QueryRateLimitService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Checks rate limit before query execution.
 */
@Named("checkRateLimitProcessor")
@ApplicationScoped
public class CheckRateLimitProcessor implements Processor {

    @Inject
    QueryRateLimitService rateLimitService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);

        try {
            rateLimitService.checkRateLimit(tenantId);
        } catch (QueryRateLimitService.RateLimitExceededException e) {
            throw new IllegalStateException(e.getMessage());
        }
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/EstimateQueryCostProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.services.QueryCostEstimator;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Estimates query cost and rejects expensive queries.
 */
@Named("estimateQueryCostProcessor")
@ApplicationScoped
public class EstimateQueryCostProcessor implements Processor {

    @Inject
    QueryCostEstimator costEstimator;

    @Override
    public void process(Exchange exchange) throws Exception {
        String sql = exchange.getIn().getHeader("validatedSql", String.class);

        int cost = costEstimator.estimateCost(sql);
        exchange.getIn().setHeader("queryCost", cost);

        try {
            costEstimator.validateCost(sql);
        } catch (QueryCostEstimator.QueryTooExpensiveException e) {
            throw new IllegalArgumentException(e.getMessage());
        }
    }
}
```

### 5. Updated Query Route

**File:** `backend/src/main/java/com/fluo/routes/SignalQueryRoute.java` (updated)

```java
// Execute signal query route with performance optimizations
from("direct:executeSignalQuery")
    .routeId("executeSignalQuery")
    .log("Executing signal query for tenant ${header.tenantId}")
    .process("extractTenantIdProcessor")           // Extract tenant from JWT
    .process("parseQueryRequestProcessor")          // Parse query request
    .process("checkRateLimitProcessor")             // Check rate limit (NEW)
    .process("validateSqlQueryProcessor")           // Validate SQL syntax + security
    .process("estimateQueryCostProcessor")          // Estimate cost (NEW)
    .process("checkQueryCacheProcessor")            // Check cache (NEW)
    .choice()
        .when(header("fromCache").isEqualTo(true))
            .log("Returning cached result")
            .process("formatQueryResultsProcessor")
        .otherwise()
            .process("injectTenantIsolationProcessor")  // Auto-inject tenant_id
            .process("executeHotStorageQueryProcessor") // Query DuckDB
            .process("formatQueryResultsProcessor")
            .process("cacheQueryResultProcessor")       // Cache result (NEW)
    .end()
    .marshal().json();
```

### 6. DuckDB Index Creation

**File:** `backend/src/main/java/com/fluo/services/DuckDBQueryService.java` (updated)

Add index creation method:

```java
/**
 * Create indexes on frequently queried fields.
 * Call this during tenant initialization.
 */
public void createIndexes(UUID tenantId) throws SQLException {
    String dbPath = hotStoragePath + "/" + tenantId.toString() + ".duckdb";

    try (Connection conn = DriverManager.getConnection("jdbc:duckdb:" + dbPath)) {
        try (Statement stmt = conn.createStatement()) {
            // Index on severity for fast filtering
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_signals_severity ON signals(severity)");

            // Index on created_at for date range queries
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at)");

            // Index on status for filtering
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status)");

            // Composite index for common query pattern
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_signals_severity_created_at ON signals(severity, created_at)");
        }
    }
}
```

### 7. Performance Metrics

**File:** `backend/src/main/java/com/fluo/services/DuckDBQueryService.java` (add metrics)

```java
import io.micrometer.core.annotation.Counted;
import io.micrometer.core.annotation.Timed;

@Counted(value = "signal_queries_total", description = "Total signal queries executed")
@Timed(value = "signal_query_duration", description = "Signal query execution time")
public List<Signal> executeQuery(UUID tenantId, String sql, int timeoutSeconds)
        throws SQLException {
    // ... existing implementation
}
```

## Success Criteria

### Performance
- [ ] Query cache reduces repeated query time by 90%
- [ ] Cached queries return in <50ms
- [ ] Rate limiting prevents abuse (10 queries/minute max)
- [ ] Expensive queries rejected before execution
- [ ] DuckDB indexes improve query speed by 50%

### Monitoring
- [ ] Query execution metrics exposed (count, duration)
- [ ] Cache hit rate metrics available
- [ ] Rate limit metrics tracked
- [ ] Query cost metrics recorded

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**File:** `backend/src/test/java/com/fluo/services/QueryCacheServiceTest.java`

Required test cases:
- [ ] testCacheHit
- [ ] testCacheMiss
- [ ] testCacheExpiration
- [ ] testCacheInvalidation
- [ ] testCacheKeyGeneration

**File:** `backend/src/test/java/com/fluo/services/QueryRateLimitServiceTest.java`

Required test cases:
- [ ] testRateLimitEnforced
- [ ] testRateLimitReset
- [ ] testRemainingQueries
- [ ] testConcurrentRequests

**File:** `backend/src/test/java/com/fluo/services/QueryCostEstimatorTest.java`

Required test cases:
- [ ] testEstimateCostSimpleQuery
- [ ] testEstimateCostComplexQuery
- [ ] testRejectExpensiveQuery
- [ ] testCartesianProductDetection

### Performance Tests

**File:** `backend/src/test/java/com/fluo/benchmarks/QueryPerformanceBench.java`

Required benchmarks:
- [ ] Query 1K signals in <500ms
- [ ] Query 10K signals in <3s
- [ ] Cached query in <50ms
- [ ] Index speedup 50% improvement

## Files to Create

### Backend - Services
- `backend/src/main/java/com/fluo/services/QueryCacheService.java`
- `backend/src/main/java/com/fluo/services/QueryRateLimitService.java`
- `backend/src/main/java/com/fluo/services/QueryCostEstimator.java`

### Backend - Processors
- `backend/src/main/java/com/fluo/processors/query/CheckQueryCacheProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/CacheQueryResultProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/CheckRateLimitProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/EstimateQueryCostProcessor.java`

### Backend - Tests
- `backend/src/test/java/com/fluo/services/QueryCacheServiceTest.java`
- `backend/src/test/java/com/fluo/services/QueryRateLimitServiceTest.java`
- `backend/src/test/java/com/fluo/services/QueryCostEstimatorTest.java`
- `backend/src/test/java/com/fluo/benchmarks/QueryPerformanceBench.java`

## Files to Modify

- `backend/src/main/java/com/fluo/routes/SignalQueryRoute.java` - Add performance processors
- `backend/src/main/java/com/fluo/services/DuckDBQueryService.java` - Add indexes and metrics

## Architecture Compliance

- **ADR-011 (Pure Application)**: No external dependencies (in-memory cache)
- **ADR-014 (Named Processors)**: All processors are named beans, 90% test coverage
- **OpenTelemetry**: Query metrics exposed for monitoring

## Future Enhancements

1. **Redis Cache**: Replace in-memory cache with Redis for multi-instance support
2. **Query Plan Analysis**: Expose EXPLAIN plans to users
3. **Adaptive Indexing**: Auto-create indexes based on query patterns
4. **Query Optimization Hints**: Suggest index creation to users
5. **Cost-Based Optimization**: Use DuckDB query planner statistics

## Timeline

**Duration:** Week 4 (5 days)

**Day 1:** Implement caching and rate limiting services
**Day 2:** Implement cost estimation and processors
**Day 3:** Add DuckDB indexes and metrics
**Day 4:** Write unit tests (90% coverage)
**Day 5:** Run performance benchmarks and optimize
