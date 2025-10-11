# PRD-007e: Compliance Audit Logging (Validation Failures as Evidence)

**Parent PRD:** PRD-007 (API Input Validation & Rate Limiting)
**Unit:** E
**Priority:** P0
**Dependencies:**
- Unit A (Bean Validation Foundation) - validation errors
- Unit C (Rate Limiting) - rate limit violations
- Unit D (Request Sanitization) - injection attempts

## Scope

Emit SOC2 compliance evidence spans for validation failures, rate limit violations, and injection attempts. Integrate with FLUO's compliance evidence system to prove access controls and security monitoring (SOC2 CC6.1, CC7.1).

## Problem

Validation failures, rate limits, and injection attempts are security events that should be recorded as compliance evidence:
- **SOC2 CC6.1 (Logical Access Controls):** Must prove access controls are enforced
- **SOC2 CC7.1 (System Monitoring):** Must prove security events are detected and logged
- Currently, these events are only logged to application logs (not compliance-ready)

## Solution

### Compliance Span Emission for Security Events

**Integrate with existing compliance framework:**

```java
@Named("complianceAuditProcessor")
@ApplicationScoped
public class ComplianceAuditProcessor implements Processor {

    @Inject
    ComplianceSpanEmitter spanEmitter;

    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable exception = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        String userId = exchange.getIn().getHeader("userId", String.class);
        String endpoint = exchange.getIn().getHeader(Exchange.HTTP_URI, String.class);

        if (exception instanceof ConstraintViolationException cve) {
            emitValidationFailureEvidence(cve, tenantId, userId, endpoint);
        } else if (exception instanceof RateLimitExceededException rle) {
            emitRateLimitViolationEvidence(rle, tenantId, userId, endpoint);
        } else if (exception instanceof InjectionAttemptException iae) {
            emitInjectionAttemptEvidence(iae, tenantId, userId, endpoint);
        }
    }

    private void emitValidationFailureEvidence(
        ConstraintViolationException exception,
        UUID tenantId,
        String userId,
        String endpoint
    ) {
        ComplianceSpan span = ComplianceSpan.builder()
            .framework("soc2")
            .control("CC6.1")  // Logical Access Controls
            .evidenceType(EvidenceType.AUDIT_TRAIL)
            .tenantId(tenantId)
            .userId(userId)
            .outcome("blocked")
            .attributes(Map.of(
                "event_type", "validation_failure",
                "endpoint", endpoint,
                "violations", formatViolations(exception.getConstraintViolations()),
                "timestamp", Instant.now().toString()
            ))
            .build();

        spanEmitter.emit(span);
    }

    private void emitRateLimitViolationEvidence(
        RateLimitExceededException exception,
        UUID tenantId,
        String userId,
        String endpoint
    ) {
        ComplianceSpan span = ComplianceSpan.builder()
            .framework("soc2")
            .control("CC6.1")  // Logical Access Controls (rate limiting is access control)
            .evidenceType(EvidenceType.AUDIT_TRAIL)
            .tenantId(tenantId)
            .userId(userId)
            .outcome("blocked")
            .attributes(Map.of(
                "event_type", "rate_limit_exceeded",
                "endpoint", endpoint,
                "retry_after_seconds", exception.getRetryAfterSeconds(),
                "timestamp", Instant.now().toString()
            ))
            .build();

        spanEmitter.emit(span);
    }

    private void emitInjectionAttemptEvidence(
        InjectionAttemptException exception,
        UUID tenantId,
        String userId,
        String endpoint
    ) {
        ComplianceSpan span = ComplianceSpan.builder()
            .framework("soc2")
            .control("CC7.1")  // System Monitoring (detecting security threats)
            .evidenceType(EvidenceType.SECURITY_EVENT)
            .tenantId(tenantId)
            .userId(userId)
            .outcome("blocked")
            .attributes(Map.of(
                "event_type", "injection_attempt",
                "endpoint", endpoint,
                "injection_type", exception.getMessage(),
                "timestamp", Instant.now().toString(),
                "severity", "critical"  // Injection attempts are critical security events
            ))
            .build();

        spanEmitter.emit(span);
    }

    private String formatViolations(Set<ConstraintViolation<?>> violations) {
        return violations.stream()
            .map(v -> v.getPropertyPath() + ": " + v.getMessage())
            .collect(Collectors.joining("; "));
    }
}
```

### Compliance Span Emitter Service

