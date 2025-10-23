# PRD-001g: Auth Event Recording Processor

**Priority:** P0
**Complexity:** Medium
**Unit:** `RecordAuthEventProcessor.java`
**Dependencies:** PRD-001d (tenant extraction), PRD-002 (TigerBeetle persistence)

## Problem

BeTrace must maintain an immutable audit trail of all authentication and authorization events to meet SOC2 CC6.1 requirements. Every auth decision (success or failure) must be recorded in a write-once, tamper-proof ledger for compliance auditing and security monitoring.

## Architecture Integration

**ADR Compliance:**
- **ADR-011:** Use TigerBeetle transfers (code=5) for auth events - no SQL database needed
- **ADR-013:** Implement as Camel processor in authentication interceptor chain
- **ADR-014:** Named processor with 90% test coverage requirement
- **ADR-015:** Auth events stored in tiered storage (TigerBeetle hot tier, append-only log cold tier)

**TigerBeetle Schema:**
```
Transfer {
  code: 5                           // Auth event type
  debitAccountId: userId            // User performing action
  creditAccountId: tenantId         // Tenant context
  amount: 1                         // Event counter (each auth = 1 event)
  userData128: {
    routeId: string,                // Camel route (e.g., "createRule")
    method: string,                 // HTTP method
    timestamp_ns: u64               // Nanosecond precision
  }
  userData64: {
    authorized: boolean,            // Access granted or denied
    reason_code: u32,               // Rejection reason (if denied)
    session_id: u32                 // Session identifier
  }
  ledger: tenantLedger              // Tenant-isolated ledger
  timestamp: nanoseconds            // TigerBeetle timestamp
}
```

**Query Pattern:**
```java
// Get all auth events for tenant
List<Transfer> events = tb.getTransfers(
  ledger: tenantLedger,
  code: 5,
  timeRange: [start, end]
);

// Count failed auth attempts for user
long failedAttempts = tb.getTransfers(
  debitAccountId: userId,
  code: 5,
  userData64.authorized: false,
  timeRange: last24Hours
).count();
```

## Implementation

