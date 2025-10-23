# PRD-020b: Async SEDA Pipeline

**Parent PRD:** PRD-020 (Performance Optimization)
**Unit:** B
**Priority:** P1
**Dependencies:** Unit A (Batching Infrastructure)

## Scope

Implement async processing pipeline using Camel SEDA queues. This unit creates the async architecture that leverages the batching processors from Unit A.

**What this unit implements:**
- Camel SEDA routes for async span processing
- Trace aggregation strategy (group spans by trace)
- Batch rule evaluation processor
- Dead letter queue handling
- Signal aggregation strategy

**What this unit does NOT implement:**
- Batching processors (Unit A)
- Streaming evaluation (Unit C)
- Caching (Unit D)
- Backpressure/circuit breakers (Unit E)

## Implementation

### 1. Async Span Processing Routes

**`com/betrace/routes/AsyncSpanProcessingRoutes.java`:**
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
            .process("batchSpanLogWriteProcessor")           // Batch write (Unit A)
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
            .process("batchTigerBeetleWriteProcessor")        // Batch write (Unit A)
            .process("batchDuckDBInsertProcessor")            // Batch write (Unit A)
            .wireTap("seda:compliance-span-generation");      // Async compliance

        // Error Handling (Dead Letter Queue)
        onException(Exception.class)
            .handled(true)
            .maximumRedeliveries(3)
            .redeliveryDelay(1000)
            .to("seda:dead-letter-queue")
            .process("logErrorProcessor");

        // Dead Letter Queue Processing
        from("seda:dead-letter-queue")
            .routeId("deadLetterQueueHandler")
            .process("logDeadLetterProcessor")
            .process("recordDlqEventProcessor")
            .choice()
                .when(header("retryable").isEqualTo(true))
                    .delay(60000)  // Retry after 1 minute
                    .to("seda:span-ingestion")
                .otherwise()
                    .process("persistFailedSpanProcessor");
    }
}
```

### 2. Span Aggregation Strategy

**`com/betrace/aggregation/SpanAggregationStrategy.java`:**
```java
@ApplicationScoped
public class SpanAggregationStrategy implements AggregationStrategy {

    @Override
    public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
        Span newSpan = newExchange.getIn().getBody(Span.class);

        if (oldExchange == null) {
            // First span in trace
            TraceAggregate aggregate = new TraceAggregate(
                newSpan.getTraceId(),
                newSpan.getTenantId()
            );
            aggregate.addSpan(newSpan);

            newExchange.getIn().setBody(aggregate);
            return newExchange;
        }

        // Add span to existing aggregate
        TraceAggregate aggregate = oldExchange.getIn().getBody(TraceAggregate.class);
        aggregate.addSpan(newSpan);

        oldExchange.getIn().setBody(aggregate);
        return oldExchange;
    }
}
```

### 3. Batch Rule Evaluation Processor

**`com/betrace/processors/rules/BatchRuleEvaluationProcessor.java`:**
```java
@Named("batchRuleEvaluationProcessor")
@ApplicationScoped
public class BatchRuleEvaluationProcessor implements Processor {

    @Inject
    TenantSessionManager sessionManager;

    @Inject
    MetricsService metricsService;

