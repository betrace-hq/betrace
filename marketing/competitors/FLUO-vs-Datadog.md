# BeTrace vs Datadog: When to Use Each (And When to Use Both)

**Last Updated:** October 2025

---

## TL;DR

**Datadog**: Full-stack observability platform (metrics, logs, traces, APM) with dashboards, alerts, and 700+ integrations.

**BeTrace**: Behavioral invariant detection system - code emits context via spans, BeTrace DSL matches patterns, produces signals and metrics.

**When to use Datadog**: You need comprehensive monitoring, dashboards, alerting, and out-of-the-box integrations for infrastructure and applications.

**When to use BeTrace**: You need pattern matching on contextual trace data and rule replay against historical traces.

**When to use both**: Datadog monitors known metrics (CPU, latency, errors), BeTrace detects behavioral invariants in contextual span data.

---

## What is Datadog?

Datadog is a full-stack observability platform that provides unified monitoring for infrastructure, applications, logs, and security across cloud and on-premise environments.

**Core capabilities:**
- **APM**: Application Performance Monitoring with distributed tracing
- **Infrastructure Monitoring**: Servers, containers, databases, networks
- **Log Management**: Centralized logging with search and analytics
- **Security Monitoring**: Cloud SIEM, threat detection, compliance
- **Synthetic Monitoring**: Proactive uptime and API testing

**Core workflow:**
```
Datadog agents → Collect metrics/logs/traces → Dashboards + Alerts
```

**Value proposition**: Single pane of glass for all observability data with pre-built dashboards, integrations, and AI-powered anomaly detection.

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

| **Dimension** | **Datadog** | **BeTrace** |
|--------------|----------|----------|
| **Primary Focus** | Monitoring (metrics, logs, traces) | Pattern matching (behavioral invariants) |
| **Data Model** | Pre-defined metrics + unstructured logs | Contextual span attributes |
| **Detection Method** | Threshold alerts + ML anomalies | Pattern matching via DSL rules |
| **Rule Replay** | No (alerts only trigger forward) | **Yes** (key differentiator) |
| **Dashboard Focus** | Visualization (graphs, charts) | Signals (pattern violations) |
| **Integration Effort** | Agent installation + config | OpenTelemetry instrumentation |
| **Pricing** | Per-host + data volume | Per-trace volume |

---

## When to Use Datadog

Use Datadog when you need:

### 1. Full-Stack Monitoring at Scale
You want metrics, logs, and traces in one platform with pre-built dashboards for 700+ integrations.

**Example**: "Monitor CPU, memory, network across 500 hosts + Kubernetes clusters."

**Datadog workflow:**
1. Install Datadog agent on hosts
2. Enable APM for applications
3. View pre-built dashboards (EC2, RDS, Kubernetes)
4. Set threshold alerts (CPU > 80%)

---

### 2. Out-of-the-Box Dashboards
You want instant visibility without custom instrumentation.

**Example**: "Show me Postgres query performance without writing custom queries."

**Datadog integration:**
- Postgres integration → automatic metrics collection
- Dashboard: queries/sec, slow queries, connection pool
- Alert: query latency > 500ms

---

### 3. Anomaly Detection with AI
You want ML-powered anomaly detection on time-series metrics.

**Example**: "Detect unusual spikes in API latency without manual thresholds."

**Datadog workflow:**
1. Enable anomaly detection on `api.latency` metric
2. Datadog learns baseline (7-day rolling window)
3. Alert when latency deviates > 2 standard deviations

---

### 4. Security and Compliance Monitoring
You need Cloud SIEM, threat detection, and compliance dashboards.

**Example**: "Detect suspicious login attempts, track AWS CloudTrail logs."

**Datadog Cloud SIEM:**
- Ingest CloudTrail, VPC Flow Logs, auth logs
- Pre-built detection rules (MITRE ATT&CK)
- Compliance dashboards (PCI-DSS, HIPAA)

---

## When to Use BeTrace

Use BeTrace when you need:

### 1. Pattern Matching on Contextual Data
You want to detect patterns in **contextual span attributes**, not just metrics or log strings.

**Example**: "Detect when API calls to `/admin` happen without prior MFA authentication."

**BeTrace workflow:**
1. Code emits spans with context:
   - `span.setAttribute("endpoint", "/admin")`
   - `span.setAttribute("auth.mfa_verified", true)`
2. Define BeTrace DSL rule:
```javascript
// Signal: MFA_VIOLATION (critical)
trace.has(api.request).where(endpoint == "/admin")
  and not trace.has(auth.mfa_verified)
```
3. BeTrace engine matches pattern → emits signal

