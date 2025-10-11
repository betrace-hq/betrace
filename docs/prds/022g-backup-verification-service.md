# PRD-022g: Backup Verification Service

**Parent:** [PRD-022: Backup and Recovery](./022-backup-recovery.md)
**Unit:** BackupVerificationService
**Complexity:** Medium
**Est. Lines:** ~300
**Dependencies:** PRD-022a, PRD-022b, PRD-022c, PRD-022d, PRD-022f

## Purpose

Automatically verify backup integrity and recoverability through daily automated checks and test restores to ensure backups are valid and can be recovered when needed.

## Architecture Integration

- **ADR-011 (TigerBeetle-First):** Verification events recorded as TigerBeetle transfers (code=12)
- **ADR-013 (Camel-First):** Verification jobs implemented as Camel route processors
- **ADR-014 (Named Processors):** All verification logic in named CDI processors

## Implementation

### Backup Verification Route (Apache Camel)

```java
package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class BackupVerificationRoute extends RouteBuilder {
    @Override
    public void configure() throws Exception {
        // Daily verification (runs at 2 AM)
        from("cron:backup-verification?schedule=0 2 * * *")
            .routeId("backup-verification-route")
            .to("direct:verify-all-backups");

        from("direct:verify-all-backups")
            .process("verifyTigerBeetleBackupsProcessor")
            .process("verifyDuckDBBackupsProcessor")
            .process("verifyParquetBackupsProcessor")
            .process("verifyKMSKeyBackupsProcessor")
            .process("recordVerificationResultsProcessor");

        // Monthly test restore (first Sunday at 3 AM)
        from("cron:test-restore?schedule=0 3 * * 0#1") // First Sunday
            .routeId("test-restore-route")
            .to("direct:test-restore");

        from("direct:test-restore")
            .process("selectTestRestoreBackupProcessor")
            .process("performTestRestoreProcessor")
            .process("verifyTestRestoreDataProcessor")
            .process("cleanupTestRestoreProcessor")
            .process("recordTestRestoreResultProcessor");
    }
}
```

### Verify TigerBeetle Backups Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Named("verifyTigerBeetleBackupsProcessor")
@ApplicationScoped
public class VerifyTigerBeetleBackupsProcessor implements Processor {

    @Inject
    S3Client s3Client;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final String BUCKET_NAME = "fluo-backups";

    @Override
    public void process(Exchange exchange) throws Exception {
        List<Map<String, Object>> verificationResults = new ArrayList<>();

        // Get all TigerBeetle backups from last 7 days
        Instant sevenDaysAgo = Instant.now().minusSeconds(7 * 24 * 3600);
        List<UUID> backupIds = backupMetadataService.findBackupsAfter(
            "tigerbeetle", null, sevenDaysAgo, null);

        for (UUID backupId : backupIds) {
            Map<String, Object> result = verifyBackup(backupId);
            verificationResults.add(result);
        }

        exchange.setProperty("tigerBeetleVerificationResults", verificationResults);

        // Check if any verifications failed
        boolean anyFailed = verificationResults.stream()
            .anyMatch(r -> "failed".equals(r.get("status")));
        exchange.setProperty("tigerBeetleVerificationPassed", !anyFailed);
    }

    private Map<String, Object> verifyBackup(UUID backupId) {
        Map<String, Object> result = new HashMap<>();
        result.put("backupId", backupId.toString());
        result.put("backupType", "tigerbeetle");

        try {
            String s3Uri = backupMetadataService.getBackupLocation(backupId);
            String expectedChecksum = backupMetadataService.getBackupChecksum(backupId);
            String s3Key = s3Uri.replace("s3://" + BUCKET_NAME + "/", "");

            // Verify backup exists in S3
            HeadObjectRequest headRequest = HeadObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .build();

            HeadObjectResponse headResponse = s3Client.headObject(headRequest);

            // Download and verify checksum
            Path tempFile = Files.createTempFile("verify-", ".enc");
            GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .build();

            s3Client.getObject(getRequest, tempFile);

            // Calculate checksum
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] fileBytes = Files.readAllBytes(tempFile);
            String actualChecksum = bytesToHex(digest.digest(fileBytes));

            Files.delete(tempFile);

            // Verify checksums match
            if (actualChecksum.equals(expectedChecksum)) {
                result.put("status", "passed");
                result.put("message", "Checksum verified");
            } else {
                result.put("status", "failed");
                result.put("message", "Checksum mismatch");
                result.put("expectedChecksum", expectedChecksum);
                result.put("actualChecksum", actualChecksum);
            }

        } catch (Exception e) {
            result.put("status", "failed");
            result.put("message", e.getMessage());
        }

