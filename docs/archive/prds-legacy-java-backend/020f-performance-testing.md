# PRD-020f: Performance Testing and Benchmarking

**Parent PRD:** PRD-020 (Performance Optimization)
**Unit:** F
**Priority:** P1
**Dependencies:** Units A, B, C, D, E (validates all backend performance work)

## Scope

Implement comprehensive performance testing, benchmarking, and profiling infrastructure. This unit validates that all performance targets from Units A-E are met.

**What this unit implements:**
- JMH micro-benchmarks for critical paths
- Load tests (100K spans/sec sustained)
- Memory profiling tests
- Performance regression tests
- Flame graph generation tooling
- Test fixtures and utilities

**What this unit does NOT implement:**
- Frontend performance testing (separate unit)
- Production monitoring (Unit G)

## Implementation

### 1. JMH Benchmarks

**`com/betrace/benchmarks/SpanIngestionBenchmark.java`:**
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
        Span span = BenchmarkFixtures.generateTestSpan();
        template.sendBody("seda:span-ingestion", span);
        blackhole.consume(span);
    }

    @Benchmark
    @OperationsPerInvocation(100)
    public void benchmarkBatchSpanIngestion(Blackhole blackhole) {
        List<Span> spans = BenchmarkFixtures.generateTestSpans(100);
        for (Span span : spans) {
            template.sendBody("seda:span-ingestion", span);
        }
        blackhole.consume(spans);
    }

    @Benchmark
    @OperationsPerInvocation(1000)
    public void benchmarkHighThroughputIngestion(Blackhole blackhole) {
        List<Span> spans = BenchmarkFixtures.generateTestSpans(1000);
        for (Span span : spans) {
            template.sendBody("seda:span-ingestion", span);
        }
        blackhole.consume(spans);
    }
}
```

**`com/betrace/benchmarks/RuleEvaluationBenchmark.java`:**
```java
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
@Warmup(iterations = 3, time = 5)
@Measurement(iterations = 5, time = 10)
@Fork(1)
public class RuleEvaluationBenchmark {

    private BatchRuleEvaluationProcessor processor;
    private StreamingRuleEvaluationProcessor streamingProcessor;

    @Param({"10", "50", "100", "500"})
    private int spanCount;

    @Setup
    public void setup() {
        processor = new BatchRuleEvaluationProcessor();
        streamingProcessor = new StreamingRuleEvaluationProcessor();
    }

    @Benchmark
    public void benchmarkBatchRuleEvaluation(Blackhole blackhole) throws Exception {
        TraceAggregate trace = BenchmarkFixtures.generateTestTrace(spanCount);
        Exchange exchange = new DefaultExchange(new DefaultCamelContext());
        exchange.getIn().setBody(trace);

        processor.process(exchange);

        List<Signal> signals = exchange.getIn().getBody(List.class);
        blackhole.consume(signals);
    }

    @Benchmark
    public void benchmarkStreamingRuleEvaluation(Blackhole blackhole) throws Exception {
        Span span = BenchmarkFixtures.generateTestSpan();
        Exchange exchange = new DefaultExchange(new DefaultCamelContext());
        exchange.getIn().setBody(span);

        streamingProcessor.process(exchange);

        List<Signal> signals = exchange.getIn().getBody(List.class);
        blackhole.consume(signals);
    }
}
```

### 2. Load Tests

**`com/betrace/loadtests/HighThroughputLoadTest.java`:**
```java
@QuarkusTest
public class HighThroughputLoadTest {

    @Inject
    ProducerTemplate template;

    @Inject
    MetricsService metricsService;

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
                        List<Span> batch = LoadTestFixtures.generateTestSpans(100);
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

    @Test
    @DisplayName("Should maintain p99 latency <100ms under load")
    public void testLatencyUnderLoad() throws Exception {
        int traceCount = 1000;
        List<Long> latencies = new CopyOnWriteArrayList<>();

        // Concurrent trace processing
        ExecutorService executor = Executors.newFixedThreadPool(20);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < traceCount; i++) {
            futures.add(executor.submit(() -> {
                TraceAggregate trace = LoadTestFixtures.generateTestTrace(100);

                long startTime = System.nanoTime();
                template.sendBody("seda:rule-evaluation", trace);
                long latency = (System.nanoTime() - startTime) / 1_000_000; // ms

                latencies.add(latency);
            }));
        }

