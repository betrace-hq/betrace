# PRD-022: Backup and Recovery

**Priority:** P1 (Infrastructure - Production Readiness)
**Complexity:** Complex (System)
**Type:** System Overview
**Personas:** DevOps, SRE, Compliance
**Dependencies:**
- PRD-002 (TigerBeetle Persistence)
- PRD-006 (KMS Integration)
- ADR-011 (TigerBeetle-First)
- ADR-015 (Tiered Storage)

## Architecture Integration

This PRD complies with BeTrace's architectural standards:

- **ADR-011 (TigerBeetle-First):** Backup TigerBeetle data files and transaction logs
- **ADR-013 (Camel-First):** Backup jobs implemented as Camel routes with processors
- **ADR-014 (Named Processors):** All backup logic in named CDI processors
- **ADR-015 (Tiered Storage):** Backup all tiers: TigerBeetle, DuckDB, Parquet archives

## Problem

**No backup and recovery strategy for BeTrace data:**
- TigerBeetle data files not backed up (immutable audit trail at risk)
- DuckDB hot tier not backed up (7 days of queryable data at risk)
- Parquet cold tier not backed up (365 days of historical data at risk)
- KMS keys not backed up (tenant signing/encryption keys at risk)
- No point-in-time recovery capability
- No disaster recovery procedures
- No backup verification or testing
- Compliance gap: SOC2 CC9.1 requires backup/recovery procedures

**Current State:**
- Data stored locally with no redundancy
- TigerBeetle WORM semantics protect against mutation but not loss
- No automated backup jobs
- No recovery runbooks
- No backup retention policies

**Impact:**
- Data loss risk from hardware failure, accidental deletion
- Cannot recover from catastrophic failures
- Compliance audit failures (SOC2 CC9.1, CC5.1)
- Multi-hour recovery time objectives (RTO)
- Potential data loss measured in hours/days (RPO)

## Solution

### Backup Strategy

**Three-Tier Backup Architecture:**

1. **TigerBeetle Backups** (Immutable Audit Trail)
   - Snapshot TigerBeetle data files every 6 hours
   - Incremental transaction log backups every 15 minutes
   - Retain 30 days locally, 365 days in S3 Glacier

2. **DuckDB Backups** (Hot Tier - 0-7 days)
   - Full database export to Parquet every 24 hours
   - Incremental exports every 6 hours
   - Retain 7 days locally, 90 days in S3

3. **Parquet Archive Backups** (Cold Tier - 7-365 days)
   - Replicate Parquet files to S3 Standard-IA
   - Verify checksums on replication
   - Retain 365 days minimum for compliance

4. **KMS Key Backups** (Cryptographic Material)
   - Export encrypted key material to AWS KMS backup vault
   - Multi-region replication for disaster recovery
   - Immutable backup vault (cannot be deleted)

### Recovery Strategy

**Recovery Time Objectives (RTO):**
- TigerBeetle: 30 minutes (restore from snapshot + replay logs)
- DuckDB: 15 minutes (restore from Parquet export)
- Parquet: 5 minutes (download from S3)
- KMS: 10 minutes (restore from backup vault)
- **Total System RTO: 1 hour**

**Recovery Point Objectives (RPO):**
- TigerBeetle: 15 minutes (incremental log backups)
- DuckDB: 6 hours (incremental exports)
- Parquet: 24 hours (daily sync)
- KMS: 0 minutes (AWS KMS automatic replication)
- **Total System RPO: 15 minutes** (TigerBeetle is source of truth)

## Unit PRD References

✅ **DECOMPOSED** - This system has been decomposed into unit PRDs:

| PRD | Unit | Purpose | File | Lines |
|-----|------|---------|------|-------|
| [022a](./022a-tigerbeetle-backup-processor.md) | TigerBeetleBackupProcessor | Snapshot TigerBeetle data files | `SnapshotTigerBeetleDataProcessor.java` | ~350 |
| [022b](./022b-duckdb-backup-processor.md) | DuckDBBackupProcessor | Export DuckDB to Parquet | `ExportDuckDBToParquetProcessor.java` | ~300 |
| [022c](./022c-parquet-replication-processor.md) | ParquetReplicationProcessor | Replicate Parquet to S3 | `ReplicateParquetFileProcessor.java` | ~300 |
| [022d](./022d-kms-key-backup-processor.md) | KMSKeyBackupProcessor | Backup tenant keys to KMS vault | `ExportEncryptedKeyMaterialProcessor.java` | ~350 |
| [022e](./022e-backup-scheduler.md) | BackupScheduler | Schedule all backup jobs | `CheckScheduledBackupsProcessor.java` | ~250 |
| [022f](./022f-recovery-service.md) | RecoveryService | Restore from backups | `RestoreTigerBeetleSnapshotProcessor.java` | ~400 |
| [022g](./022g-backup-verification-service.md) | BackupVerificationService | Verify backup integrity | `VerifyTigerBeetleBackupsProcessor.java` | ~300 |
| [022h](./022h-backup-monitoring-ui.md) | BackupMonitoringUI | Dashboard for backup status | `backup-dashboard.tsx` | ~350 |

**Total:** 8 unit PRDs, ~2,600 lines

## Backup Architecture

### TigerBeetle Backup Flow

```
[TigerBeetle Data Files]
  ↓ (every 6 hours)
[SnapshotTigerBeetleDataProcessor] → Create snapshot
  ↓
[CompressSnapshotProcessor] → gzip compression
  ↓
[EncryptSnapshotProcessor] → AES-256-GCM encryption
  ↓
[UploadToS3Processor] → S3 bucket: betrace-backups/tigerbeetle/
  ↓
[RecordBackupEventProcessor] → TigerBeetle transfer (code=12)

[TigerBeetle Transaction Logs]
  ↓ (every 15 minutes)
[BackupIncrementalLogsProcessor] → Copy new log entries
  ↓
[UploadToS3Processor] → S3 bucket: betrace-backups/tigerbeetle-logs/
```

### DuckDB Backup Flow

```
[DuckDB Hot Tier]
  ↓ (every 24 hours)
[ExportDuckDBToParquetProcessor] → COPY TO parquet
  ↓
[CompressParquetProcessor] → Parquet already compressed
  ↓
[UploadToS3Processor] → S3 bucket: betrace-backups/duckdb/
  ↓
[RecordBackupEventProcessor] → TigerBeetle transfer (code=12)

[DuckDB Incremental Changes]
  ↓ (every 6 hours)
[ExportIncrementalChangesProcessor] → Export changed rows only
  ↓
[UploadToS3Processor] → S3 bucket: betrace-backups/duckdb-incremental/
```

### KMS Key Backup Flow

```
[Tenant KMS Keys]
  ↓ (on key generation)
[ExportEncryptedKeyMaterialProcessor] → Export from AWS KMS
  ↓
[StoreInKMSBackupVaultProcessor] → AWS KMS Backup Vault
  ↓
[ReplicateToSecondaryRegionProcessor] → Multi-region replication
  ↓
[RecordBackupEventProcessor] → TigerBeetle transfer (code=12)
```

## Recovery Procedures

### Full System Recovery

**Scenario:** Complete data center failure, need to rebuild from backups

**Procedure:**
1. Provision new infrastructure (TigerBeetle, DuckDB)
2. Restore KMS keys from backup vault (10 minutes)
3. Restore TigerBeetle from latest snapshot (15 minutes)
4. Replay TigerBeetle transaction logs since snapshot (15 minutes)
5. Restore DuckDB from latest Parquet export (10 minutes)
6. Replay DuckDB incremental changes (5 minutes)
7. Restore Parquet archives from S3 (5 minutes)
8. Verify data integrity and signatures (5 minutes)
9. Resume normal operations

**Total Time: 65 minutes (within 1 hour RTO)**

### Point-in-Time Recovery

**Scenario:** Need to restore system to specific point in time (e.g., before data corruption)