        return result;
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

### Verify DuckDB Backups Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import java.time.Instant;
import java.util.*;

@Named("verifyDuckDBBackupsProcessor")
@ApplicationScoped
public class VerifyDuckDBBackupsProcessor implements Processor {

    @Inject
    S3Client s3Client;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final String BUCKET_NAME = "fluo-backups";

    @Override
    public void process(Exchange exchange) throws Exception {
        List<Map<String, Object>> verificationResults = new ArrayList<>();

        // Get all DuckDB backups from last 7 days
        Instant sevenDaysAgo = Instant.now().minusSeconds(7 * 24 * 3600);
        List<UUID> backupIds = backupMetadataService.findBackupsAfter(
            "duckdb", null, sevenDaysAgo, null);

        for (UUID backupId : backupIds) {
            Map<String, Object> result = verifyDuckDBBackup(backupId);
            verificationResults.add(result);
        }

        exchange.setProperty("duckdbVerificationResults", verificationResults);

        boolean anyFailed = verificationResults.stream()
            .anyMatch(r -> "failed".equals(r.get("status")));
        exchange.setProperty("duckdbVerificationPassed", !anyFailed);
    }

    private Map<String, Object> verifyDuckDBBackup(UUID backupId) {
        Map<String, Object> result = new HashMap<>();
        result.put("backupId", backupId.toString());
        result.put("backupType", "duckdb");

        try {
            String s3Uris = backupMetadataService.getBackupLocation(backupId);
            List<String> parquetFiles = Arrays.asList(s3Uris.split(","));

            int filesVerified = 0;
            for (String s3Uri : parquetFiles) {
                String s3Key = s3Uri.replace("s3://" + BUCKET_NAME + "/", "");

                // Verify file exists
                HeadObjectRequest headRequest = HeadObjectRequest.builder()
                    .bucket(BUCKET_NAME)
                    .key(s3Key)
                    .build();

                s3Client.headObject(headRequest);
                filesVerified++;
            }

            result.put("status", "passed");
            result.put("message", "All Parquet files verified");
            result.put("filesVerified", filesVerified);

        } catch (Exception e) {
            result.put("status", "failed");
            result.put("message", e.getMessage());
        }

        return result;
    }
}
```

### Perform Test Restore Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.*;

@Named("performTestRestoreProcessor")
@ApplicationScoped
public class PerformTestRestoreProcessor implements Processor {

    @Inject
    RecoveryService recoveryService;

    @Inject
    BackupMetadataService backupMetadataService;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID testRestoreId = UUID.randomUUID();
        Instant startTime = Instant.now();

        try {
            // Select latest backups for test restore
            UUID tigerBeetleBackupId = backupMetadataService.findLatestBackup(
                "tigerbeetle", "full");
            UUID duckdbBackupId = backupMetadataService.findLatestBackup(
                "duckdb", "full");

            // Create isolated test environment
            String testEnvironmentPath = createTestEnvironment(testRestoreId);

            // Restore TigerBeetle to test environment
            recoveryService.restoreTigerBeetleToPath(
                tigerBeetleBackupId, testEnvironmentPath + "/tigerbeetle");

            // Restore DuckDB to test environment
            recoveryService.restoreDuckDBToPath(
                duckdbBackupId, testEnvironmentPath + "/duckdb");

            Instant endTime = Instant.now();
            long durationSeconds = endTime.getEpochSecond() - startTime.getEpochSecond();

            // Set exchange properties
            exchange.setProperty("testRestoreId", testRestoreId);
            exchange.setProperty("testEnvironmentPath", testEnvironmentPath);
            exchange.setProperty("tigerBeetleBackupId", tigerBeetleBackupId);
            exchange.setProperty("duckdbBackupId", duckdbBackupId);
            exchange.setProperty("testRestoreStartTime", startTime);
            exchange.setProperty("testRestoreEndTime", endTime);
            exchange.setProperty("testRestoreDurationSeconds", durationSeconds);
            exchange.setProperty("testRestoreStatus", "completed");

        } catch (Exception e) {
            exchange.setProperty("testRestoreStatus", "failed");
            exchange.setProperty("testRestoreError", e.getMessage());
            throw e;
        }
    }

    private String createTestEnvironment(UUID testRestoreId) {
        String path = "/tmp/fluo-test-restore-" + testRestoreId;
        new File(path).mkdirs();
        new File(path + "/tigerbeetle").mkdirs();
        new File(path + "/duckdb").mkdirs();
        return path;
    }
}
```

### Verify Test Restore Data Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.*;
import java.nio.file.*;
import java.util.*;

@Named("verifyTestRestoreDataProcessor")
@ApplicationScoped
public class VerifyTestRestoreDataProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        String testEnvironmentPath = exchange.getProperty("testEnvironmentPath", String.class);
        List<String> verificationErrors = new ArrayList<>();

