# PRD-019A: Core Observability Instrumentation

**Priority:** P0 (Blocks all other observability)
**Complexity:** Medium
**Personas:** SRE, Platform
**Dependencies:** None
**Implements:** Metrics, traces, structured logging for FLUO

## Problem

FLUO has no internal observability:
- No metrics for span ingestion rate, rule evaluation latency, signal generation
- No distributed traces for FLUO's internal operations
- Logs are unstructured (no correlation IDs, JSON formatting)
- Impossible to diagnose performance issues or bottlenecks

## Solution

### Metrics Instrumentation

**Key Metrics:**
```
# Ingestion
fluo.spans.received.total{tenant_id}       Counter
fluo.spans.bytes.total{tenant_id}          Counter
fluo.spans.invalid.total{tenant_id,reason} Counter

# Rule Evaluation
fluo.rules.evaluated.total{tenant_id,rule_id}     Counter
fluo.rules.evaluation.duration{tenant_id,rule_id} Histogram
fluo.rules.errors.total{tenant_id,rule_id,type}   Counter

# Signals
fluo.signals.generated.total{tenant_id,severity}   Counter
fluo.signals.persisted.duration{tenant_id}         Histogram

# Database
fluo.db.connections.active{pool}                   Gauge
fluo.db.queries.duration{operation}                Histogram
fluo.db.errors.total{operation,error_type}         Counter

# Resources
fluo.memory.used.bytes                             Gauge
fluo.cpu.usage.percent                             Gauge
fluo.threads.active{pool}                          Gauge
```

### Distributed Tracing

**Internal Operations to Trace:**
- Span ingestion (`POST /api/spans`)
- Trace correlation (grouping spans by trace_id)
- Rule evaluation (per-rule execution)
- Signal generation and persistence
- Database queries

**Trace Attributes:**
```java
// Example: Rule evaluation trace
Span span = tracer.spanBuilder("evaluate_rule")
    .setAttribute("tenant.id", tenantId)
    .setAttribute("rule.id", ruleId)
    .setAttribute("trace.span_count", spanCount)
    .setAttribute("rule.execution_time_ms", duration)
    .startSpan();
```

### Structured Logging

**Log Format:**
```json
{
  "timestamp": "2025-10-11T10:23:45.123Z",
  "level": "INFO",
  "logger": "com.fluo.services.RuleEvaluationService",
  "message": "Rule evaluation completed",
  "traceId": "abc123",
  "spanId": "def456",
  "tenantId": "tenant_xyz",
  "ruleId": "high_latency_api",
  "duration_ms": 234,
  "spans_evaluated": 42
}
```

**Log Levels:**
- `DEBUG`: Trace correlation details, rule matching logic
- `INFO`: Span ingestion, signal generation events
- `WARN`: Partial trace evaluations, rule timeouts
- `ERROR`: Rule failures, database errors, API errors

## Implementation

### Metrics Service

**File:** `backend/src/main/java/com/fluo/services/MetricsService.java`

```java
@ApplicationScoped
public class MetricsService {
    private final MeterRegistry registry;

    public void recordSpanIngestion(String tenantId, int count, long bytes) {
        Counter.builder("fluo.spans.received.total")
            .tag("tenant_id", tenantId)
            .register(registry)
            .increment(count);

        Counter.builder("fluo.spans.bytes.total")
            .tag("tenant_id", tenantId)
            .register(registry)
            .increment(bytes);
    }

    public void recordRuleEvaluation(String tenantId, String ruleId, Duration duration) {
        Counter.builder("fluo.rules.evaluated.total")
            .tag("tenant_id", tenantId)
            .tag("rule_id", ruleId)
            .register(registry)
            .increment();

        Timer.builder("fluo.rules.evaluation.duration")
            .tag("tenant_id", tenantId)
            .tag("rule_id", ruleId)
            .register(registry)
            .record(duration);
    }

    public void recordError(String operation, String errorType) {
        Counter.builder("fluo.errors.total")
            .tag("operation", operation)
            .tag("type", errorType)
            .register(registry)
            .increment();
    }
}
```

### OpenTelemetry Tracing

