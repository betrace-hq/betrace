# PRD-004e: Redaction Application Processor

**Priority:** P0 (Security Gap)
**Complexity:** Medium
**Personas:** Security, Compliance
**Dependencies:** PRD-004b (RedactionService), PRD-004d (LoadRedactionRulesProcessor)

## Problem

PII fields are detected and redaction rules are loaded, but **no processor applies the actual redaction transformations** to span attributes before storage. Original PII values remain in spans and will leak to all storage tiers (span log, DuckDB, Parquet, Tempo, Grafana).

**Current State:**
- `DetectPIIProcessor` identifies PII fields → sets `piiFields` header
- `LoadRedactionRulesProcessor` loads strategies → sets `redactionRules` header
- ❌ **No processor consumes these headers to redact span attributes**
- ❌ Spans flow to storage with original PII intact

**Risk:** GDPR/HIPAA/SOC2 violation - PII exposed in all observability systems.

## Solution

Implement `ApplyRedactionProcessor` to apply redaction strategies to detected PII fields in span attributes.

**Architecture (ADR-013):** Camel processor in span ingestion pipeline
**Storage (ADR-014):** Update span attributes in-place, add metadata
**Evidence (ADR-015):** Redaction occurs before any storage tier

## Implementation

### ApplyRedactionProcessor.java

**Path:** `backend/src/main/java/com/betrace/processors/redaction/ApplyRedactionProcessor.java`

```java
package com.betrace.processors.redaction;

import com.betrace.services.RedactionService;
import com.betrace.model.RedactionStrategy;
import com.betrace.model.PIIType;
import com.betrace.model.Span;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Applies redaction strategies to PII fields in span attributes.
 *
 * Consumes headers from previous processors:
 * - piiFields: Map<String, PIIType> - detected PII fields
 * - redactionRules: Map<PIIType, RedactionStrategy> - tenant rules
 *
 * Produces headers:
 * - redactedFieldCount: int - number of fields redacted
 *
 * ADR-013: Camel processor pipeline
 * ADR-014: Named processor with 90% test coverage
 * ADR-015: Redaction before storage tiers
 */
@Named("applyRedactionProcessor")
@ApplicationScoped
public class ApplyRedactionProcessor implements Processor {

    @Inject
    RedactionService redactionService;

    private static final Logger log = LoggerFactory.getLogger(ApplyRedactionProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        // Check if PII was detected
        Boolean hasPII = exchange.getIn().getHeader("hasPII", Boolean.class);
        if (hasPII == null || !hasPII) {
            log.trace("No PII detected, skipping redaction");
            return;  // Skip if no PII
        }

        // Extract headers from previous processors
        Span span = exchange.getIn().getBody(Span.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);
        Map<String, PIIType> piiFields = exchange.getIn().getHeader("piiFields", Map.class);
        Map<PIIType, RedactionStrategy> rules = exchange.getIn().getHeader("redactionRules", Map.class);

        if (span == null) {
            throw new IllegalStateException("Span body is null");
        }

        if (tenantId == null) {
            throw new IllegalStateException("tenantId header is null");
        }

        if (piiFields == null || piiFields.isEmpty()) {
            log.warn("hasPII=true but piiFields is empty, skipping redaction");
            return;
        }

        if (rules == null || rules.isEmpty()) {
            throw new IllegalStateException("redactionRules header is null or empty");
        }

        // Create mutable copy of span attributes
        Map<String, Object> attributes = new HashMap<>(span.getAttributes());
        int redactedCount = 0;

        // Redact each detected PII field
        for (Map.Entry<String, PIIType> entry : piiFields.entrySet()) {
            String fieldName = entry.getKey();
            PIIType piiType = entry.getValue();

            // Get redaction strategy for this PII type
            RedactionStrategy strategy = rules.getOrDefault(piiType, RedactionStrategy.HASH);

            // Get original value
            Object originalValue = attributes.get(fieldName);
            if (originalValue == null) {
                log.warn("PII field {} has null value, skipping", fieldName);
                continue;
            }

            String original = String.valueOf(originalValue);

            // Apply redaction using RedactionService
            String redacted = redactionService.redact(original, strategy, tenantId);

            // Update span attributes with redacted value
            attributes.put(fieldName, redacted);

            // Add redaction metadata to span attributes
            attributes.put("redacted." + fieldName, true);
            attributes.put("redaction.strategy." + fieldName, strategy.name());
            attributes.put("redaction.pii_type." + fieldName, piiType.name());

            redactedCount++;
            log.debug("Redacted field '{}' (type: {}) using strategy {}",
                fieldName, piiType, strategy);
        }

        // Update span with redacted attributes
        span.setAttributes(attributes);

        // Add span event to record redaction
        Map<String, Object> eventAttributes = new HashMap<>();
        eventAttributes.put("pii.fields.count", redactedCount);
        eventAttributes.put("pii.detection", "automatic");
        eventAttributes.put("pii.redaction.timestamp", System.currentTimeMillis());

        span.addEvent("pii.redacted", eventAttributes);

        // Update exchange
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", redactedCount);

        log.info("Redacted {} PII fields for tenant {}", redactedCount, tenantId);
    }
}
```

