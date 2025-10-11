# PRD-003a: Core Signature Service

**Parent PRD:** PRD-003 (Compliance Span Cryptographic Signing)
**Unit:** A
**Priority:** P0
**Dependencies:** PRD-006 (KMS - can be mocked for testing)

## Scope

Implement the foundational `ComplianceSignatureService` that provides Ed25519 signing and verification capabilities for compliance spans. This service is the core building block for all signature operations.

## Implementation

### Service Class

**`backend/src/main/java/com/fluo/services/ComplianceSignatureService.java`:**
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

## Success Criteria

- [ ] `signComplianceData()` generates valid Ed25519 signatures
- [ ] `verifySignature()` correctly validates signatures
- [ ] `verifySignature()` rejects tampered data
- [ ] `extractComplianceAttributes()` filters out non-compliance attributes
- [ ] Canonical JSON is deterministic (same input = same JSON)
- [ ] Tenant isolation: Tenant A signature fails with Tenant B key
- [ ] Signature generation: <5ms per operation
- [ ] Test coverage: 90%+ instruction coverage

## Testing Requirements

### Unit Tests

**`backend/src/test/java/com/fluo/services/ComplianceSignatureServiceTest.java`:**

```java
@QuarkusTest
class ComplianceSignatureServiceTest {

    @Inject
    ComplianceSignatureService signatureService;

    @InjectMock
    KeyManagementService kms;

    private static final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should sign compliance attributes with Ed25519")
    void testSignComplianceData() throws Exception {
        // Generate test key pair
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
        KeyPair keyPair = keyGen.generateKeyPair();

        // Mock KMS response
        when(kms.getTenantSigningKey(TEST_TENANT_ID))
            .thenReturn(keyPair.getPrivate().getEncoded());

        Map<String, Object> attributes = Map.of(
            "compliance.framework", "soc2",
            "compliance.control", "CC6_1",
            "compliance.tenantId", TEST_TENANT_ID.toString()
        );

        String signature = signatureService.signComplianceData(TEST_TENANT_ID, attributes);

        assertNotNull(signature);
        assertEquals(88, signature.length()); // Base64 of 64-byte signature
    }

    @Test
    @DisplayName("Should verify valid signature")
    void testVerifyValidSignature() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
        KeyPair keyPair = keyGen.generateKeyPair();

        when(kms.getTenantSigningKey(TEST_TENANT_ID))
            .thenReturn(keyPair.getPrivate().getEncoded());
        when(kms.getTenantPublicKey(TEST_TENANT_ID))
            .thenReturn(keyPair.getPublic().getEncoded());

        Map<String, Object> attributes = Map.of(
            "compliance.framework", "soc2",
            "compliance.control", "CC6_1"
        );

        // Sign
        String signature = signatureService.signComplianceData(TEST_TENANT_ID, attributes);

        // Verify
        boolean valid = signatureService.verifySignature(TEST_TENANT_ID, attributes, signature);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Should reject tampered signature")
    void testRejectTamperedData() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
        KeyPair keyPair = keyGen.generateKeyPair();

        when(kms.getTenantSigningKey(TEST_TENANT_ID))
            .thenReturn(keyPair.getPrivate().getEncoded());
        when(kms.getTenantPublicKey(TEST_TENANT_ID))
            .thenReturn(keyPair.getPublic().getEncoded());

        Map<String, Object> attributes = Map.of(
            "compliance.framework", "soc2",
            "compliance.control", "CC6_1"
        );

        // Sign
        String signature = signatureService.signComplianceData(TEST_TENANT_ID, attributes);

        // Tamper with data
        Map<String, Object> tamperedAttributes = new TreeMap<>(attributes);
        tamperedAttributes.put("compliance.control", "CC6_2");

        // Verify should fail
        boolean valid = signatureService.verifySignature(TEST_TENANT_ID, tamperedAttributes, signature);

        assertFalse(valid);
    }

    @Test
    @DisplayName("Should enforce tenant isolation")
    void testTenantIsolation() throws Exception {
        UUID tenantA = UUID.randomUUID();
        UUID tenantB = UUID.randomUUID();

        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
        KeyPair keyPairA = keyGen.generateKeyPair();
        KeyPair keyPairB = keyGen.generateKeyPair();

        when(kms.getTenantSigningKey(tenantA)).thenReturn(keyPairA.getPrivate().getEncoded());
        when(kms.getTenantPublicKey(tenantB)).thenReturn(keyPairB.getPublic().getEncoded());

        Map<String, Object> attributes = Map.of(
            "compliance.framework", "soc2"
        );

        // Sign with tenant A
        String signature = signatureService.signComplianceData(tenantA, attributes);

        // Try to verify with tenant B's key
        boolean valid = signatureService.verifySignature(tenantB, attributes, signature);

        assertFalse(valid, "Signature from tenant A should not verify with tenant B's key");
    }

    @Test
    @DisplayName("Should create deterministic canonical JSON")
    void testCanonicalJsonDeterminism() {
        Map<String, Object> attributes1 = new LinkedHashMap<>();
        attributes1.put("zzz", "last");
        attributes1.put("aaa", "first");
        attributes1.put("mmm", "middle");

        Map<String, Object> attributes2 = new LinkedHashMap<>();
        attributes2.put("mmm", "middle");
        attributes2.put("zzz", "last");
        attributes2.put("aaa", "first");

        String canonical1 = signatureService.createCanonicalJson(attributes1);
        String canonical2 = signatureService.createCanonicalJson(attributes2);

        assertEquals(canonical1, canonical2, "Canonical JSON should be identical regardless of input order");
    }

    @Test
    @DisplayName("Should extract compliance attributes")
    void testExtractComplianceAttributes() {
        Map<String, Object> spanAttributes = Map.of(
            "compliance.framework", "soc2",
            "compliance.control", "CC6_1",
            "compliance.signature", "xyz123", // Should be excluded
            "span.name", "test", // Should be excluded
            "trace.id", "abc"    // Should be excluded
        );

        Map<String, Object> extracted = signatureService.extractComplianceAttributes(spanAttributes);

        assertEquals(2, extracted.size());
        assertTrue(extracted.containsKey("compliance.framework"));
        assertTrue(extracted.containsKey("compliance.control"));
        assertFalse(extracted.containsKey("compliance.signature"));
        assertFalse(extracted.containsKey("span.name"));
    }

    @Test
    @DisplayName("Should sign 1000 spans in under 5 seconds")
    void testSigningPerformance() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
        KeyPair keyPair = keyGen.generateKeyPair();

        when(kms.getTenantSigningKey(TEST_TENANT_ID))
            .thenReturn(keyPair.getPrivate().getEncoded());

        Map<String, Object> attributes = Map.of(
            "compliance.framework", "soc2",
            "compliance.control", "CC6_1"
        );

        long startTime = System.currentTimeMillis();
        for (int i = 0; i < 1000; i++) {
            signatureService.signComplianceData(TEST_TENANT_ID, attributes);
        }
        long duration = System.currentTimeMillis() - startTime;

        assertTrue(duration < 5000, "Signing 1000 spans took " + duration + "ms");
    }
}
```