    private static final Logger log = LoggerFactory.getLogger(BatchRuleEvaluationProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        TraceAggregate trace = exchange.getIn().getBody(TraceAggregate.class);
        UUID tenantId = trace.getTenantId();
        List<Span> spans = trace.getSpans();

        // Get tenant session (will be cached in Unit D)
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

            // Record metrics
            metricsService.recordRuleEvaluation(duration);

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

### 4. Signal Aggregation Strategy

**`com/betrace/aggregation/SignalAggregationStrategy.java`:**
```java
@ApplicationScoped
public class SignalAggregationStrategy implements AggregationStrategy {

    @Override
    public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
        Signal newSignal = newExchange.getIn().getBody(Signal.class);

        if (oldExchange == null) {
            // First signal in batch
            List<Signal> signals = new ArrayList<>();
            signals.add(newSignal);

            newExchange.getIn().setBody(signals);
            return newExchange;
        }

        // Add signal to existing batch
        List<Signal> signals = oldExchange.getIn().getBody(List.class);
        signals.add(newSignal);

        oldExchange.getIn().setBody(signals);
        return oldExchange;
    }
}
```

### 5. TraceAggregate Model

**`com/betrace/model/TraceAggregate.java`:**
```java
public class TraceAggregate {
    private final String traceId;
    private final UUID tenantId;
    private final List<Span> spans;
    private final List<String> ruleIds;
    private Instant firstSpanTime;
    private Instant lastSpanTime;
    private boolean complete;

    public TraceAggregate(String traceId, UUID tenantId) {
        this.traceId = traceId;
        this.tenantId = tenantId;
        this.spans = new ArrayList<>();
        this.ruleIds = new ArrayList<>();
        this.complete = false;
    }

    public void addSpan(Span span) {
        spans.add(span);

        if (firstSpanTime == null || span.getTimestamp().isBefore(firstSpanTime)) {
            firstSpanTime = span.getTimestamp();
        }

        if (lastSpanTime == null || span.getTimestamp().isAfter(lastSpanTime)) {
            lastSpanTime = span.getTimestamp();
        }

        // Check if trace is complete
        if (Boolean.TRUE.equals(span.getAttributes().get("trace.complete"))) {
            this.complete = true;
        }
    }

    // Getters
    public String getTraceId() { return traceId; }
    public UUID getTenantId() { return tenantId; }
    public List<Span> getSpans() { return Collections.unmodifiableList(spans); }
    public List<String> getRuleIds() { return ruleIds; }
    public boolean isComplete() { return complete; }
    public Instant getFirstSpanTime() { return firstSpanTime; }
    public Instant getLastSpanTime() { return lastSpanTime; }
}
```

### 6. Error Handling Processors

**`com/betrace/processors/error/LogDeadLetterProcessor.java`:**
```java
@Named("logDeadLetterProcessor")
@ApplicationScoped
public class LogDeadLetterProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Exception exception = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Exception.class);
        Object body = exchange.getIn().getBody();

        log.error("Message sent to DLQ: {}", body, exception);

        // Determine if retryable
        boolean retryable = isRetryable(exception);
        exchange.getIn().setHeader("retryable", retryable);
    }

    private boolean isRetryable(Exception e) {
        // Network errors, timeout errors → retryable
        // Parse errors, validation errors → not retryable
        return e instanceof SocketTimeoutException ||
               e instanceof ConnectException;
    }
}
```

## Configuration Properties

```properties
# SEDA Queue Configuration
betrace.seda.span-ingestion.size=10000
betrace.seda.span-ingestion.concurrent-consumers=10
betrace.seda.trace-correlation.size=5000
betrace.seda.trace-correlation.concurrent-consumers=5
betrace.seda.rule-evaluation.size=5000
betrace.seda.rule-evaluation.concurrent-consumers=5
betrace.seda.storage-write.size=10000
betrace.seda.storage-write.concurrent-consumers=2

# Aggregation Configuration
betrace.aggregation.trace.completion-size=100
betrace.aggregation.trace.completion-timeout-ms=5000
betrace.aggregation.signal.completion-size=128
betrace.aggregation.signal.completion-interval-ms=500

# Error Handling
betrace.error.max-redeliveries=3
betrace.error.redelivery-delay-ms=1000
betrace.error.dlq-retry-delay-ms=60000
```

## Success Criteria

- [ ] AsyncSpanProcessingRoutes implements 4-stage SEDA pipeline
- [ ] Span ingestion accepts spans without blocking
- [ ] Trace aggregation groups spans by traceId with 100-span batches
- [ ] Batch rule evaluation processes 100 spans at once
- [ ] Signal aggregation batches 128 signals for storage
- [ ] Dead letter queue handles failures gracefully
- [ ] Wire tap for audit logging is non-blocking
- [ ] All routes follow ADR-013 (Camel-First)
- [ ] 90% test coverage for all processors (ADR-014)

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**`AsyncSpanProcessingRoutesTest.java`:**
- Test route configuration and SEDA queue setup
- Test span ingestion pipeline
- Test trace correlation with aggregation
- Test rule evaluation pipeline
- Test storage write pipeline
- Test dead letter queue handling

**`SpanAggregationStrategyTest.java`:**
- Test first span aggregation (creates TraceAggregate)
- Test subsequent span aggregation
- Test trace completion detection
- Test concurrent aggregation

**`BatchRuleEvaluationProcessorTest.java`:**
- Test batch span insertion to Drools
- Test rule firing with multiple spans
- Test signal collection from session
- Test span cleanup after evaluation
- Test sandboxing context

**`SignalAggregationStrategyTest.java`:**
- Test first signal aggregation (creates list)
- Test subsequent signal aggregation
- Test batch size limits

**`LogDeadLetterProcessorTest.java`:**
- Test retryable exception detection
- Test non-retryable exception detection
- Test DLQ logging

### Integration Tests

**`AsyncPipelineIntegrationTest.java`:**
```java
@QuarkusTest
public class AsyncPipelineIntegrationTest {

    @Inject
    ProducerTemplate template;

    @Test
    @DisplayName("Should process spans through entire async pipeline")
    public void testEndToEndPipeline() throws Exception {
        // Generate test spans
        List<Span> spans = generateTestSpans(100);

        // Send to ingestion queue
        for (Span span : spans) {
            template.sendBodyAndHeader("seda:span-ingestion", span, "traceId", span.getTraceId());
        }

        // Wait for async processing
        Thread.sleep(10000);

        // Verify signals created in DuckDB
        List<Signal> signals = querySignalsFromDuckDB();
        assertTrue(signals.size() > 0, "Signals should be created");
    }

    @Test
    @DisplayName("Should handle errors via dead letter queue")
    public void testDeadLetterQueue() throws Exception {
        // Send malformed span
        Span malformedSpan = createMalformedSpan();
        template.sendBody("seda:span-ingestion", malformedSpan);

        // Wait for DLQ processing
        Thread.sleep(5000);

        // Verify span in DLQ log
        assertTrue(isDlqLogContains(malformedSpan.getId()));
    }
}
```

## Files to Create

### Backend - Routes
- `backend/src/main/java/com/betrace/routes/AsyncSpanProcessingRoutes.java`

### Backend - Processors
- `backend/src/main/java/com/betrace/processors/rules/BatchRuleEvaluationProcessor.java`
- `backend/src/main/java/com/betrace/processors/error/LogDeadLetterProcessor.java`
- `backend/src/main/java/com/betrace/processors/error/RecordDlqEventProcessor.java`
- `backend/src/main/java/com/betrace/processors/error/PersistFailedSpanProcessor.java`

### Backend - Aggregation
- `backend/src/main/java/com/betrace/aggregation/SpanAggregationStrategy.java`
- `backend/src/main/java/com/betrace/aggregation/SignalAggregationStrategy.java`

### Backend - Models
- `backend/src/main/java/com/betrace/model/TraceAggregate.java`

### Tests - Unit Tests
- `backend/src/test/java/com/betrace/routes/AsyncSpanProcessingRoutesTest.java`
- `backend/src/test/java/com/betrace/processors/rules/BatchRuleEvaluationProcessorTest.java`
- `backend/src/test/java/com/betrace/aggregation/SpanAggregationStrategyTest.java`
- `backend/src/test/java/com/betrace/aggregation/SignalAggregationStrategyTest.java`
- `backend/src/test/java/com/betrace/processors/error/LogDeadLetterProcessorTest.java`

### Tests - Integration Tests
- `backend/src/test/java/com/betrace/integration/AsyncPipelineIntegrationTest.java`

## Files to Modify

### Backend - Routes
- `backend/src/main/java/com/betrace/routes/SpanApiRoute.java`
  - Replace synchronous processing with SEDA queue
  - Change from direct processing to `to("seda:span-ingestion")`

### Backend - Services
- `backend/src/main/java/com/betrace/services/RuleEvaluationService.java`
  - Add batch evaluation method (used by BatchRuleEvaluationProcessor)
  - Keep synchronous evaluation for backward compatibility

### Configuration
- `backend/src/main/resources/application.properties`
  - Add SEDA queue configuration

## Implementation Timeline

**Week 2:** Async Processing Pipeline
- Day 1-2: AsyncSpanProcessingRoutes + aggregation strategies
- Day 3: BatchRuleEvaluationProcessor + tests
- Day 4: Error handling processors (DLQ)
- Day 5: Integration tests
- Day 6-7: Route configuration tests, performance validation

**Deliverable:** Async processing pipeline operational

## Dependencies

**Requires:**
- Unit A: Batching processors (batchSpanLogWriteProcessor, batchTigerBeetleWriteProcessor, batchDuckDBInsertProcessor)
- PRD-005: SafeRuleCapabilities for sandboxing

**Blocks:**
- Unit C: Streaming evaluation (alternative to batch eval)
- Unit E: Backpressure (needs SEDA queues)
- Unit F: Performance testing (validates async pipeline)
- Unit G: Metrics (observes SEDA queue stats)

## Performance Targets

- Span ingestion throughput: 100K spans/sec (10 concurrent consumers)
- Rule evaluation latency: <100ms p99 (batch of 100 spans)
- Queue latency: <10ms per stage
- End-to-end latency: <500ms (ingestion → signal created)

## ADR Compliance

- **ADR-011:** Pure application, no deployment coupling
- **ADR-013:** All async via Camel SEDA queues (primary ADR)
- **ADR-014:** Named processors with 90% test coverage
- **ADR-015:** Integrates batching from Unit A for tiered storage