**Why not Datadog?**
- Datadog alerts on metrics (threshold-based)
- BeTrace matches on contextual relationships in traces

---

### 2. Rule Replay on Historical Traces
You want to apply rules retroactively to historical data **without reprocessing**.

**Example**: Day 30 - discover new pattern violation. Replay rule against Days 1-29 to find historical occurrences.

**BeTrace workflow:**
1. Day 30: Define new rule (e.g., "API key should never be in query params")
2. Rule replay: Apply to Days 1-29 traces (seconds)
3. Discovery: 47 historical violations

**Cost comparison:**
- Traditional reprocessing: Re-run logs through pipeline ($$$, hours/days)
- BeTrace replay: Query pre-indexed traces (seconds, negligible cost)

**Why not Datadog?**
- Datadog alerts only trigger forward (from creation time)
- No retroactive pattern matching on historical traces

---

### 3. Custom Behavioral Invariants
You want flexible, user-defined patterns that don't fit pre-built monitoring.

**Example**: "Database writes should always follow a `transaction.begin` span."

**BeTrace DSL:**
```javascript
// Signal: TRANSACTION_INVARIANT_VIOLATION (high)
trace.has(database.operation).where(operation == write)
  and not trace.has(transaction.begin)
```

**Why not Datadog?**
- Datadog APM traces show span relationships (flamegraphs)
- BeTrace **validates** span relationships against rules

---

### 4. Discovering Unknown Patterns
You want to define "what should never happen" and detect violations.

**Example**: "We assumed authentication always precedes data access. Validate this assumption."

**BeTrace workflow:**
1. Define invariant as BeTrace DSL rule
2. Run against production traces
3. Discovery: 3 violations (bugs in authentication middleware)

**Why not Datadog?**
- Datadog excels at monitoring **known metrics**
- BeTrace excels at validating **assumed invariants**

---

## When to Use Both (The Power Combo)

The most powerful scenario is using **Datadog for monitoring** and **BeTrace for behavioral validation**.

### Scenario 1: E-Commerce Checkout Flow

**Datadog monitors:**
- ✅ Checkout API latency (p95, p99)
- ✅ Payment gateway errors (count)
- ✅ Database connection pool usage

**BeTrace validates:**
- ✅ Every `payment.charge` span follows `cart.validate` + `inventory.reserve`
- ✅ No checkout completes without `fraud.check` span
- ✅ Payment retries never exceed 3 attempts

**BeTrace DSL:**
```javascript
// Signal: CHECKOUT_INVARIANT_VIOLATION (critical)
trace.has(payment.charge)
  and not (trace.has(cart.validate) and trace.has(inventory.reserve))

// Signal: FRAUD_CHECK_MISSING (critical)
trace.has(checkout.complete)
  and not trace.has(fraud.check)
```

