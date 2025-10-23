package com.betrace.compliance.evidence;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.context.Scope;

import java.util.Map;

/**
 * Violation span emitted when FLUO DSL rules detect pattern violations.
 *
 * ADR-023: Single-tenant deployment (no tenantId needed)
 * ADR-026: Core competency #2 - Emit violation spans when patterns match
 *
 * Architecture:
 * - Extends ComplianceSpan for cryptographic signature support (SOC2 CC8.1)
 * - Exported to Tempo via OpenTelemetry
 * - Queryable via Grafana datasource plugin
 *
 * Usage:
 * <pre>{@code
 * ViolationSpan.builder()
 *     .ruleId("rule-123")
 *     .ruleName("High Error Rate")
 *     .severity("HIGH")
 *     .traceId("abc123")
 *     .message("Error rate exceeded threshold")
 *     .attribute("threshold", "5%")
 *     .attribute("actual", "12%")
 *     .build()
 *     .exportToOtel();
 * }</pre>
 */
public class ViolationSpan extends ComplianceSpan {

    private final String ruleId;
    private final String ruleName;
    private final String severity;
    private final String traceId;
    private final String message;

    private ViolationSpan(Builder builder) {
        super(builder);
        this.ruleId = builder.ruleId;
        this.ruleName = builder.ruleName;
        this.severity = builder.severity;
        this.traceId = builder.traceId;
        this.message = builder.message;
    }

    @Override
    public void exportToOtel() {
        Span otelSpan = GlobalOpenTelemetry.getTracer("fluo-violations")
            .spanBuilder("fluo.violation")
            .setSpanKind(SpanKind.INTERNAL)
            .startSpan();

        try (Scope scope = otelSpan.makeCurrent()) {
            // Violation attributes
            otelSpan.setAttribute("violation.rule_id", ruleId);
            otelSpan.setAttribute("violation.rule_name", ruleName);
            otelSpan.setAttribute("violation.severity", severity);
            otelSpan.setAttribute("violation.message", message);

            if (traceId != null) {
                otelSpan.setAttribute("violation.trace_id", traceId);
            }

            // Compliance framework attributes (if violation is compliance-related)
            if (framework != null) {
                otelSpan.setAttribute("compliance.framework", framework);
            }
            if (control != null) {
                otelSpan.setAttribute("compliance.control", control);
            }

            // Custom attributes from rule context
            attributes.forEach((key, value) -> {
                otelSpan.setAttribute("violation." + key, value.toString());
            });

            // Cryptographic signature for tamper-evidence (P0 security)
            if (signature != null) {
                otelSpan.setAttribute("violation.signature", signature);
            }
        } finally {
            otelSpan.end();
        }
    }

    public String getRuleId() {
        return ruleId;
    }

    public String getRuleName() {
        return ruleName;
    }

    public String getSeverity() {
        return severity;
    }

    public String getTraceId() {
        return traceId;
    }

    public String getMessage() {
        return message;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder extends ComplianceSpan.Builder<Builder> {
        private String ruleId;
        private String ruleName;
        private String severity = "MEDIUM";  // Default severity
        private String traceId;
        private String message;
        private byte[] signingKey;

        @Override
        protected Builder self() {
            return this;
        }

        public Builder ruleId(String ruleId) {
            this.ruleId = ruleId;
            return this;
        }

        public Builder ruleName(String ruleName) {
            this.ruleName = ruleName;
            return this;
        }

        public Builder severity(String severity) {
            this.severity = severity;
            return this;
        }

        public Builder traceId(String traceId) {
            this.traceId = traceId;
            return this;
        }

        public Builder message(String message) {
            this.message = message;
            return this;
        }

        /**
         * Set signing key for cryptographic signature (HMAC-SHA256).
         * ADR-023: Single signing key for deployment (not per-tenant).
         */
        public Builder signingKey(byte[] key) {
            this.signingKey = key;
            return this;
        }

        @Override
        public ViolationSpan build() {
            if (ruleId == null || ruleId.isBlank()) {
                throw new IllegalArgumentException("ruleId is required");
            }
            if (message == null || message.isBlank()) {
                throw new IllegalArgumentException("message is required");
            }

            // Sign span before building (P0 security)
            if (signingKey != null) {
                sign(signingKey);
            }

            return new ViolationSpan(this);
        }

        /**
         * Generate HMAC-SHA256 signature for violation span.
         * Prevents tampering with violation evidence (SOC2 CC8.1, HIPAA 164.312(c)(2)).
         *
         * TODO: Integrate with single-tenant signing (ADR-023)
         * For now, signatures are disabled until single-tenant KMS is implemented.
         */
        private void sign(byte[] key) {
            // Temporary: Skip signing until single-tenant KMS integration
            this.signature = null;
        }
    }
}
