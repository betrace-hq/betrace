# PRD-002d: Trace Archival Pipeline

**Priority:** P1 (Not Blocking MVP)
**Complexity:** Medium
**Personas:** SREs, Compliance
**Dependencies:** PRD-002b (DuckDB hot storage), PRD-002c (Cold storage abstraction)
**Implementation Status:** ✅ READY - Dependencies clear, testable in isolation

## Problem

Hot trace storage (DuckDB) has **limited retention** (7 days default):
- **Storage Costs:** DuckDB files grow indefinitely without archival
- **Compliance Requirements:** Need 365-day retention for audit
- **Query Performance:** Large DuckDB files slow down recent trace queries
- **No Automated Cleanup:** Manual intervention required to free disk space

**Impact:**
- ❌ Disk fills up in production (no automated cleanup)
- ❌ Cannot meet compliance retention requirements
- ❌ Query performance degrades as DuckDB grows
- ❌ High storage costs (SSD for all traces)

**Current State:**
- DuckDB files grow without limit
- No archival process
- No cold storage integration

## Solution

### Architecture

**Two-Phase Archival Process:**
1. **Phase 1: Export & Verify** (safe, reversible)
   - Export DuckDB traces to Parquet
   - Upload Parquet to cold storage
   - Verify upload integrity (checksum + row count)
   - Record archival event in TigerBeetle

2. **Phase 2: Cleanup** (only if Phase 1 succeeds)
   - Delete archived traces from DuckDB
   - Log cleanup event

**Why Two-Phase:**
- **Safety:** Never delete data before verifying successful upload
- **Audit Trail:** TigerBeetle records successful archival (immutable)
- **Recovery:** If Phase 2 fails, traces remain in DuckDB (retry next cycle)

**Scheduling:** Daily at 2 AM (configurable via cron expression)

### Camel Route Architecture

**`com/fluo/routes/ArchivalRoute.java`:**
```java
@ApplicationScoped
public class ArchivalRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Daily archival timer (2 AM)
        from("quartz:archival?cron=0+0+2+*+*+?")
            .routeId("dailyArchival")
            .to("direct:archive-all-tenants");

        // Archive all tenants
        from("direct:archive-all-tenants")
            .routeId("archiveAllTenants")
            .process("identifyTenantsForArchivalProcessor")
            .split(body()).parallelProcessing()
                .to("direct:archive-tenant");

        // Archive single tenant (two-phase commit)
        from("direct:archive-tenant")
            .routeId("archiveTenant")
            .process("identifyArchivableDatesProcessor")
            .split(body())
                .to("direct:archive-tenant-date");

        // Archive traces for single tenant-date
        from("direct:archive-tenant-date")
            .routeId("archiveTenantDate")
            .onException(Exception.class)
                .handled(true)
                .to("direct:archival-error-handler")
            .end()
            // Phase 1: Safe operations (reversible)
            .to("direct:export-to-parquet")
            .to("direct:upload-to-cold-storage")
            .to("direct:verify-upload-integrity")
            .to("direct:record-archival-event")
            // Phase 2: Cleanup (only if Phase 1 succeeded)
            .choice()
                .when(header("archivalVerified").isEqualTo(true))
                    .to("direct:delete-archived-traces")
                    .to("direct:emit-archival-success-metric")
                .otherwise()
                    .log("Archival verification failed, skipping cleanup")
                    .to("direct:emit-archival-failure-metric");

        // Phase 1 routes

        from("direct:export-to-parquet")
            .routeId("exportToParquet")
            .process("exportDuckDBToParquetProcessor");

        from("direct:upload-to-cold-storage")
            .routeId("uploadToColdStorage")
            .process("uploadParquetProcessor");

        from("direct:verify-upload-integrity")
            .routeId("verifyUploadIntegrity")
            .process("verifyParquetIntegrityProcessor");

        from("direct:record-archival-event")
            .routeId("recordArchivalEvent")
            .process("recordArchivalEventProcessor");

        // Phase 2 routes

        from("direct:delete-archived-traces")
            .routeId("deleteArchivedTraces")
            .process("deleteArchivedTracesProcessor");

        // Error handling

        from("direct:archival-error-handler")
            .routeId("archivalErrorHandler")
            .process("logArchivalErrorProcessor")
            .process("emitArchivalFailureSpanProcessor");
    }
}
```

