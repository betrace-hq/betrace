package com.fluo.services;

import com.fluo.kms.KeyManagementService;
import com.fluo.kms.KeyManagementService.SigningKeyResponse;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.security.PublicKey;
import java.time.Instant;
import java.util.UUID;

/**
 * Key generation service for per-tenant cryptographic keys (PRD-006b).
 *
 * Generates two types of keys per tenant:
 * 1. Signing Keys (Ed25519): For compliance span signatures (PRD-003)
 * 2. Encryption Keys (AES-256): For PII encryption (PRD-004)
 *
 * Key Generation Flow:
 * 1. Generate key via KeyManagementService (KMS-agnostic)
 * 2. Store key metadata (filesystem for now, TigerBeetle later)
 * 3. Return key ID and public key (if applicable)
 *
 * Security Properties:
 * - Private keys encrypted at rest (KMS-managed)
 * - Per-tenant cryptographic isolation
 * - Strong PRNG for key generation
 * - Encryption context enforced (tenant ID validation)
 * - Key IDs tracked for rotation
 *
 * KMS Provider Agnostic:
 * - Works with any KeyManagementService implementation
 * - LocalKmsAdapter: Filesystem storage + AES-256-GCM
 * - AwsKmsAdapter: AWS KMS with CloudHSM
 * - VaultKmsAdapter: HashiCorp Vault Transit
 * - GcpKmsAdapter: Google Cloud KMS
 * - AzureKmsAdapter: Azure Key Vault
 *
 * Storage Strategy:
 * - Current: Filesystem storage (deployment-agnostic)
 * - Future: TigerBeetle metadata storage (PRD-002 completion)
 *
 * Compliance:
 * - SOC2 CC6.7: Encryption at rest and in transit
 * - NIST 800-53 SC-12: Cryptographic key establishment
 * - HIPAA 164.312(a)(2)(iv): Encryption/decryption keys
 *
 * @see KeyManagementService
 * @see KeyRetrievalService
 */
@ApplicationScoped
public class KeyGenerationService {

    @Inject
    KeyManagementService kms;

    /**
     * Generate Ed25519 signing key pair for tenant.
     *
     * Signing keys are used for:
     * - Compliance span digital signatures (PRD-003)
     * - Tamper-evident audit trails
     * - Cryptographic proof of control effectiveness
     *
     * Key Properties:
     * - Algorithm: Ed25519 (EdDSA)
     * - Public key size: 32 bytes
     * - Private key size: 32 bytes (seed)
     * - Signature size: 64 bytes
     *
     * Storage:
     * - Private key: Encrypted with KMS master key, stored in filesystem
     * - Public key: Stored unencrypted (needed for verification)
     * - Key metadata: Stored with creation timestamp and tenant ID
     *
     * @param tenantId Tenant UUID
     * @return Signing key response with key ID and public key
     * @throws KeyGenerationException if generation fails
     */
    public SigningKeyResult generateSigningKey(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }

        try {
            Log.infof("Generating Ed25519 signing key for tenant: %s", tenantId);

            long startTime = System.currentTimeMillis();

            // Generate key pair via KMS (provider-agnostic)
            SigningKeyResponse response = kms.generateSigningKeyPair(tenantId);

            long elapsed = System.currentTimeMillis() - startTime;

            Log.infof("Generated signing key %s for tenant %s (%dms)",
                response.keyId(), tenantId, elapsed);

            return new SigningKeyResult(
                response.keyId(),
                response.publicKey(),
                response.algorithm(),
                Instant.now()
            );

        } catch (KeyManagementService.KmsException e) {
            throw new KeyGenerationException(
                "Failed to generate signing key for tenant " + tenantId,
                e
            );
        }
    }

    /**
     * Generate AES-256 encryption key for tenant.
     *
     * Encryption keys are used for:
     * - PII encryption (PRD-004 ENCRYPT strategy)
     * - Sensitive data protection in spans
     * - Envelope encryption pattern (DEK encrypted by KEK)
     *
     * Key Properties:
     * - Algorithm: AES-256-GCM
     * - Key size: 256 bits (32 bytes)
     * - Block size: 128 bits
     * - Authentication tag: 128 bits
     *
     * Storage:
     * - Encrypted DEK: Stored in filesystem
     * - Plaintext DEK: Used immediately, then zeroed from memory
     * - Key metadata: Stored with creation timestamp and tenant ID
     *
     * @param tenantId Tenant UUID
     * @return Encryption key result with key ID
     * @throws KeyGenerationException if generation fails
     */
    public EncryptionKeyResult generateEncryptionKey(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }

        try {
            Log.infof("Generating AES-256 encryption key for tenant: %s", tenantId);

            long startTime = System.currentTimeMillis();

            // Generate data key via KMS (provider-agnostic)
            var encryptionContext = java.util.Map.of(
                "tenantId", tenantId.toString(),
                "keyType", "encryption"
            );

            var dataKey = kms.generateDataKey("AES_256", encryptionContext);

            // Key ID = hash of encrypted key (deterministic, unique per tenant)
            UUID keyId = UUID.nameUUIDFromBytes(dataKey.encryptedKey());

            // Zero out plaintext key (security best practice)
            dataKey.zeroPlaintextKey();

            long elapsed = System.currentTimeMillis() - startTime;

            Log.infof("Generated encryption key %s for tenant %s (%dms)",
                keyId, tenantId, elapsed);

            return new EncryptionKeyResult(
                keyId,
                "AES_256",
                Instant.now()
            );

        } catch (KeyManagementService.KmsException e) {
            throw new KeyGenerationException(
                "Failed to generate encryption key for tenant " + tenantId,
                e
            );
        }
    }

    /**
     * Signing key generation result.
     *
     * @param keyId Key identifier (for rotation tracking)
     * @param publicKey Ed25519 public key (for verification)
     * @param algorithm Always "Ed25519"
     * @param createdAt Key creation timestamp
     */
    public record SigningKeyResult(
        UUID keyId,
        PublicKey publicKey,
        String algorithm,
        Instant createdAt
    ) {}

    /**
     * Encryption key generation result.
     *
     * @param keyId Key identifier (for rotation tracking)
     * @param keySpec Key specification (e.g., "AES_256")
     * @param createdAt Key creation timestamp
     */
    public record EncryptionKeyResult(
        UUID keyId,
        String keySpec,
        Instant createdAt
    ) {}

    /**
     * Exception thrown when key generation fails.
     */
    public static class KeyGenerationException extends RuntimeException {
        public KeyGenerationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
