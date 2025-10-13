package com.fluo.kms;

import java.util.Map;

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
 *
 * Compliance:
 * - SOC2 CC6.1 (Logical Access Controls) - Encryption key management
 * - HIPAA 164.312(a)(2)(iv) (Encryption/Decryption) - Cryptographic isolation
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
