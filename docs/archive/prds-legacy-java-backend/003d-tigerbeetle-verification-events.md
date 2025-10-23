# PRD-003d: TigerBeetle Verification Events

**Parent PRD:** PRD-003 (Compliance Span Cryptographic Signing)
**Unit:** D
**Priority:** P0
**Dependencies:** PRD-003c (Verification API Routes), PRD-002 (TigerBeetle Persistence)

## Scope

Record all signature verification events in TigerBeetle as immutable audit trail. This provides cryptographic proof of when signatures were verified, by whom, and the results. Also implements query APIs for verification history.

## Implementation

### Verification Event Processor

**`backend/src/main/java/com/fluo/processors/compliance/RecordVerificationEventProcessor.java`:**
```java
@Named("recordVerificationEventProcessor")
@ApplicationScoped
public class RecordVerificationEventProcessor implements Processor {

    @Inject
    TigerBeetleService tb;

    private static final Logger log = LoggerFactory.getLogger(RecordVerificationEventProcessor.class);

    // System account for verification events
    private static final UInt128 VERIFICATION_ACCOUNT = UInt128.asUInt128(0, 1000);

    @Override
    public void process(Exchange exchange) throws Exception {
        VerificationResult result = exchange.getIn().getBody(VerificationResult.class);

        if (result == null) {
            throw new IllegalArgumentException("VerificationResult is required");
        }

        // Record verification event in TigerBeetle as transfer
        // This creates immutable audit trail of all verifications
        UUID verificationId = UUID.randomUUID();

        UInt128 tenantAccountId = tb.toUInt128(result.tenantId());
        UInt128 verificationIdUInt128 = tb.toUInt128(verificationId);

        TBTransfer verification = new TBTransfer(
            verificationIdUInt128,                      // id
            tenantAccountId,                            // debitAccountId (tenant)
            VERIFICATION_ACCOUNT,                       // creditAccountId (system)
            1L,                                         // amount (counter)
            packVerificationMetadata(result.valid()),  // userData128
            result.timestamp().toEpochMilli(),         // userData64 (timestamp)
            4,                                          // code (verification event type)
            tb.tenantToLedgerId(result.tenantId()),    // ledger
            result.timestamp().toEpochMilli() * 1_000_000L // timestamp (nanoseconds)
        );

        CreateTransferResult tbResult = tb.createTransfer(verification);

        if (tbResult != CreateTransferResult.Ok) {
            log.error("Failed to record verification event in TigerBeetle: {}", tbResult);
            throw new RuntimeException("Failed to record verification event: " + tbResult);
        }

        log.info("Recorded verification event {} for tenant {}: {}",
            verificationId, result.tenantId(), result.valid());

        // Add verification ID to exchange for downstream use
        exchange.getIn().setHeader("verificationEventId", verificationId);
    }

    /**
     * Pack verification metadata into UInt128.
     * Format: high bits = reserved, low bit = valid (1) or invalid (0)
     */
    private UInt128 packVerificationMetadata(boolean valid) {
        long metadata = valid ? 1L : 0L;
        return UInt128.asUInt128(0, metadata);
    }
}
```

### Query Verification History Processor

