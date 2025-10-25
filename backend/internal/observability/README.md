# BeTrace Observability & Compliance Evidence

Complete observability for BeTrace rule engine with **Prometheus metrics**, **Tempo traces**, and **compliance evidence generation** for SOC2, GDPR, HIPAA, and FedRAMP.

## Quick Start

### 1. Rule Engine with Observability

```go
import (
    "context"
    "github.com/betracehq/betrace/backend/internal/rules"
    "github.com/betracehq/betrace/backend/pkg/models"
)

func main() {
    ctx := context.Background()
    engine := rules.NewRuleEngine()

    // Load rule with observability
    rule := models.Rule{
        ID:         "detect-errors",
        Expression: `span.status == "ERROR"`,
        Enabled:    true,
    }
    _ = engine.LoadRuleWithObservability(ctx, rule)

    // Evaluate span with full tracing + metrics
    span := &models.Span{
        SpanID:    "span-123",
        Status:    "ERROR",
        Duration:  2000000000,
        Attributes: map[string]string{
            "http.method": "POST",
        },
    }
    matches, _ := engine.EvaluateAllWithObservability(ctx, span)
}
```

**Emits:**
- ✅ OpenTelemetry span: `rule_engine.evaluate_all`
- ✅ Prometheus metrics: `betrace_rule_evaluation_duration_seconds{rule_id="detect-errors",result="match"}`
- ✅ Compliance evidence: SOC2 CC7.1 (System Monitoring)

### 2. SOC2 Compliance Evidence

```go
import "github.com/betracehq/betrace/backend/internal/observability"

// CC6.1: Logical Access Controls
observability.EmitSOC2AccessControl(ctx, "user-123", "/api/data", true)

// CC6.3: Data Isolation
observability.EmitSOC2DataIsolation(ctx, "tenant-abc", "query", true)
```

**Creates Tempo span with:**
```json
{
  "span.name": "compliance.evidence",
  "compliance.framework": "soc2",
  "compliance.control": "CC6.1",
  "compliance.outcome": "granted",
  "compliance.evidence_type": "audit_trail",
  "compliance.tamper_evident": true,
  "user_id": "user-123",
  "resource": "/api/data"
}
```

### 3. HIPAA Compliance Evidence

```go
// 164.312(b): Audit Controls
observability.EmitHIPAAAccessLog(ctx, "doctor-smith", "view_patient", "medical_record")

// 164.312(a)(2)(iv): Encryption
observability.EmitHIPAAEncryption(ctx, "encrypt", "patient_ssn", true)
```

### 4. GDPR Compliance Evidence

```go
// Art. 15: Right of Access
observability.EmitGDPRDataAccess(ctx, "user-jane", "data_export", true)

// Art. 17: Right to Erasure
observability.EmitGDPRDataDeletion(ctx, "user-john", "completed")

// Art. 7: Consent
observability.EmitGDPRConsent(ctx, "user-alice", "granted", "marketing")
```

### 5. FedRAMP Compliance Evidence

```go
// AU-2: Audit Events
observability.EmitFedRAMPAuditEvent(ctx, "admin", "admin-bob", "update_policy")

// AC-3: Access Enforcement
observability.EmitFedRAMPAccessControl(ctx, "contractor-charlie", "/classified", false)
```

## Prometheus Metrics

### Rule Engine Performance

```promql
# Rule evaluation latency (p99)
histogram_quantile(0.99,
  rate(betrace_rule_evaluation_duration_seconds_bucket[5m])
)

# Rule evaluation throughput
sum(rate(betrace_rule_evaluation_total[5m])) by (rule_id, result)

# Spans processed per second
rate(betrace_rule_engine_spans_processed_total[5m])

# Span size distribution
histogram_quantile(0.95,
  rate(betrace_rule_engine_span_size_bytes_bucket[5m])
)
```

### Compliance Metrics

```promql
# SOC2 access control success rate
sum(rate(betrace_soc2_access_control_checks_total{outcome="granted"}[5m])) /
sum(rate(betrace_soc2_access_control_checks_total[5m]))

# HIPAA access log volume
rate(betrace_hipaa_access_log_entries_total[5m])

# GDPR deletion completion rate
sum(rate(betrace_gdpr_data_deletion_requests_total{status="completed"}[1h])) /
sum(rate(betrace_gdpr_data_deletion_requests_total[1h]))

# Compliance violations (all frameworks)
sum(rate(betrace_compliance_violations_detected_total[5m]))
  by (framework, control, severity)
```

### System Health

```promql
# Memory usage
betrace_memory_usage_bytes{component="rule_engine"}

# Active goroutines
betrace_goroutines_active

# GC pause duration (p99)
histogram_quantile(0.99,
  rate(betrace_gc_pause_duration_seconds_bucket[5m])
)
```

## Tempo Traces & TraceQL

