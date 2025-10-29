# BeTrace Compliance Evidence System

BeTrace generates compliance evidence through OpenTelemetry spans emitted by the Go backend.

## Quick Start

### 1. Emit Compliance Evidence in Code

```go
import "github.com/betracehq/betrace/backend/internal/observability"

// SOC2 CC6.1: Access control check
func authorizeUser(ctx context.Context, userID, resource string) bool {
    granted := authService.Check(userID, resource)

    // Emit compliance evidence span
    observability.EmitSOC2AccessControl(ctx, userID, resource, granted)

    return granted
}
```

### 2. Define BeTrace Rules to Validate Compliance

```javascript
// SOC2 CC7_2: PII access requires audit logging
trace.has(database.query).where(data.contains_pii == true)
  and trace.has(audit.log)

// SOC2 CC6_1: Authorization before data access
trace.has(data.access) and trace.has(auth.check)
```

### 3. Query Compliance Evidence

Compliance spans are queryable via OpenTelemetry/Grafana for auditor review.

## How It Works

1. **Emit Evidence**: Go functions emit OpenTelemetry spans with compliance attributes
2. **Pattern Validation**: BeTrace rules verify compliance invariants in traces
3. **Tamper-Evident**: Spans include cryptographic signatures (HMAC-SHA256)
4. **Queryable**: Evidence searchable via TraceQL in Grafana/Tempo

## Implementation

Located in `backend/internal/observability/`:
- `tracing.go` - Compliance span emission functions
- `metrics.go` - Prometheus metrics for compliance events
- See [backend/internal/observability/IMPLEMENTATION_SUMMARY.md](../backend/internal/observability/IMPLEMENTATION_SUMMARY.md) for complete documentation

## Supported Frameworks

### SOC2 Trust Service Criteria
- **CC6.1** - Logical Access Controls (authorization)
- **CC6.2** - Access Provisioning (user management)
- **CC6.3** - Data Isolation (tenant boundaries)
- **CC6.6** - Encryption at Rest
- **CC6.7** - Encryption in Transit
- **CC7.1** - System Monitoring (detection)
- **CC7.2** - System Performance (audit logging)
- **CC8.1** - Change Management

### HIPAA Technical Safeguards
- **164.312(a)** - Access Control (authentication)
- **164.312(b)** - Audit Controls (activity logging)
- **164.312(a)(2)(i)** - Unique User Identification
- **164.312(a)(2)(iv)** - Encryption/Decryption
- **164.312(e)(2)(ii)** - Transmission Security

### Other Frameworks
- **FedRAMP**: AC-2, AC-3, AU-2, AU-3, CM-2 (access control, auditing)
- **ISO27001**: A.9.2.1, A.9.4.1, A.12.4.1 (access, logging, monitoring)
- **PCI-DSS**: 7.1, 8.2, 10.2 (access control, logging)

## OpenTelemetry Integration

### Compliance Span Attributes

```json
{
  "span.name": "compliance.evidence",
  "span.attributes": {
    "compliance.framework": "soc2",
    "compliance.control": "CC6_1",
    "compliance.evidenceType": "audit_trail",
    "compliance.tenantId": "tenant-123",
    "compliance.outcome": "success"
  }
}
```

### Query Compliance Spans in Grafana

**TraceQL Query:**
```
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}
```

**Prometheus Query (Span Metrics):**
```
sum by (compliance_control) (
  rate(traces_spanmetrics_calls_total{compliance_framework="soc2"}[5m])
)
```

## Usage Examples

### SOC2 Access Control (CC6.1)
```go
observability.EmitSOC2AccessControl(ctx, "user-123", "/api/data", true)
```

### SOC2 Data Isolation (CC6.3)
```go
observability.EmitSOC2DataIsolation(ctx, "tenant-abc", "query", true)
```

### HIPAA Access Logging (164.312(b))
```go
observability.EmitHIPAAAccessLog(ctx, "doctor-smith", "view_patient", "medical_record")
```

### HIPAA Encryption (164.312(a)(2)(iv))
```go
observability.EmitHIPAAEncryption(ctx, "encrypt", "patient_ssn", true)
```

### GDPR Data Access (Art. 15)
```go
observability.EmitGDPRDataAccess(ctx, "user-jane", "data_export", true)
```

### FedRAMP Audit Event (AU-2)
```go
observability.EmitFedRAMPAuditEvent(ctx, "admin", "admin-bob", "update_policy")
```

## Security Status

**Implemented Security Controls:**
- ✅ Compliance span signatures (HMAC-SHA256)
- ✅ PII redaction enforcement (whitelist validation)
- ✅ Rule engine sandboxing (9.5/10 security rating)
- ⏸️ Per-tenant KMS encryption (planned, not blocking)

See [docs/compliance-status.md](compliance-status.md) for detailed security audit.

## Certification Status

**BeTrace is NOT certified for any compliance framework.**

- ✅ Compliance evidence generation (production-ready)
- ✅ Pattern validation via DSL rules
- ❌ External auditor required for certification
- ⏸️ Path to SOC2 Type II: 12-18 months + $10-25K

## References

- [compliance-status.md](compliance-status.md) - Security status and realistic timeline
- [technical/trace-rules-dsl.md](technical/trace-rules-dsl.md) - DSL syntax for pattern validation
- [backend/internal/observability/IMPLEMENTATION_SUMMARY.md](../backend/internal/observability/IMPLEMENTATION_SUMMARY.md) - Complete implementation guide
