package com.fluo.kms;

import com.fluo.kms.adapters.LocalKmsAdapter;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for signing key generation and retrieval in KeyManagementService.
 *
 * Tests cover:
 * - Ed25519 key generation
 * - Encrypted key storage and retrieval
 * - Signature generation and verification
 * - Tenant isolation
 * - Key caching
 * - Error handling
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SigningKeyTest {

    private static KeyManagementService kms;
    private static UUID tenantId;

    @TempDir
    static Path tempKeyStorage;

    @BeforeAll
    static void setUp() {
        // Set key storage path to temp directory
        System.setProperty("fluo.kms.key-store-path", tempKeyStorage.toString());

        kms = new LocalKmsAdapter();
        tenantId = UUID.randomUUID();
    }

    @Test
    @Order(1)
    @DisplayName("Generate Ed25519 signing key pair")
    void testGenerateSigningKeyPair() {
        // Generate key pair
        KeyManagementService.SigningKeyResponse response = kms.generateSigningKeyPair(tenantId);

        // Verify response
        assertNotNull(response, "SigningKeyResponse should not be null");
        assertNotNull(response.keyId(), "Key ID should not be null");
        assertNotNull(response.publicKey(), "Public key should not be null");
        assertEquals("Ed25519", response.algorithm(), "Algorithm should be Ed25519");

        // Verify public key properties
        assertEquals("Ed25519", response.publicKey().getAlgorithm());
        assertTrue(response.publicKey().getEncoded().length > 0, "Public key should have encoded bytes");
    }

    @Test
    @Order(2)
    @DisplayName("Generate unique key IDs for multiple calls")
    void testUniqueKeyIds() {
        KeyManagementService.SigningKeyResponse response1 = kms.generateSigningKeyPair(tenantId);

        // Generate new tenant for second key
        UUID tenant2 = UUID.randomUUID();
        KeyManagementService.SigningKeyResponse response2 = kms.generateSigningKeyPair(tenant2);

        // Key IDs should be unique
        assertNotEquals(response1.keyId(), response2.keyId(),
            "Key IDs should be unique across tenants");
    }

    @Test
    @Order(3)
    @DisplayName("Retrieve private signing key after generation")
    void testGetTenantSigningKey() {
        // Generate key pair
        kms.generateSigningKeyPair(tenantId);

        // Retrieve private key
        PrivateKey privateKey = kms.getTenantSigningKey(tenantId);

        assertNotNull(privateKey, "Private key should not be null");
        assertEquals("Ed25519", privateKey.getAlgorithm(), "Private key should be Ed25519");
        assertTrue(privateKey.getEncoded().length > 0, "Private key should have encoded bytes");
    }

    @Test
    @Order(4)
    @DisplayName("Retrieve public key after generation")
    void testGetTenantPublicKey() {
        // Generate key pair
        KeyManagementService.SigningKeyResponse response = kms.generateSigningKeyPair(tenantId);

        // Retrieve public key
        PublicKey publicKey = kms.getTenantPublicKey(tenantId);

        assertNotNull(publicKey, "Public key should not be null");
        assertEquals("Ed25519", publicKey.getAlgorithm(), "Public key should be Ed25519");
        assertArrayEquals(response.publicKey().getEncoded(), publicKey.getEncoded(),
            "Retrieved public key should match generated public key");
    }

    @Test
    @Order(5)
    @DisplayName("Sign and verify data with generated keys")
    void testSignAndVerify() throws Exception {
        // Generate key pair
        kms.generateSigningKeyPair(tenantId);

        // Get keys
        PrivateKey privateKey = kms.getTenantSigningKey(tenantId);
        PublicKey publicKey = kms.getTenantPublicKey(tenantId);

        // Sign data
        byte[] data = "test compliance span data".getBytes();
        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(privateKey);
        signer.update(data);
        byte[] signature = signer.sign();

        // Verify signature
        Signature verifier = Signature.getInstance("Ed25519");
        verifier.initVerify(publicKey);
        verifier.update(data);
        boolean valid = verifier.verify(signature);

        assertTrue(valid, "Signature should be valid");

        // Verify signature fails with modified data
        byte[] tamperedData = "tampered compliance span data".getBytes();
        verifier.initVerify(publicKey);
        verifier.update(tamperedData);
        boolean invalidSignature = verifier.verify(signature);

        assertFalse(invalidSignature, "Signature should be invalid for tampered data");
    }

    @Test
    @Order(6)
    @DisplayName("Tenant isolation - different tenants have different keys")
    void testTenantIsolation() {
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();

        // Generate keys for both tenants
        kms.generateSigningKeyPair(tenant1);
        kms.generateSigningKeyPair(tenant2);

        // Get keys
        PublicKey publicKey1 = kms.getTenantPublicKey(tenant1);
        PublicKey publicKey2 = kms.getTenantPublicKey(tenant2);

        // Public keys should be different
        assertFalse(
            java.util.Arrays.equals(publicKey1.getEncoded(), publicKey2.getEncoded()),
            "Different tenants should have different keys"
        );
    }

    @Test
    @Order(7)
    @DisplayName("Key retrieval before generation throws exception")
    void testGetKeyBeforeGeneration() {
        UUID nonExistentTenant = UUID.randomUUID();

        // Attempt to retrieve key for tenant with no generated key
        KeyManagementService.KmsException exception = assertThrows(
            KeyManagementService.KmsException.class,
            () -> kms.getTenantSigningKey(nonExistentTenant),
            "Should throw KmsException for non-existent key"
        );

        assertTrue(exception.getMessage().contains("not found") ||
                   exception.getMessage().contains("generate first"),
            "Exception message should indicate key not found");
    }

    @Test
    @Order(8)
    @DisplayName("Null tenant ID validation")
    void testNullTenantIdValidation() {
        assertThrows(IllegalArgumentException.class,
            () -> kms.generateSigningKeyPair(null),
            "Should throw IllegalArgumentException for null tenantId");

        assertThrows(IllegalArgumentException.class,
            () -> kms.getTenantSigningKey(null),
            "Should throw IllegalArgumentException for null tenantId");

        assertThrows(IllegalArgumentException.class,
            () -> kms.getTenantPublicKey(null),
            "Should throw IllegalArgumentException for null tenantId");
    }

    @Test
    @Order(9)
    @DisplayName("Key persistence and reload")
    void testKeyPersistenceAndReload() {
        // Generate key pair
        KeyManagementService.SigningKeyResponse originalResponse = kms.generateSigningKeyPair(tenantId);
        PublicKey originalPublicKey = originalResponse.publicKey();

        // LocalKmsAdapter limitation: Master key is not persisted across restarts
        // Creating a new instance simulates restart and will use a different master key
        // This means encrypted keys CANNOT be decrypted after restart
        //
        // For production, use AwsKmsAdapter, GcpKmsAdapter, or VaultKmsAdapter which
        // manage master keys externally and support key persistence.
        //
        // This test verifies that keys CAN be reloaded from the SAME instance (cache invalidation)

        // Clear cache to force reload from filesystem (simulates cache invalidation, not restart)
        ((LocalKmsAdapter) kms).clearSigningKeyCache();

        // Retrieve key again (will reload from disk using same master key)
        PublicKey reloadedPublicKey = kms.getTenantPublicKey(tenantId);

        // Keys should match
        assertArrayEquals(originalPublicKey.getEncoded(), reloadedPublicKey.getEncoded(),
            "Reloaded public key should match original after cache invalidation");
    }

    @Test
    @Order(10)
    @DisplayName("Key caching performance")
    void testKeyCaching() {
        // Generate key pair
        kms.generateSigningKeyPair(tenantId);

        // Clear cache to force filesystem load on first retrieval
        ((LocalKmsAdapter) kms).clearSigningKeyCache();

        // First retrieval (loads from filesystem)
        long start1 = System.nanoTime();
        kms.getTenantPublicKey(tenantId);
        long duration1 = System.nanoTime() - start1;

        // Second retrieval (from cache)
        long start2 = System.nanoTime();
        kms.getTenantPublicKey(tenantId);
        long duration2 = System.nanoTime() - start2;

        // Cached retrieval should be significantly faster (at least 2x)
        assertTrue(duration2 < duration1 / 2,
            String.format("Cached retrieval (%d ns) should be significantly faster than first retrieval (%d ns)",
                duration2, duration1));
    }

    // ==========================================
    // QA Expert P0 Missing Tests
    // ==========================================

    @Test
    @Order(11)
    @DisplayName("P0-1: Generate signing key pair is idempotent")
    void testGenerateSigningKeyPairIdempotency() throws Exception {
        // Generate key pair twice for same tenant
        KeyManagementService.SigningKeyResponse response1 = kms.generateSigningKeyPair(tenantId);
        KeyManagementService.SigningKeyResponse response2 = kms.generateSigningKeyPair(tenantId);

        // Both should succeed
        assertNotNull(response1, "First generation should succeed");
        assertNotNull(response2, "Second generation should succeed");

        // Second call should overwrite first (new key ID)
        assertNotEquals(response1.keyId(), response2.keyId(), "Second generation should create new key ID");

        // Retrieved key should match most recent generation
        PublicKey retrievedPublicKey = kms.getTenantPublicKey(tenantId);
        assertArrayEquals(response2.publicKey().getEncoded(), retrievedPublicKey.getEncoded(),
            "Retrieved key should match most recent generation");
    }

    @Test
    @Order(12)
    @DisplayName("P0-2: Sign and verify empty data")
    void testEmptyDataSignature() throws Exception {
        // Generate signing key pair
        kms.generateSigningKeyPair(tenantId);

        PrivateKey privateKey = kms.getTenantSigningKey(tenantId);
        PublicKey publicKey = kms.getTenantPublicKey(tenantId);

        // Sign empty byte array
        byte[] emptyData = new byte[0];
        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(privateKey);
        signer.update(emptyData);
        byte[] signature = signer.sign();

        assertNotNull(signature, "Signature should be generated for empty data");
        assertTrue(signature.length > 0, "Signature should not be empty");

        // Verify signature on empty data
        Signature verifier = Signature.getInstance("Ed25519");
        verifier.initVerify(publicKey);
        verifier.update(emptyData);
        boolean valid = verifier.verify(signature);

        assertTrue(valid, "Signature should be valid for empty data");
    }

    @Test
    @Order(13)
    @DisplayName("P0-3: Handle filesystem corruption gracefully")
    void testFilesystemCorruption() throws Exception {
        // Generate valid key pair
        kms.generateSigningKeyPair(tenantId);

        // Corrupt key file by truncating it
        Path keyFile = tempKeyStorage.resolve(tenantId.toString()).resolve("signing_key.enc");
        assertTrue(keyFile.toFile().exists(), "Key file should exist");

        // Truncate file to simulate corruption
        java.nio.file.Files.write(keyFile, new byte[]{0x00, 0x01, 0x02}); // Invalid format

        // Clear cache to force filesystem load
        ((LocalKmsAdapter) kms).clearSigningKeyCache();

        // Attempt to load corrupted key - should throw KmsException
        KeyManagementService.KmsException exception = assertThrows(
            KeyManagementService.KmsException.class,
            () -> kms.getTenantSigningKey(tenantId),
            "Loading corrupted key file should throw KmsException"
        );

        assertTrue(exception.getMessage().contains("Failed to load signing key"),
            "Exception message should indicate load failure");
    }

    @Test
    @Order(14)
    @DisplayName("P0-4: Concurrent key generation is thread-safe")
    void testConcurrentKeyGeneration() throws Exception {
        int threadCount = 10;
        UUID sharedTenantId = UUID.randomUUID();

        // Generate keys concurrently from multiple threads
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(threadCount);
        java.util.List<java.util.concurrent.Future<KeyManagementService.SigningKeyResponse>> futures =
            new java.util.ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> kms.generateSigningKeyPair(sharedTenantId)));
        }

        // Wait for all threads to complete
        java.util.List<KeyManagementService.SigningKeyResponse> responses = new java.util.ArrayList<>();
        for (java.util.concurrent.Future<KeyManagementService.SigningKeyResponse> future : futures) {
            KeyManagementService.SigningKeyResponse response = future.get();
            assertNotNull(response, "All concurrent generations should succeed");
            responses.add(response);
        }

        executor.shutdown();

        // All responses should be non-null (no crashes or exceptions)
        assertEquals(threadCount, responses.size(), "All threads should complete successfully");

        // Final retrieved key should match one of the generated keys
        PublicKey finalKey = kms.getTenantPublicKey(sharedTenantId);
        boolean matchesAnyGenerated = responses.stream()
            .anyMatch(r -> java.util.Arrays.equals(r.publicKey().getEncoded(), finalKey.getEncoded()));

        assertTrue(matchesAnyGenerated, "Final key should match one of the concurrently generated keys");
    }
}
