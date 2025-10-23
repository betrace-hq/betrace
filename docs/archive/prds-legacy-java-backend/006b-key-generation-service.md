# PRD-006b: Key Generation Service

**Priority:** P0
**Complexity:** Medium
**Unit:** `KeyGenerationService.java`
**Dependencies:** PRD-006a (AwsKmsClient), PRD-002 (TigerBeetle)

## Problem

Generate per-tenant Ed25519 signing keys and AES-256 encryption keys, storing metadata in TigerBeetle and encrypted private keys in external storage. Each tenant requires cryptographic isolation with private keys encrypted by KMS master key.

## Architecture Integration

**ADR Compliance:**
- **ADR-011 (TigerBeetle-First):** Key metadata stored as TigerBeetle accounts (code=8), NO SQL
- **ADR-014 (Named Processors):** CDI ApplicationScoped service for injection

**TigerBeetle Schema:**

Account (code=8, Key Metadata):
- id: UUID (key ID)
- userData128: Packed (key_type[8bits], tenant_id[96bits], created_at[32bits], status[8bits])
- userData64: KMS ARN hash
- reserved: Public key (32 bytes for Ed25519)

Transfer (code=8, Key Operation):
- debitAccountId: Tenant, creditAccountId: Key
- amount: 1, userData128: op_type (1=generate, 2=sign, 3=encrypt, 4=decrypt, 5=rotate)

## Implementation

