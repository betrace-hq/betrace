package com.fluo.services;

import com.fluo.kms.KeyManagementService;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Unit tests for KeyGenerationService (PRD-006b).
 */
@QuarkusTest
public class KeyGenerationServiceTest {

    @Inject
    KeyGenerationService keyGenerationService;

    @InjectMock
    KeyManagementService kms;

    @Test
    void testGenerateSigningKey() throws Exception {
        UUID tenantId = UUID.randomUUID();

        // Mock KMS response
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
        KeyPair testKeyPair = keyGen.generateKeyPair();

        when(kms.generateSigningKeyPair(tenantId))
            .thenReturn(new KeyManagementService.SigningKeyResponse(
                UUID.randomUUID(),
                testKeyPair.getPublic(),
                "Ed25519"
            ));

        // Generate signing key
        var result = keyGenerationService.generateSigningKey(tenantId);

        // Verify result
        assertNotNull(result.keyId());
        assertNotNull(result.publicKey());
        assertEquals("Ed25519", result.algorithm());
        assertNotNull(result.createdAt());
    }

    @Test
    void testGenerateEncryptionKey() {
        UUID tenantId = UUID.randomUUID();

        // Mock KMS response
        byte[] testKey = new byte[32];
        byte[] encryptedKey = new byte[64];

        when(kms.generateDataKey(eq("AES_256"), anyMap()))
            .thenReturn(new KeyManagementService.DataKeyResponse(
                testKey,
                encryptedKey,
                "AES_256"
            ));

        // Generate encryption key
        var result = keyGenerationService.generateEncryptionKey(tenantId);

        // Verify result
        assertNotNull(result.keyId());
        assertEquals("AES_256", result.keySpec());
        assertNotNull(result.createdAt());
    }

    @Test
    void testGenerateSigningKeyWithNullTenantId() {
        assertThrows(IllegalArgumentException.class, () ->
            keyGenerationService.generateSigningKey(null)
        );
    }

    @Test
    void testGenerateEncryptionKeyWithNullTenantId() {
        assertThrows(IllegalArgumentException.class, () ->
            keyGenerationService.generateEncryptionKey(null)
        );
    }

    @Test
    void testGenerateSigningKeyHandlesKmsFailure() {
        UUID tenantId = UUID.randomUUID();

        when(kms.generateSigningKeyPair(tenantId))
            .thenThrow(new KeyManagementService.KmsException("test", "generate", "KMS unavailable"));

        assertThrows(KeyGenerationService.KeyGenerationException.class, () ->
            keyGenerationService.generateSigningKey(tenantId)
        );
    }

    @Test
    void testGenerateEncryptionKeyHandlesKmsFailure() {
        UUID tenantId = UUID.randomUUID();

        when(kms.generateDataKey(eq("AES_256"), anyMap()))
            .thenThrow(new KeyManagementService.KmsException("test", "generate", "KMS unavailable"));

        assertThrows(KeyGenerationService.KeyGenerationException.class, () ->
            keyGenerationService.generateEncryptionKey(tenantId)
        );
    }
}
