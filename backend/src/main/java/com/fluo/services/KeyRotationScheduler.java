package com.fluo.services;

import io.quarkus.logging.Log;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Automated 90-day key rotation scheduler (PRD-006e).
 *
 * Rotation Strategy:
 * - Run daily (00:00 UTC by default)
 * - Query keys older than 90 days
 * - Generate new keys for affected tenants
 * - Mark old keys as rotated (status=2)
 * - Invalidate cache for rotated keys
 * - Record rotation events for audit
 *
 * Cryptoperiod (NIST 800-57):
 * - Signing keys: 90 days (configurable)
 * - Encryption keys: 90 days (configurable)
 * - Rationale: Balance security (limit key exposure) and ops (minimize disruption)
 *
 * Rotation Process:
 * 1. Identify keys requiring rotation (age > 90 days)
 * 2. Generate new keys for each affected tenant
 * 3. Mark old keys as "rotated" (not deleted, for audit trail)
 * 4. Invalidate cached keys (force retrieval of new keys)
 * 5. Log rotation events for compliance reporting
 *
 * Performance:
 * - Batch size: 100 tenants per run (configurable)
 * - Target: <5 minutes for 100 tenants
 * - Backpressure: Skip run if previous rotation still in progress
 *
 * Compliance:
 * - NIST 800-53 SC-12: Cryptographic key establishment and management
 * - SOC2 CC6.7: Key rotation enforcement
 * - PCI-DSS 3.6.4: Cryptoperiod enforcement
 * - HIPAA 164.312(a)(2)(iv): Key management lifecycle
 *
 * Configuration:
 * - fluo.kms.rotation.enabled: Enable/disable rotation (default: true)
 * - fluo.kms.rotation.age-days: Key age threshold (default: 90 days)
 * - fluo.kms.rotation.batch-size: Max tenants per run (default: 100)
 * - fluo.kms.rotation.cron: Cron schedule (default: daily at midnight)
 *
 * @see KeyGenerationService
 * @see KeyRetrievalService
 */
@ApplicationScoped
public class KeyRotationScheduler {

    @ConfigProperty(name = "fluo.kms.rotation.enabled", defaultValue = "true")
    boolean rotationEnabled;

    @ConfigProperty(name = "fluo.kms.rotation.age-days", defaultValue = "90")
    int rotationAgeDays;

    @ConfigProperty(name = "fluo.kms.rotation.batch-size", defaultValue = "100")
    int batchSize;

    @Inject
    KeyGenerationService keyGenerationService;

    @Inject
    KeyRetrievalService keyRetrievalService;

    // In-memory key metadata tracking (will be replaced with TigerBeetle queries)
    // Format: tenantId -> (keyId, createdAt, status)
    private final Map<UUID, KeyMetadata> signingKeyMetadata = new HashMap<>();
    private final Map<UUID, KeyMetadata> encryptionKeyMetadata = new HashMap<>();

    private volatile boolean rotationInProgress = false;

    /**
     * Scheduled key rotation job.
     *
     * Runs daily at 00:00 UTC (configurable via cron).
     * Rotates keys older than 90 days (configurable).
     */
    @Scheduled(
        cron = "{fluo.kms.rotation.cron:0 0 0 * * ?}",  // Daily at midnight
        identity = "key-rotation"
    )
    void rotateKeys() {
        if (!rotationEnabled) {
            Log.debug("Key rotation disabled (fluo.kms.rotation.enabled=false)");
            return;
        }

        if (rotationInProgress) {
            Log.warn("Key rotation already in progress, skipping this run");
            return;
        }

        try {
            rotationInProgress = true;
            Log.infof("Starting automated key rotation (age threshold: %d days)", rotationAgeDays);

            long startTime = System.currentTimeMillis();
            RotationResult result = performRotation();
            long elapsed = System.currentTimeMillis() - startTime;

            Log.infof("Key rotation complete: %d signing keys rotated, %d encryption keys rotated (%dms)",
                result.signingKeysRotated(), result.encryptionKeysRotated(), elapsed);

        } catch (Exception e) {
            Log.errorf(e, "Key rotation failed: %s", e.getMessage());
        } finally {
            rotationInProgress = false;
        }
    }

    /**
     * Perform key rotation for all tenants with expired keys.
     *
     * @return Rotation result summary
     */
    private RotationResult performRotation() {
        Instant rotationThreshold = Instant.now().minus(Duration.ofDays(rotationAgeDays));

        AtomicInteger signingKeysRotated = new AtomicInteger(0);
        AtomicInteger encryptionKeysRotated = new AtomicInteger(0);

        // Find signing keys requiring rotation
        List<UUID> signingKeyTenants = findTenantsNeedingRotation(
            signingKeyMetadata, rotationThreshold
        );

        // Find encryption keys requiring rotation
        List<UUID> encryptionKeyTenants = findTenantsNeedingRotation(
            encryptionKeyMetadata, rotationThreshold
        );

        // Rotate signing keys (batch processing)
        for (UUID tenantId : signingKeyTenants.stream().limit(batchSize).toList()) {
            try {
                rotateSigningKey(tenantId);
                signingKeysRotated.incrementAndGet();
            } catch (Exception e) {
                Log.errorf(e, "Failed to rotate signing key for tenant %s", tenantId);
            }
        }

        // Rotate encryption keys (batch processing)
        for (UUID tenantId : encryptionKeyTenants.stream().limit(batchSize).toList()) {
            try {
                rotateEncryptionKey(tenantId);
                encryptionKeysRotated.incrementAndGet();
            } catch (Exception e) {
                Log.errorf(e, "Failed to rotate encryption key for tenant %s", tenantId);
            }
        }

        return new RotationResult(
            signingKeysRotated.get(),
            encryptionKeysRotated.get(),
            signingKeyTenants.size() - signingKeysRotated.get(), // remaining
            encryptionKeyTenants.size() - encryptionKeysRotated.get() // remaining
        );
    }

