# PRD-020a: Batching Infrastructure

**Parent PRD:** PRD-020 (Performance Optimization)
**Unit:** A
**Priority:** P1
**Dependencies:** None (foundation for all other units)

## Scope

Implement batching infrastructure for all storage layers (span log, TigerBeetle, DuckDB). This is the foundation for all performance improvements, providing the fastest wins through batch writes.

**What this unit implements:**
- Batch span log writer with buffering and scheduled flushing
- Batch TigerBeetle transfer creation (128 transfers per call)
- Batch DuckDB signal inserts (1000 rows per transaction)
- DuckDB connection pooling with HikariCP
- Performance metrics collection service

**What this unit does NOT implement:**
- Async SEDA pipeline (Unit B)
- Streaming evaluation (Unit C)
- Caching (Unit D)
- Backpressure/circuit breakers (Unit E)

## Implementation

### 1. Batch Span Log Writer

**`com/betrace/processors/storage/BatchSpanLogWriteProcessor.java`:**
```java
@Named("batchSpanLogWriteProcessor")
@ApplicationScoped
public class BatchSpanLogWriteProcessor implements Processor {

    @ConfigProperty(name = "betrace.storage.span-log.path", defaultValue = "./data-span-log")
    String spanLogPath;

    private final Map<UUID, BufferedWriter> writerCache = new ConcurrentHashMap<>();
    private final ScheduledExecutorService flusher = Executors.newSingleThreadScheduledExecutor();

    @PostConstruct
    public void init() {
        // Flush buffers every 1 second
        flusher.scheduleAtFixedRate(this::flushAll, 1, 1, TimeUnit.SECONDS);
    }

    @Override
    public void process(Exchange exchange) throws Exception {
        List<Span> spans = exchange.getIn().getBody(List.class);
        Map<UUID, List<Span>> spansByTenant = groupByTenant(spans);

        for (Map.Entry<UUID, List<Span>> entry : spansByTenant.entrySet()) {
            UUID tenantId = entry.getKey();
            List<Span> tenantSpans = entry.getValue();

            BufferedWriter writer = getOrCreateWriter(tenantId);

            for (Span span : tenantSpans) {
                String jsonLine = toJsonLine(span);
                writer.write(jsonLine);
                writer.newLine();
            }
        }

        exchange.getIn().setHeader("spansWritten", spans.size());
    }

    private BufferedWriter getOrCreateWriter(UUID tenantId) throws IOException {
        return writerCache.computeIfAbsent(tenantId, tid -> {
            try {
                Path tenantDir = Path.of(spanLogPath, tid.toString());
                Files.createDirectories(tenantDir);

                Path logFile = tenantDir.resolve(LocalDate.now().toString() + ".jsonl");

                return Files.newBufferedWriter(
                    logFile,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND
                );
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    private void flushAll() {
        writerCache.values().forEach(writer -> {
            try {
                writer.flush();
            } catch (IOException e) {
                log.error("Failed to flush span log writer", e);
            }
        });
    }

    @PreDestroy
    public void cleanup() {
        flusher.shutdown();
        writerCache.values().forEach(writer -> {
            try {
                writer.close();
            } catch (IOException e) {
                log.error("Failed to close span log writer", e);
            }
        });
    }

    private Map<UUID, List<Span>> groupByTenant(List<Span> spans) {
        return spans.stream().collect(Collectors.groupingBy(Span::getTenantId));
    }

    private String toJsonLine(Span span) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.writeValueAsString(span);
    }
}
```

### 2. Batch TigerBeetle Write Processor

