package com.betrace.services;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test for PRD-006 KMS system.
 *
 * Tests the complete key management lifecycle:
 * - Key generation (PRD-006b)
 * - Key retrieval with caching (PRD-006c + PRD-006d)
 * - Compliance span signing (PRD-003 + PRD-006)
 * - Key rotation (PRD-006e)
 *
 * Uses LocalKmsAdapter for development (fluo.kms.provider=local).
 */
@QuarkusTest
public class KeyManagementIntegrationTest {

    @Inject
    KeyGenerationService keyGenerationService;

    @Inject
    KeyRetrievalService keyRetrievalService;

    @Inject
    KeyCache keyCache;

    @Inject
    ComplianceSigningService complianceSigningService;

    /**
     * Test complete key lifecycle: generation → retrieval → caching.
     */
    @Test
    void testSigningKeyLifecycle() {
        UUID tenantId = UUID.randomUUID();

        // Generate signing key
        var result = keyGenerationService.generateSigningKey(tenantId);
        assertNotNull(result.keyId(), "Key ID should be generated");
        assertNotNull(result.publicKey(), "Public key should be returned");
        assertEquals("Ed25519", result.algorithm(), "Algorithm should be Ed25519");

        // Retrieve signing key (cache miss)
        var privateKey1 = keyRetrievalService.getSigningKey(tenantId);
        assertNotNull(privateKey1, "Private key should be retrieved");

        // Retrieve again (cache hit - should be faster)
        long start = System.currentTimeMillis();
        var privateKey2 = keyRetrievalService.getSigningKey(tenantId);
        long elapsed = System.currentTimeMillis() - start;

        assertNotNull(privateKey2, "Private key should be cached");
        assertTrue(elapsed < 10, "Cached retrieval should be <10ms (was " + elapsed + "ms)");
        assertEquals(privateKey1, privateKey2, "Cached key should match original");

        // Verify cache statistics
        var stats = keyCache.getStats();
        assertTrue(stats.privateKeyCount() > 0, "Cache should contain private keys");
    }

    /**
     * Test encryption key generation and retrieval.
     */
    @Test
    void testEncryptionKeyLifecycle() {
        UUID tenantId = UUID.randomUUID();

        // Generate encryption key
        var result = keyGenerationService.generateEncryptionKey(tenantId);
        assertNotNull(result.keyId(), "Key ID should be generated");
        assertEquals("AES_256", result.keySpec(), "Key spec should be AES_256");

        // Retrieve encryption key (cache miss)
        byte[] encryptionKey1 = keyRetrievalService.getEncryptionKey(tenantId);
        assertNotNull(encryptionKey1, "Encryption key should be retrieved");
        assertEquals(32, encryptionKey1.length, "AES-256 key should be 32 bytes");

        // Retrieve again (cache hit)
        byte[] encryptionKey2 = keyRetrievalService.getEncryptionKey(tenantId);
        assertNotNull(encryptionKey2, "Encryption key should be cached");
        assertArrayEquals(encryptionKey1, encryptionKey2, "Cached key should match");
    }

    /**
     * Test compliance signing service integration.
     */
    @Test
    void testComplianceSigningService() {
        UUID tenantId = UUID.randomUUID();

        // Generate signing key first
        keyGenerationService.generateSigningKey(tenantId);

        // Get public key
        byte[] publicKey = complianceSigningService.getPublicKey(tenantId);
        assertNotNull(publicKey, "Public key should be retrievable");
        assertTrue(publicKey.length > 0, "Public key should not be empty");
    }

    /**
     * Test cache invalidation on key rotation.
     */
    @Test
    void testCacheInvalidation() {
        UUID tenantId = UUID.randomUUID();

        // Generate and cache key
        keyGenerationService.generateSigningKey(tenantId);
        keyRetrievalService.getSigningKey(tenantId);

        // Verify key is cached
        var cachedKey = keyCache.getPrivateKey(tenantId);
        assertTrue(cachedKey.isPresent(), "Key should be cached");

        // Invalidate cache (simulates rotation)
        keyRetrievalService.invalidateTenant(tenantId);

        // Verify cache is empty
        var cachedKeyAfter = keyCache.getPrivateKey(tenantId);
        assertTrue(cachedKeyAfter.isEmpty(), "Key should be removed from cache");
    }

    /**
     * Test public key retrieval for external verification.
     */
    @Test
    void testPublicKeyRetrieval() {
        UUID tenantId = UUID.randomUUID();

        // Generate signing key
        keyGenerationService.generateSigningKey(tenantId);

        // Get public key via ComplianceSigningService
        byte[] publicKey = complianceSigningService.getPublicKey(tenantId);
        assertNotNull(publicKey, "Public key should be retrievable");
        assertTrue(publicKey.length > 0, "Public key should not be empty");
    }

    /**
     * Test multi-tenant isolation.
     */
    @Test
    void testMultiTenantIsolation() {
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();

        // Generate keys for both tenants
        keyGenerationService.generateSigningKey(tenant1);
        keyGenerationService.generateSigningKey(tenant2);

        // Retrieve keys
        var key1 = keyRetrievalService.getSigningKey(tenant1);
        var key2 = keyRetrievalService.getSigningKey(tenant2);

        // Verify keys are different
        assertNotEquals(key1, key2, "Tenant keys should be isolated");

        // Verify public keys are also different
        byte[] publicKey1 = complianceSigningService.getPublicKey(tenant1);
        byte[] publicKey2 = complianceSigningService.getPublicKey(tenant2);
        assertFalse(java.util.Arrays.equals(publicKey1, publicKey2),
            "Public keys should be different for different tenants");
    }
}
