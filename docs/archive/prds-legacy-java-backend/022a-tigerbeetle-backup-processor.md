# PRD-022a: TigerBeetle Backup Processor

**Parent:** [PRD-022: Backup and Recovery](./022-backup-recovery.md)
**Unit:** TigerBeetleBackupProcessor
**Complexity:** Medium
**Est. Lines:** ~350
**Dependencies:** PRD-002 (TigerBeetle Persistence)

## Purpose

Snapshot TigerBeetle data files every 6 hours and backup incremental transaction logs every 15 minutes to provide point-in-time recovery capability with 15-minute RPO.

## Architecture Integration

- **ADR-011 (TigerBeetle-First):** Backup events recorded as TigerBeetle transfers (code=12)
- **ADR-013 (Camel-First):** Backup jobs implemented as Camel route processors
- **ADR-014 (Named Processors):** All backup logic in named CDI processors

## Implementation

### Backup Route (Apache Camel)

```java
package com.betrace.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TigerBeetleBackupRoute extends RouteBuilder {
    @Override
    public void configure() throws Exception {
        // Full snapshot every 6 hours
        from("timer:tigerbeetle-snapshot?period=21600000") // 6 hours
            .routeId("tigerbeetle-snapshot-route")
            .to("direct:snapshot-tigerbeetle");

        from("direct:snapshot-tigerbeetle")
            .process("validateBackupPrerequisitesProcessor")
            .process("snapshotTigerBeetleDataProcessor")
            .process("compressSnapshotProcessor")
            .process("encryptSnapshotProcessor")
            .process("uploadToS3Processor")
            .process("recordBackupEventProcessor")
            .process("cleanupOldBackupsProcessor");

        // Incremental logs every 15 minutes
        from("timer:tigerbeetle-logs?period=900000") // 15 minutes
            .routeId("tigerbeetle-logs-route")
            .to("direct:backup-tigerbeetle-logs");

        from("direct:backup-tigerbeetle-logs")
            .process("backupIncrementalLogsProcessor")
            .process("compressLogsProcessor")
            .process("encryptLogsProcessor")
            .process("uploadLogsToS3Processor")
            .process("recordBackupEventProcessor");
    }
}
```

### Snapshot TigerBeetle Data Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;

@Named("snapshotTigerBeetleDataProcessor")
@ApplicationScoped
public class SnapshotTigerBeetleDataProcessor implements Processor {

    @ConfigProperty(name = "tigerbeetle.data.path")
    String tigerBeetleDataPath;

    @ConfigProperty(name = "backup.snapshot.path")
    String snapshotBasePath;

    @Inject
    BackupMetadataService backupMetadataService;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID backupId = UUID.randomUUID();
        Instant startTime = Instant.now();