**`backend/src/main/java/com/fluo/processors/compliance/QueryVerificationHistoryProcessor.java`:**
```java
@Named("queryVerificationHistoryProcessor")
@ApplicationScoped
public class QueryVerificationHistoryProcessor implements Processor {

    @Inject
    TigerBeetleService tb;

    private static final Logger log = LoggerFactory.getLogger(QueryVerificationHistoryProcessor.class);
    private static final int VERIFICATION_EVENT_TYPE = 4;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        Integer limit = exchange.getIn().getHeader("limit", Integer.class);

        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId header is required");
        }

        if (limit == null || limit <= 0) {
            limit = 100; // Default limit
        }

        List<VerificationEvent> history = getVerificationHistory(tenantId, limit);

        exchange.getIn().setBody(history);

        log.debug("Retrieved {} verification events for tenant {}", history.size(), tenantId);
    }

    /**
     * Query verification history from TigerBeetle.
     */
    private List<VerificationEvent> getVerificationHistory(UUID tenantId, int limit) {
        AccountFilter filter = new AccountFilter();
        filter.setAccountId(tb.toUInt128(tenantId));
        filter.setCode(VERIFICATION_EVENT_TYPE);
        filter.setLimit(limit);
        filter.setFlags(AccountFilterFlags.DEBITS); // Tenant is debit account

        TransferBatch transfers = tb.client.getAccountTransfers(filter);

        return transfersToVerificationEvents(transfers);
    }

    /**
     * Convert TigerBeetle transfers to VerificationEvent objects.
     */
    private List<VerificationEvent> transfersToVerificationEvents(TransferBatch transfers) {
        List<VerificationEvent> events = new ArrayList<>();

        for (TBTransfer transfer : transfers) {
            UUID verificationId = tb.fromUInt128(transfer.id());
            UUID tenantId = tb.fromUInt128(transfer.debitAccountId());
            long timestampMillis = transfer.userData64();
            boolean valid = unpackVerificationMetadata(transfer.userData128());

            VerificationEvent event = new VerificationEvent(
                verificationId,
                tenantId,
                valid,
                Instant.ofEpochMilli(timestampMillis)
            );

            events.add(event);
        }

        return events;
    }

    /**
     * Unpack verification metadata from UInt128.
     */
    private boolean unpackVerificationMetadata(UInt128 metadata) {
        return metadata.getLow() == 1L;
    }
}
```

### Update Verification Routes

**`backend/src/main/java/com/fluo/routes/ComplianceVerificationRoutes.java`:**
```java
// Add to existing ComplianceVerificationRoutes.java

@Override
public void configure() throws Exception {

    // ... existing verification routes ...

    // Add history endpoint
    rest("/api/compliance")
        .get("/verify/history/{tenantId}")
            .description("Get verification history for tenant")
            .param().name("tenantId").type(RestParamType.path).required(true).endParam()
            .param().name("limit").type(RestParamType.query).dataType("integer").defaultValue("100").endParam()
            .to("direct:getVerificationHistory");

    // Get verification history from TigerBeetle
    from("direct:getVerificationHistory")
        .routeId("getVerificationHistory")
        .log("Getting verification history for tenant ${header.tenantId}")
        .setHeader("tenantId", simple("${header.tenantId}"))
        .setHeader("limit", simple("${header.limit}"))
        .process("queryVerificationHistoryProcessor")
        .marshal().json();

    // Update verifyComplianceSpan to record events
    from("direct:verifyComplianceSpan")
        .routeId("verifyComplianceSpan")
        .log("Verifying compliance span signature")
        .process("extractComplianceAttributesProcessor")
        .process("verifySignatureProcessor")
        .process("recordVerificationEventProcessor")  // NEW: Record in TigerBeetle
        .marshal().json();
}
```

### Model Classes

**`backend/src/main/java/com/fluo/model/VerificationEvent.java`:**
```java
public record VerificationEvent(
    UUID verificationId,
    UUID tenantId,
    boolean valid,
    Instant timestamp
) {}
```

### TigerBeetle Service Extensions

