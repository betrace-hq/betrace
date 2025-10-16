package com.fluo.processors.redaction;

import com.fluo.model.Span;
import com.fluo.models.PIIType;
import com.fluo.models.RedactionStrategy;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Loads tenant-specific redaction rules for PII handling.
 *
 * Consumes: Span body with tenantId
 * Produces: "redactionRules" header (Map<PIIType, RedactionStrategy>)
 *
 * NOTE: Full TigerBeetle integration pending PRD-006.
 * Currently uses default redaction rules for all tenants.
 * See PRD-004d for complete implementation spec.
 */
@Named("loadRedactionRulesProcessor")
@ApplicationScoped
public class LoadRedactionRulesProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Span span = exchange.getIn().getBody(Span.class);
        if (span == null) {
            Log.warn("No span in exchange body, using default redaction rules");
            exchange.getIn().setHeader("redactionRules", getDefaultRedactionRules());
            return;
        }

        UUID tenantId = UUID.fromString(span.getTenantId());

        // TODO: Load tenant-specific rules from TigerBeetle (PRD-006 dependency)
        // For now, use default rules for all tenants
        Map<PIIType, RedactionStrategy> rules = getDefaultRedactionRules();

        Log.debugf("Loaded redaction rules for tenant %s: %s", tenantId, rules);
        exchange.getIn().setHeader("redactionRules", rules);
    }

    /**
     * Default redaction rules applied when tenant-specific rules are not configured.
     *
     * Security-focused defaults:
     * - EMAIL → HASH (preserves uniqueness for analytics without exposing actual email)
     * - SSN → REDACT (most sensitive, cannot be reconstructed)
     * - CREDIT_CARD → MASK (last 4 digits visible for user verification)
     * - PHONE → MASK (last 4 digits visible)
     * - NAME → HASH (preserves uniqueness)
     * - ADDRESS → HASH (preserves uniqueness)
     */
    private Map<PIIType, RedactionStrategy> getDefaultRedactionRules() {
        Map<PIIType, RedactionStrategy> defaults = new HashMap<>();

        // High-sensitivity PII
        defaults.put(PIIType.SSN, RedactionStrategy.REDACT);
        defaults.put(PIIType.CREDIT_CARD, RedactionStrategy.MASK);

        // Medium-sensitivity PII (preserve analytics)
        defaults.put(PIIType.EMAIL, RedactionStrategy.HASH);
        defaults.put(PIIType.PHONE, RedactionStrategy.MASK);
        defaults.put(PIIType.NAME, RedactionStrategy.HASH);
        defaults.put(PIIType.ADDRESS, RedactionStrategy.HASH);

        return defaults;
    }
}
