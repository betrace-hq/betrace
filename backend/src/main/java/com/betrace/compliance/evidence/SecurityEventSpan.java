package com.fluo.compliance.evidence;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.context.Scope;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Simplified compliance span for security events (PRD-007 Unit E).
 *
 * Used for:
 * - Validation failures (SOC2 CC6.1)
 * - Rate limit violations (SOC2 CC6.1)
 * - Injection attempts (SOC2 CC7.1)
 */
public class SecurityEventSpan extends ComplianceSpan {

    private final UUID tenantId;
    private final String userId;
    private final String outcome;

    private SecurityEventSpan(Builder builder) {
        super(builder);
        this.tenantId = builder.tenantId;
        this.userId = builder.userId;
        this.outcome = builder.outcome;
    }

    @Override
    public void exportToOtel() {
        Span otelSpan = GlobalOpenTelemetry.getTracer("fluo-compliance")
            .spanBuilder("compliance.evidence")
            .setSpanKind(SpanKind.INTERNAL)
            .startSpan();

        try (Scope scope = otelSpan.makeCurrent()) {
            // Set compliance attributes
            otelSpan.setAttribute("compliance.framework", framework);
            otelSpan.setAttribute("compliance.control", control);
            otelSpan.setAttribute("compliance.evidence_type", evidenceType);
            otelSpan.setAttribute("compliance.outcome", outcome);

            if (tenantId != null) {
                otelSpan.setAttribute("compliance.tenant_id", tenantId.toString());
            }

            if (userId != null) {
                otelSpan.setAttribute("compliance.user_id", userId);
            }

            // Set event-specific attributes
            attributes.forEach((key, value) -> {
                otelSpan.setAttribute("compliance." + key, value.toString());
            });
        } finally {
            otelSpan.end();
        }
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public String getUserId() {
        return userId;
    }

    public String getOutcome() {
        return outcome;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder extends ComplianceSpan.Builder<Builder> {
        private UUID tenantId;
        private String userId;
        private String outcome;
        private byte[] signingKey;

        @Override
        protected Builder self() {
            return this;
        }

        public Builder tenantId(UUID tenantId) {
            this.tenantId = tenantId;
            return this;
        }

        public Builder userId(String userId) {
            this.userId = userId;
            return this;
        }

        public Builder outcome(String outcome) {
            this.outcome = outcome;
            return this;
        }

        public Builder attributes(Map<String, Object> attributes) {
            this.attributes.putAll(attributes);
            return this;
        }

        /**
         * Set signing key for automatic span signature generation.
         * P0 Security: Cryptographic signatures prevent tampering with compliance evidence.
         *
         * @param signingKey Tenant-specific signing key (from KMS)
         * @return this builder
         */
        public Builder signingKey(byte[] signingKey) {
            this.signingKey = signingKey;
            return this;
        }

        @Override
        public SecurityEventSpan build() {
            // Generate IDs if not provided
            if (traceId == null) {
                traceId = UUID.randomUUID().toString();
            }
            if (spanId == null) {
                spanId = UUID.randomUUID().toString();
            }

            // P0 Security: Auto-sign span if signing key provided
            if (signingKey != null && signature == null) {
                // Build temporary span to get canonical payload for signing
                SecurityEventSpan tempSpan = new SecurityEventSpan(this);
                this.signature = ComplianceSpanSigner.sign(tempSpan, signingKey);
            }

            return new SecurityEventSpan(this);
        }
    }
}
