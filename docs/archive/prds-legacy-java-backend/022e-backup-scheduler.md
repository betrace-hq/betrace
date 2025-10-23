# PRD-022e: Backup Scheduler

**Parent:** [PRD-022: Backup and Recovery](./022-backup-recovery.md)
**Unit:** BackupScheduler
**Complexity:** Low
**Est. Lines:** ~250
**Dependencies:** PRD-022a, PRD-022b, PRD-022c, PRD-022d

## Purpose

Coordinate all backup jobs with configurable schedules and dependency management to ensure backups run in correct order and don't overlap.

## Architecture Integration

- **ADR-011 (TigerBeetle-First):** Scheduler state stored as TigerBeetle transfers
- **ADR-013 (Camel-First):** Scheduler implemented as Camel route processors
- **ADR-014 (Named Processors):** All scheduling logic in named CDI processors

## Implementation

### Backup Scheduler Route (Apache Camel)

```java
package com.betrace.routes;

import org.apache.camel.builder.RouteBuilder;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class BackupSchedulerRoute extends RouteBuilder {
    @Override
    public void configure() throws Exception {
        // Master scheduler (runs every 5 minutes)
        from("timer:backup-scheduler?period=300000") // 5 minutes
            .routeId("backup-scheduler-route")
            .to("direct:schedule-backups");

        from("direct:schedule-backups")
            .process("checkScheduledBackupsProcessor")
            .choice()
                .when(simple("${exchangeProperty.shouldRunTigerBeetleSnapshot}"))
                    .to("direct:snapshot-tigerbeetle")
                .when(simple("${exchangeProperty.shouldRunTigerBeetleLogs}"))
                    .to("direct:backup-tigerbeetle-logs")
                .when(simple("${exchangeProperty.shouldRunDuckDBFull}"))
                    .to("direct:export-duckdb-full")
                .when(simple("${exchangeProperty.shouldRunDuckDBIncremental}"))
                    .to("direct:export-duckdb-incremental")
                .when(simple("${exchangeProperty.shouldRunParquetReplication}"))
                    .to("direct:replicate-parquet-files")
            .end();

        // On-demand backup trigger
        from("direct:trigger-backup")
            .process("validateBackupTriggerProcessor")
            .choice()
                .when(simple("${exchangeProperty.backupType} == 'tigerbeetle'"))
                    .to("direct:snapshot-tigerbeetle")
                .when(simple("${exchangeProperty.backupType} == 'duckdb'"))
                    .to("direct:export-duckdb-full")
                .when(simple("${exchangeProperty.backupType} == 'parquet'"))
                    .to("direct:replicate-parquet-files")
                .when(simple("${exchangeProperty.backupType} == 'kms'"))
                    .to("direct:backup-kms-key")
            .end();
    }
}
```

### Check Scheduled Backups Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.*;
import java.util.*;

@Named("checkScheduledBackupsProcessor")
@ApplicationScoped
public class CheckScheduledBackupsProcessor implements Processor {

    @Inject
    BackupMetadataService backupMetadataService;

    @Inject
    BackupScheduleConfig backupScheduleConfig;

    @Override
    public void process(Exchange exchange) throws Exception {
        Instant now = Instant.now();

        // Check TigerBeetle snapshot (every 6 hours)
        Instant lastTigerBeetleSnapshot = backupMetadataService.getLastBackupTime(
            "tigerbeetle", "full");
        boolean shouldRunTigerBeetleSnapshot = shouldRunBackup(
            lastTigerBeetleSnapshot, now, Duration.ofHours(6));

        // Check TigerBeetle logs (every 15 minutes)
        Instant lastTigerBeetleLogs = backupMetadataService.getLastBackupTime(
            "tigerbeetle", "incremental");
        boolean shouldRunTigerBeetleLogs = shouldRunBackup(
            lastTigerBeetleLogs, now, Duration.ofMinutes(15));

        // Check DuckDB full export (every 24 hours)
        Instant lastDuckDBFull = backupMetadataService.getLastBackupTime(
            "duckdb", "full");
        boolean shouldRunDuckDBFull = shouldRunBackup(
            lastDuckDBFull, now, Duration.ofHours(24));

        // Check DuckDB incremental (every 6 hours)
        Instant lastDuckDBIncremental = backupMetadataService.getLastBackupTime(
            "duckdb", "incremental");
        boolean shouldRunDuckDBIncremental = shouldRunBackup(
            lastDuckDBIncremental, now, Duration.ofHours(6));

        // Check Parquet replication (every 1 hour)
        Instant lastParquetReplication = backupMetadataService.getLastBackupTime(
            "parquet", "full");
        boolean shouldRunParquetReplication = shouldRunBackup(
            lastParquetReplication, now, Duration.ofHours(1));

        // Check for running backups (prevent overlap)
        boolean anyBackupRunning = backupMetadataService.isAnyBackupRunning();
        if (anyBackupRunning) {
            // Don't start new backups if one is already running
            shouldRunTigerBeetleSnapshot = false;
            shouldRunTigerBeetleLogs = false;
            shouldRunDuckDBFull = false;
            shouldRunDuckDBIncremental = false;
            shouldRunParquetReplication = false;
        }

        // Set exchange properties
        exchange.setProperty("shouldRunTigerBeetleSnapshot", shouldRunTigerBeetleSnapshot);
        exchange.setProperty("shouldRunTigerBeetleLogs", shouldRunTigerBeetleLogs);
        exchange.setProperty("shouldRunDuckDBFull", shouldRunDuckDBFull);
        exchange.setProperty("shouldRunDuckDBIncremental", shouldRunDuckDBIncremental);
        exchange.setProperty("shouldRunParquetReplication", shouldRunParquetReplication);
    }

