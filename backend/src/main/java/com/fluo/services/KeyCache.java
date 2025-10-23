package com.fluo.services;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.quarkus.logging.Log;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.security.PrivateKey;
import java.security.PublicKey;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

/**
 * Caffeine-based cache for cryptographic keys (PRD-006d).
 *
 * Cache Strategy (Security-Performance Balance):
 * - Private Keys: 60 minute TTL (minimize exposure window)
 * - Public Keys:  24 hour TTL (low risk, high reuse)
 * - Encryption Keys: 60 minute TTL (same as private keys)
 * - Max Entries: 1000 keys per cache (prevents memory exhaustion)
 *
 * Security Properties:
 * - Time-based expiration (automatic eviction)
 * - Size-bounded (DoS prevention)
 * - In-memory only (no disk persistence)
 * - No stats collection (privacy)
 *
 * Compliance:
 * - SOC2 CC6.1: Logical access controls (cache expiration)
 * - NIST 800-53 SC-12: Cryptographic key management
 *
 * @see KeyRetrievalService
 */
@ApplicationScoped
public class KeyCache {

    @ConfigProperty(name = "fluo.kms.cache.private-key-ttl", defaultValue = "60m")
    String privateKeyTtl;

    @ConfigProperty(name = "fluo.kms.cache.public-key-ttl", defaultValue = "24h")
    String publicKeyTtl;

    @ConfigProperty(name = "fluo.kms.cache.max-entries", defaultValue = "1000")
    int maxEntries;

    private Cache<CacheKey, PrivateKey> privateKeyCache;
    private Cache<CacheKey, PublicKey> publicKeyCache;
    private Cache<CacheKey, byte[]> encryptionKeyCache;

    @PostConstruct
    void initialize() {
        Duration privateTtl = parseDuration(privateKeyTtl);
        Duration publicTtl = parseDuration(publicKeyTtl);

        // Private signing key cache (short TTL for security)
        privateKeyCache = Caffeine.newBuilder()
            .expireAfterWrite(privateTtl)
            .maximumSize(maxEntries)
            .build();

        // Public signing key cache (longer TTL, used for verification)
        publicKeyCache = Caffeine.newBuilder()
            .expireAfterWrite(publicTtl)
            .maximumSize(maxEntries)
            .build();

        // Encryption key cache (short TTL, same as private keys)
        encryptionKeyCache = Caffeine.newBuilder()
            .expireAfterWrite(privateTtl)
            .maximumSize(maxEntries)
            .build();

        Log.infof("KeyCache initialized - private TTL: %s, public TTL: %s, max entries: %d",
            privateTtl, publicTtl, maxEntries);
    }

    /**
     * Get cached private signing key for tenant.
     *
     * @param tenantId Tenant UUID
     * @return Private key if cached, empty otherwise
     */
    public Optional<PrivateKey> getPrivateKey(UUID tenantId) {
        CacheKey key = new CacheKey(tenantId, KeyType.PRIVATE);
        PrivateKey cachedKey = privateKeyCache.getIfPresent(key);

        if (cachedKey != null) {
            Log.debugf("Cache HIT: private key for tenant %s", tenantId);
            return Optional.of(cachedKey);
        }

        Log.debugf("Cache MISS: private key for tenant %s", tenantId);
        return Optional.empty();
    }

    /**
     * Cache private signing key for tenant.
     *
     * @param tenantId Tenant UUID
     * @param privateKey Private key to cache
     */
    public void putPrivateKey(UUID tenantId, PrivateKey privateKey) {
        CacheKey key = new CacheKey(tenantId, KeyType.PRIVATE);
        privateKeyCache.put(key, privateKey);
        Log.debugf("Cached private key for tenant %s (TTL: %s)", tenantId, privateKeyTtl);
    }

    /**
     * Get cached public signing key for tenant.
     *
     * @param tenantId Tenant UUID
     * @return Public key if cached, empty otherwise
     */
    public Optional<PublicKey> getPublicKey(UUID tenantId) {
        CacheKey key = new CacheKey(tenantId, KeyType.PUBLIC);
        PublicKey cachedKey = publicKeyCache.getIfPresent(key);

        if (cachedKey != null) {
            Log.debugf("Cache HIT: public key for tenant %s", tenantId);
            return Optional.of(cachedKey);
        }

        Log.debugf("Cache MISS: public key for tenant %s", tenantId);
        return Optional.empty();
    }