**Configuration:** `application.properties`

```properties
# Enable OpenTelemetry for FLUO itself
quarkus.otel.enabled=true
quarkus.otel.exporter.otlp.traces.endpoint=http://localhost:4317
quarkus.otel.resource.attributes=service.name=fluo,service.version=${quarkus.application.version}

# Trace sampling (1% normal, 100% errors)
quarkus.otel.traces.sampler=traceidratio
quarkus.otel.traces.sampler.arg=0.01
```

**Instrumentation Example:**

```java
@ApplicationScoped
public class RuleEvaluationService {
    @Inject Tracer tracer;
    @Inject MetricsService metrics;

    @WithSpan("evaluate_rule")
    public List<RuleMatch> evaluate(String tenantId, String ruleId, CompleteTrace trace) {
        Span span = Span.current();
        span.setAttribute("tenant.id", tenantId);
        span.setAttribute("rule.id", ruleId);
        span.setAttribute("trace.span_count", trace.getSpanCount());

        long start = System.nanoTime();
        try {
            List<RuleMatch> matches = drools.evaluate(tenantId, ruleId, trace);
            span.setAttribute("matches.count", matches.size());
            return matches;
        } catch (Exception e) {
            span.recordException(e);
            metrics.recordError("rule_evaluation", e.getClass().getSimpleName());
            throw e;
        } finally {
            Duration duration = Duration.ofNanos(System.nanoTime() - start);
            metrics.recordRuleEvaluation(tenantId, ruleId, duration);
        }
    }
}
```

### Structured Logging

**Configuration:** `application.properties`

```properties
# JSON logging format
quarkus.log.console.format=%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{3.}] (%t) %s%e%n
quarkus.log.console.json=true
quarkus.log.console.json.pretty-print=false

# Include trace context
quarkus.log.console.json.additional-field."traceId".value=${traceId}
quarkus.log.console.json.additional-field."spanId".value=${spanId}
```

**Usage Example:**

```java
@ApplicationScoped
public class SpanProcessor {
    private static final Logger log = Logger.getLogger(SpanProcessor.class);

    public void processSpans(String tenantId, List<SpanData> spans) {
        log.infof("Processing %d spans for tenant %s", spans.size(), tenantId);

        try {
            // Process spans...
        } catch (Exception e) {
            log.errorf(e, "Failed to process spans for tenant %s", tenantId);
        }
    }
}
```

## Security Requirements

### P0 (Blocking)

**1. Metrics Endpoint Authentication**
- `/q/metrics` MUST require mTLS or API token
- Rate limit: 10 requests/minute per IP
- Implementation:
```properties
quarkus.http.auth.basic=true
quarkus.security.users.embedded.enabled=true
quarkus.security.users.embedded.plain-text=true
quarkus.security.users.embedded.users.prometheus=<strong-token>
```

**2. PII Validation for Traces**
- Whitelist allowed span attributes: `trace.id`, `span.id`, `operation.name`, `duration.ms`, `tenant.id`
- Reject spans with attributes containing PII patterns (email, phone, SSN)
- Implementation:
```java
@ApplicationScoped
public class TraceValidator {
    private static final Set<String> ALLOWED_ATTRIBUTES = Set.of(
        "trace.id", "span.id", "operation.name", "duration.ms", "tenant.id"
    );

    public void validate(Span span) {
        for (String key : span.getAttributes().keySet()) {
            if (!ALLOWED_ATTRIBUTES.contains(key)) {
                throw new SecurityException("Disallowed attribute: " + key);
            }
        }
    }
}
```

**3. Tenant Isolation**
- ALL metrics MUST include `tenant_id` label
- OpenTelemetry resource attributes MUST include `tenant.id`
- Logs MUST include `tenantId` field

### P1 (Compliance)

**4. Log Scrubbing**
- Scrub secrets before logging: `password=.*`, `apiKey=.*`, `\d{16}` (credit cards)
- Implementation:
```java
public class LogScrubber {
    public static String scrub(String message) {
        return message
            .replaceAll("password=[^\\s]+", "password=***")
            .replaceAll("apiKey=[^\\s]+", "apiKey=***")
            .replaceAll("\\d{16}", "****");
    }
}
```

