package com.betrace.processors.redaction;

import com.betrace.compliance.evidence.RedactionStrategy;
import com.betrace.model.PIIType;
import com.betrace.model.Span;
import com.betrace.services.RedactionService;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Applies redaction strategies to PII fields in span attributes.
 *
 * Consumes headers from previous processors:
 * - piiFields: Map<String, PIIType> - detected PII fields
 * - redactionRules: Map<PIIType, RedactionStrategy> - tenant rules (or use defaults)
 *
 * Produces headers:
 * - redactedFields: Map<String, String> - fieldName → redacted value
 * - redactedFieldCount: int - number of fields redacted
 *
 * NOTE: Works with immutable Span model - stores redacted values in exchange headers
 * for downstream processors to apply. Full Span mutation requires PRD-009 completion.
 */
@Named("applyRedactionProcessor")
@ApplicationScoped
public class ApplyRedactionProcessor implements Processor {

    @Inject
    RedactionService redactionService;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Check if PII was detected
        Boolean hasPII = exchange.getIn().getHeader("hasPII", Boolean.class);
        if (hasPII == null || !hasPII) {
            Log.trace("No PII detected, skipping redaction");
            exchange.getIn().setHeader("redactedFieldCount", 0);
            return;
        }

        // Extract span and headers
        Span span = exchange.getIn().getBody(Span.class);
        if (span == null) {
            Log.warn("No span in exchange body, skipping redaction");
            exchange.getIn().setHeader("redactedFieldCount", 0);
            return;
        }

        String tenantId = "default";
        @SuppressWarnings("unchecked")
        Map<String, PIIType> piiFields = exchange.getIn().getHeader("piiFields", Map.class);

        if (piiFields == null || piiFields.isEmpty()) {
            Log.warn("hasPII=true but piiFields is empty, skipping redaction");
            exchange.getIn().setHeader("redactedFieldCount", 0);
            return;
        }

        // Get redaction rules (or use defaults)
        @SuppressWarnings("unchecked")
        Map<PIIType, RedactionStrategy> rules = exchange.getIn().getHeader("redactionRules", Map.class);
        if (rules == null) {
            rules = getDefaultRedactionRules();
        }

        // Redact each detected PII field
        Map<String, String> redactedFields = new HashMap<>();
        int redactedCount = 0;

        for (Map.Entry<String, PIIType> entry : piiFields.entrySet()) {
            String fieldName = entry.getKey();
            PIIType piiType = entry.getValue();

            // Get original value from span attributes
            Object originalValue = span.attributes().get(fieldName);
            if (originalValue == null) {
                Log.warnf("PII field '%s' has null value, skipping", fieldName);
                continue;
            }

            String original = String.valueOf(originalValue);

            // Get redaction strategy for this PII type
            RedactionStrategy strategy = rules.getOrDefault(piiType, RedactionStrategy.HASH);

            // Apply redaction
            String redacted = redactionService.redact(original, strategy, tenantId);

            // Store redacted value
            redactedFields.put(fieldName, redacted);
            redactedCount++;

            Log.debugf("Redacted field '%s' (type: %s) using strategy %s",
                fieldName, piiType, strategy);
        }

        // Set exchange headers for downstream processors
        exchange.getIn().setHeader("redactedFields", redactedFields);
        exchange.getIn().setHeader("redactedFieldCount", redactedCount);

        if (redactedCount > 0) {
            Log.infof("Redacted %d PII fields in span: traceId=%s spanId=%s",
                redactedCount, span.traceId(), span.spanId());
        }
    }

    /**
     * Default redaction rules per PII type (used when tenant rules not loaded).
     */
    private Map<PIIType, RedactionStrategy> getDefaultRedactionRules() {
        Map<PIIType, RedactionStrategy> defaults = new HashMap<>();
        defaults.put(PIIType.EMAIL, RedactionStrategy.HASH);
        defaults.put(PIIType.SSN, RedactionStrategy.HASH);
        defaults.put(PIIType.CREDIT_CARD, RedactionStrategy.MASK);
        defaults.put(PIIType.PHONE, RedactionStrategy.MASK);
        defaults.put(PIIType.NAME, RedactionStrategy.HASH);
        defaults.put(PIIType.ADDRESS, RedactionStrategy.HASH);
        return defaults;
    }
}
