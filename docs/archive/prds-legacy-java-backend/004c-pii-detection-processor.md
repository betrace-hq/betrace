# PRD-004c: PII Detection Processor

**Priority:** P0
**Complexity:** Simple
**Unit:** `DetectPIIProcessor.java`
**Dependencies:** PRD-004a (PIIDetectionService)

## Problem

Span ingestion pipeline needs to detect PII in span attributes as a Camel processor. Detection results must be stored in exchange headers for downstream processors to consume.

## Architecture Integration

**ADR Compliance:**
- **ADR-013:** Camel-first architecture - PII detection as named processor
- **ADR-014:** Named processor with `@Named("detectPIIProcessor")`, stateless, testable

## Implementation

```java
package com.betrace.processors.redaction;

import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.Map;

import com.betrace.model.PIIType;
import com.betrace.services.PIIDetectionService;

/**
 * Camel processor that detects PII in span attributes.
 *
 * INPUT (Exchange Body):
 *   - Span object with attributes
 *
 * OUTPUT (Exchange Headers):
 *   - "piiFields" (Map<String, PIIType>) - Detected PII fields and types
 *   - "hasPII" (Boolean) - True if any PII detected
 *
 * Per ADR-014: Named processor, stateless, 90% test coverage required.
 */
@Named("detectPIIProcessor")
@ApplicationScoped
public class DetectPIIProcessor implements Processor {

    @Inject
    PIIDetectionService piiDetector;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract span from exchange body
        Span span = exchange.getIn().getBody(Span.class);

        if (span == null) {
            Log.warn("No span in exchange body, skipping PII detection");
            exchange.getIn().setHeader("hasPII", false);
            exchange.getIn().setHeader("piiFields", Map.of());
            return;
        }

        // Get span attributes
        Map<String, Object> attributes = span.getAttributes();

        if (attributes == null || attributes.isEmpty()) {
            Log.debug("Span has no attributes, skipping PII detection");
            exchange.getIn().setHeader("hasPII", false);
            exchange.getIn().setHeader("piiFields", Map.of());
            return;
        }

        // Detect PII in attributes
        Map<String, PIIType> piiFields = piiDetector.detectPII(attributes);

        // Set exchange headers for downstream processors
        boolean hasPII = !piiFields.isEmpty();
        exchange.getIn().setHeader("piiFields", piiFields);
        exchange.getIn().setHeader("hasPII", hasPII);

        if (hasPII) {
            Log.infof("Detected PII in span: traceId=%s spanId=%s fields=%d",
                span.getTraceId(), span.getSpanId(), piiFields.size());
        }
    }
}
```

```java
package com.betrace.model;

import java.util.HashMap;
import java.util.Map;

/**
 * Simplified Span model for PII detection.
 * Full implementation in PRD-009.
 */
public class Span {
    private String traceId;
    private String spanId;
    private Map<String, Object> attributes;

    public Span() {
        this.attributes = new HashMap<>();
    }

    public Span(Map<String, Object> attributes) {
        this.attributes = attributes != null ? attributes : new HashMap<>();
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getSpanId() {
        return spanId;
    }

    public void setSpanId(String spanId) {
        this.spanId = spanId;
    }

    public Map<String, Object> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, Object> attributes) {
        this.attributes = attributes;
    }
}
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests (Per ADR-014):**
- `testDetectPIIInSpan()` - Span with email attribute sets headers correctly
- `testNoPIIInSpan()` - Span with no PII sets hasPII=false
- `testMultiplePIIFields()` - Detects multiple fields, sets count correctly
- `testSetExchangeHeaders()` - Verifies "piiFields" and "hasPII" headers set
- `testNullSpan()` - Null span body handled gracefully
- `testEmptyAttributes()` - Empty attributes map handled gracefully
- `testNullAttributes()` - Null attributes handled gracefully
- `testSpanWithOnlyNonPII()` - Non-PII attributes don't trigger detection

**Edge Cases:**
- Span with no attributes
- Span with very large attribute map (1000+ entries)
- Attributes with null values
- Attributes with non-string values (numbers, booleans)

## Security Considerations (Security Expert)

**Threat Model:**
- **Processor Bypass:** Attacker skips PII detection in pipeline
  - Mitigation: Pipeline order enforced in route definition, cannot bypass
- **Header Tampering:** Downstream processor modifies "hasPII" header
  - Mitigation: Headers are immutable within exchange, Camel protects
- **DoS via Large Attributes:** Span with 10K attributes causes slowdown
  - Mitigation: Acceptable for MVP, rate limiting at ingestion layer

## Success Criteria

- [ ] Detect PII in span attributes using PIIDetectionService
- [ ] Set "piiFields" header (Map<String, PIIType>)
- [ ] Set "hasPII" header (Boolean)
- [ ] Handle null/empty spans gracefully
- [ ] Log PII detection events
- [ ] 90% test coverage (ADR-014)

## Files to Create

- `backend/src/main/java/com/betrace/processors/redaction/DetectPIIProcessor.java`
- `backend/src/main/java/com/betrace/model/Span.java` (if not exists from PRD-009)
- `backend/src/test/java/com/betrace/processors/redaction/DetectPIIProcessorTest.java`

## Dependencies

**Requires:** PRD-004a (PIIDetectionService)
**Blocks:** PRD-004d (LoadRedactionRulesProcessor reads headers set by this processor)
