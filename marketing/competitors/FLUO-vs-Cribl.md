# FLUO vs Cribl: When to Use Each (And When to Use Both)

**Last Updated:** October 2025

---

## TL;DR

**Cribl**: Observability pipeline that routes, transforms, and optimizes telemetry data (logs, metrics, traces) between sources and destinations.

**FLUO**: Behavioral invariant detection system - code emits context via spans, FLUO DSL matches patterns, produces signals and metrics.

**When to use Cribl**: You need to route/transform observability data, reduce costs via sampling/filtering, or unify data across multiple tools.

**When to use FLUO**: You need pattern matching on contextual trace data with rule replay.

**When to use both**: Cribl routes/optimizes telemetry data, FLUO consumes traces for pattern matching and invariant detection.

---

## What is Cribl?

Cribl is an observability pipeline that unifies data processing across metrics, logs, and traces. It collects data from any source, transforms it, and routes it to any destination - reducing costs and vendor lock-in.

**Core capabilities:**
- **Data Routing**: Route data to multiple destinations (Datadog, Splunk, S3, Kafka)
- **Data Transformation**: Parse, enrich, redact, aggregate, sample data in-flight
- **Cost Optimization**: Filter, sample, aggregate to reduce data volume (30-50% savings)
- **Vendor Agnostic**: Works with 100+ sources/destinations (cloud, on-prem)

**Core workflow:**
```
Data sources → Cribl Stream → Transform/Route → Destinations (observability tools, data lakes)
```

**Value proposition**: Centralize data processing, reduce observability costs, avoid vendor lock-in, and route the right data to the right tool.

---

## What is FLUO?

