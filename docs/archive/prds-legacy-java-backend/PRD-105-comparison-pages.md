# PRD-105: Comparison Pages

**Status:** DRAFT
**Priority:** P1 (Positioning & Lead Qualification)
**Created:** 2025-10-12
**Estimated Effort:** 1 week

## Context

**Positioning confusion is a major blocker for BeTrace:**
- "Is this like Datadog?" (No, BeTrace is not APM)
- "Is this a SIEM replacement?" (No, BeTrace is not for security incidents)
- "Why not just use Grafana?" (Grafana shows traces, BeTrace matches patterns)

Comparison pages solve this by:
1. Clarifying what BeTrace is (and is NOT)
2. Helping prospects self-qualify ("BeTrace is right for me if...")
3. Reducing sales objections ("BeTrace complements APM, doesn't replace it")
4. SEO value ("BeTrace vs Datadog," "observability vs behavioral assurance")

## Problem Statement

Without comparison pages, prospects:
1. Misunderstand BeTrace's positioning → unqualified leads
2. Try to force BeTrace into wrong use case → poor trial experience
3. See BeTrace as competitor to existing tools → resistance from ops team
4. Don't know when to use BeTrace → "interesting but not now"

**Result:** Low trial activation, positioning confusion, objection handling burden on sales.

## Goals

### Primary Goals
1. **Clear Differentiation**: Explain BeTrace vs APM, SIEM, Observability platforms
2. **Complementary Positioning**: "BeTrace works WITH your existing tools"
3. **Self-Qualification**: Help prospects decide if BeTrace fits their needs
4. **SEO Ranking**: Top 10 for "behavioral assurance vs observability," "BeTrace vs Datadog"

### Success Metrics
- Comparison page views: >15% of landing page traffic
- Bounce rate: <35% (users find answers)
- Comparison-to-trial conversion: >12%
- Sales objection reduction: 30% fewer "how is this different from X?" questions

## Proposed Solution

### Comparison Pages to Create

#### 1. BeTrace vs. Traditional Observability (Datadog, New Relic, Dynatrace)
#### 2. BeTrace vs. SIEM (Splunk, Elastic Security, Chronicle)
#### 3. BeTrace vs. Distributed Tracing (Jaeger, Tempo, Lightstep)
#### 4. BeTrace vs. Log Analysis (Grafana Loki, Elasticsearch)
#### 5. When to Use BeTrace (Decision Framework)

---

## Comparison Page #1: BeTrace vs. Traditional Observability

**URL:** `/compare/fluo-vs-apm`
**Target Keywords:** "behavioral assurance vs APM," "BeTrace vs Datadog"

### Page Structure

#### Hero Section
```markdown
# BeTrace vs. Traditional APM (Datadog, New Relic, Dynatrace)

**TL;DR:** APM monitors system health. BeTrace enforces behavioral patterns.

Use APM for: Metrics, dashboards, error rates, latency
Use BeTrace for: Pattern violations, invariant discovery, compliance evidence

**Best Together:** BeTrace ingests OpenTelemetry traces → generates signals → alerts to APM
```

#### Comparison Table

| Feature | Traditional APM | BeTrace |
|---------|----------------|------|
| **Core Purpose** | Monitor system performance and errors | Detect behavioral pattern violations |
| **Data Source** | Metrics, logs, traces | OpenTelemetry traces only |
| **Alerting Model** | Threshold-based (CPU > 80%, error rate > 5%) | Pattern-based (auth missing before data access) |
| **Use Case** | "Is my service slow/broken?" | "Are my services behaving correctly?" |
| **Examples** | CPU spike, high latency, 500 errors | PII accessed without audit log, auth bypassed |
| **Dashboards** | Pre-built (service maps, infra metrics) | Custom rules and signals |
| **Compliance** | General audit logs | Cryptographically-signed compliance spans |
| **Integration** | Replace existing monitoring | Augment existing monitoring |

#### When to Use Each