### Processors

#### Phase 1: Export to Parquet

**`com/fluo/processors/archival/ExportDuckDBToParquetProcessor.java`:**
```java
@Named("exportDuckDBToParquetProcessor")
@ApplicationScoped
public class ExportDuckDBToParquetProcessor implements Processor {

    @Inject
    DuckDBService duckdb;

    private static final Logger log = LoggerFactory.getLogger(ExportDuckDBToParquetProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        LocalDate date = exchange.getIn().getHeader("archivalDate", LocalDate.class);

        log.info("Exporting traces for tenant {} date {} to Parquet", tenantId, date);

        try {
            // Export from DuckDB to Parquet file
            Path parquetFile = duckdb.exportToParquet(tenantId, date);

            // Compute checksum for verification
            String checksum = computeSHA256(parquetFile);

            // Count rows for verification
            long rowCount = countParquetRows(parquetFile);

            // Store in exchange for next processors
            exchange.getIn().setHeader("parquetFile", parquetFile);
            exchange.getIn().setHeader("localChecksum", checksum);
            exchange.getIn().setHeader("localRowCount", rowCount);

            log.info("Exported {} rows to Parquet: {}", rowCount, parquetFile);

        } catch (Exception e) {
            log.error("Failed to export Parquet for tenant {} date {}", tenantId, date, e);
            throw e;
        }
    }

    private String computeSHA256(Path file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream is = Files.newInputStream(file)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = is.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
        }
        return Hex.encodeHexString(digest.digest());
    }

    private long countParquetRows(Path file) throws Exception {
        // Use DuckDB to count rows in Parquet
        try (Connection conn = DriverManager.getConnection("jdbc:duckdb:")) {
            String sql = "SELECT COUNT(*) FROM read_parquet(?)";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, file.toString());
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        }
        return 0;
    }
}
```

#### Phase 1: Upload to Cold Storage

**`com/fluo/processors/archival/UploadParquetProcessor.java`:**
```java
@Named("uploadParquetProcessor")
@ApplicationScoped
public class UploadParquetProcessor implements Processor {

    @Inject
    ColdStorageService coldStorage;

    private static final Logger log = LoggerFactory.getLogger(UploadParquetProcessor.class);

    @ConfigProperty(name = "fluo.archival.upload.retries", defaultValue = "3")
    int maxRetries;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        LocalDate date = exchange.getIn().getHeader("archivalDate", LocalDate.class);
        Path parquetFile = exchange.getIn().getHeader("parquetFile", Path.class);

        log.info("Uploading Parquet to cold storage: tenant {} date {}", tenantId, date);

        Exception lastException = null;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String storageUri = coldStorage.storeParquet(tenantId, date, parquetFile);

                exchange.getIn().setHeader("storageUri", storageUri);
                log.info("Upload succeeded on attempt {}: {}", attempt, storageUri);

                return;

            } catch (Exception e) {
                lastException = e;
                log.warn("Upload attempt {} failed: {}", attempt, e.getMessage());

                if (attempt < maxRetries) {
                    Thread.sleep(1000 * attempt); // Exponential backoff
                }
            }
        }

        throw new RuntimeException("Upload failed after " + maxRetries + " attempts", lastException);
    }
}
```

#### Phase 1: Verify Integrity

