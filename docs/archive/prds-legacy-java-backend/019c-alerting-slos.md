# PRD-019C: Alerting & SLOs

**Priority:** P2 (After dashboards proven)
**Complexity:** Medium
**Personas:** SRE, On-Call
**Dependencies:** PRD-019A (metrics), PRD-019B (dashboards)
**Implements:** Prometheus alerts and service level objectives

## Problem

BeTrace has metrics and dashboards but no proactive alerting:
- SREs discover issues by accident (user reports, manual dashboard checks)
- No defined service level objectives (availability, latency)
- No runbooks for common failure scenarios
- No integration with incident management (PagerDuty, Slack)

## Solution

### Alert Rule Categories

**1. Availability Alerts**
- Service down (API returning 5xx)
- Database connection pool exhausted
- WebSocket server unreachable

**2. Performance Alerts**
- High rule evaluation latency (P99 > 2s)
- Database query slowness (P95 > 500ms)
- Memory pressure (>85% heap used)

**3. Operational Alerts**
- High error rate (>1% of requests)
- WebSocket disconnect storm (>50 disconnects/min)
- Tenant ingestion spike (>10x normal rate)

**4. Compliance Alerts**
- PII validation failures (spans rejected)
- Missing audit logs (compliance spans not generated)

### Service Level Objectives (SLOs)

**Availability SLO:** 99.9% uptime
- Error budget: 43 minutes/month
- Measured by: `rate(betrace_http_requests_total{status=~"5.."}[5m]) / rate(betrace_http_requests_total[5m]) < 0.001`

**Latency SLO:** P99 rule evaluation < 1s
- Error budget: 0.1% of requests can exceed 1s
- Measured by: `histogram_quantile(0.99, rate(betrace_rules_evaluation_duration_bucket[5m])) < 1000`

**Correctness SLO:** 99.99% signal accuracy
- Error budget: 1 false positive per 10,000 signals
- Measured by: Manual review (no automated metric)

## Implementation

### Prometheus Alert Rules

**File:** `prometheus/alerts/betrace.yml`

