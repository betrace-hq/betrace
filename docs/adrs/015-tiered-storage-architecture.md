# ADR-015: Tiered Storage Architecture for Trace Data

**Status:** ✅ **APPROVED**
**Date:** 2025-10-10
**Deciders:** Architecture Team, Architecture-Guardian Agent

## Context

FLUO processes OpenTelemetry traces and needs to support:
1. **Rule replay**: When rules are updated, replay historical traces to validate changes
2. **Fast queries**: Recent traces (0-7 days) need <100ms query response
3. **Long retention**: Compliance requires 365+ day trace retention
4. **Cost efficiency**: Storage costs must scale economically with trace volume
5. **Recovery**: System must be rebuildable from source of truth after failures

### Current State

From [PRD-002: Persistence Layer](../prds/002-persistence-layer.md):
- **TigerBeetle**: Stores tenants, rules, signals (WORM semantics)
- **Drools**: Caches traces/spans during rule evaluation (not persisted)
- **Problem**: No long-term trace storage for rule replay

### Requirements

1. **Hot storage** (0-7 days): Fast queries for recent traces
2. **Cold storage** (7-365 days): Cost-efficient archival for compliance
3. **Source of truth**: Immutable log for recovery and audit
4. **Tenant isolation**: Physical separation of tenant data
5. **Deployment agnostic**: No coupling to specific cloud providers (ADR-011)
6. **Camel-first**: All data flows implemented as Camel routes (ADR-013)

## Decision

**Implement three-tier storage architecture with deployment-agnostic abstractions:**

### Tier 1: Source of Truth (Append-Only Span Log)
- **Technology**: JSON Lines files on local filesystem
- **Retention**: Same as cold storage (365 days default)
- **Purpose**: Immutable source of truth for recovery
- **Format**: `./data-span-log/{tenant-id}/{date}.jsonl`

### Tier 2: Hot Storage (DuckDB)
- **Technology**: DuckDB embedded database
- **Retention**: 0-7 days (configurable)
- **Purpose**: Fast queries on recent traces
- **Format**: Per-tenant DuckDB files: `./data-duckdb/{tenant-id}.duckdb`

### Tier 3: Cold Storage (Parquet via Abstraction)
- **Technology**: Parquet files via `ColdStorageService` interface
- **Default Implementation**: Local filesystem
- **External Implementations**: S3, MinIO, GCS (consumer-provided)
- **Retention**: 7-365 days (configurable)
- **Format**: `{tenant-id}/{year}/{month}/{day}/traces.parquet`

### Data Flow Architecture

```
OpenTelemetry Spans
        ↓
   [Camel Route: Span Ingestion]
        ↓
   ┌─────────────────────────────┐
   │ Append-Only Span Log        │ ← Source of Truth (Immutable)
   │ ./data-span-log/            │
   └─────────────────────────────┘
        ↓
   ┌─────────────────────────────┐
   │ DuckDB (Hot Storage)        │ ← Projection (0-7 days)
   │ ./data-duckdb/              │
   └─────────────────────────────┘
        ↓ (Daily archival)
   ┌─────────────────────────────┐
   │ Parquet (Cold Storage)      │ ← Projection (7-365 days)
   │ ColdStorageService          │
   └─────────────────────────────┘
        ↓ (Retention cleanup)
   Deleted after 365 days

Recovery Path:
   Append-Only Span Log → Replay → Rebuild DuckDB → Rebuild Parquet
```

## Rationale

### 1. Append-Only Span Log as Source of Truth

**Why not TigerBeetle for full spans?**
- TigerBeetle transfers limited to 128 bytes user_data
- Full span payloads are 5-10KB (too large)
- TigerBeetle designed for accounting, not document storage

**Why append-only log?**
- Simple, proven pattern (Kafka, EventStoreDB use this)
- Fast sequential writes (no random I/O)
- Easy to replay for recovery
- No external dependencies (filesystem only)
- Immutable audit trail

**Format: JSON Lines**
```jsonl
{"traceId":"abc123","spanId":"span1","timestamp":"2025-01-15T10:00:00Z","tenantId":"tenant-a","attributes":{...}}
{"traceId":"abc123","spanId":"span2","timestamp":"2025-01-15T10:00:01Z","tenantId":"tenant-a","attributes":{...}}
```

**Write Performance:**
- Sequential append: ~100K spans/sec on SSD
- No indexes, no locking, no transactions needed
- Partitioned by tenant and date for isolation

### 2. DuckDB for Hot Storage Queries

