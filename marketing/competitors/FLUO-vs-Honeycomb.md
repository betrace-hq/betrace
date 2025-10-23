# BeTrace vs Honeycomb: When to Use Each (And When to Use Both)

**Last Updated:** October 2025

---

## TL;DR

**Honeycomb**: High-cardinality observability platform for exploring traces, events, and logs with powerful querying (BubbleUp, Trace Waterfall).

**BeTrace**: Behavioral invariant detection system - code emits context via spans, BeTrace DSL matches patterns, produces signals and metrics.

**When to use Honeycomb**: You need high-cardinality exploration, asking "why is this slow?" or "what's different about these traces?"

**When to use BeTrace**: You need pattern matching on contextual trace data and rule replay against historical traces.

**When to use both**: Honeycomb explores anomalies ("what's different?"), BeTrace validates invariants ("did this pattern occur?").

---

## What is Honeycomb?

Honeycomb is a high-cardinality observability platform built for exploring complex systems through distributed tracing, events, and logs. It excels at answering questions like "why is this request slow?" or "what changed between deployments?"

**Core capabilities:**
- **BubbleUp**: Automatically finds characteristics of slow/error traces
- **Trace Waterfall**: Visualize distributed request flow across services
- **High-Cardinality Queries**: Group by any attribute (user_id, endpoint, region)
- **Query Builder**: Drag-and-drop interface for ad-hoc exploration

**Core workflow:**
```
Instrumented code → Honeycomb (events/traces) → Query + Explore → Root cause discovery
```

**Value proposition**: Explore production systems interactively without pre-defined dashboards - ask questions, get answers from high-cardinality data.

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

| **Dimension** | **Honeycomb** | **BeTrace** |
|--------------|----------|----------|
| **Primary Focus** | Exploration (interactive queries) | Pattern matching (rule-based detection) |
| **User Interaction** | Manual (ask questions via UI) | Automated (rules always-on) |
| **Detection Method** | BubbleUp, manual filtering | BeTrace DSL pattern matching |
| **Rule Replay** | Manual re-query | **Yes** (automated replay) |
| **Output** | Query results, visualizations | Signals (pattern violations) |
| **Use Case** | "Why is this slow?" (debugging) | "Did this happen?" (validation) |

---

## When to Use Honeycomb

Use Honeycomb when you need:

### 1. Interactive Exploration of Production Issues
You want to ask questions about production behavior without knowing the answer upfront.

**Example**: "Why is checkout slow for users in EU region?"

**Honeycomb workflow:**
1. Filter traces: `endpoint=/checkout AND latency > 1000ms AND region=EU`
2. BubbleUp analysis: Identifies `payment_gateway=stripe-eu` in slow traces
3. Drill down: View trace waterfall, find slow span (3rd-party API)

**Why not BeTrace?**
- Honeycomb excels at ad-hoc exploration (manual queries)
- BeTrace excels at automated pattern detection (pre-defined rules)

---

### 2. Comparing Good vs Bad Traces
You want to find "what's different" between working and broken requests.

**Example**: "Why do 5% of API calls return 500 errors?"

**Honeycomb workflow:**
1. Query: `status_code=500` vs `status_code=200`
2. BubbleUp: Highlights `database_connection_pool=exhausted` in error traces
3. Root cause: Connection pool too small for load spikes

**Why not BeTrace?**
- Honeycomb's BubbleUp automatically finds differences
- BeTrace requires you to define patterns as rules

---

### 3. High-Cardinality Grouping
You want to group traces by attributes with thousands of values (user IDs, endpoints, IPs).

**Example**: "Which users experience the most timeouts?"

**Honeycomb query:**
```
BREAKDOWN(user_id)
WHERE error_type=timeout
ORDER BY COUNT DESC
LIMIT 10
```

**Result**: Top 10 users with timeouts (e.g., user `abc123` has 47 timeouts).

**Why not BeTrace?**
- Honeycomb optimized for high-cardinality grouping
- BeTrace focuses on pattern matching (not aggregation)

---

### 4. Root Cause Analysis with Trace Waterfall
You want to visualize request flow across microservices to find bottlenecks.

**Example**: "Which service is causing 3-second latency in checkout?"

**Honeycomb trace waterfall:**
- Frontend: 50ms
- API Gateway: 20ms
- **Order Service: 2,800ms** (bottleneck!)
  - Database query: 2,750ms (slow query identified)

**Why not BeTrace?**
- Honeycomb visualizes trace structure (flamegraphs, waterfall)
- BeTrace validates trace structure (pattern matching)

---

## When to Use BeTrace

Use BeTrace when you need:

