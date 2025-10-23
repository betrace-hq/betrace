package com.betrace.services;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

/**
 * Scheduled job for archiving violations to Parquet.
 *
 * Architecture (Tempo-inspired):
 * - DuckDB hot storage (7 days) → Fast queries
 * - Parquet cold storage (long-term) → Compressed archival
 * - Automatic daily export with cleanup
 * - Size-based file splitting (optimal: 128MB-512MB per file)
 *
 * Schedule:
 * - Daily at 2:00 AM: Export previous day to Parquet
 * - Delete violations older than retention period from DuckDB
 *
 * Parquet File Strategy:
 * - Target size: 256MB per file (configurable)
 * - Multiple files per day if needed (violations-2025-01-22-001.parquet, -002.parquet)
 * - Row groups: 100k violations per group
 * - ZSTD compression + dictionary encoding
 *
 * Why 256MB target:
 * - Row group pruning efficiency (skip irrelevant data)
 * - Parallel reads across multiple files
 * - Memory-efficient (no OOM on large files)
 * - S3/GCS object storage sweet spot
 *
 * Parquet Benefits:
 * - 15-20x compression (dictionary encoding on rule_id, severity)
 * - Queryable with DuckDB, Spark, or other Parquet tools
 * - S3/GCS compatible for object storage upload
 *
 * Configuration:
 * - fluo.violations.archival.enabled (default: true)
 * - fluo.violations.archival.target-file-size-mb (default: 256)
 * - fluo.violations.hot-retention-days (default: 7)
 */
@ApplicationScoped
public class ViolationArchiver {

    private static final Logger log = LoggerFactory.getLogger(ViolationArchiver.class);

    @Inject
    @ConfigProperty(name = "fluo.violations.archival.enabled", defaultValue = "true")
    boolean archivalEnabled;

    @Inject
    @ConfigProperty(name = "fluo.violations.archival.target-file-size-mb", defaultValue = "256")
    int targetFileSizeMB;

    @Inject
    ViolationStore violationStore;

    /**
     * Archive yesterday's violations to Parquet (daily at 2:00 AM).
     *
     * Strategy:
     * 1. Count total violations for the day
     * 2. Estimate file size (avg ~500 bytes per violation after compression)
     * 3. Split into multiple files if needed (256MB target)
     * 4. Export each file with sequential naming
     *
     * File naming: violations-YYYY-MM-DD-NNN.parquet
     * - violations-2025-01-22-001.parquet (first 256MB)
     * - violations-2025-01-22-002.parquet (next 256MB)
     * - violations-2025-01-22-003.parquet (remaining)
     */
    @Scheduled(cron = "0 0 2 * * ?")  // 2:00 AM daily
    void archiveViolationsDaily() {
        if (!archivalEnabled) {
            log.debug("Violation archival disabled");
            return;
        }

        try {
            LocalDate yesterday = LocalDate.now().minusDays(1);

            log.info("Starting violation archival for {} (target file size: {}MB)",
                yesterday, targetFileSizeMB);

            // Export to Parquet with size-based splitting
            List<Path> parquetFiles = violationStore.exportToParquetWithSplitting(
                yesterday,
                targetFileSizeMB
            );

            log.info("Successfully archived violations for {} to {} file(s): {}",
                yesterday, parquetFiles.size(), parquetFiles);

            // TODO: Upload to S3/GCS for cold storage
            // for (Path file : parquetFiles) {
            //     objectStorage.upload(file, "violations/" + file.getFileName());
            // }

        } catch (Exception e) {
            log.error("Failed to archive violations", e);
        }
    }

    /**
     * Delete old violations from DuckDB hot storage (daily at 3:00 AM).
     *
     * Runs after archival to ensure data is exported before deletion.
     */
    @Scheduled(cron = "0 0 3 * * ?")  // 3:00 AM daily (after archival)
    void cleanupOldViolations() {
        if (!archivalEnabled) {
            log.debug("Violation cleanup disabled");
            return;
        }

        try {
            log.info("Starting violation cleanup");

            int deleted = violationStore.deleteOldViolations();

            log.info("Cleaned up {} old violations from hot storage", deleted);

        } catch (Exception e) {
            log.error("Failed to cleanup old violations", e);
        }
    }
}
