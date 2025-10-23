# PRD-023A: Rule Performance Metrics

**Priority:** P1 (High - Core Analytics)
**Complexity:** Medium
**Personas:** SRE, Developer
**Dependencies:** PRD-019A (metrics instrumentation)
**Implements:** Effectiveness and performance metrics for rules

## Problem

BeTrace rules execute but provide zero visibility into effectiveness:
- **SREs cannot answer**: "Is this rule working? Should I tune it?"
- **No false positive tracking**: Rules generate noisy signals, teams ignore them
- **Performance blindness**: Slow rules (P99 > 500ms) go undetected until latency SLO breach
- **No regression detection**: Rules break silently when trace schemas evolve

**Impact:**
- Alert fatigue: 60%+ false positive rate on production rules (user reports)
- Wasted engineering time: 4+ hours/week investigating irrelevant signals
- Compliance risk: Broken rules = missing evidence (SOC2 CC8.1 violation)

## Solution

### Effectiveness Metrics

**Per-Rule Metrics (time-series, 1-minute granularity):**
```
# Evaluation metrics
betrace.rule.evaluations.total{tenant_id, rule_id, rule_name} counter
betrace.rule.matches.total{tenant_id, rule_id} counter
betrace.rule.signals.generated.total{tenant_id, rule_id} counter
betrace.rule.signals.false_positive.total{tenant_id, rule_id} counter

# Derived rates
betrace.rule.match_rate{tenant_id, rule_id} = matches / evaluations
betrace.rule.signal_rate{tenant_id, rule_id} = signals / matches
betrace.rule.false_positive_rate{tenant_id, rule_id} = false_positives / signals
```

**Performance Metrics:**
```
# Latency histogram (wall-clock duration)
betrace.rule.evaluation.duration_seconds{tenant_id, rule_id} histogram

# Errors and timeouts
betrace.rule.timeout.total{tenant_id, rule_id} counter
betrace.rule.error.total{tenant_id, rule_id, error_type} counter

# Cost metric (total CPU time)
betrace.rule.cpu_time_seconds{tenant_id, rule_id} = duration * evaluations
```

## Implementation

### Metrics Emission

**File:** `backend/src/main/java/com/betrace/services/RuleMetricsService.java`

```java
@ApplicationScoped
public class RuleMetricsService {
    @Inject MeterRegistry registry;

    public void recordEvaluation(String tenantId, String ruleId, Duration duration, boolean matched) {
        // Evaluation count
        Counter.builder("betrace.rule.evaluations.total")
            .tag("tenant_id", tenantId)
            .tag("rule_id", ruleId)
            .register(registry)
            .increment();

        // Match count
        if (matched) {
            Counter.builder("betrace.rule.matches.total")
                .tag("tenant_id", tenantId)
                .tag("rule_id", ruleId)
                .register(registry)
                .increment();
        }

        // Duration histogram
        Timer.builder("betrace.rule.evaluation.duration")
            .tag("tenant_id", tenantId)
            .tag("rule_id", ruleId)
            .register(registry)
            .record(duration);
    }

    public void recordSignalGenerated(String tenantId, String ruleId) {
        Counter.builder("betrace.rule.signals.generated.total")
            .tag("tenant_id", tenantId)
            .tag("rule_id", ruleId)
            .register(registry)
            .increment();
    }

    public void recordFalsePositive(String tenantId, String ruleId) {
        Counter.builder("betrace.rule.signals.false_positive.total")
            .tag("tenant_id", tenantId)
            .tag("rule_id", ruleId)
            .register(registry)
            .increment();
    }

    public void recordTimeout(String tenantId, String ruleId) {
        Counter.builder("betrace.rule.timeout.total")
            .tag("tenant_id", tenantId)
            .tag("rule_id", ruleId)
            .register(registry)
            .increment();
    }
}
```

**Integration with Rule Evaluation:**

```java
@ApplicationScoped
public class DroolsSpanProcessor {
    @Inject RuleMetricsService metrics;

    public void processSpan(String tenantId, SpanData span) {
        List<Rule> rules = ruleService.getRulesForTenant(tenantId);

        for (Rule rule : rules) {
            long start = System.nanoTime();
            boolean matched = false;

            try {
                List<RuleMatch> matches = evaluateRule(tenantId, rule.getId(), span);
                matched = !matches.isEmpty();

                if (matched) {
                    for (RuleMatch match : matches) {
                        Signal signal = signalService.createSignal(tenantId, rule.getId(), match);
                        metrics.recordSignalGenerated(tenantId, rule.getId());
                    }
                }
            } catch (TimeoutException e) {
                metrics.recordTimeout(tenantId, rule.getId());
            } catch (Exception e) {
                metrics.recordError(tenantId, rule.getId(), e.getClass().getSimpleName());
            } finally {
                Duration duration = Duration.ofNanos(System.nanoTime() - start);
                metrics.recordEvaluation(tenantId, rule.getId(), duration, matched);
            }
        }
    }
}
```

