package com.fluo.model;

import java.time.Instant;
import java.util.Map;
import java.util.HashMap;
import java.util.Objects;

/**
 * Span represents an OpenTelemetry span that will be evaluated against rules.
 *
 * Spans are the INPUT to the rule engine. When a span matches a rule,
 * a Signal is created as the OUTPUT.
 */
public final class Span {
    private final String spanId;
    private final String traceId;
    private final String parentSpanId;
    private final String operationName;
    private final String serviceName;
    private final Instant startTime;
    private final Instant endTime;
    private final long durationNanos;
    private final SpanKind kind;
    private final SpanStatus status;
    private final Map<String, Object> attributes;
    private final Map<String, String> resourceAttributes;
    private final String tenantId;

    public Span(
        String spanId,
        String traceId,
        String parentSpanId,
        String operationName,
        String serviceName,
        Instant startTime,
        Instant endTime,
        long durationNanos,
        SpanKind kind,
        SpanStatus status,
        Map<String, Object> attributes,
        Map<String, String> resourceAttributes,
        String tenantId
    ) {
        this.spanId = spanId;
        this.traceId = traceId;
        this.parentSpanId = parentSpanId;
        this.operationName = operationName;
        this.serviceName = serviceName;
        this.startTime = startTime;
        this.endTime = endTime;
        this.durationNanos = durationNanos;
        this.kind = kind;
        this.status = status;
        this.attributes = attributes;
        this.resourceAttributes = resourceAttributes;
        this.tenantId = tenantId;
    }

    public enum SpanKind {
        INTERNAL,
        SERVER,
        CLIENT,
        PRODUCER,
        CONSUMER
    }

    public enum SpanStatus {
        UNSET,
        OK,
        ERROR
    }

    /**
     * Create a span from incoming telemetry data
     */
    public static Span create(
        String spanId,
        String traceId,
        String operationName,
        String serviceName,
        Instant startTime,
        Instant endTime,
        Map<String, Object> attributes,
        String tenantId
    ) {
        long durationNanos = endTime.toEpochMilli() * 1_000_000 - startTime.toEpochMilli() * 1_000_000;

        return new Span(
            spanId,
            traceId,
            null,
            operationName,
            serviceName,
            startTime,
            endTime,
            durationNanos,
            SpanKind.INTERNAL,
            SpanStatus.OK,
            attributes,
            new HashMap<>(),
            tenantId
        );
    }

    /**
     * Calculate duration in milliseconds
     */
    public long durationMillis() {
        return durationNanos / 1_000_000;
    }

    /**
     * Check if span represents an error
     */
    public boolean isError() {
        return status == SpanStatus.ERROR;
    }

    /**
     * Get a flattened view of all attributes for rule evaluation
     */
    public Map<String, Object> toRuleContext() {
        Map<String, Object> context = new HashMap<>(attributes);
        context.put("spanId", spanId);
        context.put("traceId", traceId);
        context.put("operationName", operationName);
        context.put("serviceName", serviceName);
        context.put("durationMillis", durationMillis());
        context.put("isError", isError());
        context.put("spanKind", kind.name());
        context.put("status", status.name());
        context.put("tenantId", tenantId);

        // Add resource attributes with prefix
        resourceAttributes.forEach((key, value) ->
            context.put("resource." + key, value)
        );

        return context;
    }

    // Getters
    public String spanId() { return spanId; }
    public String traceId() { return traceId; }
    public String parentSpanId() { return parentSpanId; }
    public String operationName() { return operationName; }
    public String serviceName() { return serviceName; }
    public Instant startTime() { return startTime; }
    public Instant endTime() { return endTime; }
    public long durationNanos() { return durationNanos; }
    public SpanKind kind() { return kind; }
    public SpanStatus status() { return status; }
    public Map<String, Object> attributes() { return attributes; }
    public Map<String, String> resourceAttributes() { return resourceAttributes; }
    public String tenantId() { return tenantId; }

    // Legacy getter for compatibility
    public Map<String, String> getResourceAttributes() {
        return resourceAttributes;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Span span = (Span) o;
        return durationNanos == span.durationNanos &&
            Objects.equals(spanId, span.spanId) &&
            Objects.equals(traceId, span.traceId) &&
            Objects.equals(parentSpanId, span.parentSpanId) &&
            Objects.equals(operationName, span.operationName) &&
            Objects.equals(serviceName, span.serviceName) &&
            Objects.equals(startTime, span.startTime) &&
            Objects.equals(endTime, span.endTime) &&
            kind == span.kind &&
            status == span.status &&
            Objects.equals(attributes, span.attributes) &&
            Objects.equals(resourceAttributes, span.resourceAttributes) &&
            Objects.equals(tenantId, span.tenantId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(spanId, traceId, parentSpanId, operationName, serviceName,
            startTime, endTime, durationNanos, kind, status, attributes,
            resourceAttributes, tenantId);
    }

    @Override
    public String toString() {
        return "Span{" +
            "spanId='" + spanId + '\'' +
            ", traceId='" + traceId + '\'' +
            ", parentSpanId='" + parentSpanId + '\'' +
            ", operationName='" + operationName + '\'' +
            ", serviceName='" + serviceName + '\'' +
            ", startTime=" + startTime +
            ", endTime=" + endTime +
            ", durationNanos=" + durationNanos +
            ", kind=" + kind +
            ", status=" + status +
            ", attributes=" + attributes +
            ", resourceAttributes=" + resourceAttributes +
            ", tenantId='" + tenantId + '\'' +
            '}';
    }
}