**`com/fluo/processors/archival/VerifyParquetIntegrityProcessor.java`:**
```java
@Named("verifyParquetIntegrityProcessor")
@ApplicationScoped
public class VerifyParquetIntegrityProcessor implements Processor {

    @Inject
    ColdStorageService coldStorage;

    private static final Logger log = LoggerFactory.getLogger(VerifyParquetIntegrityProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        LocalDate date = exchange.getIn().getHeader("archivalDate", LocalDate.class);
        String storageUri = exchange.getIn().getHeader("storageUri", String.class);
        String localChecksum = exchange.getIn().getHeader("localChecksum", String.class);
        long localRowCount = exchange.getIn().getHeader("localRowCount", Long.class);

        log.info("Verifying upload integrity: tenant {} date {}", tenantId, date);

        try {
            // Download from cold storage
            Path downloadedFile = coldStorage.retrieveParquet(storageUri);

            // Verify checksum
            String remoteChecksum = computeSHA256(downloadedFile);
            if (!localChecksum.equals(remoteChecksum)) {
                throw new RuntimeException(String.format(
                    "Checksum mismatch: local=%s, remote=%s", localChecksum, remoteChecksum
                ));
            }

            // Verify row count
            long remoteRowCount = countParquetRows(downloadedFile);
            if (localRowCount != remoteRowCount) {
                throw new RuntimeException(String.format(
                    "Row count mismatch: local=%d, remote=%d", localRowCount, remoteRowCount
                ));
            }

            // Verification succeeded
            exchange.getIn().setHeader("archivalVerified", true);
            log.info("Upload verification succeeded: {} rows, checksum matches", remoteRowCount);

        } catch (Exception e) {
            log.error("Upload verification failed: {}", e.getMessage());
            exchange.getIn().setHeader("archivalVerified", false);
            throw e;
        }
    }

    private String computeSHA256(Path file) throws Exception {
        // Same as ExportDuckDBToParquetProcessor
    }

    private long countParquetRows(Path file) throws Exception {
        // Same as ExportDuckDBToParquetProcessor
    }
}
```

#### Phase 1: Record Event

**`com/fluo/processors/archival/RecordArchivalEventProcessor.java`:**
```java
@Named("recordArchivalEventProcessor")
@ApplicationScoped
public class RecordArchivalEventProcessor implements Processor {

    @Inject
    TigerBeetleService tb;

    @Inject
    ComplianceSpanProcessor complianceSpanProcessor;

    private static final Logger log = LoggerFactory.getLogger(RecordArchivalEventProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        LocalDate date = exchange.getIn().getHeader("archivalDate", LocalDate.class);
        String storageUri = exchange.getIn().getHeader("storageUri", String.class);
        long rowCount = exchange.getIn().getHeader("localRowCount", Long.class);
        boolean verified = exchange.getIn().getHeader("archivalVerified", Boolean.class);

        if (!verified) {
            log.warn("Skipping archival event record: verification failed");
            return;
        }

        // Record immutable archival event in TigerBeetle
        UUID eventId = UUID.randomUUID();
        tb.recordArchivalEvent(eventId, tenantId, date, storageUri, rowCount);

        // Emit compliance span (SOC2 CC7.2: System monitoring)
        complianceSpanProcessor.startComplianceSpan(
            "storage.archival.completed",
            SOC2Controls.CC7_2.class
        ).setAttribute("tenant.id", tenantId.toString())
         .setAttribute("archival.date", date.toString())
         .setAttribute("archival.uri", storageUri)
         .setAttribute("archival.row_count", String.valueOf(rowCount))
         .end();

        log.info("Recorded archival event: tenant {} date {} → {}", tenantId, date, storageUri);
    }
}
```

#### Phase 2: Delete Archived Traces