**Procedure:**
1. Identify target timestamp for recovery
2. Restore TigerBeetle snapshot from before target time
3. Replay transaction logs up to target timestamp (stop before corruption)
4. Rebuild DuckDB from TigerBeetle data
5. Verify recovered state matches target timestamp
6. Resume operations from recovered state

### Tenant-Specific Recovery

**Scenario:** Single tenant requests data recovery (accidental deletion)

**Procedure:**
1. Identify tenant ID and recovery timestamp
2. Query TigerBeetle backups for tenant's ledger
3. Restore tenant's transfers from backup
4. Verify tenant signatures with their public key
5. Re-import tenant data into production system
6. Notify tenant of recovery completion

## TigerBeetle Backup Schema

**Backup Event Transfer (code=12):**
```java
Transfer backupEvent = new Transfer(
    id: UUID (backup event ID),
    debitAccountId: systemAccount,       // BeTrace system account
    creditAccountId: tenantAccount,      // Tenant being backed up (or all tenants)
    amount: backupSizeBytes,             // Size of backup in bytes
    code: 12,  // Backup event type
    userData128: pack(
        backup_type: 8 bits (1=tigerbeetle, 2=duckdb, 3=parquet, 4=kms),
        backup_scope: 8 bits (1=full, 2=incremental),
        compression: 8 bits (1=none, 2=gzip, 3=zstd),
        encryption: 8 bits (1=none, 2=aes256),
        status: 8 bits (1=started, 2=completed, 3=failed),
        retention_days: 16 bits,
        reserved: 80 bits
    ),
    userData64: timestamp,
    ledger: 0  // System ledger (cross-tenant backups)
);
```

**Backup Metadata Storage:**
```sql
-- DuckDB: Backup metadata table
CREATE TABLE backup_metadata (
    id UUID PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL,  -- tigerbeetle, duckdb, parquet, kms
    backup_scope VARCHAR(50) NOT NULL, -- full, incremental
    tenant_id UUID,  -- NULL for system-wide backups
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status VARCHAR(50) NOT NULL,  -- started, completed, failed
    backup_size_bytes BIGINT,
    backup_location TEXT,  -- S3 URI
    checksum VARCHAR(64),  -- SHA-256 checksum
    compression VARCHAR(50),
    encryption VARCHAR(50),
    retention_until DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_backup_metadata_type ON backup_metadata(backup_type);
CREATE INDEX idx_backup_metadata_tenant ON backup_metadata(tenant_id);
CREATE INDEX idx_backup_metadata_status ON backup_metadata(status);
```

## Backup Retention Policies

**TigerBeetle (Audit Trail):**
- Local: 30 days (fast recovery)
- S3 Standard: 90 days
- S3 Glacier: 365 days (compliance)
- After 365 days: Deep Archive for 7 years (legal hold)

**DuckDB (Hot Tier):**
- Local: 7 days
- S3 Standard: 90 days
- After 90 days: Delete (data already in Parquet tier)

**Parquet (Cold Tier):**
- S3 Standard-IA: 365 days (compliance)
- After 365 days: Glacier Flexible Retrieval for 7 years

**KMS Keys:**
- KMS Backup Vault: Indefinite (keys needed for signature verification)
- Multi-region replication: Active-active

## Success Criteria

**Functional Requirements:**
- [ ] Automated TigerBeetle snapshots every 6 hours
- [ ] Automated TigerBeetle log backups every 15 minutes
- [ ] Automated DuckDB exports every 24 hours
- [ ] Automated Parquet replication to S3
- [ ] Automated KMS key backups
- [ ] Full system recovery procedure tested monthly
- [ ] Point-in-time recovery capability
- [ ] Tenant-specific recovery capability

**Performance Requirements:**
- [ ] Backup operations <5% CPU overhead
- [ ] Recovery Time Objective (RTO): <1 hour
- [ ] Recovery Point Objective (RPO): <15 minutes
- [ ] Backup verification completed within 24 hours

**Compliance Requirements:**
- [ ] SOC2 CC9.1 (Risk Mitigation - Backup) evidence
- [ ] SOC2 CC5.1 (COSO Principle 5 - Control Activities) evidence
- [ ] Backup audit trail in TigerBeetle (immutable)
- [ ] Encryption at rest (AES-256-GCM)
- [ ] Retention policies enforced automatically