```yaml
groups:
  - name: betrace_availability
    interval: 30s
    rules:
      - alert: BeTraceServiceDown
        expr: up{job="betrace"} == 0
        for: 1m
        labels:
          severity: critical
          component: api
        annotations:
          summary: "BeTrace service is down"
          description: "BeTrace API has been unreachable for 1 minute"
          runbook_url: "https://docs.betrace.io/runbooks/service-down"

      - alert: BeTraceDatabaseConnectionPoolExhausted
        expr: betrace_db_connections_active >= betrace_db_connections_max
        for: 2m
        labels:
          severity: critical
          component: database
        annotations:
          summary: "Database connection pool exhausted"
          description: "All {{ $value }} connections in use, new requests will fail"
          runbook_url: "https://docs.betrace.io/runbooks/db-pool-exhausted"

  - name: betrace_performance
    interval: 1m
    rules:
      - alert: BeTraceHighEvaluationLatency
        expr: histogram_quantile(0.99, rate(betrace_rules_evaluation_duration_bucket[5m])) > 2000
        for: 5m
        labels:
          severity: warning
          component: rule_engine
        annotations:
          summary: "High rule evaluation latency"
          description: "P99 evaluation latency is {{ $value }}ms (threshold: 2000ms)"
          runbook_url: "https://docs.betrace.io/runbooks/high-latency"

      - alert: BeTraceDatabaseSlowQueries
        expr: histogram_quantile(0.95, rate(betrace_db_queries_duration_bucket[5m])) > 500
        for: 3m
        labels:
          severity: warning
          component: database
        annotations:
          summary: "Slow database queries detected"
          description: "P95 query time is {{ $value }}ms for operation {{ $labels.operation }}"
          runbook_url: "https://docs.betrace.io/runbooks/slow-queries"

      - alert: BeTraceHighMemoryUsage
        expr: (betrace_memory_used_bytes / betrace_memory_max_bytes) > 0.85
        for: 5m
        labels:
          severity: warning
          component: jvm
        annotations:
          summary: "High memory usage"
          description: "JVM heap is {{ $value | humanizePercentage }} full"
          runbook_url: "https://docs.betrace.io/runbooks/high-memory"

  - name: betrace_operational
    interval: 1m
    rules:
      - alert: BeTraceHighErrorRate
        expr: (rate(betrace_errors_total[5m]) / rate(betrace_spans_received_total[5m])) > 0.01
        for: 3m
        labels:
          severity: warning
          component: ingestion
        annotations:
          summary: "High error rate"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"
          runbook_url: "https://docs.betrace.io/runbooks/high-error-rate"

      - alert: BeTraceWebSocketDisconnectStorm
        expr: rate(betrace_websocket_disconnects_total[1m]) > 50
        for: 2m
        labels:
          severity: warning
          component: websocket
        annotations:
          summary: "WebSocket disconnect storm"
          description: "{{ $value }} disconnects/minute (threshold: 50)"
          runbook_url: "https://docs.betrace.io/runbooks/websocket-storm"

      - alert: BeTraceTenantIngestionSpike
        expr: |
          (rate(betrace_spans_received_total[5m])
          / rate(betrace_spans_received_total[1h] offset 1h)) > 10
        for: 5m
        labels:
          severity: info
          component: ingestion
        annotations:
          summary: "Tenant {{ $labels.tenant_id }} ingestion spike"
          description: "Current rate is 10x normal for tenant {{ $labels.tenant_id }}"
          runbook_url: "https://docs.betrace.io/runbooks/ingestion-spike"

  - name: betrace_compliance
    interval: 5m
    rules:
      - alert: BeTracePIIValidationFailures
        expr: rate(betrace_errors_total{type="pii_violation"}[10m]) > 0
        for: 5m
        labels:
          severity: critical
          component: compliance
        annotations:
          summary: "PII validation failures detected"
          description: "{{ $value }} PII violations in last 10 minutes"
          runbook_url: "https://docs.betrace.io/runbooks/pii-violation"

      - alert: BeTraceMissingAuditLogs
        expr: |
          rate(betrace_compliance_spans_generated_total{framework="soc2"}[5m]) == 0
          and rate(betrace_spans_received_total[5m]) > 0
        for: 10m
        labels:
          severity: warning
          component: compliance
        annotations:
          summary: "Compliance spans not being generated"
          description: "No SOC2 compliance spans generated despite active ingestion"
          runbook_url: "https://docs.betrace.io/runbooks/missing-audit-logs"

  - name: betrace_slo
    interval: 5m
    rules:
      - alert: BeTraceAvailabilitySLOBreach
        expr: |
          (1 - (rate(betrace_http_requests_total{status=~"5.."}[30m])
          / rate(betrace_http_requests_total[30m]))) < 0.999
        for: 5m
        labels:
          severity: critical
          component: slo
        annotations:
          summary: "Availability SLO breached"
          description: "Availability is {{ $value | humanizePercentage }} (SLO: 99.9%)"
          runbook_url: "https://docs.betrace.io/runbooks/slo-breach"

      - alert: BeTraceLatencySLOBreach
        expr: histogram_quantile(0.99, rate(betrace_rules_evaluation_duration_bucket[5m])) > 1000
        for: 10m
        labels:
          severity: warning
          component: slo
        annotations:
          summary: "Latency SLO breached"
          description: "P99 latency is {{ $value }}ms (SLO: <1000ms)"
          runbook_url: "https://docs.betrace.io/runbooks/slo-breach"
```

### Alertmanager Configuration

**File:** `prometheus/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'component']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: pagerduty
      continue: true
    - match:
        severity: warning
      receiver: slack
    - match:
        severity: info
      receiver: slack

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:5001/alerts'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<PAGERDUTY_SERVICE_KEY>'
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'

  - name: 'slack'
    slack_configs:
      - api_url: '<SLACK_WEBHOOK_URL>'
        channel: '#betrace-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['component']
```

### Webhook Signature Validation

**File:** `backend/src/main/java/com/betrace/routes/AlertWebhookRoute.java`