**`backend/src/main/java/com/fluo/tigerbeetle/TigerBeetleService.java`:**
```java
// Add to existing TigerBeetleService.java

public static final int COMPLIANCE_SIGNATURE_TYPE = 4;

/**
 * Check if verification event exists for tenant.
 */
public boolean hasVerificationEvent(UUID tenantId, UUID verificationId) {
    AccountFilter filter = new AccountFilter();
    filter.setAccountId(toUInt128(tenantId));
    filter.setCode(COMPLIANCE_SIGNATURE_TYPE);
    filter.setLimit(1000);
    filter.setFlags(AccountFilterFlags.DEBITS);

    TransferBatch transfers = client.getAccountTransfers(filter);

    UInt128 targetId = toUInt128(verificationId);
    for (TBTransfer transfer : transfers) {
        if (transfer.id().equals(targetId)) {
            return true;
        }
    }

    return false;
}

/**
 * Convert UUID to TigerBeetle UInt128.
 */
public UInt128 toUInt128(UUID uuid) {
    return UInt128.asUInt128(uuid.getMostSignificantBits(), uuid.getLeastSignificantBits());
}

/**
 * Convert TigerBeetle UInt128 to UUID.
 */
public UUID fromUInt128(UInt128 uint128) {
    return new UUID(uint128.getHigh(), uint128.getLow());
}

/**
 * Get ledger ID for tenant.
 */
public int tenantToLedgerId(UUID tenantId) {
    // Simple hash of tenant UUID to ledger ID (0-255)
    return Math.abs(tenantId.hashCode() % 256);
}
```

## Success Criteria

- [ ] All verification events recorded in TigerBeetle
- [ ] Verification events are immutable (WORM storage)
- [ ] Query API retrieves verification history by tenant
- [ ] Verification history includes: ID, tenant, valid status, timestamp
- [ ] Failed TigerBeetle writes logged and reported
- [ ] Test coverage: 90%+

## Testing Requirements

### Unit Tests

**`backend/src/test/java/com/fluo/processors/compliance/RecordVerificationEventProcessorTest.java`:**

```java
@QuarkusTest
class RecordVerificationEventProcessorTest {

    @Inject
    @Named("recordVerificationEventProcessor")
    Processor recordProcessor;

    @InjectMock
    TigerBeetleService tb;

    private static final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should record verification event in TigerBeetle")
    void testRecordVerificationEvent() throws Exception {
        when(tb.createTransfer(any(TBTransfer.class)))
            .thenReturn(CreateTransferResult.Ok);

        VerificationResult result = new VerificationResult(
            true,
            "Signature valid",
            TEST_TENANT_ID,
            Instant.now()
        );

        Exchange exchange = createTestExchange();
        exchange.getIn().setBody(result);

        recordProcessor.process(exchange);

        verify(tb).createTransfer(any(TBTransfer.class));
        assertNotNull(exchange.getIn().getHeader("verificationEventId"));
    }

    @Test
    @DisplayName("Should throw exception when TigerBeetle write fails")
    void testTigerBeetleWriteFailure() throws Exception {
        when(tb.createTransfer(any(TBTransfer.class)))
            .thenReturn(CreateTransferResult.LinkedEventFailed);

        VerificationResult result = new VerificationResult(
            true,
            "Signature valid",
            TEST_TENANT_ID,
            Instant.now()
        );

        Exchange exchange = createTestExchange();
        exchange.getIn().setBody(result);

        assertThrows(RuntimeException.class, () -> {
            recordProcessor.process(exchange);
        });
    }

    @Test
    @DisplayName("Should pack verification metadata correctly")
    void testVerificationMetadataPacking() {
        // Test valid = true packs to 1
        // Test valid = false packs to 0
    }
}
```

**`backend/src/test/java/com/fluo/processors/compliance/QueryVerificationHistoryProcessorTest.java`:**

```java
@QuarkusTest
class QueryVerificationHistoryProcessorTest {

    @Inject
    @Named("queryVerificationHistoryProcessor")
    Processor queryProcessor;

    @InjectMock
    TigerBeetleService tb;

    private static final UUID TEST_TENANT_ID = UUID.randomUUID();

    @Test
    @DisplayName("Should query verification history from TigerBeetle")
    void testQueryVerificationHistory() throws Exception {
        // Mock TigerBeetle response
        TransferBatch mockBatch = createMockTransferBatch();
        when(tb.client.getAccountTransfers(any(AccountFilter.class)))
            .thenReturn(mockBatch);

        Exchange exchange = createTestExchange();
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);
        exchange.getIn().setHeader("limit", 100);

        queryProcessor.process(exchange);

        List<VerificationEvent> history = exchange.getIn().getBody(List.class);
        assertNotNull(history);
        assertFalse(history.isEmpty());
    }

    @Test
    @DisplayName("Should use default limit when not specified")
    void testDefaultLimit() throws Exception {
        when(tb.client.getAccountTransfers(any(AccountFilter.class)))
            .thenReturn(createMockTransferBatch());

        Exchange exchange = createTestExchange();
        exchange.getIn().setHeader("tenantId", TEST_TENANT_ID);
        // No limit header

        queryProcessor.process(exchange);

        verify(tb.client).getAccountTransfers(argThat(filter ->
            filter.getLimit() == 100
        ));
    }
}
```

