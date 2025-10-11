# PRD-022d: KMS Key Backup Processor

**Parent:** [PRD-022: Backup and Recovery](./022-backup-recovery.md)
**Unit:** KMSKeyBackupProcessor
**Complexity:** Medium
**Est. Lines:** ~350
**Dependencies:** PRD-006 (KMS Integration)

## Purpose

Backup tenant signing and encryption keys to AWS KMS backup vault with multi-region replication to ensure cryptographic material recovery in disaster scenarios.

## Architecture Integration

- **ADR-011 (TigerBeetle-First):** Backup events recorded as TigerBeetle transfers (code=12)
- **ADR-013 (Camel-First):** Backup jobs implemented as Camel route processors
- **ADR-014 (Named Processors):** All backup logic in named CDI processors
- **PRD-006 (KMS):** Backup Ed25519 signing keys and AES-256 encryption keys

## Implementation

### KMS Key Backup Route (Apache Camel)

```java
package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class KMSKeyBackupRoute extends RouteBuilder {
    @Override
    public void configure() throws Exception {
        // Backup keys immediately on creation
        from("direct:backup-kms-key")
            .routeId("kms-key-backup-route")
            .process("exportEncryptedKeyMaterialProcessor")
            .process("storeInKMSBackupVaultProcessor")
            .process("replicateToSecondaryRegionProcessor")
            .process("recordKMSKeyBackupEventProcessor");

        // Verify all keys backed up (scheduled every 24 hours)
        from("timer:verify-key-backups?period=86400000") // 24 hours
            .routeId("verify-key-backups-route")
            .to("direct:verify-all-key-backups");

        from("direct:verify-all-key-backups")
            .process("loadAllTenantsProcessor")
            .split(body())
                .process("verifyTenantKeyBackupsProcessor")
            .end();
    }
}
```

### Export Encrypted Key Material Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.kms.KmsClient;
import software.amazon.awssdk.services.kms.model.*;
import java.util.UUID;
import java.time.Instant;

@Named("exportEncryptedKeyMaterialProcessor")
@ApplicationScoped
public class ExportEncryptedKeyMaterialProcessor implements Processor {

    @Inject
    KmsClient kmsClient;

    @Inject
    KMSService kmsService;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getProperty("tenantId", UUID.class);
        String keyType = exchange.getProperty("keyType", String.class); // "signing" or "encryption"
        UUID backupId = UUID.randomUUID();
        Instant startTime = Instant.now();

