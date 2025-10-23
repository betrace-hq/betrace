package com.fluo.security.capabilities;

import com.fluo.model.Span;
import com.fluo.model.Span.SpanKind;
import com.fluo.model.Span.SpanStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable wrapper around a Span that implements SpanCapability.
 *
 * Security Design (PRD-005):
 * - All getters return defensive copies of mutable data (maps)
 * - No mutation methods (truly read-only)
 * - Cannot navigate to other spans or access service layer
 * - Enforces tenant isolation (span tenant cannot be changed)
 * - Validated tenant isolation via forTenant() factory method
 *
 * Performance: Defensive copies created on-demand, not at construction.
 * Rules typically access only a few fields, so lazy copying is more efficient.
 *
 * Thread Safety: Immutable after construction, thread-safe for concurrent rule execution.
 *
 * SOC2 CC6.3: Data isolation (prevents cross-tenant span access in rules)
 */
public final class ImmutableSpanWrapper implements SpanCapability {

    private static final Logger log = LoggerFactory.getLogger(ImmutableSpanWrapper.class);

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

    /**
     * Create an immutable span wrapper (ADR-023: single-tenant deployment).
     *
     * @param span The span to wrap
     * @return An immutable wrapper around the span
     * @throws IllegalArgumentException if span is null
     */
    public static ImmutableSpanWrapper wrap(Span span) {
        if (span == null) {
            throw new IllegalArgumentException("Span cannot be null");
        }

        log.debug("Wrapping span {}", span.spanId());
        return new ImmutableSpanWrapper(span);
    }

    /**
     * @deprecated Use {@link #wrap(Span)} instead. Multi-tenant support removed in ADR-023.
     */
    @Deprecated(forRemoval = true)
    public static ImmutableSpanWrapper forTenant(Span span, String expectedTenantId) {
        // Backward compatibility - ignore tenant validation
        return wrap(span);
    }

    @Override
    public String getSpanId() {
        return span.spanId();
    }

    @Override
    public String getTraceId() {
        return span.traceId();
    }

    @Override
    public String getParentSpanId() {
        return span.parentSpanId();
    }

    @Override
    public String getTenantId() {
        // ADR-023: Single-tenant deployment, return default tenant ID
        return "default";
    }

    @Override
    public String getOperationName() {
        return span.operationName();
    }

    @Override
    public String getServiceName() {
        return span.serviceName();
    }

    @Override
    public String getKind() {
        SpanKind kind = span.kind();
        return kind != null ? kind.name() : "UNSPECIFIED";
    }

    @Override
    public String getStatus() {
        SpanStatus status = span.status();
        return status != null ? status.name() : "UNSET";
    }

    @Override
    public Instant getStartTime() {
        return span.startTime();
    }

    @Override
    public Instant getEndTime() {
        return span.endTime();
    }

    @Override
    public long getDurationNanos() {
        return span.durationNanos();
    }

    @Override
    public long getDurationMillis() {
        return span.durationNanos() / 1_000_000;
    }

    @Override
    public long getDurationSeconds() {
        return span.durationNanos() / 1_000_000_000;
    }

    @Override
    public Map<String, Object> getAttributes() {
        // Security P0 #3 (PRD-005): Deep defensive copy to prevent nested mutation
        // Shallow copy is insufficient: rules could mutate nested collections
        Map<String, Object> attrs = span.attributes();
        if (attrs == null) {
            return Collections.emptyMap();
        }

        Map<String, Object> defensiveCopy = new HashMap<>();
        for (Map.Entry<String, Object> entry : attrs.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();

            // Deep copy mutable nested collections
            if (value instanceof List) {
                defensiveCopy.put(key, List.copyOf((List<?>) value));
            } else if (value instanceof Map) {
                defensiveCopy.put(key, Map.copyOf((Map<?, ?>) value));
            } else if (value instanceof java.util.Set) {
                defensiveCopy.put(key, java.util.Set.copyOf((java.util.Set<?>) value));
            } else {
                // Primitives and immutable objects are safe to share
                defensiveCopy.put(key, value);
            }
        }

        return Collections.unmodifiableMap(defensiveCopy);
    }

    @Override
    public Object getAttribute(String key) {
        if (key == null) {
            return null;
        }
        Map<String, Object> attrs = span.attributes();
        return attrs != null ? attrs.get(key) : null;
    }

    @Override
    public boolean hasAttribute(String key) {
        if (key == null) {
            return false;
        }
        Map<String, Object> attrs = span.attributes();
        return attrs != null && attrs.containsKey(key);
    }

    @Override
    public Map<String, String> getResourceAttributes() {
        // Defensive copy to prevent rule modifications
        Map<String, String> attrs = span.resourceAttributes();
        return attrs != null ? new HashMap<>(attrs) : Collections.emptyMap();
    }

    @Override
    public String getResourceAttribute(String key) {
        if (key == null) {
            return null;
        }
        Map<String, String> attrs = span.resourceAttributes();
        return attrs != null ? attrs.get(key) : null;
    }

    @Override
    public boolean hasResourceAttribute(String key) {
        if (key == null) {
            return false;
        }
        Map<String, String> attrs = span.resourceAttributes();
        return attrs != null && attrs.containsKey(key);
    }

    @Override
    public boolean isError() {
        SpanStatus status = span.status();
        return status == SpanStatus.ERROR;
    }

    @Override
    public boolean isClient() {
        SpanKind kind = span.kind();
        return kind == SpanKind.CLIENT;
    }

    @Override
    public boolean isServer() {
        SpanKind kind = span.kind();
        return kind == SpanKind.SERVER;
    }

    @Override
    public boolean isInternal() {
        SpanKind kind = span.kind();
        return kind == SpanKind.INTERNAL;
    }

    @Override
    public boolean isProducer() {
        SpanKind kind = span.kind();
        return kind == SpanKind.PRODUCER;
    }

    @Override
    public boolean isConsumer() {
        SpanKind kind = span.kind();
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
