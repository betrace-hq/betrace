# BeTrace Platform Integration Guides

This directory contains comprehensive guides for integrating BeTrace with various observability platforms beyond Grafana.

## Overview

BeTrace is designed with a **Grafana-First Architecture** (ADR-022), but the underlying components are highly portable:

- ✅ **Backend API**: Platform-agnostic Go REST API (`/api/violations`, `/api/rules`)
- ✅ **UI Components**: Decoupled React components (proven via Storybook)
- ✅ **Data Pipeline**: OpenTelemetry-native span emission
- ✅ **DSL Engine**: Standalone BeTraceDSL evaluation (Lua-based)

**Portability Assessment:** 80% of BeTrace components are platform-agnostic.

## Available Integration Guides

### 1. [SigNoz Integration](./signoz-integration-guide.md)
**Status:** Recommended for OpenTelemetry-native environments
**Difficulty:** ⭐⭐☆☆☆ (Easy - 2-3 weeks)
**Best For:** Startups, cloud-native teams, cost-conscious organizations

**Why SigNoz:**
- Native OpenTelemetry support (perfect fit for BeTrace)
- Single ClickHouse backend (simpler than Grafana's multi-backend approach)
- Less operational overhead
- Open-source and self-hostable

**Integration Approach:**
- **Option A (Recommended):** Custom OTEL Collector receiver
- **Option B:** Standalone UI + SigNoz for visualization

---

### 2. [Kibana/Elastic Stack Integration](./kibana-integration-guide.md)
**Status:** Recommended for enterprise environments
**Difficulty:** ⭐⭐⭐☆☆ (Moderate - 3-4 weeks)
**Best For:** Large enterprises, teams already invested in Elastic Stack

**Why Kibana:**
- Mature APM ecosystem with rich features
- Powerful visualization (TSVB, Canvas, Lens)
- Enterprise-grade RBAC and audit logging
- Battle-tested at scale

**Integration Approach:**
- **Option A (Recommended):** OTLP export to Elastic APM Server
- **Option B:** Custom Kibana application plugin

---

## Integration Architecture Comparison

| Aspect | SigNoz | Kibana/Elastic | Grafana (Baseline) |
|--------|--------|----------------|-------------------|
| **Backend Storage** | ClickHouse (single) | Elasticsearch | Tempo + Loki + Mimir |
| **Query Language** | SQL-like | KQL + Lucene | TraceQL + LogQL |
| **Integration Method** | OTEL Receiver | APM Ingest Pipeline | Datasource Plugin |
| **UI Customization** | OTEL Collector config | Kibana Plugin | Grafana Plugin |
| **Complexity** | Low | Medium | Low (native) |
| **Development Time** | 2-3 weeks | 3-4 weeks | N/A (primary) |
| **OpenTelemetry Native** | ✅ Yes | ⚠️ Partial | ⚠️ Partial |

---

## Common Integration Patterns

### Pattern 1: OTEL Collector Integration (Recommended)

```
┌─────────────────────────────────────────┐
│  BeTrace Backend (Go)                   │
│  - /api/violations (HTTP)               │
│  - Emits violation spans → OTLP         │
└────────────────┬────────────────────────┘
                 ↓ (OTLP/gRPC)
┌─────────────────────────────────────────┐
│  OTEL Collector                         │
│  - BeTrace Receiver (custom)            │
│  - Processors (batch, filter)           │
│  - Exporters (platform-specific)        │
└────────────────┬────────────────────────┘
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
┌──────────────┐  ┌──────────────┐
│   SigNoz     │  │   Elastic    │
│ (ClickHouse) │  │ (APM Server) │
└──────────────┘  └──────────────┘
```

**Advantages:**
- Platform-agnostic pipeline
- Easy to swap backends
- Standard OTEL tooling

---

### Pattern 2: Standalone UI + Backend Integration

```
┌─────────────────────────────────────────┐
│  BeTrace Standalone UI                  │
│  - Storybook components                 │
│  - MonacoRuleEditor                     │
│  - Rule CRUD interface                  │
│  - http://betrace-ui:3000               │
└────────────────┬────────────────────────┘
                 ↓ (HTTP)
┌─────────────────────────────────────────┐
│  BeTrace Backend API                    │
│  - /api/rules (CRUD)                    │
│  - /api/violations (query)              │
└────────────────┬────────────────────────┘
                 ↓ (OTLP)
        ┌────────┴────────┐
        ↓                 ↓
┌──────────────┐  ┌──────────────┐
│ Platform UI  │  │ Platform UI  │
│  (SigNoz)    │  │  (Kibana)    │
└──────────────┘  └──────────────┘
```

**Advantages:**
- No platform-specific UI development
- Reuse existing Storybook components
- Independent deployment

---

## Data Model Mapping

BeTrace uses a consistent data model across all platforms:

### Violation Model (Go)
```go
type Violation struct {
    ID          string    `json:"id"`
    RuleID      string    `json:"ruleId"`
    RuleName    string    `json:"ruleName"`
    Severity    string    `json:"severity"` // HIGH, MEDIUM, LOW
    Message     string    `json:"message"`
    TraceIDs    []string  `json:"traceIds"`
    SpanRefs    []SpanRef `json:"spanReferences"`
    CreatedAt   time.Time `json:"createdAt"`
    Signature   string    `json:"signature"` // HMAC-SHA256
}
```

### Platform Mappings

| BeTrace Field | SigNoz (ClickHouse) | Elastic (APM) | Grafana (Tempo) |
|---------------|---------------------|---------------|-----------------|
| `ID` | `span.id` | `transaction.id` | `span.id` |
| `RuleID` | `span.attributes.betrace.rule_id` | `labels.betrace_rule_id` | `span.betrace.rule_id` |
| `Severity` | `span.attributes.betrace.severity` | `labels.severity` | `span.betrace.severity` |
| `TraceIDs` | `trace.id` | `trace.id` | `trace.id` |
| `Message` | `span.attributes.betrace.message` | `error.message` | `span.betrace.message` |

---

## Getting Started

### Prerequisites (All Platforms)

1. **BeTrace Backend Running**
   ```bash
   cd /Users/sscoble/Projects/betrace
   nix run .#backend
   # Backend available at http://localhost:12011
   ```

2. **OTEL Collector Installed**
   ```bash
   # Install OTEL Collector
   # See platform-specific guides for configuration
   ```

3. **Target Platform Deployed**
   - SigNoz: [Install Guide](https://signoz.io/docs/install/)
   - Kibana: [Elastic Stack Setup](https://www.elastic.co/guide/en/elasticsearch/reference/current/install-elasticsearch.html)

### Choose Your Integration

- **For OpenTelemetry-native environments:** Start with [SigNoz Integration](./signoz-integration-guide.md)
- **For enterprise Elastic Stack users:** Start with [Kibana Integration](./kibana-integration-guide.md)
- **Already using Grafana?** See ADR-022 for native Grafana plugin approach

---

## Development Workflow

All integrations follow the same development workflow:

### Phase 1: Backend API Testing (1 day)
- Verify `/api/violations` returns expected data
- Test `/api/rules` CRUD operations
- Validate BeTraceDSL evaluation

### Phase 2: OTEL Pipeline Setup (3-5 days)
- Configure OTEL Collector receiver
- Set up platform-specific exporter
- Test span delivery to target platform

### Phase 3: UI Integration (1-2 weeks)
- Choose standalone UI or platform plugin
- Integrate rule management interface
- Connect to backend API

### Phase 4: Testing & Validation (3-5 days)
- End-to-end integration tests
- Performance validation
- Query/visualization testing

---

## Migration from Grafana

If you're currently using BeTrace with Grafana and want to migrate:

### Data Migration
1. Export rules from Grafana BeTrace plugin: `GET /api/rules`
2. Import to new platform using same API
3. Reconfigure OTEL Collector exporter endpoint

### UI Migration
- Grafana App Plugin → Platform-specific UI or standalone UI
- Datasource queries → Platform-specific query language
- Dashboards → Rebuild using platform visualization tools

### Zero Downtime Migration
1. Run dual OTEL Collector configuration (multi-exporter)
2. Validate data in new platform
3. Gradually shift traffic
4. Decommission Grafana integration

---

## Contributing

Have you integrated BeTrace with another platform? We welcome contributions!

### Contribution Guidelines
1. Create new integration guide in `docs/integration/`
2. Follow existing guide structure (see [signoz-integration-guide.md](./signoz-integration-guide.md))
3. Include code examples and configuration snippets
4. Add platform to comparison tables
5. Submit PR with ADR if architectural changes needed

### Platforms We'd Love to See
- [ ] Datadog custom widgets
- [ ] New Relic custom visualizations
- [ ] Splunk integration
- [ ] Dynatrace extensions
- [ ] Honeycomb integration

---

## References

- [ADR-022: Grafana-First Architecture](../adrs/022-grafana-first-architecture.md) - Original design rationale
- [ADR-026: BeTrace Core Competencies](../adrs/026-betrace-core-competencies.md) - What makes BeTrace unique
- [ADR-027: BeTrace as Grafana App Plugin](../adrs/027-betrace-as-grafana-app-plugin.md) - Plugin architecture
- [Backend API Documentation](../../backend/README.md) - REST API reference
- [Storybook Components](../../grafana-betrace-app/.storybook/) - UI portability proof

---

## Support

- **Grafana Integration:** Fully supported (primary platform)
- **SigNoz Integration:** Community supported (guide provided)
- **Kibana Integration:** Community supported (guide provided)
- **Other Platforms:** Community contributions welcome

For questions or issues:
- GitHub Issues: [betracehq/betrace/issues](https://github.com/betracehq/betrace/issues)
- Discussions: [betracehq/betrace/discussions](https://github.com/betracehq/betrace/discussions)