**Use APM When:**
- ✅ You need real-time metrics (CPU, memory, latency)
- ✅ You want pre-built dashboards for infrastructure
- ✅ You need error tracking with stack traces
- ✅ You want service dependency mapping

**Use BeTrace When:**
- ✅ You have undocumented behavioral invariants causing incidents
- ✅ You need to enforce service contracts (e.g., "always auth before data")
- ✅ You want compliance evidence from production traces
- ✅ You need pattern detection APM can't handle

**Use Both When:**
- ✅ APM alerts on symptoms (high error rate) → BeTrace shows root cause (pattern violation)
- ✅ BeTrace generates signals → sends to APM for centralized alerting
- ✅ APM tracks performance → BeTrace ensures correct behavior

#### Real-World Scenario

**Scenario:** 500 errors spike to 15% for 8 minutes

**APM Tells You:**
- Error rate: 15% (threshold breached)
- Affected endpoint: `/users/{id}`
- Latency: Normal (200ms P99)
- Stack traces: `NullPointerException` in `AuditLogger.log()`

**BeTrace Tells You:**
- Pattern violation: "PII access without audit log"
- Rule fired: `pii-audit-required`
- Exact traces: 47 violations in last 8 minutes
- Root cause: Code path bypassed audit logging

**Together:**
1. APM alerts SRE: "High error rate on /users/{id}"
2. SRE checks BeTrace signals: "pii-audit-required rule firing"
3. SRE drills into trace: Missing audit log span
4. MTTR reduced 60% (no manual log grep)

#### Migration Path

```markdown
"Already using APM? Add BeTrace in 3 steps:"

Step 1: Point OTLP exporter to BeTrace
export OTEL_EXPORTER_OTLP_ENDPOINT="http://fluo.yourdomain.com/v1/traces"

Step 2: Create your first rule
trace.has(database.query).where(data.contains_pii == true)
  and not trace.has(audit.log)

Step 3: Forward BeTrace signals to APM
BeTrace webhook → Datadog Events API
(See BeTrace signals in Datadog UI)
```

#### Pricing Comparison

| Solution | Starting Price | What You Get |
|----------|---------------|--------------|
| Datadog APM | ~$31/host/month + $1.27/GB traces | Full APM, metrics, logs, traces |
| New Relic | $99/user/month + $0.25/GB ingested | APM, metrics, alerting |
| BeTrace | Contact sales (estimated $5K/month mid-market) | Pattern detection, compliance, rules |

**Note:** BeTrace is additive to APM, not a replacement. Total cost = APM + BeTrace.

#### Call to Action

```
"Want to see BeTrace + APM in action?"

[Button: Try Interactive Demo] (PRD-101)
[Button: Read Integration Guide] (PRD-102)
[Button: Request Trial] (Lead capture)
```

---

## Comparison Page #2: BeTrace vs. SIEM

**URL:** `/compare/fluo-vs-siem`
**Target Keywords:** "behavioral assurance vs SIEM," "BeTrace vs Splunk"

### Page Structure

#### Hero Section
```markdown
# BeTrace vs. SIEM (Splunk, Elastic Security, Chronicle)

**TL;DR:** SIEM detects security threats. BeTrace detects behavioral pattern violations.

Use SIEM for: Security incidents, IOC detection, threat hunting
Use BeTrace for: Service invariant violations, compliance evidence, incident prevention

**Different Use Cases:** SIEM is for security teams. BeTrace is for SREs, developers, compliance.
```

#### Comparison Table

| Feature | SIEM | BeTrace |
|---------|------|------|
| **Core Purpose** | Security incident detection and response | Behavioral pattern violation detection |
| **Primary Users** | Security analysts, SOC teams | SREs, developers, compliance officers |
| **Data Source** | Security logs, firewall logs, endpoint data | OpenTelemetry traces |
| **Threat Model** | External attackers, insider threats, malware | Service misconfigurations, broken invariants |
| **Alerting Model** | IOC-based (IP blocklists, signatures) | Pattern-based (trace rule violations) |
| **Use Case** | "Is someone trying to hack us?" | "Are our services behaving correctly?" |
| **Examples** | Brute force login, SQL injection attempt | Missing auth check, PII access without audit |
| **Compliance Focus** | Security controls (ISO27001, NIST) | Operational controls (SOC2 CC7.2, HIPAA) |
| **Integration** | Security tooling (firewalls, EDR) | Observability tooling (OTLP, APM) |

