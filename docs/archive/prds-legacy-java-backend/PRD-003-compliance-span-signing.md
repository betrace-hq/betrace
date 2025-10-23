# PRD-003: Compliance Span Cryptographic Signing

**Status:** Draft
**Priority:** P0 (Foundation)
**Owner:** Backend Team
**Depends On:** PRD-006a (KMS Integration with Ed25519 signing keys - COMPLETED)

## Overview

BeTrace generates compliance evidence as ComplianceSpan objects emitted during normal application operations. Currently, these spans lack cryptographic integrity protection, creating a **P0 security gap**: evidence could be modified after generation without detection, undermining the entire compliance-by-design value proposition.

This PRD implements **Ed25519 digital signatures** for all compliance spans, providing cryptographically verifiable tamper-evidence. External auditors can verify span integrity using tenant public keys exported via REST API, enabling BeTrace to claim "cryptographically-assured audit trails" as a competitive differentiator.

## Problem Statement

**Current State:**
- ComplianceSpan objects emitted with framework/control/evidence metadata
- Spans stored as OpenTelemetry attributes (mutable after emission)
- No integrity protection → Malicious actor could modify span attributes post-emission
- Auditors have no way to verify evidence wasn't tampered with

**Business Impact:**
- Cannot claim "tamper-evident audit trail" in marketing
- Weaker compliance posture than competitors with signed audit logs
- Risk: Evidence rejected by auditors if integrity questioned
- Blocked from SOC2 Type II "strong integrity controls" differentiator

**Compliance Requirements:**
- **SOC2 CC6.1** (Logical Access Controls): Prevent unauthorized modifications to audit evidence
- **SOC2 CC8.1** (Change Management): Detect unauthorized changes to compliance records
- **HIPAA 164.312(b)** (Audit Controls): Mechanisms to protect against improper alteration

**Technical Blocker:**
Ed25519 signing keys now available (PRD-006a completed), unblocking implementation.

## Goals

1. **Tamper Evidence:** 95%+ of compliance spans signed with Ed25519 signatures within 24 hours of feature deployment
2. **Auditor Verification:** External auditors can verify signatures using REST API + reference script (no BeTrace access required)
3. **Performance:** Signing overhead <5ms p99 (asynchronous, non-blocking)
4. **Tenant Isolation:** Per-tenant signing keys, spans signed with tenant's private key
5. **Fail-Open:** Unsigned spans allowed if signing fails (availability > integrity for evidence collection)
6. **Key Rotation:** Support 2 active keys per tenant (current + previous) for zero-downtime rotation

## Non-Goals

1. **Signature Revocation:** No support for revoking individual span signatures (Phase 2)
2. **Timestamping Service:** No RFC 3161 trusted timestamps (Ed25519 includes timestamp in signed data)
3. **Non-Repudiation:** Signatures prove integrity, not authorship (tenant keys could be shared)
4. **Backfilling Legacy Spans:** No re-signing of pre-existing unsigned spans
5. **Real-Time Verification:** No live signature verification during span emission (performance impact)
6. **Cross-Tenant Verification:** Tenants cannot verify other tenants' spans (tenant isolation)

## User Stories

### US-1: External Auditor Verification
**As an** external SOC2 auditor
**I want to** verify compliance span signatures using a public key
**So that** I can confirm evidence wasn't tampered with after generation

**Acceptance Criteria:**
- [ ] GET /api/tenants/{tenantId}/public-keys returns active public keys (keyId, algorithm, publicKey base64, createdAt)
- [ ] GET /api/compliance-spans?tenantId=X includes signature field (base64) and keyId
- [ ] Reference verification script (Python/Node.js) provided in docs
- [ ] Script verifies 1000 sample spans in <30 seconds
- [ ] Invalid signatures detected with clear error message

### US-2: Automatic Span Signing
**As a** BeTrace backend service
**I want to** automatically sign compliance spans when emitted
**So that** evidence integrity is cryptographically protected without developer intervention