        // Wait for completion
        for (Future<?> future : futures) {
            future.get();
        }
        executor.shutdown();

        // Calculate p99
        latencies.sort(Long::compareTo);
        long p99 = latencies.get((int) (latencies.size() * 0.99));

        System.out.printf("Rule evaluation p99 latency: %d ms\n", p99);

        assertTrue(p99 < 100, "p99 latency should be < 100ms");
    }
}
```

**`com/betrace/loadtests/SustainedLoadTest.java`:**
```java
@QuarkusTest
public class SustainedLoadTest {

    @Test
    @DisplayName("Should handle sustained 50K spans/sec for 5 minutes without degradation")
    public void testSustainedLoad() throws Exception {
        int spansPerSecond = 50_000;
        int durationMinutes = 5;

        AtomicLong totalSpansIngested = new AtomicLong(0);
        Map<Integer, Double> throughputByMinute = new ConcurrentHashMap<>();

        // Continuous load generator
        Thread loadGenerator = new Thread(() -> {
            for (int minute = 0; minute < durationMinutes; minute++) {
                long minuteStart = System.currentTimeMillis();
                long spansThisMinute = 0;

                while ((System.currentTimeMillis() - minuteStart) < 60_000) {
                    try {
                        List<Span> batch = LoadTestFixtures.generateTestSpans(100);
                        for (Span span : batch) {
                            template.sendBody("seda:span-ingestion", span);
                        }
                        spansThisMinute += batch.size();
                        totalSpansIngested.addAndGet(batch.size());
                    } catch (Exception e) {
                        log.error("Error during load generation", e);
                    }
                }

                double actualThroughput = (spansThisMinute * 1000.0) / 60_000;
                throughputByMinute.put(minute, actualThroughput);
                System.out.printf("Minute %d: %.0f spans/sec\n", minute, actualThroughput);
            }
        });

        loadGenerator.start();
        loadGenerator.join();

        // Verify no degradation (last minute >= 90% of first minute)
        double firstMinuteThroughput = throughputByMinute.get(0);
        double lastMinuteThroughput = throughputByMinute.get(durationMinutes - 1);

        System.out.printf("First minute: %.0f spans/sec\n", firstMinuteThroughput);
        System.out.printf("Last minute: %.0f spans/sec\n", lastMinuteThroughput);

        assertTrue(lastMinuteThroughput >= firstMinuteThroughput * 0.9,
            "Throughput should not degrade by more than 10%");
    }
}
```

### 3. Memory Profiling Tests

**`com/betrace/profiling/MemoryProfileTest.java`:**
```java
@QuarkusTest
public class MemoryProfileTest {

    @Test
    @DisplayName("Should not leak memory during 1000 session create/destroy cycles")
    public void testSessionLifecycleMemoryLeak() {
        long startMemory = MemoryUtils.getUsedMemoryMB();

        for (int i = 0; i < 1000; i++) {
            KieSession session = sessionManager.getSession(UUID.randomUUID());

            // Simulate span evaluation
            for (int s = 0; s < 100; s++) {
                session.insert(MemoryUtils.generateTestSpan());
            }
            session.fireAllRules();

            // Dispose session
            session.dispose();

            if (i % 100 == 0) {
                System.gc();
                long currentMemory = MemoryUtils.getUsedMemoryMB();
                System.out.printf("After %d sessions: %d MB\n", i, currentMemory - startMemory);
            }
        }

        System.gc();
        long endMemory = MemoryUtils.getUsedMemoryMB();
        long memoryGrowth = endMemory - startMemory;

        System.out.printf("Final memory growth: %d MB\n", memoryGrowth);
        assertTrue(memoryGrowth < 100, "Memory growth should be < 100 MB");
    }

