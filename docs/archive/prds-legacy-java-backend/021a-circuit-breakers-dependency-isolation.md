# PRD-021A: Circuit Breakers & Dependency Isolation

**Priority:** P1 (High - Availability)
**Complexity:** Medium
**Personas:** SRE, Platform
**Dependencies:** None
**Implements:** Resilience4j circuit breakers for DuckDB, TigerBeetle, Drools

## Problem

BeTrace depends on stateful components (DuckDB, TigerBeetle, Drools) without failure isolation:
- **Cascading failures**: Database timeout → all ingestion blocked for 30s
- **Resource exhaustion**: Failed DB calls hold threads → thread pool starvation
- **No automatic recovery**: Manual intervention required after dependency outage
- **Cross-tenant impact**: One tenant's DB failures affect all tenants

**Impact:**
- SRE oncall: 3AM pages for transient network blips
- Compliance: Missing evidence during dependency outages (SOC2 CC7.2)
- Users: API timeouts cascade to frontend errors

## Solution

### Circuit Breaker Pattern

**States:**
- **CLOSED**: Normal operation, calls pass through
- **OPEN**: Failures exceed threshold, fail-fast without calling dependency
- **HALF_OPEN**: After timeout, probe with single request to test recovery

**Transition Logic:**
```
CLOSED --[5 failures in 10s]--> OPEN
OPEN --[30s timeout]--> HALF_OPEN
HALF_OPEN --[3 successes]--> CLOSED
HALF_OPEN --[1 failure]--> OPEN
```

### Per-Tenant Circuit Breakers

**Architecture:**
```java
@ApplicationScoped
public class TenantCircuitBreakerManager {
    private final Map<String, Map<String, CircuitBreaker>> tenantBreakers = new ConcurrentHashMap<>();

    public CircuitBreaker getBreaker(String tenantId, String dependency) {
        return tenantBreakers
            .computeIfAbsent(tenantId, k -> new ConcurrentHashMap<>())
            .computeIfAbsent(dependency, k -> createBreaker(tenantId, dependency));
    }

    private CircuitBreaker createBreaker(String tenantId, String dependency) {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .failureRateThreshold(50) // 50% failure rate
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .permittedNumberOfCallsInHalfOpenState(3)
            .slidingWindowSize(10) // Last 10 calls
            .minimumNumberOfCalls(5) // Need 5 calls before opening
            .build();

        return CircuitBreaker.of(tenantId + ":" + dependency, config);
    }
}
```

**Why Per-Tenant:**
- Tenant A's DB failures don't affect Tenant B
- Malicious tenant cannot DoS other tenants via circuit breaker manipulation
- Isolation requirement: SOC2 CC6.6 (tenant data segregation)

## Implementation

### DuckDB Circuit Breaker

**File:** `backend/src/main/java/com/betrace/services/DuckDBTraceStorage.java`

```java
@ApplicationScoped
public class DuckDBTraceStorage {
    @Inject TenantCircuitBreakerManager breakerManager;
    @Inject MetricsService metrics;

    public void storeSpan(String tenantId, SpanData span) {
        CircuitBreaker breaker = breakerManager.getBreaker(tenantId, "duckdb");

        try {
            breaker.executeSupplier(() -> {
                String sql = "INSERT INTO traces_" + tenantId + " VALUES (?, ?, ?)";
                jdbcTemplate.update(sql, span.getTraceId(), span.getSpanId(), span.toJson());
                return null;
            });
        } catch (CallNotPermittedException e) {
            // Circuit breaker is OPEN - fail fast
            log.debugf("Circuit breaker OPEN for tenant %s, skipping DuckDB write", tenantId);
            metrics.record("duckdb.circuit.prevented", tenantId);

            // Degraded mode: Continue without trace storage
            // Rule evaluation can still proceed using in-memory correlation
        } catch (Exception e) {
            log.errorf(e, "DuckDB write failed for tenant %s", tenantId);
            metrics.record("duckdb.write.error", tenantId);
            throw new TraceStorageException(e);
        }
    }
}
```