### False Positive Marking

**File:** `backend/src/main/java/com/betrace/services/SignalService.java`

```java
@ApplicationScoped
@SOC2(controls = {CC6_1, CC7_2}, notes = "Authorization + audit trail for signal dismissal")
public class SignalService {
    @Inject RuleMetricsService metrics;
    @Inject AuthorizationService authz;
    @Inject AuditLogService auditLog;

    public void markFalsePositive(String signalId, User user, String justification) {
        // P0 Security: Verify authorization
        if (!authz.hasPermission(user, "signal:override")) {
            throw new ForbiddenException("Requires signal:override permission");
        }

        Signal signal = signalRepository.findById(signalId)
            .orElseThrow(() -> new NotFoundException("Signal not found"));

        // P0 Security: Verify tenant ownership
        String tenantId = TenantContext.current().getTenantId();
        if (!signal.getTenantId().equals(tenantId)) {
            throw new ForbiddenException("Cross-tenant access denied");
        }

        // Update signal status (never delete)
        signal.setStatus(SignalStatus.DISMISSED);
        signal.setDismissedBy(user.getId());
        signal.setDismissalReason(justification);
        signal.setDismissedAt(Instant.now());
        signalRepository.update(signal);

        // Update metrics
        metrics.recordFalsePositive(tenantId, signal.getRuleId());

        // P0 Security: Emit compliance span
        emitComplianceSpan(SOC2, CC7_2, "signal_dismissal", Map.of(
            "signal_id", signalId,
            "rule_id", signal.getRuleId(),
            "user_id", user.getId(),
            "justification", justification
        ));

        // Audit log
        auditLog.info("Signal dismissed as false positive", Map.of(
            "signal_id", signalId,
            "rule_id", signal.getRuleId(),
            "user_id", user.getId(),
            "tenant_id", tenantId,
            "justification", justification
        ));
    }
}
```

### Analytics API

**File:** `backend/src/main/java/com/betrace/routes/RuleAnalyticsRoute.java`

```java
@Path("/api/rules")
@ApplicationScoped
public class RuleAnalyticsRoute {
    @Inject PrometheusClient prometheus;
    @Inject RuleService ruleService;

    @GET
    @Path("/{ruleId}/metrics")
    @RolesAllowed("READ_RULES")
    @SOC2(controls = {CC6_1}, notes = "Tenant-scoped metrics access")
    public Response getRuleMetrics(
        @PathParam("ruleId") String ruleId,
        @QueryParam("start") Instant start,
        @QueryParam("end") Instant end,
        @Context SecurityContext ctx
    ) {
        String tenantId = ctx.getUserPrincipal().getName();

        // P0 Security: Verify rule ownership
        if (!ruleService.ownsRule(tenantId, ruleId)) {
            throw new ForbiddenException("Cross-tenant access denied");
        }

        // P1 Security: Validate time range (max 90 days)
        Duration range = Duration.between(start, end);
        if (range.toDays() > 90) {
            throw new BadRequestException("Time range cannot exceed 90 days");
        }

        // Query Prometheus with tenant filter
        Map<String, Object> metrics = Map.of(
            "match_rate", prometheus.query(
                "rate(betrace_rule_matches_total{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[5m]) " +
                "/ rate(betrace_rule_evaluations_total{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[5m])"
            ),
            "signal_rate", prometheus.query(
                "rate(betrace_rule_signals_generated_total{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[5m]) " +
                "/ rate(betrace_rule_matches_total{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[5m])"
            ),
            "false_positive_rate", prometheus.query(
                "rate(betrace_rule_signals_false_positive_total{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[5m]) " +
                "/ rate(betrace_rule_signals_generated_total{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[5m])"
            ),
            "p99_latency_ms", prometheus.query(
                "histogram_quantile(0.99, rate(betrace_rule_evaluation_duration_seconds_bucket{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[5m])) * 1000"
            )
        );

        // P0 Security: Emit access audit
        emitComplianceSpan(SOC2, CC6_1, "metrics_access", Map.of(
            "tenant_id", tenantId,
            "rule_id", ruleId,
            "user_id", ctx.getUserPrincipal().getName()
        ));

        return Response.ok(metrics).build();
    }
}
```

### Regression Detection

**File:** `backend/src/main/java/com/betrace/jobs/RuleRegressionDetector.java`