        try {
            // Get KMS key ID for tenant
            String keyId = kmsService.getKeyId(tenantId, keyType);

            // Export key material (encrypted under wrapping key)
            GetParametersForImportRequest importRequest = GetParametersForImportRequest.builder()
                .keyId(keyId)
                .wrappingAlgorithm(AlgorithmSpec.RSA_AES_KEY_WRAP_SHA_256)
                .wrappingKeySpec(WrappingKeySpec.RSA_2048)
                .build();

            GetParametersForImportResponse importResponse =
                kmsClient.getParametersForImport(importRequest);

            // Get encrypted key material via DescribeKey
            DescribeKeyRequest describeRequest = DescribeKeyRequest.builder()
                .keyId(keyId)
                .build();

            DescribeKeyResponse describeResponse = kmsClient.describeKey(describeRequest);
            KeyMetadata keyMetadata = describeResponse.keyMetadata();

            // Set exchange properties for next processors
            exchange.setProperty("backupId", backupId);
            exchange.setProperty("keyId", keyId);
            exchange.setProperty("keyArn", keyMetadata.arn());
            exchange.setProperty("keyType", keyType);
            exchange.setProperty("keyMetadata", keyMetadata);
            exchange.setProperty("wrappingPublicKey", importResponse.publicKey());
            exchange.setProperty("importToken", importResponse.importToken());
            exchange.setProperty("startTime", startTime);
            exchange.setProperty("status", "exported");

        } catch (Exception e) {
            exchange.setProperty("status", "failed");
            exchange.setProperty("errorMessage", e.getMessage());
            throw e;
        }
    }
}
```

### Store in KMS Backup Vault Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.backup.BackupClient;
import software.amazon.awssdk.services.backup.model.*;
import software.amazon.awssdk.services.kms.model.KeyMetadata;
import java.util.*;

@Named("storeInKMSBackupVaultProcessor")
@ApplicationScoped
public class StoreInKMSBackupVaultProcessor implements Processor {

    @Inject
    BackupClient backupClient;

    private static final String BACKUP_VAULT_NAME = "fluo-kms-backup-vault";

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID backupId = exchange.getProperty("backupId", UUID.class);
        UUID tenantId = exchange.getProperty("tenantId", UUID.class);
        String keyArn = exchange.getProperty("keyArn", String.class);
        String keyType = exchange.getProperty("keyType", String.class);
        KeyMetadata keyMetadata = exchange.getProperty("keyMetadata", KeyMetadata.class);

        try {
            // Create backup job for KMS key
            StartBackupJobRequest backupRequest = StartBackupJobRequest.builder()
                .backupVaultName(BACKUP_VAULT_NAME)
                .resourceArn(keyArn)
                .iamRoleArn("arn:aws:iam::ACCOUNT_ID:role/FLUOBackupRole")
                .idempotencyToken(backupId.toString())
                .lifecycle(Lifecycle.builder()
                    .deleteAfterDays(null) // Never delete (indefinite retention)
                    .build())
                .recoveryPointTags(Map.of(
                    "tenant-id", tenantId.toString(),
                    "key-type", keyType,
                    "backup-id", backupId.toString()
                ))
                .build();

            StartBackupJobResponse backupResponse = backupClient.startBackupJob(backupRequest);

            String backupJobId = backupResponse.backupJobId();
            String recoveryPointArn = backupResponse.recoveryPointArn();

            // Wait for backup completion (poll every 5 seconds, timeout 60 seconds)
            boolean backupCompleted = waitForBackupCompletion(backupJobId);

            if (!backupCompleted) {
                throw new RuntimeException("Backup job did not complete within timeout");
            }

            // Set exchange properties
            exchange.setProperty("backupJobId", backupJobId);
            exchange.setProperty("recoveryPointArn", recoveryPointArn);
            exchange.setProperty("backupVaultName", BACKUP_VAULT_NAME);
            exchange.setProperty("status", "backed_up");

        } catch (Exception e) {
            exchange.setProperty("status", "failed");
            exchange.setProperty("errorMessage", e.getMessage());
            throw e;
        }
    }

    private boolean waitForBackupCompletion(String backupJobId) throws InterruptedException {
        for (int i = 0; i < 12; i++) { // 12 attempts * 5 seconds = 60 seconds
            DescribeBackupJobRequest describeRequest = DescribeBackupJobRequest.builder()
                .backupJobId(backupJobId)
                .build();

            DescribeBackupJobResponse describeResponse = backupClient.describeBackupJob(describeRequest);
            BackupJobState state = describeResponse.state();

            if (state == BackupJobState.COMPLETED) {
                return true;
            } else if (state == BackupJobState.FAILED || state == BackupJobState.ABORTED) {
                throw new RuntimeException("Backup job failed: " + describeResponse.statusMessage());
            }

            Thread.sleep(5000); // Wait 5 seconds
        }
        return false;
    }
}
```

### Replicate to Secondary Region Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.backup.BackupClient;
import software.amazon.awssdk.services.backup.model.*;
import java.util.*;

@Named("replicateToSecondaryRegionProcessor")
@ApplicationScoped
public class ReplicateToSecondaryRegionProcessor implements Processor {

    @Inject
    BackupClient backupClient;

    private static final String SECONDARY_REGION = "us-west-2"; // Primary: us-east-1

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID backupId = exchange.getProperty("backupId", UUID.class);
        String recoveryPointArn = exchange.getProperty("recoveryPointArn", String.class);
        String backupVaultName = exchange.getProperty("backupVaultName", String.class);

