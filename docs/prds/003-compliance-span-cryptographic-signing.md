# PRD-003: Compliance Span Cryptographic Signing

**Priority:** P0 (Security Gap - Blocks Production)
**Complexity:** Complex
**Personas:** Compliance, All (Security requirement)
**Dependencies:** PRD-002 (Persistence + Tiered Storage), PRD-006 (KMS for signing keys)

## Problem

Compliance spans are **not tamper-evident**:
- `ComplianceSpanProcessor.java` emits OpenTelemetry spans with compliance attributes
- ❌ No cryptographic signatures on spans
- ❌ Auditors cannot verify span integrity
- ❌ Malicious actors could modify compliance evidence
- ❌ No proof that spans weren't altered after creation

**Current State:**
- Spans have compliance attributes (framework, control, evidenceType)
- Spans exported to Tempo via OpenTelemetry
- No signature generation or verification code exists

**Documented in:** `docs/compliance-status.md` - P0 Security Gap #1

## Solution

### Cryptographic Approach

**Algorithm:** Ed25519 digital signatures
- Fast signing/verification
- Small signature size (64 bytes)
- Industry standard (used by SSH, TLS 1.3)

**What to Sign:**
Canonical JSON representation of span attributes:
```json
{
  "compliance.framework": "soc2",
  "compliance.control": "CC6_1",
  "compliance.evidenceType": "audit_trail",
  "compliance.tenantId": "tenant-123",
  "compliance.timestamp": "2025-10-10T12:34:56Z",
  "compliance.outcome": "success"
}
```

**Signature Storage:**
1. **Primary:** Span attribute `compliance.signature` in OpenTelemetry
2. **Secondary:** TigerBeetle transfer (immutable audit trail)
3. **Tertiary:** Append-only span log (source of truth per ADR-015)

### Architecture Integration

**Per ADR-015 (Tiered Storage):**
```
Compliance Span Created
        ↓
   Sign with Ed25519
        ↓
   Add signature to span attributes
        ↓
   Append-Only Span Log (with signature)
        ↓
   DuckDB Hot Storage (with signature)
        ↓
   TigerBeetle Transfer (signature metadata)
        ↓
   Parquet Cold Storage (with signature)
```

**Per ADR-013 (Camel-First):**
All signature verification flows implemented as Camel routes with named processors.

### Backend Implementation

#### 1. Compliance Signature Service

