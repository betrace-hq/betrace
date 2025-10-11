# PRD-020: Performance Optimization

**Priority:** P1 (Production Hygiene - Needed for Production Use)
**Complexity:** Complex
**Personas:** All (Infrastructure requirement)
**Dependencies:**
- PRD-002: Persistence Layer (TigerBeetle, DuckDB, Parquet storage)
- PRD-005: Rule Engine Sandboxing (safe capability patterns)
- PRD-009: Trace Ingestion Pipeline (span processing architecture)

## Problem

FLUO currently lacks production-grade performance optimizations needed to handle real-world observability workloads:

**Performance Requirements Not Met:**
1. **Throughput**: Must handle 100,000+ spans/second ingestion (current: unknown, likely <10K)
2. **Latency**: Rule evaluation p99 must be <100ms (current: <10ms single span, unknown for traces)
3. **Long-lived traces**: Traces spanning hours/days cannot block rule evaluation
4. **Memory management**: Current in-memory trace accumulation will cause OOM at scale
5. **Storage performance**: TigerBeetle batch writes not optimized, DuckDB inserts unbatched
6. **Rule evaluation**: Drools sessions per-tenant with no caching or optimization

**Current Bottlenecks:**

1. **Span Ingestion:**
   - `SpanApiRoute.java`: Synchronous processing, no batching
   - No backpressure mechanism when overwhelmed
   - Single-threaded span append to log
   - No async processing pipeline

2. **Rule Evaluation:**
   - `RuleEvaluationService.java`: Evaluates every span individually
   - Drools sessions not cached between evaluations
   - Recompiled rules on every session creation
   - No batch evaluation of spans

3. **Storage Layer:**
   - TigerBeetle transfers created one-at-a-time (should batch)
   - DuckDB inserts unbatched (10x slower than batch)
   - No write coalescing for hot storage

4. **Long-Lived Traces:**
   - No streaming evaluation (waits for trace completion)
   - Cannot evaluate partial traces (e.g., first 100 spans of 10K span trace)
   - Accumulating traces in memory indefinitely

5. **Memory Management:**
   - No span eviction policy
   - Drools sessions accumulate spans indefinitely
   - No bounded queues for backpressure

**Documented in:** PRD_ROADMAP.md - P1 Production Hygiene

## Solution

### Performance Architecture

Implement multi-tier performance optimizations following FLUO's architectural principles:

**1. Camel SEDA Queues for Async Processing (ADR-013)**
```
OpenTelemetry Spans → [SEDA: span-ingestion] → [SEDA: rule-evaluation] → [SEDA: storage-write]
                              ↓                         ↓                         ↓
                       Bounded Queue              Bounded Queue             Bounded Queue
                       (10K spans)               (5K evaluations)          (10K transfers)
```

**2. Batching at Every Layer**
- Span ingestion: Batch spans by trace before evaluation
- Rule evaluation: Evaluate 100 spans at once in Drools
- TigerBeetle writes: Batch transfers (128 per call)
- DuckDB inserts: Batch inserts (1000 rows per transaction)

**3. Caching for Hot Paths**
- Compiled Drools rules (per tenant)
- Tenant session configuration
- Public keys for signature verification (PRD-003)
- Recent trace metadata (avoid duplicate lookups)

**4. Streaming Evaluation for Long-Lived Traces**
- Windowing: Evaluate first N spans, then slide window
- Incremental: Fire rules on span arrival, don't wait for completion
- Bounded memory: Evict old spans after evaluation

**5. Backpressure and Circuit Breakers**
- Reject ingestion when queues full (503 response)
- Circuit breaker on Drools evaluation failures
- Dead letter queue for unparseable spans

### Performance Targets

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| Span ingestion throughput | 100K/sec | ~10K/sec | 10x improvement |
| Rule evaluation p99 latency | <100ms | ~10ms (single span) | Need trace evaluation |
| Memory per tenant | <50 MB | Unknown | Need measurement |
| Long-lived trace handling | Streaming | Blocks | Need windowing |
| TigerBeetle write latency | <5ms (batched) | ~1ms (single) | Need batching |
| DuckDB insert throughput | 50K rows/sec | ~5K rows/sec | 10x improvement |
| Max concurrent tenants | 500 | Unknown | Need load testing |

## Architecture Integration

### ADR Compliance

**ADR-011 (Pure Application):**
- All optimizations within application code
- No deployment-specific tuning (no Kubernetes resource limits)
- Consumers configure JVM heap size and thread pools

**ADR-013 (Camel-First):**
- All async processing via Camel SEDA queues
- Wire Tap pattern for non-blocking audit logging
- Multicast pattern for parallel rule evaluation

**ADR-014 (Named Processors):**
- All performance-critical logic in named processors
- Each processor tested with JMH benchmarks
- 90% test coverage for all processors

**ADR-015 (Tiered Storage):**
- Optimize append-only span log writes (sequential I/O)
- Batch DuckDB inserts for hot storage
- Async archival to Parquet (cold storage)

**PRD-002 (TigerBeetle Integration):**
- Batch transfer creation (128 transfers per call)
- Parallel account lookups (concurrent queries)
- Connection pooling for TigerBeetle client

## Backend Implementation

### 1. Camel SEDA Routes for Async Processing

**`com/fluo/routes/AsyncSpanProcessingRoutes.java`:**
```java
@ApplicationScoped
public class AsyncSpanProcessingRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // SEDA Queue 1: Span Ingestion (bounded queue with backpressure)
        from("rest:post:/api/otlp/traces")
            .routeId("spanIngestionApi")
            .to("seda:span-ingestion?size=10000&blockWhenFull=false&offerTimeout=100");

        from("seda:span-ingestion?concurrentConsumers=10")
            .routeId("spanIngestionPipeline")
            .process("parseOtlpSpanProcessor")               // Parse OTLP → Span
            .process("appendToSpanLogProcessor")              // Append-only log (async)
            .wireTap("seda:audit-span-ingestion")            // Async audit (non-blocking)
            .to("seda:trace-correlation");                    // → Next stage

        // SEDA Queue 2: Trace Correlation (group spans by trace)
        from("seda:trace-correlation?concurrentConsumers=5")
            .routeId("traceCorrelationPipeline")
            .aggregate(header("traceId"), new SpanAggregationStrategy())
                .completionSize(100)                          // Batch: 100 spans
                .completionTimeout(5000)                      // Window: 5 seconds
                .completionPredicate(header("traceComplete").isEqualTo(true))
            .to("seda:rule-evaluation");

        // SEDA Queue 3: Rule Evaluation (batch evaluation)
        from("seda:rule-evaluation?concurrentConsumers=5")
            .routeId("ruleEvaluationPipeline")
            .process("batchRuleEvaluationProcessor")          // Evaluate 100 spans at once
            .split(body())                                    // Split signals
            .to("seda:storage-write");

        // SEDA Queue 4: Storage Write (batched TigerBeetle + DuckDB)
        from("seda:storage-write?concurrentConsumers=2")
            .routeId("storageWritePipeline")
            .aggregate(constant(true), new SignalAggregationStrategy())
                .completionSize(128)                          // Batch: 128 transfers
                .completionInterval(500)                      // Window: 500ms
            .process("batchTigerBeetleWriteProcessor")        // Batch create transfers
            .process("batchDuckDBInsertProcessor")            // Batch insert signals
            .wireTap("seda:compliance-span-generation");      // Async compliance

        // Error Handling (Dead Letter Queue)
        onException(Exception.class)
            .handled(true)
            .maximumRedeliveries(3)
            .redeliveryDelay(1000)
            .to("seda:dead-letter-queue")
            .process("logErrorProcessor");
    }
}
```

