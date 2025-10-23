# PRD-021B: Request-Level Resilience

**Priority:** P1 (High - Performance)
**Complexity:** Medium
**Personas:** SRE, Developer
**Dependencies:** None (can ship independently of PRD-021A)
**Implements:** Rule timeouts, backpressure, rate limiting

## Problem

BeTrace lacks request-scoped resilience mechanisms:
- **Runaway rules**: Single slow rule (5s execution) blocks all traces
- **Memory exhaustion**: Unbounded span queue → OOM under traffic spikes
- **No backpressure**: Clients retry indefinitely → amplifies load during outages
- **Resource starvation**: One tenant's slow rules starve other tenants

**Impact:**
- P99 latency: 10s+ (vs. SLO of 1s)
- Cascading failures: Slow rule → thread pool exhaustion → API unavailable
- Tenant isolation violation: Tenant A's bad rule affects Tenant B

## Solution

### Rule Evaluation Timeout

**Per-Tenant Timeout Executor:**
```java
@ApplicationScoped
public class RuleTimeoutManager {
    private final Map<String, ExecutorService> tenantExecutors = new ConcurrentHashMap<>();
    private static final Duration DEFAULT_TIMEOUT = Duration.ofMillis(500);

    public <T> CompletableFuture<T> executeWithTimeout(String tenantId, Callable<T> task, Duration timeout) {
        ExecutorService executor = tenantExecutors.computeIfAbsent(
            tenantId,
            k -> Executors.newFixedThreadPool(10) // Per-tenant thread pool
        );

        return CompletableFuture.supplyAsync(() -> {
            try {
                return task.call();
            } catch (Exception e) {
                throw new CompletionException(e);
            }
        }, executor).orTimeout(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }
}
```

**Why Per-Tenant Executors:**
- Tenant A's slow rule cannot starve Tenant B's threads
- Thread pool exhaustion isolated to offending tenant
- Bulkhead isolation pattern (SOC2 CC6.6 tenant segregation)

### Backpressure with Bounded Queues

**Span Ingestion Queue:**
```java
@ApplicationScoped
public class SpanIngestionQueue {
    private static final int MAX_QUEUE_SIZE = 50_000;
    private final BlockingQueue<SpanBatch> queue = new ArrayBlockingQueue<>(MAX_QUEUE_SIZE);
    private final Map<String, AtomicInteger> tenantCounts = new ConcurrentHashMap<>();

    public boolean offer(String tenantId, SpanBatch batch) {
        if (!queue.offer(batch)) {
            // Queue full - apply FIFO eviction
            SpanBatch oldest = queue.poll();
            if (oldest != null) {
                metrics.record("spans.dropped", oldest.getTenantId(), oldest.size());
            }

            // Try again
            if (!queue.offer(batch)) {
                return false; // Still full, reject
            }
        }

        tenantCounts.computeIfAbsent(tenantId, k -> new AtomicInteger()).addAndGet(batch.size());
        return true;
    }

    public int getQueueUsage() {
        return (int) (queue.size() * 100.0 / MAX_QUEUE_SIZE);
    }
}
```

## Implementation

### Rule Timeout Enforcement

**File:** `backend/src/main/java/com/fluo/services/RuleEvaluationService.java`

```java
@ApplicationScoped
public class RuleEvaluationService {
    @Inject RuleTimeoutManager timeoutManager;
    @Inject MetricsService metrics;
    @ConfigProperty(name = "rule.evaluation.timeout", defaultValue = "500ms")
    Duration ruleTimeout;

    public List<RuleMatch> evaluateRule(String tenantId, String ruleId, CompleteTrace trace) {
        long start = System.nanoTime();

        try {
            CompletableFuture<List<RuleMatch>> future = timeoutManager.executeWithTimeout(
                tenantId,
                () -> doEvaluateRule(tenantId, ruleId, trace),
                ruleTimeout
            );

            List<RuleMatch> matches = future.get();
            Duration duration = Duration.ofNanos(System.nanoTime() - start);
            metrics.recordRuleEvaluation(tenantId, ruleId, duration);
            return matches;

        } catch (TimeoutException e) {
            Duration duration = Duration.ofNanos(System.nanoTime() - start);
            log.warnf("Rule timeout: tenant=%s, rule=%s, duration=%dms", tenantId, ruleId, duration.toMillis());

            metrics.record("rule.timeout", tenantId, ruleId);

            // Generate signal indicating rule timed out
            Signal timeoutSignal = Signal.builder()
                .tenantId(tenantId)
                .ruleId(ruleId)
                .severity(Severity.WARNING)
                .type("rule_timeout")
                .message("Rule exceeded timeout: " + ruleTimeout.toMillis() + "ms")
                .metadata(Map.of(
                    "trace_id", trace.getTraceId(),
                    "timeout_ms", ruleTimeout.toMillis(),
                    "actual_duration_ms", duration.toMillis()
                ))
                .build();

            signalService.createSignal(tenantId, timeoutSignal);

            // Return empty matches (skip this rule for this trace)
            return List.of();

        } catch (Exception e) {
            log.errorf(e, "Rule evaluation failed: tenant=%s, rule=%s", tenantId, ruleId);
            metrics.record("rule.error", tenantId, ruleId, e.getClass().getSimpleName());
            throw new RuleEvaluationException(tenantId, ruleId, e);
        }
    }

    private List<RuleMatch> doEvaluateRule(String tenantId, String ruleId, CompleteTrace trace) {
        KieSession session = createSession(tenantId, ruleId);
        session.insert(trace);
        session.fireAllRules();
        return extractMatches(session);
    }
}
```