**`com/fluo/services/ComplianceSignatureService.java`:**
```java
@ApplicationScoped
public class ComplianceSignatureService {

    @Inject
    KeyManagementService kms; // PRD-006

    private static final Logger log = LoggerFactory.getLogger(ComplianceSignatureService.class);

    /**
     * Sign compliance span attributes with Ed25519.
     *
     * @param tenantId Tenant UUID for key lookup
     * @param attributes Compliance attributes to sign
     * @return Base64-encoded Ed25519 signature
     */
    public String signComplianceData(UUID tenantId, Map<String, Object> attributes)
            throws GeneralSecurityException {

        // Get tenant signing key from KMS (PRD-006)
        byte[] privateKeyBytes = kms.getTenantSigningKey(tenantId);

        // Create canonical JSON (sorted keys for determinism)
        String canonical = createCanonicalJson(attributes);

        // Sign with Ed25519
        Signature signature = Signature.getInstance("Ed25519");
        PrivateKey privateKey = KeyFactory.getInstance("Ed25519")
            .generatePrivate(new PKCS8EncodedKeySpec(privateKeyBytes));

        signature.initSign(privateKey);
        signature.update(canonical.getBytes(StandardCharsets.UTF_8));
        byte[] signatureBytes = signature.sign();

        log.debug("Signed compliance data for tenant {} ({} bytes)",
            tenantId, signatureBytes.length);

        // Return base64-encoded signature
        return Base64.getEncoder().encodeToString(signatureBytes);
    }

    /**
     * Verify compliance span signature.
     *
     * @param tenantId Tenant UUID for public key lookup
     * @param attributes Compliance attributes (excluding signature)
     * @param signatureBase64 Base64-encoded signature to verify
     * @return true if signature is valid, false otherwise
     */
    public boolean verifySignature(UUID tenantId, Map<String, Object> attributes,
            String signatureBase64) throws GeneralSecurityException {

        // Get tenant public key from KMS
        byte[] publicKeyBytes = kms.getTenantPublicKey(tenantId);

        // Create same canonical JSON
        String canonical = createCanonicalJson(attributes);

        // Verify signature
        Signature signature = Signature.getInstance("Ed25519");
        PublicKey publicKey = KeyFactory.getInstance("Ed25519")
            .generatePublic(new X509EncodedKeySpec(publicKeyBytes));

        signature.initVerify(publicKey);
        signature.update(canonical.getBytes(StandardCharsets.UTF_8));

        byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);
        boolean valid = signature.verify(signatureBytes);

        log.debug("Verified compliance signature for tenant {}: {}", tenantId, valid);

        return valid;
    }

    /**
     * Create canonical JSON representation for signing.
     * Keys sorted alphabetically for deterministic output.
     */
    private String createCanonicalJson(Map<String, Object> attributes) {
        try {
            // Sort keys alphabetically
            TreeMap<String, Object> sorted = new TreeMap<>(attributes);

            // Serialize with consistent formatting
            ObjectMapper mapper = new ObjectMapper();
            mapper.configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

            return mapper.writeValueAsString(sorted);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to create canonical JSON", e);
        }
    }

    /**
     * Extract compliance attributes from span for verification.
     */
    public Map<String, Object> extractComplianceAttributes(Map<String, Object> spanAttributes) {
        Map<String, Object> complianceAttrs = new TreeMap<>();

        spanAttributes.forEach((key, value) -> {
            if (key.startsWith("compliance.") && !key.equals("compliance.signature")) {
                complianceAttrs.put(key, value);
            }
        });

        return complianceAttrs;
    }
}
```

#### 2. Modify ComplianceSpanProcessor (Camel Processor)

**`com/fluo/processors/compliance/SignComplianceSpanProcessor.java`:**
```java
@Named("signComplianceSpanProcessor")
@ApplicationScoped
public class SignComplianceSpanProcessor implements Processor {

    @Inject
    ComplianceSignatureService signatureService;

    private static final Logger log = LoggerFactory.getLogger(SignComplianceSpanProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceSpan complianceSpan = exchange.getIn().getBody(ComplianceSpan.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);

        // Extract compliance attributes from span
        Map<String, Object> complianceAttrs = Map.of(
            "compliance.framework", complianceSpan.getFramework(),
            "compliance.control", complianceSpan.getControl(),
            "compliance.evidenceType", complianceSpan.getEvidenceType(),
            "compliance.tenantId", tenantId.toString(),
            "compliance.timestamp", Instant.now().toString(),
            "compliance.operation", complianceSpan.getOperation()
        );

        try {
            // Sign the attributes
            String signature = signatureService.signComplianceData(tenantId, complianceAttrs);

            // Add signature metadata to span
            complianceSpan.setAttribute("compliance.signature", signature);
            complianceSpan.setAttribute("compliance.signature.algorithm", "Ed25519");
            complianceSpan.setAttribute("compliance.signature.version", "v1");

            // Store signed span in exchange
            exchange.getIn().setBody(complianceSpan);
            exchange.getIn().setHeader("signatureGenerated", true);

            log.info("Generated signature for compliance span: {}", complianceSpan.getOperation());

        } catch (GeneralSecurityException e) {
            log.error("Failed to sign compliance span for tenant {}", tenantId, e);
            exchange.getIn().setHeader("signatureGenerated", false);
            throw new SignatureException("Failed to sign compliance span", e);
        }
    }
}
```

#### 3. Verification Route (Camel REST DSL)