    @Test
    @DisplayName("Should measure memory per tenant with 100 rules and 1000 spans")
    public void testTenantMemoryFootprint() {
        long baseline = MemoryUtils.getUsedMemoryMB();

        // Create tenant session with 100 rules
        UUID tenantId = UUID.randomUUID();
        createTenantWithRules(tenantId, 100);
        KieSession session = sessionManager.getSession(tenantId);

        long afterSession = MemoryUtils.getUsedMemoryMB();
        long sessionMemory = afterSession - baseline;

        // Insert 1000 spans
        for (int i = 0; i < 1000; i++) {
            session.insert(MemoryUtils.generateTestSpan());
        }

        long afterSpans = MemoryUtils.getUsedMemoryMB();
        long spansMemory = afterSpans - afterSession;
        long totalMemory = afterSpans - baseline;

        System.out.printf("Session memory: %d MB\n", sessionMemory);
        System.out.printf("Spans memory: %d MB\n", spansMemory);
        System.out.printf("Total memory: %d MB\n", totalMemory);

        assertTrue(totalMemory < 50, "Total memory per tenant should be < 50 MB");
    }

    @Test
    @DisplayName("Should measure memory for 500 concurrent tenants")
    public void testMultiTenantMemoryFootprint() {
        long baseline = MemoryUtils.getUsedMemoryMB();

        // Create 500 tenant sessions
        List<UUID> tenantIds = new ArrayList<>();
        for (int i = 0; i < 500; i++) {
            UUID tenantId = UUID.randomUUID();
            tenantIds.add(tenantId);
            createTenantWithRules(tenantId, 50);
            sessionManager.getSession(tenantId);
        }

        long afterSessions = MemoryUtils.getUsedMemoryMB();
        long totalMemory = afterSessions - baseline;
        double memoryPerTenant = totalMemory / 500.0;

        System.out.printf("Total memory for 500 tenants: %d MB\n", totalMemory);
        System.out.printf("Average memory per tenant: %.2f MB\n", memoryPerTenant);

        assertTrue(memoryPerTenant < 50, "Memory per tenant should be < 50 MB");
        assertTrue(totalMemory < 25_000, "Total memory for 500 tenants should be < 25 GB");
    }
}
```

### 4. Performance Regression Tests

**`com/betrace/benchmarks/PerformanceRegressionTest.java`:**
```java
@QuarkusTest
public class PerformanceRegressionTest {

    private static final int TARGET_THROUGHPUT = 100_000; // spans/sec
    private static final int TARGET_LATENCY_MS = 100; // p99
    private static final int TARGET_MEMORY_MB = 50; // per tenant

    @Test
    @DisplayName("Should not regress on span ingestion throughput")
    public void testSpanIngestionThroughputRegression() {
        int spanCount = 10_000;
        long startTime = System.nanoTime();

        for (int i = 0; i < spanCount; i++) {
            template.sendBody("seda:span-ingestion", RegressionFixtures.generateTestSpan());
        }

        long duration = (System.nanoTime() - startTime) / 1_000_000; // ms
        double actualThroughput = (spanCount * 1000.0) / duration;

        System.out.printf("Span ingestion throughput: %.0f spans/sec\n", actualThroughput);

        assertTrue(actualThroughput >= TARGET_THROUGHPUT * 0.9,
            "Throughput regressed below 90% of target");
    }

    @Test
    @DisplayName("Should not regress on rule evaluation latency")
    public void testRuleEvaluationLatencyRegression() {
        List<Long> latencies = new ArrayList<>();

        for (int i = 0; i < 1000; i++) {
            TraceAggregate trace = RegressionFixtures.generateTestTrace(100);

            long startTime = System.nanoTime();
            List<Signal> signals = evaluateTrace(trace);
            long latency = (System.nanoTime() - startTime) / 1_000_000; // ms

            latencies.add(latency);
        }

        latencies.sort(Long::compareTo);
        long p99 = latencies.get((int) (latencies.size() * 0.99));

        System.out.printf("Rule evaluation p99 latency: %d ms\n", p99);

        assertTrue(p99 <= TARGET_LATENCY_MS * 1.1,
            "p99 latency regressed above 110% of target");
    }