#### When to Use Each

**Use SIEM When:**
- ✅ You need to detect security incidents (attacks, breaches)
- ✅ You have security analysts hunting threats
- ✅ You need correlation across security logs
- ✅ You're meeting security compliance requirements (ISO27001)

**Use BeTrace When:**
- ✅ You need to detect service behavior violations
- ✅ You have SREs preventing incidents
- ✅ You need operational compliance evidence (SOC2, HIPAA)
- ✅ You're focused on application-level invariants

**You Might Need Both:**
- Security team uses SIEM for threat detection
- Engineering team uses BeTrace for behavioral assurance
- Compliance team pulls evidence from both

#### Real-World Scenario

**Scenario:** User data accessed without proper authorization

**SIEM Perspective (Security Incident):**
- Alert: Anomalous database query from internal IP
- Investigation: Check user permissions, access logs
- Outcome: Insider threat? Compromised credentials?

**BeTrace Perspective (Service Bug):**
- Signal: `auth-before-data` rule violated
- Investigation: Code path bypassed authorization check
- Outcome: Bug in new feature, not security incident

**Key Difference:**
- SIEM assumes malicious intent → security response
- BeTrace assumes service bug → engineering fix

#### Migration Path

```markdown
"BeTrace complements your SIEM, doesn't replace it."

Example Integration:
1. BeTrace detects behavioral violations → signals
2. High-severity signals forwarded to SIEM (webhook)
3. Security team investigates if needed
4. Most signals resolved by engineering (not security incidents)

**Result:** SIEM focuses on real threats, not noisy service bugs.
```

#### Call to Action

```
"Learn how BeTrace reduces SIEM noise"

[Button: Read SRE Use Case] (PRD-103)
[Button: Compare BeTrace + Distributed Tracing] (Link to comparison #3)
```

---

## Comparison Page #3: BeTrace vs. Distributed Tracing

**URL:** `/compare/fluo-vs-tracing`
**Target Keywords:** "behavioral assurance vs distributed tracing," "BeTrace vs Jaeger"

### Page Structure

#### Hero Section
```markdown
# BeTrace vs. Distributed Tracing (Jaeger, Tempo, Lightstep)

**TL;DR:** Distributed tracing shows what happened. BeTrace enforces what should happen.

Use Tracing for: Visualizing request flow, debugging latency
Use BeTrace for: Detecting pattern violations, enforcing invariants

**Best Together:** Tracing shows the trace → BeTrace matches patterns → signals violations
```

#### Comparison Table

| Feature | Distributed Tracing | BeTrace |
|---------|---------------------|------|
| **Core Purpose** | Visualize request flow across services | Detect behavioral pattern violations |
| **Interaction Model** | Reactive (search traces after incident) | Proactive (alert before incident escalates) |
| **Query Language** | TraceQL (find traces by attributes) | BeTrace DSL (match patterns in traces) |
| **Alerting** | Limited (mostly manual trace inspection) | Rule-based (automatic signals) |
| **Use Case** | "Why was this request slow?" | "Are all requests following the right pattern?" |
| **Examples** | Trace latency breakdown by span | Missing span, incorrect span order |
| **Compliance** | Trace data for audits | Compliance-specific spans with signatures |
| **Integration** | Standalone (Grafana, Jaeger UI) | Ingests OpenTelemetry, augments tracing |

#### When to Use Each

**Use Distributed Tracing When:**
- ✅ You need to debug a specific slow request
- ✅ You want to visualize service dependencies
- ✅ You're investigating latency issues
- ✅ You need trace sampling and storage