    private boolean shouldRunBackup(Instant lastBackup, Instant now, Duration interval) {
        if (lastBackup == null) {
            return true; // Never run before, should run now
        }
        Duration elapsed = Duration.between(lastBackup, now);
        return elapsed.compareTo(interval) >= 0;
    }
}
```

### Validate Backup Trigger Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.*;

@Named("validateBackupTriggerProcessor")
@ApplicationScoped
public class ValidateBackupTriggerProcessor implements Processor {

    @Inject
    BackupMetadataService backupMetadataService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String backupType = exchange.getProperty("backupType", String.class);
        UUID tenantId = exchange.getProperty("tenantId", UUID.class);

        // Validate backup type
        if (backupType == null || !isValidBackupType(backupType)) {
            throw new IllegalArgumentException("Invalid backup type: " + backupType);
        }

        // Check if backup already running for this type
        boolean backupRunning = backupMetadataService.isBackupRunning(backupType);
        if (backupRunning) {
            throw new IllegalStateException(
                "Backup already running for type: " + backupType);
        }

        // For KMS backups, validate tenant exists
        if ("kms".equals(backupType)) {
            if (tenantId == null) {
                throw new IllegalArgumentException("Tenant ID required for KMS backup");
            }
        }

        exchange.setProperty("backupValidated", true);
    }

    private boolean isValidBackupType(String backupType) {
        return Set.of("tigerbeetle", "duckdb", "parquet", "kms").contains(backupType);
    }
}
```

### Backup Schedule Configuration

```java
package com.betrace.config;

import io.smallrye.config.ConfigMapping;
import java.time.Duration;

@ConfigMapping(prefix = "backup.schedule")
public interface BackupScheduleConfig {

    /**
     * TigerBeetle snapshot interval (default: 6 hours)
     */
    Duration tigerBeetleSnapshotInterval();

    /**
     * TigerBeetle log backup interval (default: 15 minutes)
     */
    Duration tigerBeetleLogInterval();

    /**
     * DuckDB full export interval (default: 24 hours)
     */
    Duration duckdbFullInterval();

    /**
     * DuckDB incremental export interval (default: 6 hours)
     */
    Duration duckdbIncrementalInterval();

    /**
     * Parquet replication interval (default: 1 hour)
     */
    Duration parquetReplicationInterval();

    /**
     * Enable scheduled backups (default: true)
     */
    boolean enabled();
}
```

### Backup Schedule REST API

```java
package com.betrace.routes;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class BackupScheduleApiRoute extends RouteBuilder {
    @Override
    public void configure() throws Exception {
        restConfiguration()
            .component("netty-http")
            .bindingMode(RestBindingMode.json);

        rest("/api/backups")
            .post("/trigger")
                .description("Trigger on-demand backup")
                .consumes("application/json")
                .to("direct:trigger-backup-api")

            .get("/schedule")
                .description("Get backup schedule status")
                .to("direct:get-backup-schedule")

            .get("/history")
                .description("Get backup history")
                .to("direct:get-backup-history");

        from("direct:trigger-backup-api")
            .process("extractBackupTriggerParamsProcessor")
            .to("direct:trigger-backup");

        from("direct:get-backup-schedule")
            .process("getBackupScheduleStatusProcessor");

        from("direct:get-backup-history")
            .process("getBackupHistoryProcessor");
    }
}
```

