# PRD-020e: Backpressure and Circuit Breakers

**Parent PRD:** PRD-020 (Performance Optimization)
**Unit:** E
**Priority:** P1
**Dependencies:** Unit A (Batching), Unit B (Async SEDA Pipeline)

## Scope

Implement backpressure and circuit breaker mechanisms for resilience under load. This unit ensures FLUO fails gracefully when overwhelmed.

**What this unit implements:**
- Backpressure rejection when SEDA queues full (503 responses)
- Circuit breaker for rule evaluation failures
- Fallback processors for graceful degradation
- Queue monitoring and alerting
- Dead letter queue enhancements

**What this unit does NOT implement:**
- Batching processors (Unit A)
- Async SEDA pipeline (Unit B)
- Streaming evaluation (Unit C)
- Caching (Unit D)

## Implementation

### 1. Backpressure Routes

**`com/fluo/routes/BackpressureRoutes.java`:**
```java
@ApplicationScoped
public class BackpressureRoutes extends RouteBuilder {

    @ConfigProperty(name = "fluo.backpressure.queue-full-threshold-percent", defaultValue = "90")
    int queueFullThresholdPercent;

    @Inject
    QueueMonitoringService queueMonitor;

    @Override
    public void configure() throws Exception {

        // Backpressure at ingestion (reject when queue full)
        from("rest:post:/api/otlp/traces")
            .routeId("spanIngestionWithBackpressure")
            .choice()
                .when(method(queueMonitor, "isQueueFull", "span-ingestion"))
                    .log("Backpressure: Rejecting span ingestion (queue full)")
                    .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(503))
                    .setHeader("Retry-After", constant("60"))
                    .setBody(constant(Map.of(
                        "error", "Service temporarily overloaded",
                        "retryAfterSeconds", 60
                    )))
                    .marshal().json()
                    .stop()
                .otherwise()
                    .to("seda:span-ingestion?blockWhenFull=false&offerTimeout=100");

        // Circuit Breaker for Rule Evaluation
        from("seda:rule-evaluation?concurrentConsumers=5")
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
                .log("Circuit breaker triggered for rule evaluation")
                .process("fallbackRuleEvaluationProcessor")
                .to("seda:dead-letter-queue");

        from("direct:performRuleEvaluation")
            .process("batchRuleEvaluationProcessor")
            .split(body())
            .to("seda:storage-write");

        // Circuit Breaker for Storage Writes
        from("seda:storage-write?concurrentConsumers=2")
            .routeId("storageWriteWithCircuitBreaker")
            .circuitBreaker()
                .faultToleranceConfiguration()
                    .timeoutEnabled(true)
                    .timeoutDuration(5000)  // 5 second timeout
                    .failureRateThreshold(50)
                    .requestVolumeThreshold(50)
                    .delay(15000)  // 15 second delay before retry
                .end()
                .to("direct:performStorageWrite")
            .onFallback()
                .log("Circuit breaker triggered for storage write")
                .process("fallbackStorageWriteProcessor")
                .to("seda:dead-letter-queue");

        from("direct:performStorageWrite")
            .aggregate(constant(true), new SignalAggregationStrategy())
                .completionSize(128)
                .completionInterval(500)
            .process("batchTigerBeetleWriteProcessor")
            .process("batchDuckDBInsertProcessor");
    }
}
```

### 2. Queue Monitoring Service

