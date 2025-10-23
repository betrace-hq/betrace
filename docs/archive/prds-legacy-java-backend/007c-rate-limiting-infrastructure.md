# PRD-007c: Rate Limiting Infrastructure (Token Bucket + Redis)

**Parent PRD:** PRD-007 (API Input Validation & Rate Limiting)
**Unit:** C
**Priority:** P0
**Dependencies:**
- Unit A (Bean Validation Foundation) - for error response format
- PRD-001 (Authentication) - for per-user rate limits

## Scope

Implement rate limiting infrastructure using token bucket algorithm with Redis backend. Enforce per-tenant and per-user rate limits to prevent DoS attacks and ensure fair resource allocation.

## Problem

- No rate limiting → vulnerable to DoS attacks
- No per-tenant isolation of API usage
- No per-user fairness guarantees
- High-volume tenants can monopolize system resources

## Solution

### Rate Limiting Strategy

**Two-tier rate limiting:**
1. **Per-tenant limits**: 1000 requests/minute (prevent tenant monopolization)
2. **Per-user limits**: 100 requests/minute (prevent individual user abuse)

**Algorithm:** Token bucket (allows bursts, smooth over time)

**Storage:** Redis (shared state across instances)

### Camel Processor for Rate Limiting

**Named Processor Pattern (ADR-014):**

```java
@Named("rateLimitProcessor")
@ApplicationScoped
public class RateLimitProcessor implements Processor {

    @Inject
    RateLimiter rateLimiter;

    @Inject
    MetricsService metricsService;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        String userId = exchange.getIn().getHeader("userId", String.class);

        // Check tenant-level rate limit
        RateLimitResult tenantResult = rateLimiter.checkTenantLimit(tenantId);
        if (!tenantResult.allowed()) {
            metricsService.recordRateLimitViolation(tenantId, "tenant", tenantResult.retryAfterSeconds());
            throw new RateLimitExceededException(
                "Tenant rate limit exceeded. Retry after " + tenantResult.retryAfterSeconds() + " seconds",
                tenantResult.retryAfterSeconds()
            );
        }

        // Check user-level rate limit (if authenticated)
        if (userId != null) {
            RateLimitResult userResult = rateLimiter.checkUserLimit(tenantId, userId);
            if (!userResult.allowed()) {
                metricsService.recordRateLimitViolation(tenantId, "user", userResult.retryAfterSeconds());
                throw new RateLimitExceededException(
                    "User rate limit exceeded. Retry after " + userResult.retryAfterSeconds() + " seconds",
                    userResult.retryAfterSeconds()
                );
            }
        }

        // Request allowed - record metrics
        metricsService.recordAllowedRequest(tenantId, userId);
    }
}
```

### Rate Limiter Service