        try {
            // Start copy job to replicate to secondary region
            StartCopyJobRequest copyRequest = StartCopyJobRequest.builder()
                .recoveryPointArn(recoveryPointArn)
                .sourceBackupVaultName(backupVaultName)
                .destinationBackupVaultArn(
                    String.format("arn:aws:backup:%s:ACCOUNT_ID:backup-vault/%s",
                        SECONDARY_REGION, backupVaultName)
                )
                .iamRoleArn("arn:aws:iam::ACCOUNT_ID:role/FLUOBackupRole")
                .idempotencyToken(backupId.toString() + "-copy")
                .lifecycle(Lifecycle.builder()
                    .deleteAfterDays(null) // Indefinite retention
                    .build())
                .build();

            StartCopyJobResponse copyResponse = backupClient.startCopyJob(copyRequest);

            String copyJobId = copyResponse.copyJobId();

            // Wait for replication completion
            boolean replicationCompleted = waitForReplicationCompletion(copyJobId);

            if (!replicationCompleted) {
                throw new RuntimeException("Replication job did not complete within timeout");
            }

            // Set exchange properties
            exchange.setProperty("copyJobId", copyJobId);
            exchange.setProperty("secondaryRegion", SECONDARY_REGION);
            exchange.setProperty("status", "replicated");

        } catch (Exception e) {
            exchange.setProperty("status", "failed");
            exchange.setProperty("errorMessage", e.getMessage());
            throw e;
        }
    }

    private boolean waitForReplicationCompletion(String copyJobId) throws InterruptedException {
        for (int i = 0; i < 24; i++) { // 24 attempts * 5 seconds = 120 seconds
            DescribeCopyJobRequest describeRequest = DescribeCopyJobRequest.builder()
                .copyJobId(copyJobId)
                .build();

            DescribeCopyJobResponse describeResponse = backupClient.describeCopyJob(describeRequest);
            CopyJobState state = describeResponse.state();

            if (state == CopyJobState.COMPLETED) {
                return true;
            } else if (state == CopyJobState.FAILED || state == CopyJobState.DELETED) {
                throw new RuntimeException("Replication failed: " + describeResponse.statusMessage());
            }

            Thread.sleep(5000); // Wait 5 seconds
        }
        return false;
    }
}
```

### Record KMS Key Backup Event Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.tigerbeetle.Transfer;
import java.util.*;
import java.time.Instant;

@Named("recordKMSKeyBackupEventProcessor")
@ApplicationScoped
public class RecordKMSKeyBackupEventProcessor implements Processor {

    @Inject
    TigerBeetleService tigerBeetleService;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final int CODE_BACKUP = 12;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID backupId = exchange.getProperty("backupId", UUID.class);
        UUID tenantId = exchange.getProperty("tenantId", UUID.class);
        String keyId = exchange.getProperty("keyId", String.class);
        String keyType = exchange.getProperty("keyType", String.class);
        String recoveryPointArn = exchange.getProperty("recoveryPointArn", String.class);
        String backupJobId = exchange.getProperty("backupJobId", String.class);
        String copyJobId = exchange.getProperty("copyJobId", String.class);
        String secondaryRegion = exchange.getProperty("secondaryRegion", String.class);
        Instant startTime = exchange.getProperty("startTime", Instant.class);
        String status = exchange.getProperty("status", String.class);

        // Create TigerBeetle transfer (code=12)
        UUID systemAccountId = UUID.fromString("00000000-0000-0000-0000-000000000000");
        UUID tenantAccountId = tigerBeetleService.getTenantAccountId(tenantId);

        long userData128 = packBackupMetadata(
            4, // kms
            1, // full (keys are always full backups)
            1, // no compression
            2, // encrypted (AWS KMS native encryption)
            statusToInt(status),
            0 // indefinite retention (keys never expire)
        );

        Transfer backupEvent = new Transfer(
            backupId,
            systemAccountId,
            tenantAccountId, // Credit tenant account (tenant-specific key backup)
            1, // Amount = 1 (key backup count)
            CODE_BACKUP,
            userData128,
            startTime.getEpochSecond(),
            tigerBeetleService.tenantToLedgerId(tenantId)
        );

        tigerBeetleService.createTransfers(List.of(backupEvent));

        // Store backup metadata in DuckDB
        String backupLocation = String.format("%s (replicated to %s)",
            recoveryPointArn, secondaryRegion);

        backupMetadataService.recordBackup(
            backupId, "kms", "full", tenantId,
            startTime, Instant.now(), status, 0, // Size = 0 (managed by KMS)
            backupLocation, null, "none", "kms-native",
            null // No expiration for key backups
        );

        // Also record in separate KMS backup table for key-specific tracking
        recordKMSKeyBackup(tenantId, keyId, keyType, backupJobId, copyJobId,
            recoveryPointArn, secondaryRegion);

        exchange.setProperty("backupEventId", backupId);
    }

    private void recordKMSKeyBackup(UUID tenantId, String keyId, String keyType,
                                     String backupJobId, String copyJobId,
                                     String recoveryPointArn, String secondaryRegion)
            throws SQLException {
        String sql = """
            INSERT INTO kms_key_backups (
                tenant_id, key_id, key_type, backup_job_id, copy_job_id,
                recovery_point_arn, secondary_region, backed_up_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            """;
        // SQL execution omitted for brevity
    }

    private long packBackupMetadata(int backupType, int backupScope,
                                     int compression, int encryption,
                                     int status, int retentionDays) {
        long userData128 = 0L;
        userData128 |= ((long) backupType & 0xFF) << 120;
        userData128 |= ((long) backupScope & 0xFF) << 112;
        userData128 |= ((long) compression & 0xFF) << 104;
        userData128 |= ((long) encryption & 0xFF) << 96;
        userData128 |= ((long) status & 0xFF) << 88;
        userData128 |= ((long) retentionDays & 0xFFFF) << 72;
        return userData128;
    }

    private int statusToInt(String status) {
        return switch (status) {
            case "started", "exported", "backed_up" -> 1;
            case "replicated", "completed" -> 2;
            case "failed" -> 3;
            default -> 1;
        };
    }
}
```

