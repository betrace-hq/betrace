# PRD-017: Alert and Notification System

**Priority:** P1 (User Workflow - Production Use)
**Complexity:** Medium (System)
**Type:** System Overview
**Personas:** SRE, Developer, Compliance
**Dependencies:**
- PRD-008 (Signal Management System)
- PRD-001 (Authentication & Authorization)
- PRD-002 (TigerBeetle Persistence)

## Architecture Integration

This PRD complies with BeTrace's architectural standards:

- **ADR-011 (TigerBeetle-First):** Notification events stored as TigerBeetle transfers (code=11)
- **ADR-013 (Camel-First):** Notification delivery implemented as Camel processors
- **ADR-014 (Named Processors):** All notification logic in named CDI processors
- **ADR-015 (Tiered Storage):** Notification events in TigerBeetle → DuckDB → Parquet for analytics
- **PRD-003 (Compliance Evidence):** Notification delivery generates SOC2 CC7.2 evidence (incident communication)

## Problem

**No way to alert users when signals are generated:**
- Signals sit in BeTrace UI until someone checks
- No real-time notifications when rules fire
- SREs miss critical incidents
- No integration with existing alerting systems (PagerDuty, Slack, Email)
- No notification preferences (which signals to alert on)

**Current State:**
- Signals created in SignalService (PRD-008)
- No notification delivery mechanism
- No webhook endpoints
- No email/Slack integration
- No notification configuration