### Extract Backup Trigger Params Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

@Named("extractBackupTriggerParamsProcessor")
@ApplicationScoped
public class ExtractBackupTriggerParamsProcessor implements Processor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void process(Exchange exchange) throws Exception {
        String body = exchange.getIn().getBody(String.class);
        Map<String, Object> params = objectMapper.readValue(body, Map.class);

        String backupType = (String) params.get("backupType");
        String tenantIdStr = (String) params.get("tenantId");

        exchange.setProperty("backupType", backupType);
        if (tenantIdStr != null) {
            exchange.setProperty("tenantId", UUID.fromString(tenantIdStr));
        }
    }
}
```

### Get Backup Schedule Status Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.*;

@Named("getBackupScheduleStatusProcessor")
@ApplicationScoped
public class GetBackupScheduleStatusProcessor implements Processor {

    @Inject
    BackupMetadataService backupMetadataService;

    @Inject
    BackupScheduleConfig backupScheduleConfig;

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> response = new HashMap<>();
        response.put("enabled", backupScheduleConfig.enabled());

        List<Map<String, Object>> schedules = new ArrayList<>();

        // TigerBeetle snapshot
        schedules.add(createScheduleStatus(
            "tigerbeetle-snapshot", "full",
            backupScheduleConfig.tigerBeetleSnapshotInterval()
        ));

        // TigerBeetle logs
        schedules.add(createScheduleStatus(
            "tigerbeetle-logs", "incremental",
            backupScheduleConfig.tigerBeetleLogInterval()
        ));

        // DuckDB full
        schedules.add(createScheduleStatus(
            "duckdb-full", "full",
            backupScheduleConfig.duckdbFullInterval()
        ));

        // DuckDB incremental
        schedules.add(createScheduleStatus(
            "duckdb-incremental", "incremental",
            backupScheduleConfig.duckdbIncrementalInterval()
        ));

        // Parquet replication
        schedules.add(createScheduleStatus(
            "parquet-replication", "full",
            backupScheduleConfig.parquetReplicationInterval()
        ));

        response.put("schedules", schedules);

        exchange.getIn().setBody(response);
    }

    private Map<String, Object> createScheduleStatus(String name, String scope,
                                                      java.time.Duration interval)
            throws java.sql.SQLException {
        Instant lastBackup = backupMetadataService.getLastBackupTime(
            name.split("-")[0], scope);

        Map<String, Object> status = new HashMap<>();
        status.put("name", name);
        status.put("interval", interval.toString());
        status.put("lastBackup", lastBackup != null ? lastBackup.toString() : null);

        if (lastBackup != null) {
            Instant nextBackup = lastBackup.plus(interval);
            status.put("nextBackup", nextBackup.toString());
        }

        return status;
    }
}
```

### Get Backup History Processor

```java
package com.betrace.processors.backup;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.inject.Named;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.*;
import java.util.*;
import javax.sql.DataSource;

@Named("getBackupHistoryProcessor")
@ApplicationScoped
public class GetBackupHistoryProcessor implements Processor {

    @Inject
    @io.quarkus.agroal.DataSource("duckdb")
    DataSource duckdbDataSource;

    @Override
    public void process(Exchange exchange) throws Exception {
        String backupType = exchange.getIn().getHeader("backupType", String.class);
        Integer limit = exchange.getIn().getHeader("limit", Integer.class);
        if (limit == null) limit = 50;

        String sql = """
            SELECT id, backup_type, backup_scope, start_time, end_time, status,
                   backup_size_bytes, backup_location, checksum
            FROM backup_metadata
            """ + (backupType != null ? "WHERE backup_type = ? " : "") + """
            ORDER BY start_time DESC
            LIMIT ?
            """;

        List<Map<String, Object>> history = new ArrayList<>();

        try (Connection conn = duckdbDataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            int paramIndex = 1;
            if (backupType != null) {
                stmt.setString(paramIndex++, backupType);
            }
            stmt.setInt(paramIndex, limit);

            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> backup = new HashMap<>();
                backup.put("id", rs.getObject("id"));
                backup.put("backupType", rs.getString("backup_type"));
                backup.put("backupScope", rs.getString("backup_scope"));
                backup.put("startTime", rs.getTimestamp("start_time").toInstant().toString());
                backup.put("endTime", rs.getTimestamp("end_time").toInstant().toString());
                backup.put("status", rs.getString("status"));
                backup.put("backupSizeBytes", rs.getLong("backup_size_bytes"));
                backup.put("backupLocation", rs.getString("backup_location"));
                backup.put("checksum", rs.getString("checksum"));
                history.add(backup);
            }
        }

        exchange.getIn().setBody(history);
    }
}
```