FLUO is a behavioral invariant detection system. Code emits contextual data as OpenTelemetry spans, FLUO DSL defines pattern-matching rules, and FLUO engine produces signals and metrics when patterns match (or don't match).

**Core workflow:**
```
Code emits context (spans) → FLUO DSL (pattern matching) → Signals + Metrics
```

**Key capabilities:**
1. **Pattern Matching**: Match contextual span data against user-defined rules
2. **Rule Replay**: Retroactively apply rules to historical traces (seconds, not hours)
3. **Flexible Context**: Code defines what context to emit; rules define what patterns to detect

**Value proposition**: Define patterns once, detect violations instantly, and retroactively replay rules against historical traces without expensive reprocessing.

---

## Key Differences

| **Dimension** | **Cribl** | **FLUO** |
|--------------|----------|----------|
| **Primary Focus** | Data pipeline (routing, transformation) | Pattern matching (invariant detection) |
| **Data Flow Position** | Middle (between sources and destinations) | End (consumes traces) |
| **Action Type** | Transform/route data | Detect patterns in data |
| **Value Proposition** | Cost optimization, vendor flexibility | Behavioral validation, rule replay |
| **Rule Replay** | No (processes data forward) | **Yes** (key differentiator) |
| **Output** | Transformed/routed data | Signals (pattern violations) |

---

## When to Use Cribl

Use Cribl when you need:

### 1. Multi-Tool Observability (Avoid Vendor Lock-In)
You want to route data to multiple observability platforms without vendor lock-in.

**Example**: "Send all logs to Datadog, sampled traces to S3, security events to Splunk."

**Cribl workflow:**
1. Collect logs, metrics, traces from applications
2. Define routing rules:
   - All logs → Datadog
   - Sampled traces (10%) → S3 (long-term storage)
   - Security events (filter: `event.type=security`) → Splunk
3. Result: Data routed to 3 destinations (cost-optimized)

---

### 2. Cost Optimization via Sampling/Filtering
You want to reduce observability costs by filtering/sampling high-volume data.

**Example**: "Reduce Datadog costs by 40% via sampling + filtering."

**Cribl transformations:**
1. **Sample traces**: Keep 10% of traces (drop 90%)
2. **Filter logs**: Drop debug logs (keep error/warning)
3. **Aggregate metrics**: Roll up high-cardinality metrics
4. Result: 40% cost reduction, retain critical data

---

### 3. Data Enrichment and Normalization
You want to enrich/normalize data before sending to observability tools.

**Example**: "Add `region`, `environment` tags to all logs."

**Cribl pipeline:**
1. Collect logs from Kubernetes (no region/env tags)
2. Enrich: Add `region=us-east-1`, `environment=production`
3. Route: Send to Datadog (now queryable by region/env)

---

### 4. Legacy Tool Migration
You want to migrate from one observability tool to another without downtime.

**Example**: "Migrate from Splunk to Datadog over 6 months."

**Cribl migration:**
1. Month 1-3: Route 100% logs to Splunk, 10% to Datadog (parallel)
2. Month 4-5: Route 50% to Splunk, 50% to Datadog
3. Month 6: Route 100% to Datadog, decommission Splunk

---

## When to Use FLUO

Use FLUO when you need:

### 1. Pattern Matching on Contextual Trace Data
You want to detect patterns in trace attributes, not just route/transform data.

**Example**: "Detect when API calls skip authorization check."

**FLUO DSL:**
```javascript
// Signal: AUTHORIZATION_MISSING (critical)
trace.has(api.request)
  and not trace.has(auth.check)
```

**Why not Cribl?**
- Cribl: Routes/transforms data (pipeline)
- FLUO: Detects patterns in data (invariant validation)

---

### 2. Rule Replay on Historical Traces
You want to apply rules retroactively to historical data.

**Example**: Day 30 - discover new pattern violation. Replay rule against Days 1-29.

**FLUO workflow:**
1. Day 30: Define rule ("API retries should never exceed 3")
2. Rule replay: Apply to Days 1-29 traces (seconds)
3. Discovery: 67 historical violations

**Why not Cribl?**
- Cribl: Processes data forward (no replay)
- FLUO: Replays rules backward (analyze historical traces)

---

### 3. Cross-Span Pattern Matching
You want to validate relationships across multiple spans in a trace.

**Example**: "Database writes must follow transaction.begin span."

**FLUO DSL:**
```javascript
// Signal: TRANSACTION_MISSING (high)
trace.has(database.operation).where(operation == write)
  and not trace.has(transaction.begin)
```

**Why not Cribl?**
- Cribl: Transform individual events (stateless)
- FLUO: Match patterns across trace spans (stateful)

---

### 4. Continuous Behavioral Validation
You want rules to run continuously, validating expected behavior.

**Example**: "Free-tier users should never exceed 1000 API calls/day."

**FLUO DSL:**
```javascript
// Signal: RATE_LIMIT_EXCEEDED (medium)
trace.has(api.request).where(user.tier == free)
  and trace.has(api.request).where(daily_requests > 1000)
```

**Why not Cribl?**
- Cribl: Route/transform data (pipeline)
- FLUO: Validate behavior (always-on rules)

---

## When to Use Both (The Power Combo)

The most powerful scenario is using **Cribl for data routing** and **FLUO for pattern matching**.

### Scenario 1: Cost-Optimized Observability + Invariant Detection

**Cribl pipeline:**
- ✅ Sample traces at 10% for Datadog (cost savings)
- ✅ Send 100% traces to S3 (long-term storage)
- ✅ Filter out noisy debug logs

**FLUO consumes:**
- ✅ Reads traces from S3 (or direct from app)
- ✅ Validates 100% traces for invariant violations
- ✅ Emits signals when patterns violated

**Architecture:**
```
Application → Cribl Stream
                ├── 10% traces → Datadog (real-time monitoring)
                ├── 100% traces → S3 (long-term storage)
                └── 100% traces → FLUO (invariant detection)
```

**Result**:
- Cribl: Reduce Datadog costs by 90% (sample 10%)
- FLUO: Validate 100% traces for invariants (full coverage)

---

### Scenario 2: Multi-Region Data Routing + Cross-Region Validation

**Cribl routing:**
- ✅ Route US logs to US Datadog instance
- ✅ Route EU logs to EU Datadog instance
- ✅ Route security events to centralized SIEM

**FLUO validation:**
- ✅ Detect cross-region data access (GDPR compliance)
- ✅ Validate region-specific invariants

**FLUO DSL:**
```javascript
// Signal: CROSS_REGION_ACCESS (high)
trace.has(database.query).where(user.region == EU)
  and trace.has(database.query).where(database.region == US)

// Signal: EU_RETENTION_VIOLATION (critical)
trace.has(data.access).where(region == EU)
  and trace.has(data.access).where(age_days > 730)
```

**Result**:
- Cribl: Route data to region-specific tools
- FLUO: Validate regional compliance (GDPR)

---

### Scenario 3: Legacy Tool Migration + Behavioral Validation

**Cribl migration:**
- ✅ Month 1-3: 100% to Splunk, 10% to Datadog
- ✅ Month 4-5: 50% to Splunk, 50% to Datadog
- ✅ Month 6: 100% to Datadog

**FLUO validation (continuous):**
- ✅ Validate invariants during migration
- ✅ Ensure no behavioral changes during tool switch

**FLUO DSL:**
```javascript
// Signal: AUTHORIZATION_MISSING (critical)
trace.has(api.request)
  and not trace.has(auth.check)
```

**Result**:
- Cribl: Smooth migration (no downtime)
- FLUO: Continuous validation (ensure no regressions)

---

### Scenario 4: Data Enrichment + Pattern Matching

**Cribl enrichment:**
- ✅ Add `tenant.id`, `region`, `environment` to all traces
- ✅ Normalize trace formats (OpenTelemetry)

**FLUO pattern matching:**
- ✅ Use enriched attributes in rules
- ✅ Validate tenant isolation (enriched `tenant.id`)

**FLUO DSL:**
```javascript
// Signal: TENANT_ISOLATION_VIOLATION (critical)
trace.has(database.query).where(tenant.id == tenant-A)
  and trace.has(database.query).where(table matches ".*tenant_b_data.*")
```

**Result**:
- Cribl: Enrich traces (add missing context)
- FLUO: Use enriched context for pattern matching

---

## Architecture: How They Integrate

```
┌─────────────────────────────────────────────────────────┐
│              Your Applications (Instrumented)            │
│  - OpenTelemetry SDK (logs, metrics, traces)            │
└────────────┬────────────────────────────────────────────┘
             │ (OTel data)
             ▼
     ┌───────────────┐
     │  Cribl Stream │
     │  (Pipeline)   │
     └───────┬───────┘
             │
             ├── 10% traces → Datadog (real-time monitoring)
             ├── 100% traces → S3 (long-term storage)
             └── 100% traces → FLUO (invariant detection)
                                     │
                                     ▼
                             ┌───────────────┐
                             │     FLUO      │
                             │  (Patterns)   │
                             └───────┬───────┘
                                     │ Signals
                                     ▼
                             ┌───────────────┐
                             │  Operations   │
                             │     Team      │
                             └───────────────┘
```

**Data flow:**
1. **Applications** emit OpenTelemetry data
2. **Cribl Stream** routes/transforms:
   - Sample 10% to Datadog (cost optimization)
   - Send 100% to S3 (long-term storage)
   - Send 100% to FLUO (or FLUO reads from S3)
3. **FLUO** matches patterns, emits signals
4. **Operations team** uses:
   - Datadog: Real-time monitoring (dashboards, alerts)
   - FLUO: Invariant validation (pattern violations)

---

## Cost Comparison

| **Dimension** | **Cribl** | **FLUO** |
|--------------|----------|----------|
| **Pricing Model** | Per-GB processed (data volume) | Per-trace volume |
| **Typical Cost** | $0.10-$0.30/GB processed | Custom pricing |
| **ROI Metric** | Observability cost savings (30-50%) | Violations detected |
| **Hidden Costs** | Integration setup, pipeline design | OpenTelemetry instrumentation |

**When cost matters:**
- **Cribl**: Pays for itself via savings (filter/sample data)
- **FLUO**: Cost scales with trace volume

**Combined ROI**:
- Cribl: Reduce observability costs by 30-50%
- FLUO: Detect violations (prevent incidents)
- **Together**: Cost optimization + behavioral validation

---

## Migration Paths

### Path 1: Cribl → Cribl + FLUO
**Scenario**: You have Cribl for data routing, want invariant detection.

**Steps**:
1. Keep Cribl for routing/transformation
2. Route 100% traces to FLUO (or FLUO reads from S3)
3. Define FLUO DSL rules for invariants (1 week)
4. Use both: Cribl (routing) + FLUO (validation)

**Result**: Data pipeline + invariant detection.

---

### Path 2: FLUO → FLUO + Cribl
**Scenario**: You have FLUO for invariants, want cost optimization.

**Steps**:
1. Keep FLUO for pattern matching
2. Add Cribl pipeline (route/sample data)
3. Send 100% traces to FLUO (retain full coverage)
4. Use Cribl to reduce costs for other tools (Datadog, Splunk)

**Result**: Invariant detection + cost optimization.

---

## Summary

| **Question** | **Answer** |
|-------------|-----------|
| **Need to route data to multiple tools?** | Use Cribl (observability pipeline) |
| **Need to reduce observability costs (sampling, filtering)?** | Use Cribl (cost optimization) |
| **Need to enrich/normalize data in-flight?** | Use Cribl (data transformation) |
| **Need pattern matching on trace data?** | Use FLUO (invariant detection) |
| **Need rule replay on historical traces?** | Use FLUO (key differentiator) |
| **Need continuous behavioral validation?** | Use FLUO (always-on rules) |
| **Want cost optimization + validation?** | Use both (Cribl + FLUO) |

**The power combo**: Cribl routes/optimizes telemetry data (reduce costs, avoid lock-in), FLUO validates behavioral patterns (detect invariant violations).

---

## Next Steps

**Exploring Cribl?**
- [Cribl Stream](https://cribl.io)
- [Observability Pipeline Guide](https://cribl.io/blog/the-observability-pipeline/)

**Exploring FLUO?**
- [FLUO DSL Documentation](../../docs/technical/trace-rules-dsl.md)
- [OpenTelemetry Integration](../../backend/docs/AI_AGENT_MONITORING_GUIDE.md)

**Questions?**
- Cribl: [Contact Sales](https://cribl.io/contact/)
- FLUO: [GitHub Issues](https://github.com/fluohq/fluo)