### Query Compliance Evidence

```traceql
# All SOC2 CC6.1 access control decisions
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}

# HIPAA access logs for specific user
{span.compliance.framework = "hipaa" && span.user_id = "doctor-smith"}

# GDPR deletion requests (Art. 17)
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 17"}

# Compliance violations (all frameworks)
{span.name = "compliance.violation"}

# FedRAMP audit events by type
{span.compliance.framework = "fedramp" && span.event_type = "admin"}

# Rule evaluations that matched
{span.name = "rule.evaluate" && span.rule.matched = true}
```

### Query Rule Engine Performance

```traceql
# Slow rule evaluations (>100ms)
{span.name = "rule.evaluate" && duration > 100ms}

# Rules evaluated against large spans (>1MB)
{span.name = "rule_engine.evaluate_all" && span.span.attributes_count > 1000}

# Failed rule loads
{span.name = "rule.load" && status = error}
```

## Compliance Frameworks

### SOC2 Trust Service Criteria

| Control | Description | Evidence Function |
|---------|-------------|-------------------|
| CC6.1 | Logical Access Controls | `EmitSOC2AccessControl()` |
| CC6.2 | Access Provisioning | `EmitComplianceEvidence(SOC2_CC6_2, ...)` |
| CC6.3 | Data Isolation | `EmitSOC2DataIsolation()` |
| CC6.6 | Encryption at Rest | `EmitComplianceEvidence(SOC2_CC6_6, ...)` |
| CC6.7 | Encryption in Transit | `EmitComplianceEvidence(SOC2_CC6_7, ...)` |
| CC7.1 | System Monitoring | Automatic (rule engine) |
| CC7.2 | System Performance | Automatic (metrics) |
| CC8.1 | Change Management | `EmitComplianceEvidence(SOC2_CC8_1, ...)` |

### HIPAA Technical Safeguards

| Control | Description | Evidence Function |
|---------|-------------|-------------------|
| 164.312(a) | Access Control | `EmitComplianceEvidence(HIPAA_164_312_a, ...)` |
| 164.312(b) | Audit Controls | `EmitHIPAAAccessLog()` |
| 164.312(a)(2)(i) | Unique User ID | `EmitComplianceEvidence(HIPAA_164_312_a_2_i, ...)` |
| 164.312(a)(2)(iv) | Encryption/Decryption | `EmitHIPAAEncryption()` |
| 164.312(e)(2)(ii) | Transmission Security | `EmitComplianceEvidence(HIPAA_164_312_e_2_ii, ...)` |

### GDPR Articles

| Article | Description | Evidence Function |
|---------|-------------|-------------------|
| Art. 15 | Right of Access | `EmitGDPRDataAccess()` |
| Art. 17 | Right to Erasure | `EmitGDPRDataDeletion()` |
| Art. 7 | Consent | `EmitGDPRConsent()` |
| Art. 32 | Security of Processing | `EmitComplianceEvidence(GDPR_Art_32, ...)` |

### FedRAMP Controls

| Control | Description | Evidence Function |
|---------|-------------|-------------------|
| AC-2 | Account Management | `EmitComplianceEvidence(FedRAMP_AC_2, ...)` |
| AC-3 | Access Enforcement | `EmitFedRAMPAccessControl()` |
| AU-2 | Audit Events | `EmitFedRAMPAuditEvent()` |
| AU-3 | Audit Record Content | Automatic (span attributes) |
| CM-2 | Baseline Configuration | `EmitComplianceEvidence(FedRAMP_CM_2, ...)` |

## Architecture

### Observability Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     BeTrace Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐        ┌──────────────────┐          │
│  │  Rule Engine    │───────▶│  Observability   │          │
│  │                 │        │                  │          │
│  │ • LoadRule()    │        │ • Metrics        │          │
│  │ • EvaluateAll() │        │ • Tracing        │          │
│  └─────────────────┘        │ • Compliance     │          │
│                              └────────┬─────────┘          │
└──────────────────────────────────────┼────────────────────┘
                                        │
                  ┌────────────────────┼────────────────────┐
                  │                    │                    │
                  ▼                    ▼                    ▼
          ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
          │  Prometheus  │    │    Tempo     │    │   Grafana    │
          │              │    │              │    │              │
          │  • Metrics   │    │  • Traces    │    │  • Dashboard │
          │  • Alerts    │    │  • TraceQL   │    │  • Alerts    │
          └──────────────┘    └──────────────┘    └──────────────┘
                  │                    │                    │
                  └────────────────────┴────────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  Compliance      │
                              │  Auditor         │
                              │                  │
                              │  • Query spans   │
                              │  • Export report │
                              └──────────────────┘