**`com/fluo/services/QueueMonitoringService.java`:**
```java
@ApplicationScoped
public class QueueMonitoringService {

    @Inject
    CamelContext camelContext;

    @ConfigProperty(name = "fluo.backpressure.queue-full-threshold-percent", defaultValue = "90")
    int queueFullThresholdPercent;

    private static final Logger log = LoggerFactory.getLogger(QueueMonitoringService.class);

    public boolean isQueueFull(String queueName) {
        try {
            SedaEndpoint endpoint = camelContext.getEndpoint("seda:" + queueName, SedaEndpoint.class);
            BlockingQueue<?> queue = endpoint.getQueue();

            int currentSize = queue.size();
            int capacity = endpoint.getSize();
            int threshold = (capacity * queueFullThresholdPercent) / 100;

            boolean isFull = currentSize >= threshold;

            if (isFull) {
                log.warn("Queue {} is full: {}/{} (threshold: {})",
                    queueName, currentSize, capacity, threshold);
            }

            return isFull;

        } catch (Exception e) {
            log.error("Failed to check queue status for {}", queueName, e);
            return false;
        }
    }

    public Map<String, Object> getQueueStatistics(String queueName) {
        try {
            SedaEndpoint endpoint = camelContext.getEndpoint("seda:" + queueName, SedaEndpoint.class);
            BlockingQueue<?> queue = endpoint.getQueue();

            return Map.of(
                "name", queueName,
                "currentSize", queue.size(),
                "capacity", endpoint.getSize(),
                "utilizationPercent", (queue.size() * 100.0) / endpoint.getSize(),
                "concurrentConsumers", endpoint.getConcurrentConsumers()
            );

        } catch (Exception e) {
            log.error("Failed to get queue statistics for {}", queueName, e);
            return Map.of("error", e.getMessage());
        }
    }

    public Map<String, Object> getAllQueueStatistics() {
        List<String> queueNames = List.of(
            "span-ingestion",
            "trace-correlation",
            "rule-evaluation",
            "storage-write",
            "dead-letter-queue"
        );

        Map<String, Object> allStats = new HashMap<>();
        for (String queueName : queueNames) {
            allStats.put(queueName, getQueueStatistics(queueName));
        }

        return allStats;
    }
}
```

### 3. Fallback Processors

**`com/fluo/processors/backpressure/FallbackRuleEvaluationProcessor.java`:**
```java
@Named("fallbackRuleEvaluationProcessor")
@ApplicationScoped
public class FallbackRuleEvaluationProcessor implements Processor {

    @Inject
    PerformanceCacheService cacheService;

    @Inject
    MetricsService metricsService;

    @Override
    public void process(Exchange exchange) throws Exception {
        TraceAggregate trace = exchange.getIn().getBody(TraceAggregate.class);
        Exception exception = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Exception.class);

        log.warn("Fallback: Rule evaluation failed for trace {}", trace.getTraceId(), exception);

        // Attempt to return cached result if available
        Optional<List<Signal>> cachedSignals = cacheService.getCachedTraceMetadata(trace.getTraceId())
            .flatMap(metadata -> getCachedSignalsForTrace(trace.getTraceId()));

        if (cachedSignals.isPresent()) {
            log.info("Fallback: Using cached signals for trace {}", trace.getTraceId());
            exchange.getIn().setBody(cachedSignals.get());
        } else {
            // No cached result, return empty (fail gracefully)
            log.warn("Fallback: No cached result for trace {}, returning empty", trace.getTraceId());
            exchange.getIn().setBody(Collections.emptyList());
        }

        // Record fallback metrics
        metricsService.recordRuleEvaluationFallback();
        exchange.getIn().setHeader("fallback", true);
    }

    private Optional<List<Signal>> getCachedSignalsForTrace(String traceId) {
        // Attempt to retrieve signals from cache (if implemented)
        return Optional.empty();
    }
}
```

**`com/fluo/processors/backpressure/FallbackStorageWriteProcessor.java`:**
```java
@Named("fallbackStorageWriteProcessor")
@ApplicationScoped
public class FallbackStorageWriteProcessor implements Processor {

    @Inject
    MetricsService metricsService;

    @Override
    public void process(Exchange exchange) throws Exception {
        List<Signal> signals = exchange.getIn().getBody(List.class);
        Exception exception = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Exception.class);

        log.error("Fallback: Storage write failed for {} signals", signals.size(), exception);

        // Write signals to local file for manual recovery
        writeToLocalFile(signals);

        // Record fallback metrics
        metricsService.recordStorageWriteFallback(signals.size());
        exchange.getIn().setHeader("fallback", true);
    }

    private void writeToLocalFile(List<Signal> signals) throws IOException {
        Path fallbackDir = Path.of("./data-fallback");
        Files.createDirectories(fallbackDir);

        String filename = "signals-" + Instant.now().toEpochMilli() + ".json";
        Path fallbackFile = fallbackDir.resolve(filename);

        ObjectMapper mapper = new ObjectMapper();
        mapper.writeValue(fallbackFile.toFile(), signals);

        log.info("Wrote {} signals to fallback file: {}", signals.size(), fallbackFile);
    }
}
```

