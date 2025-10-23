# PRD-020c: Streaming Evaluation for Long-Lived Traces

**Parent PRD:** PRD-020 (Performance Optimization)
**Unit:** C
**Priority:** P1
**Dependencies:** Unit A (Batching Infrastructure), Unit B (Async SEDA Pipeline)

## Scope

Implement streaming rule evaluation for long-lived traces that span hours/days with thousands of spans. This prevents OOM by evaluating traces incrementally using sliding windows.

**What this unit implements:**
- StreamingRuleEvaluationProcessor with sliding windows
- SlidingWindow class with overlap logic
- Long-lived trace detection and routing
- Trace window management and cleanup
- Memory-bounded evaluation

**What this unit does NOT implement:**
- Batching processors (Unit A)
- Async SEDA pipeline (Unit B)
- Caching (Unit D)
- Backpressure/circuit breakers (Unit E)

## Implementation

### 1. Streaming Rule Evaluation Processor

**`com/betrace/processors/rules/StreamingRuleEvaluationProcessor.java`:**
```java
@Named("streamingRuleEvaluationProcessor")
@ApplicationScoped
public class StreamingRuleEvaluationProcessor implements Processor {

    @Inject
    TenantSessionManager sessionManager;

    @Inject
    MetricsService metricsService;

    @ConfigProperty(name = "betrace.rules.window-size", defaultValue = "100")
    int windowSize;

    @ConfigProperty(name = "betrace.rules.window-overlap-percent", defaultValue = "20")
    int windowOverlapPercent;

    @ConfigProperty(name = "betrace.rules.max-trace-age-minutes", defaultValue = "60")
    int maxTraceAgeMinutes;

    private final Map<String, SlidingWindow> traceWindows = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleanup = Executors.newSingleThreadScheduledExecutor();

    @PostConstruct
    public void init() {
        // Cleanup expired traces every 5 minutes
        cleanup.scheduleAtFixedRate(this::cleanupExpiredTraces, 5, 5, TimeUnit.MINUTES);
    }

    @Override
    public void process(Exchange exchange) throws Exception {
        Span span = exchange.getIn().getBody(Span.class);
        UUID tenantId = UUID.fromString(span.getTenantId());
        String traceId = span.getTraceId();

        // Get or create sliding window for this trace
        SlidingWindow window = traceWindows.computeIfAbsent(
            traceId,
            tid -> new SlidingWindow(traceId, windowSize, windowOverlapPercent)
        );

        // Add span to window
        window.add(span);

        // Evaluate rules if window is full or trace is complete
        if (window.shouldEvaluate()) {
            List<Signal> signals = evaluateWindow(tenantId, traceId, window);
            exchange.getIn().setBody(signals);

            // Slide window forward (keep overlap for context)
            window.slide();

            // Remove window if trace is complete
            if (window.isComplete()) {
                traceWindows.remove(traceId);
            }
        } else {
            // Not ready to evaluate yet
            exchange.getIn().setBody(Collections.emptyList());
        }
    }

    private List<Signal> evaluateWindow(UUID tenantId, String traceId, SlidingWindow window) {
        KieSession session = sessionManager.getSession(tenantId);

        SafeRuleCapabilities.setContext(tenantId.toString(), traceId, "streaming-eval");

        try {
            long startTime = System.nanoTime();

            // Insert spans from window
            for (Span span : window.getCurrentSpans()) {
                session.insert(span);
            }

            session.fireAllRules();

            long duration = (System.nanoTime() - startTime) / 1_000_000;

            log.debug("Evaluated window for trace {} ({} spans) in {}ms",
                traceId, window.getCurrentSpans().size(), duration);

            metricsService.recordRuleEvaluation(duration);

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
        int removed = 0;

        Iterator<Map.Entry<String, SlidingWindow>> it = traceWindows.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, SlidingWindow> entry = it.next();
            if (entry.getValue().getLastUpdateTime().isBefore(cutoff)) {
                it.remove();
                removed++;
            }
        }

        if (removed > 0) {
            log.info("Cleaned up {} expired trace windows", removed);
        }
    }

    @PreDestroy
    public void shutdown() {
        cleanup.shutdown();
    }
}
```

### 2. SlidingWindow Implementation

