# PRD-022c: Parquet Replication Processor

**Parent:** [PRD-022: Backup and Recovery](./022-backup-recovery.md)
**Unit:** ParquetReplicationProcessor
**Complexity:** Medium
**Est. Lines:** ~300
**Dependencies:** PRD-002 (TigerBeetle Persistence), ADR-015 (Tiered Storage)

## Purpose

Replicate Parquet cold tier archives (7-365 days) to S3 Standard-IA with checksum verification to ensure long-term compliance data retention.

## Architecture Integration

- **ADR-011 (TigerBeetle-First):** Backup events recorded as TigerBeetle transfers (code=12)
- **ADR-013 (Camel-First):** Replication jobs implemented as Camel route processors
- **ADR-014 (Named Processors):** All replication logic in named CDI processors
- **ADR-015 (Tiered Storage):** Backup cold tier (Parquet archives) separate from hot tier

## Implementation

### Parquet Replication Route (Apache Camel)

```java
package com.betrace.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ParquetReplicationRoute extends RouteBuilder {
    @Override
    public void configure() throws Exception {
        // Replicate new Parquet files every hour
        from("timer:parquet-replication?period=3600000") // 1 hour
            .routeId("parquet-replication-route")
            .to("direct:replicate-parquet-files");

        from("direct:replicate-parquet-files")
            .process("scanParquetArchiveDirectoryProcessor")
            .split(body())
                .process("replicateParquetFileProcessor")
                .process("verifyParquetChecksumProcessor")
                .process("recordParquetReplicationEventProcessor")
            .end();
    }
}
```

### Scan Parquet Archive Directory Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@Named("scanParquetArchiveDirectoryProcessor")
@ApplicationScoped
public class ScanParquetArchiveDirectoryProcessor implements Processor {

    @ConfigProperty(name = "parquet.archive.path")
    String parquetArchivePath;

    @Inject
    BackupMetadataService backupMetadataService;

    @Override
    public void process(Exchange exchange) throws Exception {
        Path archivePath = Paths.get(parquetArchivePath);

        // Find all Parquet files not yet replicated to S3
        List<ParquetFileInfo> filesToReplicate = Files.walk(archivePath)
            .filter(Files::isRegularFile)
            .filter(p -> p.toString().endsWith(".parquet"))
            .map(p -> {
                try {
                    return new ParquetFileInfo(
                        p,
                        Files.size(p),
                        Files.getLastModifiedTime(p).toInstant()
                    );
                } catch (Exception e) {
                    return null;
                }
            })
            .filter(Objects::nonNull)
            .filter(info -> !backupMetadataService.isFileReplicated(info.path.toString()))
            .collect(Collectors.toList());

        // Set body to list of files to replicate
        exchange.getIn().setBody(filesToReplicate);
        exchange.setProperty("totalFilesToReplicate", filesToReplicate.size());
    }

    public static class ParquetFileInfo {
        public final Path path;
        public final long sizeBytes;
        public final java.time.Instant lastModified;

