# PRD-002: Persistence Layer

**Priority:** P0 (Blocks Production)
**Complexity:** Medium
**Personas:** All
**Dependencies:** PRD-001 (Authentication needed for tenant isolation)
**Implementation Status:** ❌ NOT READY - Critical testability issues must be resolved first

## Problem

FLUO currently has **no persistence** - everything is in-memory:
- **Signals:** No storage - lost on restart
- **Rules:** No database - TenantSessionManager compiles in-memory only
- **Tenants:** No tenant metadata storage
- **Traces/Spans:** No local storage (cached in Drools working memory during processing)

**Impact:**
- ❌ All data lost on service restart
- ❌ No historical signal analysis
- ❌ No rule versioning
- ❌ Cannot scale horizontally (state in memory)
- ❌ No compliance evidence retention

**Current State:**
- `TenantSessionManager.java` - ConcurrentHashMap (in-memory)
- `SignalService.java` - In-memory only
- No database configuration in `application.properties`

## Solution

### Technology Choice

**TigerBeetle only** - Purpose-built financial accounting database with:
- **Double-entry bookkeeping semantics** (perfect for audit trails)
- **ACID guarantees** at extreme performance (1M+ TPS)
- **Immutable ledger** (WORM - Write Once Read Many)
- **Deterministic** for distributed correctness
- **Built-in idempotency** (no duplicate signals)
- **Zero external dependencies** (single binary)

**Why TigerBeetle-only for FLUO:**
- Signals are immutable audit events (WORM) - perfect fit
- Need high write throughput (100K+ signals/day)
- Compliance requires tamper-proof audit trail
- Simple data model fits TigerBeetle's account/transfer model
- Metadata stored in TigerBeetle's user_data fields (128-bit + 64-bit + 32-bit per entity)
- Accept query limitations - optimize for writes, not complex queries

### Data Model

**Three Entity Types:**
1. **Tenants** (read/write) - Tenant metadata
2. **Rules** (read/write) - FLUO DSL rules
3. **Signals** (WORM) - Immutable signal events

**No external storage** - Everything in TigerBeetle

**Traces/Spans use tiered storage** (see [ADR-015: Tiered Storage Architecture](../adrs/015-tiered-storage-architecture.md)):
1. **Append-only span log** (source of truth) - `./data-span-log/{tenant-id}/{date}.jsonl`
2. **DuckDB hot storage** (0-7 days) - `./data-duckdb/{tenant-id}.duckdb`
3. **Parquet cold storage** (7-365 days) - via `ColdStorageService` abstraction
4. **Drools working memory** - Cached during rule evaluation only

### TigerBeetle Schema Design

TigerBeetle uses **accounts** and **transfers** as primitives. We'll map:
- **Accounts** → Tenants, Rules (with metadata in user_data fields)
- **Transfers** → Signals (immutable ledger entries)

#### Account Schema

```java
// TigerBeetle Account = Tenant or Rule
public record TBAccount(
    UInt128 id,              // UUID as UInt128
    UInt128 userData128,     // For rules: tenant UUID; For tenants: encryption key ref
    long userData64,         // Flags: bit 0=tenant, bit 1=rule, bit 2=enabled
    int userData32,          // Status codes + severity
    int reserved,
    int ledger,              // Ledger ID (tenant partition)
    int code,                // Entity type: 1=tenant, 2=rule, 3=signal
    int flags,               // AccountFlags
    long debitsPosted,       // For rules: signal count
    long creditsPosted,      // For tenants: total signals received
    long debitsPending,      // Unused
    long creditsPending,     // Unused
    long timestamp           // Created timestamp (nanoseconds)
) {}
```

**Tenant Account:**
```java
TBAccount tenant = new TBAccount(
    id: tenantUUID,
    userData128: encryptionKeyRef,  // KMS key reference (PRD-006)
    userData64: 0x01,               // Tenant flag (bit 0 set)
    userData32: 0,                  // Status
    code: 1,                        // Tenant type
    ledger: 1,                      // Global ledger
    creditsPosted: 0,               // Will track signal count
    timestamp: now()
);
```

**Rule Account:**
```java
TBAccount rule = new TBAccount(
    id: ruleUUID,
    userData128: tenantUUID,        // Parent tenant
    userData64: 0x02 | (enabled ? 0x04 : 0),  // Rule flag + enabled bit
    userData32: severity << 16,     // Severity in high 16 bits
    code: 2,                        // Rule type
    ledger: tenantLedgerId,         // Tenant's ledger
    debitsPosted: 0,                // Signal count (incremented by transfers)
    timestamp: now()
);
```

#### Transfer Schema (Signals)

```java
// TigerBeetle Transfer = Signal (immutable WORM)
public record TBTransfer(
    UInt128 id,              // Signal UUID
    UInt128 debitAccountId,  // Rule ID (which rule fired)
    UInt128 creditAccountId, // Tenant ID (which tenant)
    long amount,             // Always 1 (for counting)
    UInt128 userData128,     // Trace ID as UInt128
    long userData64,         // Severity (4 bits) + Status (4 bits) + Timestamp offset (56 bits)
    int userData32,          // Span ID hash
    int timeout,             // Unused
    int ledger,              // Tenant ledger
    int code,                // Signal type (3)
    int flags,               // TransferFlags.linked for batching
    long timestamp           // Signal occurred timestamp (nanoseconds)
) {}
```

**Signal Transfer:**
```java
TBTransfer signal = new TBTransfer(
    id: signalUUID,
    debitAccountId: ruleUUID,           // Which rule fired
    creditAccountId: tenantUUID,        // Which tenant
    amount: 1,                          // Increment counters
    userData128: traceIdAsUInt128,      // Full trace ID
    userData64: packSignalMetadata(severity, status),  // Packed metadata
    userData32: spanIdHash,             // Span ID reference
    code: 3,                            // Signal type
    ledger: tenantLedgerId,
    timestamp: occurredAt()
);
```

### Metadata Storage Strategy

**In TigerBeetle user_data fields (packed):**
- Tenant name (not stored - derive from tenant UUID → lookup via WorkOS)
- Rule expression hash (64-bit) - full expression in Drools memory
- Severity, status, timestamps (packed into user_data fields)
- Trace IDs (128-bit)

