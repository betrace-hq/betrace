# PRD-014d: Test Compliance Spans

**Priority:** P1 (User Workflow)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-014 (Developer Rule Testing)
**Dependencies:** PRD-003 (Compliance Span Signing), PRD-014c (Test Result Recording)

## Problem

Test executions need to generate compliance evidence for SOC2 CC8.1 (Change Management). Without compliance spans, auditors cannot verify that rules were tested before deployment.

## Solution

Generate SOC2 CC8.1 compliance spans for every test execution, proving that change management process includes testing. Spans include rule ID, test result, and link to TigerBeetle test execution transfer.

## Unit Description

**File:** `backend/src/main/java/com/fluo/processors/GenerateTestComplianceSpanProcessor.java`
**Type:** CDI Named Processor
**Purpose:** Generate SOC2 CC8.1 compliance spans for test executions

## Implementation

```java
package com.fluo.processors;

import com.fluo.compliance.annotations.SOC2;
import com.fluo.compliance.annotations.SOC2Controls;
import com.fluo.compliance.evidence.ComplianceSpan;
import com.fluo.compliance.models.SOC2_CC8_1;
import com.fluo.services.ComplianceSpanService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Named("generateTestComplianceSpanProcessor")
@ApplicationScoped
public class GenerateTestComplianceSpanProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(GenerateTestComplianceSpanProcessor.class);

    @Inject
    ComplianceSpanService complianceSpanService;

    @Override
    @SOC2(control = SOC2Controls.CC8_1, evidenceType = "rule_testing")
    public void process(Exchange exchange) throws Exception {
        // Extract test execution details
        UUID testExecutionId = exchange.getIn().getHeader("testExecutionId", UUID.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        UUID userId = exchange.getIn().getHeader("userId", UUID.class);
        UUID ruleId = exchange.getIn().getHeader("ruleId", UUID.class);
        String ruleDsl = exchange.getIn().getHeader("ruleDsl", String.class);
        Boolean ruleFired = exchange.getIn().getHeader("ruleFired", Boolean.class);
        Integer matchedSpanCount = exchange.getIn().getHeader("matchedSpanCount", Integer.class);
        Long executionTimeMs = exchange.getIn().getHeader("executionTimeMs", Long.class);
        String traceSource = exchange.getIn().getHeader("traceSource", String.class);
        Boolean testPassed = exchange.getIn().getHeader("testPassed", Boolean.class);

        // Generate compliance span
        ComplianceSpan complianceSpan = generateTestComplianceSpan(
                testExecutionId,
                tenantId,
                userId,
                ruleId,
                ruleDsl,
                ruleFired,
                matchedSpanCount,
                executionTimeMs,
                traceSource,
                testPassed
        );

        // Emit compliance span to OpenTelemetry
        complianceSpanService.emitComplianceSpan(complianceSpan);

        log.info("Generated SOC2 CC8.1 compliance span for test execution: testId={}, ruleId={}",
                testExecutionId, ruleId);
    }

    /**
     * Generate SOC2 CC8.1 compliance span for test execution
     * @param testExecutionId Test execution UUID
     * @param tenantId Tenant UUID
     * @param userId User who ran test
     * @param ruleId Rule being tested
     * @param ruleDsl BeTrace DSL rule
     * @param ruleFired Whether rule generated signal
     * @param matchedSpanCount Number of spans matched
     * @param executionTimeMs Execution time in milliseconds
     * @param traceSource Source of trace (upload, library, production_copy)
     * @param testPassed Whether test passed
     * @return Compliance span
     */
    private ComplianceSpan generateTestComplianceSpan(
            UUID testExecutionId,
            UUID tenantId,
            UUID userId,
            UUID ruleId,
            String ruleDsl,
            Boolean ruleFired,
            Integer matchedSpanCount,
            Long executionTimeMs,
            String traceSource,
            Boolean testPassed
    ) {
        // Build compliance attributes
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("fluo.compliance.framework", "SOC2");
        attributes.put("fluo.compliance.control", "CC8.1");
        attributes.put("fluo.compliance.control_title", "Change Management - Testing");
        attributes.put("fluo.compliance.evidence_type", "rule_testing");
        attributes.put("fluo.compliance.tenant_id", tenantId.toString());

        // Test execution details
        attributes.put("fluo.test.execution_id", testExecutionId.toString());
        attributes.put("fluo.test.user_id", userId.toString());
        attributes.put("fluo.test.rule_id", ruleId.toString());
        attributes.put("fluo.test.rule_dsl", ruleDsl);
        attributes.put("fluo.test.rule_fired", ruleFired != null ? ruleFired : false);
        attributes.put("fluo.test.matched_span_count", matchedSpanCount != null ? matchedSpanCount : 0);
        attributes.put("fluo.test.execution_time_ms", executionTimeMs != null ? executionTimeMs : 0);
        attributes.put("fluo.test.trace_source", traceSource != null ? traceSource : "unknown");
        attributes.put("fluo.test.passed", testPassed != null ? testPassed : false);

        // Link to TigerBeetle test execution transfer
        attributes.put("fluo.tigerbeetle.transfer_id", testExecutionId.toString());
        attributes.put("fluo.tigerbeetle.transfer_code", 10);

        // SOC2 CC8.1 control metadata
        SOC2_CC8_1 control = new SOC2_CC8_1();
        attributes.put("fluo.compliance.control_description", control.getDescription());
        attributes.put("fluo.compliance.control_objective", control.getObjective());

        // Build compliance span
        ComplianceSpan complianceSpan = new ComplianceSpan();
        complianceSpan.setSpanId(UUID.randomUUID().toString());
        complianceSpan.setTenantId(tenantId);
        complianceSpan.setName("rule_testing");
        complianceSpan.setAttributes(attributes);
        complianceSpan.setTimestamp(System.currentTimeMillis());

        return complianceSpan;
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Compliance spans reference TigerBeetle test execution transfers
**ADR-013 (Camel-First):** Processor used in Camel route after test recording
**ADR-014 (Named Processors):** GenerateTestComplianceSpanProcessor is @Named
**ADR-015 (Tiered Storage):** Compliance spans in TigerBeetle → DuckDB → Parquet

## Compliance Span Schema

```json
{
  "span_id": "uuid",
  "tenant_id": "uuid",
  "name": "rule_testing",
  "attributes": {
    "fluo.compliance.framework": "SOC2",
    "fluo.compliance.control": "CC8.1",
    "fluo.compliance.control_title": "Change Management - Testing",
    "fluo.compliance.evidence_type": "rule_testing",
    "fluo.compliance.tenant_id": "uuid",

    "fluo.test.execution_id": "uuid",
    "fluo.test.user_id": "uuid",
    "fluo.test.rule_id": "uuid",
    "fluo.test.rule_dsl": "detect pii_leak when ...",
    "fluo.test.rule_fired": true,
    "fluo.test.matched_span_count": 3,
    "fluo.test.execution_time_ms": 125,
    "fluo.test.trace_source": "library",
    "fluo.test.passed": true,

    "fluo.tigerbeetle.transfer_id": "uuid",
    "fluo.tigerbeetle.transfer_code": 10
  },
  "timestamp": 1234567890
}
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testProcess_GeneratesComplianceSpan - creates SOC2 CC8.1 span
- testGenerateTestComplianceSpan_AllAttributes - span contains all required attributes
- testGenerateTestComplianceSpan_RuleFired - rule_fired=true when test fires
- testGenerateTestComplianceSpan_RuleDidNotFire - rule_fired=false when no match
- testGenerateTestComplianceSpan_TraceSource - includes upload/library/production_copy
- testGenerateTestComplianceSpan_TestPassed - includes testPassed boolean
- testGenerateTestComplianceSpan_LinkedToTransfer - includes TigerBeetle transfer ID
- testGenerateTestComplianceSpan_SOC2Metadata - includes control description and objective

