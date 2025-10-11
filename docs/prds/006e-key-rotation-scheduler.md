# PRD-006e: Key Rotation Scheduler

**Priority:** P0 (Security Infrastructure)
**Complexity:** Moderate (Component)
**Type:** Unit PRD
**Parent:** PRD-006 (KMS Integration System)
**Dependencies:** PRD-006b (KeyGenerationService), PRD-006d (KeyCache), PRD-002 (TigerBeetle)

## Problem

Cryptographic keys must rotate periodically to limit exposure from potential compromise (SOC2 CC6.7, NIST 800-53 SC-12). Manual rotation is error-prone and does not scale across tenants. Without automated rotation, keys remain active indefinitely, violating security best practices and compliance requirements.

## Solution

Implement scheduled key rotation using Quarkus Scheduler to run daily checks. For each tenant, query TigerBeetle for keys older than 90 days, generate new keys via KeyGenerationService, mark old keys as rotated (status=2), and invalidate KeyCache. Rotation events are recorded as TigerBeetle transfers (code=8) for audit trail.

## Unit Description

**File:** `backend/src/main/java/com/fluo/services/KeyRotationScheduler.java`
**Type:** CDI ApplicationScoped Service with @Scheduled annotation
**Purpose:** Automated daily key rotation for compliance and security

## Implementation