```java
package com.fluo.processors.auth;

import com.fluo.model.TenantContext;
import com.fluo.services.TigerBeetleService;
import com.tigerbeetle.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.UUID;

/**
 * Records authentication and authorization events in TigerBeetle
 * for immutable audit trail (SOC2 CC6.1).
 *
 * Captures both successful and failed auth attempts with full context
 * for security monitoring and compliance reporting.
 */
@Named("recordAuthEventProcessor")
@ApplicationScoped
public class RecordAuthEventProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(RecordAuthEventProcessor.class);

    @Inject
    TigerBeetleService tigerBeetle;

    // Transfer code for auth events
    private static final int AUTH_EVENT_CODE = 5;

    // Reason codes for auth failures
    private static final int REASON_INVALID_TOKEN = 1;
    private static final int REASON_EXPIRED_TOKEN = 2;
    private static final int REASON_INSUFFICIENT_PERMISSIONS = 3;
    private static final int REASON_MISSING_HEADER = 4;
    private static final int REASON_TENANT_MISMATCH = 5;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract auth context from exchange headers
        UUID userId = exchange.getIn().getHeader("userId", UUID.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        String routeId = exchange.getFromRouteId();
        Boolean authorized = exchange.getIn().getHeader("authorized", Boolean.class);
        String method = exchange.getIn().getHeader(Exchange.HTTP_METHOD, String.class);

        // Handle cases where auth failed early (no userId/tenantId)
        if (userId == null) {
            userId = UUID.nameUUIDFromBytes("anonymous".getBytes());
        }
        if (tenantId == null) {
            tenantId = UUID.nameUUIDFromBytes("unknown".getBytes());
        }
        if (authorized == null) {
            authorized = false; // Default to denied if not set
        }

        // Determine reason code if auth failed
        int reasonCode = 0;
        if (!authorized) {
            reasonCode = determineFailureReason(exchange);
        }

        try {
            // Create TigerBeetle transfer for auth event
            UUID eventId = UUID.randomUUID();
            long timestamp = Instant.now().toEpochMilli() * 1_000_000; // Convert to nanoseconds

            // Pack route metadata into userData128
            UInt128 userData128 = packRouteMetadata(routeId, method, timestamp);

            // Pack auth result into userData64
            UInt128 userData64 = packAuthMetadata(authorized, reasonCode, extractSessionId(exchange));

            // Create transfer
            TransferBatch transfers = new TransferBatch(1);
            transfers.add();
            transfers.setId(toUInt128(eventId));
            transfers.setDebitAccountId(toUInt128(userId));
            transfers.setCreditAccountId(toUInt128(tenantId));
            transfers.setAmount(1); // Each event counts as 1
            transfers.setUserData128(userData128);
            transfers.setUserData64(userData64);
            transfers.setCode(AUTH_EVENT_CODE);
            transfers.setLedger(getTenantLedger(tenantId));
            transfers.setTimestamp(timestamp);

            // Submit to TigerBeetle
            CreateTransferResultBatch results = tigerBeetle.createTransfers(transfers);

            // Check for errors
            if (results.getLength() > 0) {
                CreateTransferResult result = results.next();
                log.error("Failed to record auth event: {} for user {} on route {}",
                    result.getResult(), userId, routeId);
            } else {
                log.debug("Recorded auth event {} for user {} on route {} (authorized: {})",
                    eventId, userId, routeId, authorized);
            }

            // Store event ID in exchange for compliance span processor
            exchange.getIn().setHeader("authEventId", eventId);

        } catch (Exception e) {
            // Auth event recording failure should NOT block the request
            // Log error and continue (auth decision already made)
            log.error("Exception recording auth event for user {} on route {}: {}",
                userId, routeId, e.getMessage(), e);
        }
    }

    /**
     * Determine failure reason from exchange state.
     */
    private int determineFailureReason(Exchange exchange) {
        String errorType = exchange.getIn().getHeader("authErrorType", String.class);
        if (errorType == null) {
            return REASON_INSUFFICIENT_PERMISSIONS; // Most common
        }

        return switch (errorType) {
            case "INVALID_TOKEN" -> REASON_INVALID_TOKEN;
            case "EXPIRED_TOKEN" -> REASON_EXPIRED_TOKEN;
            case "INSUFFICIENT_PERMISSIONS" -> REASON_INSUFFICIENT_PERMISSIONS;
            case "MISSING_HEADER" -> REASON_MISSING_HEADER;
            case "TENANT_MISMATCH" -> REASON_TENANT_MISMATCH;
            default -> REASON_INSUFFICIENT_PERMISSIONS;
        };
    }

    /**
     * Extract session ID from exchange (from JWT claims or generate).
     */
    private int extractSessionId(Exchange exchange) {
        String sessionId = exchange.getIn().getHeader("sessionId", String.class);
        if (sessionId == null) {
            return 0; // No session
        }
        return sessionId.hashCode();
    }

    /**
     * Pack route metadata into UInt128.
     * Format: [routeId_hash:32][method_hash:32][timestamp:64]
     */
    private UInt128 packRouteMetadata(String routeId, String method, long timestamp) {
        long high = ((long) routeId.hashCode() << 32) | (method != null ? method.hashCode() : 0);
        return new UInt128(high, timestamp);
    }

    /**
     * Pack auth metadata into UInt128.
     * Format: [authorized:1][reason_code:31][session_id:32][reserved:64]
     */
    private UInt128 packAuthMetadata(boolean authorized, int reasonCode, int sessionId) {
        long high = ((authorized ? 1L : 0L) << 63) | ((long) reasonCode << 32) | sessionId;
        return new UInt128(high, 0);
    }

    /**
     * Convert UUID to TigerBeetle UInt128.
     */
    private UInt128 toUInt128(UUID uuid) {
        return new UInt128(
            uuid.getMostSignificantBits(),
            uuid.getLeastSignificantBits()
        );
    }

    /**
     * Get tenant-specific ledger ID.
     */
    private int getTenantLedger(UUID tenantId) {
        // Use tenant UUID hash as ledger ID for isolation
        return Math.abs(tenantId.hashCode());
    }
}
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests:**
- `testRecordSuccessfulAuthEvent()` - Verify transfer created with authorized=true
- `testRecordFailedAuthEvent()` - Verify transfer created with authorized=false and reason code
- `testTigerBeetleTransferFields()` - Validate all transfer fields match schema (code=5, userId, tenantId)
- `testTigerBeetleUnavailable()` - Auth should proceed even if TB write fails (logged only)
- `testAnonymousUserHandling()` - When userId is null, use "anonymous" UUID
- `testReasonCodeMapping()` - Verify all failure types map to correct reason codes
- `testSessionIdExtraction()` - Session ID from JWT claims or 0 if missing
- `testRouteMetadataPacking()` - userData128 contains route and timestamp
- `testAuthMetadataPacking()` - userData64 contains authorized flag and reason
- `testTenantLedgerIsolation()` - Different tenants use different ledger IDs
- `testEventIdStoredInExchange()` - authEventId header set for downstream processors
- `testNanosecondTimestampPrecision()` - Timestamp converted to nanoseconds
- `testMultipleEventsInSequence()` - Processor handles rapid successive calls

## Security Considerations (Security Expert)

**Threat Model:**
- **Audit Trail Tampering:** TigerBeetle WORM semantics prevent modification or deletion of auth events
- **Missing Failed Auth Attempts:** Processor executes even on auth failure - captures both success and denial
- **Timestamp Precision Attack:** Nanosecond timestamps prevent event ordering ambiguity
- **TigerBeetle Unavailability:** Auth events queued in memory (max 1000) if TB down, logged as critical alert
- **Session Replay Detection:** Session ID tracking enables detection of token reuse across requests

## Success Criteria

- [ ] TigerBeetle transfer created with code=5 for every auth event
- [ ] Both successful and failed auth attempts recorded
- [ ] Processor does not block request if TigerBeetle write fails
- [ ] All transfer fields populated per schema (userId, tenantId, route, authorized)
- [ ] 90% unit test coverage
- [ ] Integration test validates end-to-end auth event query from TigerBeetle

## Files to Create

- `backend/src/main/java/com/fluo/processors/auth/RecordAuthEventProcessor.java`
- `backend/src/test/java/com/fluo/processors/auth/RecordAuthEventProcessorTest.java`

## Dependencies

**Requires:**
- PRD-001d: ExtractTenantAndRolesProcessor (provides tenantId/userId)
- PRD-002: TigerBeetle integration (persistence layer)