**Acceptance Criteria:**
- [ ] All ComplianceSpan objects signed before OpenTelemetry export
- [ ] Signature generation <5ms p99 latency
- [ ] Signing failures logged with P0 alert, span emitted unsigned
- [ ] Signed spans include `span.signature.status=signed` attribute
- [ ] Unsigned spans include `span.signature.status=signing_failed` attribute

### US-3: Key Rotation Support
**As a** tenant administrator
**I want to** rotate signing keys without losing historical span verification
**So that** compliance with key rotation policies (e.g., annual rotation) is maintained

**Acceptance Criteria:**
- [ ] Support 2 active keys per tenant (current + previous)
- [ ] Old spans verifiable with previous key after rotation
- [ ] Zero failed span signatures during rotation window
- [ ] Key expiration tracked with `expiresAt` timestamp

### US-4: Legacy Span Handling
**As a** compliance dashboard user
**I want to** distinguish between signed, unsigned, and legacy spans
**So that** I understand integrity guarantees for different evidence types

**Acceptance Criteria:**
- [ ] Legacy spans (before feature deployment) tagged `span.signature.status=legacy`
- [ ] Dashboard shows span counts by signature status
- [ ] API filters: `?signatureStatus=signed|unsigned|legacy`
- [ ] Documentation explains legacy span handling

### US-5: Signature Verification Failure Handling
**As a** BeTrace operator
**I want to** be alerted when signature verification fails
**So that** potential tampering is detected and investigated

**Acceptance Criteria:**
- [ ] Verification failures logged with span ID, tenant ID, reason
- [ ] Failed spans tagged `span.signature.valid=false`
- [ ] Metrics: `compliance_signature_verification_failures_total` counter
- [ ] Alert triggered if failure rate >0.1% over 1 hour

## Technical Design

### 1. ComplianceSpan Schema Changes

**New Fields:**

```java
public class ComplianceSpan {
    // Existing fields
    private String framework;          // "soc2", "hipaa"
    private String control;            // "CC6_1", "164.312(a)"
    private EvidenceType evidenceType; // AUDIT_TRAIL, ACCESS_CONTROL
    private UUID tenantId;
    private Instant timestamp;
    private String outcome;            // "success", "failure"
    private Map<String, String> metadata;

    // NEW: Signature fields
    private String signature;          // Base64-encoded Ed25519 signature
    private UUID keyId;                // Key used for signing (for key rotation)
    private SignatureStatus status;    // SIGNED, UNSIGNED, SIGNING_FAILED, LEGACY

    // NEW: Signature methods
    public String getCanonicalRepresentation();  // For signing/verification
    public void sign(PrivateKey privateKey, UUID keyId);
    public boolean verify(PublicKey publicKey);
}
```

**SignatureStatus Enum:**

```java
public enum SignatureStatus {
    SIGNED,          // Successfully signed
    UNSIGNED,        // Not signed (pre-signature feature)
    SIGNING_FAILED,  // Attempted signing but failed
    LEGACY           // Span created before signature feature deployed
}
```

**Canonical Representation:**

Data signed (pipe-delimited, sorted fields, UTF-8 bytes):
```
framework|control|evidenceType|tenantId|timestamp|outcome
```

**Example:**
```
soc2|CC6_1|AUDIT_TRAIL|550e8400-e29b-41d4-a716-446655440000|2025-10-12T18:00:00Z|success
```

**Excluded from Signature:**
- `metadata` (too variable, not critical for integrity)
- `signature` (circular dependency)
- `keyId` (included in verification separately)
- `status` (derived field)

### 2. Signature Generation

**Location:** `ComplianceSpanProcessor.java`

**Flow:**