**In Drools working memory (hot cache):**
- Rule expressions (FLUO DSL)
- Compiled DRL
- Rule metadata (name, description)

**On local filesystem (cold storage):**
- Rule expressions archived: `./data-rules/{tenant-id}/{rule-id}.fluo`
- Signal details archived: `./data-signals/{tenant-id}/{signal-id}.json`

**Query approach:**
- List all signals for tenant → Iterate transfers where creditAccountId = tenantId
- Get rule signal count → Look up rule account's debitsPosted
- Complex queries → Export to DuckDB for ad-hoc analysis (PRD-027)

### Backend Implementation

1. **Add TigerBeetle Client Dependency:**

**`pom.xml`:**
```xml
<dependency>
  <groupId>com.tigerbeetle</groupId>
  <artifactId>tigerbeetle-java</artifactId>
  <version>0.15.3</version>
</dependency>
```

2. **TigerBeetle Service:**

**`TigerBeetleService.java`:**
```java
@ApplicationScoped
public class TigerBeetleService {

    private final Client client;

    // Cache for hot data (loaded at startup)
    private final Map<UUID, Rule> ruleCache = new ConcurrentHashMap<>();
    private final Map<UUID, Tenant> tenantCache = new ConcurrentHashMap<>();

    public TigerBeetleService(
        @ConfigProperty(name = "tigerbeetle.cluster-id") int clusterId,
        @ConfigProperty(name = "tigerbeetle.addresses") String addresses
    ) {
        this.client = new Client(
            UInt128.asBytes(clusterId),
            addresses.split(",")
        );
    }

    @PostConstruct
    public void initialize() {
        // Load all tenants and rules into cache at startup
        loadTenantsIntoCache();
        loadRulesIntoCache();
    }

    public void createTenant(UUID tenantId, String name) {
        AccountBatch accounts = new AccountBatch(1);
        accounts.add();
        accounts.setId(toUInt128(tenantId));
        accounts.setUserData64(0x01); // Tenant flag
        accounts.setCode(1); // Tenant type
        accounts.setLedger(1); // Global ledger

        CreateAccountsResult result = client.createAccounts(accounts);
        if (result.getLength() > 0) {
            throw new TigerBeetleException("Failed to create tenant", result);
        }

        // Cache it
        tenantCache.put(tenantId, new Tenant(tenantId, name));

        // Write metadata to filesystem
        writeRuleMetadata(tenantId, new TenantMetadata(name));
    }

    public void createRule(UUID ruleId, UUID tenantId, String expression, String drl, Severity severity, boolean enabled) {
        AccountBatch accounts = new AccountBatch(1);
        accounts.add();
        accounts.setId(toUInt128(ruleId));
        accounts.setUserData128(toUInt128(tenantId)); // Parent tenant
        accounts.setUserData64(0x02 | (enabled ? 0x04 : 0)); // Rule flag + enabled
        accounts.setUserData32(severity.ordinal() << 16);
        accounts.setCode(2); // Rule type
        accounts.setLedger(tenantToLedgerId(tenantId));

        CreateAccountsResult result = client.createAccounts(accounts);
        if (result.getLength() > 0) {
            throw new TigerBeetleException("Failed to create rule", result);
        }

        // Cache it
        Rule rule = new Rule(ruleId, tenantId, expression, drl, severity, enabled);
        ruleCache.put(ruleId, rule);

        // Write expression to filesystem
        writeRuleToFile(tenantId, ruleId, expression, drl);
    }

    public UUID createSignal(UUID tenantId, UUID ruleId, String traceId, Severity severity, SignalStatus status) {
        UUID signalId = UUID.randomUUID();

        TransferBatch transfers = new TransferBatch(1);
        transfers.add();
        transfers.setId(toUInt128(signalId));
        transfers.setDebitAccountId(toUInt128(ruleId));
        transfers.setCreditAccountId(toUInt128(tenantId));
        transfers.setAmount(1); // Increment counters
        transfers.setUserData128(traceIdToUInt128(traceId));
        transfers.setUserData64(packSignalData(severity, status));
        transfers.setCode(3); // Signal type
        transfers.setLedger(tenantToLedgerId(tenantId));

        CreateTransfersResult result = client.createTransfers(transfers);
        if (result.getLength() > 0) {
            throw new TigerBeetleException("Failed to create signal", result);
        }

        return signalId;
    }

    public List<Signal> getSignalsByTenant(UUID tenantId, int limit) {
        // Query via getAccountTransfers (when API available)
        // For now, use getAccountHistory or iterate transfers

        AccountFilter filter = new AccountFilter();
        filter.setAccountId(toUInt128(tenantId));
        filter.setTimestampMin(0);
        filter.setTimestampMax(Long.MAX_VALUE);
        filter.setLimit(limit);
        filter.setFlags(AccountFilterFlags.CREDITS); // Signals are credits to tenant

        TransferBatch transfers = client.getAccountTransfers(filter);

        List<Signal> signals = new ArrayList<>();
        for (int i = 0; i < transfers.getLength(); i++) {
            Transfer t = transfers.getTransfer(i);
            signals.add(transferToSignal(t));
        }

        return signals;
    }

    public long getRuleSignalCount(UUID ruleId) {
        AccountBatch accounts = new AccountBatch(1);
        accounts.add();
        accounts.setId(toUInt128(ruleId));

        AccountBatch result = client.lookupAccounts(accounts);
        if (result.getLength() == 0) {
            throw new NotFoundException("Rule not found: " + ruleId);
        }

        return result.getAccount(0).getDebitsPosted();
    }

    public Rule getRuleById(UUID ruleId) {
        // Check cache first
        Rule cached = ruleCache.get(ruleId);
        if (cached != null) return cached;

        // Load from filesystem
        return loadRuleFromFile(ruleId);
    }

    public List<Rule> getRulesByTenant(UUID tenantId) {
        // Filter cache by tenant
        return ruleCache.values().stream()
            .filter(r -> r.getTenantId().equals(tenantId))
            .collect(Collectors.toList());
    }

    private void loadTenantsIntoCache() {
        // Query all accounts with code=1 (tenants)
        AccountFilter filter = new AccountFilter();
        filter.setUserData64(0x01); // Tenant flag
        filter.setCode(1);

        AccountBatch tenants = client.queryAccounts(filter);

        for (int i = 0; i < tenants.getLength(); i++) {
            Account account = tenants.getAccount(i);
            UUID tenantId = fromUInt128(account.getId());

            // Load metadata from filesystem
            TenantMetadata metadata = loadTenantMetadata(tenantId);
            tenantCache.put(tenantId, new Tenant(tenantId, metadata.name()));
        }
    }

    private void loadRulesIntoCache() {
        // Query all accounts with code=2 (rules)
        AccountFilter filter = new AccountFilter();
        filter.setCode(2); // Rule type

        AccountBatch rules = client.queryAccounts(filter);

        for (int i = 0; i < rules.getLength(); i++) {
            Account account = rules.getAccount(i);
            UUID ruleId = fromUInt128(account.getId());
            UUID tenantId = fromUInt128(account.getUserData128());

            // Load rule expression from filesystem
            RuleMetadata metadata = loadRuleMetadata(ruleId);

            boolean enabled = (account.getUserData64() & 0x04) != 0;
            int severityOrdinal = account.getUserData32() >> 16;
            Severity severity = Severity.values()[severityOrdinal];

            Rule rule = new Rule(
                ruleId,
                tenantId,
                metadata.expression(),
                metadata.drl(),
                severity,
                enabled
            );

            ruleCache.put(ruleId, rule);
        }
    }

    private void writeRuleToFile(UUID tenantId, UUID ruleId, String expression, String drl) {
        Path ruleDir = Path.of("./data-rules", tenantId.toString());
        Files.createDirectories(ruleDir);

        Path ruleFile = ruleDir.resolve(ruleId + ".json");
        String json = new ObjectMapper().writeValueAsString(
            new RuleMetadata(expression, drl)
        );
        Files.writeString(ruleFile, json);
    }

    private RuleMetadata loadRuleMetadata(UUID ruleId) {
        // Search all tenant directories for this rule
        // Or maintain index file
        Path rulesBase = Path.of("./data-rules");
        try (Stream<Path> paths = Files.walk(rulesBase, 2)) {
            Optional<Path> ruleFile = paths
                .filter(p -> p.getFileName().toString().equals(ruleId + ".json"))
                .findFirst();

            if (ruleFile.isPresent()) {
                String json = Files.readString(ruleFile.get());
                return new ObjectMapper().readValue(json, RuleMetadata.class);
            }
        }

        throw new NotFoundException("Rule metadata not found: " + ruleId);
    }

    private int tenantToLedgerId(UUID tenantId) {
        // Use tenant UUID hash as ledger ID
        return Math.abs(tenantId.hashCode());
    }

    private UInt128 toUInt128(UUID uuid) {
        ByteBuffer bb = ByteBuffer.wrap(new byte[16]);
        bb.putLong(uuid.getMostSignificantBits());
        bb.putLong(uuid.getLeastSignificantBits());
        return UInt128.asBytes(bb.array());
    }

    private UUID fromUInt128(UInt128 uint128) {
        byte[] bytes = UInt128.asBytes(uint128);
        ByteBuffer bb = ByteBuffer.wrap(bytes);
        return new UUID(bb.getLong(), bb.getLong());
    }

    private UInt128 traceIdToUInt128(String traceId) {
        // Convert 32-char hex trace ID to UInt128
        byte[] bytes = new byte[16];
        for (int i = 0; i < 16; i++) {
            bytes[i] = (byte) Integer.parseInt(traceId.substring(i * 2, i * 2 + 2), 16);
        }
        return UInt128.asBytes(bytes);
    }

    private long packSignalData(Severity severity, SignalStatus status) {
        // Pack: severity (4 bits) | status (4 bits) | reserved (56 bits)
        return ((long) severity.ordinal() << 60) | ((long) status.ordinal() << 56);
    }

    private Signal transferToSignal(Transfer transfer) {
        UUID signalId = fromUInt128(transfer.getId());
        UUID ruleId = fromUInt128(transfer.getDebitAccountId());
        UUID tenantId = fromUInt128(transfer.getCreditAccountId());
        String traceId = uint128ToTraceId(transfer.getUserData128());

        long packed = transfer.getUserData64();
        Severity severity = Severity.values()[(int) ((packed >> 60) & 0x0F)];
        SignalStatus status = SignalStatus.values()[(int) ((packed >> 56) & 0x0F)];

        return new Signal(
            signalId,
            tenantId,
            ruleId,
            traceId,
            severity,
            status,
            Instant.ofEpochMilli(transfer.getTimestamp() / 1_000_000) // ns to ms
        );
    }

    record TenantMetadata(String name) {}
    record RuleMetadata(String expression, String drl) {}
}
```

