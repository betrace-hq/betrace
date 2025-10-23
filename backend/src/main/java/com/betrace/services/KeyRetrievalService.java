package com.fluo.services;

import com.fluo.kms.KeyManagementService;
import io.micrometer.core.annotation.Counted;
import io.micrometer.core.annotation.Timed;
import io.micrometer.core.instrument.MeterRegistry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.quarkus.logging.Log;
import io.smallrye.faulttolerance.api.CircuitBreakerName;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.faulttolerance.CircuitBreaker;
import org.eclipse.microprofile.faulttolerance.Retry;
import org.eclipse.microprofile.faulttolerance.Timeout;

import java.security.PrivateKey;
import java.security.PublicKey;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Cache-first key retrieval service (PRD-006c).
 *
 * Retrieval Strategy:
 * 1. Check KeyCache first (60min private, 24hr public TTL)
 * 2. On cache miss: Load from KeyManagementService
 * 3. Store in cache for future requests
 * 4. Return key to caller
 *
 * Performance Target:
 * - Cached retrieval: <1ms (in-memory)
 * - Uncached retrieval: <100ms (filesystem or KMS API)
 * - Cache hit rate: >80% under normal load
 *
 * Security Properties:
 * - Private keys have shorter TTL (60min) to minimize exposure
 * - Public keys have longer TTL (24hr) for verification performance
 * - No keys logged or persisted outside KMS
 * - Encryption context enforced for tenant isolation
 *
 * KMS Provider Agnostic:
 * - Works with any KeyManagementService implementation
 * - LocalKmsAdapter (development)
 * - AwsKmsAdapter (AWS KMS)
 * - VaultKmsAdapter (HashiCorp Vault)
 * - GcpKmsAdapter (Google Cloud KMS)
 * - AzureKmsAdapter (Azure Key Vault)
 *
 * Compliance:
 * - SOC2 CC6.1: Logical access controls
 * - NIST 800-53 SC-12: Cryptographic key management
 * - HIPAA 164.312(a)(2)(iv): Encryption key retrieval
 *
 * @see KeyCache
 * @see KeyManagementService
 */
@ApplicationScoped
public class KeyRetrievalService {

    @Inject
    KeyManagementService kms;

    @Inject
    KeyCache keyCache;

    @Inject
    MeterRegistry meterRegistry;

    /**
     * Get tenant's private signing key (cache-first).
     *
     * Retrieval Flow:
     * 1. Check cache (fast path)
     * 2. Load from KMS (slow path)
     * 3. Cache for 60 minutes
     * 4. Return key
     *
     * Observability:
     * - Prometheus metrics: kms_retrieve_signing_key_seconds, kms_retrieve_signing_key_total
     * - OpenTelemetry traces: kms.retrieve_signing_key span
     * - Circuit breaker: Opens after 50% failure rate (10 request window)
     * - Retry: 3 attempts with 100ms delay + jitter
     * - Timeout: 5 seconds per attempt
     *
     * @param tenantId Tenant UUID
     * @return Private signing key (Ed25519)
     * @throws KeyRetrievalException if key not found or KMS error
     */
    @Timed(value = "kms.retrieve_signing_key", description = "Signing key retrieval latency", percentiles = {0.5, 0.95, 0.99})
    @Counted(value = "kms.retrieve_signing_key.total", description = "Total signing key retrievals")
    @WithSpan(value = "kms.retrieve_signing_key")
    @CircuitBreaker(requestVolumeThreshold = 10, failureRatio = 0.5, delay = 5000, successThreshold = 3)
    @CircuitBreakerName("kms-signing-key")
    @Retry(maxRetries = 3, delay = 100, jitter = 50, retryOn = KeyManagementService.KmsException.class)
    @Timeout(value = 5, unit = ChronoUnit.SECONDS)
    public PrivateKey getSigningKey(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }

        Span span = Span.current();
        span.setAttribute("tenant.id", tenantId.toString());
        span.setAttribute("key.type", "signing");
        span.setAttribute("cache.checked", true);

        long startTime = System.currentTimeMillis();