### P2 (Defense in Depth)

**5. Cardinality Limits**
- Max 10,000 unique label combinations per metric
- Aggregate high-cardinality dimensions (rule_id → rule_type)
- Drop metrics if cardinality exceeded

**6. Trace Sampling**
- Normal traffic: 1% sampling rate
- Error traces: 100% sampling
- Configuration:
```properties
quarkus.otel.traces.sampler=parentbased_traceidratio
quarkus.otel.traces.sampler.arg=0.01
```

## Performance Requirements

### Metrics Collection Overhead
- CPU overhead: <1% at 10,000 spans/sec
- Memory overhead: <50MB for metric registry
- Test:
```gherkin
Scenario: Metrics have minimal CPU overhead
  Given FLUO processes 10,000 spans/sec without metrics
  When I enable all metrics and repeat test
  Then CPU usage increases by <1%
```

### Trace Export Latency
- Span creation: <1ms
- Batch export: does not block request path
- Test:
```gherkin
Scenario: Trace export does not block requests
  Given OpenTelemetry batch exporter with 5s interval
  When FLUO receives 1000 concurrent requests
  Then no request latency exceeds P99 + 50ms
```

## Acceptance Criteria

### Functional Requirements

**Metrics:**
```gherkin
Scenario: Span counter increments correctly
  Given FLUO receives 100 spans via POST /api/spans
  When I query /q/metrics
  Then fluo.spans.received.total{tenant="test"} == 100

Scenario: Rule evaluation duration tracked
  Given a rule that sleeps 500ms
  When the rule processes 10 spans
  Then fluo.rules.evaluation.duration P99 >= 500ms

Scenario: Error metrics capture failures
  Given a rule that throws NullPointerException
  When the rule evaluates 5 traces
  Then fluo.rules.errors.total{type="NullPointerException"} == 5
```

**Traces:**
```gherkin
Scenario: Rule evaluation creates spans
  Given FLUO evaluates rule "high_latency"
  When I query Tempo for service.name=fluo
  Then I find span with operation.name="evaluate_rule"
  And span has attribute rule.id="high_latency"

Scenario: Traces include tenant context
  Given tenant "acme" sends spans
  When I query traces for tenant.id="acme"
  Then all spans have tenant.id="acme" attribute
```

**Logs:**
```gherkin
Scenario: Logs are structured JSON
  Given FLUO processes spans
  When I read application logs
  Then every log line is valid JSON
  And contains fields: timestamp, level, logger, message

Scenario: Logs include trace context
  Given span with traceId=abc123
  When FLUO processes the span
  Then logs contain {"traceId":"abc123"}
```

### Security Requirements

```gherkin
Scenario: Metrics endpoint requires auth
  Given Prometheus scraper without API token
  When scraper queries /q/metrics
  Then response is 401 Unauthorized

Scenario: PII in span attributes rejected
  Given span with attribute userId="12345"
  When FLUO processes the span
  Then SecurityException is thrown
  And fluo.errors.total{type="pii_violation"} increments

Scenario: Tenant isolation enforced
  Given tenant "acme" generates metrics
  When I query fluo.spans.received.total{tenant="acme"}
  Then value > 0
  And fluo.spans.received.total{tenant="other"} == 0
```

### Performance Requirements

```gherkin
Scenario: Cardinality limit enforced
  Given 10,000 unique tenants send spans
  When I check metric cardinality
  Then total unique label combinations < 50,000

Scenario: Trace sampling works
  Given 100,000 spans/sec ingestion rate
  When trace sampling is 1%
  Then ~1,000 spans/sec exported to Tempo
```

### Failure Scenarios

```gherkin
Scenario: Prometheus scrape failure does not crash
  Given Prometheus is unreachable
  When FLUO continues processing spans
  Then no errors are logged
  And metrics are buffered in memory

Scenario: Tempo collector offline
  Given Tempo is down
  When FLUO emits traces
  Then traces are queued with backpressure
  And FLUO does not OOM

Scenario: Malformed log message
  Given rule throws exception with message containing '"'
  When FLUO logs the error
  Then JSON is valid (quotes escaped)
```