### 1. Automated Pattern Detection (Always-On)
You want rules to continuously validate expected behavior without manual queries.

**Example**: "Every checkout must include `fraud.check` span."

**BeTrace DSL:**
```javascript
// Signal: FRAUD_CHECK_MISSING (critical)
trace.has(checkout.complete)
  and not trace.has(fraud.check)
```

**BeTrace workflow:**
1. Define rule once
2. BeTrace engine runs continuously
3. Signal emitted when pattern violated

**Why not Honeycomb?**
- Honeycomb requires manual queries (reactive)
- BeTrace runs rules automatically (proactive)

---

### 2. Rule Replay on Historical Traces
You want to apply rules retroactively to historical data **without re-querying manually**.

**Example**: Day 30 - discover new pattern violation. Replay rule against Days 1-29.

**BeTrace workflow:**
1. Day 30: Define rule ("API key should never be in query params")
2. Rule replay: Apply to Days 1-29 traces (seconds)
3. Discovery: 52 historical violations

**Cost comparison:**
- Honeycomb manual re-query: Run same query 29 times (manual)
- BeTrace replay: Automated replay across historical traces (seconds)

**Why not Honeycomb?**
- Honeycomb: Manual re-query for each time range
- BeTrace: Automated replay with single rule definition

---

### 3. Complex Multi-Span Pattern Matching
You want to validate relationships across multiple spans in a trace.

**Example**: "Database writes must always follow `transaction.begin` span."

**BeTrace DSL:**
```javascript
// Signal: TRANSACTION_INVARIANT_VIOLATION (high)
trace.has(database.operation).where(operation == write)
  and not trace.has(transaction.begin)
```

**Why not Honeycomb?**
- Honeycomb: Query can filter spans, but requires manual query construction
- BeTrace: Rule always-on, automatically detects violations

---

### 4. Validation of Expected Patterns
You want to assert "this should never happen" and get alerted when it does.

**Example**: "Cross-tenant data access should never occur."

**BeTrace DSL:**
```javascript
// Signal: TENANT_ISOLATION_VIOLATION (critical)
trace.has(database.query).where(tenant.id == tenant-A)
  and trace.has(database.query).where(table matches ".*tenant_b_data.*")
```

**Why not Honeycomb?**
- Honeycomb: Great for exploration ("did cross-tenant access happen?")
- BeTrace: Great for validation ("alert me if it ever happens")

---

## When to Use Both (The Power Combo)

The most powerful scenario is using **Honeycomb for exploration** and **BeTrace for validation**.

### Scenario 1: Payment Gateway Integration

**Honeycomb explores:**
- "Why are payment failures up 20%?"
- Query: `payment.status=failed`, BubbleUp → finds `gateway=stripe` failures
- Drill down: Trace waterfall shows 3rd-party timeout

**BeTrace validates:**
- "Payment retries should never exceed 3 attempts"
- BeTrace DSL:
```javascript
// Signal: PAYMENT_RETRY_VIOLATION (high)
trace.has(payment.charge).where(retries > 3)
```

**Result**:
- Honeycomb: Debug **why** failures happen (ad-hoc investigation)
- BeTrace: Validate **expected behavior** (automated detection)

---

### Scenario 2: Feature Rollout Validation

**Day 1**: Deploy new feature (A/B test: 10% traffic).

**Honeycomb explores:**
- "Are users in treatment group experiencing errors?"
- Query: `experiment.group=treatment AND error=true`
- BubbleUp: No significant differences found

**BeTrace validates:**
- "Treatment group requests must include `experiment.variant` span"
- BeTrace DSL:
```javascript
// Signal: EXPERIMENT_TRACKING_MISSING (medium)
trace.has(experiment.group).where(group == treatment)
  and not trace.has(experiment.variant)
```

**Result**:
- Honeycomb: Explore impact of feature (manual analysis)
- BeTrace: Validate instrumentation complete (automated)

---

### Scenario 3: Multi-Tenant SaaS Investigation

**Incident**: User reports "can see other tenant's data."

**Honeycomb investigation:**
1. Query: `user_id=abc123 AND tenant_id=tenant-A`
2. Drill down: Find trace with `database.table=tenant_b_data` (cross-tenant access!)
3. Root cause: Missing tenant filter in query

**BeTrace replay:**
1. Define rule: "Tenant A should never access Tenant B data"
2. Replay rule against last 30 days
3. Discovery: 8 historical occurrences (same bug, different users)

**BeTrace DSL:**
```javascript
// Signal: TENANT_ISOLATION_VIOLATION (critical)
trace.has(database.query).where(tenant.id == tenant-A)
  and trace.has(database.query).where(table == tenant_b_data)
```

