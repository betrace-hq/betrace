# PRD-004f: Redaction Event Recording Processor

**Priority:** P0 (Audit Trail)
**Complexity:** Low
**Personas:** Compliance, Security
**Dependencies:** PRD-002 (TigerBeetle), PRD-004e (ApplyRedactionProcessor)

## Problem

PII is redacted in span attributes, but **no immutable audit trail records when/where redaction occurred**. Without audit events, compliance teams cannot:
- Prove redaction effectiveness (SOC2, GDPR)
- Investigate PII exposure incidents
- Track redaction coverage across tenants

**Current State:**
- `ApplyRedactionProcessor` redacts PII → sets `redactedFieldCount` header
- ❌ **No audit record created in TigerBeetle**
- ❌ No way to query "all redaction events for tenant X in trace Y"

**Compliance Impact:** Cannot demonstrate GDPR Article 30 audit trail requirements.

## Solution

Implement `RecordRedactionEventProcessor` to create immutable TigerBeetle transfer for every redaction event.

**Architecture (ADR-011):** TigerBeetle WORM ledger for audit events (no SQL)
**Immutability:** Transfer code=6 for redaction events, cannot be deleted/modified
**Queryability:** Filter by tenantId + code to retrieve redaction history

## TigerBeetle Schema

**Redaction Event Transfer:**
```
Transfer {
  id:              UUID (redactionEventId)
  debitAccountId:  tenantId (128-bit UUID)
  creditAccountId: SYSTEM_REDACTION_ACCOUNT (constant)
  amount:          redactedFieldCount (number of fields)
  userData128:     traceId (first 128 bits of trace ID)
  userData64:      timestamp (epoch nanos)
  code:            6 (redaction event type)
  ledger:          tenantToLedgerId(tenantId)
  timestamp:       now (TigerBeetle timestamp)
}
```

**Query Pattern:**
```java
// Get all redaction events for tenant
client.getTransfers(tenantId, code=6)

// Get redaction event for specific trace
client.getTransfers(tenantId, code=6, userData128=traceId)
```

## Implementation

### RecordRedactionEventProcessor.java

**Path:** `backend/src/main/java/com/betrace/processors/redaction/RecordRedactionEventProcessor.java`

```java
package com.betrace.processors.redaction;

import com.betrace.services.TigerBeetleService;
import com.betrace.model.Span;
import com.tigerbeetle.TransferBatch;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import java.time.Instant;
import java.util.UUID;

/**
 * Records immutable redaction events in TigerBeetle ledger.
 *
 * Consumes headers:
 * - hasPII: boolean - whether PII was detected
 * - tenantId: UUID - tenant identifier
 * - redactedFieldCount: int - number of redacted fields
 * - traceId: String - OpenTelemetry trace ID
 *
 * Produces headers:
 * - redactionEventId: UUID - TigerBeetle transfer ID
 *
 * ADR-011: TigerBeetle for immutable audit events (no SQL)
 * ADR-014: Named processor with 90% test coverage
 */
@Named("recordRedactionEventProcessor")
@ApplicationScoped
public class RecordRedactionEventProcessor implements Processor {

    @Inject
    TigerBeetleService tb;

    private static final Logger log = LoggerFactory.getLogger(RecordRedactionEventProcessor.class);

    // System account for redaction events (constant)
    private static final UUID SYSTEM_REDACTION_ACCOUNT = UUID.fromString("00000000-0000-0000-0000-000000000001");

    // Transfer code for redaction events
    private static final int REDACTION_EVENT_CODE = 6;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Skip if no PII was detected/redacted
        Boolean hasPII = exchange.getIn().getHeader("hasPII", Boolean.class);
        if (hasPII == null || !hasPII) {
            log.trace("No PII detected, skipping redaction event recording");
            return;
        }

        // Extract headers from previous processors
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        Integer redactedCount = exchange.getIn().getHeader("redactedFieldCount", Integer.class);
        String traceId = exchange.getIn().getHeader("traceId", String.class);
        Span span = exchange.getIn().getBody(Span.class);

        if (tenantId == null) {
            throw new IllegalStateException("tenantId header is null");
        }

        if (redactedCount == null || redactedCount == 0) {
            log.warn("hasPII=true but redactedFieldCount=0, skipping event");
            return;
        }

        if (traceId == null) {
            throw new IllegalStateException("traceId header is null");
        }

        // Generate unique redaction event ID
        UUID redactionEventId = UUID.randomUUID();

        // Convert traceId to 128-bit UInt128 for userData128
        UInt128 traceIdBits = traceIdToUInt128(traceId);

        // Pack timestamp into userData64
        long timestamp = Instant.now().toEpochMilli() * 1_000_000;  // Convert to nanoseconds

        // Create TigerBeetle transfer for redaction event
        TransferBatch batch = new TransferBatch(1);
        batch.add();
        batch.setId(tb.toUInt128(redactionEventId));
        batch.setDebitAccountId(tb.toUInt128(tenantId));        // Tenant account
        batch.setCreditAccountId(tb.toUInt128(SYSTEM_REDACTION_ACCOUNT));  // System account
        batch.setAmount(redactedCount);                         // Number of fields redacted
        batch.setUserData128(traceIdBits);                      // Trace ID for correlation
        batch.setUserData64(timestamp);                         // Event timestamp
        batch.setCode(REDACTION_EVENT_CODE);                    // Redaction event type
        batch.setLedger(tb.tenantToLedgerId(tenantId));        // Tenant-specific ledger
        batch.setTimestamp(System.nanoTime());                  // TigerBeetle timestamp

        // Create transfer (immutable, WORM)
        tb.createTransfer(batch);

        // Set header for downstream processors
        exchange.getIn().setHeader("redactionEventId", redactionEventId);

        log.info("Recorded redaction event {} for tenant {} (trace: {}, fields: {})",
            redactionEventId, tenantId, traceId, redactedCount);
    }

    /**
     * Convert OpenTelemetry trace ID (32-char hex) to UInt128.
     * Takes first 128 bits (16 bytes) of trace ID.
     */
    private UInt128 traceIdToUInt128(String traceId) {
        if (traceId == null || traceId.length() < 32) {
            throw new IllegalArgumentException("Invalid trace ID: " + traceId);
        }

        // Take first 32 hex chars (128 bits)
        String hex = traceId.substring(0, 32);

        // Convert to bytes
        byte[] bytes = new byte[16];
        for (int i = 0; i < 16; i++) {
            bytes[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }

        // Convert to UInt128 (implementation depends on TigerBeetle client)
        return UInt128.fromBytes(bytes);
    }
}
```

