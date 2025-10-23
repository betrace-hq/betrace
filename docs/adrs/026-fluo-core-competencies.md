# ADR-026: FLUO Core Competencies

## Status
**Accepted** - 2025-01-22

## Context

After adopting Grafana-First Architecture (ADR-022), Single-Tenant Deployment (ADR-023), OTEL Span Signer (ADR-024), and Grafana Alerting (ADR-025), we must define what FLUO **uniquely provides** vs. what existing tools already do.

**Critical User Feedback**:
> "compliance evidence; this is a pattern, not necessarily a fluo-specific feature. Pattern, not Feature. I don't think we need this as part of a Feature of Fluo, but rather, use the Pattern internally to produce compliance spans for customers to query with tempo."

**Key Question**: After removing multi-tenant, notifications, span signing, and compliance API, **what is FLUO's core?**

## Decision

FLUO focuses exclusively on **three core competencies**:

### 1. FluoDSL Pattern Matching
**What**: Cross-span pattern matching language TraceQL cannot express

**Why Unique**: TraceQL can filter spans but **cannot express relationships** like:
- "Span A exists WITHOUT span B"
- "Span A happens BEFORE span B in same trace"
- "Count of spans matching pattern > threshold"

**Examples**:
```javascript
// TraceQL: Can check span existence
{span.http.method = "POST"}

// FluoDSL: Can check span relationships (TraceQL CANNOT)
trace.has(auth.check) and trace.has(data.access)
  and auth.timestamp < data.access.timestamp

// TraceQL: Cannot express negation patterns
// FluoDSL: Detects missing audit logs
trace.has(pii.access) and not trace.has(audit.log)

// FluoDSL: Count-based patterns
trace.count(http.status >= 500) > 5
```

**Implementation**: Drools Fusion stateful rule engine

### 2. Violation Detection
**What**: Emit violation spans when patterns match

**Why**: Violations become queryable via Tempo, alertable via Grafana

**Flow**:
```
FLUO Backend
    ↓
DroolsSpanProcessor (evaluate FluoDSL)
    ↓
Pattern matches → Emit violation span
    ↓
OTEL Collector → Tempo
    ↓
Grafana queries violations ({span.fluo.violation = true})
    ↓
Grafana Alerting triggers notifications
```

**Violation Span Attributes**:
```json
{
  "fluo.violation": true,
  "fluo.violation.severity": "CRITICAL",
  "fluo.violation.rule_id": "rule-123",
  "fluo.violation.rule_name": "missing_audit_log",
  "fluo.violation.message": "PII access without audit log",
  "fluo.violation.trace_id": "original-trace-id"
}
```

### 3. Compliance Span Emission (Internal Pattern)
**What**: Emit compliance spans via `ComplianceOtelProcessor` (internal pattern, NOT user-facing API)

**Why**: Pattern for generating compliance evidence, users query via Tempo

**Example**:
```java
@SOC2(controls = {CC6_1})
public void authorizeUser() {
    // ComplianceOtelProcessor emits span:
    // {span.compliance.framework = "soc2", span.compliance.control = "CC6_1"}
}
```

**User Query** (Tempo TraceQL in Grafana, NOT FLUO API):
```
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}
```

**Critical**: This is **NOT a FLUO feature** users interact with. It's an internal pattern FLUO uses. No `/api/compliance/evidence` endpoint.

## What FLUO Does NOT Provide

### ❌ Span Storage
**Use**: Tempo (S3/GCS backend)

**Rationale**: Tempo is battle-tested, horizontally scalable, TraceQL query language

### ❌ Visualization
**Use**: Grafana dashboards, Explore

**Rationale**: Full-featured visualization, dashboard sharing, templating

### ❌ Alerting
**Use**: Grafana Alerting

**Rationale**: 20+ notification channels, silencing, grouping, templating

### ❌ User Management
**Use**: Grafana authentication

**Rationale**: OAuth, LDAP, SAML integrations, RBAC

### ❌ Span Signing
**Use**: `otel-span-signer` OTEL processor

**Rationale**: Useful beyond FLUO, standard OTEL integration

### ❌ Multi-Tenant Isolation
**Use**: Single-tenant deployment (one FLUO per customer)

**Rationale**: Physical isolation, customer owns deployment

### ❌ Compliance Evidence API
**Use**: Tempo TraceQL queries

**Rationale**: Compliance spans queryable like any spans, no custom API needed

## FLUO Backend Minimal Core

