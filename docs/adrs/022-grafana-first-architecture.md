# ADR-022: Grafana-First Architecture

## Status
**Accepted** - 2025-01-22

## Context

FLUO was originally designed as a standalone application with custom UI, multi-tenant backend, and custom notification system. This created significant duplication with the Grafana observability ecosystem:

- **UI Duplication**: Custom React dashboard duplicates Grafana's visualization capabilities
- **Alerting Duplication**: Custom notification system duplicates Grafana Alerting
- **Query Duplication**: Custom query UI duplicates Grafana Explore
- **Auth Duplication**: Custom user management duplicates Grafana RBAC

**Key Insight**: FLUO's unique value is **FluoDSL pattern matching** (cross-span patterns TraceQL cannot express), not UI/alerting/visualization.

**Market Validation**: Organizations already deploy Grafana for observability. Adding FLUO should integrate seamlessly, not require learning a new interface.

## Decision

We redesign FLUO as **Grafana-first**: integrating with Grafana as plugins rather than competing as standalone application.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Grafana                              │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │  FLUO App Plugin │  │FLUO Datasource   │            │
│  │  (/plugins/fluo) │  │Plugin            │            │
│  │                  │  │                  │            │
│  │  - Rule CRUD UI  │  │- Query violations│            │
│  │  - DSL Editor    │  │- Grafana Explore │            │
│  │  - Rule Testing  │  │- Dashboards      │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │     Grafana Alerting                     │          │
│  │     - TraceQL alert rules                │          │
│  │     - Slack/PagerDuty/Email delivery     │          │
│  └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                 FLUO Backend                            │
│  - Receives spans from OTEL Collector                  │
│  - Evaluates FluoDSL rules via Drools                  │
│  - Emits violation spans → Tempo                       │
│  - Emits compliance spans (internal pattern) → Tempo   │
│                                                          │
│  API: /api/violations (violations query)                │
│       /api/rules (CRUD rules)                           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                    Tempo                                │
│  - Stores application traces                           │
│  - Stores FLUO violation spans                         │
│  - Stores compliance spans                             │
│  - Queryable via TraceQL                               │
└─────────────────────────────────────────────────────────┘
```

### Integration Points

| Capability | Before (Standalone) | After (Grafana-First) |
|------------|---------------------|----------------------|
| **UI** | Custom React app | Grafana App Plugin |
| **Violation Queries** | Custom query API | Grafana Datasource Plugin |
| **Alerting** | Custom notifications | Grafana Alerting (TraceQL rules) |
| **Trace Visualization** | Custom trace viewer | Grafana Explore (Tempo datasource) |
| **Compliance Queries** | `/api/compliance/evidence` | Tempo TraceQL directly |
| **User Management** | Custom RBAC | Grafana authentication |

## Rationale

### 1. Eliminate Feature Duplication

**Grafana Provides**:
- ✅ Dashboards, panels, visualizations
- ✅ Alerting (Slack, PagerDuty, email, webhooks)
- ✅ User authentication (OAuth, LDAP, SAML)
- ✅ RBAC and team management
- ✅ Explore UI for trace queries

**FLUO Provides** (unique capability):
- ✅ FluoDSL pattern matching (cross-span patterns)
- ✅ Violation detection and emission
- ✅ Compliance span emission (internal pattern)

**Impact**: Remove ~3,000 LOC of duplicated features

### 2. Better User Experience

**Before** (Standalone):
- User learns FLUO UI + Grafana UI (2 interfaces)
- Context switching between tools
- Duplicate configuration (alerts in FLUO + Grafana)

**After** (Grafana-First):
- User learns Grafana only (FLUO integrated)
- Single interface for observability
- Unified alerting configuration

### 3. Market Alignment

**Target Users**: Organizations already running Grafana for observability

**Deployment Friction**:
- Before: Deploy Grafana + Deploy FLUO + Integrate both
- After: Deploy Grafana + `grafana-cli plugins install fluo`

### 4. Compliance as Pattern, Not Feature

**Critical Insight** (User feedback):
> "compliance evidence; this is a pattern, not necessarily a fluo-specific feature. Pattern, not Feature. I don't think we need this as part of a Feature of Fluo, but rather, use the Pattern internally to produce compliance spans for customers to query with tempo."

**Implementation**:
- FLUO emits compliance spans via `ComplianceOtelProcessor` (internal pattern)
- Users query compliance spans via **Tempo TraceQL**, not FLUO API
- No custom compliance UI, no `/api/compliance/evidence` endpoint

**Example**:
```java
@SOC2(controls = {CC6_1})
public void authorizeUser() {
    // ComplianceOtelProcessor emits span:
    // {span.compliance.framework = "soc2", span.compliance.control = "CC6_1"}
}
```

**User Query** (Tempo TraceQL in Grafana Explore):
```
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}
```

## Consequences

### Positive

1. **Reduced Complexity**: ~3,000 LOC removed (multi-tenant UI, custom notifications, compliance API)
2. **Better UX**: Users work in familiar Grafana interface
3. **Faster Adoption**: `grafana-cli plugins install fluo` vs. deploying standalone app
4. **Ecosystem Benefits**: Leverage Grafana community, plugin marketplace, documentation

### Negative

1. **Dependency on Grafana**: FLUO requires Grafana (not standalone)
2. **Plugin Learning Curve**: Team must learn Grafana plugin development (Go/TypeScript)
3. **Breaking Change**: Existing FLUO users must migrate to Grafana

### Mitigation Strategies

1. **Gradual Migration**: Provide migration guide for existing users
2. **Skills Development**: Create `.skills/grafana-plugin/` and `.skills/otel-processor/` skills
3. **Subagent Guidance**: Create `.subagents/grafana-product-owner/` to prevent feature duplication

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
- Create grafana-product-owner subagent perspective ✅
- Create otel-processor and grafana-plugin skills ✅
- Write ADRs 022-027
- Archive obsolete PRDs (multi-tenant, notifications, compliance API)

### Phase 2: Backend Simplification (Weeks 3-4)
- Remove multi-tenant code (~2,500 LOC)
- Remove notification code (~500 LOC)
- Simplify to 2 API routes: `/api/violations`, `/api/rules`
- Ensure `ComplianceOtelProcessor` still emits compliance spans

### Phase 3: Grafana Datasource Plugin (Weeks 5-7)
- Implement FLUO datasource backend (Go)
- Query `/api/violations` endpoint
- Return TraceQL-compatible results
- Test in Grafana Explore

### Phase 4: Grafana App Plugin (Weeks 8-10)
- Implement rule management UI (React + Grafana UI)
- Monaco editor for FluoDSL
- Integration with `/api/rules` endpoint
- Test with sample rules

### Phase 5: Documentation & Migration (Weeks 11-12)
- Migration guide for existing users
- Grafana plugin catalog submission
- Update marketing site

## Alternatives Considered

### 1. Keep Standalone Application
**Rejected**: Duplicates Grafana capabilities, adds deployment friction

### 2. Embed Grafana in FLUO
**Rejected**: Grafana is 10x larger than FLUO, doesn't reduce complexity

### 3. Hybrid Approach (Standalone + Plugin)
**Rejected**: Doubles maintenance burden, confuses users

## Compliance Impact

### Before (Standalone)
- `/api/compliance/evidence` API for querying compliance spans
- Custom compliance UI pages
- Separate compliance datasource

### After (Grafana-First)
- **No compliance API** (internal pattern only)
- `ComplianceOtelProcessor` emits compliance spans
- Users query via **Tempo TraceQL** in Grafana Explore
- Compliance evidence queryable like any other spans

**Example TraceQL Query**:
```
# SOC2 CC6.1 evidence for last 30 days
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}
  | histogram_over_time(1d)
```

## References

- **Grafana Plugin Development**: https://grafana.com/docs/grafana/latest/developers/plugins/
- **Tempo TraceQL**: https://grafana.com/docs/tempo/latest/traceql/
- **Grafana Alerting**: https://grafana.com/docs/grafana/latest/alerting/
- **Related ADRs**:
  - ADR-023: Single-Tenant Deployment Model
  - ADR-025: Grafana Alerting for Signals
  - ADR-026: FLUO Core Competencies
  - ADR-027: FLUO as Grafana App Plugin
- **Skills**:
  - `.skills/grafana-plugin/` - Grafana plugin development patterns
  - `.skills/otel-processor/` - OTEL Collector processor patterns
- **Subagents**:
  - `.subagents/grafana-product-owner/` - Prevent feature duplication