        try {
            // Check cache first (fast path)
            var cachedKey = keyCache.getPrivateKey(tenantId);
            if (cachedKey.isPresent()) {
                long elapsed = System.currentTimeMillis() - startTime;
                span.setAttribute("cache.hit", true);
                span.setAttribute("latency.ms", elapsed);
                meterRegistry.counter("kms.cache.hit", "key_type", "signing").increment();
                Log.debugf("Retrieved signing key from cache for tenant %s (%dms)", tenantId, elapsed);
                return cachedKey.get();
            }

            // Cache miss: Load from KMS (slow path)
            span.setAttribute("cache.hit", false);
            meterRegistry.counter("kms.cache.miss", "key_type", "signing").increment();
            Log.debugf("Cache miss for signing key (tenant %s), loading from KMS", tenantId);

            PrivateKey privateKey = kms.getTenantSigningKey(tenantId);

            // Cache for future requests
            keyCache.putPrivateKey(tenantId, privateKey);

            long elapsed = System.currentTimeMillis() - startTime;
            span.setAttribute("latency.ms", elapsed);
            Log.infof("Retrieved signing key from KMS for tenant %s (%dms)", tenantId, elapsed);

            return privateKey;

        } catch (KeyManagementService.KmsException e) {
            span.setAttribute("error", true);
            span.setAttribute("error.message", e.getMessage());
            meterRegistry.counter("kms.errors", "operation", "retrieve_signing_key", "tenant_id", tenantId.toString()).increment();
            throw new KeyRetrievalException(
                "Failed to retrieve signing key for tenant " + tenantId + ". " +
                "Check KMS connectivity and IAM permissions. " +
                "See docs: https://docs.fluo.dev/setup/kms-troubleshooting",
                e
            );
        }
    }

    /**
     * Get tenant's public signing key (cache-first).
     *
     * Public keys have longer TTL (24hr) than private keys because:
     * - No security risk (already public)
     * - High reuse for signature verification
     * - Reduces KMS load
     *
     * @param tenantId Tenant UUID
     * @return Public signing key (Ed25519)
     * @throws KeyRetrievalException if key not found or KMS error
     */
    @Timed(value = "kms.retrieve_public_key", description = "Public key retrieval latency", percentiles = {0.5, 0.95, 0.99})
    @Counted(value = "kms.retrieve_public_key.total", description = "Total public key retrievals")
    @WithSpan(value = "kms.retrieve_public_key")
    @CircuitBreaker(requestVolumeThreshold = 10, failureRatio = 0.5, delay = 5000, successThreshold = 3)
    @CircuitBreakerName("kms-public-key")
    @Retry(maxRetries = 3, delay = 100, jitter = 50, retryOn = KeyManagementService.KmsException.class)
    @Timeout(value = 5, unit = ChronoUnit.SECONDS)
    public PublicKey getPublicKey(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }

        Span span = Span.current();
        span.setAttribute("tenant.id", tenantId.toString());
        span.setAttribute("key.type", "public");
        span.setAttribute("cache.checked", true);

        long startTime = System.currentTimeMillis();

        try {
            // Check cache first (fast path)
            var cachedKey = keyCache.getPublicKey(tenantId);
            if (cachedKey.isPresent()) {
                long elapsed = System.currentTimeMillis() - startTime;
                span.setAttribute("cache.hit", true);
                span.setAttribute("latency.ms", elapsed);
                meterRegistry.counter("kms.cache.hit", "key_type", "public").increment();
                Log.debugf("Retrieved public key from cache for tenant %s (%dms)", tenantId, elapsed);
                return cachedKey.get();
            }

            // Cache miss: Load from KMS (slow path)
            span.setAttribute("cache.hit", false);
            meterRegistry.counter("kms.cache.miss", "key_type", "public").increment();
            Log.debugf("Cache miss for public key (tenant %s), loading from KMS", tenantId);

            PublicKey publicKey = kms.getTenantPublicKey(tenantId);

            // Cache for future requests (24hr TTL)
            keyCache.putPublicKey(tenantId, publicKey);

            long elapsed = System.currentTimeMillis() - startTime;
            span.setAttribute("latency.ms", elapsed);
            Log.infof("Retrieved public key from KMS for tenant %s (%dms)", tenantId, elapsed);

            return publicKey;

        } catch (KeyManagementService.KmsException e) {
            span.setAttribute("error", true);
            span.setAttribute("error.message", e.getMessage());
            meterRegistry.counter("kms.errors", "operation", "retrieve_public_key", "tenant_id", tenantId.toString()).increment();
            throw new KeyRetrievalException(
                "Failed to retrieve public key for tenant " + tenantId + ". " +
                "Check KMS connectivity and IAM permissions. " +
                "See docs: https://docs.fluo.dev/setup/kms-troubleshooting",
                e
            );
        }
    }

    /**
     * Get tenant's encryption key (cache-first).
     *
     * Note: This returns the plaintext encryption key for immediate use.
     * Caller should zero out the key from memory after use.
     *
     * @param tenantId Tenant UUID
     * @return AES-256 encryption key bytes
     * @throws KeyRetrievalException if key not found or KMS error
     */
    @Timed(value = "kms.retrieve_encryption_key", description = "Encryption key retrieval latency", percentiles = {0.5, 0.95, 0.99})
    @Counted(value = "kms.retrieve_encryption_key.total", description = "Total encryption key retrievals")
    @WithSpan(value = "kms.retrieve_encryption_key")
    @CircuitBreaker(requestVolumeThreshold = 10, failureRatio = 0.5, delay = 5000, successThreshold = 3)
    @CircuitBreakerName("kms-encryption-key")
    @Retry(maxRetries = 3, delay = 100, jitter = 50, retryOn = KeyManagementService.KmsException.class)
    @Timeout(value = 5, unit = ChronoUnit.SECONDS)
    public byte[] getEncryptionKey(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }

        Span span = Span.current();
        span.setAttribute("tenant.id", tenantId.toString());
        span.setAttribute("key.type", "encryption");
        span.setAttribute("cache.checked", true);

        long startTime = System.currentTimeMillis();

        try {
            // Check cache first (fast path)
            var cachedKey = keyCache.getEncryptionKey(tenantId);
            if (cachedKey.isPresent()) {
                long elapsed = System.currentTimeMillis() - startTime;
                span.setAttribute("cache.hit", true);
                span.setAttribute("latency.ms", elapsed);
                meterRegistry.counter("kms.cache.hit", "key_type", "encryption").increment();
                Log.debugf("Retrieved encryption key from cache for tenant %s (%dms)", tenantId, elapsed);
                return cachedKey.get();
            }

            // Cache miss: Generate data key from KMS (slow path)
            span.setAttribute("cache.hit", false);
            meterRegistry.counter("kms.cache.miss", "key_type", "encryption").increment();
            Log.debugf("Cache miss for encryption key (tenant %s), generating from KMS", tenantId);

            var encryptionContext = java.util.Map.of(
                "tenantId", tenantId.toString(),
                "keyType", "encryption"
            );

            var dataKey = kms.generateDataKey("AES_256", encryptionContext);
            byte[] plaintextKey = dataKey.plaintextKey();

            // Cache for future requests (60min TTL)
            keyCache.putEncryptionKey(tenantId, plaintextKey);

            // Zero out plaintext key from DataKeyResponse (security best practice)
            dataKey.zeroPlaintextKey();

            long elapsed = System.currentTimeMillis() - startTime;
            span.setAttribute("latency.ms", elapsed);
            Log.infof("Generated encryption key from KMS for tenant %s (%dms)", tenantId, elapsed);

            return plaintextKey;

        } catch (KeyManagementService.KmsException e) {
            span.setAttribute("error", true);
            span.setAttribute("error.message", e.getMessage());
            meterRegistry.counter("kms.errors", "operation", "retrieve_encryption_key", "tenant_id", tenantId.toString()).increment();
            throw new KeyRetrievalException(
                "Failed to retrieve encryption key for tenant " + tenantId + ". " +
                "Check KMS connectivity and IAM permissions. " +
                "See docs: https://docs.fluo.dev/setup/kms-troubleshooting",
                e
            );
        }
    }

    /**
     * Invalidate all cached keys for tenant (used on key rotation).
     *
     * @param tenantId Tenant UUID
     */
    public void invalidateTenant(UUID tenantId) {
        keyCache.invalidateTenant(tenantId);
        Log.infof("Invalidated cached keys for tenant %s", tenantId);
    }

    /**
     * Get cache statistics (monitoring/admin).
     *
     * @return Cache stats (hit rate, size, etc.)
     */
    public KeyCache.CacheStats getCacheStats() {
        return keyCache.getStats();
    }

    /**
     * Exception thrown when key retrieval fails.
     */
    public static class KeyRetrievalException extends RuntimeException {
        public KeyRetrievalException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
