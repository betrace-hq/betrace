# PRD-022b: DuckDB Backup Processor

**Parent:** [PRD-022: Backup and Recovery](./022-backup-recovery.md)
**Unit:** DuckDBBackupProcessor
**Complexity:** Medium
**Est. Lines:** ~300
**Dependencies:** None (DuckDB is self-contained)

## Purpose

Export DuckDB hot tier (0-7 days) to Parquet every 24 hours with incremental exports every 6 hours to enable fast recovery of analytical data.

## Architecture Integration

- **ADR-011 (TigerBeetle-First):** Backup events recorded as TigerBeetle transfers (code=12)
- **ADR-013 (Camel-First):** Backup jobs implemented as Camel route processors
- **ADR-014 (Named Processors):** All backup logic in named CDI processors
- **ADR-015 (Tiered Storage):** Backup hot tier (DuckDB) separate from cold tier (Parquet)

## Implementation

### Backup Route (Apache Camel)

```java
package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class DuckDBBackupRoute extends RouteBuilder {
    @Override
    public void configure() throws Exception {
        // Full export every 24 hours
        from("timer:duckdb-full-export?period=86400000") // 24 hours
            .routeId("duckdb-full-export-route")
            .to("direct:export-duckdb-full");

        from("direct:export-duckdb-full")
            .process("exportDuckDBToParquetProcessor")
            .process("compressParquetProcessor")
            .process("uploadDuckDBBackupToS3Processor")
            .process("recordDuckDBBackupEventProcessor")
            .process("cleanupOldDuckDBBackupsProcessor");

        // Incremental export every 6 hours
        from("timer:duckdb-incremental-export?period=21600000") // 6 hours
            .routeId("duckdb-incremental-export-route")
            .to("direct:export-duckdb-incremental");

        from("direct:export-duckdb-incremental")
            .process("exportIncrementalChangesProcessor")
            .process("uploadDuckDBBackupToS3Processor")
            .process("recordDuckDBBackupEventProcessor");
    }
}
```

### Export DuckDB to Parquet Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.sql.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;
import javax.sql.DataSource;

@Named("exportDuckDBToParquetProcessor")
@ApplicationScoped
public class ExportDuckDBToParquetProcessor implements Processor {

    @Inject
    @io.quarkus.agroal.DataSource("duckdb")
    DataSource duckdbDataSource;

    @ConfigProperty(name = "backup.duckdb.path")
    String duckdbBackupPath;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID backupId = UUID.randomUUID();
        Instant startTime = Instant.now();

        try {
            // Create backup directory
            Path backupDir = Paths.get(duckdbBackupPath,
                "duckdb-export-" + backupId.toString());
            Files.createDirectories(backupDir);

            // Export all tables to Parquet
            try (Connection conn = duckdbDataSource.getConnection()) {
                exportTable(conn, backupDir, "signals");
                exportTable(conn, backupDir, "rules");
                exportTable(conn, backupDir, "tenants");
                exportTable(conn, backupDir, "users");
                exportTable(conn, backupDir, "notification_configs");
                exportTable(conn, backupDir, "backup_metadata");
                exportTable(conn, backupDir, "investigation_notes");
                exportTable(conn, backupDir, "investigation_events");
            }

            // Calculate total backup size
            long backupSizeBytes = Files.walk(backupDir)
                .filter(Files::isRegularFile)
                .mapToLong(p -> {
                    try {
                        return Files.size(p);
                    } catch (Exception e) {
                        return 0L;
                    }
                })
                .sum();

            // Set exchange properties
            exchange.setProperty("backupId", backupId);
            exchange.setProperty("backupType", "duckdb");
            exchange.setProperty("backupScope", "full");
            exchange.setProperty("backupPath", backupDir.toString());
            exchange.setProperty("backupSizeBytes", backupSizeBytes);
            exchange.setProperty("startTime", startTime);
            exchange.setProperty("status", "exported");

        } catch (Exception e) {
            exchange.setProperty("status", "failed");
            exchange.setProperty("errorMessage", e.getMessage());
            throw e;
        }
    }

    private void exportTable(Connection conn, Path backupDir, String tableName)
            throws SQLException {
        String parquetFile = backupDir.resolve(tableName + ".parquet").toString();

        // DuckDB's COPY TO Parquet with compression
        String sql = String.format(
            "COPY (SELECT * FROM %s) TO '%s' (FORMAT PARQUET, COMPRESSION ZSTD)",
            tableName, parquetFile
        );

        try (Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        }
    }
}
```

### Export Incremental Changes Processor

```java
package com.fluo.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.*;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;
import javax.sql.DataSource;

