# PRD-014c: Test Result Recording

**Priority:** P1 (User Workflow)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-014 (Developer Rule Testing)
**Dependencies:** PRD-002 (TigerBeetle Persistence), PRD-014a (Test Execution Service)

## Problem

Test executions need to be recorded for audit trail and analytics. Without immutable test history, there's no proof that rules were tested before deployment, no ability to track test coverage, and no regression test history.

## Solution

Record all test executions as TigerBeetle transfers (code=10) with test metadata packed in userData128. Store test results in DuckDB for fast querying. Provide APIs to query test history for analytics and regression testing.

## Unit Description

**File:** `backend/src/main/java/com/betrace/processors/RecordTestExecutionProcessor.java`
**Type:** CDI Named Processor
**Purpose:** Record test execution results in TigerBeetle for immutable audit trail

## Implementation

```java
package com.betrace.processors;

import com.betrace.persistence.TigerBeetleClient;
import com.betrace.services.RuleTestingService.TestExecutionResult;
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

@Named("recordTestExecutionProcessor")
@ApplicationScoped
public class RecordTestExecutionProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(RecordTestExecutionProcessor.class);

    private static final short CODE_TEST_EXECUTION = 10;

    @Inject
    TigerBeetleClient tigerBeetleClient;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract from exchange
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        UUID userId = exchange.getIn().getHeader("userId", UUID.class);
        UUID ruleId = exchange.getIn().getHeader("ruleId", UUID.class);
        TestExecutionResult testResult = exchange.getIn().getBody(TestExecutionResult.class);
        String traceSource = exchange.getIn().getHeader("traceSource", "upload", String.class);
        Boolean testPassed = exchange.getIn().getHeader("testPassed", Boolean.class);

        // Record test execution in TigerBeetle
        UUID testExecutionId = recordTestExecution(
                tenantId,
                userId,
                ruleId,
                testResult,
                traceSource,
                testPassed != null ? testPassed : testResult.ruleFired
        );

        exchange.getIn().setHeader("testExecutionId", testExecutionId);

        log.info("Recorded test execution: testId={}, ruleId={}, ruleFired={}, executionTime={}ms",
                testExecutionId, ruleId, testResult.ruleFired, testResult.executionTimeMs);
    }

    /**
     * Record test execution as TigerBeetle transfer (code=10)
     * @param tenantId Tenant UUID
     * @param userId User who ran test
     * @param ruleId Rule being tested
     * @param testResult Test execution result
     * @param traceSource Source of trace (upload, library, production_copy)
     * @param testPassed Whether developer marked test as passing
     * @return Test execution UUID
     */
    private UUID recordTestExecution(
            UUID tenantId,
            UUID userId,
            UUID ruleId,
            TestExecutionResult testResult,
            String traceSource,
            boolean testPassed
    ) throws Exception {

        UUID testExecutionId = UUID.randomUUID();

        // Pack test metadata into userData128
        UInt128 userData128 = packTestMetadata(
                testResult.ruleFired,
                testResult.matchedSpans.size(),
                testResult.executionTimeMs,
                parseTraceSource(traceSource),
                testPassed
        );

        // Create TigerBeetle transfer
        TransferBatch transfer = new TransferBatch(1);
        transfer.add();
        transfer.setId(toUInt128(testExecutionId));
        transfer.setDebitAccountId(toUInt128(userId));      // User who ran test
        transfer.setCreditAccountId(toUInt128(ruleId));     // Rule being tested
        transfer.setAmount(1);  // Test count
        transfer.setCode(CODE_TEST_EXECUTION);
        transfer.setUserData128(userData128);
        transfer.setUserData64(Instant.now().toEpochMilli());
        transfer.setLedger(tenantToLedgerId(tenantId));
        transfer.setTimestamp(Instant.now().toEpochMilli() * 1_000_000);

        tigerBeetleClient.createTransfers(transfer);

        return testExecutionId;
    }

    /**
     * Pack test metadata into UInt128
     * Layout:
     * - rule_fired: 1 bit (did rule generate signal?)
     * - matched_span_count: 15 bits (how many spans matched, max 32767)
     * - execution_time_ms: 32 bits (execution time, max 4294967295ms ~= 49 days)
     * - trace_source: 8 bits (1=upload, 2=library, 3=production_copy)
     * - test_passed: 1 bit (developer marked as passing)
     * - reserved: 71 bits (for future use)
     */
    private UInt128 packTestMetadata(
            boolean ruleFired,
            int matchedSpanCount,
            long executionTimeMs,
            int traceSource,
            boolean testPassed
    ) {
        long leastSig = 0;

        // Bit layout (least significant bits):
        // [0:1]     = rule_fired (1 bit)
        // [1:16]    = matched_span_count (15 bits)
        // [16:48]   = execution_time_ms (32 bits)
        // [48:56]   = trace_source (8 bits)
        // [56:57]   = test_passed (1 bit)
        // [57:128]  = reserved (71 bits)

        if (ruleFired) {
            leastSig |= 1L; // Set bit 0
        }

        leastSig |= ((long) matchedSpanCount & 0x7FFF) << 1;  // 15 bits at position 1
        leastSig |= (executionTimeMs & 0xFFFFFFFFL) << 16;     // 32 bits at position 16
        leastSig |= ((long) traceSource & 0xFF) << 48;         // 8 bits at position 48

        if (testPassed) {
            leastSig |= 1L << 56; // Set bit 56
        }

        return new UInt128(0, leastSig);
    }

    /**
     * Parse trace source string to numeric code
     * @param traceSource "upload", "library", or "production_copy"
     * @return Numeric code (1, 2, or 3)
     */
    private int parseTraceSource(String traceSource) {
        return switch (traceSource.toLowerCase()) {
            case "upload" -> 1;
            case "library" -> 2;
            case "production_copy" -> 3;
            default -> 1; // Default to upload
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

**Query Service:**

```java
package com.betrace.services;