**`com/betrace/model/SlidingWindow.java`:**
```java
public class SlidingWindow {
    private final String traceId;
    private final int windowSize;
    private final int overlapSize;
    private final List<Span> currentSpans;
    private Instant lastUpdateTime;
    private boolean complete;

    public SlidingWindow(String traceId, int windowSize, int overlapPercent) {
        this.traceId = traceId;
        this.windowSize = windowSize;
        this.overlapSize = (windowSize * overlapPercent) / 100;
        this.currentSpans = new ArrayList<>();
        this.lastUpdateTime = Instant.now();
        this.complete = false;
    }

    public synchronized void add(Span span) {
        currentSpans.add(span);
        lastUpdateTime = Instant.now();

        // Check if trace is complete (span has "trace.complete" attribute)
        if (Boolean.TRUE.equals(span.getAttributes().get("trace.complete"))) {
            this.complete = true;
        }
    }

    public synchronized boolean shouldEvaluate() {
        return currentSpans.size() >= windowSize || complete;
    }

    public synchronized List<Span> getCurrentSpans() {
        return Collections.unmodifiableList(new ArrayList<>(currentSpans));
    }

    public synchronized boolean isInOverlap(Span span) {
        int index = currentSpans.indexOf(span);
        return index >= (currentSpans.size() - overlapSize);
    }

    public synchronized void slide() {
        if (complete) {
            // Don't slide if complete, clear all
            currentSpans.clear();
            return;
        }

        // Keep last N% of spans for context in next window
        List<Span> overlap = new ArrayList<>(
            currentSpans.subList(
                Math.max(0, currentSpans.size() - overlapSize),
                currentSpans.size()
            )
        );
        currentSpans.clear();
        currentSpans.addAll(overlap);
    }

    public Instant getLastUpdateTime() {
        return lastUpdateTime;
    }

    public boolean isComplete() {
        return complete;
    }

    public String getTraceId() {
        return traceId;
    }

    public int getSpanCount() {
        return currentSpans.size();
    }

    public int getOverlapSize() {
        return overlapSize;
    }
}
```

### 3. Long-Lived Trace Detection Route

**`com/betrace/routes/LongLivedTraceRoutes.java`:**
```java
@ApplicationScoped
public class LongLivedTraceRoutes extends RouteBuilder {

    @ConfigProperty(name = "betrace.rules.long-lived-threshold", defaultValue = "1000")
    int longLivedThreshold;

    @Override
    public void configure() throws Exception {

        // Route spans to streaming or batch evaluation based on trace size
        from("seda:trace-correlation")
            .routeId("traceEvaluationRouter")
            .choice()
                .when(method(this, "isLongLivedTrace"))
                    .to("seda:streaming-evaluation")
                .otherwise()
                    .to("seda:rule-evaluation");  // Batch evaluation (Unit B)

        // Streaming evaluation for long-lived traces
        from("seda:streaming-evaluation?concurrentConsumers=5")
            .routeId("streamingEvaluationPipeline")
            .split(body())  // Split TraceAggregate into individual spans
            .process("streamingRuleEvaluationProcessor")
            .filter(simple("${body.size} > 0"))  // Only proceed if signals generated
            .split(body())
            .to("seda:storage-write");
    }

    public boolean isLongLivedTrace(Exchange exchange) {
        TraceAggregate trace = exchange.getIn().getBody(TraceAggregate.class);
        return trace.getSpans().size() > longLivedThreshold;
    }
}
```

### 4. Trace Window Statistics Endpoint

**`com/betrace/routes/TraceWindowStatsRoutes.java`:**
```java
@ApplicationScoped
public class TraceWindowStatsRoutes extends RouteBuilder {

    @Inject
    StreamingRuleEvaluationProcessor streamingProcessor;

    @Override
    public void configure() throws Exception {

        rest("/api/performance")
            .get("/trace-windows")
                .description("Get active trace window statistics")
                .to("direct:getTraceWindowStats");

        from("direct:getTraceWindowStats")
            .process(exchange -> {
                Map<String, Object> stats = streamingProcessor.getWindowStatistics();
                exchange.getIn().setBody(stats);
            })
            .marshal().json();
    }
}
```

**Add to StreamingRuleEvaluationProcessor:**
```java
public Map<String, Object> getWindowStatistics() {
    long totalWindows = traceWindows.size();
    long totalSpans = traceWindows.values().stream()
        .mapToLong(SlidingWindow::getSpanCount)
        .sum();

    long memoryEstimateMB = (totalSpans * 2048) / (1024 * 1024); // ~2KB per span

    return Map.of(
        "activeWindows", totalWindows,
        "totalSpansInMemory", totalSpans,
        "estimatedMemoryMB", memoryEstimateMB
    );
}
```

## Configuration Properties