**Result**:
- Honeycomb: Debug current incident (manual exploration)
- BeTrace: Find historical violations via replay (automated)

---

## Architecture: How They Integrate

```
┌─────────────────────────────────────────────────────────┐
│              Your Applications (Instrumented)            │
│  - OpenTelemetry SDK (traces with contextual attributes) │
└────────────┬─────────────────────────────────┬──────────┘
             │                                  │
             │ (OTel traces)                   │ (OTel traces)
             ▼                                  ▼
     ┌───────────────┐                  ┌───────────────┐
     │   Honeycomb   │                  │     BeTrace      │
     │  (Exploration)│                  │  (Validation) │
     └───────┬───────┘                  └───────┬───────┘
             │                                  │
             │ Query results                    │ Signals
             ▼                                  ▼
     ┌────────────────────────────────────────────────┐
     │            Operations Team                     │
     │  - Honeycomb: "Why is this happening?"         │
     │  - BeTrace: "Did this pattern occur?"             │
     └────────────────────────────────────────────────┘
```

**Data flow:**
1. **Application code** emits OpenTelemetry traces with contextual attributes
2. **Honeycomb** stores traces for interactive exploration
3. **BeTrace** stores traces for pattern matching via rules
4. **Operations team** uses both:
   - Honeycomb: Ad-hoc debugging ("why is checkout slow?")
   - BeTrace: Automated validation ("did cross-tenant access happen?")

---

## Cost Comparison

| **Dimension** | **Honeycomb** | **BeTrace** |
|--------------|----------|----------|
| **Pricing Model** | Per-event pricing (volume-based) | Per-trace volume |
| **Typical Cost** | $0.50-$2 per million events | Custom pricing |
| **Data Retention** | 60 days (standard), longer ($$) | Configurable |
| **Cost Optimization** | Sampling, dropping high-volume events | Span attribute pruning |

**When cost matters:**
- **Honeycomb**: Cost scales with event volume (sample aggressively at scale)
- **BeTrace**: Cost scales with trace volume (optimize by controlling span attributes)

**Combined approach:**
- Honeycomb: Sample traces at 10% for exploration (reduce cost)
- BeTrace: 100% traces for pattern validation (critical patterns always captured)

---

## Migration Paths

### Path 1: Honeycomb → Honeycomb + BeTrace
**Scenario**: You have Honeycomb for exploration, want automated validation + rule replay.

**Steps**:
1. Keep Honeycomb for interactive queries/debugging
2. Export OpenTelemetry traces to BeTrace (parallel ingestion)
3. Define BeTrace DSL rules for invariants (1 week)
4. Replay rules against historical Honeycomb data (if stored)

**Result**: Exploration + automated validation.

---

### Path 2: BeTrace → BeTrace + Honeycomb
**Scenario**: You have BeTrace for invariants, want interactive exploration.

**Steps**:
1. Export OpenTelemetry traces to Honeycomb (parallel ingestion)
2. Use Honeycomb for ad-hoc debugging (BubbleUp, trace waterfall)
3. Keep BeTrace for automated pattern matching
4. Use both: Honeycomb (explore) + BeTrace (validate)

**Result**: Validation + exploration.

---

## Summary

| **Question** | **Answer** |
|-------------|-----------|
| **Need to ask "why is this slow?"** | Use Honeycomb (interactive exploration) |
| **Need to validate "did this happen?"** | Use BeTrace (automated pattern matching) |
| **Need BubbleUp to find anomalies?** | Use Honeycomb |
| **Need rule replay on historical traces?** | Use BeTrace (key differentiator) |
| **Need trace waterfall visualization?** | Use Honeycomb |
| **Need always-on pattern validation?** | Use BeTrace |
| **Want exploration + validation?** | Use both (Honeycomb + BeTrace) |

**The power combo**: Honeycomb explores "what's different?" (ad-hoc), BeTrace validates "did this pattern occur?" (automated).

---

## Next Steps

**Exploring Honeycomb?**
- [Honeycomb Free Trial](https://www.honeycomb.io)
- [BubbleUp Documentation](https://docs.honeycomb.io/working-with-your-data/bubbleup/)

**Exploring BeTrace?**
- [BeTrace DSL Documentation](../../docs/technical/trace-rules-dsl.md)
- [OpenTelemetry Integration](../../backend/docs/AI_AGENT_MONITORING_GUIDE.md)

**Questions?**
- Honeycomb: [Contact Sales](https://www.honeycomb.io/contact)
- BeTrace: [GitHub Issues](https://github.com/betracehq/fluo)
