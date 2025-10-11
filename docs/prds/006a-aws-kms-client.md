# PRD-006a: AWS KMS Client

**Priority:** P0
**Complexity:** Simple
**Unit:** `AwsKmsClient.java`
**Dependencies:** None (external: AWS SDK v2)

## Problem

Need a wrapper service for AWS KMS SDK operations to encrypt/decrypt tenant keys and generate data keys. This provides the foundational cryptographic operations for per-tenant key management without exposing KMS API complexity throughout the codebase.

## Architecture Integration

**ADR Compliance:**
- **ADR-011 (Pure Application):** No deployment logic, exports service for application use
- **ADR-014 (Named CDI Processors):** ApplicationScoped CDI bean for injection

**Dependencies:**
- AWS SDK for Java v2 (KMS client)
- LocalStack support for local development

## Implementation

```java
package com.fluo.kms;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kms.KmsClient;
import software.amazon.awssdk.services.kms.model.*;

import java.net.URI;
import java.util.Map;
import java.util.Optional;

/**
 * AWS KMS client wrapper for encryption operations.
 *
 * Provides simplified interface for:
 * - Encrypting/decrypting data with master key
 * - Generating data keys for tenant encryption
 * - LocalStack support for development
 */
@ApplicationScoped
public class AwsKmsClient {

    private static final Logger LOG = Logger.getLogger(AwsKmsClient.class);

    private final KmsClient kmsClient;
    private final String masterKeyId;

    public AwsKmsClient(
            @ConfigProperty(name = "aws.kms.master-key-id") String masterKeyId,
            @ConfigProperty(name = "aws.kms.region") String region,
            @ConfigProperty(name = "aws.kms.endpoint") Optional<String> endpoint) {

        this.masterKeyId = masterKeyId;

        var builder = KmsClient.builder()
            .region(Region.of(region))
            .credentialsProvider(DefaultCredentialsProvider.create());

        // LocalStack support for dev
        if (endpoint.isPresent() && !endpoint.get().isBlank()) {
            LOG.infof("Using KMS endpoint: %s (LocalStack mode)", endpoint.get());
            builder.endpointOverride(URI.create(endpoint.get()));
        }

        this.kmsClient = builder.build();
        LOG.infof("AWS KMS client initialized with region: %s, master key: %s", region, masterKeyId);
    }

    /**
     * Encrypt plaintext with master key and encryption context
     *
     * @param plaintext Data to encrypt
     * @param encryptionContext Additional authenticated data (tenant ID, key type)
     * @return Encrypted ciphertext
     * @throws KmsException if encryption fails
     */
    public byte[] encrypt(byte[] plaintext, Map<String, String> encryptionContext) {
        try {
            LOG.debugf("Encrypting %d bytes with context: %s", plaintext.length, encryptionContext);

            EncryptRequest request = EncryptRequest.builder()
                .keyId(masterKeyId)
                .plaintext(SdkBytes.fromByteArray(plaintext))
                .encryptionContext(encryptionContext)
                .build();

            EncryptResponse response = kmsClient.encrypt(request);
            byte[] ciphertext = response.ciphertextBlob().asByteArray();

            LOG.debugf("Encrypted to %d bytes", ciphertext.length);
            return ciphertext;

        } catch (KmsException e) {
            LOG.errorf(e, "KMS encryption failed: %s", e.awsErrorDetails().errorMessage());
            throw e;
        }
    }

    /**
     * Decrypt ciphertext with encryption context validation
     *
     * @param ciphertext Encrypted data
     * @param encryptionContext Must match encryption context from encrypt()
     * @return Decrypted plaintext
     * @throws KmsException if decryption fails or context mismatch
     */
    public byte[] decrypt(byte[] ciphertext, Map<String, String> encryptionContext) {
        try {
            LOG.debugf("Decrypting %d bytes with context: %s", ciphertext.length, encryptionContext);

            DecryptRequest request = DecryptRequest.builder()
                .ciphertextBlob(SdkBytes.fromByteArray(ciphertext))
                .encryptionContext(encryptionContext)
                .build();

            DecryptResponse response = kmsClient.decrypt(request);
            byte[] plaintext = response.plaintext().asByteArray();

            LOG.debugf("Decrypted to %d bytes", plaintext.length);
            return plaintext;

        } catch (KmsException e) {
            LOG.errorf(e, "KMS decryption failed: %s", e.awsErrorDetails().errorMessage());
            throw e;
        }
    }

    /**
     * Generate AES-256 data key for tenant encryption
     *
     * Returns both plaintext and encrypted data key.
     * Plaintext should be used immediately then discarded.
     * Encrypted version should be stored for future decryption.
     *
     * @param keySpec AES_256 or AES_128
     * @return Response containing plaintext and ciphertext key
     * @throws KmsException if generation fails
     */
    public GenerateDataKeyResponse generateDataKey(String keySpec) {
        try {
            LOG.debugf("Generating data key with spec: %s", keySpec);

            GenerateDataKeyRequest request = GenerateDataKeyRequest.builder()
                .keyId(masterKeyId)
                .keySpec(DataKeySpec.fromValue(keySpec))
                .build();

            GenerateDataKeyResponse response = kmsClient.generateDataKey(request);

            LOG.debugf("Generated data key: plaintext=%d bytes, ciphertext=%d bytes",
                response.plaintext().asByteArray().length,
                response.ciphertextBlob().asByteArray().length);

            return response;

        } catch (KmsException e) {
            LOG.errorf(e, "KMS data key generation failed: %s", e.awsErrorDetails().errorMessage());
            throw e;
        }
    }

    /**
     * Get KMS master key ID
     */
    public String getMasterKeyId() {
        return masterKeyId;
    }

    /**
     * Close KMS client (lifecycle cleanup)
     */
    public void close() {
        if (kmsClient != null) {
            kmsClient.close();
            LOG.info("KMS client closed");
        }
    }
}
```

