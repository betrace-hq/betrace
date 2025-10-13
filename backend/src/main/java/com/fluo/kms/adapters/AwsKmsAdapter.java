package com.fluo.kms.adapters;

import com.fluo.kms.KeyManagementService;
import io.quarkus.logging.Log;

import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kms.KmsClient;
import software.amazon.awssdk.services.kms.model.*;

import java.net.URI;
import java.util.Map;
import java.util.Optional;

/**
 * Adapter: AWS KMS implementation for production encryption.
 *
 * Features:
 * - FIPS 140-2 Level 2 validated (AWS KMS backed by CloudHSM)
 * - Automatic key rotation (configurable, recommend 90 days)
 * - CloudTrail audit logging for all operations
 * - IAM policy-based access control
 * - Multi-region key support
 * - Customer managed keys (CMK)
 *
 * Configuration:
 * - aws.kms.region: AWS region (e.g., us-east-1)
 * - aws.kms.master-key-id: CMK ARN or alias
 * - aws.kms.endpoint: Optional (LocalStack for dev)
 *
 * Authentication:
 * - Uses DefaultCredentialsProvider chain:
 *   1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 *   2. System properties
 *   3. Shared credentials file (~/.aws/credentials)
 *   4. EC2 instance profile credentials
 *   5. ECS task role credentials
 *
 * IAM Permissions Required:
 * - kms:Encrypt
 * - kms:Decrypt
 * - kms:GenerateDataKey
 * - kms:DescribeKey (for health checks)
 *
 * Compliance:
 * - SOC2 CC6.1 (Logical Access Controls)
 * - HIPAA 164.312(a)(2)(iv) (Encryption/Decryption)
 * - FIPS 140-2 Level 2 (Cryptographic Module Validation)
 */
public class AwsKmsAdapter implements KeyManagementService {

    private static final String PROVIDER_NAME = "aws";

    private final KmsClient kmsClient;
    private final String masterKeyId;

    public AwsKmsAdapter(
            @ConfigProperty(name = "aws.kms.master-key-id") String masterKeyId,
            @ConfigProperty(name = "aws.kms.region") String region,
            @ConfigProperty(name = "aws.kms.endpoint") Optional<String> endpoint) {

        this.masterKeyId = masterKeyId;

        var builder = KmsClient.builder()
            .region(Region.of(region))
            .credentialsProvider(DefaultCredentialsProvider.create());

        // LocalStack support for development
        if (endpoint.isPresent() && !endpoint.get().isBlank()) {
            Log.infof("Using KMS endpoint: %s (LocalStack mode)", endpoint.get());
            builder.endpointOverride(URI.create(endpoint.get()));
        }

        this.kmsClient = builder.build();
        Log.infof("AWS KMS adapter initialized - region: %s, master key: %s", region, masterKeyId);
    }

    @Override
    public byte[] encrypt(byte[] plaintext, Map<String, String> encryptionContext) {
        // Input validation (Security Expert P0-4 + QA Expert requirements)
        if (plaintext == null) {
            throw new IllegalArgumentException("plaintext cannot be null");
        }
        if (plaintext.length == 0) {
            throw new IllegalArgumentException("plaintext cannot be empty");
        }
        if (plaintext.length > 4096) { // AWS KMS limit
            throw new KmsException(PROVIDER_NAME, "encrypt",
                String.format("Plaintext exceeds AWS KMS limit of 4096 bytes (actual: %d)",
                    plaintext.length));
        }

        // Enforce encryption context for tenant isolation (Security Expert P0-4)
        if (encryptionContext == null || encryptionContext.isEmpty()) {
            throw new IllegalArgumentException(
                "Encryption context required for tenant isolation. " +
                "Must include 'tenantId' key.");
        }
        if (!encryptionContext.containsKey("tenantId")) {
            throw new IllegalArgumentException(
                "Encryption context must contain 'tenantId' for tenant isolation");
        }

        try {
            Log.debugf("Encrypting %d bytes with AWS KMS", plaintext.length);

            EncryptRequest request = EncryptRequest.builder()
                .keyId(masterKeyId)
                .plaintext(SdkBytes.fromByteArray(plaintext))
                .encryptionContext(encryptionContext)
                .build();

            EncryptResponse response = kmsClient.encrypt(request);
            byte[] ciphertext = response.ciphertextBlob().asByteArray();

            Log.debugf("Encrypted to %d bytes", ciphertext.length);
            return ciphertext;

        } catch (software.amazon.awssdk.services.kms.model.KmsException e) {
            Log.errorf(e, "AWS KMS encryption failed: %s", e.awsErrorDetails().errorMessage());
            throw new KmsException(PROVIDER_NAME, "encrypt", e.awsErrorDetails().errorMessage(), e);
        }
    }