### Verify Tenant Key Backups Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.backup.BackupClient;
import software.amazon.awssdk.services.backup.model.*;
import java.util.*;

@Named("verifyTenantKeyBackupsProcessor")
@ApplicationScoped
public class VerifyTenantKeyBackupsProcessor implements Processor {

    @Inject
    BackupClient backupClient;

    @Inject
    KMSService kmsService;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final String BACKUP_VAULT_NAME = "fluo-kms-backup-vault";

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getProperty("tenantId", UUID.class);

        // Get tenant's KMS keys
        String signingKeyId = kmsService.getKeyId(tenantId, "signing");
        String encryptionKeyId = kmsService.getKeyId(tenantId, "encryption");

        // Verify signing key backup exists
        boolean signingKeyBackedUp = verifyKeyBackup(tenantId, signingKeyId);
        if (!signingKeyBackedUp) {
            // Trigger backup
            exchange.setProperty("keyType", "signing");
            exchange.setProperty("tenantId", tenantId);
            // Send to direct:backup-kms-key route
        }

        // Verify encryption key backup exists
        boolean encryptionKeyBackedUp = verifyKeyBackup(tenantId, encryptionKeyId);
        if (!encryptionKeyBackedUp) {
            // Trigger backup
            exchange.setProperty("keyType", "encryption");
            exchange.setProperty("tenantId", tenantId);
            // Send to direct:backup-kms-key route
        }