```

### Span Hierarchy

```
rule_engine.evaluate_all (parent)
├── rule.evaluate (rule-1)
│   └── compliance.evidence (SOC2 CC7.1)
├── rule.evaluate (rule-2)
├── rule.evaluate (rule-3)
│   └── compliance.evidence (HIPAA 164.312(b))
└── compliance.evidence (summary)
```

## Compliance Evidence Flow

### 1. Evidence Generation

```go
// Application code emits compliance evidence
observability.EmitSOC2AccessControl(ctx, userID, resource, granted)
```

### 2. Span Creation

```go
// Span created with compliance attributes
span = {
    "span.name": "compliance.evidence",
    "compliance.framework": "soc2",
    "compliance.control": "CC6.1",
    "compliance.outcome": "granted",
    "compliance.timestamp": 1700000000,
    "compliance.tamper_evident": true,
    "user_id": "user-123",
    "resource": "/api/data"
}
```

### 3. Export to Tempo

```
Span → OpenTelemetry Exporter → Grafana Tempo
```

### 4. Auditor Query

```traceql
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}
```

### 5. Compliance Report

```
Auditor exports compliance spans as evidence for SOC2 audit:
- 10,000 access control checks (CC6.1)
- 100% logged to Tempo
- Tamper-evident via OpenTelemetry
- Queryable for audit period (last 12 months)
```

## Grafana Dashboards

### Rule Engine Performance Dashboard

```json
{
  "dashboard": {
    "title": "BeTrace Rule Engine Performance",
    "panels": [
      {
        "title": "Rule Evaluation Latency (p99)",
        "targets": [{
          "expr": "histogram_quantile(0.99, rate(betrace_rule_evaluation_duration_seconds_bucket[5m]))"
        }]
      },
      {
        "title": "Spans Processed/sec",
        "targets": [{
          "expr": "rate(betrace_rule_engine_spans_processed_total[5m])"
        }]
      },
      {
        "title": "Active Rules",
        "targets": [{
          "expr": "betrace_rules_active"
        }]
      }
    ]
  }
}
```

### SOC2 Compliance Dashboard

```json
{
  "dashboard": {
    "title": "SOC2 Compliance Monitoring",
    "panels": [
      {
        "title": "Access Control Success Rate (CC6.1)",
        "targets": [{
          "expr": "sum(rate(betrace_soc2_access_control_checks_total{outcome=\"granted\"}[5m])) / sum(rate(betrace_soc2_access_control_checks_total[5m]))"
        }]
      },
      {
        "title": "Data Isolation Checks (CC6.3)",
        "targets": [{
          "expr": "sum(rate(betrace_soc2_data_isolation_checks_total[5m])) by (outcome)"
        }]
      },
      {
        "title": "Compliance Evidence Volume",
        "targets": [{
          "expr": "sum(rate(betrace_compliance_spans_emitted_total{framework=\"soc2\"}[5m])) by (control)"
        }]
      }
    ]
  }
}
```

## Integration with Flox Services

BeTrace services are managed by Flox (see `.flox/env/manifest.toml`):

```toml
[services]
backend.command = "go run ./cmd/server"
backend.vars = { OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4317" }

grafana.command = "grafana-server --config=/path/to/grafana.ini"
tempo.command = "tempo -config.file=/path/to/tempo.yaml"
prometheus.command = "prometheus --config.file=/path/to/prometheus.yaml"
```

**Start services:**
```bash
flox services start
```

**Access points:**
- Grafana: http://localhost:12015 (admin/admin)
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200

## Testing

```bash
# Run observability tests
go test ./internal/observability -v

# Run with race detector
go test ./internal/observability -race

# Benchmark observability overhead
go test ./internal/observability -bench=. -benchmem
```

## Production Checklist

- [ ] Configure OpenTelemetry exporter (Tempo endpoint)
- [ ] Set up Prometheus scraping (port 2112)
- [ ] Create Grafana dashboards (rule engine + compliance)
- [ ] Configure retention policy (Tempo: 30 days minimum for compliance)
- [ ] Set up alerting rules (high latency, violations)
- [ ] Document TraceQL queries for auditors
- [ ] Test compliance evidence export workflow
- [ ] Verify tamper-evident spans (signatures)

## Security Considerations

**Compliance Span Integrity** (from `docs/compliance-status.md`):
- ✅ HMAC-SHA256 signatures implemented
- ✅ Automatic signature generation
- ✅ Fail-secure verification

**PII Leakage Prevention**:
- ✅ Whitelist-based attribute validation
- ✅ Redaction enforcement
- ⚠️ Do NOT log PII in span attributes without `@Redact`

## References

- [docs/compliance.md](../../../docs/compliance.md) - Compliance framework details
- [docs/compliance-status.md](../../../docs/compliance-status.md) - Current compliance status
- [OpenTelemetry Specification](https://opentelemetry.io/docs/specs/otel/)
- [TraceQL Documentation](https://grafana.com/docs/tempo/latest/traceql/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