**Use BeTrace When:**
- ✅ You want to enforce "auth always before data"
- ✅ You need to detect pattern violations automatically
- ✅ You're generating compliance evidence from traces
- ✅ You want to prevent incidents (not just debug them)

**Use Both:**
- ✅ BeTrace signals → link to Jaeger/Tempo for detailed trace inspection
- ✅ Tracing stores traces → BeTrace evaluates patterns
- ✅ Tracing for debugging → BeTrace for prevention

#### Real-World Scenario

**Scenario:** Investigating a slow API request

**Distributed Tracing Shows:**
- Total latency: 2.3 seconds
- Slowest span: `database.query` (1.8s)
- Service call order: API → Auth → Cache → DB

**BeTrace Shows:**
- Pattern violation: `cache-before-db` rule fired
- Expected: Cache check BEFORE database query
- Actual: Cache check AFTER database query
- Root cause: Code bug, not infra issue

**Together:**
1. Distributed tracing shows latency (2.3s)
2. BeTrace shows pattern violation (cache miss)
3. SRE fixes code path → latency drops to 200ms

#### Integration Example

```markdown
"BeTrace + Jaeger/Tempo Integration"

Step 1: BeTrace ingests OpenTelemetry traces
(Same traces sent to Tempo for storage)

Step 2: BeTrace evaluates patterns
Rule: trace.has(cache.check) before trace.has(database.query)

Step 3: BeTrace generates signal
Signal: "cache-before-db violated in trace abc123"

Step 4: Link to Jaeger/Tempo
Click signal → deep link to Jaeger UI
(See full trace visualization)

**Best of Both Worlds:**
- BeTrace detects violations automatically
- Jaeger/Tempo provides detailed trace inspection
```

#### Call to Action

```
"See how BeTrace augments your tracing setup"

[Button: Try Interactive Demo] (PRD-101)
[Button: Read Technical Docs] (PRD-102)
```

---

## Comparison Page #4: BeTrace vs. Log Analysis

**URL:** `/compare/fluo-vs-logs`
**Target Keywords:** "behavioral assurance vs log analysis," "BeTrace vs Elasticsearch"

### Key Points (Brief)

**TL;DR:** Logs are unstructured text. Traces are structured events. BeTrace needs traces.