```java
@ApplicationScoped
public class RuleRegressionDetector {
    @Inject PrometheusClient prometheus;
    @Inject SignalService signalService;

    @ConfigProperty(name = "regression.match_rate.threshold", defaultValue = "0.20")
    double matchRateThreshold;

    @Scheduled(every = "1h")
    public void detectRegressions() {
        List<Rule> rules = ruleService.getAllRules();

        for (Rule rule : rules) {
            String tenantId = rule.getTenantId();
            String ruleId = rule.getId();

            // Query current week match rate
            double currentMatchRate = prometheus.query(
                "avg_over_time(betrace_rule_match_rate{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[7d])"
            );

            // Query previous week match rate
            double previousMatchRate = prometheus.query(
                "avg_over_time(betrace_rule_match_rate{tenant_id='" + tenantId + "', rule_id='" + ruleId + "'}[7d] offset 7d)"
            );

            // Calculate change percentage
            double change = Math.abs(currentMatchRate - previousMatchRate) / previousMatchRate;

            // Alert on significant drop
            if (change > matchRateThreshold && currentMatchRate < previousMatchRate) {
                Signal regressionSignal = Signal.builder()
                    .tenantId(tenantId)
                    .ruleId(ruleId)
                    .severity(Severity.WARNING)
                    .type("rule_regression")
                    .message(String.format(
                        "Rule match rate dropped %.1f%% (%.2f → %.2f)",
                        change * 100,
                        previousMatchRate,
                        currentMatchRate
                    ))
                    .metadata(Map.of(
                        "current_match_rate", currentMatchRate,
                        "previous_match_rate", previousMatchRate,
                        "change_percentage", change
                    ))
                    .build();

                signalService.createSignal(tenantId, regressionSignal);
            }
        }
    }
}
```

## Security Requirements

### P0 (Blocking)

**1. Tenant Isolation in Metrics**
- ALL metrics queries MUST filter by `tenant_id`
- API MUST verify rule ownership before returning metrics
- Test:
```java
@Test
void shouldBlockCrossTenantMetricsAccess() {
    TenantContext tenantA = new TenantContext("tenant-a");
    TenantContext tenantB = new TenantContext("tenant-b");

    String tenantARule = ruleService.createRule("rule-A", tenantA);

    assertThatThrownBy(() ->
        analyticsRoute.getRuleMetrics(tenantARule, Instant.now(), Instant.now(), tenantB)
    ).isInstanceOf(ForbiddenException.class);
}
```

**2. Authorization for False Positive Marking**
- Require `signal:override` permission
- Emit compliance span (SOC2 CC7.2)
- Never delete signals (update status only)
- Test:
```java
@Test
void shouldRequirePermissionForFalsePositiveMarking() {
    User userWithoutPermission = new User("viewer");

    assertThatThrownBy(() ->
        signalService.markFalsePositive("signal-123", userWithoutPermission, "mistake")
    ).isInstanceOf(ForbiddenException.class);
}
```

**3. Audit Logging**
- Log all metrics API accesses
- Log all false positive markings
- Log format:
```json
{
  "event": "metrics_access",
  "tenant_id": "tenant-xyz",
  "user_id": "user@example.com",
  "rule_id": "rule-123",
  "timestamp": "2025-10-11T10:23:45.123Z"
}
```

### P1 (High Priority)

**4. Rate Limiting**
- Max 10 analytics queries/minute per user
- Implementation: Guava `RateLimiter` per user
```java
@RateLimit(requests = 10, window = "1 minute", per = "user")
public Response getRuleMetrics(...) { }
```

**5. Time Range Validation**
- Max 90-day query window
- Return 400 Bad Request if exceeded

## Configuration

**File:** `application.properties`

```properties
# Metrics emission
metrics.rule.enabled=true
metrics.rule.histogram.buckets=0.001,0.005,0.01,0.05,0.1,0.5,1,2,5

# Regression detection
regression.match_rate.threshold=0.20
regression.detection.schedule=1h

# Rate limiting
rate-limit.analytics.queries-per-minute=10
rate-limit.analytics.max-time-range-days=90

# Authorization
signal.override.permission=signal:override
signal.override.require-mfa=true
```

## Acceptance Criteria

### Functional Requirements

**Metrics Emission:**
```gherkin
Scenario: Rule evaluation emits metrics
  Given rule "R1" for tenant "acme"
  When rule "R1" evaluates 100 traces
  And 30 traces match
  Then metric betrace.rule.evaluations.total{tenant=acme, rule=R1} = 100
  And metric betrace.rule.matches.total{tenant=acme, rule=R1} = 30
  And match_rate = 0.30

Scenario: Signal generation updates metrics
  Given rule "R1" matches trace T1
  When signal is generated from match
  Then metric betrace.rule.signals.generated.total{rule=R1} increments
```