        try {
            // Create snapshot directory
            Path snapshotDir = Paths.get(snapshotBasePath,
                "tigerbeetle-snapshot-" + backupId.toString());
            Files.createDirectories(snapshotDir);

            // Copy TigerBeetle data files (immutable, safe to copy while running)
            Path dataPath = Paths.get(tigerBeetleDataPath);
            Files.walk(dataPath)
                .filter(Files::isRegularFile)
                .forEach(source -> {
                    try {
                        Path destination = snapshotDir.resolve(dataPath.relativize(source));
                        Files.createDirectories(destination.getParent());
                        Files.copy(source, destination, StandardCopyOption.COPY_ATTRIBUTES);
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to copy file: " + source, e);
                    }
                });

            // Calculate snapshot size
            long snapshotSizeBytes = Files.walk(snapshotDir)
                .filter(Files::isRegularFile)
                .mapToLong(p -> {
                    try {
                        return Files.size(p);
                    } catch (Exception e) {
                        return 0L;
                    }
                })
                .sum();

            // Set exchange properties for next processors
            exchange.setProperty("backupId", backupId);
            exchange.setProperty("backupType", "tigerbeetle");
            exchange.setProperty("backupScope", "full");
            exchange.setProperty("snapshotPath", snapshotDir.toString());
            exchange.setProperty("backupSizeBytes", snapshotSizeBytes);
            exchange.setProperty("startTime", startTime);
            exchange.setProperty("status", "snapshot_created");

        } catch (Exception e) {
            exchange.setProperty("status", "failed");
            exchange.setProperty("errorMessage", e.getMessage());
            throw e;
        }
    }
}
```

### Compress Snapshot Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.*;
import java.nio.file.*;
import java.util.zip.GZIPOutputStream;

@Named("compressSnapshotProcessor")
@ApplicationScoped
public class CompressSnapshotProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        String snapshotPath = exchange.getProperty("snapshotPath", String.class);
        String backupId = exchange.getProperty("backupId", String.class);

        Path snapshotDir = Paths.get(snapshotPath);
        Path compressedFile = snapshotDir.getParent().resolve(
            "tigerbeetle-snapshot-" + backupId + ".tar.gz");

        // Create tar.gz archive
        try (OutputStream fos = Files.newOutputStream(compressedFile);
             GZIPOutputStream gzos = new GZIPOutputStream(fos)) {

            // Tar the snapshot directory
            TarArchiver.createTarArchive(snapshotDir, gzos);
        }

        long compressedSize = Files.size(compressedFile);

        // Update exchange properties
        exchange.setProperty("compressedPath", compressedFile.toString());
        exchange.setProperty("compressedSizeBytes", compressedSize);
        exchange.setProperty("compression", "gzip");

        // Calculate compression ratio
        long originalSize = exchange.getProperty("backupSizeBytes", Long.class);
        double compressionRatio = (double) compressedSize / originalSize;
        exchange.setProperty("compressionRatio", compressionRatio);

        // Cleanup uncompressed snapshot
        deleteDirectory(snapshotDir);
    }

    private void deleteDirectory(Path directory) throws IOException {
        Files.walk(directory)
            .sorted((a, b) -> b.compareTo(a)) // Delete files before directories
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

### Encrypt Snapshot Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.crypto.*;
import javax.crypto.spec.*;
import java.io.*;
import java.nio.file.*;
import java.security.SecureRandom;

@Named("encryptSnapshotProcessor")
@ApplicationScoped
public class EncryptSnapshotProcessor implements Processor {

    @Inject
    KMSService kmsService;

    private static final int GCM_IV_LENGTH = 12; // 96 bits
    private static final int GCM_TAG_LENGTH = 128; // 128 bits

    @Override
    public void process(Exchange exchange) throws Exception {
        String compressedPath = exchange.getProperty("compressedPath", String.class);
        String backupId = exchange.getProperty("backupId", String.class);

        Path compressedFile = Paths.get(compressedPath);
        Path encryptedFile = compressedFile.getParent().resolve(
            compressedFile.getFileName() + ".enc");

        // Generate AES-256-GCM key via KMS
        UUID systemTenantId = UUID.fromString("00000000-0000-0000-0000-000000000000");
        byte[] dataKey = kmsService.generateDataKey(systemTenantId, "backup-encryption");

        // Generate random IV
        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);

        // Encrypt file with AES-256-GCM
        SecretKeySpec keySpec = new SecretKeySpec(dataKey, "AES");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        GCMParameterSpec gcmSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);

        try (InputStream fis = Files.newInputStream(compressedFile);
             OutputStream fos = Files.newOutputStream(encryptedFile);
             CipherOutputStream cos = new CipherOutputStream(fos, cipher)) {

            // Write IV to file header
            fos.write(iv);

            // Encrypt and write data
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                cos.write(buffer, 0, bytesRead);
            }
        }

        long encryptedSize = Files.size(encryptedFile);

        // Update exchange properties
        exchange.setProperty("encryptedPath", encryptedFile.toString());
        exchange.setProperty("encryptedSizeBytes", encryptedSize);
        exchange.setProperty("encryption", "aes256-gcm");
        exchange.setProperty("kmsKeyId", kmsService.getKeyId(systemTenantId, "backup-encryption"));

        // Cleanup unencrypted file
        Files.delete(compressedFile);
    }
}
```

### Upload to S3 Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.core.sync.RequestBody;
import java.nio.file.*;
import java.security.MessageDigest;

@Named("uploadToS3Processor")
@ApplicationScoped
public class UploadToS3Processor implements Processor {

    @Inject
    S3Client s3Client;

    private static final String BUCKET_NAME = "betrace-backups";