@Named("exportIncrementalChangesProcessor")
@ApplicationScoped
public class ExportIncrementalChangesProcessor implements Processor {

    @Inject
    @io.quarkus.agroal.DataSource("duckdb")
    DataSource duckdbDataSource;

    @Inject
    BackupMetadataService backupMetadataService;

    @Inject
    @ConfigProperty(name = "backup.duckdb.path")
    String duckdbBackupPath;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID backupId = UUID.randomUUID();
        Instant startTime = Instant.now();

        // Get last incremental backup timestamp
        Instant lastBackupTime = backupMetadataService.getLastBackupTime("duckdb", "incremental");
        if (lastBackupTime == null) {
            // No previous incremental backup, use full backup time
            lastBackupTime = backupMetadataService.getLastBackupTime("duckdb", "full");
        }

        try {
            Path backupDir = Paths.get(duckdbBackupPath,
                "duckdb-incremental-" + backupId.toString());
            Files.createDirectories(backupDir);

            // Export only rows modified since last backup
            try (Connection conn = duckdbDataSource.getConnection()) {
                exportIncrementalTable(conn, backupDir, "signals", lastBackupTime);
                exportIncrementalTable(conn, backupDir, "rules", lastBackupTime);
                exportIncrementalTable(conn, backupDir, "investigation_notes", lastBackupTime);
                exportIncrementalTable(conn, backupDir, "investigation_events", lastBackupTime);
            }

            long backupSizeBytes = Files.walk(backupDir)
                .filter(Files::isRegularFile)
                .mapToLong(p -> {
                    try {
                        return Files.size(p);
                    } catch (Exception e) {
                        return 0L;
                    }
                })
                .sum();

            exchange.setProperty("backupId", backupId);
            exchange.setProperty("backupType", "duckdb");
            exchange.setProperty("backupScope", "incremental");
            exchange.setProperty("backupPath", backupDir.toString());
            exchange.setProperty("backupSizeBytes", backupSizeBytes);
            exchange.setProperty("startTime", startTime);
            exchange.setProperty("lastBackupTime", lastBackupTime);
            exchange.setProperty("status", "exported");

        } catch (Exception e) {
            exchange.setProperty("status", "failed");
            exchange.setProperty("errorMessage", e.getMessage());
            throw e;
        }
    }

    private void exportIncrementalTable(Connection conn, Path backupDir,
                                         String tableName, Instant lastBackupTime)
            throws SQLException {
        String parquetFile = backupDir.resolve(tableName + ".parquet").toString();

        // Export only rows modified since lastBackupTime
        // Assumes tables have updated_at or created_at timestamp column
        String sql = String.format(
            "COPY (SELECT * FROM %s WHERE updated_at > '%s' OR created_at > '%s') " +
            "TO '%s' (FORMAT PARQUET, COMPRESSION ZSTD)",
            tableName, lastBackupTime.toString(), lastBackupTime.toString(), parquetFile
        );

        try (Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        }
    }
}
```

### Upload DuckDB Backup to S3 Processor

```java
package com.fluo.processors.backup;

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
import java.util.stream.Collectors;

@Named("uploadDuckDBBackupToS3Processor")
@ApplicationScoped
public class UploadDuckDBBackupToS3Processor implements Processor {

    @Inject
    S3Client s3Client;

    private static final String BUCKET_NAME = "fluo-backups";

