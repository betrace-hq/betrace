# PRD-006c: Key Retrieval Service

**Priority:** P0
**Complexity:** Simple
**Unit:** `KeyRetrievalService.java`
**Dependencies:** PRD-006a (AwsKmsClient), PRD-006b (KeyGenerationService)

## Problem

Retrieve tenant keys from TigerBeetle, decrypt private keys with KMS, and cache results for performance. Must enforce tenant isolation and prevent cross-tenant key access through encryption context validation.

## Architecture Integration

**ADR Compliance:**
- **ADR-011 (TigerBeetle-First):** Query key metadata from TigerBeetle accounts (code=8)
- **ADR-014 (Named Processors):** CDI ApplicationScoped service for injection

**Cache Strategy:**
- Caffeine cache with configurable TTL (default 60 minutes)
- Public keys cached longer (24 hours) since they rarely change
- Cache key format: `{tenant_id}:{key_type}:{key_purpose}` (signing/encrypt/public)

## Implementation

```java
package com.betrace.kms;

import com.betrace.kms.AwsKmsClient;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Retrieves tenant keys from TigerBeetle and decrypts with KMS.
 *
 * Cache-first retrieval pattern:
 * 1. Check cache
 * 2. If miss, query TigerBeetle for key metadata
 * 3. Load encrypted key from filesystem
 * 4. Decrypt with KMS (with tenant isolation via encryption context)
 * 5. Cache decrypted key
 *
 * Public keys cached longer since they don't require decryption.
 */
@ApplicationScoped
public class KeyRetrievalService {

    private static final Logger LOG = Logger.getLogger(KeyRetrievalService.class);

    private static final int KEY_TYPE_SIGNING = 1;
    private static final int KEY_TYPE_ENCRYPT = 2;
    private static final int STATUS_ACTIVE = 1;

    @Inject
    AwsKmsClient kmsClient;

    @Inject
    TigerBeetleClient tigerBeetleClient;

    private final Cache<String, byte[]> signingKeyCache;
    private final Cache<String, byte[]> encryptionKeyCache;
    private final Cache<String, byte[]> publicKeyCache;
    private final Path keyStorePath;

    public KeyRetrievalService(
            @ConfigProperty(name = "betrace.kms.cache-ttl-minutes", defaultValue = "60") int cacheTtlMinutes,
            @ConfigProperty(name = "betrace.kms.key-store-path", defaultValue = "/tmp/betrace/keys") String keyStoreDir) {

        // Initialize caches
        this.signingKeyCache = Caffeine.newBuilder()
            .expireAfterWrite(cacheTtlMinutes, TimeUnit.MINUTES)
            .maximumSize(1000)
            .recordStats()
            .build();

        this.encryptionKeyCache = Caffeine.newBuilder()
            .expireAfterWrite(cacheTtlMinutes, TimeUnit.MINUTES)
            .maximumSize(1000)
            .recordStats()
            .build();

        this.publicKeyCache = Caffeine.newBuilder()
            .expireAfterWrite(24, TimeUnit.HOURS)  // Public keys rarely change
            .maximumSize(10000)
            .recordStats()
            .build();

        this.keyStorePath = Paths.get(keyStoreDir);
        LOG.infof("Key retrieval service initialized with cache TTL: %d minutes", cacheTtlMinutes);
    }

    /**
     * Get tenant's signing private key (decrypted)
     *
     * @param tenantId Tenant UUID
     * @return Decrypted Ed25519 private key bytes
     * @throws KeyNotFoundException if no active signing key exists
     * @throws KeyDecryptionException if KMS decryption fails
     */
    public byte[] getSigningKey(UUID tenantId) {
        String cacheKey = tenantId.toString() + ":signing";

        // Check cache first
        byte[] cached = signingKeyCache.getIfPresent(cacheKey);
        if (cached != null) {
            LOG.debugf("Cache hit for signing key: tenant=%s", tenantId);
            return cached;
        }

        LOG.debugf("Cache miss for signing key: tenant=%s", tenantId);

        // Load from TigerBeetle + decrypt
        KeyMetadata metadata = loadKeyMetadataFromTigerBeetle(tenantId, KEY_TYPE_SIGNING);
        byte[] encryptedKey = loadEncryptedKeyFromFilesystem(tenantId, metadata.keyId);
        byte[] decryptedKey = decryptPrivateKey(encryptedKey, tenantId, "signing");

        // Cache it
        signingKeyCache.put(cacheKey, decryptedKey);

        LOG.infof("Loaded and cached signing key: tenant=%s, keyId=%s", tenantId, metadata.keyId);
        return decryptedKey;
    }

    /**
     * Get tenant's encryption key (decrypted)
     *
     * @param tenantId Tenant UUID
     * @return Decrypted AES-256 key bytes
     * @throws KeyNotFoundException if no active encryption key exists
     * @throws KeyDecryptionException if KMS decryption fails
     */
    public byte[] getEncryptionKey(UUID tenantId) {
        String cacheKey = tenantId.toString() + ":encrypt";

        // Check cache first
        byte[] cached = encryptionKeyCache.getIfPresent(cacheKey);
        if (cached != null) {
            LOG.debugf("Cache hit for encryption key: tenant=%s", tenantId);
            return cached;
        }

        LOG.debugf("Cache miss for encryption key: tenant=%s", tenantId);

        // Load from TigerBeetle + decrypt
        KeyMetadata metadata = loadKeyMetadataFromTigerBeetle(tenantId, KEY_TYPE_ENCRYPT);
        byte[] encryptedKey = loadEncryptedKeyFromFilesystem(tenantId, metadata.keyId);
        byte[] decryptedKey = decryptPrivateKey(encryptedKey, tenantId, "encryption");

        // Cache it
        encryptionKeyCache.put(cacheKey, decryptedKey);

        LOG.infof("Loaded and cached encryption key: tenant=%s, keyId=%s", tenantId, metadata.keyId);
        return decryptedKey;
    }

    /**
     * Get tenant's public key (no decryption needed)
     *
     * @param tenantId Tenant UUID
     * @return Ed25519 public key bytes
     * @throws KeyNotFoundException if no active signing key exists
     */
    public byte[] getPublicKey(UUID tenantId) {
        String cacheKey = tenantId.toString() + ":public";

        // Check cache first
        byte[] cached = publicKeyCache.getIfPresent(cacheKey);
        if (cached != null) {
            LOG.debugf("Cache hit for public key: tenant=%s", tenantId);
            return cached;
        }

        LOG.debugf("Cache miss for public key: tenant=%s", tenantId);

        // Load from TigerBeetle (no decryption needed)
        KeyMetadata metadata = loadKeyMetadataFromTigerBeetle(tenantId, KEY_TYPE_SIGNING);
        byte[] publicKey = metadata.publicKey;

        if (publicKey == null || publicKey.length == 0) {
            throw new KeyNotFoundException("Public key not found for tenant: " + tenantId);
        }

        // Cache it
        publicKeyCache.put(cacheKey, publicKey);

        LOG.infof("Loaded and cached public key: tenant=%s, keyId=%s", tenantId, metadata.keyId);
        return publicKey;
    }

    /**
     * Evict tenant keys from cache (e.g., after key rotation)
     */
    public void evictTenantKeys(UUID tenantId) {
        String signingCacheKey = tenantId.toString() + ":signing";
        String encryptCacheKey = tenantId.toString() + ":encrypt";
        String publicCacheKey = tenantId.toString() + ":public";

        signingKeyCache.invalidate(signingCacheKey);
        encryptionKeyCache.invalidate(encryptCacheKey);
        publicKeyCache.invalidate(publicCacheKey);

        LOG.infof("Evicted cached keys for tenant: %s", tenantId);
    }

    /**
     * Load key metadata from TigerBeetle
     */
    private KeyMetadata loadKeyMetadataFromTigerBeetle(UUID tenantId, int keyType) {
        // Query TigerBeetle for accounts with:
        // - code = 8 (KMS key type)
        // - userData128 contains tenantId and keyType
        // - status = 1 (active)

        var accounts = tigerBeetleClient.queryAccountsByTenantAndType(tenantId, keyType);

        if (accounts.isEmpty()) {
            throw new KeyNotFoundException(
                String.format("No active key found: tenant=%s, type=%d", tenantId, keyType)
            );
        }

        // Get first active key (should only be one)
        var account = accounts.get(0);

        // Unpack metadata
        long userData128 = account.userData128_low();
        int status = (int) ((userData128 >>> 56) & 0xFF);

        if (status != STATUS_ACTIVE) {
            throw new KeyNotFoundException(
                String.format("Key not active: tenant=%s, type=%d, status=%d", tenantId, keyType, status)
            );
        }

        UUID keyId = new UUID(account.id_high(), account.id_low());
        byte[] publicKey = account.reserved();  // Public key stored in reserved field

        return new KeyMetadata(keyId, tenantId, keyType, publicKey);
    }

    /**
     * Load encrypted private key from filesystem
     */
    private byte[] loadEncryptedKeyFromFilesystem(UUID tenantId, UUID keyId) {
        Path keyFile = keyStorePath.resolve(tenantId.toString()).resolve(keyId.toString() + ".enc");

        try {
            byte[] encryptedKey = Files.readAllBytes(keyFile);
            LOG.debugf("Loaded encrypted key from: %s", keyFile);
            return encryptedKey;
        } catch (IOException e) {
            throw new KeyNotFoundException("Encrypted key file not found: " + keyFile, e);
        }
    }

    /**
     * Decrypt private key with KMS (enforces tenant isolation via encryption context)
     */
    private byte[] decryptPrivateKey(byte[] encryptedKey, UUID tenantId, String keyType) {
        Map<String, String> encryptionContext = Map.of(
            "tenant_id", tenantId.toString(),
            "key_type", keyType
        );

        try {
            return kmsClient.decrypt(encryptedKey, encryptionContext);
        } catch (Exception e) {
            throw new KeyDecryptionException(
                "Failed to decrypt key for tenant: " + tenantId, e
            );
        }
    }

    /**
     * Get cache statistics for monitoring
     */
    public Map<String, Object> getCacheStats() {
        return Map.of(
            "signingKeyCache", Map.of(
                "hitRate", signingKeyCache.stats().hitRate(),
                "missRate", signingKeyCache.stats().missRate(),
                "size", signingKeyCache.estimatedSize()
            ),
            "encryptionKeyCache", Map.of(
                "hitRate", encryptionKeyCache.stats().hitRate(),
                "missRate", encryptionKeyCache.stats().missRate(),
                "size", encryptionKeyCache.estimatedSize()
            ),
            "publicKeyCache", Map.of(
                "hitRate", publicKeyCache.stats().hitRate(),
                "missRate", publicKeyCache.stats().missRate(),
                "size", publicKeyCache.estimatedSize()
            )
        );
    }

    /**
     * Key metadata from TigerBeetle
     */
    private record KeyMetadata(UUID keyId, UUID tenantId, int keyType, byte[] publicKey) {}

    /**
     * Exception thrown when key not found
     */
    public static class KeyNotFoundException extends RuntimeException {
        public KeyNotFoundException(String message) {
            super(message);
        }
        public KeyNotFoundException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /**
     * Exception thrown when key decryption fails
     */
    public static class KeyDecryptionException extends RuntimeException {
        public KeyDecryptionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests:**
- `testGetSigningKeyCacheHit()` - Request twice, second from cache
- `testGetSigningKeyCacheMiss()` - Query TigerBeetle + KMS decrypt
- `testGetEncryptionKey()` - AES-256 retrieval + decryption
- `testGetPublicKey()` - No decryption call
- `testKeyNotFound()` - KeyNotFoundException for missing keys
- `testKmsDecryptFailure()` - KeyDecryptionException on KMS failure
- `testTenantIsolation()` - Tenant A cannot access tenant B key
- `testEvictTenantKeys()` - Evict cache, next request queries TigerBeetle
- `testCacheExpiry()` - TTL expiry causes cache miss
- `testRotatedKeyNotRetrieved()` - status=rotated throws KeyNotFoundException

## Security Considerations

**Threats:**
1. **Cache Poisoning** - Cache only after KMS decryption, no external writes
2. **Tenant Key Leakage** - Encryption context enforces tenant_id match
3. **KMS Decrypt Without Context** - Always pass context, KMS validates
4. **Stale Keys in Cache** - Evict on rotation, TTL limits exposure
5. **Memory Dump Exposure** - Limit cache TTL (future: zero out after use)

## Success Criteria

- [ ] Cache-first retrieval (check cache before TigerBeetle)
- [ ] KMS decrypt with tenant isolation (encryption context)
- [ ] Public keys retrieved without decryption
- [ ] Cache eviction on demand (key rotation)
- [ ] Tenant isolation enforced (cross-tenant access fails)
- [ ] Cache statistics exposed for monitoring
- [ ] 90% test coverage
- [ ] KeyNotFoundException for missing keys
- [ ] KeyDecryptionException for KMS failures

## Files to Create

**Implementation:**
- `backend/src/main/java/com/betrace/kms/KeyRetrievalService.java`

**Tests:**
- `backend/src/test/java/com/betrace/kms/KeyRetrievalServiceTest.java`

**Config:**
- `application.properties`: `betrace.kms.cache-ttl-minutes=60`, `betrace.kms.key-store-path=/var/betrace/keys`
- `pom.xml`: Add `com.github.ben-manes.caffeine:caffeine:3.1.8`

## Dependencies

**Requires:**
- PRD-006a (AwsKmsClient) - KMS decryption operations
- PRD-006b (KeyGenerationService) - Key metadata schema
- PRD-002 (TigerBeetle) - Key metadata queries

**Enables:**
- PRD-003 (Compliance Signing) - Retrieve signing keys
- PRD-004 (PII Encryption) - Retrieve encryption keys
