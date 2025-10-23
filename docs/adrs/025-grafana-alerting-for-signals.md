# ADR-025: Grafana Alerting for Signals

## Status
**Accepted** - 2025-01-22

## Context

BeTrace originally included a custom notification system (PRD-017: Signal Notifications) with 8 PRDs implementing:
- Notification configuration service
- Notification rules processor
- Webhook delivery processor
- Slack delivery processor
- Email delivery processor
- Notification event recording
- Notification compliance spans
- Notification config UI

**Total**: ~500 LOC for custom notification infrastructure

**User Question**:
> "can we plug in to grafana alert manager to handle the signals feature?"

**Research Findings**:
- **Grafana Alerting** supports: Slack, PagerDuty, email, webhooks, OpsGenie, VictorOps, and 20+ contact points
- **TraceQL Queries** can trigger alerts based on span attributes
- **Grafana Unified Alerting** (Grafana 9+) consolidates alerting across datasources

**Key Insight**: BeTrace's "signals" are just **violation spans** with attributes. Grafana can alert on these spans via TraceQL queries.

## Decision

We **remove BeTrace's custom notification system** and use **Grafana Alerting** via TraceQL queries on violation spans.

### Architecture

**Before (Custom Notifications)**:
```
BeTrace Backend
    ↓
DroolsSpanProcessor (evaluates rules)
    ↓
SignalService.emit(signal) → Violation created
    ↓
NotificationRulesProcessor (matches notification config)
    ↓
┌────────────────────────────────────┐
│ Delivery Processors                │
│ - WebhookDeliveryProcessor         │
│ - SlackDeliveryProcessor           │
│ - EmailDeliveryProcessor           │
└────────────────────────────────────┘
    ↓
Notifications sent
```

**After (Grafana Alerting)**:
```
BeTrace Backend
    ↓
DroolsSpanProcessor (evaluates rules)
    ↓
Emit violation span → Tempo
    ↓
Grafana Alerting
    ↓
┌────────────────────────────────────┐
│ TraceQL Alert Rule                 │
│ {span.fluo.violation.severity      │
│   = "CRITICAL"}                    │
└────────────────────────────────────┘
    ↓
┌────────────────────────────────────┐
│ Contact Points (Grafana)           │
│ - Slack                            │
│ - PagerDuty                        │
│ - Email                            │
│ - Webhooks                         │
│ - OpsGenie                         │
│ - VictorOps                        │
│ - etc.                             │
└────────────────────────────────────┘
```

### Violation Span Format

**BeTrace Emits Violation Spans**:
```json
{
  "spanName": "fluo.violation",
  "traceId": "original-trace-id",
  "spanId": "generated-violation-span-id",
  "parentSpanId": "original-span-id",
  "startTimestamp": 1737580800000000000,
  "endTimestamp": 1737580800001000000,
  "attributes": {
    "fluo.violation": true,
    "fluo.violation.severity": "CRITICAL",
    "fluo.violation.rule_id": "rule-123",
    "fluo.violation.rule_name": "missing_audit_log",
    "fluo.violation.message": "PII access without audit log",
    "fluo.violation.trace_id": "original-trace-id"
  }
}
```

**Grafana Queries Violations**:
```
# TraceQL query in Grafana Alerting
{span.fluo.violation.severity = "CRITICAL"}
```

## Rationale

### 1. Eliminate Duplication

**Grafana Alerting Provides**:
- ✅ 20+ notification channels (Slack, PagerDuty, email, webhooks, etc.)
- ✅ Alert templating (customize message per channel)
- ✅ Silencing, inhibition, grouping
- ✅ Alert history and status tracking
- ✅ Multi-datasource alerting (Tempo, Loki, Prometheus, Mimir)

**BeTrace Custom Notifications Provided**:
- ⚠️ 3 channels (Slack, email, webhooks)
- ⚠️ Basic templating
- ⚠️ No silencing or grouping
- ⚠️ Custom alert UI
- ⚠️ Single-purpose (BeTrace violations only)

**Decision**: Use Grafana (battle-tested, full-featured) instead of building custom