```java
@ApplicationScoped
public class ComplianceSpanEmitter {

    private static final Logger LOG = Logger.getLogger(ComplianceSpanEmitter.class);

    @Inject
    @ConfigProperty(name = "fluo.compliance.enabled", defaultValue = "true")
    boolean complianceEnabled;

    /**
     * Emit compliance span as OpenTelemetry span.
     * Spans are exported to configured OTLP endpoint.
     */
    public void emit(ComplianceSpan complianceSpan) {
        if (!complianceEnabled) {
            LOG.debug("Compliance span emission disabled");
            return;
        }

        // Convert ComplianceSpan to OpenTelemetry span
        Span otelSpan = GlobalOpenTelemetry.getTracer("fluo-compliance")
            .spanBuilder("compliance.evidence")
            .setSpanKind(SpanKind.INTERNAL)
            .startSpan();

        try (Scope scope = otelSpan.makeCurrent()) {
            // Set compliance attributes
            otelSpan.setAttribute("compliance.framework", complianceSpan.framework());
            otelSpan.setAttribute("compliance.control", complianceSpan.control());
            otelSpan.setAttribute("compliance.evidence_type", complianceSpan.evidenceType().name());
            otelSpan.setAttribute("compliance.tenant_id", complianceSpan.tenantId().toString());
            otelSpan.setAttribute("compliance.outcome", complianceSpan.outcome());

            if (complianceSpan.userId() != null) {
                otelSpan.setAttribute("compliance.user_id", complianceSpan.userId());
            }

            // Set event-specific attributes
            complianceSpan.attributes().forEach((key, value) -> {
                otelSpan.setAttribute("compliance." + key, value.toString());
            });

            LOG.info("Emitted compliance span: framework={}, control={}, event={}",
                complianceSpan.framework(),
                complianceSpan.control(),
                complianceSpan.attributes().get("event_type")
            );
        } finally {
            otelSpan.end();
        }
    }
}
```

### Camel Route Integration

**Update error handlers to emit compliance spans:**

```java
@ApplicationScoped
public class RuleApiRoutes extends RouteBuilder {

    @Override
    public void configure() {
        // Validation failure error handler with compliance logging
        onException(ConstraintViolationException.class)
            .handled(true)
            .process("complianceAuditProcessor")  // Emit compliance span
            .process("validationErrorProcessor")
            .marshal().json()
            .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(400));

        // Rate limit error handler with compliance logging
        onException(RateLimitExceededException.class)
            .handled(true)
            .process("complianceAuditProcessor")  // Emit compliance span
            .process("rateLimitErrorProcessor")
            .marshal().json();

        // Injection attempt error handler with compliance logging
        onException(InjectionAttemptException.class)
            .handled(true)
            .process("complianceAuditProcessor")  // Emit compliance span
            .process("injectionAttemptErrorProcessor")
            .marshal().json();
    }
}
```

### Compliance Evidence Queries

**Grafana TraceQL queries for auditors:**

```traceql
# Query all validation failures for a tenant
{
  span.compliance.framework = "soc2" &&
  span.compliance.control = "CC6.1" &&
  span.compliance.event_type = "validation_failure" &&
  span.compliance.tenant_id = "tenant-uuid"
}

# Query rate limit violations
{
  span.compliance.framework = "soc2" &&
  span.compliance.control = "CC6.1" &&
  span.compliance.event_type = "rate_limit_exceeded"
}

# Query injection attempts (critical security events)
{
  span.compliance.framework = "soc2" &&
  span.compliance.control = "CC7.1" &&
  span.compliance.event_type = "injection_attempt"
}
```

**Prometheus metrics for compliance dashboards:**

```promql
# Validation failure rate by tenant
sum by (compliance_tenant_id) (
  rate(traces_spanmetrics_calls_total{
    compliance_framework="soc2",
    compliance_control="CC6_1",
    compliance_event_type="validation_failure"
  }[5m])
)

# Injection attempt count (should be zero in production)
sum(
  traces_spanmetrics_calls_total{
    compliance_framework="soc2",
    compliance_control="CC7_1",
    compliance_event_type="injection_attempt"
  }
)
```

## Files to Create

### Compliance Processors
- `backend/src/main/java/com/fluo/processors/compliance/ComplianceAuditProcessor.java`
- `backend/src/main/java/com/fluo/services/ComplianceSpanEmitter.java`

### Tests
- `backend/src/test/java/com/fluo/processors/compliance/ComplianceAuditProcessorTest.java`
- `backend/src/test/java/com/fluo/services/ComplianceSpanEmitterTest.java`
- `backend/src/test/java/com/fluo/routes/ComplianceAuditIntegrationTest.java`

## Files to Modify

- `backend/src/main/java/com/fluo/routes/RuleApiRoute.java` - Add compliance audit processor to error handlers
- `backend/src/main/java/com/fluo/routes/SpanApiRoute.java` - Add compliance audit processor to error handlers
- `backend/src/main/resources/application.properties` - Add compliance configuration