**Result**:
- Datadog: Monitor latency, errors (what's slow/broken)
- BeTrace: Validate business logic (what violated expected flow)

---

### Scenario 2: Incident Investigation

**Day 1-29**: Normal operations. Datadog monitors latency, errors.

**Day 30**: Incident - unexpected 500 errors on API.

**Datadog analysis:**
- Dashboard shows error spike at 2:47 PM
- Logs show "Database connection timeout"
- Traces show slow database queries

**BeTrace analysis:**
1. Define hypothesis as rule: "API calls with > 5 retries should not happen"
2. Replay rule against Days 1-29
3. Discovery: 120 historical occurrences (pattern exists for weeks)

**BeTrace DSL:**
```javascript
// Signal: EXCESSIVE_RETRIES (high)
trace.has(api.request).where(retries > 5)
```

**Result**:
- Datadog: Identify **when/where** incident happened
- BeTrace: Discover **pattern existed historically** via replay

---

### Scenario 3: Multi-Tenant SaaS

**Datadog monitors:**
- ✅ API requests per tenant (dashboard)
- ✅ Database queries per tenant (metrics)
- ✅ Rate limit violations (alert)

**BeTrace validates:**
- ✅ Tenant A never accesses Tenant B data (cross-tenant isolation)
- ✅ Admin actions always include `audit.log` span
- ✅ Free-tier tenants never exceed 1000 requests/day

**BeTrace DSL:**
```javascript
// Signal: TENANT_ISOLATION_VIOLATION (critical)
trace.has(database.query).where(tenant.id == tenant-A)
  and trace.has(database.query).where(table == tenant_b_data)

// Signal: RATE_LIMIT_VIOLATION (medium)
trace.has(api.request).where(tenant.tier == free)
  and trace.has(api.request).where(daily_requests > 1000)
```

**Result**:
- Datadog: Monitor tenant resource usage (metrics)
- BeTrace: Validate tenant isolation invariants (patterns)

---

## Architecture: How They Integrate

```
┌─────────────────────────────────────────────────────────┐
│              Your Applications (Instrumented)            │
│  - Datadog APM agent (metrics, traces, logs)            │
│  - OpenTelemetry SDK (contextual span attributes)       │
└────────────┬─────────────────────────────────┬──────────┘
             │                                  │
             │ (metrics, logs, traces)         │ (OTel traces)
             ▼                                  ▼
     ┌───────────────┐                  ┌───────────────┐
     │    Datadog    │                  │     BeTrace      │
     │  (Monitoring) │                  │  (Invariants) │
     └───────┬───────┘                  └───────┬───────┘
             │                                  │
             │ Dashboards + Alerts              │ Signals
             ▼                                  ▼
     ┌────────────────────────────────────────────────┐
     │            Operations Team                     │
     │  - Datadog: "What's slow/broken?"              │
     │  - BeTrace: "What violated expected patterns?"    │
     └────────────────────────────────────────────────┘
```

**Data flow:**
1. **Application code** emits:
   - Datadog APM: Metrics, logs, APM traces
   - OpenTelemetry: Contextual span attributes
2. **Datadog** monitors: Latency, errors, resource usage
3. **BeTrace** validates: Pattern matching on span context
4. **Operations team** uses both:
   - Datadog: "API latency spiked at 2:47 PM"
   - BeTrace: "23 traces violated MFA invariant"

---

## Cost Comparison

| **Dimension** | **Datadog** | **BeTrace** |
|--------------|----------|----------|
| **Pricing Model** | Per-host + APM spans + logs | Per-trace volume |
| **Typical Cost** | $15-100/host/month + data | Custom pricing |
| **Hidden Costs** | Data retention ($$$), custom metrics | OpenTelemetry instrumentation |
| **Cost Optimization** | Sampling, log filtering | Span attribute pruning |

**When cost matters:**
- **Datadog**: Cost scales with hosts + data volume (can get expensive at scale)
- **BeTrace**: Cost scales with trace volume (optimize by controlling span cardinality)

**Combined approach:**
- Datadog: Monitor critical metrics (sample traces at 10%)
- BeTrace: Validate invariants (100% traces with relevant context)

---

## Migration Paths

### Path 1: Datadog → Datadog + BeTrace
**Scenario**: You have Datadog for monitoring, want pattern validation + rule replay.

**Steps**:
1. Keep Datadog for metrics, logs, dashboards
2. Add OpenTelemetry SDK for contextual span attributes (1-2 weeks)
3. Define BeTrace DSL rules for invariants (1 week)
4. Replay rules against historical Datadog traces (if stored)

**Result**: Full monitoring + behavioral invariant validation.

---

### Path 2: BeTrace → BeTrace + Datadog
**Scenario**: You have BeTrace for invariants, want full-stack monitoring.

**Steps**:
1. Install Datadog agents for infrastructure monitoring
2. Enable Datadog APM for dashboards/alerts
3. Keep BeTrace for pattern matching on contextual data
4. Use both: Datadog (monitoring) + BeTrace (validation)

**Result**: Monitoring + invariant detection.

---

## Summary

| **Question** | **Answer** |
|-------------|-----------|
| **Need dashboards, alerts, infrastructure monitoring?** | Use Datadog |
| **Need pattern matching on contextual span data?** | Use BeTrace |
| **Need rule replay on historical traces?** | Use BeTrace (key differentiator) |
| **Need out-of-the-box integrations (700+)?** | Use Datadog |
| **Need to validate behavioral invariants?** | Use BeTrace |
| **Want monitoring + validation?** | Use both (Datadog + BeTrace) |

**The power combo**: Datadog monitors known metrics (latency, errors, resources), BeTrace validates behavioral patterns (invariants in contextual data).

---

## Next Steps

**Exploring Datadog?**
- [Datadog Free Trial](https://www.datadoghq.com)
- [APM Documentation](https://docs.datadoghq.com/tracing/)

**Exploring BeTrace?**
- [BeTrace DSL Documentation](../../docs/technical/trace-rules-dsl.md)
- [OpenTelemetry Integration](../../backend/docs/AI_AGENT_MONITORING_GUIDE.md)

**Questions?**
- Datadog: [Contact Sales](https://www.datadoghq.com/contact/)
- BeTrace: [GitHub Issues](https://github.com/betracehq/fluo)