**Timeout Behavior:**
1. Rule execution starts
2. After 500ms (configurable), `TimeoutException` thrown
3. Rule evaluation skipped for this trace
4. Signal generated: `rule_timeout` (severity: WARNING)
5. Subsequent traces continue processing normally

### Backpressure Handling

**File:** `backend/src/main/java/com/fluo/routes/SpanApiRoute.java`

```java
@Path("/api/spans")
@ApplicationScoped
public class SpanApiRoute {
    @Inject SpanIngestionQueue queue;
    @Inject MetricsService metrics;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response ingestSpans(@Context SecurityContext ctx, List<SpanData> spans) {
        String tenantId = ctx.getUserPrincipal().getName();

        // Check queue capacity
        int queueUsage = queue.getQueueUsage();
        if (queueUsage > 95) {
            log.warnf("Backpressure: queue=%d%%, rejecting tenant=%s", queueUsage, tenantId);
            metrics.record("backpressure.rejected", tenantId);

            return Response.status(429)
                .entity(Map.of(
                    "error", "backpressure",
                    "message", "Span queue at capacity, retry after 5s",
                    "retry_after_ms", 5000,
                    "queue_usage_percent", queueUsage
                ))
                .header("Retry-After", "5")
                .build();
        }

        SpanBatch batch = new SpanBatch(tenantId, spans);
        if (!queue.offer(tenantId, batch)) {
            // Queue full despite eviction
            metrics.record("backpressure.queue_full", tenantId);
            return Response.status(503)
                .entity(Map.of(
                    "error", "service_unavailable",
                    "message", "Span processing overloaded, try again later"
                ))
                .build();
        }

        metrics.record("spans.received", tenantId, spans.size());
        return Response.status(202).build(); // Accepted
    }
}
```

**Backpressure Thresholds:**
- Queue usage <80%: Accept all spans
- Queue usage 80-95%: Accept with warning log
- Queue usage >95%: Return 429 (Too Many Requests)
- Queue full (100%): Return 503 (Service Unavailable)

### Rate Limiting (Per-Tenant)

**File:** `backend/src/main/java/com/fluo/resilience/TenantRateLimiter.java`

```java
@ApplicationScoped
public class TenantRateLimiter {
    private final Map<String, RateLimiter> tenantLimiters = new ConcurrentHashMap<>();

    @ConfigProperty(name = "rate.limit.spans.per.minute", defaultValue = "10000")
    int spansPerMinute;

    public RateLimiter getLimiter(String tenantId) {
        return tenantLimiters.computeIfAbsent(tenantId, k ->
            RateLimiter.create(spansPerMinute / 60.0) // Convert to spans/sec
        );
    }

    public boolean tryAcquire(String tenantId, int permits) {
        RateLimiter limiter = getLimiter(tenantId);
        return limiter.tryAcquire(permits, 100, TimeUnit.MILLISECONDS);
    }
}
```

**Usage in SpanApiRoute:**
```java
@POST
public Response ingestSpans(@Context SecurityContext ctx, List<SpanData> spans) {
    String tenantId = ctx.getUserPrincipal().getName();

    // Rate limit check
    if (!rateLimiter.tryAcquire(tenantId, spans.size())) {
        metrics.record("rate_limit.exceeded", tenantId);
        return Response.status(429)
            .entity(Map.of(
                "error", "rate_limit_exceeded",
                "message", "Tenant rate limit: " + spansPerMinute + " spans/min",
                "retry_after_ms", 60000 / spansPerMinute
            ))
            .build();
    }

    // Continue with ingestion...
}
```

## Configuration

**File:** `application.properties`