3. **Repository Pattern (Abstraction):**

**`TenantRepository.java`:**
```java
@ApplicationScoped
public class TenantRepository {

    @Inject
    TigerBeetleService tb;

    public void create(Tenant tenant) {
        tb.createTenant(tenant.getId(), tenant.getName());
    }

    public Tenant findById(UUID id) {
        return tb.getTenantById(id);
    }

    public List<Tenant> findAll() {
        return tb.getAllTenants();
    }
}
```

**`RuleRepository.java`:**
```java
@ApplicationScoped
public class RuleRepository {

    @Inject
    TigerBeetleService tb;

    public void create(Rule rule) {
        tb.createRule(
            rule.getId(),
            rule.getTenantId(),
            rule.getExpression(),
            rule.getCompiledDrl(),
            rule.getSeverity(),
            rule.isEnabled()
        );
    }

    public Rule findById(UUID id) {
        return tb.getRuleById(id);
    }

    public List<Rule> findByTenant(UUID tenantId) {
        return tb.getRulesByTenant(tenantId);
    }

    public long getSignalCount(UUID ruleId) {
        return tb.getRuleSignalCount(ruleId);
    }
}
```

**`SignalRepository.java`:**
```java
@ApplicationScoped
public class SignalRepository {

    @Inject
    TigerBeetleService tb;

    public UUID create(Signal signal) {
        return tb.createSignal(
            signal.getTenantId(),
            signal.getRuleId(),
            signal.getTraceId(),
            signal.getSeverity(),
            signal.getStatus()
        );
    }

    public List<Signal> findByTenant(UUID tenantId, int limit) {
        return tb.getSignalsByTenant(tenantId, limit);
    }

    public List<Signal> findByTraceId(String traceId) {
        // Query transfers by userData128 (trace ID)
        // This requires TigerBeetle query API enhancement
        // For MVP, iterate all tenant signals and filter
        throw new UnsupportedOperationException("Trace ID queries in PRD-027");
    }
}
```

