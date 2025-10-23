# PRD-022f: Recovery Service

**Parent:** [PRD-022: Backup and Recovery](./022-backup-recovery.md)
**Unit:** RecoveryService
**Complexity:** Complex
**Est. Lines:** ~400
**Dependencies:** PRD-022a, PRD-022b, PRD-022c, PRD-022d

## Purpose

Restore BeTrace data from backups with point-in-time recovery capability, achieving 1-hour RTO and 15-minute RPO targets.

## Architecture Integration

- **ADR-011 (TigerBeetle-First):** Recovery events recorded as TigerBeetle transfers (code=12)
- **ADR-013 (Camel-First):** Recovery jobs implemented as Camel route processors
- **ADR-014 (Named Processors):** All recovery logic in named CDI processors

## Implementation

### Recovery Route (Apache Camel)

```java
package com.betrace.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class RecoveryRoute extends RouteBuilder {
    @Override
    public void configure() throws Exception {
        // Full system recovery
        from("direct:recover-full-system")
            .routeId("recover-full-system-route")
            .process("validateRecoveryRequestProcessor")
            .process("restoreKMSKeysProcessor")
            .process("restoreTigerBeetleSnapshotProcessor")
            .process("replayTigerBeetleLogsProcessor")
            .process("restoreDuckDBFromParquetProcessor")
            .process("replayDuckDBIncrementalProcessor")
            .process("restoreParquetArchivesProcessor")
            .process("verifyRecoveryIntegrityProcessor")
            .process("recordRecoveryEventProcessor");

        // Point-in-time recovery
        from("direct:recover-point-in-time")
            .routeId("recover-point-in-time-route")
            .process("validatePointInTimeRequestProcessor")
            .process("findSnapshotBeforeTimestampProcessor")
            .process("restoreTigerBeetleSnapshotProcessor")
            .process("replayLogsUntilTimestampProcessor")
            .process("rebuildDuckDBFromTigerBeetleProcessor")
            .process("recordRecoveryEventProcessor");

        // Tenant-specific recovery
        from("direct:recover-tenant")
            .routeId("recover-tenant-route")
            .process("validateTenantRecoveryRequestProcessor")
            .process("restoreTenantDataFromBackupProcessor")
            .process("verifyTenantSignaturesProcessor")
            .process("reimportTenantDataProcessor")
            .process("recordRecoveryEventProcessor");
    }
}
```

### Restore TigerBeetle Snapshot Processor