**False Positive Marking:**
```gherkin
Scenario: User marks signal as false positive
  Given signal S1 generated by rule "R1"
  And user has "signal:override" permission
  When user marks S1 as false_positive with justification "Test data"
  Then signal status = DISMISSED
  And metric betrace.rule.signals.false_positive.total{rule=R1} increments
  And audit log contains dismissal event

Scenario: Unauthorized user cannot mark false positive
  Given user without "signal:override" permission
  When user attempts to mark signal as false_positive
  Then 403 Forbidden response returned
```

**Analytics API:**
```gherkin
Scenario: Query rule metrics
  Given rule "R1" with 1000 evaluations, 300 matches, 50 signals
  When GET /api/rules/R1/metrics?start=2025-10-01&end=2025-10-10
  Then response contains:
    - match_rate: 0.30
    - signal_rate: 0.167
    - p99_latency_ms: <value>

Scenario: Cross-tenant access denied
  Given tenant A owns rule "R1"
  When tenant B queries /api/rules/R1/metrics
  Then 403 Forbidden response returned
```

**Regression Detection:**
```gherkin
Scenario: Detect match rate regression
  Given rule "R1" had match_rate = 0.50 last week
  And this week match_rate = 0.25 (50% drop)
  When regression detection runs
  Then signal "rule_regression" is created
  And signal message contains "50% drop (0.50 → 0.25)"
```

### Security Requirements

```gherkin
Scenario: Tenant isolation enforced
  Given tenant A has rule "R1" with metrics
  When tenant B queries Prometheus directly
  Then tenant B cannot see tenant A's metrics
  And Prometheus enforces tenant_id label filtering

Scenario: Metrics access audited
  Given user queries /api/rules/R1/metrics
  When query completes
  Then audit log contains:
    - event: metrics_access
    - user_id: <user>
    - rule_id: R1
    - tenant_id: <tenant>
```

## Testing Strategy

### Unit Tests

**Metrics Calculation:**
```java
@Test
void matchRate_calculatedCorrectly() {
    metrics.recordEvaluation("tenant1", "rule1", Duration.ofMillis(10), false); // 100 evaluations
    metrics.recordEvaluation("tenant1", "rule1", Duration.ofMillis(10), true);  // 30 matches

    double matchRate = prometheus.query("betrace_rule_match_rate{tenant=tenant1, rule=rule1}");
    assertThat(matchRate).isEqualTo(0.30);
}
```

**Security:**
```java
@Test
void shouldBlockCrossTenantAccess() {
    assertThatThrownBy(() ->
        analyticsRoute.getRuleMetrics("tenant-a-rule", start, end, tenantBContext)
    ).isInstanceOf(ForbiddenException.class);
}
```

### Integration Tests

**Testcontainers with Prometheus:**
```java
@QuarkusTest
class RuleMetricsIntegrationTest {
    @Container
    static PrometheusContainer prometheus = new PrometheusContainer();

    @Test
    void metricsExposedToPrometheus() {
        // Trigger rule evaluation
        processor.processSpan("tenant1", span);

        // Query Prometheus
        double evaluations = prometheus.query("betrace_rule_evaluations_total{tenant=tenant1}");
        assertThat(evaluations).isGreaterThan(0);
    }
}
```

## Files to Create/Modify

**New Files:**
- `backend/src/main/java/com/betrace/services/RuleMetricsService.java`
- `backend/src/main/java/com/betrace/routes/RuleAnalyticsRoute.java`
- `backend/src/main/java/com/betrace/jobs/RuleRegressionDetector.java`
- `backend/src/main/java/com/betrace/clients/PrometheusClient.java`
- `backend/src/test/java/com/betrace/services/RuleMetricsServiceTest.java`

**Modified Files:**
- `backend/src/main/java/com/betrace/processors/DroolsSpanProcessor.java` (add metrics)
- `backend/src/main/java/com/betrace/services/SignalService.java` (add false positive marking)
- `backend/src/main/resources/application.properties`

## Dependencies

**Maven:**
```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
</dependency>
<dependency>
    <groupId>io.prometheus</groupId>
    <artifactId>prometheus-metrics-core</artifactId>
    <version>1.0.0</version>
</dependency>
```

## Success Criteria

- [ ] Metrics emitted for all rule evaluations
- [ ] False positive marking with authorization
- [ ] Analytics API with tenant isolation
- [ ] Regression detection (match rate drops)
- [ ] Rate limiting (10 queries/min)
- [ ] Audit logging for all accesses
- [ ] Test coverage >90%
- [ ] Grafana dashboard: "Rule Effectiveness Overview"