```properties
# Rule Timeout
rule.evaluation.timeout=500ms
rule.evaluation.timeout.action=skip  # or: fail_trace

# Span Queue
span.queue.max-size=50000
span.queue.backpressure-threshold=95  # Percentage
span.queue.eviction-strategy=fifo

# Rate Limiting
rate.limit.spans.per.minute=10000
rate.limit.signals.per.minute=100
rate.limit.enabled=true

# Per-Tenant Thread Pools
executor.rule-evaluation.threads-per-tenant=10
executor.rule-evaluation.queue-size=100
```

## Security Requirements

### P0 (Blocking)

**1. Per-Tenant Thread Pool Isolation**
- Each tenant MUST have dedicated thread pool for rule evaluation
- Thread pool exhaustion MUST NOT affect other tenants
- Implementation: `RuleTimeoutManager` with tenant-scoped executors
- Test:
```java
@Test
void tenantThreadPoolIsolation() {
    // Tenant A submits 100 slow rules (1s each)
    for (int i = 0; i < 100; i++) {
        timeoutManager.executeWithTimeout("tenantA", slowRule(), Duration.ofSeconds(1));
    }

    // Tenant B should still complete fast
    long start = System.currentTimeMillis();
    timeoutManager.executeWithTimeout("tenantB", fastRule(), Duration.ofMillis(100)).get();
    long duration = System.currentTimeMillis() - start;

    assertThat(duration).isLessThan(200); // Tenant B not affected
}
```

**2. Rate Limiter Per-Tenant Isolation**
- Rate limits MUST be enforced per tenant
- Tenant A hitting rate limit MUST NOT affect Tenant B
- Implementation: `TenantRateLimiter` with tenant-scoped Guava `RateLimiter`

**3. Queue Eviction Fairness**
- FIFO eviction MUST NOT disproportionately affect single tenant
- Track eviction metrics per tenant: `spans.dropped{tenant_id}`
- Alert if single tenant >50% of dropped spans

### P1 (High Priority)

**4. Timeout Signal Generation**
- Rule timeouts MUST generate signal (severity: WARNING)
- Signal MUST include: trace_id, rule_id, timeout_ms, actual_duration_ms
- Compliance span: `@SOC2(controls = {CC7_2})` for timeout events

**5. Backpressure Metrics**
- Emit metrics: `backpressure.rejected{tenant_id}`, `queue.usage.percent`
- Alert: `queue.usage.percent > 90 for 5m` → SRE notification

## Acceptance Criteria

### Functional Requirements

**Rule Timeout:**
```gherkin
Scenario: Rule times out after 500ms
  Given tenant "acme" has rule "slow-rule" that sleeps 1000ms
  And rule.evaluation.timeout=500ms
  When trace triggers "slow-rule"
  Then rule execution is cancelled after 500ms
  And signal "rule_timeout" is generated (severity: WARNING)
  And subsequent rules execute normally
  And metric "rule.timeout{tenant=acme, rule=slow-rule}" increments

Scenario: Rule completes within timeout
  Given tenant "acme" has rule "fast-rule" that completes in 100ms
  And rule.evaluation.timeout=500ms
  When trace triggers "fast-rule"
  Then rule completes successfully
  And signal is generated if rule matches
  And no timeout signal is created
```

**Backpressure:**
```gherkin
Scenario: 429 response when queue >95% full
  Given span queue is at 48,000/50,000 (96% capacity)
  When POST /api/spans with 100 spans
  Then response is 429 Too Many Requests
  And response includes "retry_after_ms": 5000
  And response includes "queue_usage_percent": 96
  And header "Retry-After" is 5

Scenario: Oldest spans evicted on queue full
  Given span queue is at 50,000/50,000 (100% full)
  When POST /api/spans with new batch
  Then oldest batch is evicted (FIFO)
  And metric "spans.dropped{tenant_id}" increments
  And new batch is accepted (202 Accepted)
```

**Rate Limiting:**
```gherkin
Scenario: Rate limit enforced per tenant
  Given tenant "acme" rate limit is 10,000 spans/min (166/sec)
  When tenant "acme" sends 200 spans/sec for 1 minute
  Then first 10,000 spans are accepted (202)
  And remaining spans are rejected (429)
  And response includes "rate_limit_exceeded"

Scenario: Tenant B unaffected by Tenant A rate limit
  Given tenant A hits rate limit (10,000 spans/min)
  When tenant B sends spans
  Then tenant B spans are accepted (202)
  And tenant B rate limit is independent
```

### Security Requirements