**Why DuckDB?**
- Embedded (no separate process)
- SQL queries on columnar data
- Fast analytics (1M rows/sec)
- Can query Parquet files directly
- Native JSON support

**Per-Tenant DuckDB Files:**
```
./data-duckdb/
├── tenant-a-uuid.duckdb  ← Physical isolation
├── tenant-b-uuid.duckdb
└── tenant-c-uuid.duckdb
```

**Benefits:**
- True physical tenant isolation (ADR-012 compliance)
- Can delete tenant's entire DuckDB file on offboarding
- Parallel queries across tenants
- Smaller file sizes = faster queries

**Trade-offs:**
- More files to manage (acceptable with Camel automation)
- Cannot query across tenants (intentional isolation)

### 3. ColdStorageService Abstraction (ADR-011 Compliance)

**Problem:** Hardcoding S3/MinIO couples application to cloud providers.

**Solution:** Abstract interface with default filesystem implementation.

```java
/**
 * Deployment-agnostic cold storage interface.
 * External consumers provide implementations for their environment.
 */
public interface ColdStorageService {
    String storeParquet(UUID tenantId, LocalDate date, Path parquetFile) throws IOException;
    Path retrieveParquet(UUID tenantId, LocalDate date) throws IOException;
    void deleteParquet(UUID tenantId, LocalDate date) throws IOException;
    List<String> listExpiredParquet(LocalDate retentionDate) throws IOException;
}
```

**Default Implementation:** `FilesystemColdStorage`
```java
@ApplicationScoped
@DefaultBean
public class FilesystemColdStorage implements ColdStorageService {
    @ConfigProperty(name = "fluo.storage.cold.path", defaultValue = "./data-cold-storage")
    String coldStoragePath;

    // Implementation uses local filesystem
}
```

**External Implementations:** Consumer-provided
```java
// external-aws-deploy/S3ColdStorage.java (NOT in FLUO repo)
@ApplicationScoped
@Alternative
@Priority(1)  // Override default
public class S3ColdStorage implements ColdStorageService {
    // S3-specific implementation
}
```

**Benefits:**
- ✅ ADR-011 compliant (no deployment coupling)
- ✅ Works locally without cloud accounts
- ✅ Consumers choose their storage backend
- ✅ Testable without external dependencies

### 4. Camel Routes for Archival (ADR-013 Compliance)

**Daily Archival Route:**
```java
from("timer:dailyArchival?period=86400000")  // 24 hours
    .to("direct:archiveOldTraces");

from("direct:archiveOldTraces")
    .process("identifyArchivableTenantsProcessor")
    .split(body())
    .to("direct:archiveTenantTraces");

// Two-phase commit: export → verify → delete
from("direct:archiveTenantTraces")
    .process("exportDuckDBToParquetProcessor")      // Phase 1: Export
    .process("uploadParquetToStorageProcessor")     // Phase 1: Upload
    .process("verifyParquetIntegrityProcessor")     // Phase 1: Verify
    .process("recordArchivalEventProcessor")        // Commit point (TigerBeetle)
    .choice()
        .when(header("archivalVerified").isEqualTo(true))
            .process("deleteDuckDBArchivedDataProcessor")  // Phase 2: Cleanup
        .otherwise()
            .to("direct:archivalErrorHandler");
```

**Query Route (Hot + Cold Unified):**
```java
from("rest:get:/api/traces/query")
    .to("direct:queryTraces");

from("direct:queryTraces")
    .process("parseQueryParametersProcessor")
    .process("queryHotStorageProcessor")      // DuckDB
    .process("queryColdStorageProcessor")     // Parquet
    .process("mergeResultsProcessor")         // Combine
    .marshal().json();
```

**Named Processors (ADR-014 Compliance):**
```
com.fluo.processors/storage/
├── archival/
│   ├── ExportDuckDBToParquetProcessor.java
│   ├── UploadParquetToStorageProcessor.java
│   ├── VerifyParquetIntegrityProcessor.java
│   ├── RecordArchivalEventProcessor.java
│   └── DeleteDuckDBArchivedDataProcessor.java
├── query/
│   ├── QueryHotStorageProcessor.java
│   ├── QueryColdStorageProcessor.java
│   └── MergeResultsProcessor.java
└── retention/
    ├── IdentifyExpiredParquetProcessor.java
    └── DeleteExpiredParquetProcessor.java
```

## Resilience: Two-Phase Commit Pattern

**Problem:** Mid-process failures can cause data loss.

