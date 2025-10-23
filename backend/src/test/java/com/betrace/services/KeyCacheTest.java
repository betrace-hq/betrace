package com.fluo.services;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for KeyCache (PRD-006d).
 *
 * Tests cache operations, TTL behavior, and invalidation.
 */
@QuarkusTest
public class KeyCacheTest {

    @Inject
    KeyCache keyCache;

    private UUID testTenantId;
    private KeyPair testKeyPair;

    @BeforeEach
    void setup() throws Exception {
        testTenantId = UUID.randomUUID();

        // Generate test Ed25519 key pair
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
        testKeyPair = keyGen.generateKeyPair();

        // Clear cache before each test
        keyCache.clearAll();
    }

    @Test
    void testPrivateKeyCaching() {
        // Initially empty
        var cachedKey = keyCache.getPrivateKey(testTenantId);
        assertTrue(cachedKey.isEmpty(), "Cache should be empty initially");

        // Cache key
        keyCache.putPrivateKey(testTenantId, testKeyPair.getPrivate());

        // Retrieve cached key
        var retrievedKey = keyCache.getPrivateKey(testTenantId);
        assertTrue(retrievedKey.isPresent(), "Key should be cached");
        assertEquals(testKeyPair.getPrivate(), retrievedKey.get(), "Cached key should match");
    }

    @Test
    void testPublicKeyCaching() {
        // Initially empty
        var cachedKey = keyCache.getPublicKey(testTenantId);
        assertTrue(cachedKey.isEmpty(), "Cache should be empty initially");

        // Cache key
        keyCache.putPublicKey(testTenantId, testKeyPair.getPublic());

        // Retrieve cached key
        var retrievedKey = keyCache.getPublicKey(testTenantId);
        assertTrue(retrievedKey.isPresent(), "Key should be cached");
        assertEquals(testKeyPair.getPublic(), retrievedKey.get(), "Cached key should match");
    }

    @Test
    void testEncryptionKeyCaching() {
        byte[] testKey = new byte[32]; // AES-256 key
        for (int i = 0; i < 32; i++) {
            testKey[i] = (byte) i;
        }

        // Initially empty
        var cachedKey = keyCache.getEncryptionKey(testTenantId);
        assertTrue(cachedKey.isEmpty(), "Cache should be empty initially");

        // Cache key
        keyCache.putEncryptionKey(testTenantId, testKey);

        // Retrieve cached key
        var retrievedKey = keyCache.getEncryptionKey(testTenantId);
        assertTrue(retrievedKey.isPresent(), "Key should be cached");
        assertArrayEquals(testKey, retrievedKey.get(), "Cached key should match");
    }

    @Test
    void testTenantInvalidation() {
        // Cache all key types
        keyCache.putPrivateKey(testTenantId, testKeyPair.getPrivate());
        keyCache.putPublicKey(testTenantId, testKeyPair.getPublic());
        keyCache.putEncryptionKey(testTenantId, new byte[32]);

        // Verify all cached
        assertTrue(keyCache.getPrivateKey(testTenantId).isPresent());
        assertTrue(keyCache.getPublicKey(testTenantId).isPresent());
        assertTrue(keyCache.getEncryptionKey(testTenantId).isPresent());

        // Invalidate tenant
        keyCache.invalidateTenant(testTenantId);

        // Verify all cleared
        assertTrue(keyCache.getPrivateKey(testTenantId).isEmpty(), "Private key should be cleared");
        assertTrue(keyCache.getPublicKey(testTenantId).isEmpty(), "Public key should be cleared");
        assertTrue(keyCache.getEncryptionKey(testTenantId).isEmpty(), "Encryption key should be cleared");
    }

    @Test
    void testMultiTenantIsolation() {
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();

        // Cache keys for both tenants
        keyCache.putPrivateKey(tenant1, testKeyPair.getPrivate());
        keyCache.putPrivateKey(tenant2, testKeyPair.getPrivate());

        // Verify both cached
        assertTrue(keyCache.getPrivateKey(tenant1).isPresent());
        assertTrue(keyCache.getPrivateKey(tenant2).isPresent());

        // Invalidate tenant1
        keyCache.invalidateTenant(tenant1);

        // Verify only tenant1 cleared
        assertTrue(keyCache.getPrivateKey(tenant1).isEmpty(), "Tenant1 should be cleared");
        assertTrue(keyCache.getPrivateKey(tenant2).isPresent(), "Tenant2 should remain cached");
    }

    @Test
    void testCacheStats() {
        // Initially empty
        var stats = keyCache.getStats();
        assertEquals(0, stats.totalKeys(), "Cache should be empty");

        // Add keys
        keyCache.putPrivateKey(testTenantId, testKeyPair.getPrivate());
        keyCache.putPublicKey(testTenantId, testKeyPair.getPublic());
        keyCache.putEncryptionKey(testTenantId, new byte[32]);

        // Check stats
        stats = keyCache.getStats();
        assertEquals(3, stats.totalKeys(), "Should have 3 keys cached");
        assertEquals(1, stats.privateKeyCount());
        assertEquals(1, stats.publicKeyCount());
        assertEquals(1, stats.encryptionKeyCount());
    }

    @Test
    void testClearAll() {
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();

        // Cache keys for multiple tenants
        keyCache.putPrivateKey(tenant1, testKeyPair.getPrivate());
        keyCache.putPublicKey(tenant2, testKeyPair.getPublic());

        var statsBefore = keyCache.getStats();
        assertTrue(statsBefore.totalKeys() > 0, "Cache should have keys");

        // Clear all
        keyCache.clearAll();

        // Verify all cleared
        var statsAfter = keyCache.getStats();
        assertEquals(0, statsAfter.totalKeys(), "Cache should be empty after clearAll");
        assertTrue(keyCache.getPrivateKey(tenant1).isEmpty());
        assertTrue(keyCache.getPublicKey(tenant2).isEmpty());
    }
}