        public ParquetFileInfo(Path path, long sizeBytes, java.time.Instant lastModified) {
            this.path = path;
            this.sizeBytes = sizeBytes;
            this.lastModified = lastModified;
        }
    }
}
```

### Replicate Parquet File Processor

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
import java.util.*;

@Named("replicateParquetFileProcessor")
@ApplicationScoped
public class ReplicateParquetFileProcessor implements Processor {

    @Inject
    S3Client s3Client;

    @ConfigProperty(name = "parquet.archive.path")
    String parquetArchivePath;

    private static final String BUCKET_NAME = "betrace-backups";

    @Override
    public void process(Exchange exchange) throws Exception {
        ScanParquetArchiveDirectoryProcessor.ParquetFileInfo fileInfo =
            exchange.getIn().getBody(ScanParquetArchiveDirectoryProcessor.ParquetFileInfo.class);

        Path parquetFile = fileInfo.path;
        UUID replicationId = UUID.randomUUID();
        java.time.Instant startTime = java.time.Instant.now();

        try {
            // Calculate SHA-256 checksum
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] fileBytes = Files.readAllBytes(parquetFile);
            byte[] checksumBytes = digest.digest(fileBytes);
            String checksum = bytesToHex(checksumBytes);

            // Generate S3 key: parquet/2025/10/11/{filename}
            Path relativePath = Paths.get(parquetArchivePath).relativize(parquetFile);
            String s3Key = String.format("parquet/%s/%s",
                java.time.LocalDate.now().toString().replace("-", "/"),
                relativePath.toString().replace(File.separatorChar, '/'));

            // Upload to S3 Standard-IA storage class
            PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .storageClass(StorageClass.STANDARD_IA) // Infrequent Access for cost savings
                .contentType("application/octet-stream")
                .metadata(Map.of(
                    "replication-id", replicationId.toString(),
                    "original-path", parquetFile.toString(),
                    "checksum-sha256", checksum,
                    "last-modified", fileInfo.lastModified.toString()
                ))
                .build();

            s3Client.putObject(putRequest, RequestBody.fromBytes(fileBytes));

            String s3Uri = String.format("s3://%s/%s", BUCKET_NAME, s3Key);

            // Set exchange properties for next processors
            exchange.setProperty("replicationId", replicationId);
            exchange.setProperty("parquetFilePath", parquetFile.toString());
            exchange.setProperty("s3Uri", s3Uri);
            exchange.setProperty("checksum", checksum);
            exchange.setProperty("fileSizeBytes", fileInfo.sizeBytes);
            exchange.setProperty("startTime", startTime);
            exchange.setProperty("status", "uploaded");

        } catch (Exception e) {
            exchange.setProperty("status", "failed");
            exchange.setProperty("errorMessage", e.getMessage());
            throw e;
        }
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

### Verify Parquet Checksum Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.core.ResponseInputStream;
import java.security.MessageDigest;
import java.io.InputStream;

@Named("verifyParquetChecksumProcessor")
@ApplicationScoped
public class VerifyParquetChecksumProcessor implements Processor {

    @Inject
    S3Client s3Client;

    private static final String BUCKET_NAME = "betrace-backups";

    @Override
    public void process(Exchange exchange) throws Exception {
        String s3Uri = exchange.getProperty("s3Uri", String.class);
        String expectedChecksum = exchange.getProperty("checksum", String.class);

        // Extract S3 key from URI
        String s3Key = s3Uri.replace("s3://" + BUCKET_NAME + "/", "");

        // Download file from S3 and calculate checksum
        GetObjectRequest getRequest = GetObjectRequest.builder()
            .bucket(BUCKET_NAME)
            .key(s3Key)
            .build();

        try (ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getRequest)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = s3Object.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }

            String actualChecksum = bytesToHex(digest.digest());

            if (!actualChecksum.equals(expectedChecksum)) {
                throw new RuntimeException(
                    String.format("Checksum mismatch! Expected: %s, Actual: %s",
                        expectedChecksum, actualChecksum)
                );
            }

            exchange.setProperty("checksumVerified", true);
            exchange.setProperty("status", "verified");

        } catch (Exception e) {
            exchange.setProperty("checksumVerified", false);
            exchange.setProperty("status", "failed");
            exchange.setProperty("errorMessage", "Checksum verification failed: " + e.getMessage());
            throw e;
        }
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

### Record Parquet Replication Event Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import com.tigerbeetle.Transfer;
import java.util.*;
import java.time.Instant;

@Named("recordParquetReplicationEventProcessor")
@ApplicationScoped
public class RecordParquetReplicationEventProcessor implements Processor {

    @Inject
    TigerBeetleService tigerBeetleService;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final int CODE_BACKUP = 12;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID replicationId = exchange.getProperty("replicationId", UUID.class);
        String parquetFilePath = exchange.getProperty("parquetFilePath", String.class);
        String s3Uri = exchange.getProperty("s3Uri", String.class);
        String checksum = exchange.getProperty("checksum", String.class);
        long fileSizeBytes = exchange.getProperty("fileSizeBytes", Long.class);
        Instant startTime = exchange.getProperty("startTime", Instant.class);
        boolean checksumVerified = exchange.getProperty("checksumVerified", Boolean.class);
        String status = exchange.getProperty("status", String.class);

        // Create TigerBeetle transfer (code=12)
        UUID systemAccountId = UUID.fromString("00000000-0000-0000-0000-000000000000");

        long userData128 = packBackupMetadata(
            3, // parquet
            1, // full (not incremental)
            0, // no compression (Parquet already compressed)
            1, // no encryption (S3 server-side encryption)
            statusToInt(status),
            365 // retention_days (365 days for compliance)
        );

        Transfer backupEvent = new Transfer(
            replicationId,
            systemAccountId,
            systemAccountId,
            fileSizeBytes,
            CODE_BACKUP,
            userData128,
            startTime.getEpochSecond(),
            0 // ledger 0 (system ledger)
        );

        tigerBeetleService.createTransfers(List.of(backupEvent));

        // Store replication metadata in DuckDB
        backupMetadataService.recordBackup(
            replicationId, "parquet", "full", null,
            startTime, Instant.now(), status, fileSizeBytes,
            s3Uri, checksum, "parquet-zstd", "s3-sse",
            java.time.LocalDate.now().plusDays(365)
        );

        // Mark file as replicated
        backupMetadataService.markFileAsReplicated(parquetFilePath, s3Uri, checksum);

        exchange.setProperty("replicationEventId", replicationId);
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
            case "started" -> 1;
            case "verified", "completed" -> 2;
            case "failed" -> 3;
            default -> 1;
        };
    }
}
```