    @Test
    @DisplayName("Should not regress on memory per tenant")
    public void testMemoryPerTenantRegression() {
        long baseline = MemoryUtils.getUsedMemoryMB();

        UUID tenantId = UUID.randomUUID();
        createTenantWithRules(tenantId, 50);
        KieSession session = sessionManager.getSession(tenantId);

        for (int i = 0; i < 1000; i++) {
            session.insert(RegressionFixtures.generateTestSpan());
        }

        long memoryUsedMB = MemoryUtils.getUsedMemoryMB() - baseline;

        System.out.printf("Memory per tenant: %d MB\n", memoryUsedMB);

        assertTrue(memoryUsedMB <= TARGET_MEMORY_MB * 1.2,
            "Memory usage regressed above 120% of target");
    }
}
```

### 5. Test Fixtures and Utilities

**`com/betrace/testutils/BenchmarkFixtures.java`:**
```java
public class BenchmarkFixtures {

    private static final Random random = new Random();

    public static Span generateTestSpan() {
        return Span.builder()
            .spanId(UUID.randomUUID().toString())
            .traceId(UUID.randomUUID().toString())
            .tenantId(UUID.randomUUID())
            .name("test.operation")
            .timestamp(Instant.now())
            .duration(random.nextInt(1000))
            .attributes(Map.of(
                "service.name", "test-service",
                "span.kind", "server"
            ))
            .build();
    }

    public static List<Span> generateTestSpans(int count) {
        return IntStream.range(0, count)
            .mapToObj(i -> generateTestSpan())
            .collect(Collectors.toList());
    }

    public static TraceAggregate generateTestTrace(int spanCount) {
        String traceId = UUID.randomUUID().toString();
        UUID tenantId = UUID.randomUUID();

        TraceAggregate trace = new TraceAggregate(traceId, tenantId);

        for (int i = 0; i < spanCount; i++) {
            Span span = Span.builder()
                .spanId(UUID.randomUUID().toString())
                .traceId(traceId)
                .tenantId(tenantId)
                .name("test.operation." + i)
                .timestamp(Instant.now().plusMillis(i))
                .duration(random.nextInt(100))
                .attributes(Map.of("span.index", i))
                .build();
            trace.addSpan(span);
        }

        return trace;
    }
}
```

**`com/betrace/testutils/MemoryUtils.java`:**
```java
public class MemoryUtils {

