# Grafana Alerting Setup Guide for BeTrace

## Overview

BeTrace emits **violation spans** when trace patterns fail to match rules. These violation spans are sent to Tempo and can be queried using **TraceQL** in Grafana Alerting.

This approach eliminates the need for custom notification infrastructure - Grafana provides 20+ notification channels (Slack, PagerDuty, email, webhooks, etc.) with advanced features like silencing, grouping, and templating.

**Architecture:**
```
BeTrace Rule Engine
    ↓
Evaluates traces against DSL rules
    ↓
Emits violation spans → Tempo
    ↓
Grafana Alerting queries violation spans via TraceQL
    ↓
Sends notifications to contact points (Slack, PagerDuty, etc.)
```

## Violation Span Structure

BeTrace emits violation spans with the following attributes:

```json
{
  "spanName": "betrace.violation",
  "traceId": "original-trace-id",
  "spanId": "generated-violation-span-id",
  "parentSpanId": "original-span-id",
  "attributes": {
    "betrace.violation": true,
    "betrace.violation.severity": "CRITICAL",
    "betrace.violation.rule_id": "rule-123",
    "betrace.violation.rule_name": "missing_audit_log",
    "betrace.violation.message": "PII access without audit log",
    "betrace.violation.trace_id": "original-trace-id"
  }
}
```

## Quick Start

### 1. Verify Violation Spans in Tempo

First, confirm that BeTrace is emitting violation spans:

1. Open Grafana → **Explore**
2. Select **Tempo** datasource
3. Run TraceQL query:
   ```
   {span.betrace.violation = true}
   ```
4. You should see violation spans if any rules have been triggered

### 2. Create Alert Rule

1. Open Grafana → **Alerting** → **Alert rules**
2. Click **New alert rule**
3. Configure:
   - **Rule name**: "Critical BeTrace Violations"
   - **Datasource**: Tempo
   - **Query**: `{span.betrace.violation.severity = "CRITICAL"}`
   - **Condition**: When query returns results
   - **Evaluation interval**: 1m
4. Add contact point (e.g., "slack-betrace")
5. Save

### 3. Create Contact Point