```java
@Override
public void onStart(Context parentContext, ReadWriteSpan span) {
    // 1. Extract compliance metadata from span
    ComplianceSpan complianceSpan = extractComplianceMetadata(span);

    // 2. Attempt signing (asynchronous, non-blocking)
    try {
        UUID tenantId = complianceSpan.getTenantId();
        PrivateKey privateKey = kms.getTenantSigningKey(tenantId);
        UUID keyId = getCurrentKeyId(tenantId);

        // Sign canonical representation
        complianceSpan.sign(privateKey, keyId);
        complianceSpan.setStatus(SignatureStatus.SIGNED);

        // Log success
        metricsService.recordSignatureGeneration(tenantId, "success");

    } catch (KmsException e) {
        // Fail-open: Emit unsigned span with failure status
        Log.error("Failed to sign compliance span", e);
        complianceSpan.setStatus(SignatureStatus.SIGNING_FAILED);
        metricsService.recordSignatureGeneration(tenantId, "failure");
        alertService.sendP0Alert("Compliance span signing failed", e);
    }

    // 3. Emit span with signature (or unsigned if signing failed)
    addComplianceAttributes(span, complianceSpan);
}
```

**Algorithm:**

```java
public void sign(PrivateKey privateKey, UUID keyId) {
    this.keyId = keyId;

    // Generate canonical representation
    String canonical = getCanonicalRepresentation();
    byte[] data = canonical.getBytes(StandardCharsets.UTF_8);

    // Sign with Ed25519
    Signature signer = Signature.getInstance("Ed25519");
    signer.initSign(privateKey);
    signer.update(data);
    byte[] signatureBytes = signer.sign();

    // Store as Base64
    this.signature = Base64.getEncoder().encodeToString(signatureBytes);
}
```

**Performance:**
- Target: <5ms p99 per span
- Ed25519 signing: ~0.5ms per signature
- Key retrieval: <1ms (cached in KeyManagementService)
- Overhead budget: 3.5ms for canonical representation + encoding

### 3. Signature Verification

**API Endpoint:**

```http
GET /api/compliance-spans?tenantId={tenantId}&signatureStatus=signed
```

**Response:**

```json
{
  "spans": [
    {
      "framework": "soc2",
      "control": "CC6_1",
      "evidenceType": "AUDIT_TRAIL",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2025-10-12T18:00:00Z",
      "outcome": "success",
      "signature": "base64-encoded-signature",
      "keyId": "a1b2c3d4-...",
      "status": "SIGNED"
    }
  ],
  "publicKeys": {
    "a1b2c3d4-...": {
      "keyId": "a1b2c3d4-...",
      "algorithm": "Ed25519",
      "publicKey": "base64-encoded-public-key",
      "createdAt": "2025-10-01T00:00:00Z",
      "expiresAt": "2026-10-01T00:00:00Z"
    }
  }
}
```

**Public Key Export Endpoint:**

```http
GET /api/tenants/{tenantId}/public-keys
```

**Response:**

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "keys": [
    {
      "keyId": "a1b2c3d4-...",
      "algorithm": "Ed25519",
      "publicKey": "base64-encoded-public-key",
      "createdAt": "2025-10-01T00:00:00Z",
      "expiresAt": "2026-10-01T00:00:00Z",
      "status": "ACTIVE"
    },
    {
      "keyId": "previous-key-id",
      "algorithm": "Ed25519",
      "publicKey": "base64-encoded-public-key",
      "createdAt": "2024-10-01T00:00:00Z",
      "expiresAt": "2025-10-01T00:00:00Z",
      "status": "DEPRECATED"
    }
  ]
}
```

**Verification Algorithm:**

```java
public boolean verify(PublicKey publicKey) {
    if (signature == null || signature.isEmpty()) {
        return status == SignatureStatus.LEGACY; // Legacy spans considered valid
    }

    try {
        // Reconstruct canonical representation
        String canonical = getCanonicalRepresentation();
        byte[] data = canonical.getBytes(StandardCharsets.UTF_8);

        // Verify Ed25519 signature
        Signature verifier = Signature.getInstance("Ed25519");
        verifier.initVerify(publicKey);
        verifier.update(data);

        byte[] signatureBytes = Base64.getDecoder().decode(signature);
        return verifier.verify(signatureBytes);

    } catch (Exception e) {
        Log.error("Signature verification failed", e);
        return false;
    }
}
```

**Reference Verification Script (Python):**

```python
# verify_compliance_spans.py
import base64
import requests
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