### Backup Metadata Service (DuckDB Tracking)

```java
package com.betrace.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import javax.sql.DataSource;
import java.sql.*;
import java.time.*;
import java.util.UUID;

@ApplicationScoped
public class BackupMetadataService {

    @Inject
    @io.quarkus.agroal.DataSource("duckdb")
    DataSource duckdbDataSource;

    public void recordBackup(UUID id, String backupType, String backupScope,
                              UUID tenantId, Instant startTime, Instant endTime,
                              String status, long backupSizeBytes, String backupLocation,
                              String checksum, String compression, String encryption,
                              LocalDate retentionUntil) throws SQLException {
        String sql = """
            INSERT INTO backup_metadata (
                id, backup_type, backup_scope, tenant_id, start_time, end_time,
                status, backup_size_bytes, backup_location, checksum,
                compression, encryption, retention_until
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

        try (Connection conn = duckdbDataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setObject(1, id);
            stmt.setString(2, backupType);
            stmt.setString(3, backupScope);
            stmt.setObject(4, tenantId);
            stmt.setTimestamp(5, Timestamp.from(startTime));
            stmt.setTimestamp(6, Timestamp.from(endTime));
            stmt.setString(7, status);
            stmt.setLong(8, backupSizeBytes);
            stmt.setString(9, backupLocation);
            stmt.setString(10, checksum);
            stmt.setString(11, compression);
            stmt.setString(12, encryption);
            stmt.setDate(13, Date.valueOf(retentionUntil));
            stmt.executeUpdate();
        }
    }

    public boolean isFileReplicated(String filePath) throws SQLException {
        String sql = "SELECT COUNT(*) FROM parquet_replication WHERE file_path = ?";
        try (Connection conn = duckdbDataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, filePath);
            ResultSet rs = stmt.executeQuery();
            return rs.next() && rs.getInt(1) > 0;
        }
    }

    public void markFileAsReplicated(String filePath, String s3Uri, String checksum)
            throws SQLException {
        String sql = """
            INSERT INTO parquet_replication (file_path, s3_uri, checksum, replicated_at)
            VALUES (?, ?, ?, NOW())
            """;
        try (Connection conn = duckdbDataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, filePath);
            stmt.setString(2, s3Uri);
            stmt.setString(3, checksum);
            stmt.executeUpdate();
        }
    }

    public Instant getLastBackupTime(String backupType, String backupScope) throws SQLException {
        String sql = """
            SELECT MAX(end_time) FROM backup_metadata
            WHERE backup_type = ? AND backup_scope = ? AND status = 'completed'
            """;
        try (Connection conn = duckdbDataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, backupType);
            stmt.setString(2, backupScope);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                Timestamp ts = rs.getTimestamp(1);
                return ts != null ? ts.toInstant() : null;
            }
            return null;
        }
    }
}
```

## Testing Requirements