**Testing Requirements:**
- [ ] Unit tests for all processors (90% coverage per ADR-014)
- [ ] Integration tests for backup/restore workflows
- [ ] Disaster recovery drill every 90 days
- [ ] Backup integrity verification automated

## Integration with Existing PRDs

**PRD-002 (TigerBeetle):**
- Backup TigerBeetle data files and transaction logs
- Record backup events as TigerBeetle transfers (code=12)

**PRD-006 (KMS):**
- Backup tenant signing and encryption keys
- Store encrypted key material in KMS backup vault

**ADR-015 (Tiered Storage):**
- Backup all three tiers: TigerBeetle, DuckDB, Parquet
- Coordinate retention policies across tiers

## Compliance Benefits

**SOC2 CC9.1 (Risk Mitigation - Backup and Recovery):**
- Evidence: Automated backup jobs run every 6/15 min/24 hours
- Evidence: Backup events recorded in TigerBeetle audit trail
- Evidence: Recovery procedures tested quarterly
- Evidence: RTO/RPO metrics tracked and met

**SOC2 CC5.1 (COSO Principle 5 - Control Activities):**
- Evidence: Backup policies enforced automatically
- Evidence: Backup verification runs daily
- Evidence: Retention policies prevent premature deletion

**Audit Trail:**
- Which backup ran (backup_type in transfer)
- When backup ran (timestamp in transfer)
- What was backed up (backup_size_bytes in amount)
- Where backup stored (backup_location in metadata table)
- Backup integrity (checksum in metadata table)

## Security Considerations

**Threats & Mitigations:**
- **Backup theft** - mitigate with AES-256-GCM encryption at rest
- **Backup tampering** - mitigate with SHA-256 checksums, immutable S3 buckets
- **Backup deletion** - mitigate with KMS backup vault (cannot be deleted)
- **Key loss** - mitigate with multi-region KMS replication
- **Ransomware** - mitigate with immutable backups, offline copies

**Encryption:**
- Backups encrypted with tenant-specific KMS keys
- S3 server-side encryption (SSE-KMS)
- TLS 1.3 for data in transit

## Disaster Recovery Scenarios

**Scenario 1: Single Server Failure**
- Detection: Health check failure
- Response: Failover to standby server
- Recovery: Restore from local backups (15 minutes)
- Impact: No data loss (RPO=0)

**Scenario 2: Data Center Failure**
- Detection: Complete region outage
- Response: Failover to secondary region
- Recovery: Restore from S3 backups (1 hour)
- Impact: 15 minutes data loss (RPO=15 minutes)

**Scenario 3: Ransomware Attack**
- Detection: Encryption detected in TigerBeetle
- Response: Isolate affected systems
- Recovery: Restore from immutable backups before attack
- Impact: Varies based on detection time

**Scenario 4: Accidental Tenant Deletion**
- Detection: Tenant reports missing data
- Response: Identify deletion timestamp
- Recovery: Point-in-time restore for tenant
- Impact: No data loss (restore from backup)

## Implementation Status

✅ **DECOMPOSED** - This PRD has been fully decomposed into 8 unit PRDs (022a-022h). See [Unit PRD References](#unit-prd-references) section for complete breakdown.

**Files Created:**
- `docs/prds/022a-tigerbeetle-backup-processor.md` - TigerBeetle snapshot and log backups
- `docs/prds/022b-duckdb-backup-processor.md` - DuckDB Parquet exports
- `docs/prds/022c-parquet-replication-processor.md` - Parquet cold tier replication to S3
- `docs/prds/022d-kms-key-backup-processor.md` - KMS key backup to AWS Backup vault
- `docs/prds/022e-backup-scheduler.md` - Backup job scheduling and coordination
- `docs/prds/022f-recovery-service.md` - Full system and point-in-time recovery
- `docs/prds/022g-backup-verification-service.md` - Automated backup verification
- `docs/prds/022h-backup-monitoring-ui.md` - React backup monitoring dashboard