```properties
# Streaming Evaluation Configuration
betrace.rules.window-size=100
betrace.rules.window-overlap-percent=20
betrace.rules.max-trace-age-minutes=60
betrace.rules.long-lived-threshold=1000

# Cleanup Configuration
betrace.rules.window-cleanup-interval-minutes=5
```

## Success Criteria

- [ ] StreamingRuleEvaluationProcessor evaluates traces incrementally
- [ ] SlidingWindow maintains bounded memory (window-size spans)
- [ ] Overlap logic preserves context between windows (20%)
- [ ] Long-lived traces (10K+ spans) do not cause OOM
- [ ] Trace window cleanup removes expired traces (60-minute TTL)
- [ ] Memory per active trace window: <1 MB (100 spans * 2KB per span)
- [ ] Streaming evaluation latency: <100ms p99 per window
- [ ] All processors follow ADR-014 naming conventions
- [ ] 90% test coverage for all processors (ADR-014)

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**`StreamingRuleEvaluationProcessorTest.java`:**
- Test window creation on first span
- Test span addition to window
- Test evaluation trigger when window full
- Test evaluation trigger when trace complete
- Test window sliding (overlap preservation)
- Test expired trace cleanup
- Test memory bounds

**`SlidingWindowTest.java`:**
- Test window initialization
- Test span addition
- Test shouldEvaluate() conditions (size, complete)
- Test isInOverlap() logic
- Test slide() preserves overlap
- Test slide() on complete trace (clears all)
- Test concurrent span additions

**`LongLivedTraceRoutesTest.java`:**
- Test trace routing (long-lived vs. batch)
- Test threshold configuration
- Test streaming evaluation route

### Load Tests

**`LongLivedTraceLoadTest.java`:**
```java
@QuarkusTest
public class LongLivedTraceLoadTest {

    @Inject
    ProducerTemplate template;

    @Inject
    StreamingRuleEvaluationProcessor streamingProcessor;

    @Test
    @DisplayName("Should handle traces with 10K spans without OOM")
    public void testLongLivedTrace() throws Exception {
        int spansPerTrace = 10_000;
        int traceCount = 10;

        long baselineMemory = getUsedMemoryMB();

        for (int t = 0; t < traceCount; t++) {
            String traceId = "long-trace-" + t;

            for (int s = 0; s < spansPerTrace; s++) {
                Span span = generateSpanForTrace(traceId, s);
                template.sendBody("seda:streaming-evaluation", span);

                // Simulate 1ms between spans (10-second trace)
                if (s % 100 == 0) {
                    Thread.sleep(1);
                }
            }

            // Mark trace complete
            Span finalSpan = generateSpanForTrace(traceId, spansPerTrace);
            finalSpan.getAttributes().put("trace.complete", true);
            template.sendBody("seda:streaming-evaluation", finalSpan);
        }

        // Wait for processing
        Thread.sleep(10000);

        // Verify memory usage is reasonable
        long memoryUsedMB = getUsedMemoryMB() - baselineMemory;
        System.out.printf("Memory used for 10 long-lived traces (100K spans): %d MB\n", memoryUsedMB);

        // Should use <500 MB (10 traces * ~50 MB per trace)
        assertTrue(memoryUsedMB < 500, "Memory usage should be < 500MB for 10 long-lived traces");

        // Verify all windows cleaned up
        Map<String, Object> stats = streamingProcessor.getWindowStatistics();
        assertEquals(0L, stats.get("activeWindows"), "All windows should be closed");
    }

    @Test
    @DisplayName("Should evaluate windows incrementally (not wait for completion)")
    public void testIncrementalEvaluation() throws Exception {
        String traceId = "incremental-trace";
        int windowSize = 100;

        AtomicInteger signalsGenerated = new AtomicInteger(0);

        // Send 500 spans (should trigger 5 window evaluations)
        for (int i = 0; i < 500; i++) {
            Span span = generateSpanForTrace(traceId, i);
            template.sendBody("seda:streaming-evaluation", span);
        }

        // Wait for processing
        Thread.sleep(5000);

        // Verify signals generated before trace completion
        List<Signal> signals = querySignalsForTrace(traceId);
        assertTrue(signals.size() > 0, "Signals should be generated before trace completion");
    }

    @Test
    @DisplayName("Should cleanup expired trace windows")
    public void testExpiredTraceCleanup() throws Exception {
        String traceId = "stale-trace";

        // Create trace window
        for (int i = 0; i < 50; i++) {
            Span span = generateSpanForTrace(traceId, i);
            template.sendBody("seda:streaming-evaluation", span);
        }

        // Wait for window creation
        Thread.sleep(1000);

        Map<String, Object> statsBefore = streamingProcessor.getWindowStatistics();
        assertTrue((Long) statsBefore.get("activeWindows") > 0);

        // Wait for expiration (61 minutes in test = 61 seconds with time acceleration)
        Thread.sleep(65000);

        // Trigger cleanup
        streamingProcessor.cleanupExpiredTraces();

        Map<String, Object> statsAfter = streamingProcessor.getWindowStatistics();
        assertEquals(0L, statsAfter.get("activeWindows"), "Expired windows should be removed");
    }
}
```