## Testing Requirements

- [ ] Unit test: Scheduled backup triggered when interval elapsed
- [ ] Unit test: Scheduled backup skipped when already running
- [ ] Unit test: On-demand backup validates backup type
- [ ] Unit test: Backup history API returns last 50 backups
- [ ] Integration test: Full scheduler workflow with all backup types
- [ ] Performance test: Scheduler overhead <10ms per check
- [ ] Coverage: 90% (per ADR-014)

## Security Considerations

- **Unauthorized triggers** - RBAC on backup trigger API (admin only)
- **Resource exhaustion** - Prevent overlapping backups
- **Schedule manipulation** - Config changes require deployment

## Success Criteria

- All backups run on schedule without manual intervention
- No overlapping backups (mutual exclusion)
- On-demand backup triggers work for all types
- Backup history API provides visibility
- Configurable schedules via application.properties

## Public Examples

### Apache Camel Timer and Cron Scheduling
- **yauritux/camel-dynamic-scheduler**: [https://github.com/yauritux/camel-dynamic-scheduler](https://github.com/yauritux/camel-dynamic-scheduler)
  - Sample project for dynamic scheduler based on cron attributes
  - Demonstrates Apache Camel with configurable schedules
  - Example of timer-based route patterns

- **Camel Timer Component**: [https://camel.apache.org/components/4.0.x/timer-component.html](https://camel.apache.org/components/4.0.x/timer-component.html)
  - Simple scheduling with period parameter
  - Part of camel-core, no additional dependencies
  - Example: `from("timer:tigerbeetle-snapshot?period=21600000")`

- **Camel Quartz Component**: [https://camel.apache.org/components/4.0.x/quartz-component.html](https://camel.apache.org/components/4.0.x/quartz-component.html)
  - Cron expression support for complex schedules
  - Example: `from("quartz://backup?cron=0+0+16+?+*+MON-FRI")`
  - Used for weekday/hour-specific scheduling

- **Camel Scheduler Component**: [https://camel.apache.org/components/4.0.x/scheduler-component.html](https://camel.apache.org/components/4.0.x/scheduler-component.html)
  - Part of camel-core with cron expression support
  - Example: `from("scheduler://foo?scheduler=quartz2&scheduler.cron=[expression]")`

### Distributed Job Scheduler Patterns
- **Design a Distributed Job Scheduler**: [https://blog.algomaster.io/p/design-a-distributed-job-scheduler](https://blog.algomaster.io/p/design-a-distributed-job-scheduler)
  - System design interview guide for distributed schedulers
  - Coordinator and worker node patterns
  - Heartbeat mechanisms for failure detection
  - Job queue management and workload distribution

- **jhuckaby/Cronicle**: [https://github.com/jhuckaby/Cronicle](https://github.com/jhuckaby/Cronicle)
  - Multi-server task scheduler with web-based UI
  - Handles scheduled, repeating, and on-demand jobs
  - Automated failover to backup servers
  - Example of distributed coordination similar to backup scheduling

- **kagkarlsson/db-scheduler**: [https://github.com/kagkarlsson/db-scheduler](https://github.com/kagkarlsson/db-scheduler)
  - Persistent cluster-friendly scheduler for Java
  - Non-invasive design solving persistence and cluster-coordination
  - Example of database-backed job scheduling
  - Similar pattern to BackupMetadataService tracking

### Job Coordination Patterns
- **Quartz Job Scheduler**: [https://github.com/quartz-scheduler](https://github.com/quartz-scheduler)
  - Enterprise-class job scheduling library
  - Triggers, job stores, clustering support
  - Used by Apache Camel Quartz component

- **OpenSearch Job-Scheduler**: [https://github.com/opensearch-project/job-scheduler](https://github.com/opensearch-project/job-scheduler)
  - Framework for scheduling periodical jobs
  - Intervals or Unix Cron expressions
  - Example of plugin-based scheduler architecture

### Mutual Exclusion and Overlap Prevention
- **Distributed Lock Patterns**: Various implementations
  - Database-based locks (similar to isAnyBackupRunning() check)
  - Redis-based distributed locks
  - ZooKeeper coordination for job exclusivity

### Backup Scheduling Best Practices
- Prevent overlapping backups with status checks
- Heartbeat monitoring for backup job health
- Configurable schedules via external configuration
- On-demand triggers for testing and emergency backups
- Audit trail of all scheduled and manual triggers
