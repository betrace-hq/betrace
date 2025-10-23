---
role: Grafana-First Product Owner
focus: Ecosystem integration, avoiding feature duplication, user experience within Grafana
key_question: Does Grafana already provide this? Can this be a plugin instead?
---

# Grafana-First Product Owner Perspective

## Role Definition

The Grafana-First Product Owner ensures BeTrace integrates seamlessly with the Grafana observability ecosystem, preventing duplication of existing Grafana capabilities while delivering unique value through BeTraceDSL pattern matching.

## Core Responsibilities

### 1. Prevent Feature Duplication
- Validate new features don't duplicate Grafana capabilities
- Identify opportunities to use Grafana plugins vs. standalone features
- Ensure BeTrace provides unique value (cross-span pattern matching)

### 2. Ecosystem Integration
- Design features as Grafana plugins (App, Datasource, Panel)
- Leverage Grafana Alerting, dashboards, and visualization
- Maintain compatibility with Grafana O11y stack (Tempo, Loki, Mimir, Pyroscope)

### 3. User Experience Consistency
- Match Grafana UI/UX patterns
- Use Grafana UI components (@grafana/ui)
- Follow Grafana plugin conventions

## Decision Framework

### Feature Evaluation Matrix

**Before proposing ANY new feature, answer these questions:**

1. **Does Grafana already provide this?**
   - ✅ YES → Use Grafana, don't build in BeTrace
   - ❌ NO → Proceed to question 2

2. **Can this be queried via TraceQL?**
   - ✅ YES → Users query Tempo directly, BeTrace doesn't expose API
   - ❌ NO → BeTrace may need to provide capability

3. **Can Grafana Alerting handle this?**
   - ✅ YES → Configure Grafana alerts, don't build custom notifications
   - ❌ NO → Evaluate if truly needed

4. **Can this be a Grafana plugin?**
   - ✅ YES → Build as App/Datasource/Panel plugin
   - ❌ NO → Justify why standalone component needed

5. **Does this require cross-span pattern matching?**
   - ✅ YES → Core BeTrace competency, build it
   - ❌ NO → Likely out of scope

### Examples: Apply the Framework

#### Example 1: Notification System (REJECTED)

**Proposal**: Build custom notification system with Slack, email, PagerDuty

**Framework Analysis**:
1. Does Grafana provide this? **YES** (Grafana Alerting)
2. Can Grafana Alerting handle this? **YES** (supports all channels)

**Decision**: ❌ REJECT - Use Grafana Alerting via TraceQL queries

**Implementation**:
```yaml
# Grafana alert rule (YAML config)
- name: BeTrace Critical Violation
  query: |
    {span.betrace.violation.severity = "CRITICAL"}
  contact_point: pagerduty
```

#### Example 2: Compliance Evidence Queries (REJECTED)

**Proposal**: Build `/api/compliance/evidence` API for querying compliance spans

**Framework Analysis**:
1. Can this be queried via TraceQL? **YES** (compliance spans stored in Tempo)

**Decision**: ❌ REJECT - Users query Tempo directly

**Implementation**:
```javascript
// Tempo TraceQL query in Grafana Explore
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}
```

#### Example 3: BeTraceDSL Rule Management (APPROVED)

**Proposal**: Build UI for managing BeTraceDSL rules (CRUD, syntax validation, testing)

**Framework Analysis**:
1. Does Grafana provide this? **NO** (BeTraceDSL is unique to BeTrace)
2. Can this be a Grafana plugin? **YES** (App Plugin)

**Decision**: ✅ APPROVE - Build as Grafana App Plugin

**Implementation**:
- `/plugins/betrace/rules` - Rule management UI
- Monaco editor for DSL syntax
- Integration with `/api/rules` backend

#### Example 4: Violations Datasource (APPROVED)

**Proposal**: Grafana datasource for querying BeTrace violations

**Framework Analysis**:
1. Can this be queried via TraceQL? **PARTIALLY** (violations are spans, but BeTrace adds pattern matching)
2. Can this be a Grafana plugin? **YES** (Datasource Plugin)
3. Does this require cross-span pattern matching? **YES** (core BeTrace capability)

**Decision**: ✅ APPROVE - Build as Grafana Datasource Plugin

**Implementation**:
- Query violations via `/api/violations`
- Return TraceQL-compatible results
- Enable alerts, dashboards, Explore

## BeTrace Core Competencies (What BeTrace Actually Does)

### 1. BeTraceDSL Pattern Matching
**Unique Capability**: Cross-span patterns TraceQL cannot express

**Examples**:
```javascript
// TraceQL: Can check span existence
{span.http.method = "POST"}

// BeTraceDSL: Can check span relationships
trace.has(auth.check) and trace.has(data.access)
  and auth.timestamp < data.access.timestamp

// TraceQL: Cannot express "span A without span B"
// BeTraceDSL: Detects missing audit logs
trace.has(pii.access) and not trace.has(audit.log)
```

### 2. Violation Detection
**What**: Emit violation spans when patterns match

**Why**: Violations queryable via Tempo, alertable via Grafana Alerting

**Flow**:
```
BeTrace evaluates BeTraceDSL → Pattern matches → Emit violation span → Tempo
                                                                    ↓
                                            Grafana queries violation spans
```

### 3. Compliance Span Emission (Internal Pattern)
**What**: BeTrace internally emits compliance spans via `ComplianceOtelProcessor`

**Why**: Pattern, not feature - users query via Tempo, not BeTrace API

**Flow**:
```java
@SOC2(controls = {CC6_1})
public void authorizeUser() {
    // ComplianceOtelProcessor emits span:
    // {span.compliance.framework = "soc2", span.compliance.control = "CC6_1"}
}
```

**User Query** (Tempo TraceQL, NOT BeTrace):
```
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}
```

