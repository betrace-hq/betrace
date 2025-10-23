# PRD-006d: Key Cache

**Priority:** P0 (Security Infrastructure)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-006 (KMS Integration System)
**Dependencies:** PRD-006c (KeyRetrievalService)

## Problem

Fetching keys from AWS KMS on every cryptographic operation incurs high latency (50-200ms per call) and API costs ($0.03 per 10,000 requests). Without caching, signing compliance spans and encrypting PII fields would create significant performance degradation and operational expenses.

## Solution

Implement in-memory key caching using Caffeine with differentiated TTL policies. Private keys cache for 60 minutes (balance security and performance), public keys cache for 24 hours (lower risk, higher reuse). Cache invalidation on rotation events ensures stale keys are never used.

## Unit Description

**File:** `backend/src/main/java/com/betrace/services/KeyCache.java`
**Type:** CDI ApplicationScoped Service
**Purpose:** High-performance in-memory key caching with automatic expiration and rotation invalidation

## Implementation

```java
package com.betrace.services;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.stats.CacheStats;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class KeyCache {
    private static final Logger log = LoggerFactory.getLogger(KeyCache.class);

    @ConfigProperty(name = "betrace.kms.cache.private-key-ttl", defaultValue = "60m")
    Duration privateKeyTtl;

    @ConfigProperty(name = "betrace.kms.cache.public-key-ttl", defaultValue = "24h")
    Duration publicKeyTtl;

    @ConfigProperty(name = "betrace.kms.cache.max-entries", defaultValue = "1000")
    long maxEntries;

    @ConfigProperty(name = "betrace.kms.cache.stats-enabled", defaultValue = "true")
    boolean statsEnabled;

    private Cache<String, byte[]> privateKeyCache;
    private Cache<String, byte[]> publicKeyCache;

    @Inject
    public void initialize() {
        privateKeyCache = Caffeine.newBuilder()
                .expireAfterWrite(privateKeyTtl)
                .maximumSize(maxEntries / 2)
                .recordStats()
                .build();

        publicKeyCache = Caffeine.newBuilder()
                .expireAfterWrite(publicKeyTtl)
                .maximumSize(maxEntries / 2)
                .recordStats()
                .build();

        log.info("KeyCache initialized: privateKeyTtl={}, publicKeyTtl={}, maxEntries={}",
                privateKeyTtl, publicKeyTtl, maxEntries);
    }

    /**
     * Get private key from cache
     * @param tenantId Tenant UUID
     * @param keyType KEY_TYPE (SIGNING or ENCRYPTION)
     * @return Private key bytes if cached, empty if not
     */
    public Optional<byte[]> getPrivateKey(UUID tenantId, String keyType) {
        String cacheKey = buildCacheKey(tenantId, keyType, "private");
        byte[] key = privateKeyCache.getIfPresent(cacheKey);

        if (key != null) {
            log.debug("Private key cache HIT: tenantId={}, keyType={}", tenantId, keyType);
        } else {
            log.debug("Private key cache MISS: tenantId={}, keyType={}", tenantId, keyType);
        }

        return Optional.ofNullable(key);
    }

    /**
     * Get public key from cache
     * @param tenantId Tenant UUID
     * @param keyType KEY_TYPE (SIGNING or ENCRYPTION)
     * @return Public key bytes if cached, empty if not
     */
    public Optional<byte[]> getPublicKey(UUID tenantId, String keyType) {
        String cacheKey = buildCacheKey(tenantId, keyType, "public");
        byte[] key = publicKeyCache.getIfPresent(cacheKey);

        if (key != null) {
            log.debug("Public key cache HIT: tenantId={}, keyType={}", tenantId, keyType);
        } else {
            log.debug("Public key cache MISS: tenantId={}, keyType={}", tenantId, keyType);
        }

        return Optional.ofNullable(key);
    }

    /**
     * Put private key in cache
     * @param tenantId Tenant UUID
     * @param keyType KEY_TYPE (SIGNING or ENCRYPTION)
     * @param keyBytes Private key bytes
     */
    public void putPrivateKey(UUID tenantId, String keyType, byte[] keyBytes) {
        String cacheKey = buildCacheKey(tenantId, keyType, "private");
        privateKeyCache.put(cacheKey, keyBytes);
        log.debug("Cached private key: tenantId={}, keyType={}, size={} bytes",
                tenantId, keyType, keyBytes.length);
    }

    /**
     * Put public key in cache
     * @param tenantId Tenant UUID
     * @param keyType KEY_TYPE (SIGNING or ENCRYPTION)
     * @param keyBytes Public key bytes
     */
    public void putPublicKey(UUID tenantId, String keyType, byte[] keyBytes) {
        String cacheKey = buildCacheKey(tenantId, keyType, "public");
        publicKeyCache.put(cacheKey, keyBytes);
        log.debug("Cached public key: tenantId={}, keyType={}, size={} bytes",
                tenantId, keyType, keyBytes.length);
    }

    /**
     * Invalidate all keys for a tenant (called on key rotation)
     * @param tenantId Tenant UUID
     */
    public void invalidateTenantKeys(UUID tenantId) {
        // Invalidate all key types for this tenant
        for (String keyType : new String[]{"SIGNING", "ENCRYPTION"}) {
            privateKeyCache.invalidate(buildCacheKey(tenantId, keyType, "private"));
            publicKeyCache.invalidate(buildCacheKey(tenantId, keyType, "public"));
        }
        log.info("Invalidated all cached keys for tenant: {}", tenantId);
    }

    /**
     * Invalidate specific key type for a tenant
     * @param tenantId Tenant UUID
     * @param keyType KEY_TYPE (SIGNING or ENCRYPTION)
     */
    public void invalidateKey(UUID tenantId, String keyType) {
        privateKeyCache.invalidate(buildCacheKey(tenantId, keyType, "private"));
        publicKeyCache.invalidate(buildCacheKey(tenantId, keyType, "public"));
        log.info("Invalidated cached keys: tenantId={}, keyType={}", tenantId, keyType);
    }

    /**
     * Clear all cached keys (for testing or emergency)
     */
    public void clearAll() {
        privateKeyCache.invalidateAll();
        publicKeyCache.invalidateAll();
        log.warn("Cleared all cached keys");
    }

    /**
     * Get cache statistics for monitoring
     * @return Cache stats object with hit/miss rates
     */
    public CacheStatistics getStatistics() {
        if (!statsEnabled) {
            return CacheStatistics.disabled();
        }

        CacheStats privateStats = privateKeyCache.stats();
        CacheStats publicStats = publicKeyCache.stats();

        return new CacheStatistics(
                privateStats.hitCount() + publicStats.hitCount(),
                privateStats.missCount() + publicStats.missCount(),
                privateStats.evictionCount() + publicStats.evictionCount(),
                privateKeyCache.estimatedSize() + publicKeyCache.estimatedSize()
        );
    }

    private String buildCacheKey(UUID tenantId, String keyType, String visibility) {
        return String.format("%s:%s:%s", tenantId, keyType, visibility);
    }

    /**
     * Cache statistics DTO for monitoring
     */
    public record CacheStatistics(
            long hitCount,
            long missCount,
            long evictionCount,
            long size
    ) {
        public double hitRate() {
            long total = hitCount + missCount;
            return total == 0 ? 0.0 : (double) hitCount / total;
        }

        public static CacheStatistics disabled() {
            return new CacheStatistics(0, 0, 0, 0);
        }
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Cache layer only - key metadata stored in TigerBeetle
**ADR-013 (Camel-First):** Used by KeyRetrievalService in Camel routes
**ADR-014 (Named Processors):** Service injected into processors
**ADR-015 (Tiered Storage):** Cache is hot tier, TigerBeetle is source of truth

## Configuration

```properties
# application.properties
betrace.kms.cache.private-key-ttl=60m
betrace.kms.cache.public-key-ttl=24h
betrace.kms.cache.max-entries=1000
betrace.kms.cache.stats-enabled=true
```

## Dependencies

```xml
<!-- pom.xml -->
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
    <version>3.1.8</version>
