package com.fluo.kms;

import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Map;
import java.util.UUID;

/**
 * Port: Key Management Service abstraction for cryptographic operations.
 *
 * Enables pluggable KMS providers via ports-and-adapters architecture:
 * - AWS KMS (AwsKmsAdapter)
 * - HashiCorp Vault (VaultKmsAdapter)
 * - Google Cloud KMS (GcpKmsAdapter)
 * - Azure Key Vault (AzureKmsAdapter)
 * - Local in-memory (LocalKmsAdapter) - development only
 * - Custom implementations (implement this interface)
 *
 * ADR Compliance:
 * - ADR-011 (Pure Application): No vendor lock-in, deployment-agnostic
 * - Ports-and-Adapters: Clean separation between domain logic and infrastructure
 *
 * Security Properties:
 * - Encryption context enforced for all operations (tenant isolation)
 * - Master key abstraction (provider-specific implementation)
 * - Data key generation for envelope encryption
 * - Per-tenant signing keys for compliance spans (Ed25519)
 *
 * Compliance:
 * - SOC2 CC6.1 (Logical Access Controls) - Encryption key management
 * - HIPAA 164.312(a)(2)(iv) (Encryption/Decryption) - Cryptographic isolation
 * - PRD-003 (Compliance Span Signing) - Tamper-evident audit trails
 *
 * NOTE: Signing key methods are interim implementation for PRD-003.
 * Will be superseded by PRD-006b (Key Generation Service) when TigerBeetle integration is complete.
 */
public interface KeyManagementService {

    /**
     * Encrypt plaintext with master key and encryption context.
     *
     * Encryption context provides additional authenticated data (AAD) for
     * authenticated encryption. Context must match between encrypt/decrypt.
     *
     * @param plaintext Data to encrypt (max size provider-dependent)
     * @param encryptionContext Additional authenticated data (tenant_id, key_type, etc.)
     * @return Encrypted ciphertext (provider-specific format)
     * @throws KmsException if encryption fails
     */
    byte[] encrypt(byte[] plaintext, Map<String, String> encryptionContext);

    /**
     * Decrypt ciphertext with encryption context validation.
     *
     * Encryption context must exactly match the context provided during encryption.
     * Mismatch results in authentication failure.
     *
     * @param ciphertext Encrypted data (provider-specific format)
     * @param encryptionContext Must match encryption context from encrypt()
     * @return Decrypted plaintext
     * @throws KmsException if decryption fails or context mismatch
     */
    byte[] decrypt(byte[] ciphertext, Map<String, String> encryptionContext);

    /**
     * Generate data encryption key (DEK) for envelope encryption.
     *
     * Returns both plaintext and encrypted versions of the data key:
     * - Plaintext DEK: Use immediately for encryption, then discard
     * - Encrypted DEK: Store for future decryption operations
     *
     * Envelope encryption pattern:
     * 1. Generate DEK via this method
     * 2. Use plaintext DEK to encrypt data (AES-256-GCM)
     * 3. Store encrypted DEK alongside encrypted data
     * 4. Discard plaintext DEK (zero out memory)
     * 5. To decrypt: decrypt DEK first, then decrypt data
     *
     * @param keySpec Key specification (e.g., "AES_256", "AES_128")
     * @param encryptionContext Additional authenticated data for DEK encryption
     * @return Data key response containing plaintext and encrypted key
     * @throws KmsException if generation fails
     */
    DataKeyResponse generateDataKey(String keySpec, Map<String, String> encryptionContext);

    /**
     * Get master key identifier (provider-specific format).
     *
     * Examples:
     * - AWS: "arn:aws:kms:us-east-1:123456789:key/abc-123"
     * - Vault: "transit/keys/fluo-master-key"
     * - GCP: "projects/my-project/locations/us/keyRings/fluo/cryptoKeys/master"
     * - Azure: "https://myvault.vault.azure.net/keys/fluo-master/v1"
     * - Local: "local-dev-key"
     *
     * @return Master key identifier
     */
    String getMasterKeyId();