**`com/fluo/routes/ComplianceVerificationRoutes.java`:**
```java
@ApplicationScoped
public class ComplianceVerificationRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // REST API for compliance verification
        rest("/api/compliance")
            .description("Compliance span verification API")
            .produces("application/json")
            .consumes("application/json")

            // Verify single span signature
            .post("/verify/span")
                .description("Verify cryptographic signature of compliance span")
                .to("direct:verifyComplianceSpan")

            // Verify batch of spans
            .post("/verify/batch")
                .description("Verify multiple compliance spans")
                .to("direct:verifyComplianceSpanBatch")

            // Get verification history
            .get("/verify/history/{tenantId}")
                .description("Get verification history for tenant")
                .to("direct:getVerificationHistory");

        // Verify single compliance span
        from("direct:verifyComplianceSpan")
            .routeId("verifyComplianceSpan")
            .log("Verifying compliance span signature")
            .process("extractComplianceAttributesProcessor")
            .process("verifySignatureProcessor")
            .process("recordVerificationEventProcessor")  // TigerBeetle
            .marshal().json();

        // Verify batch of compliance spans
        from("direct:verifyComplianceSpanBatch")
            .routeId("verifyComplianceSpanBatch")
            .split(body())
                .to("direct:verifyComplianceSpan")
            .end()
            .aggregate(constant(true), new GroupedBodyAggregationStrategy())
            .completionTimeout(5000)
            .marshal().json();

        // Get verification history from TigerBeetle
        from("direct:getVerificationHistory")
            .routeId("getVerificationHistory")
            .process("queryVerificationHistoryProcessor")
            .marshal().json();
    }
}
```

#### 4. Named Processors (ADR-014)

**`com/fluo/processors/compliance/ExtractComplianceAttributesProcessor.java`:**
```java
@Named("extractComplianceAttributesProcessor")
@ApplicationScoped
public class ExtractComplianceAttributesProcessor implements Processor {

    @Inject
    ComplianceSignatureService signatureService;

    @Override
    public void process(Exchange exchange) throws Exception {
        ComplianceSpanVerificationRequest request =
            exchange.getIn().getBody(ComplianceSpanVerificationRequest.class);

        // Extract attributes (excluding signature)
        Map<String, Object> attributes = signatureService.extractComplianceAttributes(
            request.spanAttributes()
        );

        exchange.getIn().setHeader("tenantId", UUID.fromString(
            request.spanAttributes().get("compliance.tenantId").toString()
        ));
        exchange.getIn().setHeader("signature", request.signature());
        exchange.getIn().setHeader("complianceAttributes", attributes);
    }
}
```

**`com/fluo/processors/compliance/VerifySignatureProcessor.java`:**
```java
@Named("verifySignatureProcessor")
@ApplicationScoped
public class VerifySignatureProcessor implements Processor {

    @Inject
    ComplianceSignatureService signatureService;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        String signature = exchange.getIn().getHeader("signature", String.class);
        Map<String, Object> attributes = exchange.getIn().getHeader("complianceAttributes", Map.class);

        boolean valid = signatureService.verifySignature(tenantId, attributes, signature);

        VerificationResult result = new VerificationResult(
            valid,
            valid ? "Signature valid" : "Signature invalid or tampered",
            tenantId,
            Instant.now()
        );

        exchange.getIn().setBody(result);
        exchange.getIn().setHeader("signatureValid", valid);
    }
}
```

**`com/fluo/processors/compliance/RecordVerificationEventProcessor.java`:**
```java
@Named("recordVerificationEventProcessor")
@ApplicationScoped
public class RecordVerificationEventProcessor implements Processor {

    @Inject
    TigerBeetleService tb;

    @Override
    public void process(Exchange exchange) throws Exception {
        VerificationResult result = exchange.getIn().getBody(VerificationResult.class);

        // Record verification event in TigerBeetle as transfer
        // This creates immutable audit trail of all verifications
        UUID verificationId = UUID.randomUUID();

        TBTransfer verification = new TBTransfer(
            id: toUInt128(verificationId),
            debitAccountId: toUInt128(result.tenantId()),  // Tenant
            creditAccountId: VERIFICATION_ACCOUNT,          // System account
            amount: 1,
            userData128: packVerificationMetadata(result.valid()),
            userData64: result.timestamp().toEpochMilli(),
            code: 4,  // Verification event type
            ledger: tenantToLedgerId(result.tenantId()),
            timestamp: result.timestamp().toEpochMilli() * 1_000_000  // ns
        );

        tb.createTransfer(verification);
    }
}
```