**Scenario:** S3 upload fails after DuckDB deletion
```
1. Export DuckDB → Parquet ✅
2. Upload Parquet → S3 ❌ FAILS
3. Delete DuckDB data ❌ DATA LOSS!
```

**Solution:** Two-phase commit ensures atomicity
```
Phase 1 (Safe Operations):
  1. Export DuckDB → Parquet (temp file)
  2. Upload Parquet → ColdStorage
  3. Verify Parquet integrity (checksum, row count)
  4. Record archival event in TigerBeetle (commit point)

Phase 2 (Cleanup - Only if Phase 1 succeeded):
  5. Delete DuckDB archived data
  6. Delete temp Parquet file
```

**Implementation:**
```java
@Named("verifyParquetIntegrityProcessor")
@ApplicationScoped
public class VerifyParquetIntegrityProcessor implements Processor {
    @Override
    public void process(Exchange exchange) throws Exception {
        Path parquetFile = exchange.getIn().getHeader("parquetFile", Path.class);

        // Verify Parquet schema + row count
        try (ParquetReader<GenericRecord> reader = createParquetReader(parquetFile)) {
            long rowCount = 0;
            while (reader.read() != null) rowCount++;

            long expectedRows = exchange.getIn().getHeader("expectedRowCount", Long.class);
            if (rowCount != expectedRows) {
                throw new DataIntegrityException("Parquet row count mismatch");
            }

            exchange.getIn().setHeader("archivalVerified", true);
        }
    }
}
```

**Rollback on Failure:**
```java
.onException(Exception.class)
    .process("rollbackArchivalProcessor")  // Delete temp Parquet, keep DuckDB data
    .to("direct:archivalErrorHandler")
    .log("Archival failed: ${exception.message}");
```

## Recovery Scenarios

### Scenario 1: DuckDB Corruption

**Recovery Process:**
```
1. Delete corrupted DuckDB file
2. Replay append-only span log → Rebuild DuckDB
3. System operational in minutes
```

**Implementation:**
```java
@Named("rebuildDuckDBFromSpanLogProcessor")
@ApplicationScoped
public class RebuildDuckDBFromSpanLogProcessor implements Processor {
    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);

        // Read span log for last 7 days
        LocalDate cutoff = LocalDate.now().minusDays(7);
        Path spanLogDir = Path.of("./data-span-log", tenantId.toString());

        try (Stream<Path> logFiles = Files.list(spanLogDir)) {
            logFiles.filter(p -> isAfter(p, cutoff))
                .forEach(logFile -> replaySpansIntoDuckDB(tenantId, logFile));
        }
    }
}
```

### Scenario 2: Parquet Corruption in Cold Storage

**Recovery Process:**
```
1. Identify corrupted Parquet date range
2. Replay append-only span log for that date → Regenerate Parquet
3. Upload to ColdStorage
```

### Scenario 3: Complete Data Loss (All Storage Tiers)

**If append-only span log survives:**
```
1. Replay span log → Rebuild DuckDB (hot storage)
2. Export old dates → Rebuild Parquet (cold storage)
3. Full recovery
```

**If append-only span log lost:**
- Cannot recover (no source of truth)
- Recommendation: Backup span log to external storage

## Tenant Isolation (ADR-012 Compliance)

### Physical Isolation Strategy

**Append-Only Span Log:**
```
./data-span-log/
├── tenant-a-uuid/
│   ├── 2025-01-01.jsonl  ← Physically separated
│   └── 2025-01-02.jsonl
└── tenant-b-uuid/
    ├── 2025-01-01.jsonl  ← Physically separated
    └── 2025-01-02.jsonl
```

**DuckDB Hot Storage:**
```
./data-duckdb/
├── tenant-a-uuid.duckdb  ← Separate database file
└── tenant-b-uuid.duckdb  ← Separate database file
```

**Parquet Cold Storage:**
```
{storage-backend}/
├── tenant-a-uuid/
│   └── 2025/01/15/traces.parquet
└── tenant-b-uuid/
    └── 2025/01/15/traces.parquet
```

**Mathematical Guarantee:**
- Tenant A's data in different filesystem paths than Tenant B
- Query for Tenant A cannot access Tenant B's files (OS-level isolation)
- No cross-tenant queries possible (intentional design)

## Performance Characteristics

### Write Performance

**Span Ingestion:**
- Append to span log: ~100K spans/sec (sequential writes)
- Insert into DuckDB: ~50K spans/sec (indexed writes)
- Combined: ~50K spans/sec (bottleneck is DuckDB)

