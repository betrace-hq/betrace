package com.fluo.services;

import com.fluo.compliance.evidence.RedactionStrategy;
import com.fluo.kms.KeyManagementService;
import com.fluo.kms.KeyManagementService.DataKeyResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@DisplayName("RedactionService Unit Tests")
class RedactionServiceTest {

    @Mock
    private KeyManagementService kms;

    @InjectMocks
    private RedactionService service;

    private UUID testTenantId;
    private byte[] testEncryptionKey;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        testTenantId = UUID.randomUUID();
        testEncryptionKey = new byte[32]; // 256-bit key
        for (int i = 0; i < 32; i++) {
            testEncryptionKey[i] = (byte) i;
        }

        // Mock KMS data key generation for encryption tests
        byte[] encryptedKey = "encrypted-dek".getBytes();
        DataKeyResponse dataKeyResponse = new DataKeyResponse(testEncryptionKey, encryptedKey, "AES_256");
        when(kms.generateDataKey(anyString(), any(Map.class))).thenReturn(dataKeyResponse);
        when(kms.decrypt(eq(encryptedKey), any(Map.class))).thenReturn(testEncryptionKey);
    }

    // EXCLUDE strategy tests

    @Test
    @DisplayName("EXCLUDE strategy should return [REDACTED]")
    void testExcludeStrategy() {
        String result = service.redact("sensitive@email.com", RedactionStrategy.EXCLUDE, testTenantId);
        assertEquals("[REDACTED]", result);
    }

    // REDACT strategy tests

    @Test
    @DisplayName("REDACT strategy should return [REDACTED]")
    void testRedactStrategy() {
        String result = service.redact("password123", RedactionStrategy.REDACT, testTenantId);
        assertEquals("[REDACTED]", result);
    }

    // HASH strategy tests

    @Test
    @DisplayName("HASH strategy should produce hash: prefix")
    void testHashStrategy() {
        String result = service.redact("test@example.com", RedactionStrategy.HASH, testTenantId);

        assertTrue(result.startsWith("hash:"));
        assertEquals(37, result.length()); // "hash:" + 32 hex chars
    }

    @Test
    @DisplayName("HASH strategy should be deterministic (same input = same output)")
    void testHashDeterministic() {
        String input = "test@example.com";
        String result1 = service.redact(input, RedactionStrategy.HASH, testTenantId);
        String result2 = service.redact(input, RedactionStrategy.HASH, testTenantId);

        assertEquals(result1, result2);
    }

    @Test
    @DisplayName("HASH strategy should produce different hashes for different inputs")
    void testHashUnique() {
        String result1 = service.redact("value1", RedactionStrategy.HASH, testTenantId);
        String result2 = service.redact("value2", RedactionStrategy.HASH, testTenantId);

        assertNotEquals(result1, result2);
    }

    // MASK strategy tests

    @Test
    @DisplayName("MASK strategy should mask emails as u***@e***.com")
    void testMaskEmail() {
        String result = service.redact("user@example.com", RedactionStrategy.MASK, testTenantId);
        assertEquals("u***@e***.com", result);
    }

    @Test
    @DisplayName("MASK strategy should mask generic values as first***last")
    void testMaskGeneric() {
        String result = service.redact("sensitive", RedactionStrategy.MASK, testTenantId);
        assertEquals("s***e", result);
    }

    @Test
    @DisplayName("MASK strategy should handle short values")
    void testMaskShortValue() {
        String result = service.redact("abc", RedactionStrategy.MASK, testTenantId);
        assertEquals("****", result);
    }

    // TRUNCATE strategy tests

    @Test
    @DisplayName("TRUNCATE strategy should show first and last N characters")
    void testTruncateStrategy() {
        String result = service.redact("1234567890", RedactionStrategy.TRUNCATE, testTenantId);
        assertEquals("1234...7890", result);
    }

    @Test
    @DisplayName("TRUNCATE strategy should handle custom preserve count")
    void testTruncateCustomPreserve() {
        String result = service.redact("1234567890", RedactionStrategy.TRUNCATE, testTenantId, 2);
        assertEquals("12...90", result);
    }

    @Test
    @DisplayName("TRUNCATE strategy should handle short values")
    void testTruncateShortValue() {
        String result = service.redact("short", RedactionStrategy.TRUNCATE, testTenantId);
        assertEquals("***", result);
    }

    // TOKENIZE strategy tests

    @Test
    @DisplayName("TOKENIZE strategy should produce TOK- prefix")
    void testTokenizeStrategy() {
        String result = service.redact("user@example.com", RedactionStrategy.TOKENIZE, testTenantId);

        assertTrue(result.startsWith("TOK-"));
        assertEquals(16, result.length()); // "TOK-" + 12 hex chars
    }

    @Test
    @DisplayName("TOKENIZE strategy should be deterministic per tenant")
    void testTokenizeDeterministic() {
        String input = "user@example.com";
        String result1 = service.redact(input, RedactionStrategy.TOKENIZE, testTenantId);
        String result2 = service.redact(input, RedactionStrategy.TOKENIZE, testTenantId);

        assertEquals(result1, result2);
    }

    @Test
    @DisplayName("TOKENIZE strategy should produce different tokens for different tenants")
    void testTokenizeTenantSpecific() {
        String input = "user@example.com";
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();

        String result1 = service.redact(input, RedactionStrategy.TOKENIZE, tenant1);
        String result2 = service.redact(input, RedactionStrategy.TOKENIZE, tenant2);

        assertNotEquals(result1, result2);
    }

    @Test
    @DisplayName("TOKENIZE strategy should produce different tokens for different values")
    void testTokenizeUnique() {
        String result1 = service.redact("value1", RedactionStrategy.TOKENIZE, testTenantId);
        String result2 = service.redact("value2", RedactionStrategy.TOKENIZE, testTenantId);

        assertNotEquals(result1, result2);
    }

    // ENCRYPT strategy tests

    @Test
    @DisplayName("ENCRYPT strategy should produce enc:dek:data format when KMS available")
    void testEncryptStrategy() {
        String result = service.redact("sensitive data", RedactionStrategy.ENCRYPT, testTenantId);

        assertTrue(result.startsWith("enc:"));
        // Should contain 3 parts: prefix, encrypted DEK, encrypted data
        String[] parts = result.substring(4).split(":");
        assertEquals(2, parts.length, "Expected format: enc:dek:data");
    }

    @Test
    @DisplayName("ENCRYPT strategy should fallback to HASH when KMS unavailable")
    void testEncryptFallbackWithoutKMS() {
        // KMS is mocked but returns null
        service.kms = null;

        String result = service.redact("sensitive data", RedactionStrategy.ENCRYPT, testTenantId);

        // Should fallback to HASH
        assertTrue(result.startsWith("hash:"));
    }

    @Test
    @DisplayName("ENCRYPT strategy should produce different ciphertexts (random IV + unique DEK)")
    void testEncryptUniqueIV() {
        String input = "test data";
        String result1 = service.redact(input, RedactionStrategy.ENCRYPT, testTenantId);
        String result2 = service.redact(input, RedactionStrategy.ENCRYPT, testTenantId);

        // Should be different due to random IV and unique DEKs per encryption
        assertNotEquals(result1, result2);
    }

    // Encryption/Decryption round-trip test

    @Test
    @DisplayName("Should decrypt encrypted value correctly (envelope encryption round-trip)")
    void testEncryptDecryptRoundTrip() {
        String original = "sensitive data";
        String encrypted = service.redact(original, RedactionStrategy.ENCRYPT, testTenantId);
        String decrypted = service.decrypt(encrypted, testTenantId);

        assertEquals(original, decrypted);
    }

    @Test
    @DisplayName("Decrypt should throw exception when KMS unavailable")
    void testDecryptWithoutKMS() {
        service.kms = null;

        assertThrows(UnsupportedOperationException.class, () -> {
            service.decrypt("enc:abc123", testTenantId);
        });
    }

    @Test
    @DisplayName("Decrypt should throw exception for invalid format")
    void testDecryptInvalidFormat() {
        assertThrows(IllegalArgumentException.class, () -> {
            service.decrypt("not-encrypted-value", testTenantId);
        });
    }

    @Test
    @DisplayName("Decrypt should throw exception for malformed envelope format")
    void testDecryptMalformedEnvelopeFormat() {
        // Missing colon separator
        assertThrows(IllegalArgumentException.class, () -> {
            service.decrypt("enc:onlyonepart", testTenantId);
        });
    }

    // Null and empty input tests

    @Test
    @DisplayName("Should return [REDACTED] for null input")
    void testNullInput() {
        String result = service.redact(null, RedactionStrategy.HASH, testTenantId);
        assertEquals("[REDACTED]", result);
    }

    @Test
    @DisplayName("Should return [REDACTED] for empty input")
    void testEmptyInput() {
        String result = service.redact("", RedactionStrategy.HASH, testTenantId);
        assertEquals("[REDACTED]", result);
    }

    // Error handling tests

    @Test
    @DisplayName("Should fallback to HASH on encryption error")
    void testFallbackOnError() {
        // Simulate KMS error by throwing exception
        when(kms.generateDataKey(anyString(), any(Map.class))).thenThrow(new RuntimeException("KMS unavailable"));

        String result = service.redact("test", RedactionStrategy.ENCRYPT, testTenantId);

        // Should fallback to HASH
        assertTrue(result.startsWith("hash:"));
    }

    // Strategy coverage test

    @Test
    @DisplayName("Should support all 7 redaction strategies")
    void testAllStrategies() {
        String input = "test@example.com";

        String exclude = service.redact(input, RedactionStrategy.EXCLUDE, testTenantId);
        String redact = service.redact(input, RedactionStrategy.REDACT, testTenantId);
        String hash = service.redact(input, RedactionStrategy.HASH, testTenantId);
        String truncate = service.redact(input, RedactionStrategy.TRUNCATE, testTenantId);
        String tokenize = service.redact(input, RedactionStrategy.TOKENIZE, testTenantId);
        String mask = service.redact(input, RedactionStrategy.MASK, testTenantId);
        String encrypt = service.redact(input, RedactionStrategy.ENCRYPT, testTenantId);

        assertEquals("[REDACTED]", exclude);
        assertEquals("[REDACTED]", redact);
        assertTrue(hash.startsWith("hash:"));
        assertTrue(truncate.contains("..."));
        assertTrue(tokenize.startsWith("TOK-"));
        assertTrue(mask.contains("***"));
        assertTrue(encrypt.startsWith("enc:"));
    }

    // Performance and security tests

    @Test
    @DisplayName("Hash should handle large inputs efficiently")
    void testHashLargeInput() {
        String largeInput = "x".repeat(10000);
        String result = service.redact(largeInput, RedactionStrategy.HASH, testTenantId);

        assertTrue(result.startsWith("hash:"));
        assertEquals(37, result.length()); // Hash length stays constant
    }

    @Test
    @DisplayName("Tokenize should handle Unicode characters")
    void testTokenizeUnicode() {
        String unicode = "用户@example.com";
        String result = service.redact(unicode, RedactionStrategy.TOKENIZE, testTenantId);

        assertTrue(result.startsWith("TOK-"));
    }

    @Test
    @DisplayName("Mask should handle special characters in email")
    void testMaskSpecialCharacters() {
        String email = "user+tag@sub.example.com";
        String result = service.redact(email, RedactionStrategy.MASK, testTenantId);

        assertTrue(result.contains("***"));
        assertTrue(result.contains("@"));
    }
}
