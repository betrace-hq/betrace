# FLUO Compliance Evidence System

FLUO generates compliance evidence through OpenTelemetry spans using annotations from `github:fluohq/compliance-as-code`.

## Quick Start

### 1. Annotate Code with Compliance Controls

```java
@SOC2(controls = {CC6_1}, notes = "User authorization check")
public boolean authorizeUser(String userId, String resource) {
    // Emits compliance span with:
    // - framework: "soc2"
    // - control: "CC6_1"
    // - evidenceType: "audit_trail"
    return authService.check(userId, resource);
}
```

### 2. Define FLUO Rules to Validate Compliance

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

1. **Flake Integration**: `flake.nix` imports `compliance-as-code#java-soc2`
2. **Code Generation**: Java annotations copied to `src/main/java/com/fluo/compliance/`
3. **Annotation Usage**: Methods annotated with `@SOC2`, `@HIPAA`, etc.
4. **Evidence Generation**: Annotations emit OpenTelemetry spans with compliance attributes
5. **Pattern Validation**: FLUO rules verify compliance invariants in traces

## Generated Files

Located in `src/main/java/com/fluo/compliance/`:
- `annotations/` - `@SOC2`, `@SOC2Controls`, `@SOC2Evidence`
- `models/` - Control definitions (CC6_1, CC6_2, CC7_1, etc.)
- `evidence/` - `ComplianceSpan`, `@PII`, `@Sensitive`, `@Redact`

Files auto-generated on `nix develop` and `nix build`.

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

## Security Considerations

**P0 Security Gaps (See @docs/compliance-status.md):**
1. ⚠️ Compliance spans need cryptographic signatures (tamper-evidence)
2. ⚠️ PII redaction enforcement before OTel export
3. ⚠️ Rule engine sandboxing (prevent service layer access)
4. ⚠️ Per-tenant encryption keys with KMS integration

## Integration with FLUO's Purpose

FLUO's behavioral assurance proves compliance:

1. **SREs**: Discover undocumented compliance gaps
   - "We assumed auth checks existed, traces show violations"

2. **Developers**: Enforce compliance requirements via annotations
   - "@SOC2 annotation ensures audit logs are generated"

3. **Compliance**: Prove controls work in production
   - "All PII access has compliance spans proving monitoring"

## Reality Check

**FLUO Status:**
- ✅ Compliance evidence generation (spans emitted)
- ✅ Pattern validation (DSL rules)
- ❌ NOT certified for any framework (see @docs/compliance-status.md)
- ❌ Security gaps must be fixed before production
- ❌ External auditor required for certification

**Path to Certification:** 12-18 months + $10-25K auditor fees for SOC2 Type II

## References

- **@docs/compliance-status.md** - Current status, security gaps, realistic timeline
- **@docs/technical/trace-rules-dsl.md** - DSL syntax for compliance pattern validation
- **github:fluohq/compliance-as-code** - Upstream annotation definitions