1. Open Grafana → **Alerting** → **Contact points**
2. Click **New contact point**
3. Configure Slack example:
   - **Name**: "slack-betrace"
   - **Type**: Slack
   - **Webhook URL**: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`
   - **Message template**:
     ```
     BeTrace Violation: {{ .CommonLabels.betrace_violation_rule_name }}
     Severity: {{ .CommonLabels.betrace_violation_severity }}
     Message: {{ .CommonLabels.betrace_violation_message }}
     Trace: {{ .CommonLabels.betrace_violation_trace_id }}
     ```
4. Test and save

## TraceQL Query Examples

### Basic Queries

**All violations:**
```
{span.betrace.violation = true}
```

**Critical severity only:**
```
{span.betrace.violation.severity = "CRITICAL"}
```

**Specific rule:**
```
{span.betrace.violation.rule_name = "missing_audit_log"}
```

**Multiple severities:**
```
{span.betrace.violation.severity =~ "CRITICAL|HIGH"}
```

### Advanced Queries

**Rate-based alert (violations per minute):**
```
{span.betrace.violation = true} | rate() by (betrace_violation_rule_name) > 100
```

**Service-specific violations:**
```
{span.betrace.violation = true && service.name = "payment-api"}
```

**Compliance violations:**
```
{span.betrace.violation = true && span.compliance.framework = "soc2"}
```

**Count violations by rule:**
```
{span.betrace.violation = true} | count() by (betrace_violation_rule_name)
```

## Alert Rule Configuration

### Using Grafana UI

**Step 1: Create Alert Rule**

1. Navigate to **Alerting** → **Alert rules** → **New alert rule**
2. Fill in details:
   - **Rule name**: Descriptive name (e.g., "Payment Service Violations")
   - **Folder**: Create/select folder for organization (e.g., "BeTrace Alerts")
   - **Evaluation group**: Create/select evaluation group (e.g., "Production Violations")
   - **Evaluation interval**: 1m (adjust based on urgency)

**Step 2: Define Query**

1. Select **Tempo** datasource
2. Enter TraceQL query (see examples above)
3. Set condition: **Alert** when query returns results

**Step 3: Add Annotations**

Annotations provide context in alert notifications:

- **Summary**: `Critical violation in {{ .CommonLabels.service_name }}`
- **Description**: `{{ .CommonLabels.betrace_violation_message }}`
- **Runbook URL**: Link to troubleshooting guide

**Step 4: Configure Notifications**

1. Select contact point(s) (Slack, PagerDuty, etc.)
2. Optionally add labels for routing (e.g., `team=backend`, `severity=critical`)
3. Save rule

### Using Provisioning (YAML)

Create `grafana/provisioning/alerting/betrace-alerts.yaml`:

```yaml
apiVersion: 1
groups:
  - name: BeTrace Violations
    folder: BeTrace
    interval: 60s
    rules:
      - uid: betrace-critical
        title: Critical BeTrace Violations
        condition: A
        data:
          - refId: A
            datasourceUid: tempo
            model:
              query: '{span.betrace.violation.severity = "CRITICAL"}'
        annotations:
          summary: "Critical BeTrace violation detected"
          description: "{{ $labels.betrace_violation_rule_name }}: {{ $labels.betrace_violation_message }}"
        labels:
          severity: critical
          team: sre
        for: 1m
        notifications:
          - uid: slack-betrace

      - uid: betrace-high-rate
        title: High Violation Rate
        condition: A
        data:
          - refId: A
            datasourceUid: tempo
            model:
              query: '{span.betrace.violation = true} | rate() by (betrace_violation_rule_name) > 100'
        annotations:
          summary: "Violation rate exceeds 100/min"
          description: "Rule {{ $labels.betrace_violation_rule_name }} triggered {{ $value }} violations/min"
        labels:
          severity: warning
          team: sre
        for: 2m
        notifications:
          - uid: slack-betrace

      - uid: betrace-payment-violations
        title: Payment Service Violations
        condition: A
        data:
          - refId: A
            datasourceUid: tempo
            model:
              query: '{span.betrace.violation = true && service.name = "payment-api"}'
        annotations:
          summary: "Payment service violation"
          description: "{{ $labels.betrace_violation_message }}"
          runbook_url: "https://wiki.example.com/payment-violations"
        labels:
          severity: critical
          team: payments
        for: 0m  # Alert immediately
        notifications:
          - uid: pagerduty-payments
```

### Using Terraform

Use the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs):

```hcl
resource "grafana_rule_group" "betrace_alerts" {
  name             = "BeTrace Violations"
  folder_uid       = grafana_folder.betrace.uid
  interval_seconds = 60

  rule {
    name = "Critical BeTrace Violations"
    condition = "A"

    data {
      ref_id = "A"
      datasource_uid = grafana_data_source.tempo.uid
      query = "{span.betrace.violation.severity = \"CRITICAL\"}"
    }

    annotations = {
      summary = "Critical BeTrace violation detected"
      description = "{{ $labels.betrace_violation_rule_name }}: {{ $labels.betrace_violation_message }}"
    }

    labels = {
      severity = "critical"
      team     = "sre"
    }

    for = "1m"

    notification_settings {
      contact_point = grafana_contact_point.slack_betrace.name
    }
  }
}
```

## Contact Point Configuration

### Slack

**UI Configuration:**

1. Navigate to **Alerting** → **Contact points** → **New contact point**
2. Configure:
   - **Name**: `slack-betrace`
   - **Type**: Slack
   - **Webhook URL**: Get from Slack Incoming Webhooks app
   - **Title**: `BeTrace Violation: {{ .CommonLabels.betrace_violation_rule_name }}`
   - **Message**:
     ```
     **Severity**: {{ .CommonLabels.betrace_violation_severity }}
     **Rule**: {{ .CommonLabels.betrace_violation_rule_name }}
     **Message**: {{ .CommonLabels.betrace_violation_message }}
     **Trace ID**: {{ .CommonLabels.betrace_violation_trace_id }}
     **Service**: {{ .CommonLabels.service_name }}

     [View in Tempo]({{ .ExternalURL }})
     ```

**YAML Provisioning:**

```yaml
apiVersion: 1
contactPoints:
  - name: slack-betrace
    receivers:
      - uid: slack-betrace
        type: slack
        settings:
          url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
          title: "BeTrace Violation: {{ .CommonLabels.betrace_violation_rule_name }}"
          text: |
            **Severity**: {{ .CommonLabels.betrace_violation_severity }}
            **Rule**: {{ .CommonLabels.betrace_violation_rule_name }}
            **Message**: {{ .CommonLabels.betrace_violation_message }}
            **Trace**: {{ .CommonLabels.betrace_violation_trace_id }}