### Integration Tests

**`backend/src/test/java/com/fluo/compliance/VerificationEventIntegrationTest.java`:**
```java
@QuarkusTest
class VerificationEventIntegrationTest {

    @Test
    @DisplayName("Should record and query verification events end-to-end")
    void testEndToEndVerificationEvents() {
        // Verify span (triggers event recording)
        // Query verification history
        // Assert event exists in history
    }

    @Test
    @DisplayName("Should maintain immutable audit trail")
    void testImmutableAuditTrail() {
        // Record verification event
        // Attempt to modify/delete (should fail)
        // Query again (should still exist)
    }
}
```

## Files to Create

**Processors:**
- `backend/src/main/java/com/fluo/processors/compliance/RecordVerificationEventProcessor.java`
- `backend/src/main/java/com/fluo/processors/compliance/QueryVerificationHistoryProcessor.java`

**Models:**
- `backend/src/main/java/com/fluo/model/VerificationEvent.java`

**Tests:**
- `backend/src/test/java/com/fluo/processors/compliance/RecordVerificationEventProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/compliance/QueryVerificationHistoryProcessorTest.java`
- `backend/src/test/java/com/fluo/compliance/VerificationEventIntegrationTest.java`

## Files to Modify

**Existing Files:**
- `backend/src/main/java/com/fluo/routes/ComplianceVerificationRoutes.java`
  - Add GET /verify/history/{tenantId} endpoint
  - Add recordVerificationEventProcessor to verification flow

- `backend/src/main/java/com/fluo/tigerbeetle/TigerBeetleService.java`
  - Add COMPLIANCE_SIGNATURE_TYPE constant
  - Add hasVerificationEvent() method
  - Add UUID conversion helpers (toUInt128, fromUInt128)
  - Add tenantToLedgerId() method

## Implementation Notes

### TigerBeetle Transfer Schema
- **id**: Unique verification event UUID
- **debitAccountId**: Tenant account (who verified)
- **creditAccountId**: System verification account (0, 1000)
- **amount**: 1 (counter for total verifications)
- **userData128**: Verification metadata (valid/invalid)
- **userData64**: Timestamp (milliseconds)
- **code**: 4 (verification event type)
- **ledger**: Tenant-specific ledger ID
- **timestamp**: TigerBeetle timestamp (nanoseconds)

### Immutability
- TigerBeetle transfers are WORM (Write-Once-Read-Many)
- Cannot modify or delete verification events after creation
- Provides cryptographic proof of verification history

### Query Performance
- AccountFilter limits results (default 100)
- Filter by code (4) for verification events only
- Filter by tenant for tenant-specific history
- Consider pagination for large histories

### Audit Trail Benefits
- **Non-repudiation**: Cryptographic proof of verification
- **Tamper-evidence**: Cannot modify historical events
- **Accountability**: Track who verified what and when
- **Compliance**: Auditors can verify evidence integrity

## Related ADRs

- **[ADR-011: Pure Application Framework](../adrs/011-pure-application-framework.md)** - Use TigerBeetle, not SQL
- **[ADR-012: Mathematical Tenant Isolation](../adrs/012-mathematical-tenant-isolation-architecture.md)** - Per-tenant ledgers
- **[ADR-013: Apache Camel-First Architecture](../adrs/013-apache-camel-first-architecture.md)** - History API as Camel route