```java
@ApplicationScoped
public class RateLimiter {

    @Inject
    RedisClient redisClient;

    @ConfigProperty(name = "betrace.ratelimit.tenant.requests-per-minute", defaultValue = "1000")
    int tenantRequestsPerMinute;

    @ConfigProperty(name = "betrace.ratelimit.user.requests-per-minute", defaultValue = "100")
    int userRequestsPerMinute;

    /**
     * Check tenant-level rate limit using token bucket algorithm.
     *
     * @param tenantId Tenant UUID
     * @return RateLimitResult indicating if request is allowed
     */
    public RateLimitResult checkTenantLimit(UUID tenantId) {
        String key = "ratelimit:tenant:" + tenantId;
        return checkTokenBucket(key, tenantRequestsPerMinute, 60);
    }

    /**
     * Check user-level rate limit using token bucket algorithm.
     *
     * @param tenantId Tenant UUID
     * @param userId User identifier
     * @return RateLimitResult indicating if request is allowed
     */
    public RateLimitResult checkUserLimit(UUID tenantId, String userId) {
        String key = "ratelimit:user:" + tenantId + ":" + userId;
        return checkTokenBucket(key, userRequestsPerMinute, 60);
    }

    /**
     * Token bucket algorithm implementation using Redis Lua script.
     * Ensures atomic check-and-decrement operation.
     */
    private RateLimitResult checkTokenBucket(String key, int maxTokens, int refillWindowSeconds) {
        long now = System.currentTimeMillis();

        // Lua script for atomic token bucket operation
        String luaScript = """
            local key = KEYS[1]
            local maxTokens = tonumber(ARGV[1])
            local refillRate = tonumber(ARGV[2])  -- tokens per second
            local now = tonumber(ARGV[3])

            local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
            local tokens = tonumber(bucket[1])
            local lastRefill = tonumber(bucket[2])

            if tokens == nil then
                tokens = maxTokens
                lastRefill = now
            end

            -- Refill tokens based on time elapsed
            local elapsedSeconds = (now - lastRefill) / 1000
            local tokensToAdd = math.floor(elapsedSeconds * refillRate)
            tokens = math.min(maxTokens, tokens + tokensToAdd)
            lastRefill = now

            -- Try to consume 1 token
            if tokens >= 1 then
                tokens = tokens - 1
                redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
                redis.call('EXPIRE', key, %d)
                return {1, tokens}  -- allowed, remaining tokens
            else
                -- Calculate retry after seconds
                local tokensNeeded = 1 - tokens
                local retryAfter = math.ceil(tokensNeeded / refillRate)
                return {0, retryAfter}  -- denied, retry after seconds
            end
            """.formatted(refillWindowSeconds * 2);  // Expire bucket after 2x window

        List<Object> result = redisClient.eval(
            luaScript,
            List.of(key),
            List.of(String.valueOf(maxTokens), String.valueOf(maxTokens / (double) refillWindowSeconds), String.valueOf(now))
        );

        boolean allowed = ((Long) result.get(0)) == 1;
        long retryAfterOrRemaining = (Long) result.get(1);

        return new RateLimitResult(allowed, allowed ? 0 : retryAfterOrRemaining);
    }
}

public record RateLimitResult(
    boolean allowed,
    long retryAfterSeconds
) {}
```

### Rate Limit Exception Handler

```java
public class RateLimitExceededException extends RuntimeException {
    private final long retryAfterSeconds;

    public RateLimitExceededException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}

@Named("rateLimitErrorProcessor")
@ApplicationScoped
public class RateLimitErrorProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);

        if (cause instanceof RateLimitExceededException rle) {
            RateLimitErrorResponse response = new RateLimitErrorResponse(
                "Rate limit exceeded",
                rle.getMessage(),
                rle.getRetryAfterSeconds()
            );

            exchange.getIn().setBody(response);
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 429);
            exchange.getIn().setHeader("Retry-After", rle.getRetryAfterSeconds());
            exchange.getIn().setHeader("X-RateLimit-Reset", System.currentTimeMillis() / 1000 + rle.getRetryAfterSeconds());
        }
    }
}

public record RateLimitErrorResponse(
    String error,
    String message,
    long retryAfterSeconds
) {}
```

### Camel Route Integration

```java
@ApplicationScoped
public class RuleApiRoutes extends RouteBuilder {

    @Override
    public void configure() {
        // Rate limit error handler
        onException(RateLimitExceededException.class)
            .handled(true)
            .process("rateLimitErrorProcessor")
            .marshal().json();

        // Apply rate limiting to all API endpoints
        rest("/api/rules")
            .post()
            .to("direct:createRuleWithRateLimit");

        from("direct:createRuleWithRateLimit")
            .process("rateLimitProcessor")  // Check rate limits
            .to("direct:createRule");       // Existing business logic
    }
}
```

### Metrics Service for Observability

```java
@ApplicationScoped
public class MetricsService {

    @Inject
    MeterRegistry meterRegistry;

    public void recordRateLimitViolation(UUID tenantId, String limitType, long retryAfter) {
        meterRegistry.counter(
            "betrace.ratelimit.violations",
            "tenant_id", tenantId.toString(),
            "limit_type", limitType
        ).increment();

        meterRegistry.gauge(
            "betrace.ratelimit.retry_after_seconds",
            List.of(Tag.of("tenant_id", tenantId.toString())),
            retryAfter
        );
    }

    public void recordAllowedRequest(UUID tenantId, String userId) {
        meterRegistry.counter(
            "betrace.ratelimit.allowed",
            "tenant_id", tenantId.toString(),
            "user_id", userId != null ? userId : "unauthenticated"
        ).increment();
    }
}
```

## Files to Create

