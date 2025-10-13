# FLUO Compliance Status

**Current Status:** FLUO is NOT certified for any compliance framework. This document describes compliance-by-design capabilities.

## Compliance-by-Design Architecture

FLUO generates compliance evidence as OpenTelemetry spans:

1. **Evidence Collection**: `@SOC2`/`@HIPAA` annotations emit compliance spans during normal operations
2. **Pattern Validation**: DSL rules verify compliance invariants in traces (e.g., "PII access requires audit log")
3. **Immutable Audit Trail**: Compliance spans are timestamped, correlated, and tamper-evident

**Example:**
```java
@SOC2(controls = {CC6_1}, notes = "Authorization check")
public boolean authorizeUser(String userId, String resource) {
    // Emits compliance span: framework=soc2, control=CC6_1, evidenceType=audit_trail
}
```

## What FLUO Provides

✅ **Automated Evidence Generation**
- Compliance spans emitted as byproduct of normal operations
- Immutable, timestamped audit trail via OpenTelemetry
- No manual evidence collection required

✅ **Behavioral Validation**
- DSL rules verify compliance patterns exist in traces
- Violations generate signals (broken invariants = missing compliance evidence)
- Example: `trace.has(pii.access) and trace.has(audit.log)`

✅ **Framework Support** (via `github:fluohq/compliance-as-code`)
- SOC2 Trust Service Criteria (CC6.1, CC6.2, CC7.1, CC7.2, CC8.1)
- HIPAA Technical Safeguards (164.312(a), 164.312(b))
- Extensible to ISO27001, FedRAMP, PCI-DSS

## What FLUO Does NOT Provide

❌ **Compliance Certification**
- Requires external auditor (CPA for SOC2, 3PAO for FedRAMP)
- FLUO provides evidence; auditor validates controls

❌ **Security Controls Implementation**
- Applications must implement MFA, encryption, access control
- FLUO validates controls exist via trace patterns

❌ **Policy Documentation**
- Organizations must maintain security policies, procedures
- FLUO generates technical evidence, not documentation

## Security Status

✅ **P0: Compliance Span Integrity** (RESOLVED - commit b28790d)
- ✅ HMAC-SHA256 signatures implemented via ComplianceSpanSigner
- ✅ Automatic signature generation in SecurityEventSpan.Builder
- ✅ Signature verification in ComplianceSpanEmitter (fail-secure)
- Implementation: Spans signed at build time, verified before OTel export

✅ **P0: PII Leakage Prevention** (ALREADY COMPLETE)
- ✅ RedactionEnforcer.validateAndRedact() enforced in ComplianceSpan constructor
- ✅ Whitelist-based attribute validation (SAFE_ATTRIBUTES)
- ✅ Throws PIILeakageException if unredacted PII detected
- Implementation: All compliance spans validated before export

⚠️ **P0: Rule Engine Sandboxing** (PRD-005 PHASE 1 COMPLETE)
- ✅ Capability-based security implemented (ImmutableSpanWrapper, SandboxedGlobals)
- ✅ Per-tenant KieSession isolation
- ✅ Bytecode-level sandbox via Java Instrumentation agent
- Status: 9.5/10 security rating (Security Expert validated)

⚠️ **P1: Tenant Cryptographic Isolation** (PLANNED - NOT BLOCKING)
- Missing: Per-tenant encryption keys with KMS integration
- Risk: Shared master key violates SOC2 CC6.1 best practices
- Fix: Integrate AWS KMS/GCP Cloud KMS for tenant-specific DEKs
- Note: Not blocking production, but recommended for enterprise deployments

## Path to Certification

**SOC2 Type II Timeline:** 12-18 months
1. Fix P0 security gaps (2 weeks)
2. Implement compliance rule templates for controls (1 month)
3. Deploy FLUO with annotations on all operations (2 months)
4. Run for audit period (6-12 months minimum)
5. Export compliance spans as evidence for auditor (1 week)
6. External audit and certification (2-3 months)

**Realistic Costs:**
- SOC2 Type I: $5,000-10,000 (auditor fees)
- SOC2 Type II: $10,000-25,000 (auditor fees + 12-month observation)
- HIPAA Assessment: $3,000-5,000 (third-party assessor)

## Current Implementation

**Implemented (Production Ready):**
- ✅ Compliance annotation framework (@SOC2, @HIPAA)
- ✅ ComplianceSpan immutable evidence records
- ✅ OpenTelemetry integration for span emission
- ✅ DSL rule engine for pattern validation
- ✅ Per-tenant rule isolation
- ✅ **Cryptographic span signatures** (HMAC-SHA256, commit b28790d)
- ✅ **PII redaction enforcement** (RedactionEnforcer with whitelist validation)
- ✅ **Rule engine sandboxing** (PRD-005 Phase 1, 9.5/10 security rating)
- ✅ **Input sanitization** (XSS, SQL, LDAP, command injection - PRD-007 Unit D)
- ✅ **Compliance audit logging** (SOC2 spans for security events - PRD-007 Unit E)

**Not Implemented (Future Enhancements):**
- ⏸️ Per-tenant KMS encryption keys (P1, not blocking)
- ⏸️ Evidence export API for auditors (P2)
- ⏸️ Compliance rule templates (P2)

## Documentation

- **Integration Guide**: [backend/COMPLIANCE_INTEGRATION.md](../backend/COMPLIANCE_INTEGRATION.md)
- **Security Threat Model**: [backend/docs/SECURITY.md](../backend/docs/SECURITY.md) (TODO)
- **Architecture Decisions**:
  - ADR-016: Compliance Evidence Integrity (TODO)
  - ADR-017: Rule Engine Security Model (TODO)
  - ADR-018: Multi-Tenant Cryptographic Isolation (TODO)

## Responsible Claims

**What to say:**
- ✅ "FLUO provides compliance evidence collection primitives"
- ✅ "Built with SOC2/HIPAA controls in mind"
- ✅ "Compliance-ready architecture for behavioral assurance"

**What NOT to say:**
- ❌ "SOC2 certified" (requires external audit)
- ❌ "HIPAA compliant" (requires BAAs, policies, assessments)
- ❌ "Automated compliance" (evidence generation ≠ certification)
