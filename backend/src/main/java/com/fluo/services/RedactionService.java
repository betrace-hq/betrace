package com.fluo.services;

import com.fluo.compliance.evidence.RedactionStrategy;
import com.fluo.kms.KeyManagementService;
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
import java.util.Map;
import java.util.UUID;

/**
 * Redacts PII values using 7 different strategies.
 * Fallback to EXCLUDE on any error to prevent PII leakage.
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
                case EXCLUDE -> "[REDACTED]";
                case REDACT -> "[REDACTED]";
                case HASH -> hashValue(value);
                case TRUNCATE -> truncateValue(value, 4);
                case TOKENIZE -> tokenizeValue(value, tenantId);
                case MASK -> maskValue(value);
                case ENCRYPT -> encryptValue(value, tenantId);
            };
        } catch (Exception e) {
            Log.errorf(e, "Redaction failed for strategy %s, falling back to EXCLUDE", strategy);
            return "[REDACTED]";
        }
    }

    /**
     * Redact with custom truncate preserve count.
     */
    public String redact(String value, RedactionStrategy strategy, UUID tenantId, int preserveChars) {
        if (strategy == RedactionStrategy.TRUNCATE) {
            try {
                return truncateValue(value, preserveChars);
            } catch (Exception e) {
                Log.errorf(e, "Truncation failed, falling back to EXCLUDE");
                return "[REDACTED]";
            }
        }
        return redact(value, strategy, tenantId);
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
     * TRUNCATE Strategy: Show first and last N characters.
     * Format: "1234...6789" (preserveChars=4)
     */
    private String truncateValue(String value, int preserveChars) {
        if (value.length() <= preserveChars * 2) {
            return "***";
        }

        String prefix = value.substring(0, preserveChars);
        String suffix = value.substring(value.length() - preserveChars);
        return prefix + "..." + suffix;
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
     * ENCRYPT Strategy: AES-256-GCM encryption using envelope encryption pattern.
     * Format: "enc:base64(encryptedDEK):base64(iv + ciphertext)"
     *
     * NOTE: Requires PRD-006 (KMS). For MVP, falls back to HASH if KMS unavailable.
     */
    private String encryptValue(String value, UUID tenantId) {
        // Check if KMS is available
        if (kms == null) {
            Log.warn("KMS not available, falling back to HASH for ENCRYPT strategy");
            return hashValue(value);
        }

        try {
            // Generate Data Encryption Key (DEK) for envelope encryption
            Map<String, String> context = Map.of(
                "tenant_id", tenantId.toString(),
                "purpose", "pii_redaction"
            );
            var dataKey = kms.generateDataKey("AES_256", context);

            // AES-256-GCM encryption with plaintext DEK
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");

            // Generate random IV (12 bytes for GCM)
            byte[] iv = new byte[12];
            SECURE_RANDOM.nextBytes(iv);

            GCMParameterSpec spec = new GCMParameterSpec(128, iv);
            SecretKeySpec keySpec = new SecretKeySpec(dataKey.plaintextKey(), "AES");

            cipher.init(Cipher.ENCRYPT_MODE, keySpec, spec);
            byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

            // Prepend IV to ciphertext
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            // Format: enc:base64(encryptedDEK):base64(ciphertext)
            String encryptedDEK = Base64.getEncoder().encodeToString(dataKey.encryptedKey());
            String encryptedData = Base64.getEncoder().encodeToString(combined);

            return "enc:" + encryptedDEK + ":" + encryptedData;
        } catch (Exception e) {
            Log.errorf(e, "Encryption failed, falling back to HASH");
            return hashValue(value);
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
     * Decrypt value using envelope encryption pattern (for auditor access only - requires PRD-006).
     * Expects format: "enc:base64(encryptedDEK):base64(iv + ciphertext)"
     */
    public String decrypt(String encryptedValue, UUID tenantId) {
        if (kms == null) {
            throw new UnsupportedOperationException("Decryption requires KMS (PRD-006)");
        }

        if (!encryptedValue.startsWith("enc:")) {
            throw new IllegalArgumentException("Invalid encrypted value format");
        }

        try {
            // Parse format: enc:encryptedDEK:ciphertext
            String[] parts = encryptedValue.substring(4).split(":");
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid encrypted value format (expected enc:dek:data)");
            }

            byte[] encryptedDEK = Base64.getDecoder().decode(parts[0]);
            byte[] combined = Base64.getDecoder().decode(parts[1]);

            // Decrypt DEK using KMS
            Map<String, String> context = Map.of(
                "tenant_id", tenantId.toString(),
                "purpose", "pii_redaction"
            );
            byte[] plaintextDEK = kms.decrypt(encryptedDEK, context);

            // Extract IV and ciphertext
            byte[] iv = new byte[12];
            byte[] ciphertext = new byte[combined.length - 12];
            System.arraycopy(combined, 0, iv, 0, 12);
            System.arraycopy(combined, 12, ciphertext, 0, ciphertext.length);

            // Decrypt data using DEK
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(128, iv);
            SecretKeySpec keySpec = new SecretKeySpec(plaintextDEK, "AES");

            cipher.init(Cipher.DECRYPT_MODE, keySpec, spec);
            byte[] plaintext = cipher.doFinal(ciphertext);

            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            // Re-throw IllegalArgumentException for invalid format
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }
}