    @Override
    public void process(Exchange exchange) throws Exception {
        String encryptedPath = exchange.getProperty("encryptedPath", String.class);
        String backupType = exchange.getProperty("backupType", String.class);
        String backupId = exchange.getProperty("backupId", String.class);

        Path encryptedFile = Paths.get(encryptedPath);

        // Calculate SHA-256 checksum
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] fileBytes = Files.readAllBytes(encryptedFile);
        byte[] checksum = digest.digest(fileBytes);
        String checksumHex = bytesToHex(checksum);

        // S3 key: tigerbeetle/2025/10/11/tigerbeetle-snapshot-{uuid}.tar.gz.enc
        String s3Key = String.format("%s/%s/%s",
            backupType,
            java.time.LocalDate.now().toString().replace("-", "/"),
            encryptedFile.getFileName());

        // Upload to S3
        PutObjectRequest putRequest = PutObjectRequest.builder()
            .bucket(BUCKET_NAME)
            .key(s3Key)
            .contentType("application/octet-stream")
            .metadata(Map.of(
                "backup-id", backupId.toString(),
                "backup-type", backupType,
                "checksum-sha256", checksumHex
            ))
            .build();

        s3Client.putObject(putRequest, RequestBody.fromFile(encryptedFile));

        String s3Uri = String.format("s3://%s/%s", BUCKET_NAME, s3Key);

        // Update exchange properties
        exchange.setProperty("s3Uri", s3Uri);
        exchange.setProperty("checksum", checksumHex);
        exchange.setProperty("status", "uploaded");