        exchange.setProperty("signingKeyBackedUp", signingKeyBackedUp);
        exchange.setProperty("encryptionKeyBackedUp", encryptionKeyBackedUp);
    }

    private boolean verifyKeyBackup(UUID tenantId, String keyId) throws SQLException {
        // Check if key backup exists in metadata table
        return backupMetadataService.isKMSKeyBackedUp(tenantId, keyId);
    }
}
```

## Testing Requirements

- [ ] Unit test: Export encrypted key material for signing key
- [ ] Unit test: Store key in AWS Backup vault
- [ ] Unit test: Replicate key backup to secondary region
- [ ] Unit test: TigerBeetle transfer created with code=12
- [ ] Unit test: Backup metadata recorded in DuckDB
- [ ] Integration test: Full key backup workflow (export → backup → replicate → record)
- [ ] Integration test: Verify all tenant keys backed up (scheduled verification)
- [ ] Security test: Cannot export key material without proper IAM role
- [ ] Coverage: 90% (per ADR-014)

## Security Considerations

- **Key theft** - Keys never leave AWS KMS, only metadata exported
- **Unauthorized access** - IAM role policies restrict backup vault access
- **Key loss** - Multi-region replication ensures disaster recovery
- **Immutable backups** - AWS Backup vault with lock prevents deletion

## Success Criteria

- All tenant signing keys backed up to KMS backup vault
- All tenant encryption keys backed up to KMS backup vault
- Multi-region replication to secondary region (us-west-2)
- Backup events immutably recorded in TigerBeetle
- Daily verification ensures all keys are backed up
- Indefinite retention for cryptographic material

## Public Examples

### AWS KMS Multi-Region Keys
- **Multi-Region Keys in AWS KMS**: [https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-overview.html](https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-overview.html)
  - Official documentation for AWS KMS multi-region keys
  - Sets of KMS keys with same key ID and key material in different regions
  - Each multi-region key functions independently but are interoperable

- **Create Multi-Region Replica Keys**: [https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-replicate.html](https://docs.aws.amazon.com/kms/latest/developerguide/multi-region-keys-replicate.html)
  - Step-by-step guide for replicating KMS keys across regions
  - Uses ReplicateKey operation or AWS CloudFormation templates
  - Example for disaster recovery and compliance requirements

- **Encrypt Global Data with Multi-Region Keys**: [https://aws.amazon.com/blogs/security/encrypt-global-data-client-side-with-aws-kms-multi-region-keys/](https://aws.amazon.com/blogs/security/encrypt-global-data-client-side-with-aws-kms-multi-region-keys/)
  - AWS Security Blog post on client-side encryption with multi-region keys
  - Demonstrates failover scenarios and key synchronization

### AWS Backup Vault and KMS Integration
- **Backup Vaults Documentation**: [https://docs.aws.amazon.com/aws-backup/latest/devguide/vaults.html](https://docs.aws.amazon.com/aws-backup/latest/devguide/vaults.html)
  - Creating backup vaults with KMS encryption keys
  - Vault locking to prevent deletion of backups
  - Cross-account and cross-region backup policies

- **Automating Cross-Account/Cross-Region Backups** (2024): [https://www.tecracer.com/blog/2024/04/automating-cross-account-/-cross-region-backups-with-aws-backup-in-aws-organizations.html](https://www.tecracer.com/blog/2024/04/automating-cross-account-/-cross-region-backups-with-aws-backup-in-aws-organizations.html)
  - AWS Backup in Organizations context with cross-region replication
  - IAM roles and resource-based policies for backup vaults
  - Resource policies for AWS KMS encryption keys

- **Back Up Database with KMS Encryption**: [https://aws.amazon.com/blogs/architecture/field-notes-how-to-back-up-a-database-with-kms-encryption-using-aws-backup/](https://aws.amazon.com/blogs/architecture/field-notes-how-to-back-up-a-database-with-kms-encryption-using-aws-backup/)
  - Field Notes article demonstrating KMS-encrypted backups
  - AWS Backup with KMS customer-managed keys
  - Cross-region replication with re-encryption

### AWS Backup API Documentation
- **StartBackupJob API**: [https://docs.aws.amazon.com/aws-backup/latest/devguide/API_StartBackupJob.html](https://docs.aws.amazon.com/aws-backup/latest/devguide/API_StartBackupJob.html)
  - Official API documentation for starting backup jobs
  - Request parameters: BackupVaultName, ResourceArn, IamRoleArn, Lifecycle
  - Idempotency token for preventing duplicate backups

- **StartCopyJob API**: [https://docs.aws.amazon.com/aws-backup/latest/devguide/API_StartCopyJob.html](https://docs.aws.amazon.com/aws-backup/latest/devguide/API_StartCopyJob.html)
  - Copy backups to multiple regions on demand or scheduled
  - Re-encryption with destination vault's customer-managed key
  - Example for multi-region disaster recovery

- **DescribeBackupJob API**: [https://docs.aws.amazon.com/aws-backup/latest/devguide/API_DescribeBackupJob.html](https://docs.aws.amazon.com/aws-backup/latest/devguide/API_DescribeBackupJob.html)
  - Polling backup job status (CREATED, RUNNING, COMPLETED, FAILED)
  - Similar to polling pattern in StoreInKMSBackupVaultProcessor

### AWS SDK for Java Examples
- **AWS SDK for Java V2**: [https://github.com/aws/aws-sdk-java-v2](https://github.com/aws/aws-sdk-java-v2)
  - Official AWS SDK for Java - Version 2
  - Backup client in software.amazon.awssdk.services.backup package
  - Latest version: 2.35.4+

- **AWS Doc SDK Examples**: [https://github.com/awsdocs/aws-doc-sdk-examples](https://github.com/awsdocs/aws-doc-sdk-examples)
  - Official AWS code examples repository
  - Java V2 examples in javav2/ folder
  - No AWS Backup-specific examples currently, but similar patterns for other services

### Cross-Region Backup Best Practices
- **Creating Backup Copies Across Regions**: [https://docs.aws.amazon.com/aws-backup/latest/devguide/cross-region-backup.html](https://docs.aws.amazon.com/aws-backup/latest/devguide/cross-region-backup.html)
  - Cross-region replication for business continuity and compliance
  - Automatic or on-demand backup copies
  - Encryption key considerations for cross-region copies

- **Create Encrypted Backups Across Accounts**: [https://aws.amazon.com/blogs/storage/create-and-share-encrypted-backups-across-accounts-and-regions-using-aws-backup/](https://aws.amazon.com/blogs/storage/create-and-share-encrypted-backups-across-accounts-and-regions-using-aws-backup/)
  - Sharing encrypted backups across accounts and regions
  - KMS key policies for cross-account access
  - Demonstrates backup vault access policies