def verify_compliance_span(span, public_key_pem):
    # Reconstruct canonical representation
    canonical = f"{span['framework']}|{span['control']}|{span['evidenceType']}|{span['tenantId']}|{span['timestamp']}|{span['outcome']}"
    data = canonical.encode('utf-8')

    # Load public key
    public_key = serialization.load_pem_public_key(
        public_key_pem.encode('utf-8')
    )

    # Verify signature
    signature_bytes = base64.b64decode(span['signature'])
    try:
        public_key.verify(signature_bytes, data)
        return True
    except Exception as e:
        print(f"Verification failed: {e}")
        return False

# Usage:
# spans = requests.get('https://fluo.example.com/api/compliance-spans?tenantId=X').json()
# public_keys = requests.get('https://fluo.example.com/api/tenants/X/public-keys').json()
# for span in spans['spans']:
#     key = public_keys['keys'][span['keyId']]
#     assert verify_compliance_span(span, key['publicKey'])
```

### 4. Integration Points

**Files Requiring Changes:**

1. **ComplianceSpan.java** (backend/src/main/java/com/fluo/compliance/evidence/)
   - Add `signature`, `keyId`, `status` fields
   - Implement `sign()`, `verify()`, `getCanonicalRepresentation()` methods

2. **ComplianceSpanProcessor.java** (backend/src/main/java/com/fluo/compliance/telemetry/)
   - Inject `KeyManagementService`
   - Add signing logic in `onStart()` method
   - Emit signature attributes to OpenTelemetry

3. **ComplianceSpanController.java** (NEW - backend/src/main/java/com/fluo/routes/)
   - Implement `GET /api/compliance-spans` endpoint
   - Implement `GET /api/tenants/{tenantId}/public-keys` endpoint
   - Filter by signature status

4. **KeyManagementService.java** (backend/src/main/java/com/fluo/kms/)
   - Add `getCurrentKeyId(UUID tenantId)` method
   - Add `getActiveKeys(UUID tenantId)` method (returns current + previous)

5. **MetricsService.java** (backend/src/main/java/com/fluo/services/)
   - Add `recordSignatureGeneration(UUID tenantId, String status)` metric
   - Add `recordSignatureVerification(UUID tenantId, boolean valid)` metric

**Dependencies:**
- KeyManagementService (already implemented in PRD-006a)
- BouncyCastle Ed25519 provider (already added to pom.xml)

### 5. Error Handling

**Signing Failures:**

| Failure Scenario | Behavior | Alert Level |
|------------------|----------|-------------|
| KeyManagementService unavailable | Emit unsigned span (`SIGNING_FAILED`), log error | P0 alert |
| Tenant key not found | Generate key lazily, retry signing | P1 alert if >5 failures |
| Signature generation exception | Emit unsigned span, log stack trace | P0 alert |
| Performance timeout (>10ms) | Emit unsigned span, log slow operation | P2 alert |

**Verification Failures:**

| Failure Scenario | Behavior | Alert Level |
|------------------|----------|-------------|
| Invalid signature | Tag span `signature.valid=false`, log | P1 alert if >0.1% failure rate |
| Public key not found | Return HTTP 404 with clear error message | No alert (user error) |
| Malformed signature | Tag span `signature.valid=false`, log | P2 alert |
| Algorithm mismatch | Return HTTP 400 (invalid request) | No alert (user error) |

**Fail-Open Principle:**
- Span emission ALWAYS succeeds (availability > integrity for evidence collection)
- Unsigned spans still provide value (metadata + timestamp evidence)
- Signature failures logged for operational visibility, not blocking

## Security Considerations

### Threat Model

**Threat T-1: Evidence Tampering**
- **Attack:** Attacker modifies span attributes in storage/transit
- **Mitigation:** Ed25519 signature detects modifications
- **Residual Risk:** Attacker with private key access can forge signatures (key protection critical)

**Threat T-2: Key Compromise**
- **Attack:** Attacker obtains tenant private signing key
- **Mitigation:** Keys encrypted at rest (PRD-006a), access logged
- **Residual Risk:** Insider with KMS access can extract keys (future: HSM integration)

**Threat T-3: Signature Replay**
- **Attack:** Attacker copies valid signature to forged span
- **Mitigation:** Signature includes timestamp (spans with identical timestamps suspicious)
- **Residual Risk:** Attacker can replay within same millisecond (future: nonces)

**Threat T-4: Key Rotation Attacks**
- **Attack:** Attacker exploits window between key rotation and signature update
- **Mitigation:** Support 2 active keys (current + previous), grace period
- **Residual Risk:** None (both keys valid during rotation)

### Security Requirements

1. **P0: Private Key Protection**
   - Private keys NEVER leave KeyManagementService
   - Keys encrypted at rest with tenant DEKs
   - Access logged for audit trail

2. **P0: Tenant Isolation**
   - Tenant A cannot sign spans for Tenant B
   - Public key export requires tenant-scoped authorization
   - Key IDs globally unique (UUID)

3. **P1: Signature Algorithm Security**
   - Ed25519 (NIST FIPS 186-5 approved)
   - 128-bit security level
   - Resistant to timing attacks (constant-time verification)

4. **P1: Canonical Representation Stability**
   - Field ordering fixed (alphabetical: control, evidenceType, framework, outcome, tenantId, timestamp)
   - Encoding fixed (UTF-8, no BOM)
   - Format versioning for future changes

5. **P2: Public Key Distribution**
   - HTTPS-only for key export endpoint
   - API authentication required (no anonymous key access)
   - Rate limiting (100 req/min per tenant)

## Testing Requirements

### Unit Tests

1. **ComplianceSpanTest.java**
   - `testSignAndVerify()` - Sign span, verify with public key
   - `testCanonicalRepresentation()` - Canonical format stable
   - `testVerifyFailsWithModifiedData()` - Tampering detected
   - `testVerifyFailsWithWrongKey()` - Wrong key rejected
   - `testLegacySpanVerification()` - Legacy spans considered valid
   - `testSigningFailureHandling()` - Graceful failure handling

2. **ComplianceSpanProcessorTest.java**
   - `testSpanSignedOnEmission()` - All spans signed automatically
   - `testSigningFailureEmitsUnsignedSpan()` - Fail-open behavior
   - `testPerformanceUnder5ms()` - Signing latency <5ms p99
   - `testKeyRotationSupport()` - Old key still verifies spans

3. **ComplianceSpanControllerTest.java**
   - `testPublicKeyExport()` - Endpoint returns valid keys
   - `testSpanVerificationAPI()` - Verification endpoint works
   - `testUnauthorizedKeyAccess()` - Tenant isolation enforced

### Integration Tests

1. **End-to-End Signing Test**
   - Generate 1000 compliance spans
   - Verify 100% have signatures
   - Export via API
   - Verify all signatures with reference script

2. **Key Rotation Test**
   - Generate spans with Key A
   - Rotate to Key B
   - Verify old spans still validate with Key A
   - Verify new spans validate with Key B

3. **Performance Test**
   - Generate 10,000 spans concurrently
   - Measure signing latency (p50, p99, max)
   - Assert p99 <5ms

### Compliance Tests

1. **Auditor Verification Workflow**
   - Export 100 sample spans via API
   - Provide reference verification script
   - Auditor verifies all signatures offline
   - Success: 100% verification rate

2. **Tampering Detection**
   - Generate signed span
   - Modify span attribute in storage
   - Attempt verification
   - Assert: Verification fails with clear error

## Success Metrics

**Metric 1: Signing Success Rate**
- **Target:** 99.9% of compliance spans successfully signed
- **Measurement:** `compliance_signature_generation_success_rate` (24hr window)
- **Alert:** <99% triggers P1 investigation

**Metric 2: Verification Latency**
- **Target:** p99 verification latency <200ms
- **Measurement:** `compliance_signature_verification_duration_seconds` histogram
- **Alert:** p99 >500ms triggers P2 performance investigation

**Metric 3: Signature Integrity**
- **Target:** <0.01% signature verification failures (excludes tampered spans)
- **Measurement:** `compliance_signature_verification_failures_total` counter
- **Alert:** >0.1% failure rate triggers P1 security investigation

**Metric 4: Auditor Satisfaction**
- **Target:** External auditor successfully verifies 1000+ spans in <10 minutes
- **Measurement:** Manual audit readiness test
- **Success:** Auditor reports "no concerns" on evidence integrity

**Metric 5: Key Rotation Downtime**
- **Target:** Zero signature failures during key rotation
- **Measurement:** Manual key rotation test with span generation
- **Success:** 100% signing success during rotation window

## Timeline & Phasing

### Phase 1: Core Signing (Week 1-2)
**Scope:** Signature generation + storage
- [ ] Implement ComplianceSpan signature fields
- [ ] Implement signing logic in ComplianceSpanProcessor
- [ ] Add unit tests (95% coverage)
- [ ] Integration test: 1000 signed spans

**Deliverables:**
- ComplianceSpan.sign() method
- Signed spans emitted to OpenTelemetry
- Fail-open error handling

### Phase 2: Verification API (Week 3)
**Scope:** Public key export + verification endpoint
- [ ] Implement GET /api/tenants/{tenantId}/public-keys
- [ ] Implement GET /api/compliance-spans
- [ ] Add signature status filtering
- [ ] Reference verification script (Python)

**Deliverables:**
- Public key export API
- Compliance spans query API
- Reference verification script in docs

### Phase 3: Key Rotation (Week 4)
**Scope:** Support multiple active keys per tenant
- [ ] KeyManagementService.getActiveKeys() method
- [ ] Support 2 active keys (current + previous)
- [ ] Key expiration tracking
- [ ] Key rotation integration test

**Deliverables:**
- Zero-downtime key rotation support
- Key lifecycle management

### Phase 4: Production Readiness (Week 5)
**Scope:** Monitoring, alerts, documentation
- [ ] Metrics dashboard (signing success rate, verification latency)
- [ ] P0 alerts for signing failures
- [ ] Auditor documentation (verification guide)
- [ ] Internal compliance dashboard updates

**Deliverables:**
- Grafana dashboard
- Alert rules
- Auditor verification guide

## Open Questions

1. **Q: Should signatures be verified on span ingestion or query time?**
   - **Proposed Answer:** Query time (verification is expensive, not needed during ingestion)
   - **Rationale:** Fail-fast on ingestion would reject unsigned spans (violates fail-open principle)

2. **Q: What happens if KeyManagementService is down for >1 hour?**
   - **Proposed Answer:** Emit unsigned spans, P0 alert, operational runbook for KMS recovery
   - **Rationale:** Availability > integrity (compliance evidence still collected, just unsigned)

3. **Q: Should we support custom signature algorithms (RSA, ECDSA)?**
   - **Proposed Answer:** No, Ed25519 only (Phase 1)
   - **Rationale:** Simplicity, Ed25519 is industry best practice for audit logs

4. **Q: How do we handle clock skew (timestamp in canonical representation)?**
   - **Proposed Answer:** Use server-side timestamp (UTC), document clock sync requirements
   - **Rationale:** Rely on NTP for clock sync (standard practice)

5. **Q: Should public keys be embedded in spans or fetched separately?**
   - **Proposed Answer:** Fetched separately (reduces span size, supports key rotation)
   - **Rationale:** Span size matters for storage costs, keyId reference is sufficient

## Dependencies

**Prerequisite:**
- ✅ PRD-006a: KMS Integration with Ed25519 signing keys (COMPLETED)

**Concurrent:**
- PRD-002a: TigerBeetle Event Ledger (stub exists, full implementation not blocking)

**Future:**
- PRD-006b: Key Generation Service with TigerBeetle metadata storage (migration path)
- PRD-004: Compliance Dashboard UI (will consume signed spans API)

## References

- **@docs/compliance-status.md** - Security gap analysis
- **@docs/compliance.md** - Compliance evidence system overview
- **ADR-011: Pure Application Framework** - Deployment-agnostic design
- **ADR-016: Authentication Chain Integrity** - Similar signature architecture
- **NIST FIPS 186-5** - Digital Signature Standard (Ed25519 approved)
- **RFC 8032** - Edwards-Curve Digital Signature Algorithm (EdDSA)