4. **Configuration:**

**`application.properties`:**
```properties
# TigerBeetle
tigerbeetle.cluster-id=0
tigerbeetle.addresses=127.0.0.1:3000

# Local filesystem for metadata
fluo.rules.storage-path=./data-rules
fluo.signals.storage-path=./data-signals
```

## Tiered Trace Storage (ADR-015)

See [ADR-015: Tiered Storage Architecture](../adrs/015-tiered-storage-architecture.md) for complete design.

### Storage Tiers Overview

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
        ↓ (Daily archival via Camel)
   ┌─────────────────────────────┐
   │ Parquet (Cold Storage)      │ ← Projection (7-365 days)
   │ ColdStorageService          │
   └─────────────────────────────┘
```

### Tier 1: Append-Only Span Log (Source of Truth)

**Purpose:** Immutable source of truth for recovery and audit trail

**Format:** JSON Lines (one span per line)
```jsonl
{"traceId":"abc123","spanId":"span1","timestamp":"2025-01-15T10:00:00Z","tenantId":"tenant-a","attributes":{...}}
{"traceId":"abc123","spanId":"span2","timestamp":"2025-01-15T10:00:01Z","tenantId":"tenant-a","attributes":{...}}
```

**Storage:** `./data-span-log/{tenant-id}/{date}.jsonl`

**Implementation:**
```java
@Named("appendToSpanLogProcessor")
@ApplicationScoped
public class AppendToSpanLogProcessor implements Processor {
    @Override
    public void process(Exchange exchange) throws Exception {
        Span span = exchange.getIn().getBody(Span.class);
        UUID tenantId = span.getTenantId();
        LocalDate date = LocalDate.now();

        Path logFile = Path.of("./data-span-log", tenantId.toString(), date + ".jsonl");
        Files.createDirectories(logFile.getParent());

        // Append span as JSON line
        String json = objectMapper.writeValueAsString(span);
        Files.writeString(logFile, json + "\n", StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }
}
```

**Benefits:**
- Simple, fast sequential writes (~100K spans/sec)
- No external dependencies (filesystem only)
- Easy to replay for recovery
- Immutable audit trail

### Tier 2: DuckDB Hot Storage (0-7 Days)

**Purpose:** Fast queries on recent traces

**Storage:** Per-tenant DuckDB files: `./data-duckdb/{tenant-id}.duckdb`

**Schema:**
```sql
CREATE TABLE traces (
    trace_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    spans JSON NOT NULL,  -- Array of spans
    duration_ms BIGINT,
    service_name TEXT,
    http_method TEXT,
    http_status_code INTEGER
) STRICT;

CREATE INDEX idx_traces_timestamp ON traces(timestamp);
CREATE INDEX idx_traces_service ON traces(service_name);
```

**Implementation:**
```java
@Named("insertIntoDuckDBProcessor")
@ApplicationScoped
public class InsertIntoDuckDBProcessor implements Processor {
    @Inject
    DuckDBService duckdb;