```gherkin
Scenario: Tenant thread pool isolation
  Given tenant A submits 100 slow rules (1s each)
  When tenant B submits fast rule (50ms)
  Then tenant B rule completes in <100ms
  And tenant A slow rules do not starve tenant B

Scenario: Queue eviction fairness
  Given 5 tenants send spans at equal rate
  When queue reaches capacity and eviction occurs
  Then eviction is distributed equally across tenants
  And no single tenant accounts for >30% of evicted spans
```

## Testing Strategy

### Unit Tests

**Timeout Enforcement:**
```java
@Test
void ruleTimeout_skipsExecution() {
    Clock testClock = Clock.fixed(Instant.now());
    RuleEvaluationService service = new RuleEvaluationService(testClock);

    Rule slowRule = mockRule(() -> {
        testClock.advance(Duration.ofMillis(600)); // Exceeds 500ms timeout
        return signal();
    });

    List<RuleMatch> matches = service.evaluateRule("tenant1", "slow-rule", trace());

    assertThat(matches).isEmpty(); // Rule skipped
    assertThat(metrics.counter("rule.timeout", "tenant", "tenant1")).isEqualTo(1);
}
```

**Queue Eviction:**
```java
@Test
void queueEviction_fifoOrder() {
    SpanIngestionQueue queue = new SpanIngestionQueue(capacity = 3);

    SpanBatch batch1 = batch("t1", timestamp = 100);
    SpanBatch batch2 = batch("t2", timestamp = 200);
    SpanBatch batch3 = batch("t3", timestamp = 300);
    SpanBatch batch4 = batch("t4", timestamp = 400);

    queue.offer("t1", batch1);
    queue.offer("t2", batch2);
    queue.offer("t3", batch3);
    queue.offer("t4", batch4); // Should evict batch1

    assertThat(queue.contains(batch1)).isFalse(); // Oldest evicted
    assertThat(queue.contains(batch2)).isTrue();
}
```

### Integration Tests

**Testcontainers with Load:**
```java
@QuarkusTest
class BackpressureIntegrationTest {
    @Test
    void backpressure_returns429() {
        // Fill queue to 96% capacity
        for (int i = 0; i < 48000; i++) {
            given()
                .auth().oauth2(token("tenant1"))
                .body(span(i))
                .post("/api/spans")
                .then()
                .statusCode(202);
        }

        // Next request should get 429
        given()
            .auth().oauth2(token("tenant1"))
            .body(span(48001))
            .post("/api/spans")
            .then()
            .statusCode(429)
            .body("error", equalTo("backpressure"))
            .header("Retry-After", equalTo("5"));
    }
}
```

### Performance Tests

**JMH Benchmark:**
```java
@State(Scope.Benchmark)
public class RuleTimeoutBench {
    @Benchmark
    public void evaluateRule_withTimeout(Blackhole bh) {
        List<RuleMatch> matches = service.evaluateRule("tenant1", "rule1", trace());
        bh.consume(matches);
    }

    @Benchmark
    public void evaluateRule_noTimeout(Blackhole bh) {
        List<RuleMatch> matches = serviceNoTimeout.evaluateRule("tenant1", "rule1", trace());
        bh.consume(matches);
    }
}
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/fluo/resilience/RuleTimeoutManager.java`
- `backend/src/main/java/com/fluo/resilience/SpanIngestionQueue.java`
- `backend/src/main/java/com/fluo/resilience/TenantRateLimiter.java`
- `backend/src/main/java/com/fluo/models/SpanBatch.java`
- `backend/src/test/java/com/fluo/resilience/RuleTimeoutTest.java`
- `backend/src/test/java/com/fluo/resilience/BackpressureTest.java`

**Modified Files:**
- `backend/src/main/java/com/fluo/services/RuleEvaluationService.java`
- `backend/src/main/java/com/fluo/routes/SpanApiRoute.java`
- `backend/src/main/resources/application.properties`
- `backend/pom.xml` (add Guava RateLimiter)

## Dependencies

**Maven:**
```xml
<dependency>
    <groupId>com.google.guava</groupId>
    <artifactId>guava</artifactId>
    <version>32.1.3-jre</version>
</dependency>
```

## Success Criteria

- [ ] Rule timeout enforced (default: 500ms, configurable)
- [ ] Timeout signal generated (severity: WARNING)
- [ ] Per-tenant thread pool isolation (10 threads/tenant)
- [ ] Span queue bounded (50K capacity)
- [ ] Backpressure: 429 response when queue >95% full
- [ ] FIFO eviction on queue overflow
- [ ] Per-tenant rate limiting (10K spans/min)
- [ ] Metrics: rule.timeout, backpressure.rejected, queue.usage
- [ ] Test coverage >90%
- [ ] Performance overhead <5% (timeout check)