### 4. Queue Statistics Endpoint

**`com/fluo/routes/QueueStatsRoutes.java`:**
```java
@ApplicationScoped
public class QueueStatsRoutes extends RouteBuilder {

    @Inject
    QueueMonitoringService queueMonitor;

    @Override
    public void configure() throws Exception {

        rest("/api/performance")
            .get("/queue-stats")
                .description("Get SEDA queue statistics")
                .to("direct:getQueueStats")

            .get("/queue-stats/{queueName}")
                .description("Get statistics for specific queue")
                .to("direct:getQueueStatsByName");

        from("direct:getQueueStats")
            .process(exchange -> {
                Map<String, Object> stats = queueMonitor.getAllQueueStatistics();
                exchange.getIn().setBody(stats);
            })
            .marshal().json();

        from("direct:getQueueStatsByName")
            .process(exchange -> {
                String queueName = exchange.getIn().getHeader("queueName", String.class);
                Map<String, Object> stats = queueMonitor.getQueueStatistics(queueName);
                exchange.getIn().setBody(stats);
            })
            .marshal().json();
    }
}
```

### 5. Circuit Breaker State Monitoring

**`com/fluo/services/CircuitBreakerMonitor.java`:**
```java
@ApplicationScoped
public class CircuitBreakerMonitor {

    private final Map<String, CircuitBreakerState> circuitBreakerStates = new ConcurrentHashMap<>();

    public enum CircuitBreakerState {
        CLOSED(0),
        OPEN(1),
        HALF_OPEN(2);

        private final int value;

        CircuitBreakerState(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }

    public void recordCircuitBreakerState(String circuitBreakerName, CircuitBreakerState state) {
        circuitBreakerStates.put(circuitBreakerName, state);
        log.info("Circuit breaker {} state: {}", circuitBreakerName, state);
    }

    public CircuitBreakerState getCircuitBreakerState(String circuitBreakerName) {
        return circuitBreakerStates.getOrDefault(circuitBreakerName, CircuitBreakerState.CLOSED);
    }

    public Map<String, CircuitBreakerState> getAllCircuitBreakerStates() {
        return Collections.unmodifiableMap(circuitBreakerStates);
    }
}
```

## Configuration Properties

```properties
# Backpressure Configuration
fluo.backpressure.queue-full-threshold-percent=90
fluo.backpressure.rejection-retry-after-seconds=60

# Circuit Breaker Configuration
fluo.circuit-breaker.rule-evaluation.timeout-seconds=10
fluo.circuit-breaker.rule-evaluation.failure-rate-threshold=50
fluo.circuit-breaker.rule-evaluation.request-volume-threshold=100
fluo.circuit-breaker.rule-evaluation.delay-seconds=30

fluo.circuit-breaker.storage-write.timeout-seconds=5
fluo.circuit-breaker.storage-write.failure-rate-threshold=50
fluo.circuit-breaker.storage-write.request-volume-threshold=50
fluo.circuit-breaker.storage-write.delay-seconds=15

# Fallback Configuration
fluo.fallback.storage-write.local-file-path=./data-fallback
```

## Success Criteria

- [ ] Backpressure rejects span ingestion with 503 when queue >90% full
- [ ] Circuit breaker opens after 50% failure rate
- [ ] Circuit breaker remains open for configured delay (30s)
- [ ] Fallback processors handle rule evaluation failures gracefully
- [ ] Fallback processors handle storage write failures gracefully
- [ ] Queue monitoring service tracks queue utilization
- [ ] Queue statistics endpoint exposes current queue sizes
- [ ] Circuit breaker state monitoring tracks open/closed states
- [ ] 90% test coverage for all processors (ADR-014)

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**`BackpressureRoutesTest.java`:**
- Test 503 rejection when queue full
- Test normal ingestion when queue not full
- Test Retry-After header
- Test circuit breaker configuration