### 2. Better User Experience

**Before** (Custom Notifications):
- Configure notifications in BeTrace UI
- Configure notifications in Grafana (for other alerts)
- Two notification configs to maintain

**After** (Grafana Alerting):
- Configure all notifications in Grafana (BeTrace + other alerts)
- Single notification config
- Unified alert view

### 3. TraceQL Alert Capabilities

**Grafana Alerting Supports TraceQL**:
```yaml
# Alert rule examples
- name: Critical BeTrace Violations
  query: |
    {span.fluo.violation.severity = "CRITICAL"}
  contact_point: pagerduty

- name: Missing Audit Logs
  query: |
    {span.fluo.violation.rule_name = "missing_audit_log"}
  contact_point: slack

- name: High Violation Rate
  query: |
    {span.fluo.violation = true} | rate() > 100
  contact_point: email
```

**Advanced Queries**:
```yaml
# Alert on compliance violations
- name: SOC2 Compliance Violation
  query: |
    {span.fluo.violation = true &&
     span.compliance.framework = "soc2"}

# Alert on specific services
- name: Payment Service Violations
  query: |
    {span.fluo.violation = true &&
     service.name = "payment-api"}
```

### 4. Notification Channels

**Grafana Built-In Contact Points**:
- Slack
- PagerDuty
- OpsGenie
- VictorOps
- Email (SMTP)
- Webhooks
- Microsoft Teams
- Google Chat
- Telegram
- Discord
- Sensu
- Pushover
- Kafka
- And 10+ more...

**BeTrace Would Need to Implement**:
- Each channel separately (~50-100 LOC per channel)
- Configuration UI for each channel
- Testing infrastructure for each channel

**Savings**: ~500 LOC by using Grafana

## Consequences

### Positive

1. **Code Reduction**: Remove ~500 LOC from BeTrace backend
2. **Feature Richness**: 20+ channels vs. 3 custom channels
3. **UX Consistency**: All alerts configured in Grafana
4. **Maintenance**: Grafana team maintains notification channels, not BeTrace
5. **Advanced Features**: Silencing, inhibition, grouping, templating

### Negative

1. **Dependency on Grafana**: BeTrace requires Grafana for alerting
2. **TraceQL Limitations**: Cannot express all BeTraceDSL patterns in TraceQL (but can alert on violations)

### Mitigation Strategies

1. **Grafana Dependency**: Acceptable - BeTrace is Grafana-first (ADR-022)
2. **TraceQL Limitations**: BeTraceDSL evaluates patterns → emits violations → Grafana alerts on violations

## Implementation

### Violation Span Emission (BeTrace Backend)

**DroolsSpanProcessor.java** (Modified):
```java
// After rule evaluation, emit violation span
if (ruleContext.hasViolations()) {
    List<RuleContext.SignalViolation> violations = ruleContext.getViolations();

    for (RuleContext.SignalViolation violation : violations) {
        // Create violation span
        Span violationSpan = Span.builder()
            .spanName("fluo.violation")
            .traceId(violation.traceId)
            .spanId(generateSpanId())
            .parentSpanId(violation.spanId)
            .startTimestamp(Instant.now())
            .endTimestamp(Instant.now().plusMillis(1))
            .attributes(Map.of(
                "fluo.violation", true,
                "fluo.violation.severity", violation.severity,
                "fluo.violation.rule_id", violation.ruleId,
                "fluo.violation.rule_name", violation.ruleName,
                "fluo.violation.message", violation.description,
                "fluo.violation.trace_id", violation.traceId
            ))
            .build();

        // Export to OTEL Collector → Tempo
        otelExporter.export(violationSpan);
    }
}
```

### Grafana Alert Rule Configuration

**Terraform Example**:
```hcl
resource "grafana_rule_group" "fluo_alerts" {
  name             = "BeTrace Violations"
  folder_uid       = "fluo"
  interval_seconds = 60

  rule {
    name = "Critical BeTrace Violations"
    condition = "A"

    data {
      ref_id = "A"
      datasource_uid = "tempo"
      query = "{span.fluo.violation.severity = \"CRITICAL\"}"
    }

    annotations = {
      summary = "Critical BeTrace violation detected"
      description = "{{ $labels.fluo_violation_rule_name }}: {{ $labels.fluo_violation_message }}"
    }

    notification_settings {
      contact_point = "pagerduty"
    }
  }
}
```