### Core Rate Limiting
- `backend/src/main/java/com/betrace/security/RateLimitProcessor.java`
- `backend/src/main/java/com/betrace/security/RateLimiter.java`
- `backend/src/main/java/com/betrace/security/RateLimitResult.java`
- `backend/src/main/java/com/betrace/security/RateLimitExceededException.java`

### Error Handling
- `backend/src/main/java/com/betrace/processors/security/RateLimitErrorProcessor.java`
- `backend/src/main/java/com/betrace/dto/RateLimitErrorResponse.java`

### Metrics
- `backend/src/main/java/com/betrace/services/MetricsService.java`

### Tests
- `backend/src/test/java/com/betrace/security/RateLimiterTest.java`
- `backend/src/test/java/com/betrace/security/RateLimitProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/security/RateLimitErrorProcessorTest.java`
- `backend/src/test/java/com/betrace/routes/RateLimitIntegrationTest.java`

## Files to Modify

- `backend/src/main/java/com/betrace/routes/RuleApiRoute.java` - Add rate limit processor
- `backend/src/main/java/com/betrace/routes/SpanApiRoute.java` - Add rate limit processor
- `backend/pom.xml` - Add Redis client dependency
- `backend/src/main/resources/application.properties` - Add rate limit configuration

## Success Criteria

- [ ] Tenant rate limits enforced (1000 req/min default)
- [ ] User rate limits enforced (100 req/min default)
- [ ] Rate limit violations return 429 with Retry-After header
- [ ] Token bucket algorithm allows bursts up to limit
- [ ] Redis stores rate limit state (shared across instances)
- [ ] Metrics recorded for rate limit violations and allowed requests
- [ ] Test coverage: 90%+ instruction coverage per ADR-014

## Testing Requirements

### Unit Tests

**Token Bucket Algorithm:**
```java
@Test
@DisplayName("Should allow requests within rate limit")
void testAllowRequestsWithinLimit() {
    UUID tenantId = UUID.randomUUID();

    for (int i = 0; i < 100; i++) {
        RateLimitResult result = rateLimiter.checkTenantLimit(tenantId);
        assertTrue(result.allowed(), "Request " + i + " should be allowed");
    }
}

@Test
@DisplayName("Should deny requests exceeding rate limit")
void testDenyRequestsExceedingLimit() {
    UUID tenantId = UUID.randomUUID();

    // Exhaust all tokens (1000 for tenant)
    for (int i = 0; i < 1000; i++) {
        rateLimiter.checkTenantLimit(tenantId);
    }

    // Next request should be denied
    RateLimitResult result = rateLimiter.checkTenantLimit(tenantId);
    assertFalse(result.allowed());
    assertTrue(result.retryAfterSeconds() > 0);
}

@Test
@DisplayName("Should refill tokens over time")
void testTokenRefillOverTime() throws InterruptedException {
    UUID tenantId = UUID.randomUUID();

    // Exhaust tokens
    for (int i = 0; i < 1000; i++) {
        rateLimiter.checkTenantLimit(tenantId);
    }

    // Wait for 6 seconds (1000 tokens/60 seconds = 16.67 tokens/sec)
    Thread.sleep(6000);

    // Should have ~100 tokens refilled
    int allowedRequests = 0;
    for (int i = 0; i < 100; i++) {
        if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
            allowedRequests++;
        }
    }

    assertTrue(allowedRequests >= 90, "Expected ~100 refilled tokens, got " + allowedRequests);
}

@Test
@DisplayName("Should enforce separate limits per tenant")
void testPerTenantIsolation() {
    UUID tenantA = UUID.randomUUID();
    UUID tenantB = UUID.randomUUID();

    // Exhaust tenant A's tokens
    for (int i = 0; i < 1000; i++) {
        rateLimiter.checkTenantLimit(tenantA);
    }

    // Tenant B should still have full quota
    RateLimitResult resultB = rateLimiter.checkTenantLimit(tenantB);
    assertTrue(resultB.allowed());

    // Tenant A should be denied
    RateLimitResult resultA = rateLimiter.checkTenantLimit(tenantA);
    assertFalse(resultA.allowed());
}
```