## Success Criteria

- [ ] Validation failures emit SOC2 CC6.1 compliance spans
- [ ] Rate limit violations emit SOC2 CC6.1 compliance spans
- [ ] Injection attempts emit SOC2 CC7.1 compliance spans
- [ ] Compliance spans include tenant ID, user ID, endpoint, timestamp
- [ ] Compliance spans queryable via Grafana/TraceQL
- [ ] Prometheus metrics available for compliance dashboards
- [ ] Test coverage: 90%+ instruction coverage per ADR-014

## Testing Requirements

### Unit Tests

**Compliance Audit Processor:**
```java
@Test
@DisplayName("Should emit compliance span for validation failure")
void testEmitValidationFailureSpan() throws Exception {
    ConstraintViolationException exception = createMockValidationException();
    UUID tenantId = UUID.randomUUID();
    String userId = "user@example.com";

    Exchange exchange = new DefaultExchange(new DefaultCamelContext());
    exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
    exchange.getIn().setHeader("tenantId", tenantId);
    exchange.getIn().setHeader("userId", userId);
    exchange.getIn().setHeader(Exchange.HTTP_URI, "/api/rules");

    complianceAuditProcessor.process(exchange);

    verify(mockSpanEmitter).emit(argThat(span ->
        span.framework().equals("soc2") &&
        span.control().equals("CC6.1") &&
        span.evidenceType() == EvidenceType.AUDIT_TRAIL &&
        span.outcome().equals("blocked") &&
        span.attributes().get("event_type").equals("validation_failure")
    ));
}

@Test
@DisplayName("Should emit compliance span for rate limit violation")
void testEmitRateLimitViolationSpan() throws Exception {
    RateLimitExceededException exception = new RateLimitExceededException("Rate limit exceeded", 30);
    UUID tenantId = UUID.randomUUID();

    Exchange exchange = new DefaultExchange(new DefaultCamelContext());
    exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
    exchange.getIn().setHeader("tenantId", tenantId);
    exchange.getIn().setHeader(Exchange.HTTP_URI, "/api/signals");

    complianceAuditProcessor.process(exchange);

    verify(mockSpanEmitter).emit(argThat(span ->
        span.framework().equals("soc2") &&
        span.control().equals("CC6.1") &&
        span.attributes().get("event_type").equals("rate_limit_exceeded") &&
        span.attributes().get("retry_after_seconds").equals(30L)
    ));
}

@Test
@DisplayName("Should emit compliance span for injection attempt")
void testEmitInjectionAttemptSpan() throws Exception {
    InjectionAttemptException exception = new InjectionAttemptException("SQL injection pattern detected");
    UUID tenantId = UUID.randomUUID();
    String userId = "attacker@example.com";

    Exchange exchange = new DefaultExchange(new DefaultCamelContext());
    exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
    exchange.getIn().setHeader("tenantId", tenantId);
    exchange.getIn().setHeader("userId", userId);
    exchange.getIn().setHeader(Exchange.HTTP_URI, "/api/rules");

    complianceAuditProcessor.process(exchange);

    verify(mockSpanEmitter).emit(argThat(span ->
        span.framework().equals("soc2") &&
        span.control().equals("CC7.1") &&  // Security monitoring
        span.evidenceType() == EvidenceType.SECURITY_EVENT &&
        span.attributes().get("event_type").equals("injection_attempt") &&
        span.attributes().get("severity").equals("critical")
    ));
}
```

**Compliance Span Emitter:**
```java
@Test
@DisplayName("Should emit OpenTelemetry span with compliance attributes")
void testEmitComplianceSpan() {
    ComplianceSpan complianceSpan = ComplianceSpan.builder()
        .framework("soc2")
        .control("CC6.1")
        .evidenceType(EvidenceType.AUDIT_TRAIL)
        .tenantId(UUID.randomUUID())
        .userId("user@example.com")
        .outcome("blocked")
        .attributes(Map.of(
            "event_type", "validation_failure",
            "endpoint", "/api/rules"
        ))
        .build();

    complianceSpanEmitter.emit(complianceSpan);

    // Verify OpenTelemetry span was created (requires OpenTelemetry test framework)
    // This is a simplified test - real test would use OpenTelemetry's testing utilities
    verify(mockTracer).spanBuilder("compliance.evidence");
}

@Test
@DisplayName("Should not emit span when compliance disabled")
void testComplianceDisabled() {
    complianceSpanEmitter.complianceEnabled = false;

    ComplianceSpan span = ComplianceSpan.builder()
        .framework("soc2")
        .control("CC6.1")
        .evidenceType(EvidenceType.AUDIT_TRAIL)
        .tenantId(UUID.randomUUID())
        .outcome("blocked")
        .attributes(Map.of())
        .build();

    complianceSpanEmitter.emit(span);

    verify(mockTracer, never()).spanBuilder(any());
}
```