**Daily Archival:**
- Export 1M traces from DuckDB: ~30 seconds
- Write Parquet file: ~20 seconds
- Upload to ColdStorage: ~10 seconds (local) / ~60 seconds (S3)
- Total: ~60 seconds (local) / ~110 seconds (S3)

### Query Performance

**Hot Storage (0-7 days):**
- Simple queries: <100ms
- Complex aggregations: <1 second
- Full-text search: <500ms

**Cold Storage (7-365 days):**
- Simple queries: <1 second (Parquet scan)
- Complex aggregations: <5 seconds
- Partition pruning: Only reads relevant date partitions

**Unified Queries (Hot + Cold):**
- DuckDB can query Parquet directly
- Result: Single query spans both tiers seamlessly

### Storage Efficiency

**Example: 10M traces/day, 5KB average**

| Storage Tier | Retention | Format | Size | Cost |
|--------------|-----------|--------|------|------|
| Span Log | 365 days | JSON Lines | ~18TB | Baseline |
| DuckDB Hot | 7 days | Columnar | ~350GB | Baseline |
| Parquet Cold | 358 days | Compressed | ~1.8TB | 10x savings |
| **Total** | 365 days | Mixed | ~2.15TB | **89% reduction** |

**Without tiered storage:** 18TB (all JSON)
**With tiered storage:** 2.15TB (88% savings)

## Configuration

### Application Properties

```properties
# Span log (source of truth)
fluo.storage.span-log.path=./data-span-log
fluo.storage.span-log.retention-days=365

# Hot storage (DuckDB)
fluo.storage.hot.path=./data-duckdb
fluo.storage.hot.retention-days=7

# Cold storage (abstracted)
fluo.storage.cold.path=./data-cold-storage
fluo.storage.cold.retention-days=365

# Archival schedule (cron)
fluo.storage.archival.schedule=0 0 2 * * ?  # 2 AM daily
fluo.storage.retention.schedule=0 0 3 * * ?  # 3 AM daily
```

### Consumer Configuration (External S3)

```properties
# Consumer overrides ColdStorageService implementation
fluo.storage.cold.provider=s3
s3.bucket.name=my-company-traces
s3.region=us-west-2
```

## Testing Requirements (ADR-014 Compliance)

### Minimum Coverage Requirements
- **Overall Instruction Coverage:** 90%
- **Branch Coverage:** 80%
- **Processor Coverage:** 90% instruction, 85% branch

### Test Categories

**1. Unit Tests: Processor Testing**
```java
@Test
@DisplayName("Should export DuckDB traces to Parquet with correct schema")
void testExportDuckDBToParquetProcessor() throws Exception {
    ExportDuckDBToParquetProcessor processor = new ExportDuckDBToParquetProcessor();
    Exchange exchange = createTestExchange();

    processor.process(exchange);

    Path parquetFile = exchange.getIn().getHeader("parquetFile", Path.class);
    assertTrue(Files.exists(parquetFile));
    verifyParquetSchema(parquetFile);
}
```

**2. Integration Tests: End-to-End Archival**
```java
@Test
@DisplayName("Should archive 7-day-old traces and delete from hot storage")
void testEndToEndArchival() throws Exception {
    insertTestTraces(tenantId, LocalDate.now().minusDays(8), 1000);

    template.sendBody("direct:archiveOldTraces", tenantId);

    assertTrue(coldStorage.exists(tenantId, LocalDate.now().minusDays(8)));
    assertEquals(0, duckDB.countTraces(tenantId, LocalDate.now().minusDays(8)));
}
```

**3. Property-Based Tests: Tenant Isolation**
```java
@Test
@DisplayName("Should maintain tenant isolation across all storage tiers")
void testTenantIsolationProperty() {
    for (int i = 0; i < 1000; i++) {
        UUID tenantA = randomTenantId();
        UUID tenantB = randomTenantId();

        insertTestTraces(tenantA, LocalDate.now().minusDays(1), 100);
        insertTestTraces(tenantB, LocalDate.now().minusDays(1), 100);

        List<Trace> tenantATraces = queryTraces(tenantA);
        assertFalse(tenantATraces.stream().anyMatch(t -> t.getTenantId().equals(tenantB)));
    }
}
```

**4. Resilience Tests: Failure Scenarios**
```java
@Test
@DisplayName("Should handle storage upload failure without data loss")
void testUploadFailureRecovery() throws Exception {
    when(mockStorage.storeParquet(any())).thenThrow(new IOException("Storage unavailable"));

    Exchange exchange = createTestExchange();
    assertThrows(Exception.class, () -> archivalRoute.process(exchange));

    // Verify DuckDB data still exists (not deleted)
    assertTrue(duckDB.countTraces(TEST_TENANT_ID, LocalDate.now().minusDays(8)) > 0);
}
```