### Security Tests

**`backend/src/test/java/com/fluo/compliance/TenantIsolationTest.java`:**
```java
@QuarkusTest
class TenantIsolationTest {

    @Test
    @DisplayName("Should prevent cross-tenant signature verification")
    void testCrossTenantVerificationFails() {
        // Test cross-tenant signature validation
    }

    @Test
    @DisplayName("Should reject signature replay from different tenant")
    void testReplayAttackPrevention() {
        // Test timestamp validation
    }
}
```

## Files to Create

**Backend Service:**
- `backend/src/main/java/com/fluo/services/ComplianceSignatureService.java`

**Tests:**
- `backend/src/test/java/com/fluo/services/ComplianceSignatureServiceTest.java`
- `backend/src/test/java/com/fluo/compliance/TenantIsolationTest.java`

## Files to Modify

None (this is a new standalone service)

## Implementation Notes

### Key Management
- Depends on PRD-006 for KMS integration
- For testing: Mock KMS with in-memory key pairs
- Private keys never leave KMS in production

### Signature Algorithm
- Ed25519 (available in JDK 15+)
- 64-byte signatures (88 chars in Base64)
- No additional dependencies needed

### Canonical JSON
- Sort keys alphabetically for determinism
- UTF-8 encoding
- Exclude `compliance.signature` from signed data
- Include timestamp to prevent replay attacks

### Performance
- Target: <5ms per signature operation
- No blocking operations
- Cache public keys (future optimization)

## Security Considerations

**Protections:**
- ✅ Tamper detection (signature verification fails)
- ✅ Tenant isolation (per-tenant keys)
- ✅ Deterministic signing (same input = same signature)

**Not Protected:**
- ❌ Attacker with private key access (mitigated by KMS in PRD-006)
- ❌ Quantum computing attacks (future: post-quantum signatures)

## Related ADRs

- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Per-tenant keys
- **[ADR-014: Camel Testing Standards](../adrs/014-camel-testing-and-organization-standards.md)** - 90% coverage requirement
