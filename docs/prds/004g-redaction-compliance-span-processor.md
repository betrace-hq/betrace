# PRD-004g: Redaction Compliance Span Processor

**Priority:** P0 (Compliance Evidence)
**Complexity:** Low
**Personas:** Compliance, Auditors
**Dependencies:** PRD-003 (ComplianceSpanProcessor), PRD-004f (RecordRedactionEventProcessor)

## Problem

PII redaction events are recorded in TigerBeetle, but **no SOC2 CC6.7 compliance evidence is generated** to prove encryption/redaction controls are effective. Without compliance spans:
- Auditors cannot verify PII protection controls
- No cryptographic proof of redaction execution
- Cannot map redaction events to SOC2 controls

**Current State:**
- `RecordRedactionEventProcessor` creates audit event → sets `redactionEventId` header
- ❌ **No compliance span generated for SOC2 CC6.7**
- ❌ No cryptographic signature linking redaction to compliance control

**Compliance Impact:** Cannot prove SOC2 CC6.7 (Encryption and Redaction of Sensitive Data) effectiveness.

## Solution

Implement `GenerateRedactionComplianceSpanProcessor` to create cryptographically signed compliance spans for every redaction event.

**Architecture (ADR-013):** Camel processor in pipeline
**Compliance (PRD-003):** Use ComplianceSpanProcessor for signing
**Control:** SOC2 CC6.7 - Encryption and Redaction of Sensitive Data

## SOC2 CC6.7 Mapping

**SOC2 CC6.7:** "The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes, and protects it during transmission, movement, or removal to meet the entity's objectives."

**Compliance Evidence:**
- **Control Activity:** Automatic PII redaction before storage/export
- **Evidence Type:** Redaction event with metadata
- **Verification:** Cryptographic signature on compliance span
- **Retention:** Compliance spans stored per ADR-015 (tiered storage)

## Implementation

### GenerateRedactionComplianceSpanProcessor.java

**Path:** `backend/src/main/java/com/fluo/processors/redaction/GenerateRedactionComplianceSpanProcessor.java`

```java
package com.fluo.processors.redaction;

import com.fluo.compliance.telemetry.ComplianceSpanProcessor;
import com.fluo.compliance.evidence.ComplianceSpan;
import com.fluo.compliance.annotations.SOC2Controls;
import com.fluo.model.Span;
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
 * Generates SOC2 CC6.7 compliance evidence for PII redaction events.
 *
 * Consumes headers:
 * - hasPII: boolean - whether PII was detected
 * - tenantId: UUID - tenant identifier
 * - redactedFieldCount: int - number of redacted fields
 * - traceId: String - OpenTelemetry trace ID
 * - redactionEventId: UUID - TigerBeetle event ID
 *
 * Produces:
 * - Compliance span with SOC2 CC6.7 control
 * - Cryptographic signature (via ComplianceSpanProcessor)
 *
 * ADR-013: Camel processor pipeline
 * ADR-014: Named processor with 90% test coverage
 * ADR-015: Compliance spans stored in tiered storage
 * PRD-003: Cryptographic signing of compliance evidence
 */
@Named("generateRedactionComplianceSpanProcessor")
@ApplicationScoped
public class GenerateRedactionComplianceSpanProcessor implements Processor {

    @Inject
    ComplianceSpanProcessor complianceSpanProcessor;

    private static final Logger log = LoggerFactory.getLogger(GenerateRedactionComplianceSpanProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        // Skip if no PII was detected/redacted
        Boolean hasPII = exchange.getIn().getHeader("hasPII", Boolean.class);
        if (hasPII == null || !hasPII) {
            log.trace("No PII detected, skipping compliance span generation");
            return;
        }

        // Extract headers from previous processors
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        Integer redactedCount = exchange.getIn().getHeader("redactedFieldCount", Integer.class);
        String traceId = exchange.getIn().getHeader("traceId", String.class);
        UUID redactionEventId = exchange.getIn().getHeader("redactionEventId", UUID.class);
        Span span = exchange.getIn().getBody(Span.class);

        if (tenantId == null) {
            throw new IllegalStateException("tenantId header is null");
        }

        if (redactedCount == null || redactedCount == 0) {
            log.warn("hasPII=true but redactedFieldCount=0, skipping compliance span");
            return;
        }

        if (traceId == null) {
            throw new IllegalStateException("traceId header is null");
        }

        if (redactionEventId == null) {
            throw new IllegalStateException("redactionEventId header is null");
        }

        // Generate SOC2 CC6.7 compliance span
        ComplianceSpan complianceSpan = complianceSpanProcessor.startComplianceSpan(
            "pii.redaction",                    // Span name
            SOC2Controls.CC6_7.class            // SOC2 CC6.7: Data Encryption/Redaction
        );

        // Set compliance attributes
        complianceSpan.setAttribute("redaction.traceId", traceId);
        complianceSpan.setAttribute("redaction.tenantId", tenantId.toString());
        complianceSpan.setAttribute("redaction.fieldsCount", redactedCount);
        complianceSpan.setAttribute("redaction.timestamp", Instant.now().toString());
        complianceSpan.setAttribute("redaction.method", "automatic");
        complianceSpan.setAttribute("redaction.eventId", redactionEventId.toString());
        complianceSpan.setAttribute("redaction.control", "SOC2_CC6_7");
        complianceSpan.setAttribute("redaction.evidence.type", "pii_redaction");

        // Link to original span if available
        if (span != null) {
            complianceSpan.setAttribute("redaction.originalSpanId", span.getSpanId());
            complianceSpan.setAttribute("redaction.serviceName", span.getServiceName());
        }

        // Sign and close compliance span
        // This generates cryptographic signature and stores span (PRD-003)
        complianceSpan.end();

        log.info("Generated SOC2 CC6.7 compliance span for redaction event {} (tenant: {}, trace: {})",
            redactionEventId, tenantId, traceId);
    }
}
```