</dependency>
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testGetPrivateKey_CacheHit - verify cached key returned
- testGetPrivateKey_CacheMiss - verify empty Optional on miss
- testPutPrivateKey - verify key stored with correct TTL
- testGetPublicKey_CacheHit - verify cached key returned
- testGetPublicKey_CacheMiss - verify empty Optional on miss
- testPutPublicKey - verify key stored with correct TTL
- testInvalidateTenantKeys - verify all tenant keys removed
- testInvalidateKey - verify specific key type removed
- testClearAll - verify all caches emptied
- testGetStatistics - verify hit/miss counts accurate
- testCacheExpiration - verify keys expire after TTL
- testMaxEntries - verify eviction when limit reached

**Integration Tests:**
- testCacheWithKeyRetrievalService - verify cache-first retrieval
- testInvalidationOnRotation - verify rotation triggers invalidation
- testMultiTenantIsolation - verify tenant A cannot access tenant B keys

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Memory dumps exposing private keys - mitigate with secure memory practices (future enhancement)
- Cache timing attacks - mitigate with constant-time cache lookups (Caffeine default)
- Stale keys after rotation - mitigate with invalidation on rotation events
- Excessive memory usage - mitigate with max-entries limit and eviction policy
- Cache statistics leaking usage patterns - mitigate with restricted access to getStatistics()

**Compliance:**
- SOC2 CC6.7 (Encryption) - cache does not persist keys to disk
- GDPR Article 32 (Security) - memory-only storage reduces exposure
- NIST 800-53 SC-12 (Key Management) - cache respects key lifecycle

## Success Criteria

- [ ] Private keys cached for 60 minutes, public keys for 24 hours
- [ ] Cache hit rate >80% for repeated operations
- [ ] Invalidation removes all tenant keys on rotation
- [ ] Cache statistics accurate for monitoring
- [ ] No keys persist to disk (memory-only)
- [ ] All tests pass with 90% coverage