**YAML Example** (Grafana Alerting API):
```yaml
apiVersion: 1
groups:
  - name: BeTrace Violations
    folder: BeTrace
    interval: 60s
    rules:
      - uid: fluo-critical
        title: Critical BeTrace Violations
        condition: A
        data:
          - refId: A
            datasourceUid: tempo
            model:
              query: '{span.fluo.violation.severity = "CRITICAL"}'
        annotations:
          summary: "Critical BeTrace violation detected"
          description: "{{ $labels.fluo_violation_rule_name }}: {{ $labels.fluo_violation_message }}"
        labels:
          severity: critical
        for: 1m
        notifications:
          - uid: pagerduty
```

### Contact Point Configuration

**Slack Contact Point**:
```yaml
apiVersion: 1
contactPoints:
  - name: slack-fluo
    receivers:
      - uid: slack-fluo
        type: slack
        settings:
          url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
          title: "BeTrace Violation: {{ .CommonLabels.fluo_violation_rule_name }}"
          text: |
            **Severity**: {{ .CommonLabels.fluo_violation_severity }}
            **Rule**: {{ .CommonLabels.fluo_violation_rule_name }}
            **Message**: {{ .CommonLabels.fluo_violation_message }}
            **Trace**: {{ .CommonLabels.fluo_violation_trace_id }}
```

**PagerDuty Contact Point**:
```yaml
apiVersion: 1
contactPoints:
  - name: pagerduty-fluo
    receivers:
      - uid: pagerduty-fluo
        type: pagerduty
        settings:
          integrationKey: YOUR_PAGERDUTY_INTEGRATION_KEY
          severity: critical
          summary: "BeTrace Violation: {{ .CommonLabels.fluo_violation_rule_name }}"
          details:
            severity: "{{ .CommonLabels.fluo_violation_severity }}"
            rule_id: "{{ .CommonLabels.fluo_violation_rule_id }}"
            message: "{{ .CommonLabels.fluo_violation_message }}"
            trace_id: "{{ .CommonLabels.fluo_violation_trace_id }}"
```

## What Gets Removed from BeTrace

### PRDs to Archive (8 PRDs)

| PRD | Component | LOC | Status |
|-----|-----------|-----|--------|
| `017a-notification-config-service.md` | Config service | ~80 | ❌ Archived |
| `017b-notification-rules-processor.md` | Rule matching | ~60 | ❌ Archived |
| `017c-webhook-delivery-processor.md` | Webhook delivery | ~100 | ❌ Archived |
| `017d-slack-delivery-processor.md` | Slack delivery | ~80 | ❌ Archived |
| `017e-email-delivery-processor.md` | Email delivery | ~80 | ❌ Archived |
| `017f-record-notification-event-processor.md` | Event recording | ~50 | ❌ Archived |
| `017g-notification-compliance-span-processor.md` | Compliance spans | ~30 | ❌ Archived |
| `017h-notification-config-ui.md` | Frontend UI | ~50 | ❌ Archived |
| **TOTAL** | | **~530 LOC** | **❌ Archived** |

### Backend Code to Remove

**Services**:
- `NotificationConfigService.java` (~80 LOC)
- `SlackNotificationService.java` (~80 LOC)
- `EmailNotificationService.java` (~80 LOC)
- `WebhookNotificationService.java` (~100 LOC)

**Processors**:
- `NotificationRulesProcessor.java` (~60 LOC)
- `WebhookDeliveryProcessor.java` (~100 LOC)
- `SlackDeliveryProcessor.java` (~80 LOC)
- `EmailDeliveryProcessor.java` (~80 LOC)
- `RecordNotificationEventProcessor.java` (~50 LOC)
- `NotificationComplianceSpanProcessor.java` (~30 LOC)

