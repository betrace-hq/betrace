package com.fluo.processors.redaction;

import com.fluo.model.Span;
import com.fluo.compliance.ComplianceSpanSigner;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.time.Instant;
import java.util.UUID;

/**
 * Generates cryptographically-signed SOC2 CC6.7 compliance spans for redaction events.
 *
 * Consumes headers:
 * - redactedFieldCount: int - number of fields redacted
 * - redactedFields: Map<String, String> - redacted field mappings
 *
 * Produces: Signed compliance span for SOC2 CC6.7 (Data Classification)
 *
 * PRD-003: Implements Ed25519 digital signatures for tamper-evident audit trails.
 * See PRD-004g for complete implementation spec.
 */
@Named("generateRedactionComplianceSpanProcessor")
@ApplicationScoped
public class GenerateRedactionComplianceSpanProcessor implements Processor {

    @Inject
    ComplianceSpanSigner signer;

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

        // Build canonical span data for signing (PRD-003)
        UUID tenantId = UUID.fromString(span.getTenantId());
        String canonicalData = signer.buildCanonicalSpanData(
            span.getTraceId(),
            span.getSpanId(),
            tenantId,
            "soc2",           // framework
            "CC6.7",          // control
            "pii_redaction",  // evidenceType
            Instant.now()
        );

        // Sign the compliance span (PRD-003)
        String signature = signer.signSpan(canonicalData, tenantId);
        boolean signatureSuccess = (signature != null);
        String signatureStatus = signer.getSignatureStatus(signatureSuccess);

        // Generate compliance evidence with signature
        if (signatureSuccess) {
            Log.infof("COMPLIANCE: SOC2 CC6.7 evidence - PII redaction applied (SIGNED) - " +
                "traceId=%s spanId=%s tenantId=%s fieldCount=%d framework=soc2 control=CC6.7 " +
                "signatureStatus=%s signatureLength=%d",
                span.getTraceId(), span.getSpanId(), span.getTenantId(), redactedCount,
                signatureStatus, signature.length());
        } else {
            Log.warnf("COMPLIANCE: SOC2 CC6.7 evidence - PII redaction applied (UNSIGNED - signing failed) - " +
                "traceId=%s spanId=%s tenantId=%s fieldCount=%d framework=soc2 control=CC6.7 " +
                "signatureStatus=%s",
                span.getTraceId(), span.getSpanId(), span.getTenantId(), redactedCount,
                signatureStatus);
        }

        exchange.getIn().setHeader("complianceSpanGenerated", true);
        exchange.getIn().setHeader("complianceSpanSigned", signatureSuccess);
        exchange.getIn().setHeader("complianceSpanSignature", signature);
        exchange.getIn().setHeader("complianceSpanSignatureStatus", signatureStatus);
    }
}