import com.betrace.persistence.TigerBeetleClient;
import com.tigerbeetle.AccountFilter;
import com.tigerbeetle.TransferBatch;
import com.tigerbeetle.UInt128;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class TestHistoryService {
    private static final Logger log = LoggerFactory.getLogger(TestHistoryService.class);

    private static final short CODE_TEST_EXECUTION = 10;

    @Inject
    TigerBeetleClient tigerBeetleClient;

    /**
     * Get test history for a rule
     * @param ruleId Rule UUID
     * @return List of test execution records
     */
    public List<TestExecutionRecord> getTestHistory(UUID ruleId) throws Exception {
        // Query TigerBeetle for transfers where creditAccountId = ruleId and code = 10
        AccountFilter filter = new AccountFilter();
        filter.setAccountId(toUInt128(ruleId));
        filter.setCode(CODE_TEST_EXECUTION);

        TransferBatch transfers = tigerBeetleClient.lookupTransfers(filter);

        List<TestExecutionRecord> history = new ArrayList<>();
        for (int i = 0; i < transfers.getLength(); i++) {
            history.add(unpackTransfer(transfers, i));
        }

        log.debug("Retrieved {} test executions for rule {}", history.size(), ruleId);
        return history;
    }

    /**
     * Get test statistics for a rule
     * @param ruleId Rule UUID
     * @return Test statistics
     */
    public TestStatistics getTestStatistics(UUID ruleId) throws Exception {
        List<TestExecutionRecord> history = getTestHistory(ruleId);

        long totalTests = history.size();
        long passedTests = history.stream().filter(r -> r.testPassed).count();
        long failedTests = totalTests - passedTests;
        double passRate = totalTests > 0 ? (double) passedTests / totalTests : 0.0;

        long avgExecutionTime = history.stream()
                .mapToLong(r -> r.executionTimeMs)
                .sum() / Math.max(totalTests, 1);

        return new TestStatistics(totalTests, passedTests, failedTests, passRate, avgExecutionTime);
    }

    private TestExecutionRecord unpackTransfer(TransferBatch transfers, int index) {
        UUID testId = toUUID(transfers.getId(index));
        UUID userId = toUUID(transfers.getDebitAccountId(index));
        UUID ruleId = toUUID(transfers.getCreditAccountId(index));
        UInt128 userData128 = transfers.getUserData128(index);
        long timestamp = transfers.getUserData64(index);

        // Unpack metadata
        long leastSig = userData128.getLeastSignificant();
        boolean ruleFired = (leastSig & 1) == 1;
        int matchedSpanCount = (int) ((leastSig >> 1) & 0x7FFF);
        long executionTimeMs = (leastSig >> 16) & 0xFFFFFFFFL;
        int traceSource = (int) ((leastSig >> 48) & 0xFF);
        boolean testPassed = ((leastSig >> 56) & 1) == 1;

        return new TestExecutionRecord(
                testId,
                userId,
                ruleId,
                ruleFired,
                matchedSpanCount,
                executionTimeMs,
                parseTraceSourceCode(traceSource),
                testPassed,
                Instant.ofEpochMilli(timestamp)
        );
    }

    private String parseTraceSourceCode(int code) {
        return switch (code) {
            case 1 -> "upload";
            case 2 -> "library";
            case 3 -> "production_copy";
            default -> "unknown";
        };
    }

    private UInt128 toUInt128(UUID uuid) {
        return new UInt128(uuid.getMostSignificantBits(), uuid.getLeastSignificantBits());
    }

    private UUID toUUID(UInt128 uint128) {
        return new UUID(uint128.getMostSignificant(), uint128.getLeastSignificant());
    }

    public record TestExecutionRecord(
            UUID testId,
            UUID userId,
            UUID ruleId,
            boolean ruleFired,
            int matchedSpanCount,
            long executionTimeMs,
            String traceSource,
            boolean testPassed,
            Instant timestamp
    ) {}

    public record TestStatistics(
            long totalTests,
            long passedTests,
            long failedTests,
            double passRate,
            long avgExecutionTimeMs
    ) {}
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Test executions stored as TigerBeetle transfers (code=10)
**ADR-013 (Camel-First):** Processor used in Camel route after test execution
**ADR-014 (Named Processors):** RecordTestExecutionProcessor is @Named
**ADR-015 (Tiered Storage):** TigerBeetle → DuckDB → Parquet (test analytics)

## Test Requirements (QA Expert)

**Unit Tests:**
- testProcess_RecordsTestExecution - creates TigerBeetle transfer with code=10
- testPackTestMetadata_RuleFired - packs ruleFired=true correctly
- testPackTestMetadata_MatchedSpanCount - packs span count (max 32767)
- testPackTestMetadata_ExecutionTime - packs execution time in milliseconds
- testPackTestMetadata_TraceSource - packs upload/library/production_copy codes
- testPackTestMetadata_TestPassed - packs testPassed boolean
- testParseTraceSource_ValidCodes - converts string to numeric code
- testGetTestHistory - queries transfers for rule
- testGetTestStatistics - calculates pass rate and avg execution time
- testUnpackTransfer - unpacks userData128 correctly

**Integration Tests:**
- testFullWorkflow_RecordAndQuery - record test → query history
- testMultipleTests_Statistics - multiple tests → accurate statistics

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Test history tampering - mitigate with TigerBeetle WORM semantics
- Unauthorized test access - mitigate with tenant ledger isolation
- Test result forgery - mitigate with immutable transfers
- Data leakage via test history - mitigate with RBAC on query APIs

**Compliance:**
- SOC2 CC8.1 (Change Management) - immutable test history proves testing occurred
- NIST 800-53 CM-3 (Change Control) - audit trail for rule changes

## Success Criteria

- [ ] Record test executions in TigerBeetle (code=10)
- [ ] Pack test metadata in userData128 (rule_fired, span_count, execution_time, source, passed)
- [ ] Query test history for rule
- [ ] Calculate test statistics (pass rate, avg execution time)
- [ ] Immutable audit trail (WORM semantics)
- [ ] All tests pass with 90% coverage