**`com/betrace/processors/storage/BatchTigerBeetleWriteProcessor.java`:**
```java
@Named("batchTigerBeetleWriteProcessor")
@ApplicationScoped
public class BatchTigerBeetleWriteProcessor implements Processor {

    @Inject
    TigerBeetleClient tbClient;

    private static final int MAX_BATCH_SIZE = 128; // TigerBeetle batch limit

    @Override
    public void process(Exchange exchange) throws Exception {
        List<Signal> signals = exchange.getIn().getBody(List.class);

        // Convert signals to TigerBeetle transfers
        List<TBTransfer> transfers = new ArrayList<>();

        for (Signal signal : signals) {
            TBTransfer transfer = new TBTransfer(
                id: toUInt128(signal.getId()),
                debitAccountId: toUInt128(signal.getTenantId()),
                creditAccountId: SIGNAL_ACCOUNT,
                amount: 1,
                userData128: packSignalMetadata(signal),
                userData64: signal.getTimestamp().toEpochMilli(),
                code: 2, // Signal event type
                ledger: tenantToLedgerId(signal.getTenantId()),
                timestamp: Instant.now().toEpochMilli() * 1_000_000
            );
            transfers.add(transfer);
        }

        // Batch create transfers (up to 128 at a time)
        int batchCount = 0;
        for (int i = 0; i < transfers.size(); i += MAX_BATCH_SIZE) {
            List<TBTransfer> batch = transfers.subList(
                i,
                Math.min(i + MAX_BATCH_SIZE, transfers.size())
            );

            long startTime = System.nanoTime();
            tbClient.createTransfers(batch);
            long duration = (System.nanoTime() - startTime) / 1_000_000;

            batchCount++;
            log.debug("Batch {}: Wrote {} transfers to TigerBeetle in {}ms",
                batchCount, batch.size(), duration);
        }

        exchange.getIn().setHeader("transfersWritten", transfers.size());
        exchange.getIn().setHeader("batchCount", batchCount);
    }
}
```

### 3. Batch DuckDB Insert Processor

**`com/betrace/processors/storage/BatchDuckDBInsertProcessor.java`:**
```java
@Named("batchDuckDBInsertProcessor")
@ApplicationScoped
public class BatchDuckDBInsertProcessor implements Processor {

    @Inject
    DuckDBConnectionPool duckDB;

    @Override
    public void process(Exchange exchange) throws Exception {
        List<Signal> signals = exchange.getIn().getBody(List.class);

        if (signals.isEmpty()) {
            return;
        }

        // Group signals by tenant for per-tenant DuckDB files
        Map<UUID, List<Signal>> signalsByTenant = signals.stream()
            .collect(Collectors.groupingBy(Signal::getTenantId));

        for (Map.Entry<UUID, List<Signal>> entry : signalsByTenant.entrySet()) {
            UUID tenantId = entry.getKey();
            List<Signal> tenantSignals = entry.getValue();

            try (Connection conn = duckDB.getConnection(tenantId)) {
                // Batch insert using prepared statement
                String sql = """
                    INSERT INTO signals (id, rule_id, trace_id, timestamp, severity, message, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?::JSON)
                    """;

                try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                    for (Signal signal : tenantSignals) {
                        stmt.setString(1, signal.getId().toString());
                        stmt.setString(2, signal.getRuleId());
                        stmt.setString(3, signal.getTraceId());
                        stmt.setTimestamp(4, Timestamp.from(signal.getTimestamp()));
                        stmt.setString(5, signal.getSeverity().name());
                        stmt.setString(6, signal.getMessage());
                        stmt.setString(7, toJson(signal.getMetadata()));
                        stmt.addBatch();
                    }

                    long startTime = System.nanoTime();
                    int[] results = stmt.executeBatch();
                    long duration = (System.nanoTime() - startTime) / 1_000_000;

                    log.debug("Inserted {} signals for tenant {} in {}ms",
                        results.length, tenantId, duration);
                }
            }
        }

        exchange.getIn().setHeader("signalsInserted", signals.size());
    }

    private String toJson(Map<String, Object> metadata) throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.writeValueAsString(metadata);
    }
}
```

### 4. DuckDB Connection Pool

**`com/betrace/services/DuckDBConnectionPool.java`:**
```java
@ApplicationScoped
public class DuckDBConnectionPool {

    @ConfigProperty(name = "betrace.storage.hot.path", defaultValue = "./data-duckdb")
    String duckdbPath;

    private final Map<UUID, HikariDataSource> dataSources = new ConcurrentHashMap<>();

    public Connection getConnection(UUID tenantId) throws SQLException {
        HikariDataSource ds = dataSources.computeIfAbsent(tenantId, tid -> {
            HikariConfig config = new HikariConfig();
            config.setJdbcUrl("jdbc:duckdb:" + duckdbPath + "/" + tid + ".duckdb");
            config.setMaximumPoolSize(5);  // 5 connections per tenant
            config.setMinimumIdle(1);
            config.setConnectionTimeout(5000);
            return new HikariDataSource(config);
        });

        return ds.getConnection();
    }

    @PreDestroy
    public void cleanup() {
        dataSources.values().forEach(HikariDataSource::close);
    }
}
```

### 5. Metrics Service