```java
package com.betrace.processors.recovery;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import java.nio.file.*;
import java.io.*;
import java.util.zip.GZIPInputStream;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import java.time.Instant;
import java.util.UUID;

@Named("restoreTigerBeetleSnapshotProcessor")
@ApplicationScoped
public class RestoreTigerBeetleSnapshotProcessor implements Processor {

    @Inject
    S3Client s3Client;

    @Inject
    KMSService kmsService;

    @Inject
    BackupMetadataService backupMetadataService;

    @ConfigProperty(name = "tigerbeetle.data.path")
    String tigerBeetleDataPath;

    private static final String BUCKET_NAME = "betrace-backups";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;

    @Override
    public void process(Exchange exchange) throws Exception {
        Instant targetTimestamp = exchange.getProperty("targetTimestamp", Instant.class);
        UUID recoveryId = UUID.randomUUID();
        Instant startTime = Instant.now();

        try {
            // Find latest snapshot before target timestamp
            UUID snapshotBackupId = targetTimestamp != null ?
                backupMetadataService.findLatestBackupBefore("tigerbeetle", "full", targetTimestamp) :
                backupMetadataService.findLatestBackup("tigerbeetle", "full");

            if (snapshotBackupId == null) {
                throw new RuntimeException("No TigerBeetle snapshot found");
            }

            // Get backup metadata
            String s3Uri = backupMetadataService.getBackupLocation(snapshotBackupId);
            String s3Key = s3Uri.replace("s3://" + BUCKET_NAME + "/", "");

            // Download encrypted snapshot from S3
            Path tempEncrypted = Files.createTempFile("tb-snapshot-", ".tar.gz.enc");
            GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .build();

            s3Client.getObject(getRequest, tempEncrypted);

            // Decrypt snapshot
            Path tempDecrypted = Files.createTempFile("tb-snapshot-", ".tar.gz");
            decryptFile(tempEncrypted, tempDecrypted);

            // Decompress snapshot
            Path tempExtracted = Files.createTempDirectory("tb-snapshot-");
            decompressTarGz(tempDecrypted, tempExtracted);

            // Stop TigerBeetle (if running)
            stopTigerBeetleService();

            // Clear existing TigerBeetle data
            Path dataPath = Paths.get(tigerBeetleDataPath);
            if (Files.exists(dataPath)) {
                deleteDirectory(dataPath);
            }
            Files.createDirectories(dataPath);

            // Copy restored files to TigerBeetle data directory
            Files.walk(tempExtracted)
                .filter(Files::isRegularFile)
                .forEach(source -> {
                    try {
                        Path destination = dataPath.resolve(tempExtracted.relativize(source));
                        Files.createDirectories(destination.getParent());
                        Files.copy(source, destination, StandardCopyOption.REPLACE_EXISTING);
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to copy file: " + source, e);
                    }
                });

            // Start TigerBeetle service
            startTigerBeetleService();

            // Cleanup temp files
            Files.delete(tempEncrypted);
            Files.delete(tempDecrypted);
            deleteDirectory(tempExtracted);

            // Set exchange properties
            exchange.setProperty("recoveryId", recoveryId);
            exchange.setProperty("snapshotBackupId", snapshotBackupId);
            exchange.setProperty("snapshotRestored", true);
            exchange.setProperty("startTime", startTime);

        } catch (Exception e) {
            exchange.setProperty("recoveryFailed", true);
            exchange.setProperty("errorMessage", e.getMessage());
            throw e;
        }
    }

    private void decryptFile(Path encrypted, Path decrypted) throws Exception {
        UUID systemTenantId = UUID.fromString("00000000-0000-0000-0000-000000000000");
        byte[] dataKey = kmsService.getDataKey(systemTenantId, "backup-encryption");

        try (InputStream fis = Files.newInputStream(encrypted);
             OutputStream fos = Files.newOutputStream(decrypted)) {

            // Read IV from file header
            byte[] iv = new byte[GCM_IV_LENGTH];
            fis.read(iv);

            // Decrypt
            SecretKeySpec keySpec = new SecretKeySpec(dataKey, "AES");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec);

            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                byte[] decryptedBytes = cipher.update(buffer, 0, bytesRead);
                if (decryptedBytes != null) {
                    fos.write(decryptedBytes);
                }
            }
            byte[] finalBytes = cipher.doFinal();
            if (finalBytes != null) {
                fos.write(finalBytes);
            }
        }
    }

    private void decompressTarGz(Path tarGz, Path outputDir) throws Exception {
        try (InputStream fis = Files.newInputStream(tarGz);
             GZIPInputStream gis = new GZIPInputStream(fis)) {
            TarArchiver.extractTarArchive(gis, outputDir);
        }
    }

    private void stopTigerBeetleService() {
        // Stop TigerBeetle process
        Runtime.getRuntime().exec("pkill tigerbeetle");
    }

    private void startTigerBeetleService() throws Exception {
        // Start TigerBeetle process
        ProcessBuilder pb = new ProcessBuilder("tigerbeetle", "start", "--addresses=3000");
        pb.directory(new File(tigerBeetleDataPath).getParentFile());
        pb.start();
        Thread.sleep(3000); // Wait for startup
    }

    private void deleteDirectory(Path directory) throws IOException {
        Files.walk(directory)
            .sorted((a, b) -> b.compareTo(a))
            .forEach(path -> {
                try {
                    Files.delete(path);
                } catch (IOException e) {
                    // Log but don't fail
                }
            });
    }
}
```

### Replay TigerBeetle Logs Processor