**Why Logs Don't Work for Behavioral Patterns:**
- Logs lack correlation (can't match "auth happened before data access")
- Logs are text-based (pattern matching is regex hell)
- Logs don't capture request flow (no parent/child span relationships)

**BeTrace Requires OpenTelemetry Traces:**
- Structured spans with attributes
- Parent-child relationships for request flow
- Trace-level correlation for pattern matching

---

## Comparison Page #5: When to Use BeTrace

**URL:** `/compare/when-to-use-fluo`
**Target Keywords:** "when to use behavioral assurance," "BeTrace use cases"

### Page Structure

#### Decision Framework

```markdown
# Should You Use BeTrace?

Answer these questions to find out:

## ✅ You Should Use BeTrace If:

1. **You have undocumented invariants causing incidents**
   Example: "We assumed auth always happened, but 10% of traces skip it"

2. **You need to enforce service contracts**
   Example: "Internal API requires token validation, but some services bypass it"

3. **You're generating compliance evidence manually**
   Example: "Auditor wants proof of access logging, we grep logs for 2 weeks"

4. **Your observability tools don't catch pattern violations**
   Example: "APM shows high error rate, but not WHY (missing audit log)"

5. **You use OpenTelemetry traces already**
   Example: "We send traces to Tempo/Jaeger, can BeTrace analyze them too?"

## ❌ You Probably Don't Need BeTrace If:

1. **You don't have OpenTelemetry traces yet**
   → Start with APM/tracing first, add BeTrace later

2. **You're focused on infrastructure monitoring (CPU, memory)**
   → Use APM (Datadog, New Relic)

3. **You need security incident detection**
   → Use SIEM (Splunk, Elastic)

4. **You have <10 engineers or simple monolith**
   → BeTrace adds most value in microservices with complex invariants

5. **You don't have clear behavioral patterns to enforce**
   → Use BeTrace's pattern discovery to learn invariants first

## 🤔 Not Sure? Start Here:

1. [Take the ROI Calculator] (PRD-104) - See if BeTrace saves you money
2. [Read Use Cases] (PRD-103) - Find scenarios similar to yours
3. [Try Interactive Demo] (PRD-101) - See BeTrace in action
4. [Request Trial] - Test with your OpenTelemetry data
```

---

## Implementation Plan

### Phase 1: Content Writing (3 days)
1. Write 5 comparison pages (1,000-1,500 words each)
2. Create comparison tables (markdown or HTML)
3. Source real-world scenarios from existing docs
4. Review with 2 SREs for accuracy

### Phase 2: Design & Layout (2 days)
1. Design comparison table styling (Tailwind)
2. Add visual elements (icons, diagrams)
3. Create "Decision Framework" flowchart (Mermaid.js)
4. Ensure mobile responsiveness

### Phase 3: SEO Optimization (1 day)
1. Add meta descriptions for all 5 pages
2. Optimize headings for target keywords
3. Add Open Graph tags
4. Submit to Google Search Console

### Phase 4: Integration (1 day)
1. Add comparison pages to site navigation (PRD-100)
2. Cross-link from landing page, docs (PRD-102)
3. Link from interactive demo (PRD-101)
4. Add analytics tracking (PostHog)

## Testing Strategy

### Content Validation
- **5 SREs**: "Do these comparisons accurately represent BeTrace?"
- **3 Sales Reps**: "Would these pages help handle objections?"

**Success Criteria:**
- 8/10 SREs say comparisons are accurate
- 3/3 sales reps say pages reduce objection handling time

### SEO Testing
- **Keyword Ranking**: Target top 20 within 3 months
- **Organic Traffic**: 10% of site traffic from comparison pages
- **Engagement**: <35% bounce rate, >2 min average session

## Dependencies

- **PRD-100**: Landing page navigation links to comparisons
- **PRD-101**: Interactive demo references comparisons
- **PRD-102**: Technical docs cross-link comparisons

## Risks & Mitigations

### Risk: Comparisons alienate potential partners (APM vendors)
**Mitigation:** Position BeTrace as complementary, not competitive ("Best Together" sections)

### Risk: Comparisons are too technical for executives
**Mitigation:** Include "TL;DR" at top, simple language, real-world scenarios

### Risk: Comparisons become outdated as BeTrace evolves
**Mitigation:** Schedule quarterly reviews, version comparison pages

### Risk: Low traffic to comparison pages
**Mitigation:** Link prominently from landing page, FAQ section, sales materials

## Open Questions

1. Should we create competitor-specific pages (e.g., "BeTrace vs Datadog")?
   - **Recommendation:** Yes, but start generic ("BeTrace vs APM") to avoid appearing competitive

2. Should comparisons include pricing?
   - **Recommendation:** Yes, but keep BeTrace pricing vague ("Contact sales, estimated $5K/month")

3. Should we show competitor logos?
   - **Recommendation:** Yes, improves SEO and user recognition

4. Should we offer competitor migration guides?
   - **Recommendation:** Phase 2 (after launch), e.g., "Migrate from Datadog Events to BeTrace Signals"

## Success Criteria

- ✅ 5 comparison pages published
- ✅ Bounce rate <35%
- ✅ Comparison-to-trial conversion >12%
- ✅ Sales objection handling time reduced by 30%
- ✅ Organic traffic from comparison pages >10% of total

## References

- [B2B SaaS Comparison Page Best Practices](https://www.demandcurve.com/playbooks/comparison-pages)
- [Positioning vs Competitor Pages](https://www.drift.com/blog/competitor-comparison-pages/)
- PRD-100: Marketing Landing Page (navigation integration)
- PRD-102: Technical Documentation (cross-linking)
- PRD-103: Use Case Library (referenced in decision framework)