**Rate Limit Processor:**
```java
@Test
@DisplayName("Should allow request when rate limit not exceeded")
void testRateLimitProcessorAllowsRequest() throws Exception {
    UUID tenantId = UUID.randomUUID();
    when(mockRateLimiter.checkTenantLimit(tenantId)).thenReturn(new RateLimitResult(true, 0));

    Exchange exchange = new DefaultExchange(new DefaultCamelContext());
    exchange.getIn().setHeader("tenantId", tenantId);

    rateLimitProcessor.process(exchange);

    // Should complete without exception
    verify(mockMetricsService).recordAllowedRequest(tenantId, null);
}

@Test
@DisplayName("Should throw exception when rate limit exceeded")
void testRateLimitProcessorDeniesRequest() throws Exception {
    UUID tenantId = UUID.randomUUID();
    when(mockRateLimiter.checkTenantLimit(tenantId)).thenReturn(new RateLimitResult(false, 30));

    Exchange exchange = new DefaultExchange(new DefaultCamelContext());
    exchange.getIn().setHeader("tenantId", tenantId);

    assertThrows(RateLimitExceededException.class, () -> rateLimitProcessor.process(exchange));
    verify(mockMetricsService).recordRateLimitViolation(tenantId, "tenant", 30);
}
```

### Integration Tests

**End-to-End Rate Limiting:**
```java
@Test
@DisplayName("Should return 429 when tenant rate limit exceeded via route")
void testTenantRateLimitViaRoute() throws Exception {
    UUID tenantId = UUID.randomUUID();

    // Make 1001 requests (exceeds 1000 limit)
    for (int i = 0; i < 1001; i++) {
        Exchange response = template.request("direct:createRuleWithRateLimit", exchange -> {
            exchange.getIn().setHeader("tenantId", tenantId);
        });

        if (i < 1000) {
            assertNotEquals(429, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        } else {
            assertEquals(429, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
            assertNotNull(response.getIn().getHeader("Retry-After"));

            RateLimitErrorResponse error = response.getIn().getBody(RateLimitErrorResponse.class);
            assertEquals("Rate limit exceeded", error.error());
            assertTrue(error.retryAfterSeconds() > 0);
        }
    }
}

@Test
@DisplayName("Should enforce separate user rate limits")
void testUserRateLimitIsolation() throws Exception {
    UUID tenantId = UUID.randomUUID();
    String userA = "user-a@example.com";
    String userB = "user-b@example.com";

    // User A exhausts their limit
    for (int i = 0; i < 100; i++) {
        template.send("direct:createRuleWithRateLimit", exchange -> {
            exchange.getIn().setHeader("tenantId", tenantId);
            exchange.getIn().setHeader("userId", userA);
        });
    }

    // User A should be rate limited
    Exchange responseA = template.request("direct:createRuleWithRateLimit", exchange -> {
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userId", userA);
    });
    assertEquals(429, responseA.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));

    // User B should still have quota
    Exchange responseB = template.request("direct:createRuleWithRateLimit", exchange -> {
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userId", userB);
    });
    assertNotEquals(429, responseB.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
}
```

## Configuration

**application.properties:**
```properties
# Rate limiting
betrace.ratelimit.tenant.requests-per-minute=1000
betrace.ratelimit.user.requests-per-minute=100

# Redis configuration
quarkus.redis.hosts=redis://localhost:6379
quarkus.redis.timeout=2s
```

## Dependencies

**Maven (pom.xml):**
```xml
<!-- Redis client for rate limiting -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-redis-client</artifactId>
</dependency>

<!-- Micrometer metrics -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
</dependency>
```

## Architecture Compliance

- **ADR-013 (Camel-First):** Rate limiting implemented as Camel processor
- **ADR-014 (Named Processors):** `RateLimitProcessor` extracted as named CDI bean
- **ADR-011 (Pure Application):** Redis is deployment-agnostic (local or cloud)
- **ADR-015 (Testing Standards):** 90%+ test coverage with unit and integration tests

## Notes

- This unit does NOT include compliance logging (see Unit E)
- Rate limiting state stored in Redis (external to application)
- Token bucket algorithm allows bursts (better UX than fixed window)
- Metrics exposed for Grafana monitoring and alerting

---

## Implementation Readiness Assessment

**Implementation Specialist Confidence:** 96% ✅ **READY TO IMPLEMENT**

### Clarifications Completed