- [ ] Unit test: Scan finds all non-replicated Parquet files
- [ ] Unit test: Replication uploads file to S3 with Standard-IA storage class
- [ ] Unit test: Checksum verification detects file corruption
- [ ] Unit test: Replication event recorded in TigerBeetle with code=12
- [ ] Unit test: File marked as replicated in DuckDB tracking table
- [ ] Integration test: Full replication workflow (scan → replicate → verify → record)
- [ ] Integration test: Duplicate replication skipped for already-replicated files
- [ ] Performance test: Replicate 100 Parquet files (1GB total) in <5 minutes
- [ ] Coverage: 90% (per ADR-014)

## Security Considerations

- **Data leakage** - S3 server-side encryption (SSE-S3)
- **Backup tampering** - SHA-256 checksum verification on upload
- **Storage cost** - S3 Standard-IA for infrequent access (lower cost)

## Success Criteria

- All Parquet cold tier files replicated to S3 Standard-IA
- Checksums verified for every replicated file
- Replication events immutably recorded in TigerBeetle
- 365-day retention enforced for compliance
- Duplicate replications prevented via tracking table

## Public Examples

### AWS S3 Checksum Verification
- **AWS Samples - Amazon S3 Checksum Verification**: [https://github.com/aws-samples/amazon-s3-checksum-verification](https://github.com/aws-samples/amazon-s3-checksum-verification)
  - Simple mechanism to validate local file integrity against S3-stored checksums
  - Python script (integrity-check.py) supporting SHA-1, SHA-256, CRC-32, CRC-32C
  - Example of download-and-verify pattern used in this PRD

- **AWS Samples - Amazon S3 Checksum Tool**: [https://github.com/aws-samples/amazon-s3-checksum-tool](https://github.com/aws-samples/amazon-s3-checksum-tool)
  - Calculate ETag and additional checksums (SHA256) for multipart uploads
  - Provides individual checksums across every part of multipart object
  - Useful for verifying large Parquet file uploads

- **Wellcome Collection - Get S3 Checksums**: [https://github.com/wellcomecollection/get_s3_checksums](https://github.com/wellcomecollection/get_s3_checksums)
  - Script for getting checksums of all objects under S3 prefix
  - Creates MD5, SHA-1, SHA-256, SHA-512 checksums
  - Example of batch checksum verification for compliance

### AWS S3 Storage Classes Documentation
- **S3 Storage Classes Overview**: [https://aws.amazon.com/s3/storage-classes/](https://aws.amazon.com/s3/storage-classes/)
  - S3 Standard-IA: For infrequently accessed data requiring rapid access
  - High durability (99.999999999%), low latency, ideal for backups and disaster recovery
  - Lower storage cost than S3 Standard, perfect for cold tier archives

- **S3 Lifecycle Transitions**: [https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html)
  - Automatic transitions from Standard → Standard-IA → Glacier
  - Lifecycle policies for cost optimization based on access patterns

- **S3 Replication**: [https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html)
  - Cross-region and same-region replication
  - Checksums transferred as part of S3 Replication (as of Dec 2024)

### Parquet and S3 Integration
- **Efficiently Store Big Data with Parquet and Athena**: [https://mtccreatives.medium.com/how-to-efficiently-store-and-query-big-data-in-aws-s3-using-parquet-and-athena-387062b9ea6f](https://mtccreatives.medium.com/how-to-efficiently-store-and-query-big-data-in-aws-s3-using-parquet-and-athena-387062b9ea6f)
  - Using Parquet format for efficient S3 storage
  - GZIP or ZSTD compression recommended for cold storage scenarios
  - Parquet widely used in data lakes on S3, Azure, GCS

- **Parquet Format Guide**: [https://www.databricks.com/glossary/what-is-parquet](https://www.databricks.com/glossary/what-is-parquet)
  - Apache Parquet columnar storage format
  - Optimized for analytics and long-term storage
  - Efficient compression and encoding schemes

### Data Integrity Best Practices
- **Checking Object Integrity in S3**: [https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html)
  - Official AWS documentation for S3 checksums
  - MD5, SHA-1, SHA-256, CRC32, CRC32C support
  - Automatic checksum validation during uploads/downloads