After removing everything not in core competencies:

### API Routes (2 only)

| Route | Purpose | Input | Output |
|-------|---------|-------|--------|
| `/api/violations` | Query violations | `{severity, ruleId, timeRange}` | Violation spans |
| `/api/rules` | CRUD FluoDSL rules | Rule definition | Rule ID |

**Removed**:
- ❌ `/api/compliance/evidence` (use Tempo)
- ❌ `/api/tenants` (single-tenant)
- ❌ `/api/notifications` (use Grafana Alerting)
- ❌ `/api/signatures/verify` (use OTEL processor)

### Services (5 only)

| Service | Purpose | LOC | Status |
|---------|---------|-----|--------|
| **RuleService** | CRUD FluoDSL rules | ~200 | ✅ Keep |
| **DroolsSpanProcessor** | Evaluate FluoDSL | ~300 | ✅ Keep |
| **ViolationService** | Emit violation spans | ~150 | ✅ Keep |
| **ComplianceOtelProcessor** | Emit compliance spans (internal) | ~200 | ✅ Keep |
| **RedactionService** | PII redaction (existing) | ~300 | ✅ Keep |
| **TOTAL** | | **~1,150 LOC** | |

**Removed**:
- ❌ TenantService (~200 LOC)
- ❌ NotificationService (~300 LOC)
- ❌ SignatureService (~200 LOC)
- ❌ TenantSessionManager (~300 LOC)

**Impact**: FLUO backend shrinks from ~5,500 LOC to **~1,150 LOC core** (79% reduction)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 Customer Application                    │
│                  (OTEL Instrumented)                    │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│              OTEL Collector Pipeline                    │
│                                                          │
│  Receivers → [otel-span-signer] → Exporters             │
│              (signs spans)                              │
└────────────────────┬────────────────────────────────────┘
                     ↓
         ┌───────────┴───────────┐
         ↓                       ↓
┌─────────────────┐    ┌─────────────────┐
│  FLUO Backend   │    │   Tempo Storage │
│  (3 Core        │    │   (All Spans)   │
│   Competencies) │    │                 │
│                 │    │ - Application   │
│ 1. FluoDSL      │    │   traces        │
│    Pattern      │    │ - Violations    │
│    Matching     │    │ - Compliance    │
│                 │    │   spans         │
│ 2. Violation    │◄───┤                 │
│    Detection    │    │ Query via       │
│                 │    │ TraceQL         │
│ 3. Compliance   │    │                 │
│    Span         │    │                 │
│    Emission     │    │                 │
│    (internal)   │    │                 │
└─────────────────┘    └─────────────────┘
         ↓                       ↑
    Emit violation              │
    spans to Tempo              │
         ↓                       │
         └───────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                      Grafana                            │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │  FLUO App Plugin │  │FLUO Datasource   │            │
│  │  - Rule CRUD UI  │  │- Query violations│            │
│  │  - DSL Editor    │  │- /api/violations │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │     Tempo Datasource                     │          │
│  │     - Query application traces           │          │
│  │     - Query compliance spans (TraceQL)   │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │     Grafana Alerting                     │          │
│  │     - Alert on violations                │          │
│  │     - Slack/PagerDuty/Email              │          │
│  └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### Example 1: Missing Audit Log Detection

**1. Application Emits Spans**:
```java
// Span 1: PII access
@WithSpan(value = "database.query")
public UserData getUserData(String userId) {
    span.setAttribute("data.contains_pii", true);
    return db.query("SELECT * FROM users WHERE id = ?", userId);
}
// No audit log span emitted (violation!)
```

**2. FLUO Evaluates FluoDSL**:
```javascript
// FluoDSL rule
trace.has(database.query).where(data.contains_pii == true)
  and not trace.has(audit.log)
```

**3. FLUO Emits Violation Span**:
```json
{
  "spanName": "fluo.violation",
  "attributes": {
    "fluo.violation": true,
    "fluo.violation.severity": "CRITICAL",
    "fluo.violation.rule_name": "missing_audit_log",
    "fluo.violation.message": "PII access without audit log"
  }
}
```

**4. Grafana Alerts**:
```yaml
# Grafana alert rule
- name: Missing Audit Log
  query: '{span.fluo.violation.rule_name = "missing_audit_log"}'
  contact_point: pagerduty
```

### Example 2: Compliance Evidence Query