**1. DuckDB Instead of Redis (Architecture Alignment):**
- ✅ **Decision:** Use in-memory DuckDB table instead of Redis to align with ADR-015 (Tiered Storage) and ADR-011 (Pure Application)
- ✅ **Schema:** `CREATE TABLE rate_limit_buckets (bucket_key VARCHAR PRIMARY KEY, tokens DOUBLE, last_refill_ms BIGINT)` in `data/system/ratelimits.duckdb`
- ✅ **Multi-instance:** BeTrace runs as single instance per ADR-011. Multi-instance deployments can swap `RateLimiter` with Redis-backed implementation via CDI `@Alternative`
- ✅ **Graceful degradation:** Fail-open if DuckDB unavailable (allow requests, log error, schedule recovery after 30s)
- ✅ **Cleanup:** `@Scheduled(every = "5m")` job purges buckets inactive for >5 minutes

**DuckDB Rate Limiter Implementation:**
```java
@ApplicationScoped
public class RateLimiter {
    @Inject DuckDBService duckDB;

    @ConfigProperty(name = "betrace.ratelimit.tenant.requests-per-minute", defaultValue = "1000")
    int tenantRequestsPerMinute;

    @PostConstruct
    void initializeRateLimitTable() {
        String sql = """
            CREATE TABLE IF NOT EXISTS rate_limit_buckets (
                bucket_key VARCHAR PRIMARY KEY,
                tokens DOUBLE NOT NULL,
                last_refill_ms BIGINT NOT NULL
            )
            """;
        duckDB.executeOnSharedDb(sql);
    }

    private RateLimitResult checkTokenBucket(String key, int maxTokens, int refillWindowSeconds) {
        long nowMs = System.currentTimeMillis();
        double refillRatePerSecond = maxTokens / (double) refillWindowSeconds;

        try {
            duckDB.executeOnSharedDb("BEGIN TRANSACTION");

            // Read current bucket state
            String selectSql = "SELECT tokens, last_refill_ms FROM rate_limit_buckets WHERE bucket_key = ?";
            List<Map<String, Object>> rows = duckDB.queryOnSharedDb(selectSql, key);

            double tokens;
            long lastRefillMs;

            if (rows.isEmpty()) {
                tokens = maxTokens;
                lastRefillMs = nowMs;
            } else {
                Map<String, Object> row = rows.get(0);
                tokens = (Double) row.get("tokens");
                lastRefillMs = (Long) row.get("last_refill_ms");

                // Refill tokens based on elapsed time
                double elapsedSeconds = (nowMs - lastRefillMs) / 1000.0;
                double tokensToAdd = elapsedSeconds * refillRatePerSecond;
                tokens = Math.min(maxTokens, tokens + tokensToAdd);
                lastRefillMs = nowMs;
            }

            // Try to consume 1 token
            if (tokens >= 1.0) {
                tokens -= 1.0;

                String upsertSql = """
                    INSERT INTO rate_limit_buckets (bucket_key, tokens, last_refill_ms)
                    VALUES (?, ?, ?)
                    ON CONFLICT (bucket_key) DO UPDATE SET
                        tokens = excluded.tokens,
                        last_refill_ms = excluded.last_refill_ms
                    """;

                duckDB.executeOnSharedDb(upsertSql, key, tokens, lastRefillMs);
                duckDB.executeOnSharedDb("COMMIT");

                return new RateLimitResult(true, 0);
            } else {
                // Not enough tokens - calculate retry after
                double tokensNeeded = 1.0 - tokens;
                long retryAfterSeconds = (long) Math.ceil(tokensNeeded / refillRatePerSecond);

                duckDB.executeOnSharedDb("ROLLBACK");
                return new RateLimitResult(false, retryAfterSeconds);
            }
        } catch (Exception e) {
            try { duckDB.executeOnSharedDb("ROLLBACK"); } catch (Exception ignored) {}
            throw new RateLimitException("Rate limit check failed", e);
        }
    }

    @Scheduled(every = "5m")
    void cleanupOldBuckets() {
        String sql = "DELETE FROM rate_limit_buckets WHERE last_refill_ms < ?";
        long cutoffMs = System.currentTimeMillis() - (5 * 60 * 1000);
        try {
            duckDB.executeOnSharedDb(sql, cutoffMs);
        } catch (Exception e) {
            log.warn("Failed to cleanup old rate limit buckets", e);
        }
    }
}
```