**Routes**:
- `NotificationConfigRoute.java` (~80 LOC)

**Total Backend Removal**: ~820 LOC

### Frontend Code to Remove

**Components**:
- `notification-config.tsx` (~150 LOC)
- `notification-list.tsx` (~100 LOC)

**Total Frontend Removal**: ~250 LOC

**TOTAL REMOVAL**: ~1,070 LOC (backend + frontend)

## Migration Guide (Existing BeTrace Users)

### Step 1: Export Existing Notification Config

```bash
# Export BeTrace notification config
curl http://fluo-backend:8080/api/notifications/config > fluo-notifications.json
```

### Step 2: Convert to Grafana Alert Rules

```python
# convert-to-grafana.py
import json

with open('fluo-notifications.json') as f:
    fluo_config = json.load(f)

grafana_rules = []
for rule in fluo_config['rules']:
    grafana_rule = {
        'title': rule['name'],
        'condition': 'A',
        'data': [{
            'refId': 'A',
            'datasourceUid': 'tempo',
            'model': {
                'query': f'{{span.fluo.violation.severity = "{rule["severity"]}"}}'
            }
        }],
        'notifications': [{'uid': rule['contact_point']}]
    }
    grafana_rules.append(grafana_rule)

# Output Grafana-compatible YAML
print(yaml.dump({'groups': [{'name': 'BeTrace Violations', 'rules': grafana_rules}]}))
```

### Step 3: Create Grafana Contact Points

```bash
# Create Slack contact point
curl -X POST http://grafana:3000/api/v1/provisioning/contact-points \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "slack-fluo",
    "type": "slack",
    "settings": {
      "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    }
  }'
```

### Step 4: Import Alert Rules

```bash
# Import Grafana alert rules
curl -X POST http://grafana:3000/api/v1/provisioning/alert-rules \
  -H 'Content-Type: application/json' \
  -d @grafana-alert-rules.json
```

## Advanced Alert Examples

### Example 1: Rate-Based Alerts

```yaml
# Alert if violation rate exceeds 100/min
- name: High Violation Rate
  query: |
    {span.fluo.violation = true}
      | rate() by (fluo_violation_rule_name) > 100
  contact_point: slack
```

### Example 2: Service-Specific Alerts

```yaml
# Alert for payment service violations only
- name: Payment Service Violations
  query: |
    {span.fluo.violation = true &&
     service.name = "payment-api"}
  contact_point: pagerduty
```

### Example 3: Compliance Violations

```yaml
# Alert on SOC2 compliance violations
- name: SOC2 Compliance Violation
  query: |
    {span.fluo.violation = true &&
     span.compliance.framework = "soc2"}
  contact_point: email
  annotations:
    severity: critical
    runbook: https://wiki.example.com/soc2-violations
```

### Example 4: Multi-Condition Alerts

```yaml
# Alert if critical violations and high error rate
- name: Critical Violations + High Errors
  condition: A && B
  data:
    - refId: A
      query: '{span.fluo.violation.severity = "CRITICAL"}'
    - refId: B
      query: '{status.code = "error"} | rate() > 10'
  contact_point: pagerduty
```

## Alternatives Considered

### 1. Keep Custom Notification System
**Rejected**: Duplicates Grafana Alerting, adds maintenance burden

### 2. Support Both (Custom + Grafana)
**Rejected**: Confuses users, doubles testing surface

### 3. Build Grafana Alerting Plugin
**Rejected**: Grafana Alerting already supports TraceQL, no plugin needed

## References

- **Grafana Alerting Documentation**: https://grafana.com/docs/grafana/latest/alerting/
- **TraceQL Documentation**: https://grafana.com/docs/tempo/latest/traceql/
- **Grafana Contact Points**: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/
- **Grafana Alert Templating**: https://grafana.com/docs/grafana/latest/alerting/manage-notifications/template-notifications/
- **Related ADRs**:
  - ADR-022: Grafana-First Architecture
  - ADR-026: BeTrace Core Competencies
  - ADR-027: BeTrace as Grafana App Plugin