        // Verify TigerBeetle data files exist
        Path tigerBeetlePath = Paths.get(testEnvironmentPath + "/tigerbeetle");
        if (!Files.exists(tigerBeetlePath) || !Files.isDirectory(tigerBeetlePath)) {
            verificationErrors.add("TigerBeetle data directory not found");
        } else {
            long fileCount = Files.list(tigerBeetlePath).count();
            if (fileCount == 0) {
                verificationErrors.add("TigerBeetle data directory is empty");
            }
        }

        // Verify DuckDB can be opened
        Path duckdbPath = Paths.get(testEnvironmentPath + "/duckdb");
        try {
            String jdbcUrl = "jdbc:duckdb:" + duckdbPath.toString() + "/fluo.db";
            try (Connection conn = DriverManager.getConnection(jdbcUrl);
                 Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM signals")) {
                if (rs.next()) {
                    int signalCount = rs.getInt(1);
                    exchange.setProperty("testRestoreSignalCount", signalCount);
                }
            }
        } catch (SQLException e) {
            verificationErrors.add("Failed to query DuckDB: " + e.getMessage());
        }

        // Set verification results
        boolean verificationPassed = verificationErrors.isEmpty();
        exchange.setProperty("testRestoreVerificationPassed", verificationPassed);
        exchange.setProperty("testRestoreVerificationErrors", verificationErrors);
    }
}
```

### Cleanup Test Restore Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.file.*;

@Named("cleanupTestRestoreProcessor")
@ApplicationScoped
public class CleanupTestRestoreProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        String testEnvironmentPath = exchange.getProperty("testEnvironmentPath", String.class);

        if (testEnvironmentPath != null) {
            Path testPath = Paths.get(testEnvironmentPath);
            if (Files.exists(testPath)) {
                deleteDirectory(testPath);
            }
        }

        exchange.setProperty("testEnvironmentCleaned", true);
    }

    private void deleteDirectory(Path directory) throws Exception {
        Files.walk(directory)
            .sorted((a, b) -> b.compareTo(a))
            .forEach(path -> {
                try {
                    Files.delete(path);
                } catch (Exception e) {
                    // Log but don't fail
                }
            });
    }
}
```

### Record Verification Results Processor

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

@Named("recordVerificationResultsProcessor")
@ApplicationScoped
public class RecordVerificationResultsProcessor implements Processor {

    @Inject
    TigerBeetleService tigerBeetleService;

    @Inject
    BackupMetadataService backupMetadataService;

    private static final int CODE_BACKUP = 12;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID verificationId = UUID.randomUUID();
        Instant startTime = Instant.now();

        boolean tigerBeetlePassed = exchange.getProperty("tigerBeetleVerificationPassed", Boolean.class);
        boolean duckdbPassed = exchange.getProperty("duckdbVerificationPassed", Boolean.class);
        boolean parquetPassed = exchange.getProperty("parquetVerificationPassed", Boolean.class);
        boolean kmsPassed = exchange.getProperty("kmsVerificationPassed", Boolean.class);

        boolean allPassed = tigerBeetlePassed && duckdbPassed && parquetPassed && kmsPassed;

        // Create TigerBeetle transfer (code=12, status=5 for verification)
        UUID systemAccountId = UUID.fromString("00000000-0000-0000-0000-000000000000");

        long userData128 = packVerificationMetadata(allPassed);

        Transfer verificationEvent = new Transfer(
            verificationId,
            systemAccountId,
            systemAccountId,
            1, // Verification event count
            CODE_BACKUP,
            userData128,
            startTime.getEpochSecond(),
            0 // system ledger
        );

        tigerBeetleService.createTransfers(List.of(verificationEvent));

        // Store verification results in DuckDB
        backupMetadataService.recordVerification(
            verificationId, startTime, allPassed,
            tigerBeetlePassed, duckdbPassed, parquetPassed, kmsPassed
        );

