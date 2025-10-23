# PRD-017g: Notification Compliance Span Processor

**Priority:** P1 (User Workflow)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-017 (Alert and Notification System)
**Dependencies:** PRD-003 (Compliance Span Signing), PRD-017f (Record Notification Event)

## Problem

Organizations must prove to auditors that security incidents were communicated to responsible parties. Without compliance evidence, there's no cryptographic proof that notification system is functioning correctly.

## Solution

Generate SOC2 CC7.2 compliance spans for every notification delivery. Include notification event ID, delivery status, and channel type in span attributes. Sign span with tenant's Ed25519 key for cryptographic verification.

## Unit Description

**File:** `backend/src/main/java/com/betrace/processors/GenerateNotificationComplianceSpanProcessor.java`
**Type:** CDI Named Processor
**Purpose:** Generate SOC2 CC7.2 compliance spans for notification delivery

## Implementation

```java
package com.betrace.processors;

import com.betrace.compliance.annotations.SOC2;
import com.betrace.compliance.annotations.SOC2Controls;
import com.betrace.compliance.evidence.ComplianceSpan;
import com.betrace.model.Signal;
import com.betrace.services.ComplianceSpanService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Named("generateNotificationComplianceSpanProcessor")
@ApplicationScoped
public class GenerateNotificationComplianceSpanProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(GenerateNotificationComplianceSpanProcessor.class);

    @Inject
    ComplianceSpanService complianceSpanService;

    @Override
    public void process(Exchange exchange) throws Exception {
        Signal signal = exchange.getIn().getBody(Signal.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        UUID notificationEventId = exchange.getIn().getHeader("notificationEventId", UUID.class);

        // Extract notification results
        String channelType = exchange.getIn().getHeader("channelType", String.class);
        String deliveryStatus = extractDeliveryStatus(exchange, channelType);
        Integer httpStatus = extractHttpStatus(exchange, channelType);
        Integer retryCount = exchange.getIn().getHeader(channelType + "RetryCount", 0, Integer.class);
        String errorMessage = exchange.getIn().getHeader(channelType + "ErrorMessage", String.class);

        // Generate compliance span
        ComplianceSpan complianceSpan = generateComplianceSpan(
                tenantId,
                signal,
                notificationEventId,
                channelType,
                deliveryStatus,
                httpStatus,
                retryCount,
                errorMessage
        );

        // Store in exchange for downstream processing
        exchange.getIn().setHeader("notificationComplianceSpan", complianceSpan);

        log.info("Generated notification compliance span: signal={}, channel={}, status={}",
                signal.getId(), channelType, deliveryStatus);
    }

    /**
     * Generate SOC2 CC7.2 compliance span for notification delivery
     * @param tenantId Tenant UUID
     * @param signal Signal that triggered notification
     * @param notificationEventId Notification event UUID
     * @param channelType Channel type (webhook, slack, email)
     * @param deliveryStatus Delivery status (sent, failed, skipped)
     * @param httpStatus HTTP status code (null if not applicable)
     * @param retryCount Number of retries
     * @param errorMessage Error message if failed
     * @return Compliance span
     */
    private ComplianceSpan generateComplianceSpan(
            UUID tenantId,
            Signal signal,
            UUID notificationEventId,
            String channelType,
            String deliveryStatus,
            Integer httpStatus,
            Integer retryCount,
            String errorMessage
    ) {
        Map<String, Object> attributes = new HashMap<>();

        // Compliance control
        attributes.put("compliance.framework", "SOC2");
        attributes.put("compliance.control", "CC7.2");
        attributes.put("compliance.control.description", "System Monitoring");
        attributes.put("compliance.evidence.type", "notification_delivery");

        // Notification details
        attributes.put("notification.event_id", notificationEventId.toString());
        attributes.put("notification.channel", channelType);
        attributes.put("notification.status", deliveryStatus);
        attributes.put("notification.retry_count", retryCount);

        if (httpStatus != null) {
            attributes.put("notification.http_status", httpStatus);
        }

        if (errorMessage != null && !errorMessage.isEmpty()) {
            attributes.put("notification.error", errorMessage);
        }

        // Signal context
        attributes.put("signal.id", signal.getId().toString());
        attributes.put("signal.severity", signal.getSeverity());
        attributes.put("signal.rule_name", signal.getRuleName());
        attributes.put("signal.trace_id", signal.getTraceId());

        // Tenant context
        attributes.put("tenant.id", tenantId.toString());

        // Compliance evidence
        if ("sent".equals(deliveryStatus)) {
            attributes.put("compliance.status", "PASS");
            attributes.put("compliance.finding", String.format(
                    "Signal %s (severity=%s) successfully delivered via %s on attempt %d",
                    signal.getRuleName(), signal.getSeverity(), channelType, retryCount + 1
            ));
        } else if ("failed".equals(deliveryStatus)) {
            attributes.put("compliance.status", "FAIL");
            attributes.put("compliance.finding", String.format(
                    "Signal %s (severity=%s) failed to deliver via %s after %d retries: %s",
                    signal.getRuleName(), signal.getSeverity(), channelType, retryCount, errorMessage
            ));
            attributes.put("compliance.remediation", "Review notification configuration and retry delivery");
        } else if ("skipped".equals(deliveryStatus)) {
            attributes.put("compliance.status", "SKIP");
            attributes.put("compliance.finding", String.format(
                    "Signal %s skipped notification via %s (no recipients configured or quiet hours active)",
                    signal.getRuleName(), channelType
            ));
        }

        // Create compliance span
        ComplianceSpan complianceSpan = new ComplianceSpan();
        complianceSpan.setId(UUID.randomUUID());
        complianceSpan.setTenantId(tenantId);
        complianceSpan.setSpanId(UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        complianceSpan.setTraceId(signal.getTraceId()); // Link to signal's trace
        complianceSpan.setOperationName("notification_delivery");
        complianceSpan.setServiceName("betrace-notifications");
        complianceSpan.setStartTime(Instant.now());
        complianceSpan.setEndTime(Instant.now()); // Instant operation
        complianceSpan.setAttributes(attributes);
        complianceSpan.setSignature(null); // Will be signed by ComplianceSpanService

        // Sign span (delegated to ComplianceSpanService)
        complianceSpan = complianceSpanService.signComplianceSpan(tenantId, complianceSpan);

        return complianceSpan;
    }

    private String extractDeliveryStatus(Exchange exchange, String channelType) {
        String statusHeader = channelType + "DeliveryStatus";
        return exchange.getIn().getHeader(statusHeader, "unknown", String.class);
    }

    private Integer extractHttpStatus(Exchange exchange, String channelType) {
        String statusHeader = channelType + "HttpStatus";
        return exchange.getIn().getHeader(statusHeader, Integer.class);
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Processor only - compliance spans exported to OTLP
**ADR-013 (Camel-First):** Processor used in notification Camel route
**ADR-014 (Named Processors):** GenerateNotificationComplianceSpanProcessor is @Named
**ADR-015 (Tiered Storage):** Compliance spans exported to OTLP → stored in TigerBeetle, DuckDB, Parquet

## Compliance Span Attributes

**Standard Compliance Fields:**
- `compliance.framework` = "SOC2"
- `compliance.control` = "CC7.2" (System Monitoring)
- `compliance.control.description` = "System Monitoring"
- `compliance.evidence.type` = "notification_delivery"
- `compliance.status` = "PASS" | "FAIL" | "SKIP"
- `compliance.finding` = Human-readable evidence statement

**Notification-Specific Fields:**
- `notification.event_id` = TigerBeetle notification event UUID
- `notification.channel` = "webhook" | "slack" | "email"
- `notification.status` = "sent" | "failed" | "skipped"
- `notification.retry_count` = 0-3
- `notification.http_status` = HTTP status code (if applicable)
- `notification.error` = Error message (if failed)

**Signal Context:**
- `signal.id` = Signal UUID
- `signal.severity` = "critical" | "high" | "medium" | "low"
- `signal.rule_name` = Rule that generated signal
- `signal.trace_id` = Trace ID (links compliance span to signal)

## Test Requirements (QA Expert)

**Unit Tests:**
- testProcess_SuccessfulDelivery - compliance.status=PASS for sent notification
- testProcess_FailedDelivery - compliance.status=FAIL for failed notification
- testProcess_SkippedDelivery - compliance.status=SKIP for skipped notification
- testGenerateComplianceSpan_WebhookChannel - includes webhook-specific attributes
- testGenerateComplianceSpan_SlackChannel - includes Slack-specific attributes
- testGenerateComplianceSpan_EmailChannel - includes email-specific attributes
- testGenerateComplianceSpan_WithHttpStatus - includes http_status attribute
- testGenerateComplianceSpan_WithErrorMessage - includes error attribute
- testGenerateComplianceSpan_LinksToSignalTrace - trace_id matches signal trace
- testComplianceSpan_IsSigned - signature present and valid (via ComplianceSpanService)

**Integration Tests:**
- testFullWorkflow_GenerateAndExport - generate span → verify exported to OTLP

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Error message leakage - mitigate by sanitizing error messages (no secrets)
- Signature forgery - mitigate with Ed25519 cryptographic signing
- Span tampering - mitigate with signature verification
- Compliance evidence deletion - mitigate with TigerBeetle WORM semantics

**Compliance:**
- SOC2 CC7.2 (System Monitoring) - cryptographic proof of notification delivery
- SOC2 CC6.1 (Logical Access) - signed spans prove who was notified
- NIST 800-53 IR-6 (Incident Reporting) - evidence of incident communication

## Success Criteria

- [ ] Generate compliance span for every notification delivery
- [ ] Include SOC2 CC7.2 control attributes
- [ ] Include notification event ID, channel, status, retry count
- [ ] Include signal context (ID, severity, rule name, trace ID)
- [ ] Link span to signal's trace (same trace_id)
- [ ] Sign span with tenant's Ed25519 key
- [ ] Export span to OTLP (stored in TigerBeetle, DuckDB, Parquet)
- [ ] All tests pass with 90% coverage