```java
package com.betrace.kms;

import com.betrace.kms.AwsKmsClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Generates per-tenant cryptographic keys and stores metadata in TigerBeetle.
 *
 * Key Types:
 * - SIGNING (Ed25519): For compliance span signatures
 * - ENCRYPT (AES-256): For PII encryption
 *
 * Private keys encrypted with KMS master key before storage.
 * Public keys stored unencrypted in TigerBeetle for fast access.
 */
@ApplicationScoped
public class KeyGenerationService {

    private static final Logger LOG = Logger.getLogger(KeyGenerationService.class);

    private static final int KEY_TYPE_SIGNING = 1;
    private static final int KEY_TYPE_ENCRYPT = 2;
    private static final int STATUS_ACTIVE = 1;
    private static final int OP_TYPE_GENERATE = 1;

    @Inject
    AwsKmsClient kmsClient;

    @Inject
    TigerBeetleClient tigerBeetleClient;  // From PRD-002

    private final Path keyStorePath;

    public KeyGenerationService() {
        // Key storage path (configurable via env var)
        String keyStoreDir = System.getenv().getOrDefault("BETRACE_KEY_STORE_PATH", "/tmp/betrace/keys");
        this.keyStorePath = Paths.get(keyStoreDir);

        try {
            Files.createDirectories(keyStorePath);
            LOG.infof("Key storage initialized at: %s", keyStorePath);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create key storage directory", e);
        }
    }

    /**
     * Generate Ed25519 signing key pair for tenant
     *
     * @param tenantId Tenant UUID
     * @return Key ID (UUID)
     * @throws KeyGenerationException if generation fails
     */
    public UUID generateSigningKey(UUID tenantId) {
        LOG.infof("Generating signing key for tenant: %s", tenantId);

        try {
            // Generate Ed25519 key pair
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("Ed25519");
            KeyPair keyPair = keyGen.generateKeyPair();

            byte[] publicKey = keyPair.getPublic().getEncoded();
            byte[] privateKey = keyPair.getPrivate().getEncoded();

            // Encrypt private key with KMS
            Map<String, String> encryptionContext = Map.of(
                "tenant_id", tenantId.toString(),
                "key_type", "signing"
            );
            byte[] encryptedPrivateKey = kmsClient.encrypt(privateKey, encryptionContext);

            // Generate key ID
            UUID keyId = UUID.randomUUID();

            // Store encrypted private key to filesystem
            storeEncryptedKey(tenantId, keyId, encryptedPrivateKey);

            // Store metadata in TigerBeetle
            storeKeyMetadata(keyId, tenantId, KEY_TYPE_SIGNING, publicKey);

            // Record generation event
            recordKeyOperation(tenantId, keyId, OP_TYPE_GENERATE);

            LOG.infof("Signing key generated: %s for tenant: %s", keyId, tenantId);
            return keyId;

        } catch (Exception e) {
            LOG.errorf(e, "Failed to generate signing key for tenant: %s", tenantId);
            throw new KeyGenerationException("Signing key generation failed", e);
        }
    }

    /**
     * Generate AES-256 encryption key for tenant via KMS data key
     *
     * @param tenantId Tenant UUID
     * @return Key ID (UUID)
     * @throws KeyGenerationException if generation fails
     */
    public UUID generateEncryptionKey(UUID tenantId) {
        LOG.infof("Generating encryption key for tenant: %s", tenantId);

        try {
            // Use KMS to generate AES-256 data key
            var response = kmsClient.generateDataKey("AES_256");

            byte[] plaintextKey = response.plaintext().asByteArray();
            byte[] encryptedKey = response.ciphertextBlob().asByteArray();

            // Generate key ID
            UUID keyId = UUID.randomUUID();

            // Store encrypted data key to filesystem
            storeEncryptedKey(tenantId, keyId, encryptedKey);

            // Store metadata in TigerBeetle (no public key for symmetric encryption)
            storeKeyMetadata(keyId, tenantId, KEY_TYPE_ENCRYPT, null);

            // Record generation event
            recordKeyOperation(tenantId, keyId, OP_TYPE_GENERATE);

            // Zero out plaintext key from memory
            java.util.Arrays.fill(plaintextKey, (byte) 0);

            LOG.infof("Encryption key generated: %s for tenant: %s", keyId, tenantId);
            return keyId;

        } catch (Exception e) {
            LOG.errorf(e, "Failed to generate encryption key for tenant: %s", tenantId);
            throw new KeyGenerationException("Encryption key generation failed", e);
        }
    }

    /**
     * Store encrypted private key to filesystem
     */
    private void storeEncryptedKey(UUID tenantId, UUID keyId, byte[] encryptedKey) throws IOException {
        Path tenantDir = keyStorePath.resolve(tenantId.toString());
        Files.createDirectories(tenantDir);

        Path keyFile = tenantDir.resolve(keyId.toString() + ".enc");
        Files.write(keyFile, encryptedKey);

        LOG.debugf("Stored encrypted key: %s", keyFile);
    }

    /**
     * Store key metadata in TigerBeetle
     */
    private void storeKeyMetadata(UUID keyId, UUID tenantId, int keyType, byte[] publicKey) {
        // Pack metadata into userData128
        long userData128_low = packMetadata(keyType, tenantId, Instant.now(), STATUS_ACTIVE);
        long userData128_high = 0; // Reserved for future use

        // Hash KMS ARN for userData64
        long kmsArnHash = kmsClient.getMasterKeyId().hashCode();

        // Create TigerBeetle account
        var account = new TigerBeetleAccount(
            uuidToLong(keyId, true),   // id (upper 64 bits)
            uuidToLong(keyId, false),  // id (lower 64 bits)
            8,                          // code (KMS key type)
            0,                          // debits_pending
            0,                          // credits_pending
            userData128_low,
            userData128_high,
            kmsArnHash,
            0,                          // timestamp (TigerBeetle sets)
            publicKey != null ? publicKey : new byte[32]  // reserved field
        );

        tigerBeetleClient.createAccount(account);
        LOG.debugf("Stored key metadata in TigerBeetle: keyId=%s, type=%d", keyId, keyType);
    }

    /**
     * Record key operation as TigerBeetle transfer
     */
    private void recordKeyOperation(UUID tenantId, UUID keyId, int opType) {
        // Pack operation metadata
        long userData128_low = opType; // First 8 bits
        long userData64 = Instant.now().toEpochMilli();

        var transfer = new TigerBeetleTransfer(
            UUID.randomUUID(),          // transfer ID
            uuidToLong(tenantId, true), // debitAccountId (tenant)
            uuidToLong(tenantId, false),
            uuidToLong(keyId, true),    // creditAccountId (key)
            uuidToLong(keyId, false),
            1,                           // amount (operation count)
            8,                           // code (KMS operation)
            userData128_low,
            0,                           // userData128_high
            userData64,
            0                            // timestamp (TigerBeetle sets)
        );

        tigerBeetleClient.createTransfer(transfer);
        LOG.debugf("Recorded key operation: tenantId=%s, keyId=%s, opType=%d", tenantId, keyId, opType);
    }

    /**
     * Pack key metadata into 128-bit userData field
     */
    private long packMetadata(int keyType, UUID tenantId, Instant createdAt, int status) {
        long packed = 0;

        // Bits 0-7: key_type
        packed |= (long) keyType & 0xFF;

        // Bits 8-103: tenant_id (first 96 bits of UUID)
        long tenantIdBits = tenantId.getMostSignificantBits() >>> 32;
        packed |= (tenantIdBits & 0xFFFFFFFFFFFFL) << 8;

        // Bits 104-135: created_at (epoch seconds)
        long epochSeconds = createdAt.getEpochSecond();
        packed |= (epochSeconds & 0xFFFFFFFFL) << 40;

        // Bits 136-143: status
        packed |= (long) status << 56;

        return packed;
    }

    /**
     * Convert UUID to long (upper or lower 64 bits)
     */
    private long uuidToLong(UUID uuid, boolean upper) {
        return upper ? uuid.getMostSignificantBits() : uuid.getLeastSignificantBits();
    }

    /**
     * Exception thrown when key generation fails
     */
    public static class KeyGenerationException extends RuntimeException {
        public KeyGenerationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests:**
- `testGenerateSigningKey()` - Ed25519 generation + TigerBeetle account created
- `testGenerateEncryptionKey()` - AES-256 via KMS + metadata stored
- `testPrivateKeyEncrypted()` - Private key encrypted before storage
- `testPublicKeyStored()` - Ed25519 public key in TigerBeetle reserved field
- `testKeyIdUnique()` - Multiple keys have unique IDs
- `testKmsEncryptionContextIncludesTenantId()` - Context has tenant_id
- `testFileSystemKeyStorage()` - Encrypted key written to correct path
- `testMetadataPackingUnpacking()` - Pack/unpack userData128 integrity

## Security Considerations

**Threats:**
1. **Weak Key Generation** - Mitigated by Java SecureRandom + Ed25519 standard
2. **Unencrypted Private Key Storage** - KMS encryption before filesystem write
3. **Key ID Collision** - UUID v4 cryptographic randomness
4. **Encryption Context Omission** - Enforce tenant_id + key_type in context
5. **Plaintext Key in Memory** - Zero out byte arrays after use

## Success Criteria

- [ ] Ed25519 signing keys generated per tenant
- [ ] AES-256 encryption keys generated via KMS data key API
- [ ] Key metadata stored in TigerBeetle (NO SQL)
- [ ] Private keys encrypted with KMS master key
- [ ] Public keys stored in TigerBeetle for fast retrieval
- [ ] Key generation events recorded as TigerBeetle transfers
- [ ] Encrypted keys stored in filesystem with tenant isolation
- [ ] 90% test coverage
- [ ] Encryption context enforced (tenant_id + key_type)

## Files to Create

**Implementation:**
- `backend/src/main/java/com/betrace/kms/KeyGenerationService.java`

**Tests:**
- `backend/src/test/java/com/betrace/kms/KeyGenerationServiceTest.java`

**Config:**
- `application.properties`: `betrace.kms.key-store-path=${BETRACE_KEY_STORE_PATH:/var/betrace/keys}`

## Dependencies

**Requires:**
- PRD-006a (AwsKmsClient) - KMS encryption operations
- PRD-002 (TigerBeetle) - Key metadata storage

**Blocks:**
- PRD-006c (Key Retrieval Service) - Needs keys to retrieve
- PRD-003 (Compliance Signing) - Needs signing keys
- PRD-004 (PII Encryption) - Needs encryption keys
