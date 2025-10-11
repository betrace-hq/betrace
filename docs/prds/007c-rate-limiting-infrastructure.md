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

    @ConfigProperty(name = "fluo.ratelimit.tenant.requests-per-minute", defaultValue = "1000")
    int tenantRequestsPerMinute;

    @ConfigProperty(name = "fluo.ratelimit.user.requests-per-minute", defaultValue = "100")
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
            "fluo.ratelimit.violations",
            "tenant_id", tenantId.toString(),
            "limit_type", limitType
        ).increment();

        meterRegistry.gauge(
            "fluo.ratelimit.retry_after_seconds",
            List.of(Tag.of("tenant_id", tenantId.toString())),
            retryAfter
        );
    }

    public void recordAllowedRequest(UUID tenantId, String userId) {
        meterRegistry.counter(
            "fluo.ratelimit.allowed",
            "tenant_id", tenantId.toString(),
            "user_id", userId != null ? userId : "unauthenticated"
        ).increment();
    }
}
```

## Files to Create

### Core Rate Limiting
- `backend/src/main/java/com/fluo/security/RateLimitProcessor.java`
- `backend/src/main/java/com/fluo/security/RateLimiter.java`
- `backend/src/main/java/com/fluo/security/RateLimitResult.java`
- `backend/src/main/java/com/fluo/security/RateLimitExceededException.java`

### Error Handling
- `backend/src/main/java/com/fluo/processors/security/RateLimitErrorProcessor.java`
- `backend/src/main/java/com/fluo/dto/RateLimitErrorResponse.java`

### Metrics
- `backend/src/main/java/com/fluo/services/MetricsService.java`

### Tests
- `backend/src/test/java/com/fluo/security/RateLimiterTest.java`
- `backend/src/test/java/com/fluo/security/RateLimitProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/security/RateLimitErrorProcessorTest.java`
- `backend/src/test/java/com/fluo/routes/RateLimitIntegrationTest.java`

## Files to Modify

- `backend/src/main/java/com/fluo/routes/RuleApiRoute.java` - Add rate limit processor
- `backend/src/main/java/com/fluo/routes/SpanApiRoute.java` - Add rate limit processor
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
fluo.ratelimit.tenant.requests-per-minute=1000
fluo.ratelimit.user.requests-per-minute=100

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