**`com/betrace/services/MetricsService.java`:**
```java
@ApplicationScoped
public class MetricsService {

    private final AtomicLong spanIngestionCount = new AtomicLong(0);
    private final AtomicLong ruleEvaluationCount = new AtomicLong(0);
    private final AtomicLong signalCreationCount = new AtomicLong(0);

    private final List<Long> spanIngestionLatencies = new CopyOnWriteArrayList<>();
    private final List<Long> ruleEvaluationLatencies = new CopyOnWriteArrayList<>();
    private final List<Long> tigerBeetleWriteLatencies = new CopyOnWriteArrayList<>();
    private final List<Long> duckDBInsertLatencies = new CopyOnWriteArrayList<>();

    public void recordSpanIngestion(long count, long latencyMs) {
        spanIngestionCount.addAndGet(count);
        spanIngestionLatencies.add(latencyMs);
    }

    public void recordRuleEvaluation(long latencyMs) {
        ruleEvaluationCount.incrementAndGet();
        ruleEvaluationLatencies.add(latencyMs);
    }

    public void recordSignalCreation(long count) {
        signalCreationCount.addAndGet(count);
    }

    public void recordTigerBeetleWrite(long latencyMs) {
        tigerBeetleWriteLatencies.add(latencyMs);
    }

    public void recordDuckDBInsert(long latencyMs) {
        duckDBInsertLatencies.add(latencyMs);
    }

    public double getSpanIngestionRate() {
        return spanIngestionCount.get() / 60.0; // Per minute
    }

    public long getRuleEvaluationP99() {
        return calculateP99(ruleEvaluationLatencies);
    }

    public long getTigerBeetleWriteLatency() {
        return calculateP99(tigerBeetleWriteLatencies);
    }

    public long getDuckDBInsertThroughput() {
        return signalCreationCount.get() / 60; // Per minute
    }

    private long calculateP99(List<Long> latencies) {
        if (latencies.isEmpty()) {
            return 0;
        }
        List<Long> sorted = new ArrayList<>(latencies);
        sorted.sort(Long::compareTo);
        int index = (int) (sorted.size() * 0.99);
        return sorted.get(Math.min(index, sorted.size() - 1));
    }
}
```

## Configuration Properties

```properties
# Batch Configuration
betrace.batch.span-log.buffer-size=1000
betrace.batch.span-log.flush-interval-ms=1000
betrace.batch.tigerbeetle.max-batch-size=128
betrace.batch.duckdb.max-batch-size=1000

# DuckDB Connection Pool
betrace.duckdb.pool.max-connections-per-tenant=5
betrace.duckdb.pool.min-idle=1
betrace.duckdb.pool.connection-timeout-ms=5000

# Storage Paths
betrace.storage.span-log.path=./data-span-log
betrace.storage.hot.path=./data-duckdb
```

## Success Criteria

- [ ] BatchSpanLogWriteProcessor writes spans in batches with scheduled flushing
- [ ] BatchTigerBeetleWriteProcessor creates up to 128 transfers per batch
- [ ] BatchDuckDBInsertProcessor inserts 1000 rows per transaction
- [ ] DuckDBConnectionPool provides thread-safe connection pooling per tenant
- [ ] MetricsService tracks throughput and latency metrics
- [ ] TigerBeetle write latency: <5ms p99 for 128-transfer batches
- [ ] DuckDB insert throughput: 50K rows/sec
- [ ] All processors follow ADR-014 naming conventions
- [ ] 90% test coverage for all processors (ADR-014)

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**`BatchSpanLogWriteProcessorTest.java`:**
- Test batch writing to span log
- Test tenant isolation (separate files per tenant)
- Test scheduled flushing (1-second interval)
- Test cleanup on shutdown

**`BatchTigerBeetleWriteProcessorTest.java`:**
- Test batch transfer creation (128 max per batch)
- Test multiple batches when exceeding 128
- Test transfer metadata packing
- Test error handling on TigerBeetle failures

**`BatchDuckDBInsertProcessorTest.java`:**
- Test batch inserts (1000 rows per transaction)
- Test tenant-specific DuckDB files
- Test JSON metadata serialization
- Test error handling on SQL failures

**`DuckDBConnectionPoolTest.java`:**
- Test connection pooling per tenant
- Test concurrent connection acquisition
- Test connection reuse
- Test cleanup on shutdown

**`MetricsServiceTest.java`:**
- Test metric recording
- Test p99 latency calculation
- Test throughput calculation
- Test concurrent metric updates

### JMH Benchmarks

