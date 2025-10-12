package com.fluo.security.capabilities;

import com.fluo.model.Span;
import com.fluo.model.Span.SpanKind;
import com.fluo.model.Span.SpanStatus;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Immutable wrapper around a Span that implements SpanCapability.
 *
 * Security Design (PRD-005):
 * - All getters return defensive copies of mutable data (maps)
 * - No mutation methods (truly read-only)
 * - Cannot navigate to other spans or access service layer
 * - Enforces tenant isolation (span tenant cannot be changed)
 *
 * Performance: Defensive copies created on-demand, not at construction.
 * Rules typically access only a few fields, so lazy copying is more efficient.
 *
 * Thread Safety: Immutable after construction, thread-safe for concurrent rule execution.
 */
public final class ImmutableSpanWrapper implements SpanCapability {

    private final Span span;

    /**
     * Wrap a span in an immutable, sandboxed view.
     *
     * @param span The span to wrap
     * @throws IllegalArgumentException if span is null
     */
    public ImmutableSpanWrapper(Span span) {
        if (span == null) {
            throw new IllegalArgumentException("Span cannot be null");
        }
        this.span = span;
    }

    @Override
    public String getSpanId() {
        return span.getSpanId();
    }

    @Override
    public String getTraceId() {
        return span.getTraceId();
    }

    @Override
    public String getParentSpanId() {
        return span.getParentSpanId();
    }

    @Override
    public String getTenantId() {
        return span.getTenantId();
    }

    @Override
    public String getOperationName() {
        return span.getOperationName();
    }

    @Override
    public String getServiceName() {
        return span.getServiceName();
    }

    @Override
    public String getKind() {
        SpanKind kind = span.getKind();
        return kind != null ? kind.name() : "UNSPECIFIED";
    }

    @Override
    public String getStatus() {
        SpanStatus status = span.getStatus();
        return status != null ? status.name() : "UNSET";
    }

    @Override
    public Instant getStartTime() {
        return span.getStartTime();
    }

    @Override
    public Instant getEndTime() {
        return span.getEndTime();
    }

    @Override
    public long getDurationNanos() {
        return span.getDurationNanos();
    }

    @Override
    public long getDurationMillis() {
        return span.getDurationNanos() / 1_000_000;
    }

    @Override
    public long getDurationSeconds() {
        return span.getDurationNanos() / 1_000_000_000;
    }

    @Override
    public Map<String, Object> getAttributes() {
        // Defensive copy to prevent rule modifications
        Map<String, Object> attrs = span.getAttributes();
        return attrs != null ? new HashMap<>(attrs) : Collections.emptyMap();
    }

    @Override
    public Object getAttribute(String key) {
        if (key == null) {
            return null;
        }
        Map<String, Object> attrs = span.getAttributes();
        return attrs != null ? attrs.get(key) : null;
    }

    @Override
    public boolean hasAttribute(String key) {
        if (key == null) {
            return false;
        }
        Map<String, Object> attrs = span.getAttributes();
        return attrs != null && attrs.containsKey(key);
    }

    @Override
    public Map<String, String> getResourceAttributes() {
        // Defensive copy to prevent rule modifications
        Map<String, String> attrs = span.getResourceAttributes();
        return attrs != null ? new HashMap<>(attrs) : Collections.emptyMap();
    }

    @Override
    public String getResourceAttribute(String key) {
        if (key == null) {
            return null;
        }
        Map<String, String> attrs = span.getResourceAttributes();
        return attrs != null ? attrs.get(key) : null;
    }

    @Override
    public boolean hasResourceAttribute(String key) {
        if (key == null) {
            return false;
        }
        Map<String, String> attrs = span.getResourceAttributes();
        return attrs != null && attrs.containsKey(key);
    }

    @Override
    public boolean isError() {
        SpanStatus status = span.getStatus();
        return status == SpanStatus.ERROR;
    }

    @Override
    public boolean isClient() {
        SpanKind kind = span.getKind();
        return kind == SpanKind.CLIENT;
    }

    @Override
    public boolean isServer() {
        SpanKind kind = span.getKind();
        return kind == SpanKind.SERVER;
    }

    @Override
    public boolean isInternal() {
        SpanKind kind = span.getKind();
        return kind == SpanKind.INTERNAL;
    }

    @Override
    public boolean isProducer() {
        SpanKind kind = span.getKind();
        return kind == SpanKind.PRODUCER;
    }

    @Override
    public boolean isConsumer() {
        SpanKind kind = span.getKind();
        return kind == SpanKind.CONSUMER;
    }

    @Override
    public String toDebugString() {
        return String.format("Span{id=%s, trace=%s, operation=%s, service=%s, duration=%dms, status=%s}",
            getSpanId(),
            getTraceId(),
            getOperationName(),
            getServiceName(),
            getDurationMillis(),
            getStatus()
        );
    }

    @Override
    public String toString() {
        return toDebugString();
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof ImmutableSpanWrapper)) return false;
        ImmutableSpanWrapper other = (ImmutableSpanWrapper) obj;
        return span.equals(other.span);
    }

    @Override
    public int hashCode() {
        return span.hashCode();
    }
}