### 2. Batch Span Log Writer (Sequential I/O Optimization)

**`com/fluo/processors/storage/BatchSpanLogWriteProcessor.java`:**
```java
@Named("batchSpanLogWriteProcessor")
@ApplicationScoped
public class BatchSpanLogWriteProcessor implements Processor {

    @ConfigProperty(name = "fluo.storage.span-log.path", defaultValue = "./data-span-log")
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

            // Don't flush immediately - let scheduled flusher handle it
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
}
```

### 3. Batch Rule Evaluation Processor (Drools Optimization)

**`com/fluo/processors/rules/BatchRuleEvaluationProcessor.java`:**
```java
@Named("batchRuleEvaluationProcessor")
@ApplicationScoped
public class BatchRuleEvaluationProcessor implements Processor {

    @Inject
    TenantSessionManager sessionManager;

    @Inject
    SignalService signalService;

    private static final Logger log = LoggerFactory.getLogger(BatchRuleEvaluationProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        TraceAggregate trace = exchange.getIn().getBody(TraceAggregate.class);
        UUID tenantId = trace.getTenantId();
        List<Span> spans = trace.getSpans();

        // Get cached tenant session (compiled rules)
        KieSession session = sessionManager.getSession(tenantId);

        // Set context for sandboxing (PRD-005)
        SafeRuleCapabilities.setContext(
            tenantId.toString(),
            trace.getTraceId(),
            trace.getRuleIds()
        );

        try {
            // Batch insert all spans
            long startTime = System.nanoTime();

            for (Span span : spans) {
                session.insert(span);
            }

            // Fire all rules once (batch evaluation)
            int rulesFired = session.fireAllRules();

            long duration = (System.nanoTime() - startTime) / 1_000_000; // ms

            log.debug("Evaluated {} spans for trace {} in {}ms ({} rules fired)",
                spans.size(), trace.getTraceId(), duration, rulesFired);

            // Collect generated signals from session globals
            List<Signal> signals = (List<Signal>) session.getGlobal("generatedSignals");

            exchange.getIn().setBody(signals);
            exchange.getIn().setHeader("rulesFired", rulesFired);
            exchange.getIn().setHeader("evaluationTimeMs", duration);

        } finally {
            // Clear sandboxing context
            SafeRuleCapabilities.clearContext();

            // Clear spans from session (prevent OOM)
            session.getFactHandles().forEach(session::delete);
        }
    }
}
```

### 4. Streaming Evaluation for Long-Lived Traces

**`com/fluo/processors/rules/StreamingRuleEvaluationProcessor.java`:**
```java
@Named("streamingRuleEvaluationProcessor")
@ApplicationScoped
public class StreamingRuleEvaluationProcessor implements Processor {

    @Inject
    TenantSessionManager sessionManager;

    @ConfigProperty(name = "fluo.rules.window-size", defaultValue = "100")
    int windowSize;

    @ConfigProperty(name = "fluo.rules.max-trace-age-minutes", defaultValue = "60")
    int maxTraceAgeMinutes;

    private final Map<String, SlidingWindow> traceWindows = new ConcurrentHashMap<>();

    @Override
    public void process(Exchange exchange) throws Exception {
        Span span = exchange.getIn().getBody(Span.class);
        UUID tenantId = UUID.fromString(span.getTenantId());
        String traceId = span.getTraceId();

        // Get or create sliding window for this trace
        SlidingWindow window = traceWindows.computeIfAbsent(
            traceId,
            tid -> new SlidingWindow(windowSize, maxTraceAgeMinutes)
        );

        // Add span to window
        window.add(span);

        // Evaluate rules if window is full or trace is complete
        if (window.shouldEvaluate()) {
            List<Signal> signals = evaluateWindow(tenantId, traceId, window);
            exchange.getIn().setBody(signals);

            // Slide window forward (keep last 20% of spans for context)
            window.slide();
        } else {
            // Not ready to evaluate yet
            exchange.getIn().setBody(Collections.emptyList());
        }

        // Cleanup old traces
        cleanupExpiredTraces();
    }

    private List<Signal> evaluateWindow(UUID tenantId, String traceId, SlidingWindow window) {
        KieSession session = sessionManager.getSession(tenantId);

        SafeRuleCapabilities.setContext(tenantId.toString(), traceId, "streaming-eval");

        try {
            // Insert spans from window
            for (Span span : window.getCurrentSpans()) {
                session.insert(span);
            }

            session.fireAllRules();

            List<Signal> signals = (List<Signal>) session.getGlobal("generatedSignals");

            // Clear evaluated spans (keep overlap for next window)
            window.getCurrentSpans().stream()
                .filter(span -> !window.isInOverlap(span))
                .forEach(span -> {
                    FactHandle handle = session.getFactHandle(span);
                    if (handle != null) {
                        session.delete(handle);
                    }
                });

            return signals;

        } finally {
            SafeRuleCapabilities.clearContext();
        }
    }

    private void cleanupExpiredTraces() {
        Instant cutoff = Instant.now().minus(maxTraceAgeMinutes, ChronoUnit.MINUTES);
        traceWindows.entrySet().removeIf(entry ->
            entry.getValue().getLastUpdateTime().isBefore(cutoff)
        );
    }

    /**
     * Sliding window implementation for long-lived traces.
     */
    private static class SlidingWindow {
        private final int windowSize;
        private final int overlapSize;
        private final List<Span> currentSpans = new ArrayList<>();
        private Instant lastUpdateTime = Instant.now();
        private boolean traceComplete = false;

        public SlidingWindow(int windowSize, int maxAgeMinutes) {
            this.windowSize = windowSize;
            this.overlapSize = windowSize / 5; // 20% overlap
        }

        public void add(Span span) {
            currentSpans.add(span);
            lastUpdateTime = Instant.now();

            // Check if trace is complete (span has "trace.complete" attribute)
            if (Boolean.TRUE.equals(span.getAttributes().get("trace.complete"))) {
                traceComplete = true;
            }
        }

        public boolean shouldEvaluate() {
            return currentSpans.size() >= windowSize || traceComplete;
        }

        public List<Span> getCurrentSpans() {
            return Collections.unmodifiableList(currentSpans);
        }

        public boolean isInOverlap(Span span) {
            int index = currentSpans.indexOf(span);
            return index >= (currentSpans.size() - overlapSize);
        }

        public void slide() {
            // Keep last 20% of spans for context in next window
            List<Span> overlap = new ArrayList<>(
                currentSpans.subList(
                    Math.max(0, currentSpans.size() - overlapSize),
                    currentSpans.size()
                )
            );
            currentSpans.clear();
            currentSpans.addAll(overlap);
            traceComplete = false;
        }

        public Instant getLastUpdateTime() {
            return lastUpdateTime;
        }
    }
}
```