**Integration Tests:**
- testFullWorkflow_TestExecution - execute test → record → generate compliance span → query
- testComplianceSpanSigning - compliance span is cryptographically signed (PRD-003)

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Compliance span forgery - mitigate with cryptographic signing (PRD-003)
- Missing compliance evidence - mitigate with mandatory span generation
- Attribute tampering - mitigate with span signature verification
- Audit trail gaps - mitigate with WORM semantics in TigerBeetle

**Compliance:**
- SOC2 CC8.1 (Change Management) - evidence that testing occurred before deployment
- NIST 800-53 CM-3 (Change Control) - documented testing process

## SOC2 CC8.1 Mapping

**Control Objective:** "The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives."

**Evidence Provided:**
- **Testing Requirement:** Every rule change must be tested (compliance span proves it)
- **User Attribution:** Who tested the rule (fluo.test.user_id)
- **Test Result:** Whether rule behaved as expected (fluo.test.passed)
- **Timestamp:** When testing occurred
- **Immutability:** TigerBeetle transfer + signed compliance span

**Audit Query:**
"Show me all rule changes tested before deployment in the last 90 days"

```sql
SELECT
    attributes->>'fluo.test.rule_id' AS rule_id,
    attributes->>'fluo.test.user_id' AS tester,
    attributes->>'fluo.test.passed' AS passed,
    timestamp
FROM compliance_spans
WHERE attributes->>'fluo.compliance.control' = 'CC8.1'
  AND attributes->>'fluo.compliance.evidence_type' = 'rule_testing'
  AND timestamp > NOW() - INTERVAL '90 days'
ORDER BY timestamp DESC;
```

## Success Criteria

- [ ] Generate SOC2 CC8.1 compliance span for every test execution
- [ ] Include all test execution details in span attributes
- [ ] Link compliance span to TigerBeetle test execution transfer
- [ ] Emit compliance span to OpenTelemetry
- [ ] Compliance spans are cryptographically signed (PRD-003 integration)
- [ ] All tests pass with 90% coverage