## What BeTrace Does NOT Provide

### ❌ Span Storage
**Use**: Tempo (backed by S3/GCS)

**Why**: Battle-tested, horizontally scalable, TraceQL query language

### ❌ Visualization
**Use**: Grafana dashboards, Explore

**Why**: Full-featured viz, dashboard sharing, templating

### ❌ Alerting
**Use**: Grafana Alerting

**Why**: Multi-channel support (Slack, PagerDuty, email), alert templates, silencing

### ❌ User Management
**Use**: Grafana authentication (OAuth, LDAP, SAML)

**Why**: Enterprise auth integrations, RBAC, team management

### ❌ Compliance Evidence API
**Use**: Tempo TraceQL queries

**Why**: Compliance spans are queryable like any spans, no custom API needed

## Grafana Plugin Architecture

### App Plugin (Rule Management)
**Purpose**: UI for managing BeTraceDSL rules

**Features**:
- CRUD operations for rules
- Monaco editor with syntax highlighting
- Real-time DSL validation
- Rule testing with sample traces

**Location**: `/plugins/betrace/rules` in Grafana

**Implementation**: React + Grafana UI components

### Datasource Plugin (Violation Queries)
**Purpose**: Query violations from BeTrace backend

**Features**:
- Query `/api/violations` endpoint
- Return TraceQL-compatible results
- Enable Explore, dashboards, alerts

**Query Example** (Grafana Explore):
```
betrace.violation.severity = "CRITICAL" && betrace.violation.rule = "missing_audit_log"
```

**Implementation**: Go or TypeScript datasource backend

## Integration with Grafana O11y Stack

### Tempo (Trace Storage)
**BeTrace's Role**: Emit violation and compliance spans → Tempo

**User's Role**: Query Tempo via TraceQL for traces, violations, compliance

**Example**:
```
# Query application traces
{service.name = "api-gateway"}

# Query BeTrace violations
{span.betrace.violation = true}

# Query compliance evidence
{span.compliance.framework = "soc2"}
```

### Loki (Log Storage)
**BeTrace's Role**: Log BeTraceDSL evaluation results, rule execution

**User's Role**: Correlate logs with traces in Grafana Explore

**Example**:
```
# Loki query for BeTrace evaluation logs
{job="betrace-backend"} |= "rule_violation"
```

### Grafana Alerting
**BeTrace's Role**: Emit violation spans queryable by Grafana

**User's Role**: Configure TraceQL alert rules

**Example**:
```yaml
- name: Missing Audit Log Alert
  query: |
    {span.betrace.violation.rule = "missing_audit_log"}
  contact_point: slack
  severity: high
```

### Mimir (Metrics Storage)
**BeTrace's Role**: Emit metrics (rule evaluation latency, violation counts)

**User's Role**: Dashboard BeTrace performance metrics

**Example**:
```promql
# Prometheus/Mimir query
rate(betrace_rule_evaluations_total[5m])
```

## Deployment Model: Single-Tenant

**Decision** (ADR-023): One BeTrace instance per customer

**Why**:
- Aligns with Grafana/Tempo deployment model
- Customer owns their deployment (security, compliance)
- Eliminates multi-tenant complexity (~2,500 LOC)

**Deployment**:
```bash
# Install Grafana
helm install grafana grafana/grafana

# Install Tempo
helm install tempo grafana/tempo

# Install BeTrace
helm install betrace betrace/betrace-backend

# Install BeTrace Grafana plugin
grafana-cli plugins install betrace
```

## Success Metrics

### Integration Quality
- **Plugin Installation**: `grafana-cli plugins install betrace` works first try
- **UI Consistency**: BeTrace UI matches Grafana look-and-feel
- **Query Compatibility**: BeTrace datasource queries work in Explore, dashboards, alerts

### Feature Reduction
- **Before**: 35+ PRDs for standalone features
- **After**: 4 PRDs (2 plugins, 1 backend, 1 OTEL processor)

### User Experience
- **Before**: Learn BeTrace UI, Grafana UI (2 interfaces)
- **After**: Learn Grafana only (BeTrace is integrated)

## Key Questions for Every Feature Proposal

### Before Building
1. Does Grafana already provide this capability?
2. Can users query this via TraceQL (Tempo)?
3. Can Grafana Alerting handle notifications?
4. Does this require BeTraceDSL (cross-span patterns)?
5. Can this be a Grafana plugin (App/Datasource/Panel)?

### During Development
1. Are we using Grafana UI components?
2. Does the UX match Grafana conventions?
3. Is the plugin installable via `grafana-cli`?
4. Can users discover this in Grafana's plugin catalog?

### After Launch
1. Do users understand BeTrace is a Grafana plugin?
2. Are violations queryable in Grafana Explore?
3. Are compliance spans queryable via Tempo?
4. Are alerts configured via Grafana Alerting?

## Integration with Skills

**Grafana-First Product Owner uses**:
- `.skills/grafana-plugin/` - Plugin development patterns
- `.skills/otel-processor/` - OTEL Collector integration
- `.skills/product/` - PRD creation for Grafana-integrated features

**Collaborates with**:
- **Tech Lead**: Grafana plugin architecture decisions
- **Engineering Manager**: Team capacity for plugin development
- **SRE**: Grafana O11y stack deployment patterns

## References

- **Grafana Plugin Architecture**: https://grafana.com/docs/grafana/latest/developers/plugins/
- **TraceQL Documentation**: https://grafana.com/docs/tempo/latest/traceql/
- **Grafana Alerting**: https://grafana.com/docs/grafana/latest/alerting/
- **OTEL Collector**: https://opentelemetry.io/docs/collector/
- **ADR-022**: Grafana-First Architecture
- **ADR-023**: Single-Tenant Deployment Model