**`QueueMonitoringServiceTest.java`:**
- Test isQueueFull() logic
- Test queue statistics calculation
- Test threshold configuration
- Test all queue statistics

**`FallbackRuleEvaluationProcessorTest.java`:**
- Test fallback with cached result
- Test fallback without cached result
- Test fallback metrics recording

**`FallbackStorageWriteProcessorTest.java`:**
- Test fallback file writing
- Test fallback metrics recording
- Test error handling

**`CircuitBreakerMonitorTest.java`:**
- Test circuit breaker state tracking
- Test state transitions
- Test metrics recording

### Integration Tests

**`BackpressureIntegrationTest.java`:**
```java
@QuarkusTest
public class BackpressureIntegrationTest {

    @Inject
    ProducerTemplate template;

    @Inject
    QueueMonitoringService queueMonitor;

    @Test
    @DisplayName("Should reject span ingestion when queue full")
    public void testBackpressureRejection() throws Exception {
        // Fill queue to 90% capacity
        int queueCapacity = 10000;
        int fillCount = (int) (queueCapacity * 0.91);

        for (int i = 0; i < fillCount; i++) {
            Span span = generateTestSpan();
            template.sendBody("seda:span-ingestion", span);
        }

        // Wait for queue to fill
        Thread.sleep(1000);

        // Verify queue is full
        assertTrue(queueMonitor.isQueueFull("span-ingestion"));

        // Attempt to send span (should be rejected with 503)
        Exchange exchange = template.request("rest:post:/api/otlp/traces",
            ex -> ex.getIn().setBody(generateTestSpan()));

        assertEquals(503, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertEquals("60", exchange.getIn().getHeader("Retry-After"));
    }

    @Test
    @DisplayName("Should trigger circuit breaker after failures")
    public void testCircuitBreakerTriggering() throws Exception {
        // Simulate rule evaluation failures
        for (int i = 0; i < 150; i++) {
            TraceAggregate trace = generateMalformedTrace();
            template.sendBody("seda:rule-evaluation", trace);
        }

        // Wait for circuit breaker to open
        Thread.sleep(5000);

        // Verify circuit breaker is open
        CircuitBreakerState state = circuitBreakerMonitor.getCircuitBreakerState("rule-evaluation");
        assertEquals(CircuitBreakerState.OPEN, state);
    }

    @Test
    @DisplayName("Should fallback gracefully on storage write failure")
    public void testStorageWriteFallback() throws Exception {
        // Simulate storage write failure (disconnect TigerBeetle)
        stopTigerBeetle();

        List<Signal> signals = generateTestSignals(10);
        template.sendBody("seda:storage-write", signals);

        // Wait for fallback processing
        Thread.sleep(5000);

        // Verify signals written to fallback file
        Path fallbackDir = Path.of("./data-fallback");
        assertTrue(Files.exists(fallbackDir));

        List<Path> fallbackFiles = Files.list(fallbackDir)
            .filter(p -> p.getFileName().toString().startsWith("signals-"))
            .collect(Collectors.toList());

        assertTrue(fallbackFiles.size() > 0, "Fallback file should be created");
    }
}
```

### Load Tests