    @Override
    public void process(Exchange exchange) throws Exception {
        String backupPath = exchange.getProperty("backupPath", String.class);
        String backupType = exchange.getProperty("backupType", String.class);
        String backupScope = exchange.getProperty("backupScope", String.class);
        String backupId = exchange.getProperty("backupId", String.class);

        Path backupDir = Paths.get(backupPath);

        // Upload each Parquet file to S3
        List<String> uploadedFiles = new ArrayList<>();
        List<Path> parquetFiles = Files.walk(backupDir)
            .filter(Files::isRegularFile)
            .filter(p -> p.toString().endsWith(".parquet"))
            .collect(Collectors.toList());

        for (Path parquetFile : parquetFiles) {
            String s3Key = String.format("%s/%s/%s/%s",
                backupType,
                backupScope,
                java.time.LocalDate.now().toString().replace("-", "/"),
                backupId + "-" + parquetFile.getFileName()
            );

            // Calculate checksum
            byte[] fileBytes = Files.readAllBytes(parquetFile);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String checksum = bytesToHex(digest.digest(fileBytes));

            // Upload to S3
            PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(BUCKET_NAME)
                .key(s3Key)
                .contentType("application/octet-stream")
                .metadata(Map.of(
                    "backup-id", backupId,
                    "backup-type", backupType,
                    "backup-scope", backupScope,
                    "checksum-sha256", checksum
                ))
                .build();

            s3Client.putObject(putRequest, RequestBody.fromFile(parquetFile));

            String s3Uri = String.format("s3://%s/%s", BUCKET_NAME, s3Key);
            uploadedFiles.add(s3Uri);
        }

        // Set exchange properties
        exchange.setProperty("s3Uris", uploadedFiles);
        exchange.setProperty("uploadedFileCount", parquetFiles.size());
        exchange.setProperty("status", "uploaded");

        // Cleanup local backup directory
        deleteDirectory(backupDir);
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

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
```

### Record DuckDB Backup Event Processor

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

@Named("recordDuckDBBackupEventProcessor")
@ApplicationScoped
public class RecordDuckDBBackupEventProcessor implements Processor {

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
        long backupSizeBytes = exchange.getProperty("backupSizeBytes", Long.class);
        List<String> s3Uris = exchange.getProperty("s3Uris", List.class);
        Instant startTime = exchange.getProperty("startTime", Instant.class);
        String status = exchange.getProperty("status", String.class);

        // Create TigerBeetle transfer (code=12)
        UUID systemAccountId = UUID.fromString("00000000-0000-0000-0000-000000000000");

        long userData128 = packBackupMetadata(
            2, // duckdb
            backupScopeToInt(backupScope),
            0, // no compression (Parquet already compressed)
            1, // no encryption (S3 server-side encryption)
            statusToInt(status),
            90 // retention_days (90 days for DuckDB backups)
        );

        Transfer backupEvent = new Transfer(
            backupId,
            systemAccountId,
            systemAccountId,
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
            String.join(",", s3Uris), null, "parquet-zstd", "s3-sse",
            java.time.LocalDate.now().plusDays(90)
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

    private int backupScopeToInt(String backupScope) {
        return switch (backupScope) {
            case "full" -> 1;
            case "incremental" -> 2;
            default -> 0;
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

- [ ] Unit test: Full export creates Parquet files for all tables
- [ ] Unit test: Incremental export only includes rows modified since last backup
- [ ] Unit test: Parquet compression reduces size vs raw CSV
- [ ] Unit test: S3 upload stores multiple Parquet files with correct metadata
- [ ] Unit test: TigerBeetle transfer created with code=12
- [ ] Integration test: Full DuckDB export workflow (export → upload → record)
- [ ] Integration test: Incremental export after full export
- [ ] Performance test: Export 100K rows completes in <30 seconds
- [ ] Coverage: 90% (per ADR-014)

## Security Considerations

- **Data leakage** - S3 server-side encryption (SSE-S3)
- **SQL injection** - Parameterized queries for table names
- **Backup tampering** - SHA-256 checksums stored in backup metadata

## Success Criteria

- Automated DuckDB full exports every 24 hours
- Automated incremental exports every 6 hours
- All backups uploaded to S3 with metadata
- Backup events immutably recorded in TigerBeetle
- Local cleanup after successful S3 upload

## Public Examples

### DuckDB Parquet Export Documentation
- **DuckDB EXPORT DATABASE**: [https://duckdb.org/docs/stable/sql/statements/export.html](https://duckdb.org/docs/stable/sql/statements/export.html)
  - Official documentation for exporting entire database to Parquet format
  - Syntax: `EXPORT DATABASE 'target_directory' (FORMAT parquet, COMPRESSION zstd, ROW_GROUP_SIZE 100_000);`
  - Exports full schema, tables, views, and sequences

- **DuckDB Parquet Export Guide**: [https://duckdb.org/docs/stable/guides/file_formats/parquet_export.html](https://duckdb.org/docs/stable/guides/file_formats/parquet_export.html)
  - Complete guide to exporting individual tables and query results
  - COPY command examples: `COPY tbl TO 'output.parquet' (FORMAT parquet);`
  - Query export: `COPY (SELECT * FROM tbl) TO 'output.parquet' (FORMAT parquet);`

- **DuckDB S3 Parquet Export**: [https://duckdb.org/docs/stable/guides/network_cloud_storage/s3_export.html](https://duckdb.org/docs/stable/guides/network_cloud_storage/s3_export.html)
  - Direct export to S3: `COPY table_name TO 's3://s3-bucket/filename.parquet';`
  - Requires httpfs extension configured with AWS credentials

- **DuckDB Partitioned Writes**: [https://motherduck.com/learn-more/partitioned-writes-parquet-ducklake/](https://motherduck.com/learn-more/partitioned-writes-parquet-ducklake/)
  - Fast data exports with partitioned writes (Hive-style)
  - PARTITION_BY example: `COPY pg.sales to 'pg-sales' (format parquet, partition_by (year));`
  - APPEND TRUE for incremental backups without deleting existing data

### DuckDB Incremental Backup Strategies
- **DuckDB GitHub Discussion - Partitioning**: [https://github.com/duckdb/duckdb/discussions/6213](https://github.com/duckdb/duckdb/discussions/6213)
  - Export table with Hive-style partitioning for efficient incremental backups
  - Example: `COPY orders TO 'output_orders_parquet' (FORMAT PARQUET, PARTITION_BY (year, month), APPEND TRUE);`

- **Medium Article - Quick Data Exports**: [https://medium.com/@josef.machytka/quick-and-easy-data-exports-to-parquet-format-using-duckdb-808fb654810e](https://medium.com/@josef.machytka/quick-and-easy-data-exports-to-parquet-format-using-duckdb-808fb654810e)
  - Practical examples of exporting DuckDB data to Parquet
  - Demonstrates compression options (ZSTD recommended for best compression)

### Database Backup to S3 Examples
- **Saicheg/pg-backups-to-s3**: [https://github.com/Saicheg/pg-backups-to-s3](https://github.com/Saicheg/pg-backups-to-s3)
  - PostgreSQL backup tool with S3 upload, encryption, and compression
  - Similar multi-stage backup pattern applicable to DuckDB exports

- **AlexanderBabel/database-s3-backup**: [https://github.com/AlexanderBabel/database-s3-backup](https://github.com/AlexanderBabel/database-s3-backup)
  - Multi-database backup tool (MongoDB, PostgreSQL, MySQL)
  - Demonstrates scheduled backups with compression and S3 upload

### Parquet Compression Benchmarks
- **DuckDB GitHub Issue #10108**: [https://github.com/duckdb/duckdb/issues/10108](https://github.com/duckdb/duckdb/issues/10108)
  - Discussion of Parquet compression codecs (ZSTD vs others)
  - Performance comparison of different compression options