        exchange.setProperty("verificationEventId", verificationId);
        exchange.setProperty("allVerificationsPassed", allPassed);
    }

    private long packVerificationMetadata(boolean passed) {
        long userData128 = 0L;
        userData128 |= ((long) 5 & 0xFF) << 88; // status=5 (verification)
        userData128 |= ((long) (passed ? 1 : 0) & 0xFF) << 80; // verification result
        return userData128;
    }
}
```

## Testing Requirements

- [ ] Unit test: Verify backup checksum matches S3 file
- [ ] Unit test: Test restore creates isolated environment
- [ ] Unit test: Verification detects corrupted backup
- [ ] Unit test: Verification results recorded in TigerBeetle
- [ ] Integration test: Daily verification workflow
- [ ] Integration test: Monthly test restore workflow (RTO validation)
- [ ] Alert test: Failed verification triggers notification
- [ ] Coverage: 90% (per ADR-014)

## Security Considerations

- **Backup corruption detection** - SHA-256 checksum verification
- **Test restore isolation** - Use separate test environment
- **Verification logging** - All results recorded in TigerBeetle

## Success Criteria

- Daily automated verification of all backups
- Monthly test restore validates RTO <1 hour
- Failed verifications trigger immediate alerts
- Verification events immutably recorded in TigerBeetle
- 100% of backups verified within 24 hours of creation

## Public Examples

### Automated Backup Verification Tools
- **vitabaks/pgbackrest_auto**: [https://github.com/vitabaks/pgbackrest_auto](https://github.com/vitabaks/pgbackrest_auto)
  - Automatic restore and validate for PostgreSQL physical/logical corruption
  - pgbackrest validates checksums for every file copied during backup
  - Optional email reporting for validation results
  - Example of automated backup verification workflow

- **GitHub MySQL Testing Automation**: [https://github.blog/2017-07-06-mysql-testing-automation-at-github/](https://github.blog/2017-07-06-mysql-testing-automation-at-github/)
  - Automated backup verification via cron
  - Scripts restore backups and verify table data integrity
  - Checksumming entire tables for both original and restored versions
  - Example of production backup verification at scale

### AWS Backup Restore Testing
- **Automate Data Recovery Validation with AWS Backup**: [https://aws.amazon.com/blogs/storage/automate-data-recovery-validation-with-aws-backup/](https://aws.amazon.com/blogs/storage/automate-data-recovery-validation-with-aws-backup/)
  - AWS Backup + EventBridge + Lambda for automated testing
  - Aligns with AWS Well-Architected Framework best practices
  - S3RestoreValidation code validates bucket contents
  - Reports back to AWS Backup whether restoration successful

- **Implementing Restore Testing for Recovery Validation**: [https://aws.amazon.com/blogs/storage/implementing-restore-testing-for-recovery-validation-using-aws-backup/](https://aws.amazon.com/blogs/storage/implementing-restore-testing-for-recovery-validation-using-aws-backup/)
  - Test data restoration on predefined schedules
  - Validate restored data to reduce manual effort
  - Meet compliance requirements with automated testing

- **Automatic Restore Testing in AWS Backup** (2024): [https://aws.amazon.com/blogs/aws/automatic-restore-testing-and-validation-is-now-available-in-aws-backup/](https://aws.amazon.com/blogs/aws/automatic-restore-testing-and-validation-is-now-available-in-aws-backup/)
  - New feature for automatic restore testing (2024)
  - Scheduled validation of backup recoverability
  - Integration with compliance reporting

### Checksum Verification Methods
- **AWS S3 Checksum Verification**: Previously mentioned in PRD-022c
  - SHA-256, MD5, CRC32, CRC32C support
  - Automatic checksum validation during operations
  - Compare checksum values between restored resources and backup sources

- **pgbackrest Checksum Validation**: From pgbackrest_auto
  - Validates checksums for full backups (all files)
  - Validates changed files during differential/incremental backups
  - Ensures archive file consistency

### AWS Well-Architected Framework
- **REL09-BP04: Periodic Recovery Testing**: [https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_periodic_recovery_testing_data.html](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_periodic_recovery_testing_data.html)
  - Perform periodic recovery of data to verify backup integrity
  - Validate that backup process implementation meets RTO and RPO requirements
  - Test restore mechanisms to verify correctness and practice restoration

### Backup Testing Best Practices
- **Backup Verification Best Practices**: [https://www.acronis.com/en-us/blog/posts/best-practices-for-verifying-and-validating-your-backups/](https://www.acronis.com/en-us/blog/posts/best-practices-for-verifying-and-validating-your-backups/)
  - Common validation methods: data type, format, checksum, size
  - Custom validation logic for comparing checksums
  - Block checksums recorded during initial backup match validation checksums

- **Backup and Recovery Test Automation Guide**: [https://testrigor.com/blog/backup-and-recovery-test-automation/](https://testrigor.com/blog/backup-and-recovery-test-automation/)
  - Automated backup testing streamlines validation
  - Integration with existing systems (similar to FLUO's approach)
  - Scheduling, validation, and reporting features

### Test Restore Isolation Patterns
- Isolated test environment creation (similar to createTestEnvironment())
- Separate storage for test restores to avoid production impact
- Automated cleanup after verification completes
- Verification metrics tracked separately from production metrics

### Verification Reporting and Alerts
- Daily verification summary reports
- Immediate alerts on checksum mismatches
- Monthly test restore RTO validation reports
- Compliance audit trail with verification timestamps
