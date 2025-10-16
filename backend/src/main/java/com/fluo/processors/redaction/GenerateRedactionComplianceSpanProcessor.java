package com.fluo.processors.redaction;

import com.fluo.model.Span;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Generates SOC2 CC6.7 compliance spans for redaction events.
 *
 * Consumes headers:
 * - redactedFieldCount: int - number of fields redacted
 * - redactedFields: Map<String, String> - redacted field mappings
 *
 * Produces: Compliance span for SOC2 CC6.7 (Data Classification)
 *
 * NOTE: Full ComplianceSpan integration pending PRD-003 completion.
 * Currently generates structured logs for compliance evidence.
 * See PRD-004g for complete implementation spec.
 */
@Named("generateRedactionComplianceSpanProcessor")
@ApplicationScoped
public class GenerateRedactionComplianceSpanProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Integer redactedCount = exchange.getIn().getHeader("redactedFieldCount", Integer.class);

        if (redactedCount == null || redactedCount == 0) {
            return; // No redaction occurred, no compliance span needed
        }

        Span span = exchange.getIn().getBody(Span.class);
        if (span == null) {
            return;
        }

        // TODO: Generate ComplianceSpan using ComplianceSpanEmitter (PRD-003 dependency)
        // For now, structured logging provides compliance evidence
        Log.infof("COMPLIANCE: SOC2 CC6.7 evidence - PII redaction applied - traceId=%s spanId=%s tenantId=%s fieldCount=%d framework=soc2 control=CC6.7",
            span.getTraceId(), span.getSpanId(), span.getTenantId(), redactedCount);

        exchange.getIn().setHeader("complianceSpanGenerated", true);
    }
}