```

### PagerDuty

**UI Configuration:**

1. Navigate to **Alerting** → **Contact points** → **New contact point**
2. Configure:
   - **Name**: `pagerduty-betrace`
   - **Type**: PagerDuty
   - **Integration Key**: Get from PagerDuty service
   - **Severity**: Map alert labels to PagerDuty severity
   - **Summary**: `{{ .CommonLabels.betrace_violation_rule_name }}`
   - **Custom Details**:
     ```json
     {
       "severity": "{{ .CommonLabels.betrace_violation_severity }}",
       "rule_id": "{{ .CommonLabels.betrace_violation_rule_id }}",
       "message": "{{ .CommonLabels.betrace_violation_message }}",
       "trace_id": "{{ .CommonLabels.betrace_violation_trace_id }}"
     }
     ```

**YAML Provisioning:**

```yaml
apiVersion: 1
contactPoints:
  - name: pagerduty-betrace
    receivers:
      - uid: pagerduty-betrace
        type: pagerduty
        settings:
          integrationKey: YOUR_PAGERDUTY_INTEGRATION_KEY
          severity: critical
          summary: "BeTrace Violation: {{ .CommonLabels.betrace_violation_rule_name }}"
          details:
            severity: "{{ .CommonLabels.betrace_violation_severity }}"
            rule_id: "{{ .CommonLabels.betrace_violation_rule_id }}"
            message: "{{ .CommonLabels.betrace_violation_message }}"
            trace_id: "{{ .CommonLabels.betrace_violation_trace_id }}"
```

### Email

**UI Configuration:**

1. Navigate to **Alerting** → **Contact points** → **New contact point**
2. Configure:
   - **Name**: `email-betrace`
   - **Type**: Email
   - **Addresses**: `sre-team@example.com`
   - **Subject**: `[BeTrace] {{ .CommonLabels.betrace_violation_severity }} - {{ .CommonLabels.betrace_violation_rule_name }}`
   - **Message**:
     ```
     BeTrace has detected a violation:

     Rule: {{ .CommonLabels.betrace_violation_rule_name }}
     Severity: {{ .CommonLabels.betrace_violation_severity }}
     Message: {{ .CommonLabels.betrace_violation_message }}
     Trace ID: {{ .CommonLabels.betrace_violation_trace_id }}
     Service: {{ .CommonLabels.service_name }}

     View in Tempo: {{ .ExternalURL }}
     ```

**YAML Provisioning:**

```yaml
apiVersion: 1
contactPoints:
  - name: email-betrace
    receivers:
      - uid: email-betrace
        type: email
        settings:
          addresses: sre-team@example.com
          subject: "[BeTrace] {{ .CommonLabels.betrace_violation_severity }} - {{ .CommonLabels.betrace_violation_rule_name }}"
          message: |
            BeTrace has detected a violation:

            Rule: {{ .CommonLabels.betrace_violation_rule_name }}
            Severity: {{ .CommonLabels.betrace_violation_severity }}
            Message: {{ .CommonLabels.betrace_violation_message }}
            Trace ID: {{ .CommonLabels.betrace_violation_trace_id }}