**Impact:**
- Delayed incident response (SREs don't know signals exist)
- Missed critical security events
- No integration with on-call systems
- Manual polling required
- Compliance gaps (no proof of incident notification)

## Solution

### Notification Channels

Support three notification channels with per-tenant configuration:

1. **Webhook:** POST JSON to configured URL (for PagerDuty, Opsgenie, custom systems)
2. **Slack:** Post message to Slack channel via incoming webhook
3. **Email:** Send email to configured addresses via SMTP

### Notification Rules

Allow users to configure which signals trigger notifications:

- **All signals:** Notify on every signal (noisy)
- **By severity:** Only critical/high severity
- **By rule:** Specific rules trigger notifications
- **By category:** Authentication failures, PII leaks, compliance violations
- **Quiet hours:** Suppress notifications during specified hours

### Notification Workflow

```
Signal Created (SignalService)
  ↓
[checkNotificationRulesProcessor] → Query notification config for tenant
  ↓
[shouldNotify?] → Apply notification rules (severity, category, quiet hours)
  ↓
If yes:
  [prepareNotificationProcessor] → Build notification payload
  ↓
  [deliverWebhookProcessor] → POST to webhook URL
  ↓
  [deliverSlackProcessor] → POST to Slack webhook
  ↓
  [deliverEmailProcessor] → Send via SMTP
  ↓
  [recordNotificationEventProcessor] → TigerBeetle transfer (code=11)
  ↓
  [generateComplianceSpanProcessor] → SOC2 CC7.2 evidence
```

## Unit PRD References

✅ **DECOMPOSED** - This system has been decomposed into unit PRDs:

| PRD | Unit | Purpose | File | Lines |
|-----|------|---------|------|-------|
| [017a](./017a-notification-config-service.md) | NotificationConfigService | Manage notification channels and rules | `NotificationConfigService.java` | 367 |
| [017b](./017b-notification-rules-processor.md) | NotificationRulesProcessor | Evaluate whether to notify | `EvaluateNotificationRulesProcessor.java` | 219 |
| [017c](./017c-webhook-delivery-processor.md) | WebhookDeliveryProcessor | Deliver notifications via webhook | `DeliverWebhookNotificationProcessor.java` | 384 |
| [017d](./017d-slack-delivery-processor.md) | SlackDeliveryProcessor | Deliver notifications to Slack | `DeliverSlackNotificationProcessor.java` | 313 |
| [017e](./017e-email-delivery-processor.md) | EmailDeliveryProcessor | Deliver notifications via email | `DeliverEmailNotificationProcessor.java` | 323 |
| [017f](./017f-record-notification-event-processor.md) | RecordNotificationEventProcessor | Record in TigerBeetle for audit | `RecordNotificationEventProcessor.java` | 277 |
| [017g](./017g-notification-compliance-span-processor.md) | NotificationComplianceSpanProcessor | Generate SOC2 CC7.2 compliance spans | `GenerateNotificationComplianceSpanProcessor.java` | 253 |
| [017h](./017h-notification-config-ui.md) | NotificationConfigUI | Configure notification channels | `notification-config-page.tsx` | 485 |

**Total:** 8 unit PRDs, 2,621 lines

## TigerBeetle Schema (ADR-011)

**Notification Event Transfer (code=11):**
```java
Transfer notificationEvent = new Transfer(
    id: UUID (notification event ID),
    debitAccountId: signalAccount,        // Signal that triggered notification
    creditAccountId: tenantAccount,       // Tenant receiving notification
    amount: 1,  // Notification count
    code: 11,  // Notification event type
    userData128: pack(
        channel: 8 bits (1=webhook, 2=slack, 3=email),
        delivery_status: 8 bits (1=sent, 2=failed, 3=skipped),
        severity: 8 bits (signal severity),
        retry_count: 8 bits,
        http_status: 16 bits (for webhook/slack),
        reserved: 80 bits
    ),
    userData64: timestamp,
    ledger: tenantToLedgerId(tenantId)
);
```

**Notification Configuration Storage:**
```sql
-- DuckDB hot tier
CREATE TABLE notification_configs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    channel_type VARCHAR(50) NOT NULL,  -- webhook, slack, email
    enabled BOOLEAN DEFAULT true,

    -- Channel-specific config
    webhook_url TEXT,
    webhook_headers JSONB,
    slack_webhook_url TEXT,
    slack_channel VARCHAR(255),
    email_addresses TEXT[],
    email_smtp_config JSONB,

    -- Notification rules
    notify_all BOOLEAN DEFAULT false,
    severity_filter VARCHAR(50)[],  -- ['critical', 'high']
    rule_ids UUID[],  -- Specific rules to notify on
    categories VARCHAR(50)[],  -- ['authentication', 'pii', 'compliance']

    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_timezone VARCHAR(50),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_configs_tenant ON notification_configs(tenant_id);
CREATE INDEX idx_notification_configs_enabled ON notification_configs(tenant_id, enabled);
```

## Data Flow Architecture

**Signal Created → Notification:**
```
POST /api/signals (SignalService creates signal)
  ↓
[triggerNotificationProcessor] → Async event to notification route
  ↓
[loadNotificationConfigsProcessor] → Query DuckDB for tenant configs
  ↓
[evaluateNotificationRulesProcessor]
  ├── Check severity filter
  ├── Check rule ID filter
  ├── Check category filter
  ├── Check quiet hours
  └── Return shouldNotify: boolean
  ↓
If shouldNotify:
  [prepareNotificationPayloadProcessor]
    └── Build JSON payload with signal details
  ↓
  For each enabled channel:
    [deliverWebhookProcessor] → POST to webhook URL
    [deliverSlackProcessor] → POST to Slack webhook
    [deliverEmailProcessor] → Send via SMTP
  ↓
  [recordNotificationEventProcessor] → TigerBeetle transfer (code=11)
  ↓
  [generateComplianceSpanProcessor] → SOC2 CC7.2 evidence
```

**Configure Notification Channel:**
```
POST /api/notification-configs
{
  "channelType": "slack",
  "slackWebhookUrl": "https://hooks.slack.com/...",
  "slackChannel": "#alerts",
  "severityFilter": ["critical", "high"],
  "categories": ["authentication", "pii"]
}
  ↓
[validateNotificationConfigProcessor]
  ├── Test webhook URL (send test notification)
  ├── Validate Slack webhook
  └── Validate email SMTP config
  ↓
[saveNotificationConfigProcessor] → INSERT into DuckDB
  ↓
Return configId
```

## Notification Payload Schema

**Webhook/Slack JSON:**
```json
{
  "event": "signal.created",
  "signal": {
    "id": "uuid",
    "severity": "critical",
    "rule_id": "uuid",
    "rule_name": "Detect PII Leak",
    "description": "SSN found in span attributes without redaction",
    "trace_id": "abc123",
    "span_id": "def456",
    "created_at": "2025-10-11T12:34:56Z"
  },
  "tenant": {
    "id": "uuid",
    "name": "Acme Corp"
  },
  "fluo_url": "https://fluo.example.com/signals/uuid",
  "metadata": {
    "matched_span_count": 3,
    "rule_category": "pii"
  }
}
```

**Email Template:**
```
Subject: [BeTrace Alert] Critical Signal: Detect PII Leak

A new signal has been generated in BeTrace:

Severity: Critical
Rule: Detect PII Leak
Description: SSN found in span attributes without redaction

Trace ID: abc123
Span ID: def456
Created: 2025-10-11 12:34:56 UTC

View in BeTrace: https://fluo.example.com/signals/uuid

---
This alert was generated by BeTrace
```

## Success Criteria

**Functional Requirements:**
- [ ] Configure webhook notification channels
- [ ] Configure Slack notification channels
- [ ] Configure email notification channels
- [ ] Filter notifications by severity (critical, high, medium, low)
- [ ] Filter notifications by rule ID
- [ ] Filter notifications by category
- [ ] Quiet hours (suppress notifications during specified times)
- [ ] Test notification delivery (send test message)
- [ ] Retry failed deliveries (exponential backoff)
- [ ] Record all notification attempts in TigerBeetle

**Performance Requirements:**
- [ ] Notification delivery within <5 seconds of signal creation
- [ ] Support 1000+ notifications per hour
- [ ] Retry failed deliveries up to 3 times

**Compliance Requirements:**
- [ ] All notification attempts generate SOC2 CC7.2 evidence (incident communication)
- [ ] Notification events immutably recorded in TigerBeetle
- [ ] Audit trail shows delivery status, channel, timestamp

**Testing Requirements:**
- [ ] Unit tests for all processors (90% coverage per ADR-014)
- [ ] Integration tests for webhook/Slack/email delivery
- [ ] Security tests: webhook URL validation, SSRF prevention

## Integration with Existing PRDs

**PRD-008 (Signal Management):**
- Signals trigger notifications when created
- Notification delivery is async (doesn't block signal creation)

**PRD-001 (Authentication):**
- Notification configs scoped to tenant
- RBAC: only admins can configure notifications

**PRD-002 (TigerBeetle):**
- Notification events stored as transfers (code=11)
- Notification delivery history queryable

**PRD-003 (Compliance Spans):**
- Generates SOC2 CC7.2 compliance spans for notifications
- Proves incident communication process

## Compliance Benefits

**SOC2 CC7.2 (System Monitoring - Communication):**
- Evidence: Incidents communicated to responsible parties (notification events in TigerBeetle)
- Evidence: Timely incident response (notification within 5 seconds)
- Evidence: Multiple notification channels configured

**SOC2 CC9.2 (Risk Management - Incident Response):**
- Evidence: Automated incident alerting
- Evidence: Integration with on-call systems (PagerDuty via webhook)

**Audit Trail:**
- Which signal triggered notification (signal_id in transfer debitAccountId)
- Which channel used (channel in userData128)
- Whether delivery succeeded (delivery_status in userData128)
- When notification sent (timestamp in transfer)

## Security Considerations

**Threats & Mitigations:**
- **SSRF via webhook URLs** - mitigate with URL allowlist, block internal IPs
- **Credential leakage** - mitigate with encrypted webhook headers in DuckDB
- **Notification spam** - mitigate with rate limiting, quiet hours
- **Unauthorized config changes** - mitigate with RBAC, audit log
- **Slack token exposure** - mitigate with secure storage, rotation

**Rate Limiting:**
- Max 100 notifications per channel per hour (configurable)
- Exponential backoff on failures (1s, 2s, 4s delays)
- Circuit breaker after 10 consecutive failures

## Sample Integrations

**PagerDuty (via Webhook):**
```json
POST https://events.pagerduty.com/v2/enqueue
{
  "routing_key": "YOUR_INTEGRATION_KEY",
  "event_action": "trigger",
  "payload": {
    "summary": "BeTrace Alert: Detect PII Leak",
    "severity": "critical",
    "source": "fluo",
    "custom_details": { ... }
  }
}
```

**Slack (via Incoming Webhook):**
```json
POST https://hooks.slack.com/services/T00/B00/XXX
{
  "channel": "#alerts",
  "username": "BeTrace",
  "text": ":rotating_light: *Critical Signal: Detect PII Leak*",
  "attachments": [{
    "color": "danger",
    "fields": [...]
  }]
}
```

**Opsgenie (via Webhook):**
```json
POST https://api.opsgenie.com/v2/alerts
{
  "message": "BeTrace Alert: Detect PII Leak",
  "priority": "P1",
  "source": "fluo",
  "details": { ... }
}
```

## Future Enhancements

- Microsoft Teams integration
- SMS notifications (Twilio)
- Push notifications (mobile app)
- Custom notification templates
- Notification aggregation (batch multiple signals)
- Escalation policies (if not acknowledged in 15 min, escalate)
- Bi-directional integrations (update signal status from Slack)
- Notification analytics dashboard

## Implementation Status

✅ **DECOMPOSED** - This PRD has been fully decomposed into 8 unit PRDs (017a-017h). See [Unit PRD References](#unit-prd-references) section for complete breakdown.

**Files Created:**
- `docs/prds/017a-notification-config-service.md` - CRUD for notification channels
- `docs/prds/017b-notification-rules-processor.md` - Notification rule evaluation
- `docs/prds/017c-webhook-delivery-processor.md` - Webhook delivery with retry
- `docs/prds/017d-slack-delivery-processor.md` - Slack Block Kit formatting
- `docs/prds/017e-email-delivery-processor.md` - SMTP delivery with HTML templates
- `docs/prds/017f-record-notification-event-processor.md` - TigerBeetle audit trail
- `docs/prds/017g-notification-compliance-span-processor.md` - SOC2 CC7.2 evidence
- `docs/prds/017h-notification-config-ui.md` - React configuration UI

## Public Examples

**IMPORTANT:** BeTrace is a behavioral assurance system for detecting invariant violations, NOT a security incident response platform. The following examples demonstrate notification delivery patterns—signals represent **pattern violations**, not **security incidents**.

### 1. Prometheus Alertmanager
**URL:** https://prometheus.io/docs/alerting/latest/alertmanager/

**Relevance:** Alert routing and notification delivery system for metric-based monitoring. Demonstrates notification grouping, routing rules, and multi-channel delivery applicable to BeTrace's signal notifications.

**Key Patterns:**
- Route configuration (match alerts to receivers)
- Grouping and deduplication
- Inhibition rules (suppress low-priority alerts)
- Multi-channel receivers (webhook, email, Slack)
- Retry and timeout handling

**BeTrace Terminology Adaptation:**
- Alertmanager routes **metric threshold alerts** (CPU > 80%)
- BeTrace routes **signal pattern violations** (trace.missing(auth.check))
- Both use similar notification delivery infrastructure

**Example Notification:**
```yaml
# Alertmanager: "CPU usage high"
# BeTrace: "Auth check missing in trace pattern"
route:
  receiver: on-call-team
  routes:
    - match:
        severity: critical
      receiver: pagerduty
```

### 2. PagerDuty Events API
**URL:** https://developer.pagerduty.com/docs/events-api-v2/overview/

**Relevance:** Webhook integration for routing operational notifications to on-call teams. Demonstrates event payload structure, deduplication keys, and severity mapping.

**Key Patterns:**
- Event schema (summary, severity, timestamp, custom details)
- Deduplication keys for alert aggregation
- Event actions (trigger, acknowledge, resolve)
- Change events for audit trail
- Integration metadata

**BeTrace Webhook Payload Example:**
```json
{
  "routing_key": "fluo-signals",
  "event_action": "trigger",
  "payload": {
    "summary": "Signal: PII access without audit log",
    "severity": "error",
    "source": "fluo",
    "custom_details": {
      "signal_id": "sig-123",
      "rule_name": "pii_audit_required",
      "trace_id": "abc123",
      "tenant_id": "tenant-456"
    }
  }
}
```

**Critical Terminology Fix:**
- ✅ "Route invariant violations to incident workflow"
- ✅ "Notify on-call for critical signal patterns"
- ❌ "Trigger PagerDuty alerts for security threats"
- ❌ "PagerDuty for BeTrace security incidents"

### 3. Slack Incoming Webhooks
**URL:** https://api.slack.com/messaging/webhooks

**Relevance:** Simple webhook-based message delivery to Slack channels. Demonstrates Block Kit formatting, rich message layouts, and interactive buttons for signal investigation.

**Key Patterns:**
- Webhook URL configuration per channel
- Block Kit message formatting (sections, fields, actions)
- Markdown support in text blocks
- Interactive buttons with callback URLs
- Attachment fallbacks for plain text

**BeTrace Slack Message Example:**
```json
{
  "text": "New BeTrace Signal",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Signal Generated*\n`auth.required but trace.missing(auth.check)`"
      }
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Rule:*\nrequire_auth_check"},
        {"type": "mrkdwn", "text": "*Severity:*\nHigh"},
        {"type": "mrkdwn", "text": "*Trace ID:*\nabc123"}
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "Investigate"},
          "url": "https://fluo.app/signals/sig-123"
        }
      ]
    }
  ]
}
```

**Messaging Guidance:**
- ✅ "New signal detected: `auth.required but trace.missing(auth.check)`"
- ✅ "Compliance pattern violated: SOC2 CC6.1"
- ❌ "Security threat detected: unauthorized access attempt"
- ❌ "Alert: suspicious activity in production"