**1. Application Annotated with Compliance**:
```java
@SOC2(controls = {CC6_1})
@WithSpan(value = "auth.authorize")
public boolean authorizeUser(String userId, String resource) {
    // ComplianceOtelProcessor emits compliance span
    return authService.check(userId, resource);
}
```

**2. FLUO Emits Compliance Span** (Internal Pattern):
```json
{
  "spanName": "compliance.evidence",
  "attributes": {
    "compliance.framework": "soc2",
    "compliance.control": "CC6_1",
    "compliance.operation": "auth.authorize",
    "compliance.outcome": "success"
  }
}
```

**3. User Queries Tempo** (NOT FLUO API):
```
# TraceQL query in Grafana Explore
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}
  | histogram_over_time(1d)
```

**Critical**: User queries **Tempo**, not FLUO. Compliance is **internal pattern**, not feature.

## Market Positioning

### FLUO's Unique Value Proposition

**Problem**: TraceQL cannot express cross-span patterns

**Solution**: FluoDSL pattern matching + violation detection

**Examples TraceQL Cannot Express**:

| Pattern | TraceQL | FluoDSL |
|---------|---------|---------|
| Span A without Span B | ❌ Cannot | ✅ `trace.has(A) and not trace.has(B)` |
| Span A before Span B | ❌ Cannot | ✅ `A.timestamp < B.timestamp` |
| Count spans matching | ❌ Cannot | ✅ `trace.count(pattern) > N` |
| Missing authorization | ❌ Cannot | ✅ `trace.has(data.access) and not trace.has(auth.check)` |

### Integration with Existing Tools

| Capability | Tool | FLUO's Role |
|------------|------|-------------|
| **Span Storage** | Tempo | Emit violations to Tempo |
| **Visualization** | Grafana | Provide datasource plugin |
| **Alerting** | Grafana Alerting | Emit violation spans |
| **Query Language** | TraceQL | Violations queryable via TraceQL |
| **Span Signing** | otel-span-signer | Complementary (not integrated) |
| **User Management** | Grafana Auth | Inherit authentication |

## Consequences

### Positive

1. **Focus**: FLUO does ONE thing well (cross-span pattern matching)
2. **Simplicity**: ~1,150 LOC core vs. ~5,500 LOC before (79% reduction)
3. **Integration**: Works seamlessly with Grafana O11y stack
4. **Clarity**: Clear boundary between FLUO and existing tools

### Negative

1. **Dependency**: FLUO requires Grafana, Tempo, OTEL Collector
2. **Limited Scope**: FLUO is no longer "full observability platform"

### Mitigation Strategies

1. **Dependency Acceptance**: Grafana O11y stack is industry standard
2. **Scope Clarity**: FLUO is **Behavioral Assurance System**, not APM

## Implementation Checklist

### Code to Remove (~4,350 LOC)

- [x] Multi-tenant code (~2,500 LOC) - ADR-023
- [x] Notification code (~500 LOC) - ADR-025
- [x] Span signing code (~500 LOC) - ADR-024
- [x] Compliance API code (~300 LOC) - This ADR
- [x] Tenant session management (~300 LOC) - ADR-023
- [x] Custom UI pages (~250 LOC) - ADR-022

### Code to Keep (~1,150 LOC)

- [x] FluoDSL rule engine (Drools) (~300 LOC)
- [x] Violation detection service (~150 LOC)
- [x] Compliance span emission (internal) (~200 LOC)
- [x] Rule CRUD service (~200 LOC)
- [x] PII redaction service (~300 LOC)

### New Code to Add (~1,500 LOC)

- [ ] Grafana App Plugin (rule management UI) (~800 LOC)
- [ ] Grafana Datasource Plugin (violation queries) (~700 LOC)

**Net Result**: ~5,500 LOC → ~2,650 LOC (52% reduction)

## References

- **TraceQL Limitations**: https://grafana.com/docs/tempo/latest/traceql/#limitations
- **Drools Fusion**: https://docs.drools.org/latest/drools-docs/html_single/#drools.FusionCEP
- **Related ADRs**:
  - ADR-022: Grafana-First Architecture
  - ADR-023: Single-Tenant Deployment Model
  - ADR-024: OTEL Span Signer Processor
  - ADR-025: Grafana Alerting for Signals
  - ADR-027: FLUO as Grafana App Plugin
- **Subagents**:
  - `.subagents/grafana-product-owner/` - Prevent feature duplication
- **Skills**:
  - `.skills/fluo-dsl/` - FluoDSL pattern writing
