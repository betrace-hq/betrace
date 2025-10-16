package com.fluo.processors.redaction;

import com.fluo.model.Span;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Records redaction events to immutable audit trail.
 *
 * Consumes headers:
 * - redactedFieldCount: int - number of fields redacted
 *
 * Produces: Audit log entries for SOC2/HIPAA compliance
 *
 * NOTE: Full TigerBeetle integration pending. Currently logs for audit trail.
 * See PRD-004f for complete implementation spec.
 */
@Named("recordRedactionEventProcessor")
@ApplicationScoped
public class RecordRedactionEventProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Integer redactedCount = exchange.getIn().getHeader("redactedFieldCount", Integer.class);

        if (redactedCount == null || redactedCount == 0) {
            return; // No redaction occurred
        }

        Span span = exchange.getIn().getBody(Span.class);
        if (span == null) {
            return;
        }

        // TODO: Record to TigerBeetle for immutable audit trail (PRD-006 dependency)
        // For now, structured logging provides audit trail
        Log.infof("AUDIT: Redaction event recorded - traceId=%s spanId=%s tenantId=%s fieldCount=%d",
            span.getTraceId(), span.getSpanId(), span.getTenantId(), redactedCount);

        exchange.getIn().setHeader("auditEventRecorded", true);
    }
}