```java
@Path("/alerts")
@ApplicationScoped
public class AlertWebhookRoute {
    @ConfigProperty(name = "alertmanager.webhook.secret")
    String webhookSecret;

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response receiveAlert(
        @HeaderParam("X-Alert-Signature") String signature,
        String payload
    ) {
        // P1 Security: Validate HMAC signature
        if (!validateSignature(payload, signature)) {
            log.warnf("Invalid alert signature: %s", signature);
            return Response.status(401).entity("Invalid signature").build();
        }

        // P2 Security: Rate limit (100 alerts/min per tenant)
        if (!rateLimiter.tryAcquire()) {
            log.warnf("Alert rate limit exceeded");
            return Response.status(429).entity("Rate limit exceeded").build();
        }

        AlertPayload alert = parseAlert(payload);
        alertService.processAlert(alert);
        return Response.accepted().build();
    }

    private boolean validateSignature(String payload, String signature) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(webhookSecret.getBytes(), "HmacSHA256"));
            byte[] expected = hmac.doFinal(payload.getBytes());
            byte[] actual = Hex.decode(signature);
            return MessageDigest.isEqual(expected, actual);
        } catch (Exception e) {
            log.errorf(e, "Failed to validate signature");
            return false;
        }
    }
}
```

## Runbook Structure

**Location:** `docs/runbooks/`

**Template:**
```markdown
# Runbook: Alert Name

## Symptom
Brief description of what the alert indicates.

## Impact
What breaks when this alert fires?
- User-facing: API requests fail, dashboards show no data
- Internal: Rule evaluations timeout, signals not generated

## Investigation
1. Check Grafana dashboard: [Link]
2. Query Prometheus: `<specific query>`
3. Check logs: `kubectl logs -l app=betrace | grep ERROR`

## Resolution
Step-by-step fix:
1. Identify root cause (e.g., database connection leak)
2. Apply immediate fix (e.g., restart service)
3. Verify resolution (alert stops firing)

## Prevention
Long-term fixes to prevent recurrence:
- Add connection pool monitoring
- Implement connection leak detection
- Adjust pool size based on load testing
```

**Example Runbooks:**
- `docs/runbooks/service-down.md`
- `docs/runbooks/high-latency.md`
- `docs/runbooks/db-pool-exhausted.md`
- `docs/runbooks/pii-violation.md`

## Security Requirements

### P1 (Compliance)

**Alert Webhook HMAC Validation**
- All incoming alert webhooks MUST validate HMAC-SHA256 signature
- Secret stored in environment variable (not code)
- Implementation: See `AlertWebhookRoute.java` above

**Alert Rate Limiting**
- Max 100 alerts/minute per source
- Prevents alert bombing DoS
- Implementation: Token bucket algorithm via RateLimiter

### P2 (Defense in Depth)

**Alert Deduplication**
- Group identical alerts within 10-second window
- Prevents alert fatigue
- Configuration: `group_interval: 10s` in Alertmanager

**Sensitive Data Scrubbing**
- Alert annotations MUST NOT include PII (userId, email)
- Scrub before sending to external systems (Slack, PagerDuty)

## Testing Strategy

### Load Testing for Alert Thresholds

**Goal:** Validate alert thresholds are tuned correctly (no false positives/negatives)

**k6 Load Test:**
```javascript
// k6-alert-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '5m', target: 100 },  // Ramp up to 100 RPS
    { duration: '10m', target: 100 }, // Sustain 100 RPS
    { duration: '5m', target: 500 },  // Spike to 500 RPS (should trigger alert)
    { duration: '5m', target: 0 },    // Ramp down
  ],
};

export default function () {
  let res = http.post('http://localhost:8080/api/spans', JSON.stringify([
    { traceId: '123', spanId: '456', operationName: 'test' }
  ]));
  check(res, { 'status is 202': (r) => r.status === 202 });
  sleep(1);
}
```

**Validation:**
1. Run load test
2. Monitor Prometheus alerts: `curl http://localhost:9090/api/v1/alerts`
3. Verify `BeTraceHighEvaluationLatency` fires during spike
4. Verify alert resolves after ramp down

### Chaos Testing

**Goal:** Verify alerts fire during failure scenarios

**Test Cases:**
```bash
# Test 1: Database down
docker stop postgres
# Expected: BeTraceDatabaseConnectionPoolExhausted fires within 2 minutes

# Test 2: Memory leak
curl -X POST http://localhost:8080/api/leak-memory
# Expected: BeTraceHighMemoryUsage fires within 5 minutes

# Test 3: Network partition
iptables -A INPUT -p tcp --dport 8080 -j DROP
# Expected: BeTraceServiceDown fires within 1 minute
```

### Alert Simulation

**Goal:** Test alerting pipeline without breaking BeTrace