    @Override
    public byte[] decrypt(byte[] ciphertext, Map<String, String> encryptionContext) {
        // Input validation (QA Expert requirements)
        if (ciphertext == null) {
            throw new IllegalArgumentException("ciphertext cannot be null");
        }
        if (ciphertext.length == 0) {
            throw new IllegalArgumentException("ciphertext cannot be empty");
        }

        // Enforce encryption context for tenant isolation (Security Expert P0-4)
        if (encryptionContext == null || encryptionContext.isEmpty()) {
            throw new IllegalArgumentException(
                "Encryption context required for decrypt. " +
                "Must match context used during encryption.");
        }

        try {
            Log.debugf("Decrypting %d bytes with AWS KMS", ciphertext.length);

            DecryptRequest request = DecryptRequest.builder()
                .ciphertextBlob(SdkBytes.fromByteArray(ciphertext))
                .encryptionContext(encryptionContext)
                .build();

            DecryptResponse response = kmsClient.decrypt(request);
            byte[] plaintext = response.plaintext().asByteArray();

            Log.debugf("Decrypted to %d bytes", plaintext.length);
            return plaintext;

        } catch (software.amazon.awssdk.services.kms.model.KmsException e) {
            Log.errorf(e, "AWS KMS decryption failed: %s", e.awsErrorDetails().errorMessage());
            throw new KmsException(PROVIDER_NAME, "decrypt", e.awsErrorDetails().errorMessage(), e);
        }
    }

    @Override
    public DataKeyResponse generateDataKey(String keySpec, Map<String, String> encryptionContext) {
        try {
            Log.debugf("Generating data key with AWS KMS - spec: %s", keySpec);

            GenerateDataKeyRequest request = GenerateDataKeyRequest.builder()
                .keyId(masterKeyId)
                .keySpec(DataKeySpec.fromValue(keySpec))
                .encryptionContext(encryptionContext)
                .build();

            GenerateDataKeyResponse response = kmsClient.generateDataKey(request);

            byte[] plaintextKey = response.plaintext().asByteArray();
            byte[] encryptedKey = response.ciphertextBlob().asByteArray();

            Log.debugf("Generated data key: plaintext=%d bytes, encrypted=%d bytes",
                plaintextKey.length, encryptedKey.length);

            return new DataKeyResponse(plaintextKey, encryptedKey, keySpec);

        } catch (software.amazon.awssdk.services.kms.model.KmsException e) {
            Log.errorf(e, "AWS KMS data key generation failed: %s", e.awsErrorDetails().errorMessage());
            throw new KmsException(PROVIDER_NAME, "generateDataKey", e.awsErrorDetails().errorMessage(), e);
        }
    }

    @Override
    public String getMasterKeyId() {
        return masterKeyId;
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public boolean healthCheck() {
        try {
            // Lightweight operation: describe key metadata
            DescribeKeyRequest request = DescribeKeyRequest.builder()
                .keyId(masterKeyId)
                .build();

            DescribeKeyResponse response = kmsClient.describeKey(request);
            boolean enabled = response.keyMetadata().enabled();

            if (!enabled) {
                Log.warnf("AWS KMS key is disabled: %s", masterKeyId);
            }

            return enabled;

        } catch (Exception e) {
            Log.warnf(e, "AWS KMS health check failed: %s", e.getMessage());
            return false;
        }
    }

    /**
     * Close KMS client (lifecycle cleanup).
     */
    public void close() {
        if (kmsClient != null) {
            kmsClient.close();
            Log.info("AWS KMS client closed");
        }
    }

    // ==========================================
    // Signing Key Methods (Not Implemented)
    // ==========================================
    // TODO: Implement using AWS KMS asymmetric keys (SIGN_VERIFY key spec)
    // See: https://docs.aws.amazon.com/kms/latest/developerguide/asymmetric-key-specs.html
    // Key spec: ECC_NIST_P256 or RSA_2048
    //
    // For interim implementation, use LocalKmsAdapter for signing keys.
    // AWS KMS asymmetric key support planned for PRD-006b.

    @Override
    public SigningKeyResponse generateSigningKeyPair(UUID tenantId) {
        throw new java.lang.UnsupportedOperationException(
            "AWS KMS asymmetric key support not yet implemented. " +
            "Use LocalKmsAdapter for signing keys (fluo.kms.provider=local), " +
            "or implement AWS KMS SIGN_VERIFY key spec (ECC_NIST_P256). " +
            "Planned for PRD-006b."
        );
    }

    @Override
    public PrivateKey getTenantSigningKey(UUID tenantId) {
        throw new java.lang.UnsupportedOperationException(
            "AWS KMS asymmetric key support not yet implemented. " +
            "Use LocalKmsAdapter for signing keys (fluo.kms.provider=local)."
        );
    }

    @Override
    public PublicKey getTenantPublicKey(UUID tenantId) {
        throw new java.lang.UnsupportedOperationException(
            "AWS KMS asymmetric key support not yet implemented. " +
            "Use LocalKmsAdapter for signing keys (fluo.kms.provider=local)."
        );
    }
}
