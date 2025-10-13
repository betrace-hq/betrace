# PRD-001e: Authentication Chain Security Enhancements (P1)

**Status:** DRAFT
**Priority:** P1 (Nice-to-Have)
**Depends On:** PRD-001d (Authentication Chain Integrity - COMPLETED)
**Created:** 2025-10-12

## Context

PRD-001d successfully implemented authentication chain integrity with HMAC-SHA256 signatures and achieved **9.5/10 Security Expert rating** and **9/10 QA Expert rating**. Both experts approved the implementation as **PRODUCTION READY** but identified optional P1 enhancements for future consideration.

## Problem Statement

While the current implementation is production-ready, there are three optional improvements that would further strengthen the security posture:

1. **HMAC-SHA256 Upgrade** - Current implementation uses SHA-256 directly; HMAC-SHA256 provides additional key derivation and is the industry standard for message authentication
2. **Secret Rotation Documentation** - No formal runbook for rotating secrets in production
3. **Monitoring & Alerting** - No metrics for signature verification failures

## Goals

### P1 Enhancements (Optional)
1. Upgrade signature generation from SHA-256 to HMAC-SHA256
2. Create ADR-019 documenting authentication chain security decisions
3. Add secret rotation runbook with zero-downtime strategy
4. Add metrics for signature verification success/failure rates
5. Add test coverage for duplicate roles and max role length edge cases

### Non-Goals
- ❌ Timestamp-based replay attack prevention (separate PRD needed)
- ❌ Signature expiration (requires architectural changes)
- ❌ Per-request nonces (out of scope)

## Proposed Solution

### 1. HMAC-SHA256 Implementation

**Current (SHA-256):**
```java
MessageDigest digest = MessageDigest.getInstance("SHA-256");
digest.update(secret.getBytes(StandardCharsets.UTF_8));
digest.update(payload.getBytes(StandardCharsets.UTF_8));
byte[] hash = digest.digest();
```

**Proposed (HMAC-SHA256):**
```java
Mac mac = Mac.getInstance("HmacSHA256");
SecretKeySpec keySpec = new SecretKeySpec(
    secret.getBytes(StandardCharsets.UTF_8),
    "HmacSHA256"
);
mac.init(keySpec);
byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
```

**Benefits:**
- Industry standard for message authentication
- Additional key derivation step
- More resilient to length extension attacks
- Explicit key separation from message

### 2. Documentation & Runbooks

**ADR-019: Authentication Chain Security**
```markdown
# Decision: HMAC-SHA256 for processor authentication chain
# Context: Prevent authentication bypass via cryptographic signatures
# Alternatives: JWT tokens, mutual TLS, shared secrets
# Decision: HMAC-SHA256 signatures with per-deployment secret
# Consequences: Zero-trust between processors, key management required
```

**Secret Rotation Runbook:**
```markdown
# Production Secret Rotation

## Zero-Downtime Strategy
1. Generate new secret: `NEW_SECRET=$(openssl rand -base64 32)`
2. Deploy pods with dual-secret support (verify old OR new)
3. Wait for all pods to pick up new config
4. Update secret to new value only
5. Verify no verification failures in metrics

## Rollback Plan
If verification failures spike:
1. Revert to dual-secret mode
2. Investigate failure cause
3. Fix and retry rotation
```

### 3. Metrics & Monitoring

**Add Micrometer Metrics:**
```java
@Inject
MeterRegistry registry;

public boolean verifyAuthContext(UUID tenantId, List<String> roles, String signature) {
    boolean valid = constantTimeCompare(expected, signature);

    registry.counter("fluo.auth.signature.verification",
        "result", valid ? "success" : "failure",
        "tenant_id", tenantId.toString()
    ).increment();

    if (!valid) {
        logger.warn("Signature verification failed for tenant {}", tenantId);
    }

    return valid;
}
```