    @Override
    public void process(Exchange exchange) throws Exception {
        Trace trace = exchange.getIn().getBody(Trace.class);

        duckdb.insert(trace.getTenantId(), """
            INSERT INTO traces (trace_id, tenant_id, timestamp, spans, duration_ms, service_name)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            trace.getId(),
            trace.getTenantId(),
            trace.getTimestamp(),
            toJson(trace.getSpans()),
            trace.getDurationMs(),
            trace.getServiceName()
        );
    }
}
```

**Query Performance:**
- Simple queries: <100ms
- Complex aggregations: <1 second
- Full-text search: <500ms

### Tier 3: Parquet Cold Storage (7-365 Days)

**Purpose:** Cost-efficient long-term retention

**Storage:** Via `ColdStorageService` abstraction (deployment-agnostic per ADR-011)

**Default Implementation:** Local filesystem
```java
@ApplicationScoped
@DefaultBean
public class FilesystemColdStorage implements ColdStorageService {
    @ConfigProperty(name = "fluo.storage.cold.path", defaultValue = "./data-cold-storage")
    String coldStoragePath;

    @Override
    public String storeParquet(UUID tenantId, LocalDate date, Path parquetFile) throws IOException {
        Path tenantDir = Path.of(coldStoragePath, tenantId.toString());
        Files.createDirectories(tenantDir);

        Path destination = tenantDir.resolve(date.toString() + ".parquet");
        Files.move(parquetFile, destination, StandardCopyOption.REPLACE_EXISTING);

        return destination.toString();
    }
}
```

**External Implementations:** Consumers provide S3/MinIO/GCS implementations

**Compression:** ~10x space savings (JSON → compressed Parquet)

### Daily Archival Route (Camel)

**Route Definition:**
```java
@ApplicationScoped
public class StorageTierRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Daily archival: DuckDB → Parquet
        from("timer:dailyArchival?period=86400000")  // 24 hours
            .routeId("dailyArchival")
            .to("direct:archiveOldTraces");

        // Two-phase commit archival
        from("direct:archiveOldTraces")
            .routeId("archiveOldTraces")
            .process("identifyArchivableTenantsProcessor")
            .split(body())
            .to("direct:archiveTenantTraces");

        // Per-tenant archival with two-phase commit
        from("direct:archiveTenantTraces")
            .routeId("archiveTenantTraces")
            // Phase 1: Safe operations
            .process("exportDuckDBToParquetProcessor")      // Export to temp file
            .process("uploadParquetToStorageProcessor")     // Upload to ColdStorage
            .process("verifyParquetIntegrityProcessor")     // Verify checksum + row count
            .process("recordArchivalEventProcessor")        // TigerBeetle commit point
            // Phase 2: Cleanup (only if Phase 1 succeeded)
            .choice()
                .when(header("archivalVerified").isEqualTo(true))
                    .process("deleteDuckDBArchivedDataProcessor")
                .otherwise()
                    .to("direct:archivalErrorHandler");
    }
}
```

**Named Processors:**
```
com.fluo.processors/storage/
├── archival/
│   ├── ExportDuckDBToParquetProcessor.java
│   ├── UploadParquetToStorageProcessor.java
│   ├── VerifyParquetIntegrityProcessor.java
│   ├── RecordArchivalEventProcessor.java
│   └── DeleteDuckDBArchivedDataProcessor.java
└── query/
    ├── QueryHotStorageProcessor.java
    ├── QueryColdStorageProcessor.java
    └── MergeResultsProcessor.java
```

### Query Route (Hot + Cold Unified)

```java
// Query seamlessly across hot and cold storage
from("rest:get:/api/traces/query")
    .to("direct:queryTraces");

from("direct:queryTraces")
    .routeId("queryTraces")
    .process("parseQueryParametersProcessor")
    .process("queryHotStorageProcessor")      // DuckDB
    .process("queryColdStorageProcessor")     // Parquet
    .process("mergeResultsProcessor")         // Combine results
    .marshal().json();
```

**DuckDB can query Parquet directly:**
```sql
-- Query both hot (DuckDB) and cold (Parquet) in single query
SELECT * FROM traces              -- Hot storage
WHERE tenant_id = ?
  AND timestamp BETWEEN ? AND ?

UNION ALL

SELECT * FROM read_parquet(       -- Cold storage
    './data-cold-storage/{tenant-id}/*.parquet'
)
WHERE timestamp BETWEEN ? AND ?
ORDER BY timestamp DESC;
```

### Recovery Scenarios

**DuckDB Corruption:**
```
1. Delete corrupted DuckDB file
2. Replay append-only span log → Rebuild DuckDB
3. System operational in minutes
```

**Parquet Corruption:**
```
1. Identify corrupted Parquet date range
2. Replay append-only span log for that date → Regenerate Parquet
3. Upload to ColdStorage
```

**Complete Rebuild:**
```
Append-Only Span Log
   → Replay spans
   → Rebuild DuckDB (hot)
   → Export old dates
   → Rebuild Parquet (cold)
```

### Storage Efficiency

**Example: 10M traces/day, 5KB average**

| Storage Tier | Retention | Format | Size | Savings |
|--------------|-----------|--------|------|---------|
| Span Log | 365 days | JSON Lines | ~18TB | Baseline |
| DuckDB Hot | 7 days | Columnar | ~350GB | Baseline |
| Parquet Cold | 358 days | Compressed | ~1.8TB | **89% reduction** |
| **Total** | 365 days | Mixed | **~2.15TB** | **88% savings** |

Without tiered storage: 18TB (all JSON)
With tiered storage: 2.15TB

### Configuration

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

### Rule Replay Use Case

When a rule is updated, replay historical traces to validate:

```java
public ValidationReport validateRuleChange(UUID ruleId, String newExpression) {
    // Get traces that triggered this rule in last 7 days
    List<Trace> recentTraces = queryTraces(
        tenantId,
        Instant.now().minus(7, ChronoUnit.DAYS),
        Instant.now()
    );

    // Compile new rule
    Rule testRule = compileRule(newExpression);

    // Replay traces against new rule
    List<Signal> simulatedSignals = recentTraces.stream()
        .flatMap(trace -> testRule.evaluate(trace))
        .toList();

    return ValidationReport.of(simulatedSignals);
}
```

**Trace source:**
- Last 7 days: Query DuckDB (fast, <100ms)
- 7-365 days: Query Parquet via DuckDB (slower, <1s)
- Older: Replay from append-only span log

### Development Setup

**`flake.nix`:**
```nix
process-compose.yaml = {
  processes = {
    tigerbeetle = {
      command = "${pkgs.tigerbeetle}/bin/tigerbeetle start --addresses=127.0.0.1:3000 ./data-tigerbeetle/cluster_0_replica_0.tigerbeetle";
      availability.restart = "on_failure";
    };

    # ... existing processes (no Redis needed)
  };
};
```

**Initialize TigerBeetle:**
```bash
# In flake.nix shellHook or init script
mkdir -p data-tigerbeetle data-rules data-signals
tigerbeetle format --cluster=0 --replica=0 --replica-count=1 ./data-tigerbeetle/cluster_0_replica_0.tigerbeetle
```

## Success Criteria

**TigerBeetle Core:**
- [ ] TigerBeetle runs in local dev environment
- [ ] Tenants persist in TigerBeetle accounts
- [ ] Rules persist in TigerBeetle accounts + filesystem
- [ ] Signals immutable (WORM) in TigerBeetle transfers
- [ ] Rule signal counts accurate (TigerBeetle debitsPosted)
- [ ] Multi-tenant isolation (ledger partitioning)
- [ ] High throughput (10K+ signals/sec)
- [ ] Rules/tenants cached at startup for fast lookups

**Tiered Trace Storage:**
- [ ] Append-only span log writes spans on ingestion
- [ ] DuckDB stores last 7 days of traces
- [ ] Daily Camel route archives 7-day-old traces to Parquet
- [ ] Two-phase commit prevents data loss on archival failure
- [ ] Parquet integrity verification (checksum + row count)
- [ ] Query route seamlessly spans hot (DuckDB) and cold (Parquet)
- [ ] DuckDB can rebuild from append-only span log
- [ ] Per-tenant DuckDB files for isolation
- [ ] ColdStorageService abstraction (ADR-011 compliance)
- [ ] FilesystemColdStorage default implementation works locally

**Testing:**
- [ ] Repository tests (TigerBeetle operations)
- [ ] Idempotency tests (duplicate signal rejection)
- [ ] Archival processor unit tests (90% coverage)
- [ ] Integration tests (end-to-end archival flow)
- [ ] Property-based tenant isolation tests
- [ ] Recovery tests (rebuild from span log)
- [ ] Performance tests (1M trace archival)

## Testability Analysis

**Overall Testability Score: 4/10**

**Status:** ❌ NOT READY FOR IMPLEMENTATION

**BLOCKING ISSUES:**

1. **Tenant Isolation Mechanism Unspecified**
   - How are ledger IDs assigned? Hash collision risk not addressed
   - What happens if `tenantToLedgerId()` produces duplicate IDs?
   - No specification for ledger ID collision detection/resolution

2. **No Performance SLAs Defined**
   - "10K+ signals/sec" claimed but no test to verify
   - No query latency targets (P50, P95, P99)
   - No specification for acceptable archival duration

3. **Failure Mode Specifications Missing**
   - DuckDB corruption recovery untested
   - Parquet upload failure handling unclear
   - No specification for partial archival failures

4. **Observability Gaps**
   - No compliance spans for data operations
   - No metrics for storage tier health
   - Missing spans for archival success/failure

5. **Cross-PRD Integration Gaps**
   - How does auth (PRD-001) enforce tenant isolation in queries?
   - No integration tests with authenticated requests

### REQUIRED BEFORE IMPLEMENTATION

**Must Define:**
1. **Ledger ID Collision Policy**
   ```java
   // What happens here?
   int ledgerId1 = tenantToLedgerId(UUID.fromString("tenant-a"));
   int ledgerId2 = tenantToLedgerId(UUID.fromString("tenant-b"));
   if (ledgerId1 == ledgerId2) {
       // ??? Specification required
   }
   ```

2. **Query Authorization Integration**
   ```java
   // How is tenant ID from JWT enforced in queries?
   public List<Signal> getSignalsByTenant(UUID tenantId, int limit) {
       UUID authenticatedTenantId = ???; // Where does this come from?
       if (!tenantId.equals(authenticatedTenantId)) {
           // ??? Specification required
       }
   }
   ```

3. **Archival Failure Policies**
   - Max retries for Parquet upload failures
   - Behavior when ColdStorage is unreachable for >24h
   - Recovery procedure for partial archival

4. **Performance SLAs**
   - Signal write latency: P95 < 10ms, P99 < 50ms
   - Signal query latency: P95 < 100ms for last 7 days
   - Archival window: Complete within 4-hour window (2 AM - 6 AM)

### Enhanced Testing Requirements

**Unit Tests:**
- TigerBeetle account creation (tenants, rules)
- Transfer creation (signals)
- Filesystem metadata persistence
- **NEW: Ledger ID collision detection**
- **NEW: Tenant isolation enforcement at query level**
- **NEW: Cache invalidation on tenant deletion**

**Integration Tests:**
- Full flow: Create rule → Fire signal → Query signals
- Signal immutability (cannot modify after creation)
- Tenant isolation (ledger partitioning)
- Cache loading at startup
- **NEW: Cross-tenant query rejection (with auth from PRD-001)**
- **NEW: Archival flow with ColdStorage failure simulation**
- **NEW: DuckDB rebuild from span log**

**Idempotency Tests:**
- Duplicate signal creation with same ID → TigerBeetle rejects
- Duplicate rule creation → TigerBeetle rejects
- **NEW: Duplicate archival (same date) → Skip without error**

**Performance Tests:**
- Bulk signal creation (100K signals)
- Concurrent signal writes from multiple tenants
- Signal query performance with TigerBeetle filtering
- **NEW: Sustained write throughput test (10K signals/sec for 1 hour)**
- **NEW: Cold query performance (Parquet via DuckDB)**
- **NEW: Archival performance (1M traces in <4 hours)**

**Property-Based Tests (NEW):**
```java
@Property
void tenantIsolationInvariant(
    @ForAll UUID tenantA,
    @ForAll UUID tenantB,
    @ForAll List<Signal> signalsA,
    @ForAll List<Signal> signalsB
) {
    // Create signals for tenant A
    signalsA.forEach(s -> signalRepo.create(s.withTenantId(tenantA)));

    // Create signals for tenant B
    signalsB.forEach(s -> signalRepo.create(s.withTenantId(tenantB)));

    // Query tenant A's signals
    List<Signal> retrievedA = signalRepo.findByTenant(tenantA, 1000);

    // INVARIANT: Must only return tenant A's signals
    assertThat(retrievedA)
        .allMatch(s -> s.getTenantId().equals(tenantA))
        .hasSizeGreaterThanOrEqualTo(signalsA.size());

    // INVARIANT: Must not return any of tenant B's signals
    assertThat(retrievedA)
        .noneMatch(s -> s.getTenantId().equals(tenantB));
}
```

**Archival Failure Scenarios (NEW):**
```java
@Test
@DisplayName("Should handle ColdStorage upload failure with retry")
void testColdStorageUploadFailureRetry() throws Exception {
    // Mock ColdStorage to fail 2 times then succeed
    when(coldStorage.storeParquet(any(), any(), any()))
        .thenThrow(new IOException("S3 timeout"))
        .thenThrow(new IOException("S3 timeout"))
        .thenReturn("s3://bucket/tenant-a/2025-01-15.parquet");

    Exchange exchange = createArchivalExchange();
    processor.process(exchange);

    // Should have retried and succeeded
    assertEquals(true, exchange.getIn().getHeader("archivalVerified"));
    verify(coldStorage, times(3)).storeParquet(any(), any(), any());
}

@Test
@DisplayName("Should NOT delete DuckDB data on permanent ColdStorage failure")
void testColdStoragePermanentFailure() throws Exception {
    // Mock ColdStorage to always fail
    when(coldStorage.storeParquet(any(), any(), any()))
        .thenThrow(new IOException("S3 unreachable"));

    Exchange exchange = createArchivalExchange();
    processor.process(exchange);

    // Should NOT proceed to delete phase
    assertEquals(false, exchange.getIn().getHeader("archivalVerified"));
    verify(duckDBService, never()).deleteArchivedData(any(), any());

    // Should emit error span
    List<ComplianceSpan> spans = getGeneratedComplianceSpans(exchange);
    assertTrue(spans.stream()
        .anyMatch(s -> s.getName().equals("storage.archival.failed")));
}
```

**Recovery Tests (NEW):**
```java
@Test
@DisplayName("Should rebuild DuckDB from span log after corruption")
void testDuckDBRecoveryFromSpanLog() throws Exception {
    UUID tenantId = UUID.randomUUID();

    // Write 10K spans to span log over 7 days
    LocalDate today = LocalDate.now();
    for (int day = 0; day < 7; day++) {
        LocalDate date = today.minusDays(day);
        for (int i = 0; i < 10_000; i++) {
            Span span = createTestSpan(tenantId, date);
            spanLogService.append(span);
        }
    }

    // Corrupt DuckDB file
    Path duckDBFile = Path.of("./data-duckdb", tenantId + ".duckdb");
    Files.write(duckDBFile, "CORRUPTED".getBytes());

    // Trigger recovery
    duckDBService.rebuildFromSpanLog(tenantId);

    // Verify all 70K traces recovered
    List<Trace> traces = duckDBService.query(tenantId,
        today.minusDays(7).atStartOfDay(),
        today.atTime(23, 59, 59));

    assertEquals(70_000, traces.size());
}

@Test
@DisplayName("Should verify Parquet integrity before deleting DuckDB data")
void testParquetIntegrityVerification() throws Exception {
    Exchange exchange = createArchivalExchange();

    // Export DuckDB to Parquet
    exportProcessor.process(exchange);
    Path parquetFile = exchange.getIn().getHeader("parquetFile", Path.class);

    // Upload to ColdStorage
    uploadProcessor.process(exchange);
    String storageUri = exchange.getIn().getHeader("storageUri", String.class);

    // Verify integrity
    verifyProcessor.process(exchange);

    // Should verify:
    // 1. Row count matches DuckDB export
    assertEquals(10_000L, exchange.getIn().getHeader("parquetRowCount"));
    assertEquals(10_000L, exchange.getIn().getHeader("duckdbRowCount"));

    // 2. Checksum matches upload
    String localChecksum = exchange.getIn().getHeader("localChecksum", String.class);
    String remoteChecksum = exchange.getIn().getHeader("remoteChecksum", String.class);
    assertEquals(localChecksum, remoteChecksum);

    // 3. archivalVerified header set
    assertEquals(true, exchange.getIn().getHeader("archivalVerified"));
}
```

### Observability Requirements (NEW)

**Compliance Spans to Emit:**
```java
// Storage operations
complianceSpanProcessor.startComplianceSpan("storage.signal.created", SOC2Controls.CC7_1.class);
complianceSpanProcessor.startComplianceSpan("storage.span.persisted", SOC2Controls.CC7_1.class);

// Archival operations
complianceSpanProcessor.startComplianceSpan("storage.archival.started", SOC2Controls.CC7_2.class);
complianceSpanProcessor.startComplianceSpan("storage.archival.completed", SOC2Controls.CC7_2.class);
complianceSpanProcessor.startComplianceSpan("storage.archival.failed", SOC2Controls.CC7_2.class);

// Recovery operations
complianceSpanProcessor.startComplianceSpan("storage.recovery.started", SOC2Controls.CC8_1.class);
complianceSpanProcessor.startComplianceSpan("storage.recovery.completed", SOC2Controls.CC8_1.class);
```

**Metrics to Track:**
```java
// Write metrics
metricRegistry.histogram("storage.signal.write.duration_ms").update(duration);
metricRegistry.counter("storage.signal.write.total", "tenant", tenantId).inc();
metricRegistry.counter("storage.signal.write.failed", "tenant", tenantId, "error", errorType).inc();

// Query metrics
metricRegistry.histogram("storage.signal.query.duration_ms", "tier", "hot").update(duration);
metricRegistry.histogram("storage.signal.query.duration_ms", "tier", "cold").update(duration);
metricRegistry.counter("storage.signal.query.total", "tenant", tenantId).inc();

// Archival metrics
metricRegistry.timer("storage.archival.duration", "tenant", tenantId).update(duration);
metricRegistry.counter("storage.archival.rows", "tenant", tenantId).inc(rowCount);
metricRegistry.counter("storage.archival.failed", "tenant", tenantId, "phase", phase).inc();

// Storage tier health
metricRegistry.gauge("storage.duckdb.size_bytes", "tenant", tenantId).set(dbSizeBytes);
metricRegistry.gauge("storage.span_log.size_bytes", "tenant", tenantId).set(logSizeBytes);
metricRegistry.gauge("storage.cold.size_bytes", "tenant", tenantId).set(coldSizeBytes);
```

### External Dependency Failure Mode Matrix (NEW)

| Dependency | Failure Mode | Timeout | Retry Strategy | Fallback Behavior |
|------------|--------------|---------|----------------|-------------------|
| TigerBeetle | Connection lost | 2s | 3 retries, exp backoff | Queue signals in memory (max 10K), return 503 |
| TigerBeetle | Write timeout | 2s | 1 retry | Return 503, log error |
| DuckDB | Corruption detected | N/A | Rebuild from span log | Return 503, trigger rebuild, ETA in response |
| DuckDB | Query timeout | 5s | No retry | Return 504, suggest narrower time range |
| ColdStorage | Upload failure | 30s | 3 retries, exp backoff | Keep data in DuckDB, retry next cycle |
| ColdStorage | Download failure | 30s | 3 retries, exp backoff | Return 503, fall back to span log replay |
| Filesystem | Disk full | N/A | No retry | Return 507, alert ops, stop accepting writes |

### Cross-PRD Integration Tests (NEW)

**With PRD-001 (Authentication):**
```java
@Test
@DisplayName("Should enforce tenant isolation via JWT tenant ID")
void testAuthenticatedTenantIsolation() {
    // Authenticate as tenant A
    String tokenA = authenticateAsTenant(TENANT_A);

    // Create signals for tenant A
    createSignalsForTenant(TENANT_A, 100);

    // Authenticate as tenant B
    String tokenB = authenticateAsTenant(TENANT_B);

    // Try to query tenant A's signals with tenant B's token
    given()
        .header("Authorization", "Bearer " + tokenB)
        .queryParam("tenantId", TENANT_A)  // Attempt cross-tenant access
        .when()
        .get("/api/signals")
        .then()
        .statusCode(403)  // Must be forbidden
        .body("error", containsString("Cannot access other tenant's data"));

    // Query own signals should work
    given()
        .header("Authorization", "Bearer " + tokenB)
        .when()
        .get("/api/signals")
        .then()
        .statusCode(200)
        .body("signals", hasSize(0));  // Tenant B has no signals
}

@Test
@DisplayName("Should record auth events when accessing signals")
void testSignalAccessComplianceIntegration() {
    String token = authenticateAsTenant(TENANT_A);

    // Query signals
    given()
        .header("Authorization", "Bearer " + token)
        .when()
        .get("/api/signals")
        .then()
        .statusCode(200);

    // Verify both auth and storage compliance spans emitted
    List<ComplianceSpan> spans = getGeneratedComplianceSpans();

    assertTrue(spans.stream()
        .anyMatch(s -> s.getName().equals("auth.access.granted")));

    assertTrue(spans.stream()
        .anyMatch(s -> s.getName().equals("storage.signal.queried")));
}
```

### Minimum Test Coverage Targets

- **Overall Instruction Coverage:** 90%
- **Overall Branch Coverage:** 80%
- **Critical Services:** 95% instruction coverage
  - `TigerBeetleService`
  - `DuckDBService`
  - `SpanLogService`
  - All archival processors

### Mutation Testing Requirements

- **Mutation Score:** 70% minimum
- **Critical paths:** 90% mutation score
  - Tenant isolation logic
  - Ledger ID assignment
  - Archival integrity verification
  - Recovery procedures

## Files to Create

**Backend Services (TigerBeetle):**
- `backend/src/main/java/com/fluo/tigerbeetle/TigerBeetleService.java`
- `backend/src/main/java/com/fluo/repository/TenantRepository.java`
- `backend/src/main/java/com/fluo/repository/RuleRepository.java`
- `backend/src/main/java/com/fluo/repository/SignalRepository.java`

**Backend Services (Tiered Storage):**
- `backend/src/main/java/com/fluo/services/storage/ColdStorageService.java` (interface)
- `backend/src/main/java/com/fluo/services/storage/FilesystemColdStorage.java`
- `backend/src/main/java/com/fluo/services/DuckDBService.java`
- `backend/src/main/java/com/fluo/services/SpanLogService.java`
- `backend/src/main/java/com/fluo/services/ParquetExporter.java`

**Camel Routes:**
- `backend/src/main/java/com/fluo/routes/StorageTierRoutes.java`
- `backend/src/main/java/com/fluo/routes/SpanIngestionRoute.java`

**Processors (Archival):**
- `backend/src/main/java/com/fluo/processors/storage/archival/IdentifyArchivableTenantsProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/archival/ExportDuckDBToParquetProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/archival/UploadParquetToStorageProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/archival/VerifyParquetIntegrityProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/archival/RecordArchivalEventProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/archival/DeleteDuckDBArchivedDataProcessor.java`

**Processors (Query):**
- `backend/src/main/java/com/fluo/processors/storage/query/QueryHotStorageProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/query/QueryColdStorageProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/query/MergeResultsProcessor.java`

**Processors (Ingestion):**
- `backend/src/main/java/com/fluo/processors/storage/AppendToSpanLogProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/InsertIntoDuckDBProcessor.java`

**Models:**
- `backend/src/main/java/com/fluo/model/Tenant.java`
- `backend/src/main/java/com/fluo/model/Rule.java`
- `backend/src/main/java/com/fluo/model/Signal.java`
- `backend/src/main/java/com/fluo/model/Trace.java`

**Tests (TigerBeetle):**
- `backend/src/test/java/com/fluo/tigerbeetle/TigerBeetleServiceTest.java`
- `backend/src/test/java/com/fluo/repository/SignalRepositoryTest.java`
- `backend/src/test/java/com/fluo/repository/TenantIsolationTest.java`

**Tests (Tiered Storage):**
- `backend/src/test/java/com/fluo/routes/StorageTierRoutesTest.java`
- `backend/src/test/java/com/fluo/processors/storage/ArchivalProcessorsTest.java`
- `backend/src/test/java/com/fluo/processors/storage/QueryProcessorsTest.java`
- `backend/src/test/java/com/fluo/services/storage/TieredStorageIntegrationTest.java`
- `backend/src/test/java/com/fluo/services/storage/RecoveryTest.java`

**Dev Environment:**
- Update `flake.nix` with TigerBeetle process
- Update `flake.nix` with DuckDB dependency

## Implementation Notes

**TigerBeetle-Only Advantages:**
- **Zero external dependencies** - Single binary
- **Immutability** - Signals cannot be modified (audit integrity)
- **Performance** - 1M+ TPS sustained throughput
- **Deterministic** - Consistent across distributed deployments
- **Simple deployment** - No Redis to manage

**Data Model Mapping:**
- **Accounts** = Long-lived entities (tenants, rules)
- **Transfers** = Immutable events (signals)
- **Ledgers** = Tenant partitioning for isolation
- **user_data fields** = Packed metadata (128 + 64 + 32 bits)

**Metadata Strategy:**
- **TigerBeetle** = Core immutable data + packed metadata
- **In-memory cache** = Hot data (rules, tenants) loaded at startup
- **Local filesystem** = Rule expressions, cold storage

**Query Limitations:**
- TigerBeetle is append-only ledger, not a query engine
- Complex queries deferred to PRD-027 (DuckDB export)
- Simple queries: iterate transfers, use account counters
- Acceptable tradeoff for extreme write performance

**Tenant Isolation:**
- Each tenant gets unique ledger ID (hash of tenant UUID)
- TigerBeetle enforces ledger boundaries
- Cannot create transfers across ledgers

**Signal Status Updates:**
- Signals are WORM in TigerBeetle (cannot modify userData)
- Status conceptually immutable - create new "status change" transfer if needed
- Or accept that signal status is snapshot at creation time

**Backup & Recovery:**
- TigerBeetle has built-in replication (PRD-022)
- Filesystem metadata backed up with standard tools
- TigerBeetle data file is single file - easy to backup

**Cache Strategy:**
- Load all tenants and rules into memory at startup
- Acceptable because: small dataset (thousands of rules, not millions)
- Drools already caches compiled rules
- Signals not cached (query on demand)

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - Deployment-agnostic design (ColdStorageService abstraction)
- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Physical isolation via ledgers and per-tenant files
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - Archival routes implemented as Camel
- **[ADR-014: Camel Route Testing and Code Organization Standards](../adrs/014-camel-testing-and-organization-standards.md)** - Testing requirements
- **[ADR-015: Tiered Storage Architecture](../adrs/015-tiered-storage-architecture.md)** - Trace storage strategy

## Dependencies

**Requires PRD-001:** Authentication system must exist to associate rules with tenants.

**Blocks:**
- PRD-008: Signal Management (needs persistence)
- PRD-009: Trace Ingestion (needs to persist signals)
- PRD-012: Tenant Management (needs tenant storage)

## Future Enhancements

- **TigerBeetle Query API:** When available, improve signal queries
- **Multi-region Replication:** TigerBeetle supports distributed clusters
- **DuckDB Integration:** Export signals for analytics (PRD-027)
- **Event Sourcing:** TigerBeetle transfers are natural event stream
