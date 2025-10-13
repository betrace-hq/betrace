package com.fluo.kms.adapters;

import com.fluo.kms.KeyManagementService;
import io.quarkus.logging.Log;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Map;

/**
 * Adapter: Local in-memory KMS for development and testing.
 *
 * ⚠️⚠️⚠️  CRITICAL WARNING: NOT FOR PRODUCTION USE  ⚠️⚠️⚠️
 *
 * SECURITY LIMITATIONS:
 * - Master key generated at startup (lost on restart)
 * - No key rotation support
 * - No hardware security module (HSM)
 * - No audit logging
 * - Keys stored in JVM heap (vulnerable to memory dumps)
 * - No persistent storage
 *
 * This adapter is ONLY suitable for:
 * - Local development (fluo.kms.provider=local in %dev profile)
 * - Unit testing
 * - CI/CD test environments
 *
 * Production alternatives (use one of these):
 * - AwsKmsAdapter (AWS KMS with CloudHSM) - fluo.kms.provider=aws
 * - VaultKmsAdapter (HashiCorp Vault Transit) - fluo.kms.provider=vault
 * - GcpKmsAdapter (Google Cloud KMS) - fluo.kms.provider=gcp
 * - AzureKmsAdapter (Azure Key Vault) - fluo.kms.provider=azure
 *
 * Security properties implemented:
 * - AES-256-GCM authenticated encryption
 * - Encryption context validated via additional authenticated data (AAD)
 * - Random IV per encryption operation (96 bits)
 * - 128-bit authentication tag
 * - Strong PRNG (SecureRandom.getInstanceStrong())
 *
 * Implementation details:
 * - Master key: Random AES-256 key via SecureRandom.getInstanceStrong()
 * - Data keys: Random AES-256 keys generated on demand
 * - Encryption: AES-256-GCM with encryption context as AAD
 *
 * Compliance: NOT COMPLIANT for production use (SOC2, HIPAA, etc.)
 */
public class LocalKmsAdapter implements KeyManagementService {

    private static final String PROVIDER_NAME = "local";
    private static final String MASTER_KEY_ID = "local-dev-master-key";
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128; // bits
    private static final int GCM_IV_LENGTH = 12;   // bytes (96 bits recommended for GCM)
    private static final int MAX_PLAINTEXT_SIZE = 4096; // 4KB (AWS KMS limit for compatibility)

    private final SecretKey masterKey;
    private final SecureRandom secureRandom;

    public LocalKmsAdapter() {
        try {
            // Use strong PRNG (P0-1 fix: Security Expert)
            this.secureRandom = SecureRandom.getInstanceStrong();
            this.masterKey = generateMasterKey();

            Log.warnf("⚠️⚠️⚠️  LocalKmsAdapter initialized - NOT FOR PRODUCTION USE  ⚠️⚠️⚠️");
            Log.warnf("⚠️  Master key will be lost on restart");
            Log.warnf("⚠️  Use AwsKmsAdapter, VaultKmsAdapter, GcpKmsAdapter, or AzureKmsAdapter in production");
        } catch (Exception e) {
            throw new KmsException(PROVIDER_NAME, "initialize",
                "Failed to initialize strong SecureRandom", e);
        }
    }