**Behavior:**
- **CLOSED**: Spans written to DuckDB normally
- **OPEN**: Span ingestion continues, trace analytics unavailable
- **HALF_OPEN**: Probe with 3 writes, close if all succeed

### TigerBeetle Circuit Breaker

**File:** `backend/src/main/java/com/betrace/services/SignalPersistenceService.java`

```java
@ApplicationScoped
public class SignalPersistenceService {
    @Inject TenantCircuitBreakerManager breakerManager;
    @Inject SignalQueue signalQueue;

    private static final int MAX_QUEUE_SIZE_PER_TENANT = 1000; // P0 Security: Per-tenant limit

    public void persistSignal(String tenantId, Signal signal) {
        CircuitBreaker breaker = breakerManager.getBreaker(tenantId, "tigerbeetle");

        try {
            breaker.executeSupplier(() -> {
                tigerBeetleClient.insert(signal.toRecord());
                return null;
            });
        } catch (CallNotPermittedException e) {
            // Circuit breaker OPEN - queue signal for retry
            log.warnf("Circuit breaker OPEN for tenant %s, queueing signal %s", tenantId, signal.getId());

            if (!signalQueue.offer(tenantId, signal, MAX_QUEUE_SIZE_PER_TENANT)) {
                // P0 Security: Fail-fast on queue overflow, do NOT block
                metrics.record("signal.queue.overflow", tenantId);
                throw new QueueOverflowException(tenantId, signal.getId());
            }

            metrics.record("signal.queued", tenantId);
        }
    }
}
```

**Queue Management:**
```java
@ApplicationScoped
public class SignalQueue {
    private final Map<String, BoundedQueue<Signal>> tenantQueues = new ConcurrentHashMap<>();

    public boolean offer(String tenantId, Signal signal, int maxSize) {
        BoundedQueue<Signal> queue = tenantQueues.computeIfAbsent(
            tenantId,
            k -> new BoundedQueue<>(maxSize)
        );

        if (queue.size() >= maxSize) {
            return false; // Queue full, reject
        }

        return queue.offer(signal);
    }

    public void drainQueue(String tenantId) {
        BoundedQueue<Signal> queue = tenantQueues.get(tenantId);
        if (queue == null) return;

        // Drain at 100 signals/sec to avoid overwhelming TigerBeetle
        while (!queue.isEmpty()) {
            Signal signal = queue.poll();
            if (signal != null) {
                try {
                    persistSignal(tenantId, signal);
                    Thread.sleep(10); // Rate limit: 100/sec
                } catch (Exception e) {
                    log.errorf(e, "Failed to drain signal %s", signal.getId());
                    // Re-queue signal (up to max retries)
                    if (signal.getRetryCount() < 3) {
                        signal.incrementRetry();
                        queue.offer(signal);
                    } else {
                        metrics.record("signal.drain.failed", tenantId);
                    }
                }
            }
        }
    }
}
```

### Drools Circuit Breaker

**File:** `backend/src/main/java/com/betrace/services/RuleEvaluationService.java`

```java
@ApplicationScoped
public class RuleEvaluationService {
    @Inject TenantCircuitBreakerManager breakerManager;

    public List<RuleMatch> evaluateRule(String tenantId, String ruleId, CompleteTrace trace) {
        CircuitBreaker breaker = breakerManager.getBreaker(tenantId, "drools:" + ruleId);

        try {
            return breaker.executeSupplier(() -> {
                KieSession session = createSession(tenantId, ruleId);
                session.insert(trace);
                session.fireAllRules();
                return extractMatches(session);
            });
        } catch (CallNotPermittedException e) {
            // Circuit breaker OPEN - skip rule evaluation
            log.warnf("Circuit breaker OPEN for tenant %s rule %s", tenantId, ruleId);
            metrics.record("drools.circuit.prevented", tenantId, ruleId);

            // Generate signal indicating rule was skipped
            return List.of(new RuleMatch(
                ruleId,
                "rule_skipped",
                Map.of("reason", "circuit_breaker_open")
            ));
        } catch (RuleTimeoutException e) {
            log.errorf("Rule timeout for tenant %s rule %s", tenantId, ruleId);
            metrics.record("drools.timeout", tenantId, ruleId);
            throw e;
        }
    }
}
```

