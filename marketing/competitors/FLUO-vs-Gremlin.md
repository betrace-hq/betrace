# BeTrace vs Gremlin: When to Use Each (And When to Use Both)

**Last Updated:** October 2025

---

## TL;DR

**Gremlin**: Chaos engineering platform that injects controlled failures (CPU spikes, network latency, pod kills) to test system resilience.

**BeTrace**: Behavioral invariant detection system - code emits context via spans, BeTrace DSL matches patterns, produces signals and metrics.

**When to use Gremlin**: You need to test system resilience by injecting failures (chaos experiments).

**When to use BeTrace**: You need to validate expected behavior patterns in traces during normal operations or chaos tests.

**When to use both**: Gremlin injects chaos, BeTrace validates that invariants hold (or break predictably) under failure conditions.

---

## What is Gremlin?

Gremlin is a chaos engineering platform (Chaos-as-a-Service) that helps teams proactively test system resilience by injecting controlled failures into production or staging environments.

**Core capabilities:**
- **Resource Attacks**: CPU, memory, disk, I/O stress
- **Network Attacks**: Latency, packet loss, DNS failures
- **State Attacks**: Process kills, container shutdowns, clock skew
- **Scenarios**: Multi-stage chaos experiments (e.g., "kill pod + add latency")

**Core workflow:**
```
Define chaos experiment → Inject failure → Observe system response → Validate resilience
```

**Value proposition**: Proactively find weaknesses before customers do - test failover, retry logic, circuit breakers, degraded mode.

---

## What is BeTrace?