```java
package com.betrace.processors.recovery;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import com.tigerbeetle.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

@Named("replayTigerBeetleLogsProcessor")
@ApplicationScoped
public class ReplayTigerBeetleLogsProcessor implements Processor {

    @Inject
    S3Client s3Client;

    @Inject
    BackupMetadataService backupMetadataService;

    @Inject
    TigerBeetleService tigerBeetleService;

    private static final String BUCKET_NAME = "betrace-backups";

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID snapshotBackupId = exchange.getProperty("snapshotBackupId", UUID.class);
        Instant targetTimestamp = exchange.getProperty("targetTimestamp", Instant.class);

        // Get snapshot timestamp
        Instant snapshotTime = backupMetadataService.getBackupStartTime(snapshotBackupId);

        // Find all incremental log backups after snapshot
        List<UUID> logBackupIds = backupMetadataService.findBackupsAfter(
            "tigerbeetle", "incremental", snapshotTime, targetTimestamp
        );

        if (logBackupIds.isEmpty()) {
            exchange.setProperty("logsReplayed", 0);
            return;
        }

        int totalTransfersReplayed = 0;

        // Replay each log backup in order
        for (UUID logBackupId : logBackupIds) {
            String s3Uri = backupMetadataService.getBackupLocation(logBackupId);
            String s3Key = s3Uri.replace("s3://" + BUCKET_NAME + "/", "");

            // Download log file
            Path tempLog = Files.createTempFile("tb-log-", ".bin");
            GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .build();

            s3Client.getObject(getRequest, tempLog);

            // Parse and replay transfers
            List<Transfer> transfers = parseTransfersFromLog(tempLog);

            // Filter transfers up to target timestamp if specified
            if (targetTimestamp != null) {
                transfers = transfers.stream()
                    .filter(t -> Instant.ofEpochSecond(t.getUserData64())
                        .isBefore(targetTimestamp))
                    .toList();
            }

            // Replay transfers
            tigerBeetleService.createTransfers(transfers);
            totalTransfersReplayed += transfers.size();

            Files.delete(tempLog);
        }

        exchange.setProperty("logsReplayed", totalTransfersReplayed);
    }

    private List<Transfer> parseTransfersFromLog(Path logFile) throws Exception {
        // Parse TigerBeetle log format (implementation depends on log format)
        // This is a placeholder - actual implementation would parse binary log format
        return new ArrayList<>();
    }
}
```

### Restore DuckDB from Parquet Processor

```java
package com.betrace.processors.recovery;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import javax.sql.DataSource;
import java.sql.*;
import java.nio.file.*;
import java.util.*;

@Named("restoreDuckDBFromParquetProcessor")
@ApplicationScoped
public class RestoreDuckDBFromParquetProcessor implements Processor {

    @Inject
    S3Client s3Client;

    @Inject
    @io.quarkus.agroal.DataSource("duckdb")
    DataSource duckdbDataSource;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final String BUCKET_NAME = "betrace-backups";

    @Override
    public void process(Exchange exchange) throws Exception {
        Instant targetTimestamp = exchange.getProperty("targetTimestamp", Instant.class);

        // Find latest DuckDB full backup
        UUID duckdbBackupId = targetTimestamp != null ?
            backupMetadataService.findLatestBackupBefore("duckdb", "full", targetTimestamp) :
            backupMetadataService.findLatestBackup("duckdb", "full");

        if (duckdbBackupId == null) {
            throw new RuntimeException("No DuckDB backup found");
        }

        // Get all Parquet files from backup
        String s3Uris = backupMetadataService.getBackupLocation(duckdbBackupId);
        List<String> parquetFiles = Arrays.asList(s3Uris.split(","));

        // Download and import each Parquet file
        try (Connection conn = duckdbDataSource.getConnection()) {
            for (String s3Uri : parquetFiles) {
                String tableName = extractTableName(s3Uri);
                Path tempParquet = downloadFromS3(s3Uri);

                // Import Parquet to DuckDB
                String sql = String.format(
                    "CREATE OR REPLACE TABLE %s AS SELECT * FROM read_parquet('%s')",
                    tableName, tempParquet.toString()
                );
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute(sql);
                }

                Files.delete(tempParquet);
            }
        }

        exchange.setProperty("duckdbRestored", true);
        exchange.setProperty("tablesRestored", parquetFiles.size());
    }

    private String extractTableName(String s3Uri) {
        // Extract table name from: s3://bucket/duckdb/full/2025/10/11/{uuid}-signals.parquet
        String filename = s3Uri.substring(s3Uri.lastIndexOf('/') + 1);
        return filename.split("-", 2)[1].replace(".parquet", "");
    }

    private Path downloadFromS3(String s3Uri) throws Exception {
        String s3Key = s3Uri.replace("s3://" + BUCKET_NAME + "/", "");
        Path tempFile = Files.createTempFile("duckdb-", ".parquet");

        GetObjectRequest getRequest = GetObjectRequest.builder()
            .bucket(BUCKET_NAME)
            .key(s3Key)
            .build();

        s3Client.getObject(getRequest, tempFile);
        return tempFile;
    }
}
```