**Per-Rule Breakers:**
- Each rule has independent circuit breaker
- One slow rule doesn't block all rules for tenant
- Breaker key: `tenant:drools:ruleId`

## Circuit Breaker Configuration

**File:** `application.properties`

```properties
# DuckDB Circuit Breaker
circuit.duckdb.failure-threshold=50
circuit.duckdb.wait-duration-seconds=30
circuit.duckdb.sliding-window-size=10
circuit.duckdb.min-calls=5

# TigerBeetle Circuit Breaker
circuit.tigerbeetle.failure-threshold=50
circuit.tigerbeetle.wait-duration-seconds=30
circuit.tigerbeetle.sliding-window-size=10
circuit.tigerbeetle.min-calls=5

# Drools Circuit Breaker (per-rule)
circuit.drools.failure-threshold=80
circuit.drools.wait-duration-seconds=10
circuit.drools.sliding-window-size=20
circuit.drools.min-calls=10

# Signal Queue (P0 Security: Per-tenant limits)
signal.queue.max-size-per-tenant=1000
signal.queue.max-memory-mb-per-tenant=10
signal.queue.drain-rate-per-second=100
```

## Security Requirements

### P0 (Blocking)

**1. Per-Tenant Circuit Breakers**
- Circuit breaker state MUST be isolated per tenant
- Tenant A's failures MUST NOT affect Tenant B
- Implementation: `TenantCircuitBreakerManager` with tenant-scoped keys
- Audit: Log all circuit breaker state transitions with tenant ID

**2. Signal Queue Overflow Protection**
- Queue size MUST be bounded per tenant (1000 signals max)
- Overflow MUST fail-fast (throw exception, do NOT block)
- Memory limit: 10MB per tenant queue
- Test:
```java
@Test
void queueOverflow_rejectsNewSignals() {
    for (int i = 0; i < 1000; i++) {
        queue.offer("tenant1", signal(i), 1000);
    }

    assertThatThrownBy(() -> queue.offer("tenant1", signal(1001), 1000))
        .isInstanceOf(QueueOverflowException.class);
}
```

**3. Circuit Breaker State Audit Logging**
- All state transitions logged: `CLOSED → OPEN → HALF_OPEN → CLOSED`
- Log format:
```json
{
  "timestamp": "2025-10-11T10:23:45.123Z",
  "event": "circuit_breaker_state_change",
  "tenantId": "acme",
  "dependency": "duckdb",
  "old_state": "CLOSED",
  "new_state": "OPEN",
  "failure_count": 5
}
```

### P1 (High Priority)

**4. Admin Circuit Breaker Reset API**
- Authenticated endpoint to force-close circuit breaker
- Use case: Admin knows dependency is healthy, force recovery
```java
@PUT
@Path("/admin/circuit-breaker/{tenantId}/{dependency}/reset")
@RolesAllowed("super-admin")
public Response resetBreaker(String tenantId, String dependency) {
    CircuitBreaker breaker = breakerManager.getBreaker(tenantId, dependency);
    breaker.transitionToClosedState();

    auditLog.log("CIRCUIT_BREAKER_RESET", tenantId, dependency);
    return Response.ok().build();
}
```

**5. Circuit Breaker Metrics**
- Emit Prometheus metrics for all state changes
- Metrics:
```
circuit_breaker_state{tenant_id, dependency} = 0 (CLOSED) | 1 (OPEN) | 2 (HALF_OPEN)
circuit_breaker_failures{tenant_id, dependency}
circuit_breaker_calls_blocked{tenant_id, dependency}
circuit_breaker_success_rate{tenant_id, dependency}
```