**`TigerBeetleBatchWriteBenchmark.java`:**
```java
@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
public class TigerBeetleBatchWriteBenchmark {

    @Param({"1", "10", "50", "128"})
    private int batchSize;

    private TigerBeetleClient tbClient;

    @Setup
    public void setup() {
        tbClient = new TigerBeetleClient();
    }

    @Benchmark
    public void benchmarkBatchTransferCreation(Blackhole blackhole) {
        List<TBTransfer> transfers = generateTestTransfers(batchSize);
        tbClient.createTransfers(transfers);
        blackhole.consume(transfers);
    }
}
```

**`DuckDBBatchInsertBenchmark.java`:**
```java
@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
public class DuckDBBatchInsertBenchmark {

    @Param({"1", "100", "1000"})
    private int batchSize;

    private DuckDBConnectionPool pool;
    private UUID tenantId;

    @Setup
    public void setup() {
        pool = new DuckDBConnectionPool();
        tenantId = UUID.randomUUID();
    }

    @Benchmark
    public void benchmarkBatchInsert(Blackhole blackhole) throws Exception {
        List<Signal> signals = generateTestSignals(batchSize);
        try (Connection conn = pool.getConnection(tenantId)) {
            // Batch insert logic
        }
        blackhole.consume(signals);
    }
}
```

## Files to Create

### Backend - Processors
- `backend/src/main/java/com/betrace/processors/storage/BatchSpanLogWriteProcessor.java`
- `backend/src/main/java/com/betrace/processors/storage/BatchTigerBeetleWriteProcessor.java`
- `backend/src/main/java/com/betrace/processors/storage/BatchDuckDBInsertProcessor.java`

### Backend - Services
- `backend/src/main/java/com/betrace/services/DuckDBConnectionPool.java`
- `backend/src/main/java/com/betrace/services/MetricsService.java`

### Tests - Unit Tests
- `backend/src/test/java/com/betrace/processors/storage/BatchSpanLogWriteProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/storage/BatchTigerBeetleWriteProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/storage/BatchDuckDBInsertProcessorTest.java`
- `backend/src/test/java/com/betrace/services/DuckDBConnectionPoolTest.java`
- `backend/src/test/java/com/betrace/services/MetricsServiceTest.java`

### Tests - JMH Benchmarks
- `backend/src/test/java/com/betrace/benchmarks/TigerBeetleBatchWriteBenchmark.java`
- `backend/src/test/java/com/betrace/benchmarks/DuckDBBatchInsertBenchmark.java`

## Files to Modify

### Backend - TigerBeetle Client
- `backend/src/main/java/com/betrace/tigerbeetle/TigerBeetleService.java`
  - Add batch transfer creation method: `createTransfers(List<TBTransfer>)`

### Backend - Signal Service
- `backend/src/main/java/com/betrace/services/SignalService.java`
  - Add batch signal creation method: `createSignals(List<Signal>)`

### Dependencies (pom.xml)
- Add HikariCP dependency
- Add JMH dependencies for benchmarks

```xml
<!-- Add to backend/pom.xml -->
<dependency>
    <groupId>com.zaxxer</groupId>
    <artifactId>HikariCP</artifactId>
    <version>5.0.1</version>
</dependency>

<!-- JMH Benchmarks -->
<dependency>
    <groupId>org.openjdk.jmh</groupId>
    <artifactId>jmh-core</artifactId>
    <version>1.37</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.openjdk.jmh</groupId>
    <artifactId>jmh-generator-annprocess</artifactId>
    <version>1.37</version>
    <scope>test</scope>
</dependency>
```

## Implementation Timeline

**Week 1:** Batching Foundation
- Day 1-2: BatchSpanLogWriteProcessor + tests
- Day 3-4: BatchTigerBeetleWriteProcessor + tests
- Day 5: BatchDuckDBInsertProcessor + tests + DuckDBConnectionPool
- Day 6-7: JMH benchmarks, MetricsService

**Deliverable:** Batching processors tested and benchmarked

## Dependencies

**Requires:**
- PRD-002: TigerBeetle and DuckDB clients
- Existing span and signal models

**Blocks:**
- Unit B (Async SEDA pipeline needs batching)
- Unit E (Backpressure needs metrics)
- Unit F (Performance testing validates batching)

## Performance Targets

- TigerBeetle write latency: <5ms p99 (128 transfers per batch)
- DuckDB insert throughput: 50K rows/sec (1000 rows per batch)
- Span log write throughput: 100K spans/sec (buffered writes)

## ADR Compliance

- **ADR-011:** Pure application, no deployment coupling
- **ADR-013:** Processors work with Camel (integrated in Unit B)
- **ADR-014:** Named processors with 90% test coverage
- **ADR-015:** Optimized tiered storage writes