## QA Testing

**Unit Tests (90% coverage):**

- `testRecordRedactionEvent` - Create transfer with correct fields, verify transfer ID in header
- `testSkipIfNoPII` - hasPII=false skips event, no TigerBeetle call
- `testSkipIfZeroRedactedCount` - redactedFieldCount=0 skips event, log warning
- `testTigerBeetleTransferFields` - Verify debitAccountId=tenantId, creditAccountId=SYSTEM, amount=count
- `testTraceIdConversion` - Convert trace ID to UInt128 correctly (first 128 bits)
- `testTimestampPacking` - userData64 contains nanosecond timestamp
- `testEventIdSet` - redactionEventId header set after creation
- `testMissingTenantId` - Throw IllegalStateException if tenantId null
- `testMissingTraceId` - Throw IllegalStateException if traceId null
- `testTransferCode` - Verify code=6 for redaction events
- `testLedgerIsolation` - Different tenants use different ledger IDs

**Integration Tests:**

- End-to-end: Redact PII → record event → query TigerBeetle for event by tenantId + code=6
- Multi-tenant: Verify events isolated per tenant, cannot query other tenant's events
- Audit trail: Redact 10 spans → verify 10 events in TigerBeetle

## Security Threats

**Threat Model:**

1. **Audit Trail Tampering:** Attacker modifies redaction events
   - Mitigation: TigerBeetle WORM ledger, transfers immutable once created
2. **Missing Events:** Redaction occurs but no event recorded (audit gap)
   - Mitigation: Enforce event creation in processor pipeline, no skipping allowed
3. **Cross-Tenant Event Access:** Attacker queries other tenant's redaction events
   - Mitigation: TigerBeetle ledger isolation, tenant cannot access other ledgers
4. **Event Replay:** Attacker replays old redaction events
   - Mitigation: TigerBeetle deduplication, same ID cannot be created twice

## Success Criteria

**Functional:**
- [ ] TigerBeetle transfer created for every redaction (code=6)
- [ ] Transfer fields correctly set: tenantId, count, traceId, timestamp
- [ ] Header `redactionEventId` set for compliance span processor
- [ ] No events created if hasPII=false or redactedFieldCount=0

**Audit Integrity:**
- [ ] Events immutable (TigerBeetle WORM guarantees)
- [ ] Events queryable by tenantId + code
- [ ] Events queryable by tenantId + traceId (userData128)
- [ ] No missing events (1:1 mapping with redactions)

**Performance:**
- [ ] TigerBeetle write latency <100μs (local) / <1ms (remote)
- [ ] No blocking on event creation (async acceptable)

**Testing:**
- [ ] 90% code coverage (ADR-014 compliance)
- [ ] TigerBeetle mock for unit tests
- [ ] Integration test with real TigerBeetle cluster