    public static long getUsedMemoryMB() {
        Runtime runtime = Runtime.getRuntime();
        return (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
    }

    public static void forceGC() {
        System.gc();
        System.runFinalization();
        System.gc();
    }

    public static long measureMemoryFootprint(Runnable operation) {
        forceGC();
        long before = getUsedMemoryMB();

        operation.run();

        forceGC();
        long after = getUsedMemoryMB();

        return after - before;
    }
}
```

### 6. Flame Graph Generation Script

**`scripts/generate-flamegraph.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail

# Flame graph generation for BeTrace performance profiling
# Requires async-profiler: https://github.com/async-profiler/async-profiler

ASYNC_PROFILER_VERSION="2.9"
ASYNC_PROFILER_URL="https://github.com/async-profiler/async-profiler/releases/download/v${ASYNC_PROFILER_VERSION}/async-profiler-${ASYNC_PROFILER_VERSION}-linux-x64.tar.gz"

# Download async-profiler if not present
if [ ! -d "async-profiler" ]; then
    echo "Downloading async-profiler ${ASYNC_PROFILER_VERSION}..."
    wget -q "${ASYNC_PROFILER_URL}"
    tar -xzf "async-profiler-${ASYNC_PROFILER_VERSION}-linux-x64.tar.gz"
    mv "async-profiler-${ASYNC_PROFILER_VERSION}-linux-x64" async-profiler
    rm "async-profiler-${ASYNC_PROFILER_VERSION}-linux-x64.tar.gz"
fi

# Start Quarkus with async-profiler
echo "Starting BeTrace with async-profiler..."
java -agentpath:./async-profiler/lib/libasyncProfiler.so=start,event=cpu,file=flamegraph-cpu.html \
    -jar backend/target/quarkus-app/quarkus-run.jar &

BETRACE_PID=$!

# Wait for startup
echo "Waiting for BeTrace to start..."
sleep 10

# Run load test
echo "Running load test..."
mvn test -Dtest=HighThroughputLoadTest -f backend/pom.xml

# Stop profiler
echo "Stopping profiler..."
kill $BETRACE_PID

echo "Flame graph generated: flamegraph-cpu.html"
```

## Configuration Properties

```properties
# Performance Testing
betrace.testing.load.enabled=true
betrace.testing.load.duration-seconds=60
betrace.testing.load.target-throughput=100000

# JMH Configuration
betrace.testing.jmh.warmup-iterations=3
betrace.testing.jmh.measurement-iterations=5
betrace.testing.jmh.fork-count=1
```

## Success Criteria

- [ ] JMH benchmarks for all critical paths (span ingestion, rule eval, storage)
- [ ] High throughput load test validates 100K spans/sec
- [ ] Sustained load test validates no degradation over 5 minutes
- [ ] Memory profiling tests validate <50 MB per tenant
- [ ] Performance regression tests fail on >10% regression
- [ ] Flame graph generation script works
- [ ] Test fixtures cover all scenarios
- [ ] All tests are repeatable and deterministic

## Files to Create

### Tests - JMH Benchmarks
- `backend/src/test/java/com/betrace/benchmarks/SpanIngestionBenchmark.java`
- `backend/src/test/java/com/betrace/benchmarks/RuleEvaluationBenchmark.java`
- `backend/src/test/java/com/betrace/benchmarks/PerformanceRegressionTest.java`

### Tests - Load Tests
- `backend/src/test/java/com/betrace/loadtests/HighThroughputLoadTest.java`
- `backend/src/test/java/com/betrace/loadtests/SustainedLoadTest.java`
- `backend/src/test/java/com/betrace/loadtests/MultiTenantScalingLoadTest.java`

### Tests - Memory Profiling
- `backend/src/test/java/com/betrace/profiling/MemoryProfileTest.java`

### Tests - Utilities
- `backend/src/test/java/com/betrace/testutils/BenchmarkFixtures.java`
- `backend/src/test/java/com/betrace/testutils/LoadTestFixtures.java`
- `backend/src/test/java/com/betrace/testutils/RegressionFixtures.java`
- `backend/src/test/java/com/betrace/testutils/MemoryUtils.java`

### Scripts
- `scripts/generate-flamegraph.sh` (external, consumer responsibility)

## Files to Modify

None (testing-only unit)

## Implementation Timeline

**Week 5:** Performance Testing
- Day 1-2: JMH benchmarks for all processors
- Day 3: High throughput load test + sustained load test
- Day 4: Memory profiling tests
- Day 5: Performance regression tests
- Day 6-7: Flame graph generation, test fixtures, documentation

**Deliverable:** Performance targets validated

## Dependencies

**Requires:**
- Unit A: Batching processors (benchmarked)
- Unit B: Async SEDA pipeline (load tested)
- Unit C: Streaming evaluation (memory profiled)
- Unit D: Caching (effectiveness tested)
- Unit E: Backpressure (resilience tested)

**Blocks:**
- Production readiness (validates performance)

## Performance Targets

All targets from PRD-020:
- Span ingestion throughput: 100K+ spans/sec sustained
- Rule evaluation p99 latency: <100ms for 100-span traces
- Memory per tenant: <50 MB with 100 rules + 1000 active spans
- Multi-tenant scaling: Support 500 concurrent tenants
- TigerBeetle batch writes: <5ms p99 latency
- DuckDB inserts: 50K rows/sec throughput

## ADR Compliance

- **ADR-011:** Pure application, tests run locally
- **ADR-013:** Tests validate Camel SEDA performance
- **ADR-014:** 90% coverage validated via tests
- **ADR-015:** Tests validate tiered storage performance
