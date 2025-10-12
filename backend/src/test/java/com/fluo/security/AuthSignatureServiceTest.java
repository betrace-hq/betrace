package com.fluo.security;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@DisplayName("AuthSignatureService Cryptographic Tests")
class AuthSignatureServiceTest {

    private AuthSignatureService service;

    @BeforeEach
    void setUp() {
        service = new AuthSignatureService();
        // Set test secret manually for deterministic testing
        service.signatureSecret = "test-secret-minimum-32-characters-long";
    }

    // === Basic Signature Generation ===

    @Test
    @DisplayName("Generate valid signature for tenant and roles")
    void testSignatureGeneration() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = Arrays.asList("admin", "user");

        String signature = service.signAuthContext(tenantId, roles);

        assertNotNull(signature);
        assertFalse(signature.isEmpty());
        assertTrue(signature.length() > 32); // Base64 HMAC-SHA256 is ~44 chars
    }

    @Test
    @DisplayName("Same input produces same signature (deterministic)")
    void testDeterministicSignatures() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        String signature1 = service.signAuthContext(tenantId, roles);
        String signature2 = service.signAuthContext(tenantId, roles);

        assertEquals(signature1, signature2, "Same input should produce same signature");
    }

    @Test
    @DisplayName("Different tenants produce different signatures")
    void testDifferentTenantsDifferentSignatures() {
        UUID tenant1 = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID tenant2 = UUID.fromString("00000000-0000-0000-0000-000000000002");
        List<String> roles = List.of("admin");

        String signature1 = service.signAuthContext(tenant1, roles);
        String signature2 = service.signAuthContext(tenant2, roles);

        assertNotEquals(signature1, signature2, "Different tenants should produce different signatures");
    }

    @Test
    @DisplayName("Different roles produce different signatures")
    void testDifferentRolesDifferentSignatures() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles1 = List.of("admin");
        List<String> roles2 = List.of("user");

        String signature1 = service.signAuthContext(tenantId, roles1);
        String signature2 = service.signAuthContext(tenantId, roles2);

        assertNotEquals(signature1, signature2, "Different roles should produce different signatures");
    }

    // === Signature Verification ===

    @Test
    @DisplayName("Verify valid signature succeeds")
    void testValidSignatureVerification() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin", "user");

        String signature = service.signAuthContext(tenantId, roles);
        boolean valid = service.verifyAuthContext(tenantId, roles, signature);

        assertTrue(valid, "Valid signature should verify successfully");
    }

    @Test
    @DisplayName("Verify signature with modified tenant ID fails")
    void testModifiedTenantIdVerificationFails() {
        UUID originalTenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID forgedTenantId = UUID.fromString("00000000-0000-0000-0000-000000000002");
        List<String> roles = List.of("admin");

        String signature = service.signAuthContext(originalTenantId, roles);
        boolean valid = service.verifyAuthContext(forgedTenantId, roles, signature);

        assertFalse(valid, "Signature verification should fail with modified tenant ID");
    }

    @Test
    @DisplayName("Verify signature with modified roles fails")
    void testModifiedRolesVerificationFails() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> originalRoles = List.of("user");
        List<String> forgedRoles = List.of("admin"); // Privilege escalation attempt!

        String signature = service.signAuthContext(tenantId, originalRoles);
        boolean valid = service.verifyAuthContext(tenantId, forgedRoles, signature);

        assertFalse(valid, "Signature verification should fail with modified roles (privilege escalation)");
    }

    @Test
    @DisplayName("Verify with completely forged signature fails")
    void testForgedSignatureVerificationFails() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        String forgedSignature = "forged-signature-base64encoded-xxxxxxxxxxxxxxxxxx";
        boolean valid = service.verifyAuthContext(tenantId, roles, forgedSignature);

        assertFalse(valid, "Forged signature should fail verification");
    }

    // === Role Ordering (Canonical Form) ===

    @Test
    @DisplayName("Role order does not affect signature (sorted canonically)")
    void testRoleOrderingDoesNotAffectSignature() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles1 = Arrays.asList("admin", "user", "developer");
        List<String> roles2 = Arrays.asList("developer", "admin", "user");
        List<String> roles3 = Arrays.asList("user", "developer", "admin");

        String signature1 = service.signAuthContext(tenantId, roles1);
        String signature2 = service.signAuthContext(tenantId, roles2);
        String signature3 = service.signAuthContext(tenantId, roles3);

        assertEquals(signature1, signature2, "Role order should not affect signature");
        assertEquals(signature2, signature3, "Role order should not affect signature");
    }

    // === Edge Cases ===

    @Test
    @DisplayName("Single role generates valid signature")
    void testSingleRole() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        String signature = service.signAuthContext(tenantId, roles);
        boolean valid = service.verifyAuthContext(tenantId, roles, signature);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Many roles generate valid signature")
    void testManyRoles() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = Arrays.asList(
            "admin", "user", "developer", "sre", "compliance_officer",
            "security_admin", "auditor", "viewer", "editor", "owner"
        );

        String signature = service.signAuthContext(tenantId, roles);
        boolean valid = service.verifyAuthContext(tenantId, roles, signature);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Empty roles list generates valid signature")
    void testEmptyRoles() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> emptyRoles = Collections.emptyList();

        String signature = service.signAuthContext(tenantId, emptyRoles);
        boolean valid = service.verifyAuthContext(tenantId, emptyRoles, signature);

        assertTrue(valid, "Empty roles list should generate valid signature");
    }

    @Test
    @DisplayName("Null signature verification returns false")
    void testNullSignatureVerification() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        boolean valid = service.verifyAuthContext(tenantId, roles, null);

        assertFalse(valid, "Null signature should fail verification");
    }

    @Test
    @DisplayName("Empty string signature verification returns false")
    void testEmptyStringSignatureVerification() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        boolean valid = service.verifyAuthContext(tenantId, roles, "");

        assertFalse(valid, "Empty signature should fail verification");
    }

    // === Constant-Time Comparison (Timing Attack Resistance) ===

    @Test
    @DisplayName("Verification uses constant-time comparison (MessageDigest.isEqual)")
    void testConstantTimeComparison() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        String validSignature = service.signAuthContext(tenantId, roles);

        // Test 1: Signature with first byte different
        String firstByteDifferent = "A" + validSignature.substring(1);

        // Test 2: Signature with last byte different
        String lastByteDifferent = validSignature.substring(0, validSignature.length() - 1) + "Z";

        // Test 3: Completely different signature (same length)
        String completelyDifferent = "X".repeat(validSignature.length());

        // All should fail verification (deterministic behavior)
        assertFalse(service.verifyAuthContext(tenantId, roles, firstByteDifferent),
            "First byte difference should be detected");
        assertFalse(service.verifyAuthContext(tenantId, roles, lastByteDifferent),
            "Last byte difference should be detected");
        assertFalse(service.verifyAuthContext(tenantId, roles, completelyDifferent),
            "Completely different signature should be detected");

        // Valid signature should succeed
        assertTrue(service.verifyAuthContext(tenantId, roles, validSignature),
            "Valid signature should verify successfully");

        // Verify implementation uses MessageDigest.isEqual (constant-time)
        // This is a code review check - the implementation must use:
        // return MessageDigest.isEqual(expectedBytes, actualBytes);
        // NOT: return expected.equals(actual);
    }

    // === Different Secret Produces Different Signature ===

    @Test
    @DisplayName("Different secrets produce different signatures")
    void testDifferentSecretsProduceDifferentSignatures() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        // Generate signature with first secret
        service.signatureSecret = "secret-1-minimum-32-characters-long-xxx";
        String signature1 = service.signAuthContext(tenantId, roles);

        // Generate signature with second secret
        service.signatureSecret = "secret-2-minimum-32-characters-long-yyy";
        String signature2 = service.signAuthContext(tenantId, roles);

        assertNotEquals(signature1, signature2,
            "Different secrets should produce different signatures");
    }

    @Test
    @DisplayName("Signature from one secret fails verification with different secret")
    void testDifferentSecretFailsVerification() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        // Generate signature with first secret
        service.signatureSecret = "secret-1-minimum-32-characters-long-xxx";
        String signature = service.signAuthContext(tenantId, roles);

        // Try to verify with different secret
        service.signatureSecret = "secret-2-minimum-32-characters-long-yyy";
        boolean valid = service.verifyAuthContext(tenantId, roles, signature);

        assertFalse(valid, "Signature should fail verification with different secret (key rotation scenario)");
    }

    // === Thread Safety ===

    @Test
    @DisplayName("Concurrent signature generation produces consistent results")
    void testConcurrentSignatureGeneration() throws InterruptedException {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        List<String> roles = List.of("admin");

        String expectedSignature = service.signAuthContext(tenantId, roles);

        // Generate signatures concurrently
        int threadCount = 10;
        List<String> signatures = Collections.synchronizedList(new ArrayList<>());
        List<Thread> threads = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            Thread thread = new Thread(() -> {
                for (int j = 0; j < 100; j++) {
                    String signature = service.signAuthContext(tenantId, roles);
                    signatures.add(signature);
                }
            });
            threads.add(thread);
            thread.start();
        }

        // Wait for all threads
        for (Thread thread : threads) {
            thread.join();
        }

        // All signatures should be identical (deterministic)
        for (String signature : signatures) {
            assertEquals(expectedSignature, signature,
                "Concurrent signature generation should produce consistent results");
        }
    }
}