**2. TenantContext Integration (Not Headers):**
- ✅ **Correction:** Use `@Inject TenantContext` instead of reading headers
- ✅ **Request order:** Rate limiting occurs AFTER authentication (step 5 of 7):
  1. Camel REST endpoint
  2. `extractJwtTokenProcessor` (PRD-001a)
  3. `validateWorkosTokenProcessor` (PRD-001c)
  4. `extractTenantRoleProcessor` (PRD-001d) → populates TenantContext
  5. **`rateLimitProcessor` (PRD-007c) ← reads TenantContext**
  6. `checkRoutePermissionProcessor` (PRD-001f)
  7. Business logic processors

**Updated RateLimitProcessor:**
```java
@Named("rateLimitProcessor")
@ApplicationScoped
public class RateLimitProcessor implements Processor {
    @Inject RateLimiter rateLimiter;
    @Inject MetricsService metricsService;
    @Inject TenantContext tenantContext;  // From PRD-012, populated by PRD-001d

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId;
        String userId = null;

        if (tenantContext.isAuthenticated()) {
            tenantId = tenantContext.getTenantId();
            userId = tenantContext.getUserId();
        } else {
            // Use anonymous tenant ID for unauthenticated requests
            tenantId = UUID.fromString("00000000-0000-0000-0000-000000000000");
        }

        // Check tenant-level rate limit
        RateLimitResult tenantResult = tenantContext.isAuthenticated()
            ? rateLimiter.checkTenantLimit(tenantId)
            : rateLimiter.checkAnonymousLimit();

        if (!tenantResult.allowed()) {
            metricsService.recordRateLimitViolation(tenantId, "tenant", tenantResult.retryAfterSeconds());
            throw new RateLimitExceededException(
                "Tenant rate limit exceeded. Retry after " + tenantResult.retryAfterSeconds() + " seconds",
                tenantResult.retryAfterSeconds()
            );
        }

        // Check user-level rate limit (if authenticated)
        if (userId != null) {
            RateLimitResult userResult = rateLimiter.checkUserLimit(tenantId, userId);
            if (!userResult.allowed()) {
                metricsService.recordRateLimitViolation(tenantId, "user", userResult.retryAfterSeconds());
                throw new RateLimitExceededException(
                    "User rate limit exceeded. Retry after " + userResult.retryAfterSeconds() + " seconds",
                    userResult.retryAfterSeconds()
                );
            }
        }

        metricsService.recordAllowedRequest(tenantId, userId);
    }
}
```

**3. Anonymous/Unauthenticated Rate Limiting:**
- ✅ **Anonymous tenant:** Special UUID `00000000-0000-0000-0000-000000000000` with stricter limit (10 req/min)
- ✅ **Configuration:** `betrace.ratelimit.anonymous.requests-per-minute=10`
- ✅ **TenantContext enhancement:** Add `isAuthenticated()` method and `setUnauthenticated()` for public endpoints

**4. Token Bucket Algorithm:**
- ✅ **Refill rate:** Smooth refill at `maxTokens / windowSeconds` (e.g., 1000/60 = 16.67 tokens/sec)
- ✅ **Atomicity:** DuckDB transaction ensures atomic read-modify-write
- ✅ **Expiry:** Buckets purged after 5 minutes of inactivity (fresh quota on return)
- ✅ **Transaction isolation:** Use default SERIALIZABLE (safe, rate limiting is low-volume)

**5. Metrics Cardinality:**
- ✅ **Low cardinality:** Aggregate counters without tenant/user tags to avoid Prometheus explosion
- ✅ **Metrics:**
  - `betrace.ratelimit.violations` (counter, tags: `limit_type=[tenant|user]`)
  - `betrace.ratelimit.allowed` (counter, no tags)
  - `betrace.ratelimit.utilization_percent` (summary, tag: `limit_type=tenant`)
  - `betrace.ratelimit.retry_after_seconds` (gauge)

**Updated MetricsService:**
```java
@ApplicationScoped
public class MetricsService {
    @Inject MeterRegistry meterRegistry;

    public void recordRateLimitViolation(UUID tenantId, String limitType, long retryAfter) {
        meterRegistry.counter(
            "betrace.ratelimit.violations",
            "limit_type", limitType  // Only "tenant" or "user", not specific IDs
        ).increment();

        meterRegistry.gauge(
            "betrace.ratelimit.retry_after_seconds",
            Collections.emptyList(),
            retryAfter
        );
    }

    public void recordAllowedRequest(UUID tenantId, String userId) {
        meterRegistry.counter("betrace.ratelimit.allowed").increment();
    }
}
```