## QA Testing

**Unit Tests (90% coverage):**

- `testApplyRedactionWithHashStrategy` - Redact email with HASH, verify value starts with "hash:", original not present
- `testApplyRedactionWithMaskStrategy` - Redact phone with MASK, verify partial masking
- `testApplyRedactionWithTokenizeStrategy` - Redact SSN with TOKENIZE, verify "TOK-" prefix
- `testApplyRedactionWithRemoveStrategy` - Redact field with REMOVE, verify "[REDACTED]"
- `testApplyRedactionWithEncryptStrategy` - Redact with ENCRYPT, verify "enc:" prefix
- `testSkipIfNoPII` - Span with hasPII=false skips redaction, no headers set
- `testMultipleFields` - Redact 3 fields with different strategies, all redacted
- `testMetadataAdded` - Verify redacted.{field}=true, redaction.strategy.{field}=HASH added
- `testSpanEventAdded` - Verify "pii.redacted" event added with count
- `testRedactedFieldCountHeader` - Verify redactedFieldCount header set correctly
- `testNullFieldValue` - Field with null value skipped, log warning
- `testMissingTenantId` - Throw IllegalStateException if tenantId header missing
- `testMissingRedactionRules` - Throw IllegalStateException if redactionRules header missing
- `testDefaultStrategyUsed` - If PIIType not in rules, use HASH as default

**Integration Tests:**

- End-to-end: Span with PII → DetectPII → LoadRules → ApplyRedaction → verify all fields redacted
- Multi-tenant: Different tenants with different rules, verify isolated redaction
- Pipeline: Full Camel route with redaction, verify span reaches storage with redacted values

## Security Threats

**Threat Model:**

1. **Redaction Bypass:** Attacker crafts span to skip redaction
   - Mitigation: Enforce hasPII header check, validate piiFields
2. **Original Value Leakage:** Original PII leaks via error messages or logs
   - Mitigation: Never log original values, only field names
3. **Metadata Tampering:** Attacker modifies redaction metadata
   - Mitigation: Metadata integrity verified in compliance span (PRD-003)
4. **Strategy Downgrade:** Attacker forces weak strategy (MASK instead of HASH)
   - Mitigation: Tenant rules enforced from TigerBeetle, immutable

## Success Criteria

**Functional:**
- [ ] All 5 redaction strategies apply correctly (HASH, MASK, TOKENIZE, REMOVE, ENCRYPT)
- [ ] Redacted values replace original values in span attributes
- [ ] Redaction metadata added: `redacted.{field}=true`, `redaction.strategy.{field}={strategy}`
- [ ] Span event "pii.redacted" added with count
- [ ] Header `redactedFieldCount` set for downstream processors

**Security:**
- [ ] Original PII **never exposed** after redaction (verified in logs, storage)
- [ ] Redaction occurs in-memory, no persistence of original values
- [ ] All redacted values cryptographically irreversible (except TOKENIZE, ENCRYPT)

**Performance:**
- [ ] Redaction overhead <500μs per span (5 fields)
- [ ] No memory leaks (original values garbage collected)

**Testing:**
- [ ] 90% code coverage (ADR-014 compliance)
- [ ] All redaction strategies tested
- [ ] Error handling tested (null values, missing headers)
