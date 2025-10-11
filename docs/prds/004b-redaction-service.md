# PRD-004b: Redaction Service

**Priority:** P0
**Complexity:** Medium
**Unit:** `RedactionService.java`
**Dependencies:** PRD-006 (KMS for ENCRYPT strategy - optional for MVP)

## Problem

Detected PII must be redacted using configurable strategies before storage. Current `@Redact` annotations exist but are not enforced, allowing raw PII values to persist.

## Architecture Integration

**ADR Compliance:**
- **ADR-011:** Stateless service, no SQL tables
- **ADR-012:** Tenant-specific encryption keys from KMS
- **ADR-015:** Redaction occurs before all storage tiers

## Implementation

```java
package com.fluo.services;

import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

import com.fluo.model.RedactionStrategy;

/**
 * Redacts PII values using 5 different strategies.
 * Fallback to REMOVE on any error to prevent PII leakage.
 */
@ApplicationScoped
public class RedactionService {

    @Inject
    KeyManagementService kms; // PRD-006 (optional for MVP)

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /**
     * Redact a value based on the specified strategy.
     *
     * @param value Original value to redact
     * @param strategy Redaction strategy to apply
     * @param tenantId Tenant ID (for ENCRYPT and TOKENIZE)
     * @return Redacted value
     */
    public String redact(String value, RedactionStrategy strategy, UUID tenantId) {
        if (value == null || value.isEmpty()) {
            return "[REDACTED]";
        }

        try {
            return switch (strategy) {
                case HASH -> hashValue(value);
                case MASK -> maskValue(value);
                case TOKENIZE -> tokenizeValue(value, tenantId);
                case REMOVE -> "[REDACTED]";
                case ENCRYPT -> encryptValue(value, tenantId);
            };
        } catch (Exception e) {
            Log.errorf(e, "Redaction failed for strategy %s, falling back to REMOVE", strategy);
            return "[REDACTED]";
        }
    }

    /**
     * HASH Strategy: SHA-256 one-way hash (not reversible).
     * Format: "hash:5e884898da28047151d0e56f8dc6292"
     */
    private String hashValue(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            String hashHex = bytesToHex(hashBytes);

            // Return first 32 chars for brevity
            return "hash:" + hashHex.substring(0, 32);
        } catch (Exception e) {
            throw new RuntimeException("Hash failed", e);
        }
    }

    /**
     * MASK Strategy: Partial masking (shows some context, hides sensitive parts).
     * Email: "user@example.com" → "u***@e***.com"
     * Other: "value" → "v***e"
     */
    private String maskValue(String value) {
        if (value.length() <= 4) {
            return "****";
        }

        // Special handling for email
        if (value.contains("@")) {
            int atIndex = value.indexOf("@");
            String localPart = value.substring(0, atIndex);
            String domain = value.substring(atIndex + 1);

            String maskedLocal = localPart.length() > 0
                ? localPart.charAt(0) + "***"
                : "***";

            String maskedDomain = domain.length() > 0
                ? domain.charAt(0) + "***" + (domain.contains(".") ? domain.substring(domain.lastIndexOf('.')) : ".com")
                : "***.com";

            return maskedLocal + "@" + maskedDomain;
        }

        // Generic masking: show first and last char
        return value.charAt(0) + "***" + value.charAt(value.length() - 1);
    }

    /**
     * TOKENIZE Strategy: Deterministic token generation.
     * Same value + same tenant = same token (allows joins/correlation).
     * Format: "TOK-abc123def456"
     */
    private String tokenizeValue(String value, UUID tenantId) {
        try {
            // Generate deterministic token using tenant ID as salt
            String tokenInput = tenantId.toString() + ":" + value;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(tokenInput.getBytes(StandardCharsets.UTF_8));
            String hashHex = bytesToHex(hashBytes);

            // Use first 12 chars as token
            return "TOK-" + hashHex.substring(0, 12);
        } catch (Exception e) {
            throw new RuntimeException("Tokenization failed", e);
        }
    }

    /**
     * REMOVE Strategy: Complete removal.
     * Format: "[REDACTED]"
     */
    // Implemented in switch statement above

    /**
     * ENCRYPT Strategy: AES-256-GCM encryption (reversible with tenant key).
     * Format: "enc:base64(iv + ciphertext)"
     *
     * NOTE: Requires PRD-006 (KMS). For MVP, can fallback to HASH if KMS unavailable.
     */
    private String encryptValue(String value, UUID tenantId) {
        // Check if KMS is available
        if (kms == null) {
            Log.warn("KMS not available, falling back to HASH for ENCRYPT strategy");
            return hashValue(value);
        }

        try {
            // Get tenant encryption key from KMS (PRD-006)
            byte[] encryptionKey = kms.getTenantEncryptionKey(tenantId);

            // AES-256-GCM encryption
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");

            // Generate random IV (12 bytes for GCM)
            byte[] iv = new byte[12];
            SECURE_RANDOM.nextBytes(iv);

            GCMParameterSpec spec = new GCMParameterSpec(128, iv);
            SecretKeySpec keySpec = new SecretKeySpec(encryptionKey, "AES");

            cipher.init(Cipher.ENCRYPT_MODE, keySpec, spec);
            byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

            // Prepend IV to ciphertext for decryption
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return "enc:" + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    // Utility: Convert bytes to hex string
    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    /**
     * Decrypt value (separate API endpoint in PRD-006).
     */
    public String decrypt(String encryptedValue, UUID tenantId) {
        // Implementation in PRD-006 (KMS integration)
        throw new UnsupportedOperationException("Decryption requires PRD-006");
    }
}
```