## Acceptance Criteria

### Functional Requirements

**Circuit Breaker State Transitions:**
```gherkin
Scenario: Circuit breaker opens after repeated failures
  Given DuckDB connection fails 5 consecutive times for tenant "acme"
  When circuit breaker evaluates state
  Then circuit breaker transitions to OPEN
  And metric circuit_breaker_state{tenant=acme, dependency=duckdb} = 1
  And subsequent calls fail-fast (no DB call)

Scenario: Circuit breaker probes in HALF_OPEN state
  Given circuit breaker is OPEN for tenant "acme"
  When 30 seconds elapse
  Then circuit breaker transitions to HALF_OPEN
  And next 3 calls are permitted (probe requests)

Scenario: Circuit breaker closes after successful probes
  Given circuit breaker is HALF_OPEN for tenant "acme"
  When 3 consecutive calls succeed
  Then circuit breaker transitions to CLOSED
  And all calls resume normally

Scenario: Circuit breaker re-opens on probe failure
  Given circuit breaker is HALF_OPEN for tenant "acme"
  When 1 of 3 probes fails
  Then circuit breaker transitions back to OPEN
  And 30s timeout resets
```

**Tenant Isolation:**
```gherkin
Scenario: Tenant A failures do not affect Tenant B
  Given circuit breaker for tenant A is OPEN (DuckDB)
  When tenant B sends spans
  Then tenant B spans are stored in DuckDB normally
  And circuit breaker for tenant B remains CLOSED

Scenario: Per-tenant signal queues are isolated
  Given tenant A fills signal queue (1000 signals)
  When tenant B generates signal
  Then tenant B signal is persisted (not queued)
  And tenant A queue overflow does not affect tenant B
```

**Signal Queue Management:**
```gherkin
Scenario: Signals queued when circuit breaker opens
  Given TigerBeetle circuit breaker opens for tenant "acme"
  When signal is generated for tenant "acme"
  Then signal is queued in-memory (not persisted)
  And metric signal.queued{tenant=acme} increments

Scenario: Queue drains when circuit breaker closes
  Given 100 signals queued for tenant "acme"
  When TigerBeetle circuit breaker closes
  Then queued signals drain at 100 signals/sec
  And all 100 signals persist to TigerBeetle
  And queue becomes empty

Scenario: Queue overflow rejects new signals
  Given signal queue for tenant "acme" is full (1000 signals)
  When new signal is generated
  Then QueueOverflowException is thrown
  And metric signal.queue.overflow{tenant=acme} increments
  And signal is NOT queued (fail-fast)
```

### Security Requirements

```gherkin
Scenario: Per-tenant queue limit enforced
  Given tenant "attacker" generates 1000 signals
  When tenant "attacker" generates 1001st signal
  Then QueueOverflowException is thrown
  And tenant "victim" can still generate signals
  And tenant "attacker" queue does not exceed 10MB memory

Scenario: Circuit breaker state logged for audit
  Given circuit breaker transitions from CLOSED to OPEN
  When state change occurs
  Then audit log contains:
    - timestamp
    - tenantId
    - dependency
    - old_state = CLOSED
    - new_state = OPEN
    - failure_count = 5
```

## Testing Strategy

### Unit Tests

**Circuit Breaker State Machine:**
```java
@Test
void circuitBreaker_opensAfter5Failures() {
    CircuitBreaker breaker = breakerManager.getBreaker("tenant1", "duckdb");

    // Simulate 5 failures
    for (int i = 0; i < 5; i++) {
        breaker.onError(0, TimeUnit.NANOSECONDS, new SQLException());
    }

    assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);
}

@Test
void circuitBreaker_transitionsToHalfOpenAfterTimeout() throws InterruptedException {
    CircuitBreaker breaker = breakerManager.getBreaker("tenant1", "duckdb");

    // Open circuit breaker
    for (int i = 0; i < 5; i++) {
        breaker.onError(0, TimeUnit.NANOSECONDS, new SQLException());
    }

    // Wait for timeout
    Thread.sleep(31000); // 30s + margin

    assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.HALF_OPEN);
}
```