**`com/fluo/processors/archival/DeleteArchivedTracesProcessor.java`:**
```java
@Named("deleteArchivedTracesProcessor")
@ApplicationScoped
public class DeleteArchivedTracesProcessor implements Processor {

    @Inject
    DuckDBService duckdb;

    private static final Logger log = LoggerFactory.getLogger(DeleteArchivedTracesProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        LocalDate date = exchange.getIn().getHeader("archivalDate", LocalDate.class);

        log.info("Deleting archived traces from DuckDB: tenant {} date {}", tenantId, date);

        try {
            int deleted = duckdb.deleteTracesForDate(tenantId, date);

            exchange.getIn().setHeader("deletedTraceCount", deleted);
            log.info("Deleted {} traces from DuckDB", deleted);

        } catch (Exception e) {
            log.error("Failed to delete archived traces: {}", e.getMessage());
            // Don't throw - traces will be deleted next cycle
        }
    }
}
```

### Configuration

**`application.properties`:**
```properties
# Archival Pipeline
fluo.archival.enabled=true
fluo.archival.schedule=0 0 2 * * ?  # Daily at 2 AM
fluo.archival.upload.retries=3
fluo.archival.upload.timeout-seconds=300
fluo.archival.delete-after-days=7  # Must match hot retention
```

### Observability

**Metrics:**
```java
// Archival metrics
metricRegistry.timer("archival.export.duration", "tenant", tenantId).update(duration);
metricRegistry.timer("archival.upload.duration", "tenant", tenantId).update(duration);
metricRegistry.counter("archival.rows", "tenant", tenantId).inc(rowCount);
metricRegistry.counter("archival.success", "tenant", tenantId).inc();
metricRegistry.counter("archival.failed", "tenant", tenantId, "phase", phase).inc();

// Storage metrics
metricRegistry.gauge("storage.duckdb.size_bytes", "tenant", tenantId).set(dbSizeBytes);
metricRegistry.gauge("storage.cold.size_bytes", "tenant", tenantId).set(coldSizeBytes);
metricRegistry.gauge("storage.cold.file_count", "tenant", tenantId).set(fileCount);
```

**Compliance Spans:**
```java
// Success span
complianceSpanProcessor.startComplianceSpan("storage.archival.completed", SOC2Controls.CC7_2.class);

// Failure span
complianceSpanProcessor.startComplianceSpan("storage.archival.failed", SOC2Controls.CC7_2.class);
```

## Success Criteria

**Archival Process:**
- [ ] Daily archival runs at scheduled time
- [ ] Two-phase commit prevents data loss
- [ ] Checksum and row count verification works
- [ ] Failed uploads retry with exponential backoff
- [ ] TigerBeetle records archival events (immutable)

**Data Integrity:**
- [ ] No data loss on upload failures
- [ ] No DuckDB cleanup until upload verified
- [ ] Parquet file matches DuckDB export exactly

**Performance:**
- [ ] Archive 1M traces in <4 hours
- [ ] Parallel processing per tenant
- [ ] No impact on query performance during archival

**Observability:**
- [ ] Metrics track archival success/failure
- [ ] Compliance spans for every archival event
- [ ] Logs show detailed progress

**Testing:**
- [ ] Processor unit tests (90% coverage)
- [ ] Integration tests (full archival flow)
- [ ] Failure scenario tests (upload failures, verification failures)
- [ ] Performance tests (1M trace archival)

## Testing Requirements