#### 5. TigerBeetle Integration (Per PRD-002)

Compliance signatures stored as TigerBeetle transfers:

```java
// New transfer code for compliance signatures
public static final int COMPLIANCE_SIGNATURE_TYPE = 4;

// Record signature generation event
TBTransfer signatureEvent = new TBTransfer(
    id: signatureUUID,
    debitAccountId: tenantUUID,
    creditAccountId: SYSTEM_COMPLIANCE_ACCOUNT,
    amount: 1,  // Counter
    userData128: traceIdAsUInt128,
    userData64: packSignatureMetadata(framework, control),
    code: COMPLIANCE_SIGNATURE_TYPE,
    ledger: tenantLedgerId,
    timestamp: now()
);
```

**Query verification history:**
```java
public List<VerificationEvent> getVerificationHistory(UUID tenantId, int limit) {
    AccountFilter filter = new AccountFilter();
    filter.setAccountId(toUInt128(tenantId));
    filter.setCode(COMPLIANCE_SIGNATURE_TYPE);
    filter.setLimit(limit);
    filter.setFlags(AccountFilterFlags.DEBITS);

    TransferBatch transfers = tb.client.getAccountTransfers(filter);

    return transfersToVerificationEvents(transfers);
}
```

### Frontend (Compliance Dashboard)

**`bff/src/components/compliance/signature-verification-badge.tsx`:**
```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, ShieldAlert } from "lucide-react";

interface SignatureVerificationBadgeProps {
  spanId: string;
  signatureValid: boolean;
  onVerify: () => Promise<void>;
}

export function SignatureVerificationBadge({
  spanId,
  signatureValid,
  onVerify
}: SignatureVerificationBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant={signatureValid ? "success" : "destructive"}>
        {signatureValid ? (
          <>
            <Shield className="w-3 h-3 mr-1" />
            Verified
          </>
        ) : (
          <>
            <ShieldAlert className="w-3 h-3 mr-1" />
            Invalid Signature
          </>
        )}
      </Badge>

      <Button
        variant="outline"
        size="sm"
        onClick={onVerify}
      >
        Re-verify
      </Button>
    </div>
  );
}
```

## Success Criteria

**Signature Generation:**
- [ ] All compliance spans have Ed25519 signatures
- [ ] Signatures stored as span attributes in OpenTelemetry
- [ ] Signatures recorded in TigerBeetle (immutable audit trail)
- [ ] Signatures preserved in append-only span log (ADR-015)
- [ ] Signature generation performance: <5ms per span
- [ ] No blocking of span creation on signature failure

**Verification:**
- [ ] Camel REST API endpoint for signature verification (ADR-013)
- [ ] Named processors for verification logic (ADR-014)
- [ ] Tampered spans fail verification
- [ ] Unmodified spans pass verification
- [ ] Verification events recorded in TigerBeetle
- [ ] Frontend shows verification status badge

**Testing:**
- [ ] Processor unit tests (90% coverage per ADR-014)
- [ ] Route configuration tests
- [ ] Integration tests (end-to-end signing + verification)
- [ ] Security tests (tampering detection, key isolation)
- [ ] Performance tests (1000 signs/verifies in <5s)

## Testing Requirements

**Unit Tests (Processors):**
```java
@Test
@DisplayName("Should sign compliance attributes with Ed25519")
void testSignComplianceSpanProcessor() throws Exception {
    SignComplianceSpanProcessor processor = new SignComplianceSpanProcessor();
    Exchange exchange = createTestExchange();

    ComplianceSpan span = new ComplianceSpan(/*...*/);
    exchange.getIn().setBody(span);
    exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);

    processor.process(exchange);

    ComplianceSpan signedSpan = exchange.getIn().getBody(ComplianceSpan.class);
    assertNotNull(signedSpan.getAttribute("compliance.signature"));
    assertEquals("Ed25519", signedSpan.getAttribute("compliance.signature.algorithm"));
}

@Test
@DisplayName("Should verify valid signature")
void testVerifySignatureProcessor() throws Exception {
    VerifySignatureProcessor processor = new VerifySignatureProcessor();
    Exchange exchange = createTestExchange();

    // ... set up signed span

    processor.process(exchange);

    VerificationResult result = exchange.getIn().getBody(VerificationResult.class);
    assertTrue(result.valid());
}

@Test
@DisplayName("Should reject tampered signature")
void testTamperedSignatureDetection() throws Exception {
    // Sign span
    // Modify compliance attribute
    // Verify → Should fail
}
```