        // Cleanup local encrypted file
        Files.delete(encryptedFile);
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
```

### Record Backup Event Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.tigerbeetle.Transfer;
import java.util.UUID;
import java.time.Instant;

@Named("recordBackupEventProcessor")
@ApplicationScoped
public class RecordBackupEventProcessor implements Processor {

    @Inject
    TigerBeetleService tigerBeetleService;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final int CODE_BACKUP = 12;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID backupId = exchange.getProperty("backupId", UUID.class);
        String backupType = exchange.getProperty("backupType", String.class);
        String backupScope = exchange.getProperty("backupScope", String.class);
        long backupSizeBytes = exchange.getProperty("encryptedSizeBytes", Long.class);
        String s3Uri = exchange.getProperty("s3Uri", String.class);
        String checksum = exchange.getProperty("checksum", String.class);
        String compression = exchange.getProperty("compression", String.class);
        String encryption = exchange.getProperty("encryption", String.class);
        Instant startTime = exchange.getProperty("startTime", Instant.class);
        String status = exchange.getProperty("status", String.class);

        // Create TigerBeetle transfer (code=12)
        UUID systemAccountId = UUID.fromString("00000000-0000-0000-0000-000000000000");

        long userData128 = packBackupMetadata(
            backupTypeToInt(backupType),
            backupScopeToInt(backupScope),
            compressionToInt(compression),
            encryptionToInt(encryption),
            statusToInt(status),
            365 // retention_days
        );

        Transfer backupEvent = new Transfer(
            backupId,
            systemAccountId, // debitAccountId (system)
            systemAccountId, // creditAccountId (system - backup event)
            backupSizeBytes,
            CODE_BACKUP,
            userData128,
            startTime.getEpochSecond(),
            0 // ledger 0 (system ledger)
        );

        tigerBeetleService.createTransfers(List.of(backupEvent));

        // Store backup metadata in DuckDB
        backupMetadataService.recordBackup(
            backupId, backupType, backupScope, null,
            startTime, Instant.now(), status, backupSizeBytes,
            s3Uri, checksum, compression, encryption,
            java.time.LocalDate.now().plusDays(365)
        );

        exchange.setProperty("backupEventId", backupId);
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

    private int backupTypeToInt(String backupType) {
        return switch (backupType) {
            case "tigerbeetle" -> 1;
            case "duckdb" -> 2;
            case "parquet" -> 3;
            case "kms" -> 4;
            default -> 0;
        };
    }

    private int backupScopeToInt(String backupScope) {
        return switch (backupScope) {
            case "full" -> 1;
            case "incremental" -> 2;
            default -> 0;
        };
    }

    private int compressionToInt(String compression) {
        return switch (compression) {
            case "none" -> 1;
            case "gzip" -> 2;
            case "zstd" -> 3;
            default -> 1;
        };
    }

    private int encryptionToInt(String encryption) {
        return switch (encryption) {
            case "none" -> 1;
            case "aes256-gcm" -> 2;
            default -> 1;
        };
    }

    private int statusToInt(String status) {
        return switch (status) {
            case "started" -> 1;
            case "uploaded", "completed" -> 2;
            case "failed" -> 3;
            default -> 1;
        };
    }
}
```

## Testing Requirements

- [ ] Unit test: Snapshot creation copies all TigerBeetle data files
- [ ] Unit test: Compression reduces backup size by >50%
- [ ] Unit test: Encryption produces different output for same input (random IV)
- [ ] Unit test: S3 upload stores correct metadata (checksum, backup-id)
- [ ] Unit test: TigerBeetle transfer created with code=12
- [ ] Integration test: Full backup workflow (snapshot → compress → encrypt → upload → record)
- [ ] Integration test: Incremental log backup every 15 minutes
- [ ] Performance test: Snapshot creation completes in <5 minutes for 10GB database
- [ ] Coverage: 90% (per ADR-014)

## Security Considerations

- **Backup theft** - AES-256-GCM encryption with KMS-managed keys
- **Data corruption** - SHA-256 checksums verified on restore
- **Unauthorized access** - S3 bucket policies restrict access to backup service role
- **Key loss** - KMS keys backed up to multi-region backup vault

## Success Criteria

- Automated TigerBeetle snapshots every 6 hours
- Automated incremental log backups every 15 minutes
- All backups encrypted with AES-256-GCM
- All backups uploaded to S3 with checksums
- Backup events immutably recorded in TigerBeetle
- Local cleanup after successful S3 upload

## Public Examples

### TigerBeetle Recovery Documentation
- **TigerBeetle Recovery Command**: [https://docs.tigerbeetle.com/operating/recovering/](https://docs.tigerbeetle.com/operating/recovering/)
  - Official documentation for TigerBeetle's recovery mechanism for lost replicas
  - Uses `tigerbeetle recover` command to rebuild lost data files from cluster
  - Note: TigerBeetle does not currently provide built-in snapshot/backup export commands
  - Recommendation is to maintain backups and export transaction snapshots for offline verification

### Database Backup with Compression, Encryption, and S3 Upload
- **AlexanderBabel/database-s3-backup**: [https://github.com/AlexanderBabel/database-s3-backup](https://github.com/AlexanderBabel/database-s3-backup)
  - Docker image for MongoDB, PostgreSQL, and MySQL backups
  - Demonstrates compression (gzip/bzip2) and encryption (GPG/OpenSSL) before S3 upload
  - Example of multi-stage backup pipeline similar to PRD-022a

- **ejoebstl/rds-postgres-backup-s3-secure**: [https://github.com/ejoebstl/rds-postgres-backup-s3-secure](https://github.com/ejoebstl/rds-postgres-backup-s3-secure)
  - Encrypted RDS postgres backups to S3 without hardcoded keys
  - Uses asymmetric encryption (public key for encryption, private key not exposed)
  - Demonstrates secure backup workflow with compression and encryption

- **davidsoergel/s3napback**: [https://github.com/davidsoergel/s3napback](https://github.com/davidsoergel/s3napback)
  - Cycling, incremental, compressed, encrypted backups to Amazon S3
  - Uses pipes and TCP streams (no temporary files)
  - Example of incremental backup strategy similar to TigerBeetle log backups

- **dsschult/s3_archive**: [https://github.com/dsschult/s3_archive](https://github.com/dsschult/s3_archive)
  - Uploads files to S3 in compressed, encrypted archives
  - Files split into 256MB chunks, compressed, encrypted, uploaded under SHA-512 checksum
  - Demonstrates chunking and checksum verification pattern

### AWS SDK S3 Upload Examples
- **AWS SDK for Java S3 PutObject**: [https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html](https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html)
  - Official AWS documentation for uploading objects to S3 using Java SDK
  - Examples of setting metadata, storage classes, and encryption options

### Encryption Best Practices
- **Java Cipher AES-GCM**: [https://docs.oracle.com/en/java/javase/21/docs/api/java.base/javax/crypto/Cipher.html](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/javax/crypto/Cipher.html)
  - Official Java documentation for AES-GCM encryption
  - Demonstrates proper IV generation and GCMParameterSpec usage