**`BackpressureLoadTest.java`:**
```java
@QuarkusTest
public class BackpressureLoadTest {

    @Test
    @DisplayName("Should handle sustained overload with backpressure")
    public void testSustainedOverload() throws Exception {
        int spansPerSecond = 200_000; // 2x capacity
        int durationSeconds = 60;

        AtomicInteger accepted = new AtomicInteger(0);
        AtomicInteger rejected = new AtomicInteger(0);

        // Overload ingestion
        for (int i = 0; i < durationSeconds; i++) {
            for (int s = 0; s < spansPerSecond; s++) {
                Exchange exchange = template.request("rest:post:/api/otlp/traces",
                    ex -> ex.getIn().setBody(generateTestSpan()));

                int statusCode = exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE, Integer.class);
                if (statusCode == 200 || statusCode == 202) {
                    accepted.incrementAndGet();
                } else if (statusCode == 503) {
                    rejected.incrementAndGet();
                }
            }
            Thread.sleep(1000);
        }

        System.out.printf("Accepted: %d, Rejected: %d (%.2f%% rejection rate)\n",
            accepted.get(), rejected.get(),
            (rejected.get() * 100.0) / (accepted.get() + rejected.get()));

        // Should reject at least 40% under 2x overload
        assertTrue(rejected.get() > accepted.get() * 0.4,
            "Should reject requests under sustained overload");
    }
}
```

## Files to Create

### Backend - Routes
- `backend/src/main/java/com/fluo/routes/BackpressureRoutes.java`
- `backend/src/main/java/com/fluo/routes/QueueStatsRoutes.java`

### Backend - Services
- `backend/src/main/java/com/fluo/services/QueueMonitoringService.java`
- `backend/src/main/java/com/fluo/services/CircuitBreakerMonitor.java`

### Backend - Processors
- `backend/src/main/java/com/fluo/processors/backpressure/FallbackRuleEvaluationProcessor.java`
- `backend/src/main/java/com/fluo/processors/backpressure/FallbackStorageWriteProcessor.java`

### Tests - Unit Tests
- `backend/src/test/java/com/fluo/routes/BackpressureRoutesTest.java`
- `backend/src/test/java/com/fluo/routes/QueueStatsRoutesTest.java`
- `backend/src/test/java/com/fluo/services/QueueMonitoringServiceTest.java`
- `backend/src/test/java/com/fluo/services/CircuitBreakerMonitorTest.java`
- `backend/src/test/java/com/fluo/processors/backpressure/FallbackRuleEvaluationProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/backpressure/FallbackStorageWriteProcessorTest.java`

### Tests - Integration Tests
- `backend/src/test/java/com/fluo/integration/BackpressureIntegrationTest.java`

### Tests - Load Tests
- `backend/src/test/java/com/fluo/loadtests/BackpressureLoadTest.java`

## Files to Modify

### Backend - Routes
- `backend/src/main/java/com/fluo/routes/AsyncSpanProcessingRoutes.java`
  - Replace direct ingestion with backpressure-aware route
  - Add circuit breakers to rule evaluation and storage write

### Backend - Services
- `backend/src/main/java/com/fluo/services/MetricsService.java`
  - Add fallback metrics (recordRuleEvaluationFallback, recordStorageWriteFallback)

### Configuration
- `backend/src/main/resources/application.properties`
  - Add backpressure and circuit breaker configuration

## Implementation Timeline

**Week 4 (second half):** Backpressure and Circuit Breakers
- Day 1-2: BackpressureRoutes + QueueMonitoringService
- Day 3: Fallback processors
- Day 4: Circuit breaker monitoring + QueueStatsRoutes
- Day 5: Integration tests
- Day 6-7: Load tests, backpressure validation

**Deliverable:** Backpressure and circuit breakers operational

## Dependencies

**Requires:**
- Unit A: Batching processors (used in direct:performStorageWrite)
- Unit B: AsyncSpanProcessingRoutes, SEDA queues

**Blocks:**
- Unit F: Performance testing (validates resilience)
- Unit G: Metrics (exposes circuit breaker states)

## Performance Targets

- Backpressure trigger: Queue >90% full
- Circuit breaker failure threshold: 50% failures over 100 requests
- Fallback latency: <10ms
- Queue monitoring overhead: <1ms

## ADR Compliance

- **ADR-011:** Pure application, no deployment coupling
- **ADR-013:** Circuit breakers integrated with Camel routes
- **ADR-014:** Named processors with 90% test coverage
- **ADR-015:** Fallback writes to local storage (tiered storage)