    /**
     * Cache public signing key for tenant.
     *
     * @param tenantId Tenant UUID
     * @param publicKey Public key to cache
     */
    public void putPublicKey(UUID tenantId, PublicKey publicKey) {
        CacheKey key = new CacheKey(tenantId, KeyType.PUBLIC);
        publicKeyCache.put(key, publicKey);
        Log.debugf("Cached public key for tenant %s (TTL: %s)", tenantId, publicKeyTtl);
    }

    /**
     * Get cached encryption key for tenant.
     *
     * @param tenantId Tenant UUID
     * @return Encryption key if cached, empty otherwise
     */
    public Optional<byte[]> getEncryptionKey(UUID tenantId) {
        CacheKey key = new CacheKey(tenantId, KeyType.ENCRYPTION);
        byte[] cachedKey = encryptionKeyCache.getIfPresent(key);

        if (cachedKey != null) {
            Log.debugf("Cache HIT: encryption key for tenant %s", tenantId);
            return Optional.of(cachedKey);
        }

        Log.debugf("Cache MISS: encryption key for tenant %s", tenantId);
        return Optional.empty();
    }

    /**
     * Cache encryption key for tenant.
     *
     * @param tenantId Tenant UUID
     * @param encryptionKey Encryption key bytes to cache
     */
    public void putEncryptionKey(UUID tenantId, byte[] encryptionKey) {
        CacheKey key = new CacheKey(tenantId, KeyType.ENCRYPTION);
        encryptionKeyCache.put(key, encryptionKey);
        Log.debugf("Cached encryption key for tenant %s (TTL: %s)", tenantId, privateKeyTtl);
    }

    /**
     * Invalidate all cached keys for tenant (used on key rotation).
     *
     * @param tenantId Tenant UUID
     */
    public void invalidateTenant(UUID tenantId) {
        privateKeyCache.invalidate(new CacheKey(tenantId, KeyType.PRIVATE));
        publicKeyCache.invalidate(new CacheKey(tenantId, KeyType.PUBLIC));
        encryptionKeyCache.invalidate(new CacheKey(tenantId, KeyType.ENCRYPTION));

        Log.infof("Invalidated all keys for tenant %s (rotation or revocation)", tenantId);
    }

    /**
     * Clear all caches (testing/admin operation).
     */
    public void clearAll() {
        privateKeyCache.invalidateAll();
        publicKeyCache.invalidateAll();
        encryptionKeyCache.invalidateAll();
        Log.warn("Cleared all key caches");
    }

    /**
     * Get cache statistics (hit rate, size, etc.).
     *
     * @return Cache stats summary
     */
    public CacheStats getStats() {
        return new CacheStats(
            privateKeyCache.estimatedSize(),
            publicKeyCache.estimatedSize(),
            encryptionKeyCache.estimatedSize()
        );
    }

    /**
     * Parse duration string (e.g., "60m", "24h", "2d").
     */
    private Duration parseDuration(String durationStr) {
        String value = durationStr.substring(0, durationStr.length() - 1);
        char unit = durationStr.charAt(durationStr.length() - 1);

        long amount = Long.parseLong(value);
        return switch (unit) {
            case 's' -> Duration.ofSeconds(amount);
            case 'm' -> Duration.ofMinutes(amount);
            case 'h' -> Duration.ofHours(amount);
            case 'd' -> Duration.ofDays(amount);
            default -> throw new IllegalArgumentException(
                "Invalid duration format: " + durationStr + " (use s/m/h/d suffix)"
            );
        };
    }

    /**
     * Cache key combining tenant ID and key type.
     */
    private record CacheKey(UUID tenantId, KeyType keyType) {}

    /**
     * Key type for cache differentiation.
     */
    private enum KeyType {
        PRIVATE,
        PUBLIC,
        ENCRYPTION
    }

    /**
     * Cache statistics record.
     */
    public record CacheStats(
        long privateKeyCount,
        long publicKeyCount,
        long encryptionKeyCount
    ) {
        public long totalKeys() {
            return privateKeyCount + publicKeyCount + encryptionKeyCount;
        }
    }
}