    /**
     * Generate random AES-256 master key at startup.
     */
    private SecretKey generateMasterKey() {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance("AES");
            keyGen.init(256, secureRandom);
            return keyGen.generateKey();
        } catch (Exception e) {
            throw new KmsException(PROVIDER_NAME, "initialize", "Failed to generate master key", e);
        }
    }

    @Override
    public byte[] encrypt(byte[] plaintext, Map<String, String> encryptionContext) {
        // Input validation (QA Expert P0 requirement)
        if (plaintext == null) {
            throw new IllegalArgumentException("plaintext cannot be null");
        }
        if (plaintext.length == 0) {
            throw new IllegalArgumentException("plaintext cannot be empty");
        }
        if (plaintext.length > MAX_PLAINTEXT_SIZE) {
            throw new KmsException(PROVIDER_NAME, "encrypt",
                String.format("Plaintext exceeds maximum size of %d bytes (actual: %d)",
                    MAX_PLAINTEXT_SIZE, plaintext.length));
        }

        try {
            Log.debugf("Encrypting %d bytes with context: %s", plaintext.length, encryptionContext);

            // Generate random IV
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            // Initialize cipher with GCM mode
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, masterKey, spec);

            // Add encryption context as additional authenticated data (AAD)
            if (encryptionContext != null && !encryptionContext.isEmpty()) {
                byte[] aad = serializeContext(encryptionContext);
                cipher.updateAAD(aad);
            }

            // Encrypt plaintext
            byte[] ciphertext = cipher.doFinal(plaintext);

            // Format: [IV_LENGTH(1 byte)][IV][CIPHERTEXT+TAG]
            ByteBuffer buffer = ByteBuffer.allocate(1 + iv.length + ciphertext.length);
            buffer.put((byte) iv.length);
            buffer.put(iv);
            buffer.put(ciphertext);

            Log.debugf("Encrypted to %d bytes (IV=%d, ciphertext+tag=%d)",
                buffer.position(), iv.length, ciphertext.length);

            return buffer.array();

        } catch (Exception e) {
            Log.errorf(e, "Encryption failed: %s", e.getMessage());
            throw new KmsException(PROVIDER_NAME, "encrypt", e.getMessage(), e);
        }
    }

    @Override
    public byte[] decrypt(byte[] ciphertext, Map<String, String> encryptionContext) {
        // Input validation (QA Expert P0 requirement)
        if (ciphertext == null) {
            throw new IllegalArgumentException("ciphertext cannot be null");
        }
        if (ciphertext.length == 0) {
            throw new IllegalArgumentException("ciphertext cannot be empty");
        }

        try {
            Log.debugf("Decrypting %d bytes with context: %s", ciphertext.length, encryptionContext);

            // Parse format: [IV_LENGTH(1 byte)][IV][CIPHERTEXT+TAG]
            ByteBuffer buffer = ByteBuffer.wrap(ciphertext);
            int ivLength = buffer.get() & 0xFF;

            byte[] iv = new byte[ivLength];
            buffer.get(iv);

            byte[] encryptedData = new byte[buffer.remaining()];
            buffer.get(encryptedData);

            // Initialize cipher with GCM mode
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, masterKey, spec);

            // Add encryption context as AAD (must match encryption)
            if (encryptionContext != null && !encryptionContext.isEmpty()) {
                byte[] aad = serializeContext(encryptionContext);
                cipher.updateAAD(aad);
            }

            // Decrypt and verify authentication tag
            byte[] plaintext = cipher.doFinal(encryptedData);

            Log.debugf("Decrypted to %d bytes", plaintext.length);
            return plaintext;

        } catch (Exception e) {
            Log.errorf(e, "Decryption failed: %s", e.getMessage());
            throw new KmsException(PROVIDER_NAME, "decrypt", e.getMessage(), e);
        }
    }

    @Override
    public DataKeyResponse generateDataKey(String keySpec, Map<String, String> encryptionContext) {
        try {
            Log.debugf("Generating data key with spec: %s", keySpec);

            // Parse key spec (e.g., "AES_256" → 256 bits)
            int keySize = parseKeySpec(keySpec);

            // Generate random data key
            KeyGenerator keyGen = KeyGenerator.getInstance("AES");
            keyGen.init(keySize, secureRandom);
            SecretKey dataKey = keyGen.generateKey();
            byte[] plaintextKey = dataKey.getEncoded();

            // Encrypt data key with master key
            byte[] encryptedKey = encrypt(plaintextKey, encryptionContext);

            Log.debugf("Generated data key: plaintext=%d bytes, encrypted=%d bytes",
                plaintextKey.length, encryptedKey.length);

            return new DataKeyResponse(plaintextKey, encryptedKey, keySpec);

        } catch (Exception e) {
            Log.errorf(e, "Data key generation failed: %s", e.getMessage());
            throw new KmsException(PROVIDER_NAME, "generateDataKey", e.getMessage(), e);
        }
    }

    @Override
    public String getMasterKeyId() {
        return MASTER_KEY_ID;
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public boolean healthCheck() {
        try {
            // Simple encrypt/decrypt round-trip test
            byte[] testData = "health-check".getBytes();
            Map<String, String> testContext = Map.of("test", "health");
            byte[] encrypted = encrypt(testData, testContext);
            byte[] decrypted = decrypt(encrypted, testContext);
            return Arrays.equals(testData, decrypted);
        } catch (Exception e) {
            Log.warnf(e, "Health check failed: %s", e.getMessage());
            return false;
        }
    }

    /**
     * Serialize encryption context to bytes for AAD.
     * Format: key1=value1,key2=value2 (sorted by key)
     */
    private byte[] serializeContext(Map<String, String> context) {
        return context.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(e -> e.getKey() + "=" + e.getValue())
            .reduce((a, b) -> a + "," + b)
            .orElse("")
            .getBytes();
    }

    /**
     * Parse key spec to key size in bits.
     */
    private int parseKeySpec(String keySpec) {
        return switch (keySpec.toUpperCase()) {
            case "AES_256" -> 256;
            case "AES_128" -> 128;
            default -> throw new IllegalArgumentException("Unsupported key spec: " + keySpec);
        };
    }
}