```

### Webhook

**UI Configuration:**

1. Navigate to **Alerting** → **Contact points** → **New contact point**
2. Configure:
   - **Name**: `webhook-betrace`
   - **Type**: Webhook
   - **URL**: `https://api.example.com/betrace/violations`
   - **HTTP Method**: POST
   - **Authorization Header**: Bearer token or API key

**YAML Provisioning:**

```yaml
apiVersion: 1
contactPoints:
  - name: webhook-betrace
    receivers:
      - uid: webhook-betrace
        type: webhook
        settings:
          url: https://api.example.com/betrace/violations
          httpMethod: POST
          authorization:
            type: Bearer
            credentials: YOUR_API_TOKEN
```

## Common Alert Patterns

### Pattern 1: Severity-Based Routing

Route different severities to different contact points:

```yaml
# Critical → PagerDuty (immediate response)
- uid: betrace-critical
  query: '{span.betrace.violation.severity = "CRITICAL"}'
  notifications:
    - uid: pagerduty-oncall

# High → Slack (team notification)
- uid: betrace-high
  query: '{span.betrace.violation.severity = "HIGH"}'
  notifications:
    - uid: slack-sre-team

# Medium/Low → Email (daily digest)
- uid: betrace-low
  query: '{span.betrace.violation.severity =~ "MEDIUM|LOW"}'
  for: 24h  # Only alert if sustained for 24h
  notifications:
    - uid: email-sre-digest
```

### Pattern 2: Service-Specific Alerts

Route violations to service owners:

```yaml
# Payment service → Payments team
- uid: betrace-payment
  query: '{span.betrace.violation = true && service.name = "payment-api"}'
  labels:
    team: payments
  notifications:
    - uid: slack-payments

# Auth service → Security team
- uid: betrace-auth
  query: '{span.betrace.violation = true && service.name = "auth-api"}'
  labels:
    team: security
  notifications:
    - uid: slack-security
```

### Pattern 3: Compliance Violations

Route compliance violations to compliance team:

```yaml
# SOC2 violations → Compliance + Security
- uid: betrace-soc2
  query: '{span.betrace.violation = true && span.compliance.framework = "soc2"}'
  annotations:
    runbook_url: https://wiki.example.com/soc2-response
  labels:
    compliance: soc2
    severity: critical
  notifications:
    - uid: slack-compliance
    - uid: slack-security
    - uid: pagerduty-compliance

# HIPAA violations → Immediate escalation
- uid: betrace-hipaa
  query: '{span.betrace.violation = true && span.compliance.framework = "hipaa"}'
  for: 0m  # Alert immediately
  notifications:
    - uid: pagerduty-compliance-oncall
```

### Pattern 4: Rate-Based Alerts

Alert on violation rate spikes:

```yaml
# High violation rate → Incident response
- uid: betrace-rate-spike
  query: '{span.betrace.violation = true} | rate() > 100'
  for: 5m
  annotations:
    summary: "Violation rate spike detected"
    description: "More than 100 violations/min for 5+ minutes"
  notifications:
    - uid: pagerduty-oncall
    - uid: slack-incident-response
```

### Pattern 5: Multi-Condition Alerts

Combine multiple conditions:

```yaml
# Critical violations + high error rate
- uid: betrace-critical-with-errors
  condition: A && B
  data:
    - refId: A
      query: '{span.betrace.violation.severity = "CRITICAL"}'
    - refId: B
      query: '{status.code = "error"} | rate() > 10'
  annotations:
    summary: "Critical violations with elevated error rate"
  notifications:
    - uid: pagerduty-oncall
```