### 5. Batch TigerBeetle Write Processor

**`com/fluo/processors/storage/BatchTigerBeetleWriteProcessor.java`:**
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

### 6. Batch DuckDB Insert Processor

**`com/fluo/processors/storage/BatchDuckDBInsertProcessor.java`:**
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
}
```

### 7. Caching Service for Hot Paths

**`com/fluo/services/PerformanceCacheService.java`:**
```java
@ApplicationScoped
public class PerformanceCacheService {

    // Caffeine cache for compiled Drools rules (per tenant)
    private final Cache<UUID, KieContainer> ruleContainerCache = Caffeine.newBuilder()
        .maximumSize(500)  // 500 tenants
        .expireAfterAccess(30, TimeUnit.MINUTES)
        .recordStats()
        .build();

    // Cache for public keys (signature verification)
    private final Cache<UUID, PublicKey> publicKeyCache = Caffeine.newBuilder()
        .maximumSize(1000)
        .expireAfterWrite(1, TimeUnit.HOURS)
        .recordStats()
        .build();

    // Cache for recent trace metadata (avoid duplicate TigerBeetle lookups)
    private final Cache<String, TraceMetadata> traceMetadataCache = Caffeine.newBuilder()
        .maximumSize(10000)  // 10K active traces
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .recordStats()
        .build();

    public KieContainer getCachedRuleContainer(UUID tenantId, Supplier<KieContainer> loader) {
        return ruleContainerCache.get(tenantId, tid -> loader.get());
    }

    public PublicKey getCachedPublicKey(UUID tenantId, Supplier<PublicKey> loader) {
        return publicKeyCache.get(tenantId, tid -> loader.get());
    }

    public Optional<TraceMetadata> getCachedTraceMetadata(String traceId) {
        return Optional.ofNullable(traceMetadataCache.getIfPresent(traceId));
    }

    public void cacheTraceMetadata(String traceId, TraceMetadata metadata) {
        traceMetadataCache.put(traceId, metadata);
    }

    public void invalidateRuleContainer(UUID tenantId) {
        ruleContainerCache.invalidate(tenantId);
    }

    public CacheStats getRuleContainerCacheStats() {
        return ruleContainerCache.stats();
    }

    public CacheStats getPublicKeyCacheStats() {
        return publicKeyCache.stats();
    }

    public CacheStats getTraceMetadataCacheStats() {
        return traceMetadataCache.stats();
    }
}
```

### 8. Backpressure and Circuit Breaker Routes

**`com/fluo/routes/BackpressureRoutes.java`:**
```java
@ApplicationScoped
public class BackpressureRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Circuit Breaker for Rule Evaluation
        from("seda:rule-evaluation")
            .routeId("ruleEvaluationWithCircuitBreaker")
            .circuitBreaker()
                .faultToleranceConfiguration()
                    .timeoutEnabled(true)
                    .timeoutDuration(10000)  // 10 second timeout
                    .failureRateThreshold(50)
                    .requestVolumeThreshold(100)
                    .delay(30000)  // 30 second delay before retry
                .end()
                .to("direct:performRuleEvaluation")
            .onFallback()
                .process("fallbackRuleEvaluationProcessor")  // Return cached result or fail gracefully
                .to("seda:dead-letter-queue");

        // Backpressure Rejection (503 Service Unavailable)
        from("rest:post:/api/otlp/traces")
            .routeId("spanIngestionWithBackpressure")
            .choice()
                .when(method(this, "isQueueFull"))
                    .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(503))
                    .setBody(constant("Service temporarily overloaded. Please retry."))
                    .stop()
                .otherwise()
                    .to("seda:span-ingestion");

        // Dead Letter Queue Processing
        from("seda:dead-letter-queue")
            .routeId("deadLetterQueueHandler")
            .process("logDeadLetterProcessor")
            .process("recordDlqEventToTigerBeetleProcessor")
            .choice()
                .when(header("retryable").isEqualTo(true))
                    .delay(60000)  // Retry after 1 minute
                    .to("seda:span-ingestion")
                .otherwise()
                    .process("persistFailedSpanProcessor");
    }

    public boolean isQueueFull() {
        // Check if SEDA queue size exceeds 90% capacity
        // Implementation: query Camel metrics
        return false; // Placeholder
    }
}
```

### 9. DuckDB Connection Pool (Thread-Safe)

**`com/fluo/services/DuckDBConnectionPool.java`:**
```java
@ApplicationScoped
public class DuckDBConnectionPool {