**Unit Tests:**
```java
@Test
@DisplayName("Should export traces to Parquet")
void testExportToParquet() {
    UUID tenantId = UUID.randomUUID();
    LocalDate date = LocalDate.now().minusDays(8);

    // Insert 10K traces in DuckDB
    for (int i = 0; i < 10_000; i++) {
        duckdb.insertTrace(tenantId, createTestTrace(date));
    }

    // Export
    Exchange exchange = createTestExchange();
    exchange.getIn().setHeader("tenantId", tenantId);
    exchange.getIn().setHeader("archivalDate", date);

    processor.process(exchange);

    Path parquetFile = exchange.getIn().getHeader("parquetFile", Path.class);
    assertNotNull(parquetFile);
    assertTrue(Files.exists(parquetFile));

    long rowCount = exchange.getIn().getHeader("localRowCount", Long.class);
    assertEquals(10_000L, rowCount);
}

@Test
@DisplayName("Should retry upload on failure")
void testUploadRetry() {
    ColdStorageService mockStorage = mock(ColdStorageService.class);

    // Fail twice, then succeed
    when(mockStorage.storeParquet(any(), any(), any()))
        .thenThrow(new IOException("Timeout"))
        .thenThrow(new IOException("Timeout"))
        .thenReturn("s3://bucket/tenant-a/2025-01-15.parquet");

    Exchange exchange = createTestExchange();
    processor.process(exchange);

    // Should have retried 3 times
    verify(mockStorage, times(3)).storeParquet(any(), any(), any());

    String uri = exchange.getIn().getHeader("storageUri", String.class);
    assertNotNull(uri);
}

@Test
@DisplayName("Should detect checksum mismatch")
void testChecksumMismatch() {
    Exchange exchange = createTestExchange();
    exchange.getIn().setHeader("localChecksum", "abc123");
    exchange.getIn().setHeader("localRowCount", 1000L);
    exchange.getIn().setHeader("storageUri", "s3://bucket/file.parquet");

    // Mock cold storage returns different checksum
    when(mockStorage.retrieveParquet(any()))
        .thenReturn(createParquetWithChecksum("def456"));

    assertThrows(RuntimeException.class, () -> {
        processor.process(exchange);
    });

    assertEquals(false, exchange.getIn().getHeader("archivalVerified"));
}
```

**Integration Tests:**
```java
@Test
@DisplayName("Should archive traces end-to-end")
void testEndToEndArchival() {
    UUID tenantId = UUID.randomUUID();
    LocalDate date = LocalDate.now().minusDays(8);

    // Insert traces in DuckDB
    for (int i = 0; i < 1000; i++) {
        duckdb.insertTrace(tenantId, createTestTrace(date));
    }

    // Trigger archival
    template.sendBodyAndHeaders("direct:archive-tenant-date", null, Map.of(
        "tenantId", tenantId,
        "archivalDate", date
    ));

    // Verify upload succeeded
    assertTrue(coldStorage.exists(tenantId, date));

    // Verify archival event recorded
    assertTrue(tb.hasArchivalEvent(tenantId, date));

    // Verify traces deleted from DuckDB
    List<Trace> remaining = duckdb.queryTraces(tenantId, date.atStartOfDay().toInstant(), date.atTime(23, 59).toInstant(), 1000);
    assertEquals(0, remaining.size());
}

@Test
@DisplayName("Should NOT delete on verification failure")
void testNoDeleteOnVerificationFailure() {
    UUID tenantId = UUID.randomUUID();
    LocalDate date = LocalDate.now().minusDays(8);

    // Insert traces
    for (int i = 0; i < 100; i++) {
        duckdb.insertTrace(tenantId, createTestTrace(date));
    }

    // Mock verification failure
    when(mockStorage.retrieveParquet(any()))
        .thenThrow(new IOException("Download failed"));

    // Trigger archival (should fail gracefully)
    template.sendBodyAndHeaders("direct:archive-tenant-date", null, Map.of(
        "tenantId", tenantId,
        "archivalDate", date
    ));

    // Traces should still be in DuckDB
    List<Trace> remaining = duckdb.queryTraces(tenantId, date.atStartOfDay().toInstant(), date.atTime(23, 59).toInstant(), 1000);
    assertEquals(100, remaining.size());
}
```

**Performance Tests:**
```java
@Test
@DisplayName("Should archive 1M traces in <4 hours")
void testArchivalPerformance() {
    UUID tenantId = UUID.randomUUID();

    // Insert 1M traces over 7 days
    for (int day = 0; day < 7; day++) {
        LocalDate date = LocalDate.now().minusDays(day + 8);
        for (int i = 0; i < 143_000; i++) {
            duckdb.insertTrace(tenantId, createTestTrace(date));
        }
    }

    // Measure archival time
    Instant start = Instant.now();

    template.sendBody("direct:archive-all-tenants", null);

    Duration elapsed = Duration.between(start, Instant.now());

    // Should complete in <4 hours
    assertThat(elapsed.toHours()).isLessThan(4);

    // Verify all archived
    for (int day = 0; day < 7; day++) {
        LocalDate date = LocalDate.now().minusDays(day + 8);
        assertTrue(coldStorage.exists(tenantId, date));
    }
}
```