**5. Performance Tests: Bulk Archival**
```java
@Test
@DisplayName("Should archive 1M traces in under 5 minutes")
void testArchivalPerformance() {
    insertTestTraces(tenantId, LocalDate.now().minusDays(8), 1_000_000);

    long startTime = System.currentTimeMillis();
    template.sendBody("direct:archiveOldTraces", tenantId);
    long duration = System.currentTimeMillis() - startTime;

    assertTrue(duration < 300_000, "Archival took " + duration + "ms");
}
```

## Implementation Phases

### Phase 1: Core Architecture (Week 1-2)
1. Create `ColdStorageService` interface
2. Implement `FilesystemColdStorage` (default)
3. Create `SpanLogService` (append-only log)
4. Create `StorageTierRoutes` with named processors
5. Implement package structure

### Phase 2: Resilience (Week 3)
6. Implement two-phase commit archival pattern
7. Add Parquet integrity verification
8. Add error handling routes
9. Implement rollback logic

### Phase 3: Testing (Week 4)
10. Write processor unit tests (90% coverage)
11. Write integration tests for archival flow
12. Write property-based tenant isolation tests
13. Write performance tests (1M traces benchmark)

### Phase 4: Documentation (Week 5)
14. Document `ColdStorageService` interface for consumers
15. Create external S3 implementation example
16. Update CLAUDE.md with storage architecture
17. Create operator documentation

## Alternatives Considered

### Alternative 1: TigerBeetle for Full Spans
**Considered:** Store full span payloads in TigerBeetle user_data
**Rejected:** TigerBeetle transfers limited to 128 bytes, spans are 5-10KB

### Alternative 2: Single DuckDB File for All Tenants
**Considered:** One DuckDB file with tenant_id column
**Rejected:** Weaker tenant isolation, risk of cross-tenant bugs

### Alternative 3: ClickHouse for All Storage
**Considered:** ClickHouse for hot + cold storage
**Rejected:** External dependency, violates ADR-011 (not deployment-agnostic)

### Alternative 4: Direct S3 Integration
**Considered:** Hardcode S3 client in application
**Rejected:** Violates ADR-011 (couples to AWS)

## Consequences

### Positive Consequences

1. **✅ ADR-011 Compliant:** Deployment-agnostic via `ColdStorageService` abstraction
2. **✅ ADR-012 Compliant:** Physical tenant isolation across all tiers
3. **✅ ADR-013 Compliant:** All data flows implemented as Camel routes
4. **✅ ADR-014 Compliant:** Named processors with comprehensive testing
5. **✅ Recoverable:** Append-only span log enables full recovery
6. **✅ Cost-efficient:** 89% storage reduction via tiered strategy
7. **✅ Fast queries:** <100ms for hot data, <1s for cold data
8. **✅ Resilient:** Two-phase commit prevents data loss

### Negative Consequences

1. **❌ Complexity:** Three storage tiers to manage
2. **❌ Disk usage:** Append-only log requires additional storage
3. **❌ Archival latency:** Daily archival means 8-day data in hot storage
4. **❌ File management:** Per-tenant files increase file count

### Mitigation Strategies

1. **Complexity:** Clear documentation and Camel route automation
2. **Disk usage:** Acceptable trade-off for recovery capability (log is compressible)
3. **Archival latency:** Configurable hot retention (can reduce to 5-6 days)
4. **File management:** Automated by Camel routes, OS handles large file counts efficiently

## Related ADRs

- **[ADR-011: Pure Application Framework](./011-pure-application-framework.md)** - Deployment-agnostic design
- **[ADR-012: Mathematical Tenant Isolation](./012-mathematical-tenant-isolation-architecture.md)** - Tenant isolation requirements
- **[ADR-013: Apache Camel-First Architecture](./013-apache-camel-first-architecture.md)** - Camel route implementation
- **[ADR-014: Camel Route Testing and Code Organization Standards](./014-camel-testing-and-organization-standards.md)** - Testing requirements

## References

- [Apache Camel Documentation](https://camel.apache.org/documentation/)
- [DuckDB Documentation](https://duckdb.org/docs/)
- [Apache Parquet Format](https://parquet.apache.org/docs/)
- [TigerBeetle Documentation](https://docs.tigerbeetle.com/)
- [FLUO PRD-002: Persistence Layer](../prds/002-persistence-layer.md)