```java
package com.fluo.services;

import com.fluo.model.KEY_TYPE;
import com.fluo.persistence.TigerBeetleClient;
import com.tigerbeetle.AccountBatch;
import com.tigerbeetle.AccountFilter;
import com.tigerbeetle.TransferBatch;
import com.tigerbeetle.UInt128;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class KeyRotationScheduler {
    private static final Logger log = LoggerFactory.getLogger(KeyRotationScheduler.class);

    @ConfigProperty(name = "fluo.kms.rotation.enabled", defaultValue = "true")
    boolean rotationEnabled;

    @ConfigProperty(name = "fluo.kms.rotation.age-days", defaultValue = "90")
    int rotationAgeDays;

    @ConfigProperty(name = "fluo.kms.rotation.batch-size", defaultValue = "100")
    int batchSize;

    @Inject
    TigerBeetleClient tigerBeetleClient;

    @Inject
    KeyGenerationService keyGenerationService;

    @Inject
    KeyCache keyCache;

    /**
     * Run daily at 2 AM UTC to rotate keys older than rotationAgeDays
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void checkAndRotateKeys() {
        if (!rotationEnabled) {
            log.debug("Key rotation scheduler disabled, skipping");
            return;
        }

        log.info("Starting scheduled key rotation check (age threshold: {} days)", rotationAgeDays);

        try {
            List<KeyRotationCandidate> candidates = findKeysForRotation();
            log.info("Found {} keys eligible for rotation", candidates.size());

            int rotatedCount = 0;
            for (KeyRotationCandidate candidate : candidates) {
                try {
                    rotateKey(candidate);
                    rotatedCount++;
                } catch (Exception e) {
                    log.error("Failed to rotate key for tenant {}, keyType {}: {}",
                            candidate.tenantId(), candidate.keyType(), e.getMessage(), e);
                }
            }

            log.info("Key rotation complete: {} of {} keys rotated successfully",
                    rotatedCount, candidates.size());

        } catch (Exception e) {
            log.error("Key rotation scheduler failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Find all keys older than rotationAgeDays across all tenants
     * @return List of keys eligible for rotation
     */
    private List<KeyRotationCandidate> findKeysForRotation() throws Exception {
        List<KeyRotationCandidate> candidates = new ArrayList<>();

        // Query TigerBeetle for all key accounts (code=8)
        AccountFilter filter = new AccountFilter();
        filter.setAccountCode((short) 8); // KMS key type
        filter.setTimestampMin(0);
        filter.setTimestampMax(Instant.now().toEpochMilli() * 1_000_000);

        AccountBatch accounts = tigerBeetleClient.lookupAccounts(filter);

        long rotationThresholdMs = Instant.now()
                .minus(rotationAgeDays, ChronoUnit.DAYS)
                .toEpochMilli();

        for (int i = 0; i < accounts.getLength(); i++) {
            UUID keyId = toUUID(accounts.getId(i));
            UInt128 userData128 = accounts.getUserData128(i);

            // Unpack metadata: [key_type(8) | tenant_id(96) | created_at(32) | status(8)]
            byte keyTypeCode = (byte) (userData128.getLeastSignificant() >> 120);
            long createdAtMs = (userData128.getLeastSignificant() >> 8) & 0xFFFFFFFF;
            byte status = (byte) (userData128.getLeastSignificant() & 0xFF);

            KEY_TYPE keyType = keyTypeCode == 1 ? KEY_TYPE.SIGNING : KEY_TYPE.ENCRYPTION;

            // Only rotate active keys older than threshold
            if (status == 1 && createdAtMs < rotationThresholdMs) {
                UUID tenantId = extractTenantId(userData128);
                candidates.add(new KeyRotationCandidate(keyId, tenantId, keyType, createdAtMs));
            }
        }

        return candidates;
    }

    /**
     * Rotate a single key: generate new, mark old as rotated, invalidate cache
     * @param candidate Key rotation candidate
     */
    private void rotateKey(KeyRotationCandidate candidate) throws Exception {
        log.info("Rotating key: tenantId={}, keyType={}, age={} days",
                candidate.tenantId(), candidate.keyType(), candidate.ageDays());

        // 1. Generate new key
        UUID newKeyId = keyGenerationService.generateKey(candidate.tenantId(), candidate.keyType());
        log.info("Generated new key: newKeyId={}, tenantId={}", newKeyId, candidate.tenantId());

        // 2. Mark old key as rotated (status=2)
        markKeyAsRotated(candidate.keyId());

        // 3. Record rotation event in TigerBeetle (code=8, userData128 packed)
        recordRotationEvent(candidate.tenantId(), candidate.keyId(), newKeyId);

        // 4. Invalidate cache
        keyCache.invalidateKey(candidate.tenantId(), candidate.keyType().name());

        log.info("Key rotation complete: oldKeyId={}, newKeyId={}, tenantId={}",
                candidate.keyId(), newKeyId, candidate.tenantId());
    }

    /**
     * Mark key as rotated (status=2) in TigerBeetle
     * @param keyId Key UUID to mark as rotated
     */
    private void markKeyAsRotated(UUID keyId) throws Exception {
        // Query existing account
        AccountBatch existingAccounts = tigerBeetleClient.lookupAccounts(
                new UInt128[]{toUInt128(keyId)}
        );

        if (existingAccounts.getLength() == 0) {
            throw new IllegalStateException("Key not found for rotation: " + keyId);
        }

        UInt128 userData128 = existingAccounts.getUserData128(0);

        // Update status to 2 (rotated)
        long leastSig = userData128.getLeastSignificant();
        long updatedLeastSig = (leastSig & ~0xFFL) | 2; // Set status bits to 2

        UInt128 updatedUserData128 = new UInt128(
                userData128.getMostSignificant(),
                updatedLeastSig
        );

        // Update account (TigerBeetle requires creating new version)
        tigerBeetleClient.updateAccountMetadata(keyId, updatedUserData128);
        log.debug("Marked key as rotated: keyId={}", keyId);
    }

    /**
     * Record rotation event in TigerBeetle transfer (code=8)
     * @param tenantId Tenant UUID
     * @param oldKeyId Old key UUID
     * @param newKeyId New key UUID
     */
    private void recordRotationEvent(UUID tenantId, UUID oldKeyId, UUID newKeyId) throws Exception {
        // Transfer from tenant account to new key account
        UInt128 eventId = toUInt128(UUID.randomUUID());
        UInt128 tenantAccountId = toUInt128(tenantId);
        UInt128 newKeyAccountId = toUInt128(newKeyId);

        // Pack metadata: op_type=5 (rotate), old_key_id
        UInt128 userData128 = packRotationMetadata(5, oldKeyId);

        TransferBatch transfer = new TransferBatch(1);
        transfer.add();
        transfer.setId(eventId);
        transfer.setDebitAccountId(tenantAccountId);
        transfer.setCreditAccountId(newKeyAccountId);
        transfer.setAmount(1); // Event count
        transfer.setCode((short) 8); // KMS operation
        transfer.setUserData128(userData128);
        transfer.setTimestamp(Instant.now().toEpochMilli() * 1_000_000);

        tigerBeetleClient.createTransfers(transfer);
        log.debug("Recorded rotation event: tenantId={}, oldKeyId={}, newKeyId={}",
                tenantId, oldKeyId, newKeyId);
    }

    private UUID extractTenantId(UInt128 userData128) {
        // Extract 96 bits for tenant_id
        long mostSig = (userData128.getLeastSignificant() >> 32) & 0xFFFFFFFFFFFFL;
        long leastSig = 0; // Simplified extraction
        return new UUID(mostSig, leastSig);
    }

    private UInt128 packRotationMetadata(int opType, UUID oldKeyId) {
        // Pack: op_type(8) | old_key_id(120)
        long mostSig = oldKeyId.getMostSignificantBits();
        long leastSig = ((long) opType << 120) | (oldKeyId.getLeastSignificantBits() & 0xFFFFFFFFFFFFFFFFL);
        return new UInt128(mostSig, leastSig);
    }

    private UInt128 toUInt128(UUID uuid) {
        return new UInt128(uuid.getMostSignificantBits(), uuid.getLeastSignificantBits());
    }

    private UUID toUUID(UInt128 uint128) {
        return new UUID(uint128.getMostSignificant(), uint128.getLeastSignificant());
    }

    /**
     * Manual rotation trigger (for API endpoint or CLI)
     * @param tenantId Tenant UUID
     * @param keyType KEY_TYPE to rotate
     */
    public void rotateKeyManually(UUID tenantId, KEY_TYPE keyType) throws Exception {
        log.info("Manual key rotation triggered: tenantId={}, keyType={}", tenantId, keyType);

        // Find current key for this tenant/keyType
        KeyRotationCandidate candidate = findCurrentKey(tenantId, keyType);
        if (candidate == null) {
            throw new IllegalStateException("No active key found for rotation");
        }

        rotateKey(candidate);
    }

    private KeyRotationCandidate findCurrentKey(UUID tenantId, KEY_TYPE keyType) throws Exception {
        // Query TigerBeetle for active key matching tenant and keyType
        AccountFilter filter = new AccountFilter();
        filter.setAccountCode((short) 8);
        AccountBatch accounts = tigerBeetleClient.lookupAccounts(filter);

        for (int i = 0; i < accounts.getLength(); i++) {
            UUID keyId = toUUID(accounts.getId(i));
            UInt128 userData128 = accounts.getUserData128(i);

            byte keyTypeCode = (byte) (userData128.getLeastSignificant() >> 120);
            byte status = (byte) (userData128.getLeastSignificant() & 0xFF);
            UUID currentTenantId = extractTenantId(userData128);

            if (currentTenantId.equals(tenantId) &&
                    keyTypeCode == (keyType == KEY_TYPE.SIGNING ? 1 : 2) &&
                    status == 1) {
                long createdAtMs = (userData128.getLeastSignificant() >> 8) & 0xFFFFFFFF;
                return new KeyRotationCandidate(keyId, tenantId, keyType, createdAtMs);
            }
        }

        return null;
    }

    private record KeyRotationCandidate(
            UUID keyId,
            UUID tenantId,
            KEY_TYPE keyType,
            long createdAtMs
    ) {
        public long ageDays() {
            return ChronoUnit.DAYS.between(
                    Instant.ofEpochMilli(createdAtMs),
                    Instant.now()
            );
        }
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Rotation events stored as transfers (code=8), key status updates via account metadata
**ADR-013 (Camel-First):** Not Camel-based (scheduler exception to ADR-013 for background jobs)
**ADR-014 (Named Processors):** Service injected into processors that need rotation triggers
**ADR-015 (Tiered Storage):** Rotation events in TigerBeetle → DuckDB → Parquet for audit

## Configuration

```properties
# application.properties
fluo.kms.rotation.enabled=true
fluo.kms.rotation.age-days=90
fluo.kms.rotation.batch-size=100
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testFindKeysForRotation_OldKeys - verify keys older than 90 days returned
- testFindKeysForRotation_NewKeys - verify keys newer than 90 days excluded
- testFindKeysForRotation_RotatedKeys - verify status=2 keys excluded
- testRotateKey - verify full rotation workflow (generate, mark, record, invalidate)
- testMarkKeyAsRotated - verify status updated to 2
- testRecordRotationEvent - verify TigerBeetle transfer created
- testRotateKeyManually - verify manual trigger works
- testSchedulerDisabled - verify rotation skipped when disabled
- testRotationFailure - verify error handling and logging
- testBatchRotation - verify multiple keys rotated in sequence