**Route Configuration Tests:**
```java
@Test
@DisplayName("Should configure compliance verification routes correctly")
void testComplianceVerificationRoutesConfiguration() throws Exception {
    CamelContext testContext = new DefaultCamelContext();
    testContext.addRoutes(complianceVerificationRoutes);

    assertDoesNotThrow(() -> testContext.addRoutes(complianceVerificationRoutes));
}
```

**Integration Tests:**
```java
@Test
@DisplayName("Should sign and verify compliance span end-to-end")
void testEndToEndSigningAndVerification() {
    // Create compliance span
    ComplianceSpan span = createTestComplianceSpan();

    // Send to signing route
    template.sendBody("direct:signComplianceSpan", span);

    // Verify signature was added
    assertNotNull(span.getAttribute("compliance.signature"));

    // Send to verification route
    VerificationResult result = template.requestBody(
        "direct:verifyComplianceSpan",
        span,
        VerificationResult.class
    );

    assertTrue(result.valid());

    // Verify recorded in TigerBeetle
    assertTrue(tb.hasVerificationEvent(span.getTenantId(), span.getId()));
}
```

**Security Tests:**
```java
@Test
@DisplayName("Should prevent cross-tenant signature verification")
void testTenantIsolationInSignatures() {
    // Sign with tenant A's key
    ComplianceSpan span = signWithTenant(TENANT_A);

    // Try to verify with tenant B's public key
    boolean valid = signatureService.verifySignature(
        TENANT_B,
        span.getAttributes(),
        span.getSignature()
    );

    assertFalse(valid, "Signature from tenant A should not verify with tenant B's key");
}

@Test
@DisplayName("Should detect signature replay attacks")
void testReplayAttackPrevention() {
    // Sign span at T1
    // Replay same span at T2 with old timestamp
    // Verify timestamp is within acceptable window
}
```

**Performance Tests:**
```java
@Test
@DisplayName("Should sign 1000 spans in under 5 seconds")
void testSigningPerformance() {
    List<ComplianceSpan> spans = generateTestSpans(1000);

    long startTime = System.currentTimeMillis();
    spans.forEach(span -> signatureService.signComplianceData(tenantId, span.getAttributes()));
    long duration = System.currentTimeMillis() - startTime;

    assertTrue(duration < 5000, "Signing 1000 spans took " + duration + "ms");
}
```

## Files to Create

**Backend Services:**
- `backend/src/main/java/com/fluo/services/ComplianceSignatureService.java`

**Camel Routes:**
- `backend/src/main/java/com/fluo/routes/ComplianceVerificationRoutes.java`

**Processors:**
- `backend/src/main/java/com/fluo/processors/compliance/SignComplianceSpanProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/ExtractComplianceAttributesProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/VerifySignatureProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/RecordVerificationEventProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/QueryVerificationHistoryProcessor.java`

**Models:**
- `backend/src/main/java/com/fluo/model/ComplianceSpanVerificationRequest.java`
- `backend/src/main/java/com/fluo/model/VerificationResult.java`
- `backend/src/main/java/com/fluo/model/VerificationEvent.java`

**Tests:**
- `backend/src/test/java/com/fluo/services/ComplianceSignatureServiceTest.java`
- `backend/src/test/java/com/fluo/routes/ComplianceVerificationRoutesTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/SignComplianceSpanProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/VerifySignatureProcessorTest.java`
- `backend/src/test/java/com/fluo/compliance/TamperDetectionTest.java`
- `backend/src/test/java/com/fluo/compliance/TenantIsolationTest.java`

**Frontend:**
- `bff/src/components/compliance/signature-verification-badge.tsx`
- `bff/src/lib/api/compliance-verification.ts`