## Testing Strategy

### Unit Tests

**MetricsService:**
```java
@Test
void recordSpanIngestion_incrementsCounter() {
    metrics.recordSpanIngestion("tenant1", 100, 5000);

    Counter counter = registry.find("fluo.spans.received.total")
        .tag("tenant_id", "tenant1")
        .counter();

    assertThat(counter.count()).isEqualTo(100);
}
```

**TraceValidator:**
```java
@Test
void validate_rejectsNonWhitelistedAttribute() {
    Span span = createSpan(Map.of("userId", "12345"));

    assertThatThrownBy(() -> validator.validate(span))
        .isInstanceOf(SecurityException.class)
        .hasMessageContaining("Disallowed attribute: userId");
}
```

**LogScrubber:**
```java
@Test
void scrub_removesPasswords() {
    String log = "User login: password=secret123";
    assertThat(LogScrubber.scrub(log))
        .isEqualTo("User login: password=***");
}
```

### Integration Tests

**Metrics Endpoint:**
```java
@QuarkusTest
class MetricsEndpointTest {
    @Test
    void metricsEndpoint_withoutAuth_returns401() {
        given()
            .when().get("/q/metrics")
            .then().statusCode(401);
    }

    @Test
    void metricsEndpoint_withValidToken_returns200() {
        given()
            .auth().basic("prometheus", System.getenv("PROM_TOKEN"))
            .when().get("/q/metrics")
            .then().statusCode(200);
    }
}
```

**OpenTelemetry:**
```java
@QuarkusTest
class TracingTest {
    @Inject InMemorySpanExporter spanExporter;

    @Test
    void ruleEvaluation_createsSpan() {
        service.evaluate("tenant1", "rule1", trace);

        List<SpanData> spans = spanExporter.getFinishedSpanItems();
        assertThat(spans).hasSize(1);
        assertThat(spans.get(0).getName()).isEqualTo("evaluate_rule");
        assertThat(spans.get(0).getAttributes().get("tenant.id")).isEqualTo("tenant1");
    }
}
```

### Performance Tests

**JMH Benchmark:**
```java
@State(Scope.Benchmark)
public class MetricsOverheadBench {
    @Benchmark
    public void processSpans_withMetrics(Blackhole bh) {
        service.processSpans(tenantId, spans);
        bh.consume(service);
    }

    @Benchmark
    public void processSpans_withoutMetrics(Blackhole bh) {
        serviceNoMetrics.processSpans(tenantId, spans);
        bh.consume(serviceNoMetrics);
    }
}
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/fluo/services/MetricsService.java`
- `backend/src/main/java/com/fluo/services/TraceValidator.java`
- `backend/src/main/java/com/fluo/util/LogScrubber.java`
- `backend/src/test/java/com/fluo/services/MetricsServiceTest.java`
- `backend/src/test/java/com/fluo/services/TraceValidatorTest.java`
- `backend/src/test/java/com/fluo/benchmarks/MetricsOverheadBench.java`

**Modified Files:**
- `backend/src/main/resources/application.properties` (OpenTelemetry config)
- `backend/pom.xml` (add Micrometer, OpenTelemetry dependencies)
- `backend/src/main/java/com/fluo/services/RuleEvaluationService.java` (add metrics/traces)
- `backend/src/main/java/com/fluo/routes/SpanApiRoute.java` (add metrics)

## Dependencies

**Maven:**
```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
</dependency>
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-opentelemetry</artifactId>
</dependency>
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-logging-json</artifactId>
</dependency>
```

## Success Criteria

- [ ] All key metrics implemented and tested
- [ ] OpenTelemetry tracing for core operations
- [ ] Structured JSON logging with correlation IDs
- [ ] Metrics endpoint requires authentication
- [ ] PII validation prevents leakage in traces
- [ ] All metrics include tenant_id label
- [ ] Log scrubbing removes secrets
- [ ] CPU overhead <1% at 10K spans/sec
- [ ] Test coverage >90% for metrics/tracing code
- [ ] Performance benchmarks pass