**6. HTTP Error Response:**
- ✅ **Use `exchange.getMessage()`** for Camel 3.x response headers (not `getIn()`)
- ✅ **Retry-After format:** Integer seconds per RFC 6585 (e.g., `Retry-After: 60`)
- ✅ **Headers:** `HTTP 429`, `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Updated RateLimitErrorProcessor:**
```java
@Named("rateLimitErrorProcessor")
@ApplicationScoped
public class RateLimitErrorProcessor implements Processor {
    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);

        if (cause instanceof RateLimitExceededException rle) {
            RateLimitErrorResponse response = new RateLimitErrorResponse(
                "Rate limit exceeded",
                rle.getMessage(),
                rle.getRetryAfterSeconds()
            );

            exchange.getMessage().setBody(response);
            exchange.getMessage().setHeader(Exchange.HTTP_RESPONSE_CODE, 429);
            exchange.getMessage().setHeader("Retry-After", String.valueOf(rle.getRetryAfterSeconds()));
            exchange.getMessage().setHeader("X-RateLimit-Limit", "1000");
            exchange.getMessage().setHeader("X-RateLimit-Remaining", "0");
            exchange.getMessage().setHeader("X-RateLimit-Reset", String.valueOf(System.currentTimeMillis() / 1000 + rle.getRetryAfterSeconds()));
        }
    }
}
```

**7. Global Interceptor (Not Per-Route):**
- ✅ **Pattern:** `interceptFrom("rest:*")` applies rate limiting to all REST endpoints
- ✅ **Exemptions:** Configurable path allowlist (health checks, metrics, OpenAPI)
- ✅ **Configuration:** `betrace.ratelimit.exempt-paths=/q/health,/q/metrics,/q/openapi,/api/public/status`

**Global Rate Limit Configuration:**
```java
@ApplicationScoped
public class GlobalRouteConfiguration extends RouteBuilder {
    @ConfigProperty(name = "betrace.ratelimit.exempt-paths")
    List<String> exemptPaths;

    @Override
    public void configure() throws Exception {
        // Global exception handler
        onException(RateLimitExceededException.class)
            .handled(true)
            .process("rateLimitErrorProcessor")
            .marshal().json()
            .setHeader(Exchange.CONTENT_TYPE, constant("application/json"));

        // Intercept ALL REST endpoints (except exempted paths)
        interceptFrom("rest:*")
            .when(method(this, "shouldApplyRateLimit"))
            .process("rateLimitProcessor");
    }