    /**
     * Rotate signing key for tenant.
     *
     * @param tenantId Tenant UUID
     */
    private void rotateSigningKey(UUID tenantId) {
        Log.infof("Rotating signing key for tenant: %s", tenantId);

        // Get current key metadata
        KeyMetadata oldKey = signingKeyMetadata.get(tenantId);

        // Generate new signing key
        var result = keyGenerationService.generateSigningKey(tenantId);

        // Mark old key as rotated (status=2)
        if (oldKey != null) {
            oldKey.status = KeyStatus.ROTATED;
            Log.debugf("Marked old signing key %s as rotated", oldKey.keyId);
        }

        // Store new key metadata
        signingKeyMetadata.put(tenantId, new KeyMetadata(
            result.keyId(),
            result.createdAt(),
            KeyStatus.ACTIVE
        ));

        // Invalidate cache (force clients to retrieve new key)
        keyRetrievalService.invalidateTenant(tenantId);

        Log.infof("Rotated signing key for tenant %s: old=%s, new=%s",
            tenantId, oldKey != null ? oldKey.keyId : "none", result.keyId());
    }

    /**
     * Rotate encryption key for tenant.
     *
     * @param tenantId Tenant UUID
     */
    private void rotateEncryptionKey(UUID tenantId) {
        Log.infof("Rotating encryption key for tenant: %s", tenantId);

        // Get current key metadata
        KeyMetadata oldKey = encryptionKeyMetadata.get(tenantId);

        // Generate new encryption key
        var result = keyGenerationService.generateEncryptionKey(tenantId);

        // Mark old key as rotated (status=2)
        if (oldKey != null) {
            oldKey.status = KeyStatus.ROTATED;
            Log.debugf("Marked old encryption key %s as rotated", oldKey.keyId);
        }

        // Store new key metadata
        encryptionKeyMetadata.put(tenantId, new KeyMetadata(
            result.keyId(),
            result.createdAt(),
            KeyStatus.ACTIVE
        ));

        // Invalidate cache (force clients to retrieve new key)
        keyRetrievalService.invalidateTenant(tenantId);

        Log.infof("Rotated encryption key for tenant %s: old=%s, new=%s",
            tenantId, oldKey != null ? oldKey.keyId : "none", result.keyId());
    }

    /**
     * Find tenants with keys older than rotation threshold.
     *
     * @param metadata Key metadata map
     * @param threshold Rotation age threshold
     * @return List of tenant IDs requiring rotation
     */
    private List<UUID> findTenantsNeedingRotation(
        Map<UUID, KeyMetadata> metadata,
        Instant threshold
    ) {
        return metadata.entrySet().stream()
            .filter(entry -> entry.getValue().status == KeyStatus.ACTIVE)
            .filter(entry -> entry.getValue().createdAt.isBefore(threshold))
            .map(Map.Entry::getKey)
            .toList();
    }

    /**
     * Register signing key metadata (called by KeyGenerationService).
     *
     * @param tenantId Tenant UUID
     * @param keyId Key ID
     * @param createdAt Creation timestamp
     */
    public void registerSigningKey(UUID tenantId, UUID keyId, Instant createdAt) {
        signingKeyMetadata.put(tenantId, new KeyMetadata(keyId, createdAt, KeyStatus.ACTIVE));
        Log.debugf("Registered signing key metadata: tenant=%s, keyId=%s", tenantId, keyId);
    }

    /**
     * Register encryption key metadata (called by KeyGenerationService).
     *
     * @param tenantId Tenant UUID
     * @param keyId Key ID
     * @param createdAt Creation timestamp
     */
    public void registerEncryptionKey(UUID tenantId, UUID keyId, Instant createdAt) {
        encryptionKeyMetadata.put(tenantId, new KeyMetadata(keyId, createdAt, KeyStatus.ACTIVE));
        Log.debugf("Registered encryption key metadata: tenant=%s, keyId=%s", tenantId, keyId);
    }

    /**
     * Get rotation status (monitoring/admin).
     *
     * @return Rotation status summary
     */
    public RotationStatus getStatus() {
        long signingKeysActive = signingKeyMetadata.values().stream()
            .filter(m -> m.status == KeyStatus.ACTIVE)
            .count();

        long encryptionKeysActive = encryptionKeyMetadata.values().stream()
            .filter(m -> m.status == KeyStatus.ACTIVE)
            .count();

        return new RotationStatus(
            rotationEnabled,
            rotationAgeDays,
            rotationInProgress,
            signingKeysActive,
            encryptionKeysActive
        );
    }

    /**
     * Key metadata for rotation tracking.
     */
    private static class KeyMetadata {
        UUID keyId;
        Instant createdAt;
        KeyStatus status;

        KeyMetadata(UUID keyId, Instant createdAt, KeyStatus status) {
            this.keyId = keyId;
            this.createdAt = createdAt;
            this.status = status;
        }
    }

    /**
     * Key status enum.
     */
    private enum KeyStatus {
        ACTIVE(1),
        ROTATED(2),
        REVOKED(3);

        final int code;

        KeyStatus(int code) {
            this.code = code;
        }
    }

    /**
     * Rotation result summary.
     */
    public record RotationResult(
        int signingKeysRotated,
        int encryptionKeysRotated,
        int signingKeysRemaining,
        int encryptionKeysRemaining
    ) {}

    /**
     * Rotation status summary (monitoring).
     */
    public record RotationStatus(
        boolean enabled,
        int ageDays,
        boolean inProgress,
        long signingKeysActive,
        long encryptionKeysActive
    ) {}
}