### Memory Profiling Tests

**`StreamingMemoryProfileTest.java`:**
```java
@QuarkusTest
public class StreamingMemoryProfileTest {

    @Test
    @DisplayName("Should maintain bounded memory with concurrent long-lived traces")
    public void testBoundedMemory() {
        long baseline = getUsedMemoryMB();

        // Simulate 50 concurrent long-lived traces
        List<String> traceIds = new ArrayList<>();
        for (int t = 0; t < 50; t++) {
            traceIds.add("trace-" + t);
        }

        // Send 10K spans total (200 per trace)
        for (int s = 0; s < 200; s++) {
            for (String traceId : traceIds) {
                Span span = generateSpanForTrace(traceId, s);
                template.sendBody("seda:streaming-evaluation", span);
            }
        }

        Thread.sleep(10000);

        long memoryUsed = getUsedMemoryMB() - baseline;
        System.out.printf("Memory for 50 concurrent traces: %d MB\n", memoryUsed);

        // 50 traces * 100-span window * 2KB per span = ~10 MB
        assertTrue(memoryUsed < 50, "Memory should be < 50 MB for 50 concurrent traces");
    }
}
```

## Files to Create

### Backend - Processors
- `backend/src/main/java/com/betrace/processors/rules/StreamingRuleEvaluationProcessor.java`

### Backend - Models
- `backend/src/main/java/com/betrace/model/SlidingWindow.java`

### Backend - Routes
- `backend/src/main/java/com/betrace/routes/LongLivedTraceRoutes.java`
- `backend/src/main/java/com/betrace/routes/TraceWindowStatsRoutes.java`

### Tests - Unit Tests
- `backend/src/test/java/com/betrace/processors/rules/StreamingRuleEvaluationProcessorTest.java`
- `backend/src/test/java/com/betrace/model/SlidingWindowTest.java`
- `backend/src/test/java/com/betrace/routes/LongLivedTraceRoutesTest.java`

### Tests - Load Tests
- `backend/src/test/java/com/betrace/loadtests/LongLivedTraceLoadTest.java`

### Tests - Memory Profiling
- `backend/src/test/java/com/betrace/profiling/StreamingMemoryProfileTest.java`

## Files to Modify

### Backend - Routes
- `backend/src/main/java/com/betrace/routes/AsyncSpanProcessingRoutes.java`
  - Add routing logic to detect long-lived traces
  - Route to streaming-evaluation or rule-evaluation based on size

### Configuration
- `backend/src/main/resources/application.properties`
  - Add streaming evaluation configuration

## Implementation Timeline

**Week 3:** Streaming Evaluation
- Day 1-2: StreamingRuleEvaluationProcessor + SlidingWindow
- Day 3: LongLivedTraceRoutes + routing logic
- Day 4: Unit tests (90% coverage)
- Day 5: Load tests (10K-span traces)
- Day 6-7: Memory profiling, performance validation

**Deliverable:** Long-lived trace handling without OOM

## Dependencies

**Requires:**
- Unit A: MetricsService
- Unit B: AsyncSpanProcessingRoutes, TenantSessionManager
- PRD-005: SafeRuleCapabilities for sandboxing

**Blocks:**
- Unit F: Performance testing (validates streaming)
- Unit G: Metrics (observes window statistics)

## Performance Targets

- Memory per trace window: <1 MB (100 spans * 2KB per span)
- Window evaluation latency: <100ms p99
- Concurrent trace capacity: 500 traces (50 MB total)
- No OOM for traces with 10K+ spans

## ADR Compliance

- **ADR-011:** Pure application, no deployment coupling
- **ADR-013:** Integrates with SEDA pipeline from Unit B
- **ADR-014:** Named processors with 90% test coverage
- **ADR-015:** Memory-bounded evaluation for tiered storage