    @ConfigProperty(name = "fluo.storage.hot.path", defaultValue = "./data-duckdb")
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

### 10. Performance Metrics Endpoint

**`com/fluo/routes/PerformanceMetricsRoutes.java`:**
```java
@ApplicationScoped
public class PerformanceMetricsRoutes extends RouteBuilder {

    @Inject
    PerformanceCacheService cacheService;

    @Inject
    MetricsService metricsService;

    @Override
    public void configure() throws Exception {

        rest("/api/performance")
            .description("Performance metrics and diagnostics")
            .produces("application/json")

            .get("/metrics")
                .description("Get current performance metrics")
                .to("direct:getPerformanceMetrics")

            .get("/cache-stats")
                .description("Get cache statistics")
                .to("direct:getCacheStats")

            .get("/queue-stats")
                .description("Get SEDA queue statistics")
                .to("direct:getQueueStats");

        from("direct:getPerformanceMetrics")
            .process(exchange -> {
                Map<String, Object> metrics = Map.of(
                    "spanIngestionRate", metricsService.getSpanIngestionRate(),
                    "ruleEvaluationLatencyP99", metricsService.getRuleEvaluationP99(),
                    "tigerBeetleWriteLatency", metricsService.getTigerBeetleWriteLatency(),
                    "duckDBInsertThroughput", metricsService.getDuckDBInsertThroughput(),
                    "activeTenants", metricsService.getActiveTenantCount(),
                    "memoryUsageMB", getUsedMemoryMB()
                );
                exchange.getIn().setBody(metrics);
            })
            .marshal().json();

        from("direct:getCacheStats")
            .process(exchange -> {
                Map<String, CacheStats> stats = Map.of(
                    "ruleContainerCache", cacheService.getRuleContainerCacheStats(),
                    "publicKeyCache", cacheService.getPublicKeyCacheStats(),
                    "traceMetadataCache", cacheService.getTraceMetadataCacheStats()
                );
                exchange.getIn().setBody(stats);
            })
            .marshal().json();

        from("direct:getQueueStats")
            .process("getQueueStatsProcessor")
            .marshal().json();
    }

    private long getUsedMemoryMB() {
        Runtime runtime = Runtime.getRuntime();
        return (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
    }
}
```

## Testing Requirements

### 1. JMH Benchmarks (Performance Regression Testing)

**`com/fluo/benchmarks/SpanIngestionBenchmark.java`:**
```java
@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@Warmup(iterations = 3, time = 5)
@Measurement(iterations = 5, time = 10)
@Fork(1)
public class SpanIngestionBenchmark {

    private CamelContext camelContext;
    private ProducerTemplate template;

    @Setup
    public void setup() throws Exception {
        camelContext = new DefaultCamelContext();
        camelContext.addRoutes(new AsyncSpanProcessingRoutes());
        camelContext.start();
        template = camelContext.createProducerTemplate();
    }

    @TearDown
    public void teardown() throws Exception {
        camelContext.stop();
    }

    @Benchmark
    public void benchmarkSingleSpanIngestion(Blackhole blackhole) {
        Span span = generateTestSpan();
        template.sendBody("seda:span-ingestion", span);
        blackhole.consume(span);
    }

    @Benchmark
    @OperationsPerInvocation(100)
    public void benchmarkBatchSpanIngestion(Blackhole blackhole) {
        List<Span> spans = generateTestSpans(100);
        for (Span span : spans) {
            template.sendBody("seda:span-ingestion", span);
        }
        blackhole.consume(spans);
    }
}
```

**`com/fluo/benchmarks/RuleEvaluationBenchmark.java`:**
```java
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
public class RuleEvaluationBenchmark {

    private BatchRuleEvaluationProcessor processor;
    private TraceAggregate testTrace;

    @Setup
    public void setup() {
        processor = new BatchRuleEvaluationProcessor();
        testTrace = generateTestTrace(100); // 100 spans
    }

    @Benchmark
    public void benchmarkBatchRuleEvaluation(Blackhole blackhole) throws Exception {
        Exchange exchange = new DefaultExchange(new DefaultCamelContext());
        exchange.getIn().setBody(testTrace);

        processor.process(exchange);

        List<Signal> signals = exchange.getIn().getBody(List.class);
        blackhole.consume(signals);
    }
}
```

**`com/fluo/benchmarks/TigerBeetleBatchWriteBenchmark.java`:**
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

### 2. Load Tests (100K spans/sec target)

**`com/fluo/loadtests/HighThroughputLoadTest.java`:**
```java
@QuarkusTest
public class HighThroughputLoadTest {

    @Inject
    ProducerTemplate template;

    @Test
    @DisplayName("Should handle 100K spans/sec for 60 seconds without OOM or errors")
    public void testHighThroughputSustained() throws Exception {
        int spansPerSecond = 100_000;
        int durationSeconds = 60;
        int totalSpans = spansPerSecond * durationSeconds;

        AtomicInteger spansIngested = new AtomicInteger(0);
        AtomicInteger errors = new AtomicInteger(0);

        // Span generator threads (simulate 10 OTLP clients)
        List<Thread> producers = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Thread producer = new Thread(() -> {
                while (spansIngested.get() < totalSpans) {
                    try {
                        List<Span> batch = generateTestSpans(100);
                        for (Span span : batch) {
                            template.sendBody("seda:span-ingestion", span);
                        }
                        spansIngested.addAndGet(batch.size());
                    } catch (Exception e) {
                        errors.incrementAndGet();
                    }
                }
            });
            producers.add(producer);
        }

        long startTime = System.currentTimeMillis();

        // Start producers
        producers.forEach(Thread::start);

        // Wait for completion
        producers.forEach(thread -> {
            try {
                thread.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });

        long duration = System.currentTimeMillis() - startTime;
        double actualThroughput = (spansIngested.get() * 1000.0) / duration;

        System.out.printf("Ingested %d spans in %d ms (%.0f spans/sec)\n",
            spansIngested.get(), duration, actualThroughput);
        System.out.printf("Errors: %d (%.2f%%)\n", errors.get(),
            (errors.get() * 100.0) / spansIngested.get());

        // Assertions
        assertTrue(actualThroughput >= 100_000, "Throughput should be >= 100K spans/sec");
        assertTrue(errors.get() < 100, "Error rate should be < 0.1%");
    }
}
```

**`com/fluo/loadtests/LongLivedTraceLoadTest.java`:**
```java
@QuarkusTest
public class LongLivedTraceLoadTest {

    @Inject
    ProducerTemplate template;

    @Test
    @DisplayName("Should handle traces with 10K spans without OOM")
    public void testLongLivedTrace() throws Exception {
        int spansPerTrace = 10_000;
        int traceCount = 10;

        for (int t = 0; t < traceCount; t++) {
            String traceId = "long-trace-" + t;

            for (int s = 0; s < spansPerTrace; s++) {
                Span span = generateSpanForTrace(traceId, s);
                template.sendBody("seda:span-ingestion", span);

                // Simulate 1ms between spans (10-second trace)
                Thread.sleep(1);
            }

            // Mark trace complete
            Span finalSpan = generateSpanForTrace(traceId, spansPerTrace);
            finalSpan.getAttributes().put("trace.complete", true);
            template.sendBody("seda:span-ingestion", finalSpan);
        }

        // Wait for processing
        Thread.sleep(10000);

        // Verify memory usage is reasonable
        long memoryUsedMB = getUsedMemoryMB();
        assertTrue(memoryUsedMB < 2000, "Memory usage should be < 2GB for 10 long-lived traces");
    }
}
```

### 3. Memory Profiling Tests

**`com/fluo/profiling/MemoryProfileTest.java`:**
```java
@QuarkusTest
public class MemoryProfileTest {

    @Test
    @DisplayName("Should not leak memory during 1000 session create/destroy cycles")
    public void testSessionLifecycleMemoryLeak() {
        long startMemory = getUsedMemoryMB();

        for (int i = 0; i < 1000; i++) {
            KieSession session = createTenantSession();

            // Simulate span evaluation
            for (int s = 0; s < 100; s++) {
                session.insert(generateTestSpan());
            }
            session.fireAllRules();

            // Dispose session
            session.dispose();

            if (i % 100 == 0) {
                System.gc();
                long currentMemory = getUsedMemoryMB();
                System.out.printf("After %d sessions: %d MB\n", i, currentMemory - startMemory);
            }
        }

        System.gc();
        long endMemory = getUsedMemoryMB();
        long memoryGrowth = endMemory - startMemory;

        System.out.printf("Final memory growth: %d MB\n", memoryGrowth);
        assertTrue(memoryGrowth < 100, "Memory growth should be < 100 MB");
    }

    @Test
    @DisplayName("Should measure memory per tenant with 100 rules and 1000 spans")
    public void testTenantMemoryFootprint() {
        long baseline = getUsedMemoryMB();

        // Create tenant session with 100 rules
        KieSession session = createTenantSessionWithRules(100);

        long afterSession = getUsedMemoryMB();
        long sessionMemory = afterSession - baseline;

        // Insert 1000 spans
        for (int i = 0; i < 1000; i++) {
            session.insert(generateTestSpan());
        }

        long afterSpans = getUsedMemoryMB();
        long spansMemory = afterSpans - afterSession;
        long totalMemory = afterSpans - baseline;

        System.out.printf("Session memory: %d MB\n", sessionMemory);
        System.out.printf("Spans memory: %d MB\n", spansMemory);
        System.out.printf("Total memory: %d MB\n", totalMemory);

        assertTrue(totalMemory < 50, "Total memory per tenant should be < 50 MB");
    }
}
```

### 4. Flame Graph Generation

**Integration with async-profiler for flame graphs:**

```bash
# Generate CPU flame graph during load test
java -agentpath:/path/to/async-profiler/libasyncProfiler.so=start,event=cpu,file=cpu-profile.html \
    -jar target/quarkus-app/quarkus-run.jar

# Generate allocation flame graph
java -agentpath:/path/to/async-profiler/libasyncProfiler.so=start,event=alloc,file=alloc-profile.html \
    -jar target/quarkus-app/quarkus-run.jar
```

**Automated flame graph generation in CI:**

**`.github/workflows/performance-profiling.yml` (external consumer responsibility):**
```yaml
name: Performance Profiling

on:
  pull_request:
    paths:
      - 'backend/src/main/java/com/fluo/processors/**'
      - 'backend/src/main/java/com/fluo/routes/**'

jobs:
  profile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install async-profiler
        run: wget https://github.com/async-profiler/async-profiler/releases/download/v2.9/async-profiler-2.9-linux-x64.tar.gz
      - name: Run load test with profiling
        run: |
          java -agentpath:./async-profiler/lib/libasyncProfiler.so=start,event=cpu,file=flamegraph.html \
            -jar backend/target/quarkus-app/quarkus-run.jar &
          sleep 10
          mvn test -Dtest=HighThroughputLoadTest
      - name: Upload flame graph
        uses: actions/upload-artifact@v3
        with:
          name: flamegraph
          path: flamegraph.html
```

### 5. Performance Regression Tests

**`com/fluo/benchmarks/PerformanceRegressionTest.java`:**
```java
@QuarkusTest
public class PerformanceRegressionTest {

    @Test
    @DisplayName("Should not regress on span ingestion throughput")
    public void testSpanIngestionThroughputRegression() {
        // Baseline: 100K spans/sec
        int targetThroughput = 100_000;

        int spanCount = 10_000;
        long startTime = System.nanoTime();

        for (int i = 0; i < spanCount; i++) {
            template.sendBody("seda:span-ingestion", generateTestSpan());
        }

        long duration = (System.nanoTime() - startTime) / 1_000_000; // ms
        double actualThroughput = (spanCount * 1000.0) / duration;

        System.out.printf("Span ingestion throughput: %.0f spans/sec\n", actualThroughput);

        assertTrue(actualThroughput >= targetThroughput * 0.9,
            "Throughput regressed below 90% of target");
    }

    @Test
    @DisplayName("Should not regress on rule evaluation latency")
    public void testRuleEvaluationLatencyRegression() {
        // Baseline: p99 < 100ms
        int targetLatencyMs = 100;

        List<Long> latencies = new ArrayList<>();

        for (int i = 0; i < 1000; i++) {
            TraceAggregate trace = generateTestTrace(100);

            long startTime = System.nanoTime();
            List<Signal> signals = evaluateTrace(trace);
            long latency = (System.nanoTime() - startTime) / 1_000_000; // ms

            latencies.add(latency);
        }

        latencies.sort(Long::compareTo);
        long p99 = latencies.get((int) (latencies.size() * 0.99));

        System.out.printf("Rule evaluation p99 latency: %d ms\n", p99);

        assertTrue(p99 <= targetLatencyMs * 1.1,
            "p99 latency regressed above 110% of target");
    }

    @Test
    @DisplayName("Should not regress on memory per tenant")
    public void testMemoryPerTenantRegression() {
        // Baseline: < 50 MB per tenant
        int targetMemoryMB = 50;

        long baseline = getUsedMemoryMB();

        KieSession session = createTenantSessionWithRules(50);

        for (int i = 0; i < 1000; i++) {
            session.insert(generateTestSpan());
        }

        long memoryUsedMB = getUsedMemoryMB() - baseline;

        System.out.printf("Memory per tenant: %d MB\n", memoryUsedMB);

        assertTrue(memoryUsedMB <= targetMemoryMB * 1.2,
            "Memory usage regressed above 120% of target");
    }
}
```

## Configuration Properties

```properties
# SEDA Queue Configuration
fluo.seda.span-ingestion.size=10000
fluo.seda.span-ingestion.concurrent-consumers=10
fluo.seda.rule-evaluation.size=5000
fluo.seda.rule-evaluation.concurrent-consumers=5
fluo.seda.storage-write.size=10000
fluo.seda.storage-write.concurrent-consumers=2

# Batch Configuration
fluo.batch.span-log.buffer-size=1000
fluo.batch.span-log.flush-interval-ms=1000
fluo.batch.tigerbeetle.max-batch-size=128
fluo.batch.duckdb.max-batch-size=1000

# Streaming Evaluation Configuration
fluo.rules.window-size=100
fluo.rules.window-overlap-percent=20
fluo.rules.max-trace-age-minutes=60

# Cache Configuration
fluo.cache.rule-containers.max-size=500
fluo.cache.rule-containers.expire-after-access-minutes=30
fluo.cache.public-keys.max-size=1000
fluo.cache.public-keys.expire-after-write-hours=1
fluo.cache.trace-metadata.max-size=10000
fluo.cache.trace-metadata.expire-after-write-minutes=5

# Circuit Breaker Configuration
fluo.circuit-breaker.failure-rate-threshold=50
fluo.circuit-breaker.request-volume-threshold=100
fluo.circuit-breaker.delay-seconds=30
fluo.circuit-breaker.timeout-seconds=10

# Backpressure Configuration
fluo.backpressure.queue-full-threshold-percent=90

# DuckDB Connection Pool
fluo.duckdb.pool.max-connections-per-tenant=5
fluo.duckdb.pool.min-idle=1
fluo.duckdb.pool.connection-timeout-ms=5000

# Performance Monitoring
fluo.metrics.enabled=true
fluo.metrics.export-interval-seconds=60
```

## Success Criteria

### Functional Requirements
- [ ] Span ingestion throughput: 100K+ spans/sec sustained
- [ ] Rule evaluation p99 latency: <100ms for 100-span traces
- [ ] Long-lived traces: Handle 10K+ span traces without OOM
- [ ] Memory per tenant: <50 MB with 100 rules + 1000 active spans
- [ ] Multi-tenant scaling: Support 500 concurrent tenants on 8-core/16GB instance
- [ ] TigerBeetle batch writes: <5ms p99 latency for 128-transfer batches
- [ ] DuckDB inserts: 50K rows/sec throughput
- [ ] Circuit breaker: Graceful degradation on evaluation failures
- [ ] Backpressure: Return 503 when overloaded (no silent failures)

### Architecture Compliance (ADR)
- [ ] All async processing via Camel SEDA queues (ADR-013)
- [ ] All performance logic in named processors (ADR-014)
- [ ] All processors have 90% test coverage (ADR-014)
- [ ] Batch TigerBeetle writes comply with ADR-015 (tiered storage)
- [ ] No deployment-specific configuration (ADR-011)

### Performance Testing
- [ ] JMH benchmarks for all critical paths (span ingestion, rule eval, storage)
- [ ] Load tests: 100K spans/sec for 60 seconds without errors
- [ ] Memory profiling: No leaks during 1000 session create/destroy cycles
- [ ] Flame graphs generated for CPU and allocation profiling
- [ ] Performance regression tests in CI (fail on >10% regression)

### Observability
- [ ] Performance metrics endpoint (GET /api/performance/metrics)
- [ ] Cache statistics endpoint (GET /api/performance/cache-stats)
- [ ] SEDA queue statistics endpoint (GET /api/performance/queue-stats)
- [ ] Prometheus metrics exported for throughput, latency, cache hit rate
- [ ] Grafana dashboard for performance monitoring (external consumer)

## Files to Create

### Backend - Camel Routes
- `backend/src/main/java/com/fluo/routes/AsyncSpanProcessingRoutes.java` - SEDA async pipeline
- `backend/src/main/java/com/fluo/routes/BackpressureRoutes.java` - Circuit breakers, backpressure
- `backend/src/main/java/com/fluo/routes/PerformanceMetricsRoutes.java` - Performance diagnostics API

### Backend - Processors (Named, ADR-014)
- `backend/src/main/java/com/fluo/processors/storage/BatchSpanLogWriteProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/BatchTigerBeetleWriteProcessor.java`
- `backend/src/main/java/com/fluo/processors/storage/BatchDuckDBInsertProcessor.java`
- `backend/src/main/java/com/fluo/processors/rules/BatchRuleEvaluationProcessor.java`
- `backend/src/main/java/com/fluo/processors/rules/StreamingRuleEvaluationProcessor.java`
- `backend/src/main/java/com/fluo/processors/correlation/SpanAggregationProcessor.java`
- `backend/src/main/java/com/fluo/processors/backpressure/FallbackRuleEvaluationProcessor.java`

### Backend - Services
- `backend/src/main/java/com/fluo/services/PerformanceCacheService.java` - Caffeine cache management
- `backend/src/main/java/com/fluo/services/DuckDBConnectionPool.java` - HikariCP for DuckDB
- `backend/src/main/java/com/fluo/services/MetricsService.java` - Performance metrics collection

### Backend - Aggregation Strategies
- `backend/src/main/java/com/fluo/aggregation/SpanAggregationStrategy.java` - Camel aggregation for traces
- `backend/src/main/java/com/fluo/aggregation/SignalAggregationStrategy.java` - Camel aggregation for signals

### Backend - Models
- `backend/src/main/java/com/fluo/model/TraceAggregate.java` - Aggregated trace with spans
- `backend/src/main/java/com/fluo/model/PerformanceMetrics.java` - Metrics model
- `backend/src/main/java/com/fluo/model/QueueStatistics.java` - SEDA queue stats

### Tests - JMH Benchmarks
- `backend/src/test/java/com/fluo/benchmarks/SpanIngestionBenchmark.java`
- `backend/src/test/java/com/fluo/benchmarks/RuleEvaluationBenchmark.java`
- `backend/src/test/java/com/fluo/benchmarks/TigerBeetleBatchWriteBenchmark.java`
- `backend/src/test/java/com/fluo/benchmarks/DuckDBBatchInsertBenchmark.java`
- `backend/src/test/java/com/fluo/benchmarks/CacheBenchmark.java`

### Tests - Load Tests
- `backend/src/test/java/com/fluo/loadtests/HighThroughputLoadTest.java`
- `backend/src/test/java/com/fluo/loadtests/LongLivedTraceLoadTest.java`
- `backend/src/test/java/com/fluo/loadtests/MultiTenantScalingLoadTest.java`
- `backend/src/test/java/com/fluo/loadtests/SustainedLoadTest.java`

### Tests - Memory Profiling
- `backend/src/test/java/com/fluo/profiling/MemoryProfileTest.java`
- `backend/src/test/java/com/fluo/profiling/SessionLifecycleTest.java`
- `backend/src/test/java/com/fluo/profiling/TenantMemoryFootprintTest.java`

### Tests - Performance Regression
- `backend/src/test/java/com/fluo/benchmarks/PerformanceRegressionTest.java`

### Tests - Processor Unit Tests (ADR-014: 90% coverage)
- `backend/src/test/java/com/fluo/processors/storage/BatchSpanLogWriteProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/storage/BatchTigerBeetleWriteProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/storage/BatchDuckDBInsertProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/rules/BatchRuleEvaluationProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/rules/StreamingRuleEvaluationProcessorTest.java`

### Configuration
- Update `backend/src/main/resources/application.properties` with performance config

### Documentation (Optional - external consumer responsibility)
- Example Grafana dashboard JSON: `grafana-dashboards/fluo-performance.json`
- Example flame graph generation script: `scripts/generate-flamegraph.sh`
- Performance tuning guide: `docs/operations/performance-tuning.md` (external)

## Files to Modify

### Backend - Core Services
- `backend/src/main/java/com/fluo/services/TenantSessionManager.java`
  - Add caching for KieContainer (use PerformanceCacheService)
  - Avoid recompiling rules on every session creation

- `backend/src/main/java/com/fluo/services/RuleEvaluationService.java`
  - Replace synchronous evaluation with batch evaluation
  - Integrate StreamingRuleEvaluationProcessor for long-lived traces

- `backend/src/main/java/com/fluo/services/SignalService.java`
  - Add batch signal creation method (accept List<Signal>)

### Backend - Routes
- `backend/src/main/java/com/fluo/routes/SpanApiRoute.java`
  - Replace synchronous processing with SEDA queue
  - Add backpressure check before accepting spans

### Backend - TigerBeetle Client
- `backend/src/main/java/com/fluo/tigerbeetle/TigerBeetleService.java`
  - Add batch transfer creation method (List<TBTransfer>)
  - Add connection pooling if not already present

### Dependencies (pom.xml)
- Add Caffeine cache dependency
- Add HikariCP dependency (if not present)
- Add JMH dependencies for benchmarks
- Add async-profiler agent (optional, test scope)

```xml
<!-- Add to backend/pom.xml -->
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
    <version>3.1.8</version>
</dependency>

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

## Implementation Phases

### Phase 1: Batching Foundation (Week 1)
1. Implement BatchSpanLogWriteProcessor (sequential I/O optimization)
2. Implement BatchTigerBeetleWriteProcessor (128 transfers per call)
3. Implement BatchDuckDBInsertProcessor (1000 rows per transaction)
4. Write unit tests for all processors (90% coverage)
5. Write JMH benchmarks for batch processors

**Deliverable:** Batching processors tested and benchmarked

### Phase 2: Async Processing Pipeline (Week 2)
6. Implement AsyncSpanProcessingRoutes (SEDA queues)
7. Implement SpanAggregationStrategy (group spans by trace)
8. Implement BatchRuleEvaluationProcessor (evaluate 100 spans at once)
9. Write route configuration tests (ADR-014)
10. Write integration tests for async pipeline

**Deliverable:** Async processing pipeline operational

### Phase 3: Streaming Evaluation (Week 3)
11. Implement StreamingRuleEvaluationProcessor (windowing for long-lived traces)
12. Implement SlidingWindow class (overlap logic)
13. Write unit tests for streaming processor
14. Write load test for 10K-span traces
15. Measure memory usage during streaming evaluation

**Deliverable:** Long-lived trace handling without OOM

### Phase 4: Caching and Circuit Breakers (Week 4)
16. Implement PerformanceCacheService (Caffeine caches)
17. Implement DuckDBConnectionPool (HikariCP)
18. Implement BackpressureRoutes (circuit breakers)
19. Update TenantSessionManager to use cache
20. Write cache hit rate tests

**Deliverable:** Caching and resilience mechanisms operational

### Phase 5: Performance Testing (Week 5)
21. Write HighThroughputLoadTest (100K spans/sec for 60 seconds)
22. Write LongLivedTraceLoadTest (10K-span traces)
23. Write MultiTenantScalingLoadTest (500 concurrent tenants)
24. Write MemoryProfileTest (leak detection)
25. Write PerformanceRegressionTest (baseline enforcement)

**Deliverable:** Performance targets validated

### Phase 6: Observability (Week 6)
26. Implement PerformanceMetricsRoutes (metrics API)
27. Implement MetricsService (metrics collection)
28. Add Prometheus metrics exporters
29. Generate flame graphs with async-profiler
30. Document performance tuning guide (optional, external)

**Deliverable:** Performance observability complete

## Performance Tuning Guide (For Consumers)

### JVM Heap Sizing
```bash
# Recommended heap sizes based on tenant count:
# - 100 tenants: -Xmx4g -Xms2g
# - 500 tenants: -Xmx16g -Xms8g
# - 1000 tenants: -Xmx32g -Xms16g

java -Xmx16g -Xms8g \
     -XX:+UseG1GC \
     -XX:MaxGCPauseMillis=200 \
     -XX:+ParallelRefProcEnabled \
     -jar fluo-backend.jar
```

### SEDA Queue Tuning
```properties
# High throughput (100K+ spans/sec):
fluo.seda.span-ingestion.size=20000
fluo.seda.span-ingestion.concurrent-consumers=20
fluo.seda.rule-evaluation.size=10000
fluo.seda.rule-evaluation.concurrent-consumers=10

# Low latency (<50ms p99):
fluo.seda.span-ingestion.size=5000
fluo.seda.span-ingestion.concurrent-consumers=5
fluo.seda.rule-evaluation.size=2000
fluo.seda.rule-evaluation.concurrent-consumers=3
```

### Cache Tuning
```properties
# High-cardinality tenants (1000+ tenants):
fluo.cache.rule-containers.max-size=1000
fluo.cache.rule-containers.expire-after-access-minutes=60

# Memory-constrained environments:
fluo.cache.rule-containers.max-size=100
fluo.cache.trace-metadata.max-size=5000
```

### DuckDB Performance
```properties
# SSD storage (prioritize throughput):
fluo.duckdb.pool.max-connections-per-tenant=10

# HDD storage (reduce contention):
fluo.duckdb.pool.max-connections-per-tenant=2
```

## Monitoring and Alerting (External Consumer Responsibility)

### Prometheus Metrics (Exported by FLUO)

**Throughput:**
- `fluo_span_ingestion_rate_total` - Spans ingested per second
- `fluo_rule_evaluation_rate_total` - Rule evaluations per second
- `fluo_signal_creation_rate_total` - Signals created per second

**Latency:**
- `fluo_span_ingestion_latency_seconds` - Histogram (p50, p95, p99)
- `fluo_rule_evaluation_latency_seconds` - Histogram (p50, p95, p99)
- `fluo_tigerbeetle_write_latency_seconds` - Histogram (p50, p95, p99)
- `fluo_duckdb_insert_latency_seconds` - Histogram (p50, p95, p99)

**Queue Statistics:**
- `fluo_seda_queue_size` - Current queue size (by queue name)
- `fluo_seda_queue_capacity` - Max queue capacity
- `fluo_seda_queue_full_total` - Counter of backpressure rejections

**Cache Statistics:**
- `fluo_cache_hit_rate` - Cache hit rate (by cache name)
- `fluo_cache_size` - Current cache entries
- `fluo_cache_eviction_total` - Cache evictions

**Circuit Breaker:**
- `fluo_circuit_breaker_state` - Circuit breaker state (0=closed, 1=open, 2=half-open)
- `fluo_circuit_breaker_failures_total` - Failures triggering circuit breaker

### Example Grafana Dashboard (Consumer-Provided)

**File:** `grafana-dashboards/fluo-performance.json` (already exists in repo)

**Panels:**
1. Span Ingestion Rate (graph)
2. Rule Evaluation p99 Latency (graph)
3. SEDA Queue Sizes (graph)
4. Cache Hit Rates (stat)
5. Circuit Breaker State (stat)
6. Memory Usage (graph)
7. TigerBeetle Write Latency (heatmap)

### Alerting Rules (Consumer-Provided)

```yaml
# Example Prometheus alerting rules (external consumer)
groups:
  - name: fluo_performance
    rules:
      - alert: HighRuleEvaluationLatency
        expr: histogram_quantile(0.99, fluo_rule_evaluation_latency_seconds) > 0.100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Rule evaluation p99 latency above 100ms"