## Advanced Features

### Silencing

Temporarily silence alerts during maintenance:

1. Navigate to **Alerting** → **Silences** → **New silence**
2. Configure:
   - **Matcher**: `betrace_violation_rule_name = "specific-rule"`
   - **Duration**: 2h
   - **Comment**: "Planned database migration"

### Grouping

Group related alerts to reduce noise:

```yaml
notification_policies:
  - matchers:
      - betrace_violation_severity = "CRITICAL"
    group_by: [betrace_violation_rule_name]
    group_wait: 30s
    group_interval: 5m
    repeat_interval: 4h
```

### Templating

Use Go templates for rich notifications:

```go-template
{{ define "betrace.title" }}
  BeTrace Violation: {{ .CommonLabels.betrace_violation_rule_name }}
{{ end }}

{{ define "betrace.message" }}
  **Severity**: {{ .CommonLabels.betrace_violation_severity }}
  **Rule**: {{ .CommonLabels.betrace_violation_rule_name }}
  **Message**: {{ .CommonLabels.betrace_violation_message }}
  **Service**: {{ .CommonLabels.service_name }}
  **Trace**: [View in Tempo]({{ .ExternalURL }}/explore?left={{ .CommonLabels.betrace_violation_trace_id }})

  {{ if gt (len .Alerts) 1 }}
  **Grouped Alerts**: {{ len .Alerts }} violations
  {{ end }}
{{ end }}
```

## Troubleshooting

### Alert Not Firing

1. **Verify violation spans exist:**
   ```
   # In Grafana Explore with Tempo datasource:
   {span.betrace.violation = true}
   ```
   - If no results: Check that BeTrace rules are enabled and being evaluated
   - If results exist: Proceed to step 2

2. **Test TraceQL query:**
   - Run your alert's TraceQL query in Explore
   - Ensure it returns results
   - Check for typos in attribute names

3. **Check alert rule status:**
   - Navigate to **Alerting** → **Alert rules**
   - Find your alert rule
   - Check **State** (should be "Firing" if violations exist)
   - Click on rule → **View health** for evaluation history

4. **Verify contact point:**
   - Navigate to **Alerting** → **Contact points**
   - Test the contact point manually
   - Check logs for delivery errors

### Duplicate Alerts

If receiving multiple alerts for same violation:

1. **Check grouping configuration:**
   ```yaml
   notification_policies:
     - group_by: [betrace_violation_rule_name, betrace_violation_trace_id]
       group_wait: 30s
       group_interval: 5m
   ```

2. **Adjust evaluation interval:**
   - Increase from 1m to 2m or 5m
   - Add `for: 2m` to wait before firing

### Missing Alert Labels

If alert labels are missing from notifications:

1. **Check label names:**
   - Grafana converts span attributes to labels
   - `span.betrace.violation.rule_name` → `betrace_violation_rule_name`
   - Use `.CommonLabels.betrace_violation_rule_name` in templates

2. **Verify attribute names in violation spans:**
   ```
   # Query violation spans and inspect attributes:
   {span.betrace.violation = true} | select(span.betrace.*)
   ```

## References

- [Grafana Alerting Documentation](https://grafana.com/docs/grafana/latest/alerting/)
- [TraceQL Documentation](https://grafana.com/docs/tempo/latest/traceql/)
- [Grafana Contact Points](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/)
- [Grafana Alert Templating](https://grafana.com/docs/grafana/latest/alerting/manage-notifications/template-notifications/)
- [ADR-025: Grafana Alerting for Signals](../docs/adrs/025-grafana-alerting-for-signals.md)

## Examples Repository

For more examples, see the `examples/grafana-alerting/` directory:
- `alert-rules.yaml` - Sample alert rules for common patterns
- `contact-points.yaml` - Sample contact point configurations
- `notification-policies.yaml` - Sample routing and grouping policies
- `terraform/` - Terraform configuration examples