**Grafana Alert:**
```yaml
# Alert if signature failure rate > 5% over 5 minutes
- alert: HighAuthSignatureFailureRate
  expr: |
    rate(fluo_auth_signature_verification_total{result="failure"}[5m])
    / rate(fluo_auth_signature_verification_total[5m]) > 0.05
  for: 5m
  annotations:
    summary: "High authentication signature failure rate"
    description: "{{ $value | humanizePercentage }} of signature verifications failing"
```

### 4. Additional Test Coverage

**Duplicate Roles Test:**
```java
@Test
void testSignatureWithDuplicateRoles() {
    String sig1 = service.signAuthContext(TENANT_ID, List.of("admin", "user"));
    String sig2 = service.signAuthContext(TENANT_ID, List.of("admin", "admin", "user"));
    assertEquals(sig1, sig2, "Duplicate roles should be canonicalized");
}
```

**Maximum Role Length Test:**
```java
@Test
void testSignatureWithLongRoleName() {
    String longRole = "a".repeat(1000);
    String sig = service.signAuthContext(TENANT_ID, List.of(longRole));
    assertTrue(service.verifyAuthContext(TENANT_ID, List.of(longRole), sig));
}
```

## Implementation Plan

### Phase 1: HMAC Upgrade (2 hours)
1. Update AuthSignatureService to use `Mac.getInstance("HmacSHA256")`
2. Update all 18 tests to verify HMAC behavior
3. Verify backward compatibility (old signatures fail, new signatures succeed)

### Phase 2: Documentation (2 hours)
1. Create ADR-019: Authentication Chain Security
2. Write secret-rotation-runbook.md
3. Update backend/docs/SECURITY.md with threat model

### Phase 3: Monitoring (2 hours)
1. Add Micrometer metrics to AuthSignatureService
2. Create Grafana dashboard for signature verification
3. Add alert rules for high failure rates

### Phase 4: Test Enhancements (1 hour)
1. Add duplicate roles test
2. Add max role length test
3. Verify 100% instruction coverage maintained

## Testing Strategy

### Unit Tests
- ✅ Existing 18 tests remain valid
- ➕ Add 2 new edge case tests (duplicates, long names)
- ✅ Verify HMAC-SHA256 produces different signatures than SHA-256

### Integration Tests
- ✅ ExtractTenantAndRolesProcessorTest (23 tests) should pass unchanged
- ➕ Test signature verification failure metrics incremented

### Performance Tests
- ✅ Verify HMAC-SHA256 performance similar to SHA-256 (should be ~same)

## Success Metrics

- ✅ All 20 AuthSignatureService tests passing (18 existing + 2 new)
- ✅ ADR-019 created and peer-reviewed
- ✅ Secret rotation runbook documented
- ✅ Metrics visible in Grafana dashboard
- ✅ Alert fires when failure rate > 5%

## Risks & Mitigations

### Risk: HMAC change breaks existing signatures
**Mitigation:** This is a breaking change. Deploy requires:
1. Regenerate all signatures (restart all pods)
2. Or implement dual-mode (verify SHA-256 OR HMAC for transition)

### Risk: Metrics overhead impacts performance
**Mitigation:** Micrometer counters are extremely low overhead (~10ns)

### Risk: Documentation gets stale
**Mitigation:** Link docs from CLAUDE.md so AI agents can maintain

## Open Questions

1. Should we support dual-mode verification (SHA-256 OR HMAC) for gradual migration?
2. Should secret rotation be automated (e.g., monthly via Kubernetes CronJob)?
3. Should we add signature expiration (requires timestamp in payload)?

## Approval

**Security Expert:** N/A (P1 enhancements, not blocking)
**QA Expert:** N/A (P1 enhancements, not blocking)
**Product Owner:** TBD

## References

- PRD-001d: Authentication Chain Integrity (COMPLETED)
- Security Expert Review: 9.5/10 with P1 recommendations
- QA Expert Review: 9/10 with P1 recommendations
- NIST SP 800-107r1: Recommendation for Applications Using Approved Hash Algorithms