**Mock Prometheus:**
```yaml
# prometheus/test-alerts.yml
groups:
  - name: test
    rules:
      - alert: TestAlert
        expr: vector(1) # Always fires
        labels:
          severity: warning
        annotations:
          summary: "Test alert"
```

**Run:**
```bash
# Load test rules
curl -X POST http://localhost:9090/-/reload

# Verify alert fires
curl http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname=="TestAlert")'

# Verify Slack message received
# Check #betrace-alerts channel
```

## Acceptance Criteria

### Functional Requirements

```gherkin
Scenario: High latency alert fires correctly
  Given BeTrace rule evaluation P99 > 2s for 5 minutes
  When I query Prometheus /api/v1/alerts
  Then I see BeTraceHighEvaluationLatency in FIRING state
  And alert annotations include runbook_url

Scenario: Alert does not fire under normal load
  Given BeTrace processes 1000 spans/sec with P99 < 1s
  When I wait 10 minutes
  Then BeTraceHighEvaluationLatency is INACTIVE

Scenario: WebSocket disconnect storm detected
  Given 50 clients disconnect within 60 seconds
  When I check alerts
  Then BeTraceWebSocketDisconnectStorm fires
  And alert is sent to Slack within 10 seconds

Scenario: Alert resolves automatically
  Given BeTraceHighMemoryUsage is FIRING
  When memory usage drops below 85%
  And alert waits for 5 minutes
  Then alert state is RESOLVED
  And Slack message says "RESOLVED"
```

### Security Requirements

```gherkin
Scenario: Webhook signature validation
  Given Alertmanager sends alert webhook
  When signature is invalid
  Then webhook returns 401 Unauthorized
  And alert is NOT processed

Scenario: Alert rate limiting
  Given 200 alerts in 1 minute
  When Alertmanager sends alerts
  Then first 100 are accepted (202)
  And remaining 100 are rejected (429)

Scenario: PII not in alert annotations
  Given alert fires for tenant "user@example.com"
  When alert is sent to Slack
  Then annotation does not contain "user@example.com"
  And tenant is redacted as "tenant_***"
```

### SLO Requirements

```gherkin
Scenario: Availability SLO measured correctly
  Given 10,000 requests with 50 5xx errors
  When I query availability SLO metric
  Then availability is 99.5% (10,000 - 50) / 10,000
  And SLO breach alert fires (below 99.9%)

Scenario: Latency SLO measured correctly
  Given rule evaluations with P99 = 1200ms
  When I query latency SLO metric
  Then P99 latency is 1200ms
  And SLO breach alert fires (above 1000ms)
```

## Files to Create/Modify

**New Files:**
- `prometheus/alerts/betrace.yml` (alert rules)
- `prometheus/alertmanager.yml` (routing config)
- `backend/src/main/java/com/betrace/routes/AlertWebhookRoute.java`
- `docs/runbooks/service-down.md`
- `docs/runbooks/high-latency.md`
- `docs/runbooks/db-pool-exhausted.md`
- `docs/runbooks/high-error-rate.md`
- `docs/runbooks/pii-violation.md`
- `docs/runbooks/slo-breach.md`
- `scripts/test-alerts.sh` (chaos testing)
- `k6-alert-test.js` (load testing)

**Modified Files:**
- `backend/src/main/resources/application.properties` (webhook secret)
- `backend/pom.xml` (add RateLimiter dependency)

## Dependencies

**Maven:**
```xml
<dependency>
    <groupId>com.google.guava</groupId>
    <artifactId>guava</artifactId>
    <version>32.1.3-jre</version>
</dependency>
```

**Infrastructure:**
- Prometheus (scrapes metrics)
- Alertmanager (routes alerts)
- PagerDuty (critical alerts)
- Slack (warning/info alerts)

## Success Criteria

- [ ] 12+ alert rules defined (availability, performance, operational, compliance)
- [ ] Alertmanager routing configured (PagerDuty for critical, Slack for warnings)
- [ ] Webhook HMAC signature validation implemented
- [ ] Alert rate limiting (100/min) enforced
- [ ] 6 runbooks created with investigation steps
- [ ] Load testing validates alert thresholds
- [ ] Chaos testing verifies alerts fire during failures
- [ ] SLO breach alerts tested (availability, latency)
- [ ] All alerts include runbook_url annotation
- [ ] Alert deduplication works (no duplicate pages)