```java
package com.fluo.model;

/**
 * Strategies for redacting PII values.
 */
public enum RedactionStrategy {
    HASH,       // SHA-256 hash (not reversible)
    MASK,       // Partial masking (shows context)
    TOKENIZE,   // Deterministic token (allows joins)
    REMOVE,     // Complete removal
    ENCRYPT     // AES-256-GCM encryption (reversible with key)
}
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests:**
- `testHashStrategy()` - Produces "hash:..." prefix, same input = same output
- `testMaskStrategy()` - Email masked as "u***@e***.com", generic as "v***e"
- `testTokenizeStrategy()` - Produces "TOK-...", deterministic per tenant
- `testRemoveStrategy()` - Returns "[REDACTED]"
- `testEncryptStrategy()` - Produces "enc:..." prefix, contains IV + ciphertext
- `testFallbackOnError()` - Any error → "[REDACTED]"
- `testNullAndEmptyInput()` - Returns "[REDACTED]"
- `testDeterministicTokenization()` - Same value+tenant = same token
- `testEncryptWithoutKMS()` - Falls back to HASH when KMS unavailable

## Security Considerations (Security Expert)

**Threat Model:**
- **Weak Hashing:** SHA-256 without salt vulnerable to rainbow tables
  - Mitigation: Acceptable for MVP, salt can be added per-tenant later
- **IV Reuse (Encryption):** CRITICAL - reusing IV breaks GCM security
  - Mitigation: SecureRandom generates unique IV per encryption
- **KMS Key Compromise:** Attacker gets tenant key, decrypts all ENCRYPT values
  - Mitigation: KMS key rotation, audit logs (PRD-006)
- **Token Collision:** Different PII values produce same token
  - Mitigation: SHA-256 has negligible collision probability
- **Timing Attacks:** Redaction time reveals value length
  - Mitigation: Acceptable for MVP, constant-time not required

## Success Criteria

- [ ] HASH, MASK, TOKENIZE, REMOVE, ENCRYPT strategies implemented
- [ ] ENCRYPT uses AES-256-GCM with random IV
- [ ] Fallback to REMOVE on any error (no PII leakage)
- [ ] KMS integration for ENCRYPT (or fallback to HASH)
- [ ] 90% test coverage

## Files to Create

- `backend/src/main/java/com/fluo/services/RedactionService.java`
- `backend/src/main/java/com/fluo/model/RedactionStrategy.java`
- `backend/src/test/java/com/fluo/services/RedactionServiceTest.java`

## Dependencies

**Requires:** PRD-006 (KMS) for ENCRYPT strategy (optional - can fallback)
**Blocks:** PRD-004d (Redaction processor needs this service)