## Configuration

**`application.properties`:**
```properties
# AWS KMS Configuration
aws.kms.region=${AWS_REGION:us-east-1}
aws.kms.master-key-id=${AWS_KMS_MASTER_KEY_ID}
aws.kms.endpoint=${AWS_KMS_ENDPOINT:}  # LocalStack: http://localhost:4566

# For LocalStack development
%dev.aws.kms.endpoint=http://localhost:4566
%dev.aws.kms.master-key-id=alias/fluo-dev-master-key
```

**`pom.xml` dependencies:**
```xml
<dependency>
  <groupId>software.amazon.awssdk</groupId>
  <artifactId>kms</artifactId>
  <version>2.20.0</version>
</dependency>
<dependency>
  <groupId>software.amazon.awssdk</groupId>
  <artifactId>auth</artifactId>
  <version>2.20.0</version>
</dependency>
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests:**
- `testEncryptDecryptRoundTrip()` - Encrypt plaintext, decrypt, verify match
- `testEncryptionContextEnforced()` - Decrypt with wrong context fails
- `testGenerateDataKey()` - Generate AES-256 key, verify plaintext and ciphertext returned
- `testLocalStackIntegration()` - Test with LocalStack endpoint configured
- `testKmsTimeout()` - Handle KMS API timeouts gracefully
- `testInvalidMasterKey()` - Reject invalid master key ID
- `testEmptyPlaintext()` - Handle zero-length plaintext
- `testLargePlaintext()` - Encrypt/decrypt 4KB data (KMS limit validation)

**Edge Cases:**
- Encryption context with special characters
- Null or empty encryption context
- Master key ID not found
- Network failure during KMS call
- AWS credentials missing or expired

## Security Considerations (Security Expert)

**Threat Model:**

1. **KMS Credential Compromise**
   - Threat: Attacker gains AWS credentials with KMS permissions
   - Mitigation: Use IAM roles (not access keys), CloudTrail audit logging, least-privilege policies

2. **Encryption Context Tampering**
   - Threat: Attacker modifies encryption context to decrypt tenant data
   - Mitigation: Encryption context validated on decrypt (tenant ID isolation)

3. **Master Key Access**
   - Threat: Unauthorized access to KMS master key
   - Mitigation: KMS key policy restricts to FLUO IAM role only, key rotation every 90 days

4. **Plaintext Key Exposure**
   - Threat: Decrypted keys logged or leaked to memory dumps
   - Mitigation: Never log decrypted keys, use immediately then discard, secure memory handling

**Compliance:**
- FIPS 140-2 Level 2 validated (AWS KMS)
- SOC2 CC6.1 (Logical access controls)
- HIPAA 164.312(a)(2)(iv) (Encryption/decryption)

## Success Criteria

- [ ] Encrypt/decrypt operations work with AWS KMS
- [ ] Encryption context enforced (tenant isolation)
- [ ] LocalStack integration for development
- [ ] Generate AES-256 data keys
- [ ] Handle KMS errors gracefully (timeouts, invalid keys)
- [ ] 90% test coverage
- [ ] No decrypted keys logged

## Files to Create

**Implementation:**
- `backend/src/main/java/com/fluo/kms/AwsKmsClient.java`

**Tests:**
- `backend/src/test/java/com/fluo/kms/AwsKmsClientTest.java`

**Config:**
- Update `backend/src/main/resources/application.properties`
- Update `backend/pom.xml`

## Dependencies

**Requires:** None (foundation service)

**Blocks:**
- PRD-006b (Key Generation Service)
- PRD-006c (Key Retrieval Service)