## Minimum Test Coverage Targets

- **Overall Instruction Coverage:** 90%
- **Overall Branch Coverage:** 80%
- **Critical Processors:** 95% instruction coverage
  - All archival processors

## Files to Create

**Camel Routes:**
- `backend/src/main/java/com/fluo/routes/ArchivalRoute.java`

**Processors:**
- `backend/src/main/java/com/fluo/processors/archival/IdentifyTenantsForArchivalProcessor.java`
- `backend/src/main/java/com/fluo/processors/archival/IdentifyArchivableDatesProcessor.java`
- `backend/src/main/java/com/fluo/processors/archival/ExportDuckDBToParquetProcessor.java`
- `backend/src/main/java/com/fluo/processors/archival/UploadParquetProcessor.java`
- `backend/src/main/java/com/fluo/processors/archival/VerifyParquetIntegrityProcessor.java`
- `backend/src/main/java/com/fluo/processors/archival/RecordArchivalEventProcessor.java`
- `backend/src/main/java/com/fluo/processors/archival/DeleteArchivedTracesProcessor.java`

**Tests:**
- `backend/src/test/java/com/fluo/routes/ArchivalRouteTest.java`
- `backend/src/test/java/com/fluo/processors/archival/ArchivalProcessorsTest.java`
- `backend/src/test/java/com/fluo/integration/ArchivalIntegrationTest.java`
- `backend/src/test/java/com/fluo/performance/ArchivalPerformanceTest.java`

## Files to Modify

**Backend:**
- `backend/src/main/resources/application.properties` - Add archival config
- `backend/pom.xml` - Add Quartz scheduler dependency
- `backend/src/main/java/com/fluo/services/TigerBeetleService.java` - Add `recordArchivalEvent()` method
- `backend/src/main/java/com/fluo/services/DuckDBService.java` - Add `deleteTracesForDate()` method

## Implementation Notes

**Two-Phase Commit:**
- **Phase 1 Failure:** Traces remain in DuckDB, retry next cycle
- **Phase 2 Failure:** Traces remain in DuckDB, archival event recorded (idempotent retry)
- **Both Succeed:** Traces in cold storage, DuckDB cleaned up

**Idempotency:**
- `storeParquet()` replaces existing file (idempotent)
- Archival event has unique ID (no duplicates)
- Verification always re-downloads (no cached results)

**Performance:**
- **Parallel Processing:** Archive all tenants in parallel
- **Batch Export:** DuckDB exports entire day in single query
- **Compression:** Parquet with ZSTD (fast compression, good ratio)

**Error Handling:**
- **Transient Errors:** Retry with exponential backoff
- **Permanent Errors:** Log and skip, retry next cycle
- **No Silent Failures:** All errors emit metrics and compliance spans

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - ColdStorageService abstraction
- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Per-tenant archival
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - All archival via routes
- **[ADR-014: Camel Testing Standards](../adrs/014-camel-testing-and-organization-standards.md)** - 90% coverage

## Dependencies

**Requires:**
- PRD-002b: Hot Trace Storage (DuckDB to archive from)
- PRD-002c: Cold Storage Abstraction (upload destination)

**Blocks:** None (all persistence PRDs now complete)

## Future Enhancements

- **Incremental Archival:** Archive throughout day (not just at 2 AM)
- **Compression Levels:** Configurable ZSTD compression levels
- **Parallel Uploads:** Upload multiple Parquet files simultaneously
- **Archival Metrics Dashboard:** Grafana dashboard for archival health
- **Automated Recovery:** Auto-rebuild DuckDB from cold storage on corruption
