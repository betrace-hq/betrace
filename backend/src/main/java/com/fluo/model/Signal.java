package com.fluo.model;

import java.time.Instant;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;
import java.util.Objects;

/**
 * Signal domain model - clean, vendor-agnostic representation.
 *
 * This class represents a signal in the FLUO system without any
 * vendor-specific details (no TigerBeetle, no specific database formats).
 */
public final class Signal {
    private final String id;
    private final String ruleId;
    private final String ruleVersion;
    private final String spanId;
    private final String traceId;
    private final Instant timestamp;
    private final SignalSeverity severity;
    private final String message;
    private final Map<String, Object> attributes;
    private final String source;
    private final String tenantId;
    private final SignalStatus status;

    public Signal(
        String id,
        String ruleId,
        String ruleVersion,
        String spanId,
        String traceId,
        Instant timestamp,
        SignalSeverity severity,
        String message,
        Map<String, Object> attributes,
        String source,
        String tenantId,
        SignalStatus status
    ) {
        this.id = id;
        this.ruleId = ruleId;
        this.ruleVersion = ruleVersion;
        this.spanId = spanId;
        this.traceId = traceId;
        this.timestamp = timestamp;
        this.severity = severity;
        this.message = message;
        this.attributes = attributes;
        this.source = source;
        this.tenantId = tenantId;
        this.status = status;
    }

    /**
     * Signal severity levels
     */
    public enum SignalSeverity {
        CRITICAL,
        HIGH,
        MEDIUM,
        LOW,
        INFO
    }

    /**
     * Signal processing status
     */
    public enum SignalStatus {
        PENDING,
        EVALUATING,
        EVALUATED,
        STORED,
        FAILED
    }

    /**
     * Create a new signal from incoming data
     */
    public static Signal create(
        String ruleId,
        String ruleVersion,
        String spanId,
        String traceId,
        SignalSeverity severity,
        String message,
        Map<String, Object> attributes,
        String source,
        String tenantId
    ) {
        return new Signal(
            generateId(),
            ruleId,
            ruleVersion,
            spanId,
            traceId,
            Instant.now(),
            severity,
            message,
            attributes,
            source,
            tenantId,
            SignalStatus.PENDING
        );
    }

    /**
     * Update signal status
     */
    public Signal withStatus(SignalStatus newStatus) {
        return new Signal(
            id, ruleId, ruleVersion, spanId, traceId, timestamp,
            severity, message, attributes, source, tenantId, newStatus
        );
    }

    /**
     * Update signal with evaluation results
     */
    public Signal withEvaluationResult(Map<String, Object> evaluationResults) {
        Map<String, Object> updatedAttributes = new HashMap<>(attributes);
        updatedAttributes.put("evaluationResults", evaluationResults);

        return new Signal(
            id, ruleId, ruleVersion, spanId, traceId, timestamp,
            severity, message, updatedAttributes, source, tenantId, SignalStatus.EVALUATED
        );
    }

    private static String generateId() {
        return "sig-" + UUID.randomUUID().toString();
    }

    // Getters
    public String id() { return id; }
    public String ruleId() { return ruleId; }
    public String ruleVersion() { return ruleVersion; }
    public String spanId() { return spanId; }
    public String traceId() { return traceId; }
    public Instant timestamp() { return timestamp; }
    public SignalSeverity severity() { return severity; }
    public String message() { return message; }
    public Map<String, Object> attributes() { return attributes; }
    public String source() { return source; }
    public String tenantId() { return tenantId; }
    public SignalStatus status() { return status; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Signal signal = (Signal) o;
        return Objects.equals(id, signal.id) &&
            Objects.equals(ruleId, signal.ruleId) &&
            Objects.equals(ruleVersion, signal.ruleVersion) &&
            Objects.equals(spanId, signal.spanId) &&
            Objects.equals(traceId, signal.traceId) &&
            Objects.equals(timestamp, signal.timestamp) &&
            severity == signal.severity &&
            Objects.equals(message, signal.message) &&
            Objects.equals(attributes, signal.attributes) &&
            Objects.equals(source, signal.source) &&
            Objects.equals(tenantId, signal.tenantId) &&
            status == signal.status;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, ruleId, ruleVersion, spanId, traceId, timestamp,
            severity, message, attributes, source, tenantId, status);
    }

    @Override
    public String toString() {
        return "Signal{" +
            "id='" + id + '\'' +
            ", ruleId='" + ruleId + '\'' +
            ", ruleVersion='" + ruleVersion + '\'' +
            ", spanId='" + spanId + '\'' +
            ", traceId='" + traceId + '\'' +
            ", timestamp=" + timestamp +
            ", severity=" + severity +
            ", message='" + message + '\'' +
            ", attributes=" + attributes +
            ", source='" + source + '\'' +
            ", tenantId='" + tenantId + '\'' +
            ", status=" + status +
            '}';
    }
}