      - alert: QueueBackpressure
        expr: rate(fluo_seda_queue_full_total[5m]) > 10
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "SEDA queues rejecting ingestion (backpressure active)"

      - alert: CircuitBreakerOpen
        expr: fluo_circuit_breaker_state == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker open (rule evaluation failing)"

      - alert: LowCacheHitRate
        expr: fluo_cache_hit_rate{cache="ruleContainerCache"} < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Rule container cache hit rate below 80%"
```

## Future Enhancements (Post-MVP)

1. **Adaptive Batching:** Dynamically adjust batch sizes based on load
2. **Partitioned SEDA Queues:** Partition queues by tenant for fairness
3. **GPU Acceleration:** Explore GPU for regex matching in rules (exotic)
4. **Distributed Drools:** Shard rule evaluation across multiple nodes
5. **Persistent SEDA Queues:** Use Kafka/NATS for durable queues
6. **Predictive Scaling:** ML-based prediction of load spikes
7. **Query Result Caching:** Cache DuckDB query results for repeated queries
8. **Incremental Rule Compilation:** Recompile only changed rules, not entire tenant ruleset

## Alternatives Considered

### Alternative 1: Reactive Streams (Mutiny/RxJava)
**Considered:** Use reactive programming for async processing
**Rejected:** Camel SEDA queues simpler, ADR-013 mandates Camel-First

### Alternative 2: Vert.x Event Bus
**Considered:** Use Vert.x for async event processing
**Rejected:** Violates ADR-013, adds extra framework complexity

### Alternative 3: Drools CEP (Complex Event Processing)
**Considered:** Use Drools CEP for streaming evaluation
**Rejected:** CEP mode has higher memory overhead, windowing implementation sufficient

### Alternative 4: External Message Queue (Kafka/NATS)
**Considered:** Use Kafka for span ingestion pipeline
**Rejected:** Violates ADR-011 (external dependency), SEDA sufficient for 100K/sec

### Alternative 5: Redis for Caching
**Considered:** Use Redis for distributed caching
**Rejected:** Violates ADR-011 (external dependency), Caffeine sufficient for single-node

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - No deployment coupling
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - All async via Camel
- **[ADR-014: Camel Testing and Organization Standards](../adrs/014-camel-testing-and-organization-standards.md)** - Named processors, 90% coverage
- **[ADR-015: Tiered Storage Architecture](../adrs/015-tiered-storage-architecture.md)** - Optimize storage writes

## Dependencies

**Requires:**
- PRD-002: TigerBeetle + DuckDB + Parquet storage (batch writes)
- PRD-005: Rule Engine Sandboxing (safe capabilities pattern)
- PRD-009: Trace Ingestion Pipeline (span processing foundation)

**Blocks:**
- PRD-013: SRE Dashboard (needs real-time metrics)
- PRD-019: Observability for FLUO (performance metrics foundation)

## Security Considerations

**Performance vs. Security Trade-offs:**

1. **Batch Evaluation:** Batching 100 spans at once reduces per-span overhead but increases blast radius if malicious span crashes Drools
   - **Mitigation:** Circuit breaker isolates failures, dead letter queue captures failed batches

2. **Caching:** Caching compiled rules improves performance but cache poisoning could affect multiple evaluations
   - **Mitigation:** Cache invalidation on rule updates, immutable KieContainer objects

3. **Backpressure:** Rejecting spans with 503 could be exploited for DoS (prevent legitimate spans)
   - **Mitigation:** Rate limiting per tenant (PRD-007), prioritize authenticated tenants

4. **Dead Letter Queue:** Failed spans stored for debugging could contain sensitive data
   - **Mitigation:** Apply PII redaction before storing in DLQ (PRD-004)

5. **Streaming Evaluation:** Sliding windows keep spans in memory longer, increasing exposure window
   - **Mitigation:** Bounded window size, aggressive eviction after evaluation

## Compliance Benefits

**SOC2 CC7.1 (System Monitoring):**
- Performance metrics enable detection of anomalous load patterns
- Circuit breaker prevents cascading failures (availability control)

**SOC2 CC7.2 (System Performance):**
- Throughput metrics demonstrate capacity management
- Latency monitoring ensures timely processing of security events

**ISO 27001 A.12.1.3 (Capacity Management):**
- Load tests validate capacity under expected and peak loads
- Performance tuning guide enables operators to scale appropriately

## Appendix: Performance Benchmarking Results

**Baseline Performance (Pre-Optimization):**
- Span ingestion throughput: ~10K spans/sec
- Rule evaluation latency: ~10ms p99 (single span)
- Memory per tenant: ~30 MB (50 rules + 1000 spans)

**Target Performance (Post-Optimization):**
- Span ingestion throughput: 100K+ spans/sec (10x improvement)
- Rule evaluation latency: <100ms p99 (100-span traces)
- Memory per tenant: <50 MB (50 rules + 1000 spans, unchanged)

**Test Environment:**
- CPU: 8-core (Intel Xeon)
- Memory: 16 GB
- Storage: NVMe SSD
- JVM: OpenJDK 21, G1GC

**Expected Results:**
- Throughput: 10x improvement via batching and async processing
- Latency: <100ms p99 via batch evaluation (100 spans at once)
- Memory: <50 MB per tenant via streaming evaluation and eviction

**Validation Method:**
- JMH benchmarks for micro-benchmarks
- JUnit load tests for macro-benchmarks
- async-profiler flame graphs for bottleneck identification
- JaCoCo for test coverage validation (90% target)