**Integration Tests:**
- testEndToEndRotation - create key, wait 90 days (simulated), verify rotation
- testCacheInvalidation - verify KeyCache invalidated after rotation
- testMultiTenantRotation - verify tenant isolation in rotation
- testRotationAuditTrail - verify TigerBeetle transfer recorded

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Rotation failure leaving tenant without valid key - mitigate with transactional rotation (generate before marking old)
- Scheduler downtime causing missed rotations - mitigate with catch-up logic on startup
- Unauthorized manual rotation - mitigate with RBAC on manual rotation API
- Key compromise during rotation window - mitigate with immediate cache invalidation
- Audit trail tampering - mitigate with TigerBeetle WORM semantics

**Compliance:**
- SOC2 CC6.7 (Encryption) - automated rotation meets key lifecycle requirements
- NIST 800-53 SC-12 (Key Management) - 90-day rotation aligns with NIST guidelines
- PCI-DSS 3.6.4 (Key Rotation) - cryptoperiod enforcement

## Success Criteria

- [ ] Scheduler runs daily at 2 AM UTC
- [ ] Keys older than 90 days automatically rotated
- [ ] Old keys marked as rotated (status=2) in TigerBeetle
- [ ] Rotation events recorded with audit trail
- [ ] KeyCache invalidated after rotation
- [ ] Manual rotation API functional
- [ ] All tests pass with 90% coverage