### Integration Tests

**End-to-End Compliance Span Emission:**
```java
@Test
@DisplayName("Should emit compliance span when validation fails via route")
void testComplianceSpanEmittedForValidationFailure() throws Exception {
    String invalidJson = """
        {
            "name": "",
            "expression": "trace.has(error)",
            "severity": "HIGH",
            "tenantId": "%s"
        }
        """.formatted(UUID.randomUUID());

    Exchange response = template.request("direct:createRule", exchange -> {
        exchange.getIn().setBody(invalidJson);
    });

    assertEquals(400, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));

    // Verify compliance span was emitted
    verify(mockSpanEmitter, timeout(1000)).emit(argThat(span ->
        span.framework().equals("soc2") &&
        span.control().equals("CC6.1") &&
        span.attributes().get("event_type").equals("validation_failure")
    ));
}

@Test
@DisplayName("Should emit compliance span when rate limit exceeded via route")
void testComplianceSpanEmittedForRateLimit() throws Exception {
    UUID tenantId = UUID.randomUUID();

    // Exhaust rate limit
    for (int i = 0; i < 1001; i++) {
        template.send("direct:createRule", exchange -> {
            exchange.getIn().setHeader("tenantId", tenantId);
        });
    }

    // Verify compliance span emitted for rate limit violation
    verify(mockSpanEmitter, atLeastOnce()).emit(argThat(span ->
        span.framework().equals("soc2") &&
        span.control().equals("CC6.1") &&
        span.attributes().get("event_type").equals("rate_limit_exceeded")
    ));
}

@Test
@DisplayName("Should emit compliance span when injection attempt detected via route")
void testComplianceSpanEmittedForInjectionAttempt() throws Exception {
    String maliciousJson = """
        {
            "name": "Rule'; DROP TABLE users--",
            "expression": "trace.has(error)",
            "severity": "HIGH",
            "tenantId": "%s"
        }
        """.formatted(UUID.randomUUID());

    Exchange response = template.request("direct:createRule", exchange -> {
        exchange.getIn().setBody(maliciousJson);
    });

    assertEquals(400, response.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));

    // Verify compliance span emitted for injection attempt
    verify(mockSpanEmitter, timeout(1000)).emit(argThat(span ->
        span.framework().equals("soc2") &&
        span.control().equals("CC7.1") &&
        span.attributes().get("event_type").equals("injection_attempt")
    ));
}
```

## Configuration

**application.properties:**
```properties
# Compliance evidence emission
fluo.compliance.enabled=true

# OpenTelemetry exporter for compliance spans
quarkus.otel.exporter.otlp.endpoint=http://localhost:4317
quarkus.otel.traces.exporter=otlp
```

## Architecture Compliance

- **ADR-013 (Camel-First):** Compliance audit implemented as Camel processor
- **ADR-014 (Named Processors):** `ComplianceAuditProcessor` extracted as named CDI bean
- **ADR-011 (Pure Application):** No deployment-specific compliance logic
- **ADR-015 (Testing Standards):** 90%+ test coverage with unit and integration tests

## Compliance Notes

**SOC2 Controls Covered:**
- **CC6.1 (Logical Access Controls):** Validation failures and rate limits prove access controls are enforced
- **CC7.1 (System Monitoring):** Injection attempts prove security threats are detected and logged

**Evidence Value:**
- Auditors can query all validation failures for a tenant over the audit period
- Injection attempts (if any) demonstrate security monitoring is working
- Rate limit violations show fair resource allocation and DoS protection

**Security Gaps (from @docs/compliance-status.md):**
- ⚠️ P0: Compliance spans need cryptographic signatures (tamper-evidence) - NOT implemented in this unit
- ⚠️ P1: PII redaction enforcement - NOT implemented in this unit
- This unit provides **evidence generation**, not integrity guarantees

## Integration with FLUO Compliance Framework

This unit integrates with existing FLUO compliance components:
- **ComplianceSpan** (from `backend/src/main/java/com/fluo/compliance/evidence/ComplianceSpan.java`)
- **EvidenceType** (from `backend/src/main/java/com/fluo/compliance/evidence/EvidenceType.java`)
- **@SOC2 annotations** (from `compliance-as-code` flake integration)

## Notes

- Compliance spans are emitted as OpenTelemetry spans (queryable via Grafana)
- All security events (validation, rate limiting, injection) generate audit trail
- Spans include tenant ID for per-tenant compliance reporting
- This unit does NOT implement span signatures (see compliance-status.md P0 gaps)