## QA Testing

**Unit Tests (90% coverage):**

- `testGenerateComplianceSpan` - Verify span created with name "pii.redaction" and control SOC2_CC6_7
- `testSkipIfNoPII` - hasPII=false skips span generation, no processor call
- `testSkipIfZeroRedactedCount` - redactedFieldCount=0 skips span, log warning
- `testSpanAttributes` - Verify all attributes set: traceId, tenantId, fieldsCount, timestamp, method, eventId
- `testSpanSigned` - Verify complianceSpan.end() calls signing (PRD-003)
- `testLinkToOriginalSpan` - If span body present, set originalSpanId and serviceName
- `testMissingTenantId` - Throw IllegalStateException if tenantId null
- `testMissingTraceId` - Throw IllegalStateException if traceId null
- `testMissingRedactionEventId` - Throw IllegalStateException if redactionEventId null
- `testControlMapping` - Verify SOC2Controls.CC6_7 mapped to span

**Integration Tests:**

- End-to-end: Redact PII → record event → generate compliance span → verify span in storage
- Signature verification: Query compliance span, verify cryptographic signature valid
- Audit chain: Verify redactionEventId links TigerBeetle event to compliance span

## Security Threats

**Threat Model:**

1. **Evidence Forgery:** Attacker creates fake compliance spans
   - Mitigation: Cryptographic signatures (PRD-003), only ComplianceSpanProcessor can sign
2. **Missing Compliance Spans:** Redaction occurs but no compliance evidence
   - Mitigation: Enforce processor in pipeline, no skip allowed if hasPII=true
3. **Signature Bypass:** Attacker creates unsigned compliance spans
   - Mitigation: ComplianceSpanProcessor enforces signing in end() method
4. **Attribute Tampering:** Attacker modifies compliance span attributes
   - Mitigation: Signature covers all attributes, tampering invalidates signature

## Success Criteria

**Functional:**
- [ ] Compliance span generated for every redaction (hasPII=true)
- [ ] Span name: "pii.redaction"
- [ ] Control: SOC2Controls.CC6_7 (Encryption and Redaction)
- [ ] All attributes set: traceId, tenantId, fieldsCount, timestamp, method, eventId

**Compliance:**
- [ ] Span cryptographically signed (PRD-003)
- [ ] Signature verifiable by auditors
- [ ] Span stored in tiered storage (ADR-015)
- [ ] Link to TigerBeetle event via redactionEventId

**Performance:**
- [ ] Span generation <200μs per redaction
- [ ] Signing overhead <1ms (Ed25519)
- [ ] No blocking on storage write

**Testing:**
- [ ] 90% code coverage (ADR-014 compliance)
- [ ] Mock ComplianceSpanProcessor for unit tests
- [ ] Integration test with signature verification