BeTrace is a behavioral invariant detection system. Code emits contextual data as OpenTelemetry spans, BeTrace DSL defines pattern-matching rules, and BeTrace engine produces signals and metrics when patterns match (or don't match).

**Core workflow:**
```
Code emits context (spans) → BeTrace DSL (pattern matching) → Signals + Metrics
```

**Key capabilities:**
1. **Pattern Matching**: Match contextual span data against user-defined rules
2. **Rule Replay**: Retroactively apply rules to historical traces (seconds, not hours)
3. **Flexible Context**: Code defines what context to emit; rules define what patterns to detect

**Value proposition**: Define patterns once, detect violations instantly, and retroactively replay rules against historical traces without expensive reprocessing.

---

## Key Differences

| **Dimension** | **Gremlin** | **BeTrace** |
|--------------|----------|----------|
| **Primary Focus** | Inject failures (testing) | Detect patterns (validation) |
| **Data Source** | System resources, network, processes | OpenTelemetry traces |
| **Action Type** | Active (causes failures) | Passive (observes behavior) |
| **Use Case** | "Does our system handle failures?" | "Does our system follow expected patterns?" |
| **Time Dimension** | Forward (run experiments) | Backward (replay rules) |
| **Output** | Experiment results, blast radius | Signals (pattern violations) |

---

## When to Use Gremlin

Use Gremlin when you need:

### 1. Testing System Resilience Under Failure
You want to inject failures and validate your system handles them gracefully.

**Example**: "Does our API degrade gracefully when database is slow?"

**Gremlin experiment:**
1. Inject latency: `gremlin network latency --target=postgres --delay=1000ms`
2. Observe: API switches to read replica (fallback)
3. Validate: Response time stays < 500ms (SLA maintained)

---

### 2. Validating Failover and Retry Logic
You want to test automatic failover mechanisms.

**Example**: "Does Kubernetes reschedule pods when nodes fail?"

**Gremlin experiment:**
1. Shutdown attack: `gremlin state shutdown --target=node-1`
2. Observe: Kubernetes reschedules pods to node-2
3. Validate: No dropped requests during failover

---

### 3. Testing Circuit Breakers and Rate Limits
You want to verify protective mechanisms trigger under load.

**Example**: "Does circuit breaker open when 3rd-party API fails?"

**Gremlin experiment:**
1. Inject API errors: `gremlin http error --target=payment-gateway --status=500`
2. Observe: Circuit breaker opens after 5 consecutive errors
3. Validate: Requests fail fast (no cascading failures)

---

### 4. Discovering Unknown Weaknesses
You want to find edge cases and hidden dependencies.

**Example**: "What happens if Redis is slow?"

**Gremlin experiment:**
1. Inject Redis latency: `gremlin network latency --target=redis --delay=500ms`
2. Discovery: Session validation times out, users logged out
3. Fix: Add timeout + fallback for session checks

---

## When to Use BeTrace

Use BeTrace when you need:

### 1. Validating Expected Behavior Patterns (Normal Operations)
You want to ensure your system follows expected patterns during normal operation.

**Example**: "Every payment charge must follow cart validation."

**BeTrace DSL:**
```javascript
// Signal: PAYMENT_INVARIANT_VIOLATION (critical)
trace.has(payment.charge)
  and not trace.has(cart.validate)
```

**BeTrace workflow:**
1. Code emits spans: `cart.validate`, `payment.charge`
2. BeTrace engine matches pattern continuously
3. Signal emitted if pattern violated

---

### 2. Rule Replay on Historical Traces
You want to apply rules retroactively to historical data.

**Example**: Day 30 - discover new pattern violation. Replay rule against Days 1-29.

**BeTrace workflow:**
1. Day 30: Define rule ("Retries should never exceed 3")
2. Rule replay: Apply to Days 1-29 traces (seconds)
3. Discovery: 89 historical violations

**Why not Gremlin?**
- Gremlin: Run experiments forward (can't re-run past chaos)
- BeTrace: Replay rules backward (analyze past behavior)

---

### 3. Detecting Subtle Invariant Violations
You want to detect violations of expected patterns that aren't failures.

**Example**: "API should never access database directly (must use cache)."

**BeTrace DSL:**
```javascript
// Signal: CACHE_BYPASS_DETECTED (medium)
trace.has(api.request)
  and trace.has(database.query)
  and not trace.has(cache.check)
```

**Why not Gremlin?**
- Gremlin: Inject failures, test resilience
- BeTrace: Detect pattern violations (even when system "works")

---

### 4. Continuous Validation (Always-On)
You want rules to run continuously, not just during experiments.

**Example**: "Cross-tenant data access should never occur."

**BeTrace DSL:**
```javascript
// Signal: TENANT_ISOLATION_VIOLATION (critical)
trace.has(database.query).where(tenant.id == tenant-A)
  and trace.has(database.query).where(table matches ".*tenant_b_data.*")
```

**Why not Gremlin?**
- Gremlin: Time-bound experiments (run chaos tests)
- BeTrace: Always-on validation (continuous monitoring)

---

## When to Use Both (The Power Combo)

The most powerful scenario is using **Gremlin to inject chaos** and **BeTrace to validate invariants** during failure conditions.

### Scenario 1: Database Failover Validation

**Goal**: Test automatic failover from primary to replica database.

**Gremlin experiment:**
1. Inject failure: `gremlin state shutdown --target=postgres-primary`
2. Observe: Application switches to replica (automated)

**BeTrace validation:**
Define invariants that must hold during failover:

```javascript
// Signal: DATA_LOSS_DETECTED (critical)
trace.has(database.failover)
  and trace.has(database.failover).where(data.lost > 0)

// Signal: WRITE_TO_REPLICA_DETECTED (critical)
trace.has(database.failover)
  and trace.has(database.operation).where(operation == write)
  and trace.has(database.operation).where(target == replica)
```

**Result**:
- Gremlin: Inject database failure (test resilience)
- BeTrace: Validate invariants hold during chaos (no data loss, no writes to replica)

---

### Scenario 2: Circuit Breaker Testing

**Goal**: Verify circuit breaker opens when 3rd-party API fails.

**Gremlin experiment:**
1. Inject errors: `gremlin http error --target=payment-api --status=500 --rate=100%`
2. Observe: Circuit breaker opens after 5 errors

**BeTrace validation:**
Validate expected circuit breaker behavior:

```javascript
// Signal: CIRCUIT_BREAKER_NOT_OPENED (high)
trace.has(api.error).where(error_count >= 5)
  and not trace.has(circuit_breaker.state).where(state == open)

// Signal: REQUEST_DURING_OPEN_CIRCUIT (high)
trace.has(circuit_breaker.state).where(state == open)
  and trace.has(api.request)
```

**Result**:
- Gremlin: Inject API failures (trigger circuit breaker)
- BeTrace: Validate circuit breaker works correctly (opens on failures, blocks requests)

---

### Scenario 3: Retry Logic Validation

**Goal**: Test retry mechanism under transient failures.

**Gremlin experiment:**
1. Inject intermittent failures: `gremlin http error --target=order-service --rate=50%`
2. Observe: Application retries failed requests

**BeTrace validation:**
Validate retry logic doesn't exceed limits:

```javascript
// Signal: RETRY_LIMIT_EXCEEDED (high)
trace.has(api.request).where(retries > 3)

// Signal: BACKOFF_TOO_AGGRESSIVE (medium)
trace.has(retry.attempt).where(interval_ms < attempt * 100)
```

**Result**:
- Gremlin: Inject intermittent failures (trigger retries)
- BeTrace: Validate retry logic follows best practices (limits, backoff)

---

### Scenario 4: Multi-Region Failover

**Goal**: Test failover from US to EU region when US region degrades.

**Gremlin experiment:**
1. Inject network latency: `gremlin network latency --target=us-region --delay=5000ms`
2. Observe: Traffic shifts to EU region

**BeTrace validation:**
Validate failover invariants:

```javascript
// Signal: DROPPED_REQUESTS_DURING_FAILOVER (critical)
trace.has(region.failover)
  and trace.has(region.failover).where(request.dropped > 0)

// Signal: CROSS_REGION_DATA_ACCESS (high)
trace.has(database.query).where(region.current == EU)
  and trace.has(database.query).where(database.region == US)
```

**Result**:
- Gremlin: Inject regional latency (trigger failover)
- BeTrace: Validate failover works (no dropped requests, no cross-region access)

---

## Architecture: How They Integrate

```
┌─────────────────────────────────────────────────────────┐
│              Your Applications (Instrumented)            │
│  - OpenTelemetry SDK (contextual span attributes)       │
│  - Gremlin agent (chaos injection)                      │
└────────────┬─────────────────────────────────┬──────────┘
             │                                  │
             │ (OTel traces)                   │ (Chaos experiments)
             ▼                                  ▼
     ┌───────────────┐                  ┌───────────────┐
     │     BeTrace      │                  │    Gremlin    │
     │  (Validation) │                  │   (Chaos)     │
     └───────┬───────┘                  └───────┬───────┘
             │                                  │
             │ Signals                          │ Experiment results
             ▼                                  ▼
     ┌────────────────────────────────────────────────┐
     │            Reliability Engineering Team        │
     │  - Gremlin: "Did system handle failure?"       │
     │  - BeTrace: "Did invariants hold during chaos?"   │
     └────────────────────────────────────────────────┘
```

**Data flow:**
1. **Gremlin** injects failure (network latency, CPU spike, pod kill)
2. **Application** handles failure (fallback, retry, circuit breaker)
3. **OpenTelemetry** emits traces with context (failover, retry attempts)
4. **BeTrace** validates invariants hold during chaos (pattern matching)
5. **Engineering team** uses both:
   - Gremlin: "System survived database shutdown ✅"
   - BeTrace: "No data loss detected, read-only mode enforced ✅"

---

## Cost Comparison

| **Dimension** | **Gremlin** | **BeTrace** |
|--------------|----------|----------|
| **Pricing Model** | Per-target (hosts/containers) | Per-trace volume |
| **Typical Cost** | $12-50/target/month | Custom pricing |
| **Hidden Costs** | CI/CD integration, experiment design | OpenTelemetry instrumentation |
| **ROI Metric** | Incidents prevented ($$$) | Violations detected |

**When cost matters:**
- **Gremlin**: Expensive at scale (100s of targets), but prevents outages ($$$)
- **BeTrace**: Cost scales with trace volume (optimize span attributes)

**Combined ROI**:
- Gremlin: Prevent incidents (chaos testing)
- BeTrace: Detect violations (continuous validation)
- **Together**: Chaos testing + invariant validation = confidence

---

## Migration Paths

### Path 1: Gremlin → Gremlin + BeTrace
**Scenario**: You have Gremlin for chaos testing, want to validate invariants during experiments.

**Steps**:
1. Keep Gremlin for chaos injection
2. Add OpenTelemetry instrumentation (1-2 weeks)
3. Define BeTrace DSL rules for invariants (1 week)
4. Run Gremlin experiments, validate with BeTrace

**Result**: Chaos testing + invariant validation.

---

### Path 2: BeTrace → BeTrace + Gremlin
**Scenario**: You have BeTrace for invariants, want to test resilience under failure.

**Steps**:
1. Keep BeTrace for continuous validation
2. Install Gremlin agents (1 week)
3. Design chaos experiments (failover, retry, circuit breaker)
4. Use BeTrace to validate invariants during Gremlin experiments

**Result**: Continuous validation + chaos testing.

---

## Real-World Example: E-Commerce Platform

**Company**: E-commerce platform with 1M requests/day, multi-region deployment.

**Goal**: Validate resilience during failures + ensure invariants hold.

### Gremlin Experiments
1. **Database failover**: Shutdown primary → validate replica takeover
2. **Payment API failure**: Inject 500 errors → validate circuit breaker
3. **Network partition**: Isolate region → validate multi-region failover

### BeTrace Validation (During Experiments)
```javascript
// Signal: DATA_LOSS_DETECTED (critical)
trace.has(database.failover)
  and trace.has(database.failover).where(data.lost > 0)

// Signal: CIRCUIT_BREAKER_NOT_OPENED (high)
trace.has(api.error).where(error_count >= 5)
  and not trace.has(circuit_breaker.state).where(state == open)

// Signal: DROPPED_REQUESTS_DURING_FAILOVER (critical)
trace.has(region.failover)
  and trace.has(region.failover).where(request.dropped > 0)
```

**Result**:
- **Gremlin**: 3 experiments passed (system handled failures)
- **BeTrace**: 0 signals (invariants held during chaos)
- **Confidence**: High (chaos testing + invariant validation = reliable system)

---

## Summary

| **Question** | **Answer** |
|-------------|-----------|
| **Need to inject failures for testing?** | Use Gremlin (chaos engineering) |
| **Need to validate patterns during normal ops?** | Use BeTrace (behavioral validation) |
| **Need to validate invariants during chaos?** | Use both (Gremlin + BeTrace) |
| **Need to test failover/retry/circuit breakers?** | Use Gremlin (resilience testing) |
| **Need rule replay on historical traces?** | Use BeTrace (key differentiator) |
| **Want chaos testing + validation?** | Use both (Gremlin + BeTrace) |

**The power combo**: Gremlin injects chaos (test resilience), BeTrace validates invariants (ensure expected behavior during failures).

---

## Next Steps

**Exploring Gremlin?**
- [Gremlin Free Trial](https://www.gremlin.com)
- [Chaos Engineering Guide](https://www.gremlin.com/chaos-engineering/)

**Exploring BeTrace?**
- [BeTrace DSL Documentation](../../docs/technical/trace-rules-dsl.md)
- [OpenTelemetry Integration](../../backend/docs/AI_AGENT_MONITORING_GUIDE.md)

**Questions?**
- Gremlin: [Contact Sales](https://www.gremlin.com/contact)
- BeTrace: [GitHub Issues](https://github.com/betracehq/fluo)