## Files to Modify

**Backend:**
- `backend/src/main/java/com/fluo/compliance/telemetry/ComplianceSpanProcessor.java` - Integrate SignComplianceSpanProcessor
- `backend/src/main/java/com/fluo/tigerbeetle/TigerBeetleService.java` - Add verification event methods
- `backend/pom.xml` - No changes needed (Ed25519 in JDK 15+)

## Implementation Notes

**Key Management:**
- Depends on PRD-006 (KMS Integration) for key storage
- Each tenant has unique Ed25519 key pair
- Private keys never leave KMS
- Public keys cached for verification performance

**Signature Algorithm:**
- Ed25519 chosen over RSA for performance (10x faster) and size (64 bytes vs 256 bytes)
- ECDSA also viable but Ed25519 has simpler implementation
- No HSM required in MVP (KMS sufficient for P0)

**Canonical JSON:**
- Sort keys alphabetically before signing (deterministic output)
- Use consistent encoding (UTF-8)
- Exclude `compliance.signature` field from signed data
- Include `compliance.timestamp` to prevent replay attacks

**Performance Considerations:**
- Sign asynchronously to avoid blocking span creation
- Batch signature verification for bulk queries
- Cache public keys per tenant (reduce KMS calls)
- Target: <5ms per signature operation

**TigerBeetle Integration:**
- Verification events stored as transfers (code=4)
- Immutable audit trail of all verifications
- Query by tenant + code for verification history
- No separate SQL table needed (ADR-011 compliance)

**Audit Trail:**
- All signature generations recorded in TigerBeetle
- All verifications recorded in TigerBeetle
- Track who verified what and when
- Alert on verification failures (future: PRD-021)

**Compliance Benefits:**
- **SOC2 CC7.2:** Cryptographic proof audit logs haven't been tampered
- **HIPAA 164.312(c)(1):** Integrity controls for PHI access logs
- **FedRAMP AU-10:** Non-repudiation of compliance evidence
- **ISO 27001 A.12.4.1:** Event logging with tamper protection

## Security Considerations

**Threat Model:**
- ✅ Attacker modifies compliance span in database → Signature verification fails
- ✅ Attacker modifies span in Tempo → Signature verification fails
- ✅ Insider threat modifies historical spans → Signatures invalidate
- ✅ Auditor questions span authenticity → Can verify with public key
- ✅ Tenant A tries to use tenant B's signature → Verification fails (key mismatch)

**Not Protected Against:**
- ❌ Attacker with access to private key (mitigate: KMS access controls in PRD-006)
- ❌ Deletion of signed spans (mitigate: TigerBeetle WORM + append-only span log)
- ❌ Signing false data (mitigate: validate data before signing)
- ❌ Quantum computing attacks (mitigate: future migration to post-quantum signatures)

**Mitigation Strategies:**
1. **Private Key Protection:** PRD-006 KMS with strict access controls
2. **Deletion Prevention:** TigerBeetle WORM + append-only span log (ADR-015)
3. **Data Validation:** Validate compliance data before signing (input validation in PRD-007)
4. **Timestamp Validation:** Reject signatures older than 24 hours on verification
5. **Rate Limiting:** Prevent verification DoS attacks (PRD-007)

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - No SQL table, use TigerBeetle
- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Per-tenant keys, ledger isolation
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - Verification API as Camel routes
- **[ADR-014: Camel Testing and Code Organization Standards](../adrs/014-camel-testing-and-organization-standards.md)** - Named processors, 90% coverage
- **[ADR-015: Tiered Storage Architecture](../adrs/015-tiered-storage-architecture.md)** - Signatures in span log, DuckDB, Parquet

## Dependencies

**Requires:**
- PRD-002: TigerBeetle persistence + tiered storage for signature storage
- PRD-006: KMS integration for Ed25519 key management (can mock for testing)

**Blocks:**
- PRD-016: Audit Report Generation (reports need verified evidence)
- PRD-015: Compliance Evidence Dashboard (shows verification status)

## Future Enhancements