### Record Recovery Event Processor

```java
package com.betrace.processors.recovery;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.tigerbeetle.Transfer;
import java.util.*;
import java.time.Instant;

@Named("recordRecoveryEventProcessor")
@ApplicationScoped
public class RecordRecoveryEventProcessor implements Processor {

    @Inject
    TigerBeetleService tigerBeetleService;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final int CODE_BACKUP = 12;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID recoveryId = exchange.getProperty("recoveryId", UUID.class);
        String recoveryType = exchange.getProperty("recoveryType", String.class); // "full", "point-in-time", "tenant"
        Instant startTime = exchange.getProperty("startTime", Instant.class);
        Instant endTime = Instant.now();
        UUID tenantId = exchange.getProperty("tenantId", UUID.class);

        // Create TigerBeetle transfer (code=12, status=4 for recovery)
        UUID systemAccountId = UUID.fromString("00000000-0000-0000-0000-000000000000");

        long userData128 = packRecoveryMetadata(recoveryType);

        Transfer recoveryEvent = new Transfer(
            recoveryId,
            systemAccountId,
            tenantId != null ? tigerBeetleService.getTenantAccountId(tenantId) : systemAccountId,
            1, // Recovery event count
            CODE_BACKUP,
            userData128,
            startTime.getEpochSecond(),
            tenantId != null ? tigerBeetleService.tenantToLedgerId(tenantId) : 0
        );

        tigerBeetleService.createTransfers(List.of(recoveryEvent));

        // Store recovery metadata
        backupMetadataService.recordRecovery(
            recoveryId, recoveryType, tenantId,
            startTime, endTime, "completed"
        );

        exchange.setProperty("recoveryEventId", recoveryId);
    }

    private long packRecoveryMetadata(String recoveryType) {
        long userData128 = 0L;
        // Reuse backup metadata format, use status=4 for recovery
        int typeCode = switch (recoveryType) {
            case "full" -> 1;
            case "point-in-time" -> 2;
            case "tenant" -> 3;
            default -> 0;
        };
        userData128 |= ((long) typeCode & 0xFF) << 120;
        userData128 |= ((long) 4 & 0xFF) << 88; // status=4 (recovery)
        return userData128;
    }
}
```

## Testing Requirements

- [ ] Unit test: Restore TigerBeetle snapshot from S3
- [ ] Unit test: Replay transaction logs up to target timestamp
- [ ] Unit test: Restore DuckDB from Parquet files
- [ ] Unit test: Tenant-specific data recovery
- [ ] Integration test: Full system recovery workflow (RTO <1 hour)
- [ ] Integration test: Point-in-time recovery to specific timestamp
- [ ] Integration test: Recovery event recorded in TigerBeetle
- [ ] Disaster recovery drill: Monthly test of full recovery procedure
- [ ] Coverage: 90% (per ADR-014)

## Security Considerations

- **Data exposure** - Decrypt backups with KMS keys
- **Unauthorized recovery** - RBAC (admin only)
- **Partial recovery** - Verify data integrity after recovery

## Success Criteria

- Full system recovery completes in <1 hour (RTO)
- Point-in-time recovery to any 15-minute interval (RPO)
- Tenant-specific recovery without affecting other tenants
- All recovery events immutably recorded in TigerBeetle
- Monthly disaster recovery drills successful

