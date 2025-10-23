# PRD-017f: Record Notification Event Processor

**Priority:** P1 (User Workflow)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-017 (Alert and Notification System)
**Dependencies:** PRD-002 (TigerBeetle Persistence), PRD-008 (Signal Management)

## Problem

Notification delivery attempts need immutable audit trail for compliance. Without recording delivery status, there's no proof that incidents were communicated to responsible parties.

## Solution

Record all notification attempts as TigerBeetle transfers (code=11) with delivery metadata packed in userData128. Include channel type, delivery status, HTTP status code, and retry count for complete audit trail.

## Unit Description

**File:** `backend/src/main/java/com/betrace/processors/RecordNotificationEventProcessor.java`
**Type:** CDI Named Processor
**Purpose:** Record notification delivery events in TigerBeetle for immutable audit

## Implementation

```java
package com.betrace.processors;

import com.betrace.model.Signal;
import com.betrace.persistence.TigerBeetleClient;
import com.tigerbeetle.TransferBatch;
import com.tigerbeetle.UInt128;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.UUID;

@Named("recordNotificationEventProcessor")
@ApplicationScoped
public class RecordNotificationEventProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(RecordNotificationEventProcessor.class);

    private static final short CODE_NOTIFICATION_EVENT = 11;

    @Inject
    TigerBeetleClient tigerBeetleClient;

    @Override
    public void process(Exchange exchange) throws Exception {
        Signal signal = exchange.getIn().getBody(Signal.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);

        // Extract delivery results from exchange headers
        String channelType = exchange.getIn().getHeader("channelType", String.class);
        String deliveryStatus = extractDeliveryStatus(exchange, channelType);
        int httpStatus = extractHttpStatus(exchange, channelType);
        int retryCount = exchange.getIn().getHeader(channelType + "RetryCount", 0, Integer.class);

        // Record notification event in TigerBeetle
        UUID notificationEventId = recordNotificationEvent(
                tenantId,
                signal.getId(),
                channelType,
                signal.getSeverity(),
                deliveryStatus,
                httpStatus,
                retryCount
        );

        exchange.getIn().setHeader("notificationEventId", notificationEventId);

        log.info("Recorded notification event: eventId={}, signal={}, channel={}, status={}",
                notificationEventId, signal.getId(), channelType, deliveryStatus);
    }

    /**
     * Record notification event as TigerBeetle transfer (code=11)
     * @param tenantId Tenant UUID
     * @param signalId Signal that triggered notification
     * @param channelType Channel type (webhook, slack, email)
     * @param severity Signal severity
     * @param deliveryStatus Delivery status (sent, failed, skipped)
     * @param httpStatus HTTP status code (0 if not applicable)
     * @param retryCount Number of retries attempted
     * @return Notification event UUID
     */
    private UUID recordNotificationEvent(
            UUID tenantId,
            UUID signalId,
            String channelType,
            String severity,
            String deliveryStatus,
            int httpStatus,
            int retryCount
    ) throws Exception {

        UUID notificationEventId = UUID.randomUUID();

        // Pack notification metadata into userData128
        UInt128 userData128 = packNotificationMetadata(
                parseChannelType(channelType),
                parseDeliveryStatus(deliveryStatus),
                parseSeverity(severity),
                retryCount,
                httpStatus
        );

        // Create TigerBeetle transfer
        TransferBatch transfer = new TransferBatch(1);
        transfer.add();
        transfer.setId(toUInt128(notificationEventId));
        transfer.setDebitAccountId(toUInt128(signalId));     // Signal that triggered notification
        transfer.setCreditAccountId(toUInt128(tenantId));    // Tenant receiving notification
        transfer.setAmount(1);  // Notification count
        transfer.setCode(CODE_NOTIFICATION_EVENT);
        transfer.setUserData128(userData128);
        transfer.setUserData64(Instant.now().toEpochMilli());
        transfer.setLedger(tenantToLedgerId(tenantId));
        transfer.setTimestamp(Instant.now().toEpochMilli() * 1_000_000);

        tigerBeetleClient.createTransfers(transfer);

        return notificationEventId;
    }

    /**
     * Pack notification metadata into UInt128
     * Layout:
     * - channel: 8 bits (1=webhook, 2=slack, 3=email)
     * - delivery_status: 8 bits (1=sent, 2=failed, 3=skipped)
     * - severity: 8 bits (1=critical, 2=high, 3=medium, 4=low)
     * - retry_count: 8 bits (0-255)
     * - http_status: 16 bits (0-65535)
     * - reserved: 80 bits (for future use)
     */
    private UInt128 packNotificationMetadata(
            int channelType,
            int deliveryStatus,
            int severity,
            int retryCount,
            int httpStatus
    ) {
        long leastSig = 0;

        // Bit layout (least significant bits):
        // [0:8]     = channel (8 bits)
        // [8:16]    = delivery_status (8 bits)
        // [16:24]   = severity (8 bits)
        // [24:32]   = retry_count (8 bits)
        // [32:48]   = http_status (16 bits)
        // [48:128]  = reserved (80 bits)

        leastSig |= (long) (channelType & 0xFF);                    // 8 bits at position 0
        leastSig |= ((long) (deliveryStatus & 0xFF)) << 8;          // 8 bits at position 8
        leastSig |= ((long) (severity & 0xFF)) << 16;               // 8 bits at position 16
        leastSig |= ((long) (retryCount & 0xFF)) << 24;             // 8 bits at position 24
        leastSig |= ((long) (httpStatus & 0xFFFF)) << 32;           // 16 bits at position 32

        return new UInt128(0, leastSig);
    }

    private String extractDeliveryStatus(Exchange exchange, String channelType) {
        String statusHeader = channelType + "DeliveryStatus";
        return exchange.getIn().getHeader(statusHeader, "unknown", String.class);
    }

    private int extractHttpStatus(Exchange exchange, String channelType) {
        String statusHeader = channelType + "HttpStatus";
        return exchange.getIn().getHeader(statusHeader, 0, Integer.class);
    }

    private int parseChannelType(String channelType) {
        if (channelType == null) return 0;
        return switch (channelType.toLowerCase()) {
            case "webhook" -> 1;
            case "slack" -> 2;
            case "email" -> 3;
            default -> 0;
        };
    }

    private int parseDeliveryStatus(String deliveryStatus) {
        if (deliveryStatus == null) return 0;
        return switch (deliveryStatus.toLowerCase()) {
            case "sent" -> 1;
            case "failed" -> 2;
            case "skipped" -> 3;
            default -> 0;
        };
    }

    private int parseSeverity(String severity) {
        if (severity == null) return 0;
        return switch (severity.toLowerCase()) {
            case "critical" -> 1;
            case "high" -> 2;
            case "medium" -> 3;
            case "low" -> 4;
            default -> 0;
        };
    }

    private UInt128 toUInt128(UUID uuid) {
        return new UInt128(uuid.getMostSignificantBits(), uuid.getLeastSignificantBits());
    }

    private long tenantToLedgerId(UUID tenantId) {
        // Use least significant 32 bits of tenant UUID as ledger ID
        return tenantId.getLeastSignificantBits() & 0xFFFFFFFFL;
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Notification events stored as TigerBeetle transfers (code=11)
**ADR-013 (Camel-First):** Processor used in notification Camel route
**ADR-014 (Named Processors):** RecordNotificationEventProcessor is @Named
**ADR-015 (Tiered Storage):** Notification events in TigerBeetle → DuckDB → Parquet for analytics

## Test Requirements (QA Expert)

**Unit Tests:**
- testProcess_RecordsNotificationEvent - creates TigerBeetle transfer with code=11
- testPackNotificationMetadata_Webhook - packs channel=1 correctly
- testPackNotificationMetadata_Slack - packs channel=2 correctly
- testPackNotificationMetadata_Email - packs channel=3 correctly
- testPackNotificationMetadata_SentStatus - packs delivery_status=1
- testPackNotificationMetadata_FailedStatus - packs delivery_status=2
- testPackNotificationMetadata_SkippedStatus - packs delivery_status=3
- testPackNotificationMetadata_CriticalSeverity - packs severity=1
- testPackNotificationMetadata_HighSeverity - packs severity=2
- testPackNotificationMetadata_MediumSeverity - packs severity=3
- testPackNotificationMetadata_LowSeverity - packs severity=4
- testPackNotificationMetadata_RetryCount - packs retry_count (0-255)
- testPackNotificationMetadata_HttpStatus - packs http_status (0-65535)
- testExtractDeliveryStatus_FromHeaders - reads webhookDeliveryStatus header
- testExtractHttpStatus_FromHeaders - reads webhookHttpStatus header

**Integration Tests:**
- testFullWorkflow_RecordAndQuery - record event → query TigerBeetle

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Event tampering - mitigate with TigerBeetle WORM semantics
- Unauthorized access - mitigate with tenant ledger isolation
- Data leakage via audit trail - mitigate with RBAC on query APIs
- Event forgery - mitigate with immutable transfers

**Compliance:**
- SOC2 CC7.2 (System Monitoring) - immutable notification history proves incident communication
- NIST 800-53 IR-6 (Incident Reporting) - audit trail for incident notifications

## Success Criteria

- [ ] Record notification events in TigerBeetle (code=11)
- [ ] Pack metadata in userData128 (channel, status, severity, retry_count, http_status)
- [ ] Link event to signal (debitAccountId)
- [ ] Link event to tenant (creditAccountId)
- [ ] Immutable audit trail (WORM semantics)
- [ ] All tests pass with 90% coverage
