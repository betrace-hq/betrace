package com.fluo.kms.adapters;

import com.fluo.kms.KeyManagementService;
import io.quarkus.logging.Log;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

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

    // Signing key storage (PRD-003: Interim implementation)
    private final Path keyStorePath;
    private final Map<UUID, KeyPair> signingKeyCache = new ConcurrentHashMap<>();

    public LocalKmsAdapter() {
        try {
            // Use strong PRNG (P0-1 fix: Security Expert)
            this.secureRandom = SecureRandom.getInstanceStrong();
            this.masterKey = generateMasterKey();

            // Initialize BouncyCastle provider for Ed25519
            Security.addProvider(new BouncyCastleProvider());

            // Initialize key storage path (configurable via system property)
            String keyStorageDir = System.getProperty("fluo.kms.key-store-path", "./data/keys");
            this.keyStorePath = Paths.get(keyStorageDir);
            Files.createDirectories(keyStorePath);

            Log.infof("Key storage initialized at: %s", keyStorePath.toAbsolutePath());

            Log.warnf("⚠️⚠️⚠️  LocalKmsAdapter initialized - NOT FOR PRODUCTION USE  ⚠️⚠️⚠️");
            Log.warnf("⚠️  Master key will be lost on restart");
            Log.warnf("⚠️  Use AwsKmsAdapter, VaultKmsAdapter, GcpKmsAdapter, or AzureKmsAdapter in production");
        } catch (Exception e) {
            throw new KmsException(PROVIDER_NAME, "initialize",
                "Failed to initialize LocalKmsAdapter", e);
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

        // P0-5 Security Fix: Validate encryption context for signing key operations
        // Encryption context is required for authenticated encryption (GCM AAD)
        if (encryptionContext == null || encryptionContext.isEmpty()) {
            throw new IllegalArgumentException("encryptionContext cannot be null or empty for authenticated decryption");
        }

        // P0-5 Security Fix: Validate required context keys for tenant isolation
        if (!encryptionContext.containsKey("tenantId")) {
            throw new IllegalArgumentException("encryptionContext must contain 'tenantId' for tenant isolation");
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

    // ==========================================
    // Signing Key Methods (Interim - PRD-003)
    // ==========================================

    @Override
    public SigningKeyResponse generateSigningKeyPair(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }

        try {
            Log.infof("Generating Ed25519 signing key pair for tenant: %s", tenantId);

            // Generate Ed25519 key pair using BouncyCastle
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519", "BC");
            keyGen.initialize(255, secureRandom); // Ed25519 uses 255-bit private key
            KeyPair keyPair = keyGen.generateKeyPair();

            // Generate unique key ID for key rotation tracking
            UUID keyId = UUID.randomUUID();

            // Store encrypted key to filesystem
            storeEncryptedSigningKey(tenantId, keyId, keyPair);

            // P0-2 Security Fix: Validate key file was successfully written before caching
            Path keyFile = keyStorePath.resolve(tenantId.toString()).resolve("signing_key.enc");
            if (!Files.exists(keyFile)) {
                throw new IOException("Key file was not created: " + keyFile);
            }

            // Cache in memory for performance (only after successful storage)
            signingKeyCache.put(tenantId, keyPair);

            Log.infof("Generated signing key %s for tenant %s", keyId, tenantId);

            return new SigningKeyResponse(keyId, keyPair.getPublic(), "Ed25519");

        } catch (NoSuchAlgorithmException | NoSuchProviderException e) {
            throw new KmsException(PROVIDER_NAME, "generateSigningKeyPair",
                "Ed25519 algorithm not available (missing BouncyCastle provider?)", e);
        } catch (Exception e) {
            throw new KmsException(PROVIDER_NAME, "generateSigningKeyPair",
                "Failed to generate signing key for tenant " + tenantId, e);
        }
    }

    @Override
    public PrivateKey getTenantSigningKey(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }

        // Check cache first
        KeyPair cachedKeyPair = signingKeyCache.get(tenantId);
        if (cachedKeyPair != null) {
            Log.debugf("Retrieved signing key from cache for tenant: %s", tenantId);
            return cachedKeyPair.getPrivate();
        }

        // Load from filesystem
        try {
            KeyPair keyPair = loadSigningKey(tenantId);

            // P0-2 Security Fix: Validate key pair before caching
            if (keyPair == null || keyPair.getPrivate() == null) {
                throw new IllegalStateException("Loaded key pair is invalid (null)");
            }

            signingKeyCache.put(tenantId, keyPair); // Cache for next time
            return keyPair.getPrivate();
        } catch (IOException e) {
            // P0-3 Security Fix: Add random delay to prevent timing attacks
            addTimingAttackDelay();
            throw new KmsException(PROVIDER_NAME, "getTenantSigningKey",
                "Signing key not found for tenant " + tenantId + " (generate first)", e);
        } catch (Exception e) {
            // P0-3 Security Fix: Add random delay to prevent timing attacks
            addTimingAttackDelay();
            throw new KmsException(PROVIDER_NAME, "getTenantSigningKey",
                "Failed to load signing key for tenant " + tenantId, e);
        }
    }

    @Override
    public PublicKey getTenantPublicKey(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }

        // Check cache first
        KeyPair cachedKeyPair = signingKeyCache.get(tenantId);
        if (cachedKeyPair != null) {
            Log.debugf("Retrieved public key from cache for tenant: %s", tenantId);
            return cachedKeyPair.getPublic();
        }

        // Load from filesystem
        try {
            KeyPair keyPair = loadSigningKey(tenantId);

            // P0-2 Security Fix: Validate key pair before caching
            if (keyPair == null || keyPair.getPublic() == null) {
                throw new IllegalStateException("Loaded key pair is invalid (null)");
            }

            signingKeyCache.put(tenantId, keyPair); // Cache for next time
            return keyPair.getPublic();
        } catch (IOException e) {
            // P0-3 Security Fix: Add random delay to prevent timing attacks
            addTimingAttackDelay();
            throw new KmsException(PROVIDER_NAME, "getTenantPublicKey",
                "Public key not found for tenant " + tenantId + " (generate first)", e);
        } catch (Exception e) {
            // P0-3 Security Fix: Add random delay to prevent timing attacks
            addTimingAttackDelay();
            throw new KmsException(PROVIDER_NAME, "getTenantPublicKey",
                "Failed to load public key for tenant " + tenantId, e);
        }
    }

    /**
     * Store signing key pair encrypted at rest with tenant DEK.
     */
    private void storeEncryptedSigningKey(UUID tenantId, UUID keyId, KeyPair keyPair) throws Exception {
        Path tenantDir = keyStorePath.resolve(tenantId.toString());
        Files.createDirectories(tenantDir);

        Path keyFile = tenantDir.resolve("signing_key.enc");

        // Generate tenant-specific DEK for key encryption
        Map<String, String> encryptionContext = Map.of(
            "tenantId", tenantId.toString(),
            "keyType", "signing",
            "keyId", keyId.toString()
        );
        DataKeyResponse dek = generateDataKey("AES_256", encryptionContext);

        byte[] privateKeyBytes = null;
        byte[] publicKeyBytes = null;
        try {
            // Encrypt private key with tenant DEK
            privateKeyBytes = keyPair.getPrivate().getEncoded();
            byte[] encryptedPrivateKey = encryptWithKey(privateKeyBytes, dek.plaintextKey(), encryptionContext);

            // Public key stored unencrypted (needed for verification)
            publicKeyBytes = keyPair.getPublic().getEncoded();

            // Format: keyId(16) + encryptedDEK(variable) + encryptedPrivateKey(variable) + publicKey(32)
            ByteBuffer buffer = ByteBuffer.allocate(
                16 + 4 + dek.encryptedKey().length + 4 + encryptedPrivateKey.length + 4 + publicKeyBytes.length
            );

            // Write keyId (UUID as 16 bytes)
            buffer.putLong(keyId.getMostSignificantBits());
            buffer.putLong(keyId.getLeastSignificantBits());

            // Write encrypted DEK (length-prefixed)
            buffer.putInt(dek.encryptedKey().length);
            buffer.put(dek.encryptedKey());

            // Write encrypted private key (length-prefixed)
            buffer.putInt(encryptedPrivateKey.length);
            buffer.put(encryptedPrivateKey);

            // Write public key (length-prefixed)
            buffer.putInt(publicKeyBytes.length);
            buffer.put(publicKeyBytes);

            Files.write(keyFile, buffer.array(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            Log.debugf("Stored encrypted signing key: %s", keyFile);

        } finally {
            // P0-1 Security Fix: Zero out plaintext private key bytes from memory
            if (privateKeyBytes != null) {
                Arrays.fill(privateKeyBytes, (byte) 0);
            }
            // Public key bytes can remain (not sensitive)

            // Zero out plaintext DEK from memory
            dek.zeroPlaintextKey();
            Arrays.fill(dek.plaintextKey(), (byte) 0);
        }
    }

    /**
     * Load signing key pair from filesystem, decrypting private key.
     */
    private KeyPair loadSigningKey(UUID tenantId) throws Exception {
        Path keyFile = keyStorePath.resolve(tenantId.toString()).resolve("signing_key.enc");

        if (!Files.exists(keyFile)) {
            throw new IOException("Signing key file not found: " + keyFile);
        }

        byte[] keyData = Files.readAllBytes(keyFile);

        // Validate minimum file size (16 bytes for UUID + 4 bytes for length)
        if (keyData.length < 20) {
            throw new KmsException(PROVIDER_NAME, "loadSigningKey",
                "Corrupted key file: insufficient data (expected >= 20 bytes, got " + keyData.length + " bytes)");
        }

        ByteBuffer buffer = ByteBuffer.wrap(keyData);

        try {
            // Read keyId (UUID as 16 bytes)
            long keyIdMsb = buffer.getLong();
            long keyIdLsb = buffer.getLong();
            UUID keyId = new UUID(keyIdMsb, keyIdLsb);

            // Read encrypted DEK (length-prefixed)
            int dekLength = buffer.getInt();
            if (dekLength < 0 || dekLength > 1024) { // Sanity check
                throw new IllegalArgumentException("Invalid DEK length: " + dekLength);
            }
            byte[] encryptedDEK = new byte[dekLength];
            buffer.get(encryptedDEK);

            // Read encrypted private key (length-prefixed)
            int privateKeyLength = buffer.getInt();
            if (privateKeyLength < 0 || privateKeyLength > 8192) { // Sanity check
                throw new IllegalArgumentException("Invalid private key length: " + privateKeyLength);
            }
            byte[] encryptedPrivateKey = new byte[privateKeyLength];
            buffer.get(encryptedPrivateKey);

            // Read public key (length-prefixed)
            int publicKeyLength = buffer.getInt();
            if (publicKeyLength < 0 || publicKeyLength > 1024) { // Sanity check
                throw new IllegalArgumentException("Invalid public key length: " + publicKeyLength);
            }
            byte[] publicKeyBytes = new byte[publicKeyLength];
            buffer.get(publicKeyBytes);

            // Decrypt DEK
            Map<String, String> encryptionContext = Map.of(
                "tenantId", tenantId.toString(),
                "keyType", "signing",
                "keyId", keyId.toString()
            );

            // For LocalKmsAdapter, encrypted DEK is just encrypted with master key
            byte[] dekBytes = decrypt(encryptedDEK, encryptionContext);
            byte[] privateKeyBytes = null;

            try {
                // Decrypt private key with DEK
                privateKeyBytes = decryptWithKey(encryptedPrivateKey, dekBytes, encryptionContext);

                // Reconstruct keys
                KeyFactory keyFactory = KeyFactory.getInstance("Ed25519", "BC");
                PrivateKey privateKey = keyFactory.generatePrivate(new PKCS8EncodedKeySpec(privateKeyBytes));
                PublicKey publicKey = keyFactory.generatePublic(new X509EncodedKeySpec(publicKeyBytes));

                Log.debugf("Loaded signing key for tenant %s (keyId: %s)", tenantId, keyId);

                return new KeyPair(publicKey, privateKey);

            } finally {
                // P0-4 Security Fix: Zero out plaintext private key bytes and DEK from memory
                if (privateKeyBytes != null) {
                    Arrays.fill(privateKeyBytes, (byte) 0);
                }
                Arrays.fill(dekBytes, (byte) 0);
            }
        } catch (java.nio.BufferUnderflowException | IllegalArgumentException e) {
            // Corrupted file - insufficient data or invalid format
            Log.errorf(e, "Failed to load signing key for tenant %s: corrupted file", tenantId);
            throw new KmsException(PROVIDER_NAME, "loadSigningKey",
                "Corrupted key file: " + e.getMessage(), e);
        } catch (Exception e) {
            // Other errors during key loading
            Log.errorf(e, "Failed to load signing key for tenant %s", tenantId);
            throw new KmsException(PROVIDER_NAME, "loadSigningKey",
                "Failed to load signing key for tenant " + tenantId, e);
        }
    }

    /**
     * Encrypt data with a specific AES key (for DEK-based encryption).
     */
    private byte[] encryptWithKey(byte[] plaintext, byte[] key, Map<String, String> encryptionContext) throws Exception {
        SecretKey secretKey = new SecretKeySpec(key, "AES");

        byte[] iv = new byte[GCM_IV_LENGTH];
        secureRandom.nextBytes(iv);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec);

        if (encryptionContext != null && !encryptionContext.isEmpty()) {
            byte[] aad = serializeContext(encryptionContext);
            cipher.updateAAD(aad);
        }

        byte[] ciphertext = cipher.doFinal(plaintext);

        // Package: iv + ciphertext
        ByteBuffer buffer = ByteBuffer.allocate(GCM_IV_LENGTH + ciphertext.length);
        buffer.put(iv);
        buffer.put(ciphertext);

        return buffer.array();
    }

    /**
     * Decrypt data with a specific AES key (for DEK-based decryption).
     */
    private byte[] decryptWithKey(byte[] encrypted, byte[] key, Map<String, String> encryptionContext) throws Exception {
        SecretKey secretKey = new SecretKeySpec(key, "AES");

        ByteBuffer buffer = ByteBuffer.wrap(encrypted);

        byte[] iv = new byte[GCM_IV_LENGTH];
        buffer.get(iv);

        byte[] ciphertext = new byte[buffer.remaining()];
        buffer.get(ciphertext);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);

        if (encryptionContext != null && !encryptionContext.isEmpty()) {
            byte[] aad = serializeContext(encryptionContext);
            cipher.updateAAD(aad);
        }

        return cipher.doFinal(ciphertext);
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
     * P0-3 Security Fix: Add random delay to prevent timing attacks.
     *
     * Prevents attackers from determining key existence via response time differences.
     * Adds 10-50ms random delay to failure paths to make timing analysis infeasible.
     */
    private void addTimingAttackDelay() {
        try {
            // Random delay between 10-50ms
            int delayMs = 10 + secureRandom.nextInt(40);
            Thread.sleep(delayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            // Restore interrupt status but don't throw
        }
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

    /**
     * Clear the signing key cache (for testing purposes).
     * Forces keys to be reloaded from filesystem on next access.
     */
    public void clearSigningKeyCache() {
        int size = signingKeyCache.size();
        signingKeyCache.clear();
        Log.debugf("Cleared signing key cache (%d entries removed)", size);
    }
}