## Public Examples

### Disaster Recovery Best Practices
- **AWS Disaster Recovery Options**: [https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)
  - Four disaster recovery strategies: Backup & Restore, Pilot Light, Warm Standby, Multi-Site Active/Active
  - RTO and RPO metrics definition and implementation
  - Point-in-time restore for human mistakes and accidental deletions

- **GitHub Disaster Recovery Guide**: [https://blog.gitguardian.com/github-restore-and-disaster-recovery-better-get-ready/](https://blog.gitguardian.com/github-restore-and-disaster-recovery-better-get-ready/)
  - Disaster recovery use cases and scenarios
  - 3-2-1 backup rule: 3 copies, 2 different media, 1 offsite
  - Infinite retention for point-in-time recovery

### Database Restore with S3, Decryption, and Decompression
- **alexey-goloburdin/postgres-s3-backuper**: [https://github.com/alexey-goloburdin/postgres-s3-backuper](https://github.com/alexey-goloburdin/postgres-s3-backuper)
  - PostgreSQL dump, zip, encrypt, upload to S3
  - Download, decrypt, decompress to restore database
  - Example of complete restore workflow similar to PRD-022f

- **nejckorasa/s3-stream-unzip**: [https://github.com/nejckorasa/s3-stream-unzip](https://github.com/nejckorasa/s3-stream-unzip)
  - Lightweight Java library for unzipping large S3 files
  - Handles files 100GB+ without keeping in memory or writing to disk
  - Streaming decompression pattern applicable to backup restoration

- **mmarschall/s3db-backup**: [https://github.com/mmarschall/s3db-backup](https://github.com/mmarschall/s3db-backup)
  - Rails database backup/restore to S3 with encryption and compression
  - Manual restore: decrypt with ccrypt, decompress with gunzip
  - Example of decrypt-decompress-restore pipeline

### Point-in-Time Restore Examples
- **bugfender/s3-version-restore**: [https://github.com/bugfender/s3-version-restore](https://github.com/bugfender/s3-version-restore)
  - Point-in-time recovery of S3 bucket using versioning
  - Restores files to specific timestamp
  - Example of timestamp-based recovery similar to targetTimestamp parameter

- **angeloc/s3-pit-restore**: [https://github.com/angeloc/s3-pit-restore](https://github.com/angeloc/s3-pit-restore)
  - S3 point-in-time restore tool
  - Useful when S3 versioning enabled
  - Demonstrates recovery to specific point in time

### Recovery Verification and Testing
- **GitHub Enterprise Server Backup Utilities**: [https://docs.github.com/en/enterprise-server@3.11/admin/backing-up-and-restoring-your-instance/configuring-backups-on-your-instance](https://docs.github.com/en/enterprise-server@3.11/admin/backing-up-and-restoring-your-instance/configuring-backups-on-your-instance)
  - Hourly backup schedule for 1-hour max data loss (RPO)
  - Regular backup snapshots over secure SSH
  - Example of automated disaster recovery testing

- **Relax-and-Recover (ReaR)**: [https://github.com/rear/rear](https://github.com/rear/rear)
  - Linux bare metal disaster recovery and system migration
  - Bootable disaster recovery system image
  - Example of complete system recovery workflow

### Granular Recovery Patterns
- **Granular Recovery and Point-in-Time Restore**: Best practice patterns
  - Recover only chosen data without full backup restore
  - Tenant-specific recovery without affecting other tenants
  - Minimize downtime by restoring incrementally

### Recovery Metrics and SLAs
- **RTO (Recovery Time Objective)**: 1 hour target
  - Time to download snapshot, decrypt, decompress, restore
  - Includes verification and service restart
- **RPO (Recovery Point Objective)**: 15 minutes target
  - Based on TigerBeetle incremental log backup frequency
  - Worst-case data loss window
- **Monthly Disaster Recovery Drills**: Verify RTO/RPO targets
  - Test restore to isolated environment
  - Validate data integrity post-recovery
  - Update runbooks based on test results