**Queue Overflow:**
```java
@Test
void signalQueue_rejectsWhenFull() {
    SignalQueue queue = new SignalQueue();

    // Fill queue
    for (int i = 0; i < 1000; i++) {
        queue.offer("tenant1", signal(i), 1000);
    }

    // Overflow
    assertThat(queue.offer("tenant1", signal(1001), 1000)).isFalse();
}
```

### Integration Tests

**Testcontainers with Fault Injection:**
```java
@QuarkusTest
class CircuitBreakerIntegrationTest {
    @Inject DuckDBTraceStorage storage;
    @Inject TenantCircuitBreakerManager breakerManager;

    @Test
    void duckdbFailure_opensCircuitBreaker() {
        // Stop DuckDB container
        duckDBContainer.stop();

        // Attempt 5 writes (should fail)
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> storage.storeSpan("tenant1", span(i)))
                .isInstanceOf(TraceStorageException.class);
        }

        // Circuit breaker should be OPEN
        CircuitBreaker breaker = breakerManager.getBreaker("tenant1", "duckdb");
        assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);

        // Next call fails fast (no DB call)
        long start = System.currentTimeMillis();
        assertThatThrownBy(() -> storage.storeSpan("tenant1", span(6)))
            .isInstanceOf(CallNotPermittedException.class);
        long duration = System.currentTimeMillis() - start;

        assertThat(duration).isLessThan(10); // Fail-fast (<10ms)
    }
}
```

### Chaos Testing

**Random Dependency Failures:**
```bash
# k6 load test with chaos
k6 run --vus 100 --duration 5m chaos-test.js

# chaos-test.js
import http from 'k6/http';

export default function () {
  // 20% chance of triggering circuit breaker
  if (Math.random() < 0.2) {
    // Stop DuckDB for 10 seconds
    exec.command('docker stop duckdb && sleep 10 && docker start duckdb');
  }

  // Send spans
  http.post('http://localhost:8080/api/spans', JSON.stringify([span()]));
}
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/betrace/resilience/TenantCircuitBreakerManager.java`
- `backend/src/main/java/com/betrace/resilience/SignalQueue.java`
- `backend/src/main/java/com/betrace/resilience/BoundedQueue.java`
- `backend/src/main/java/com/betrace/exceptions/QueueOverflowException.java`
- `backend/src/test/java/com/betrace/resilience/CircuitBreakerTest.java`
- `backend/src/test/java/com/betrace/resilience/SignalQueueTest.java`

**Modified Files:**
- `backend/src/main/java/com/betrace/services/DuckDBTraceStorage.java` (add circuit breaker)
- `backend/src/main/java/com/betrace/services/SignalPersistenceService.java` (add circuit breaker)
- `backend/src/main/java/com/betrace/services/RuleEvaluationService.java` (add circuit breaker)
- `backend/src/main/resources/application.properties` (circuit breaker config)
- `backend/pom.xml` (add Resilience4j dependency)

## Dependencies

**Maven:**
```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-circuitbreaker</artifactId>
    <version>2.1.0</version>
</dependency>
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-micrometer</artifactId>
    <version>2.1.0</version>
</dependency>
```

## Success Criteria

- [ ] Per-tenant circuit breakers implemented for DuckDB, TigerBeetle, Drools
- [ ] Circuit breaker state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
- [ ] Signal queue with per-tenant overflow protection (1000 max)
- [ ] Queue drain on circuit breaker recovery (100 signals/sec)
- [ ] Metrics exported: circuit_breaker_state, circuit_breaker_failures
- [ ] Audit logging for all state transitions
- [ ] Admin API to reset circuit breakers
- [ ] Test coverage >90% for circuit breaker logic
- [ ] Integration tests with Testcontainers fault injection
- [ ] Chaos testing validates resilience under random failures