    public boolean shouldApplyRateLimit(Exchange exchange) {
        String path = exchange.getIn().getHeader(Exchange.HTTP_PATH, String.class);
        if (path == null) return true;

        for (String exemptPath : exemptPaths) {
            if (path.startsWith(exemptPath)) {
                return false;
            }
        }
        return true;
    }
}
```

### Architecture Changes from Original PRD

**Changed:** Redis → DuckDB
- **Reason:** Align with ADR-015 (Tiered Storage) and ADR-011 (Pure Application, no external infrastructure)
- **Impact:** Rate limit state stored in `data/system/ratelimits.duckdb` (in-memory table)
- **Trade-off:** Single-instance deployments only (acceptable per ADR-011). Multi-instance can use CDI `@Alternative` for Redis

**Changed:** Headers → TenantContext
- **Reason:** Align with PRD-012 (Tenant Management) authentication flow
- **Impact:** Rate limiting occurs AFTER authentication in request pipeline
- **Benefit:** Guaranteed tenant/user IDs from validated JWT

**Added:** Anonymous rate limiting
- **Reason:** Support unauthenticated public endpoints with stricter limits
- **Implementation:** Special tenant UUID `00000000...` with 10 req/min limit

**Changed:** Per-route processor → Global interceptor
- **Reason:** More efficient, single point of configuration
- **Implementation:** `interceptFrom("rest:*")` with configurable exemptions

### Implementation Estimate

**Backend:** 3-4 days
- Day 1: DuckDB rate limit table + RateLimiter service (token bucket with transactions)
- Day 2: RateLimitProcessor + TenantContext integration + global interceptor
- Day 3: RateLimitErrorProcessor + MetricsService + cleanup scheduler
- Day 4: Unit tests (token bucket algorithm, isolation, refill) + integration tests (end-to-end via routes)

**Configuration:** 0.5 days
- Add `quarkus-micrometer-registry-prometheus` dependency
- Add `quarkus-scheduler` dependency (for cleanup job)
- Configure rate limits and exempt paths in `application.properties`

**Testing:** 1.5 days
- Unit tests: Token bucket logic (allow/deny, refill, per-tenant isolation, anonymous limits)
- Integration tests: End-to-end rate limiting via Camel routes (429 responses, retry-after headers)

**Total:** 5-6 days

### Files to Create

**Core Rate Limiting:**
- `backend/src/main/java/com/betrace/processors/security/RateLimitProcessor.java`
- `backend/src/main/java/com/betrace/services/RateLimiter.java`
- `backend/src/main/java/com/betrace/models/RateLimitResult.java`
- `backend/src/main/java/com/betrace/exceptions/RateLimitExceededException.java`

**Error Handling:**
- `backend/src/main/java/com/betrace/processors/security/RateLimitErrorProcessor.java`
- `backend/src/main/java/com/betrace/models/RateLimitErrorResponse.java`

**Global Configuration:**
- `backend/src/main/java/com/betrace/routes/GlobalRouteConfiguration.java`

**Tests:**
- `backend/src/test/java/com/betrace/services/RateLimiterTest.java`
- `backend/src/test/java/com/betrace/processors/security/RateLimitProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/security/RateLimitErrorProcessorTest.java`
- `backend/src/test/java/com/betrace/routes/RateLimitIntegrationTest.java`

### Files to Modify

- `backend/pom.xml` - Add Micrometer and Scheduler dependencies
- `backend/src/main/resources/application.properties` - Add rate limit configuration
- `backend/src/main/java/com/betrace/services/TenantContext.java` - Add `isAuthenticated()` method (PRD-012 enhancement)

### Configuration

**application.properties:**
```properties
# Rate limiting
betrace.ratelimit.tenant.requests-per-minute=1000
betrace.ratelimit.user.requests-per-minute=100
betrace.ratelimit.anonymous.requests-per-minute=10
betrace.ratelimit.exempt-paths=/q/health,/q/metrics,/q/openapi,/api/public/status

# DuckDB shared database for rate limiting
betrace.storage.system.ratelimits-path=./data/system/ratelimits.duckdb
```

**pom.xml additions:**
```xml
<!-- Micrometer metrics -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
</dependency>

<!-- Quarkus scheduler for cleanup job -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-scheduler</artifactId>
</dependency>
```

### Success Criteria

- ✅ Tenant rate limits enforced (1000 req/min default, configurable)
- ✅ User rate limits enforced (100 req/min default, configurable)
- ✅ Anonymous rate limits enforced (10 req/min default, configurable)
- ✅ Rate limit violations return HTTP 429 with `Retry-After` header
- ✅ Token bucket algorithm allows bursts up to limit with smooth refill
- ✅ DuckDB stores rate limit state (atomic transactions for consistency)
- ✅ Global interceptor applies to all REST endpoints with configurable exemptions
- ✅ Metrics recorded for violations and allowed requests (low cardinality)
- ✅ Graceful degradation (fail-open if DuckDB unavailable)
- ✅ Cleanup job purges inactive buckets every 5 minutes
- ✅ Test coverage: 90%+ instruction coverage per ADR-014

### Dependencies

**Requires:**
- PRD-001d (Tenant Role Extraction Processor) - populates `TenantContext` with tenant ID and user ID
- PRD-012 (Tenant Management System) - provides `TenantContext` bean

**Blocks:**
- All API routes that require rate limiting protection

### Open Questions (Resolved)

**Q1:** Redis vs DuckDB?
**A:** DuckDB in-memory table, aligns with ADR-015 and ADR-011.

**Q2:** Headers vs TenantContext?
**A:** Use `TenantContext` bean, populated by PRD-001d after authentication.

**Q3:** Global vs per-route?
**A:** Global interceptor with `interceptFrom("rest:*")` and configurable exemptions.

**Q4:** Metrics cardinality?
**A:** Aggregate counters without tenant/user IDs to avoid Prometheus cardinality explosion.
