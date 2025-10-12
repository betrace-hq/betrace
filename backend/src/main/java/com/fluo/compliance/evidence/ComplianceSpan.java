package com.fluo.compliance.evidence;

import java.time.Instant;
import java.time.Duration;
import java.util.*;

/**
 * Base class for all immutable compliance evidence spans.
 *
 * <p>Evidence spans are write-once, immutable records that capture
 * compliance-relevant actions and their outcomes. They are automatically
 * emitted as OpenTelemetry spans with compliance attributes.</p>
 *
 * @see ComplianceEvidence
 */
public abstract class ComplianceSpan {
    /** Timestamp when evidence was created (immutable) */
    public final Instant timestamp;

    /** OpenTelemetry trace ID (for correlation) */
    public final String traceId;

    /** OpenTelemetry span ID (unique identifier) */
    public final String spanId;

    /** Parent span ID (for hierarchical evidence) */
    public final String parentSpanId;

    /** Compliance framework this evidence belongs to */
    public final String framework;

    /** Control ID this evidence demonstrates */
    public final String control;

    /** Type of evidence (audit_trail, log, metric, etc.) */
    public final String evidenceType;

    /** Operation result (success, failure, error) */
    public final String result;

    /** Duration of operation */
    public final Duration duration;

    /** Error message if result was failure */
    public final String error;

    /** Additional attributes (immutable map, validated for PII) */
    public final Map<String, Object> attributes;

    /** Cryptographic signature for tamper detection (SOC2 CC8.1, HIPAA 164.312(c)(2)) */
    public final String signature;

    protected ComplianceSpan(Builder<?> builder) {
        this.timestamp = Objects.requireNonNull(builder.timestamp, "timestamp required");
        this.traceId = Objects.requireNonNull(builder.traceId, "traceId required");
        this.spanId = Objects.requireNonNull(builder.spanId, "spanId required");
        this.parentSpanId = builder.parentSpanId;
        this.framework = Objects.requireNonNull(builder.framework, "framework required");
        this.control = Objects.requireNonNull(builder.control, "control required");
        this.evidenceType = Objects.requireNonNull(builder.evidenceType, "evidenceType required");
        this.result = builder.result != null ? builder.result : "success";
        this.duration = builder.duration;
        this.error = builder.error;

        // Security: Validate and redact attributes before storage (GDPR Art. 32, HIPAA 164.514(b))
        Map<String, Object> validatedAttributes = RedactionEnforcer.validateAndRedact(builder.attributes);
        this.attributes = Collections.unmodifiableMap(validatedAttributes);

        this.signature = builder.signature;
    }

    /**
     * Verify the signature of this compliance span.
     * Security: Detects any tampering with compliance evidence.
     *
     * @param signingKey Tenant-specific signing key (from KMS)
     * @return true if signature is valid, false if tampered or unsigned
     */
    public boolean verifySignature(byte[] signingKey) {
        if (signature == null || signature.isBlank()) {
            return false; // Unsigned spans are invalid for compliance
        }

        String expectedSignature = ComplianceSpanSigner.sign(this, signingKey);
        return signature.equals(expectedSignature);
    }

    /**
     * Export this span as OpenTelemetry span.
     * Called automatically by evidence interceptor.
     */
    public abstract void exportToOtel();

    /**
     * Base builder for compliance spans.
     */
    protected static abstract class Builder<T extends Builder<T>> {
        protected Instant timestamp = Instant.now();
        protected String traceId;
        protected String spanId;
        protected String parentSpanId;
        protected String framework;
        protected String control;
        protected String evidenceType;
        protected String result;
        protected Duration duration;
        protected String error;
        protected Map<String, Object> attributes = new HashMap<>();
        protected String signature;

        protected abstract T self();

        public T signature(String signature) {
            this.signature = signature;
            return self();
        }

        public T timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return self();
        }

        public T traceId(String traceId) {
            this.traceId = traceId;
            return self();
        }

        public T spanId(String spanId) {
            this.spanId = spanId;
            return self();
        }

        public T parentSpanId(String parentSpanId) {
            this.parentSpanId = parentSpanId;
            return self();
        }

        public T framework(String framework) {
            this.framework = framework;
            return self();
        }

        public T control(String control) {
            this.control = control;
            return self();
        }

        public T evidenceType(String evidenceType) {
            this.evidenceType = evidenceType;
            return self();
        }

        public T result(String result) {
            this.result = result;
            return self();
        }

        public T duration(Duration duration) {
            this.duration = duration;
            return self();
        }

        public T error(String error) {
            this.error = error;
            return self();
        }

        public T attribute(String key, Object value) {
            this.attributes.put(key, value);
            return self();
        }

        public abstract ComplianceSpan build();
    }
}