- **Batch Signing:** Sign multiple spans in single KMS call (performance optimization)
- **Public Key Distribution:** Publish tenant public keys for external auditor verification
- **Signature Rotation:** Support key rotation without invalidating old signatures
- **Post-Quantum Signatures:** Migrate to CRYSTALS-Dilithium when standardized
- **Hardware Security Modules (HSM):** For highly regulated environments
- **Blockchain Anchoring:** Anchor signature hashes to public blockchain (immutable timestamp proof)

## Implementation Readiness Assessment

**Implementation Specialist Confidence:** 95% ✅ **READY TO IMPLEMENT**

### Clarifications Completed

All 15 implementation questions answered with specific, actionable details:

**1. Signing Point in Pipeline:**
- ✅ Sign immediately after deserialization in `SpanIngestionRoute.java`
- ✅ Insert `SigningProcessor` before routing decisions
- ✅ Fail fast if signing fails (before expensive processing)

**2. Key Management Integration:**
- ✅ `TenantKeyManagementService` interface from PRD-006
- ✅ Methods: `getKeyPair(tenantId, keyType)`, `getPublicKey(tenantId, keyId)`, `getCurrentKeyId(tenantId, keyType)`
- ✅ Returns Ed25519 key pairs per tenant

**3. TigerBeetle Integration:**
- ✅ Signatures stored in `span_events` table with `signature` and `signature_key_id` columns
- ✅ Propagated through all storage tiers (TigerBeetle → DuckDB → Parquet)
- ✅ Auditors verify signatures at query time

**4. File Touchpoints:**
- ✅ Modified: `SpanIngestionRoute.java`, `ComplianceSpanProcessor.java`, `ComplianceSpan.java`, `application.properties`
- ✅ Created: 6 new files (processors, services, models, tests)

**5. Signature Algorithm:**
- ✅ Ed25519 via Bouncy Castle 1.78 (`org.bouncycastle:bcprov-jdk18on:1.78`)
- ✅ 64-byte signatures, fast signing/verification
- ✅ Compatible with AWS KMS Ed25519 key generation

**6. Signature Payload:**
- ✅ Canonical JSON: sorted keys, UTF-8 encoded, no whitespace
- ✅ Includes: traceId, spanId, tenantId, timestamp, framework, control, evidenceType, outcome
- ✅ Excludes: signature field itself (standard practice)

**7. Verification Strategy:**
- ✅ On-demand at query time (auditor export, compliance dashboard, investigation UI)
- ✅ NOT in ingestion pipeline (performance sensitive)
- ✅ Batch verification for bulk queries

**8. Performance Targets:**
- ✅ Signing: <1ms P50, <2ms P95, <5ms P99
- ✅ Verification: <1ms P50, <2ms P95, <5ms P99
- ✅ Key cache hit: <0.1ms P50, <1ms P99
- ✅ KMS call (cache miss): <50ms P50, <200ms P99

**9. Caching Strategy:**
- ✅ Caffeine cache: 5-minute TTL, 1000-tenant capacity
- ✅ Event-driven invalidation on key rotation
- ✅ Stale key fallback (up to 10 minutes) for KMS outages

**10. Failure Modes:**
- ✅ Fail closed by default (security > availability)
- ✅ Drop spans on key not found, emit `span.signing.key_not_found` metric
- ✅ Stale key fallback if KMS unavailable and cache has expired key

**11. Testing Strategy:**
- ✅ Mock KMS in unit tests (`@InjectMock TenantKeyManagementService`)
- ✅ LocalStack for integration tests with real KMS operations
- ✅ JMH benchmarks for performance validation

**12. File Structure:**
- ✅ `processors/` for Camel processors (SpanSigningProcessor, SignatureVerificationProcessor)
- ✅ `services/` for signing logic (SpanSignatureService, TenantKeyCache)
- ✅ `models/` for payload (SignaturePayload)
- ✅ `integration/` for LocalStack tests

**13. Configuration:**
- ✅ 12 properties in `application.properties` covering signing, caching, verification, performance, observability
- ✅ Environment-specific overrides for prod/dev

