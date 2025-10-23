package com.fluo.processors.redaction;

import com.fluo.model.PIIType;
import com.fluo.model.Span;
import com.fluo.services.PIIDetectionService;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.Map;

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
        Map<String, Object> attributes = span.attributes();

        if (attributes == null || attributes.isEmpty()) {
            Log.debugf("Span has no attributes, skipping PII detection: traceId=%s spanId=%s",
                span.traceId(), span.spanId());
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
                span.traceId(), span.spanId(), piiFields.size());
        }
    }
}
