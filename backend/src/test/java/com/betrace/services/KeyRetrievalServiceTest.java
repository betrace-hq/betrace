package com.fluo.services;

import com.fluo.kms.KeyManagementService;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for KeyRetrievalService (PRD-006c).
 */
@QuarkusTest
public class KeyRetrievalServiceTest {

    @Inject
    KeyRetrievalService keyRetrievalService;

    @InjectMock
    KeyManagementService kms;

    @Inject
    KeyCache keyCache;

    private UUID testTenantId;
    private KeyPair testKeyPair;

    @BeforeEach
    void setup() throws Exception {
        testTenantId = UUID.randomUUID();
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
        testKeyPair = keyGen.generateKeyPair();

        // Clear cache before each test
        keyCache.clearAll();
    }

    @Test
    void testGetSigningKeyCacheMiss() {
        // Mock KMS to return key
        when(kms.getTenantSigningKey(testTenantId))
            .thenReturn(testKeyPair.getPrivate());

        // First retrieval (cache miss)
        var privateKey = keyRetrievalService.getSigningKey(testTenantId);

        assertNotNull(privateKey);
        assertEquals(testKeyPair.getPrivate(), privateKey);

        // Verify KMS was called
        verify(kms, times(1)).getTenantSigningKey(testTenantId);
    }

    @Test
    void testGetSigningKeyCacheHit() {
        // Mock KMS to return key
        when(kms.getTenantSigningKey(testTenantId))
            .thenReturn(testKeyPair.getPrivate());

        // First retrieval (populates cache)
        keyRetrievalService.getSigningKey(testTenantId);

        // Second retrieval (cache hit - should not call KMS)
        var privateKey = keyRetrievalService.getSigningKey(testTenantId);

        assertNotNull(privateKey);
        assertEquals(testKeyPair.getPrivate(), privateKey);

        // Verify KMS was only called once (first retrieval)
        verify(kms, times(1)).getTenantSigningKey(testTenantId);
    }

    @Test
    void testGetPublicKeyCaching() {
        // Mock KMS to return public key
        when(kms.getTenantPublicKey(testTenantId))
            .thenReturn(testKeyPair.getPublic());

        // First retrieval (cache miss)
        var publicKey1 = keyRetrievalService.getPublicKey(testTenantId);
        assertNotNull(publicKey1);

        // Second retrieval (cache hit)
        var publicKey2 = keyRetrievalService.getPublicKey(testTenantId);
        assertNotNull(publicKey2);
        assertEquals(publicKey1, publicKey2);

        // Verify KMS was only called once
        verify(kms, times(1)).getTenantPublicKey(testTenantId);
    }

    @Test
    void testGetEncryptionKeyCaching() {
        byte[] testKey = new byte[32];

        // Mock KMS to return data key
        when(kms.generateDataKey(eq("AES_256"), anyMap()))
            .thenReturn(new KeyManagementService.DataKeyResponse(
                testKey,
                new byte[64],
                "AES_256"
            ));

        // First retrieval (cache miss)
        var key1 = keyRetrievalService.getEncryptionKey(testTenantId);
        assertNotNull(key1);
        assertEquals(32, key1.length);

        // Second retrieval (cache hit)
        var key2 = keyRetrievalService.getEncryptionKey(testTenantId);
        assertArrayEquals(key1, key2);

        // Verify KMS was only called once
        verify(kms, times(1)).generateDataKey(eq("AES_256"), anyMap());
    }

    @Test
    void testInvalidateTenant() {
        // Mock KMS
        when(kms.getTenantSigningKey(testTenantId))
            .thenReturn(testKeyPair.getPrivate());

        // Populate cache
        keyRetrievalService.getSigningKey(testTenantId);

        // Verify cached
        var cachedKey = keyCache.getPrivateKey(testTenantId);
        assertTrue(cachedKey.isPresent());

        // Invalidate
        keyRetrievalService.invalidateTenant(testTenantId);

        // Verify cache cleared
        var cachedKeyAfter = keyCache.getPrivateKey(testTenantId);
        assertTrue(cachedKeyAfter.isEmpty());
    }

    @Test
    void testGetSigningKeyWithNullTenantId() {
        assertThrows(IllegalArgumentException.class, () ->
            keyRetrievalService.getSigningKey(null)
        );
    }

    @Test
    void testGetSigningKeyHandlesKmsFailure() {
        when(kms.getTenantSigningKey(testTenantId))
            .thenThrow(new KeyManagementService.KmsException("test", "retrieve", "KMS unavailable"));

        assertThrows(KeyRetrievalService.KeyRetrievalException.class, () ->
            keyRetrievalService.getSigningKey(testTenantId)
        );
    }

    @Test
    void testCacheStats() {
        // Mock KMS
        when(kms.getTenantSigningKey(any(UUID.class)))
            .thenReturn(testKeyPair.getPrivate());
        when(kms.getTenantPublicKey(any(UUID.class)))
            .thenReturn(testKeyPair.getPublic());

        // Populate cache with multiple keys
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();

        keyRetrievalService.getSigningKey(tenant1);
        keyRetrievalService.getPublicKey(tenant2);

        // Check stats
        var stats = keyRetrievalService.getCacheStats();
        assertTrue(stats.totalKeys() >= 2);
    }
}
