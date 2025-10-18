---
name: Compliance Evidence Expert
description: Guides SOC2/HIPAA compliance annotation usage, evidence generation patterns, and audit trail implementation
---

# Compliance Evidence Expert Skill

## Purpose

Provides expertise in compliance-by-design for FLUO's behavioral assurance system.

## When to Use This Skill

Load this skill when:
- Adding compliance annotations (`@SOC2`, `@HIPAA`)
- Implementing audit trails
- Validating PII redaction
- Designing compliance evidence patterns
- Preparing for audits

## Quick Reference

### SOC2 Controls
- **CC6.1**: Authorization checks
- **CC6.2**: User provisioning/de-provisioning
- **CC6.3**: Tenant data isolation
- **CC6.6**: Encryption at rest
- **CC7.1**: Security event detection
- **CC7.2**: System monitoring/audit logging
- **CC8.1**: Change management

### HIPAA Safeguards
- **164.312(a)(2)(i)**: Unique user identification
- **164.312(a)(2)(iv)**: Encryption/decryption
- **164.312(b)**: Audit controls

## Usage Patterns

### Authorization with Audit Trail
```java
@SOC2(controls = {CC6_1, CC7_2}, notes = "Authorization with audit")
@HIPAA(safeguards = {"164.312(b)"}, notes = "Audit controls")
public boolean authorizeAccess(String userId, String resource) {
    // Compliance span automatically emitted
    return authService.check(userId, resource);
}
```

### PII Redaction
```java
@Redact(strategy = RedactionStrategy.HASH)
private String emailAddress;

@Redact(strategy = RedactionStrategy.MASK)
private String creditCardNumber;
```

### DSL Validation Rules
```javascript
// SOC2 CC7.2: PII access requires audit log
trace.has(pii.access) and trace.has(audit.log)

// SOC2 CC6.1: Authorization before data access
trace.has(data.access) and trace.has(auth.check)
```

## Evidence Queries (TraceQL)

```
// All SOC2 CC6.1 events
{span.compliance.framework = "soc2" && span.compliance.control = "CC6_1"}

// Failed authorization attempts
{span.compliance.framework = "soc2" && span.compliance.outcome = "denied"}

// HIPAA audit logs
{span.compliance.framework = "hipaa" && span.hipaa.patient_id = "patient-123"}
```

## Progressive Disclosure

For detailed compliance guidance:
1. `soc2-patterns.md` - SOC2 control implementation examples
2. `hipaa-patterns.md` - HIPAA safeguard patterns
3. `audit-evidence-guide.md` - Evidence collection best practices

See also: [@docs/compliance.md](../../docs/compliance.md), [@docs/compliance-status.md](../../docs/compliance-status.md)