    /**
     * Get KMS provider name for logging/metrics.
     *
     * @return Provider name ("aws", "vault", "gcp", "azure", "local")
     */
    String getProviderName();

    /**
     * Health check: Verify KMS connectivity and permissions.
     *
     * Should perform lightweight operation to validate:
     * - Network connectivity to KMS service
     * - Authentication credentials valid
     * - Permissions to use master key
     *
     * @return true if KMS is healthy and accessible
     */
    boolean healthCheck();

    // ==========================================
    // Signing Key Methods (Interim - PRD-003)
    // ==========================================
    // NOTE: These methods provide minimal signing key support for PRD-003
    // (Compliance Span Cryptographic Signing). Will be superseded by PRD-006b
    // (Key Generation Service) when full TigerBeetle integration is available.
    //
    // Implementation Strategy:
    // - Filesystem storage for encrypted keys (deployment-agnostic)
    // - Ed25519 signing keys (industry standard for compliance)
    // - Keys encrypted at rest with tenant DEKs
    // - Migration path to PRD-006b TigerBeetle storage
    // ==========================================

    /**
     * Generate Ed25519 signing key pair for tenant.
     *
     * Keys are generated using SecureRandom.getInstanceStrong() and stored
     * encrypted at rest with tenant-specific data encryption key (DEK).
     *
     * INTERIM IMPLEMENTATION: Stores keys in filesystem (configurable path).
     * PRD-006b will migrate to TigerBeetle metadata storage.
     *
     * @param tenantId Tenant UUID
     * @return Signing key response containing public key and key ID
     * @throws KmsException if key generation fails
     */
    SigningKeyResponse generateSigningKeyPair(UUID tenantId);

    /**
     * Retrieve tenant's private signing key for signature generation.
     *
     * Key is decrypted from storage using tenant DEK. Returned key should
     * be used immediately for signing and not retained in memory.
     *
     * @param tenantId Tenant UUID
     * @return Ed25519 private key for signing
     * @throws KmsException if key not found or decryption fails
     */
    PrivateKey getTenantSigningKey(UUID tenantId);

    /**
     * Retrieve tenant's public signing key for signature verification.
     *
     * Public keys are stored unencrypted for fast verification without
     * requiring tenant DEK decryption.
     *
     * @param tenantId Tenant UUID
     * @return Ed25519 public key for verification
     * @throws KmsException if key not found
     */
    PublicKey getTenantPublicKey(UUID tenantId);

    /**
     * Signing key response containing public key and metadata.
     */
    record SigningKeyResponse(
        UUID keyId,               // Key identifier (for key rotation tracking)
        PublicKey publicKey,      // Ed25519 public key (for verification)
        String algorithm          // Always "Ed25519"
    ) {}

    /**
     * Data key response containing plaintext and encrypted key.
     *
     * Security: Plaintext key must be zeroed from memory after use.
     */
    record DataKeyResponse(
        byte[] plaintextKey,      // Use immediately, then zero out
        byte[] encryptedKey,      // Store for future decryption
        String keySpec            // Key specification (e.g., "AES_256")
    ) {
        /**
         * Zero out plaintext key from memory (security best practice).
         */
        public void zeroPlaintextKey() {
            if (plaintextKey != null) {
                java.util.Arrays.fill(plaintextKey, (byte) 0);
            }
        }
    }

    /**
     * Exception thrown when KMS operations fail.
     */
    class KmsException extends RuntimeException {
        private final String provider;
        private final String operation;

        public KmsException(String provider, String operation, String message) {
            super(String.format("[%s] %s failed: %s", provider, operation, message));
            this.provider = provider;
            this.operation = operation;
        }

        public KmsException(String provider, String operation, String message, Throwable cause) {
            super(String.format("[%s] %s failed: %s", provider, operation, message), cause);
            this.provider = provider;
            this.operation = operation;
        }

        public String getProvider() {
            return provider;
        }

        public String getOperation() {
            return operation;
        }
    }
}