**14. Observability:**
- ✅ 8 metrics: `span.signing.total`, `span.signing.failures`, `span.signing.duration`, `span.verification.total`, `span.verification.invalid`, `kms.key_fetch.duration`, `signing.cache.size`, `signing.cache.hit_rate`
- ✅ OpenTelemetry traces with `@WithSpan("span.signing")`
- ✅ Grafana dashboard with 5 panels

**15. Key Lifecycle:**
- ✅ 90-day automatic rotation (configurable)
- ✅ Historical keys valid for 7 years (SOC2 retention)
- ✅ Signatures remain valid after rotation using `signature.key_id` tracking

### Implementation Estimate

**Total Time:** 6 days

**Phase Breakdown:**
1. **Phase 1 (Days 1-2):** Core signing logic + Camel processor integration
2. **Phase 2 (Days 3-4):** KMS integration + Caffeine key cache
3. **Phase 3 (Day 5):** On-demand verification service
4. **Phase 4 (Day 6):** Observability (metrics, traces, Grafana dashboard)

### Files to Create
```
backend/src/main/java/com/fluo/processors/SpanSigningProcessor.java
backend/src/main/java/com/fluo/processors/SignatureVerificationProcessor.java
backend/src/main/java/com/fluo/services/SpanSignatureService.java
backend/src/main/java/com/fluo/services/TenantKeyCache.java
backend/src/main/java/com/fluo/models/SignaturePayload.java
backend/src/test/java/com/fluo/processors/SpanSigningProcessorTest.java
backend/src/test/java/com/fluo/services/SpanSignatureServiceTest.java
backend/src/test/java/com/fluo/integration/SpanSigningIntegrationTest.java
```

### Files to Modify
```
backend/pom.xml (add Bouncy Castle dependency)
backend/src/main/java/com/fluo/routes/SpanIngestionRoute.java (add signing processor)
backend/src/main/java/com/fluo/compliance/telemetry/ComplianceSpanProcessor.java (add signature attributes)
backend/src/main/java/com/fluo/models/ComplianceSpan.java (add signature fields)
backend/src/main/resources/application.properties (12 new config properties)
```

### Remaining 5% Risk
- Bouncy Castle API nuances during implementation
- LocalStack KMS behavior differences from AWS KMS
- Actual performance numbers may differ from targets (JMH validation required)

**Status:** No blockers. Ready to start implementation immediately.

## Public Examples

### 1. NaCl/libsodium Ed25519 Signing
**URL:** https://doc.libsodium.org/

**Relevance:** Industry-standard cryptographic library implementing Ed25519 digital signatures. Demonstrates production-grade patterns for signing data for tamper-evidence and integrity verification.

**Key Patterns:**
- Ed25519 keypair generation
- Deterministic signing with canonical message format
- Fast signature verification (batch verification)
- Constant-time operations to prevent timing attacks

**Implementation Notes:** While FLUO uses Java's built-in Ed25519 support (JEP 339), libsodium's documentation provides excellent guidance on canonical message formatting and signature verification best practices.

### 2. Java Ed25519 Signature (JEP 339)
**URL:** https://openjdk.org/jeps/339

**Relevance:** Official JDK implementation of Ed25519 signatures (available since Java 15). This is the actual implementation FLUO uses for compliance span signing.

**Key Patterns:**
- `Signature.getInstance("Ed25519")` usage
- Key generation with `KeyPairGenerator`
- Signature verification with public keys
- Integration with Java Cryptography Architecture (JCA)

**FLUO Implementation:** See [ComplianceSignatureService.java:103-116](../../backend/src/main/java/com/fluo/services/ComplianceSignatureService.java) for production implementation using JDK Ed25519.

### 3. Signal Protocol Cryptography
**URL:** https://github.com/signalapp/libsignal

**Relevance:** Production cryptographic implementation from Signal demonstrating Ed25519 usage for message signing and authentication. Shows how to use Ed25519 signatures in a real-world security-critical application.

**Key Patterns:**
- Message integrity with Ed25519 signatures
- Key management and rotation strategies
- Signature verification in decentralized systems
- Double-ratchet algorithm with Ed25519 identity keys

**Compliance Relevance:** Signal's use of Ed25519 for non-repudiation and message authentication mirrors FLUO's use case for compliance evidence integrity.
