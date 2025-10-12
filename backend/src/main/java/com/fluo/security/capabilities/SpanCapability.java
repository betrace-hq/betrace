package com.fluo.security.capabilities;

import java.time.Instant;
import java.util.Map;

/**
 * Read-only capability for accessing span data within Drools rules.
 *
 * This interface provides a sandboxed view of span data that prevents
 * rules from modifying spans or accessing internal service methods.
 *
 * Security Design (PRD-005):
 * - No mutating methods (all getters return immutable or copied data)
 * - No access to internal services or global state
 * - Cannot navigate to other spans or traces (isolation)
 * - All map returns are defensive copies
 *
 * Example Rule Usage:
 * ```
 * rule "Detect slow database query"
 * when
 *     $span: SpanCapability(
 *         operationName == "db.query",
 *         durationMillis > 1000
 *     )
 * then
 *     sandbox.createSignal("slow-query", "Database query exceeded 1s");
 * end
 * ```
 */
public interface SpanCapability {

    // Identity
    String getSpanId();
    String getTraceId();
    String getParentSpanId();
    String getTenantId();

    // Metadata
    String getOperationName();
    String getServiceName();
    String getKind();
    String getStatus();

    // Timing
    Instant getStartTime();
    Instant getEndTime();
    long getDurationNanos();
    long getDurationMillis();
    long getDurationSeconds();

    // Attributes (defensive copies only)
    Map<String, Object> getAttributes();
    Object getAttribute(String key);
    boolean hasAttribute(String key);

    // Resource Attributes (defensive copies only)
    Map<String, String> getResourceAttributes();
    String getResourceAttribute(String key);
    boolean hasResourceAttribute(String key);

    // Convenience Methods
    boolean isError();
    boolean isClient();
    boolean isServer();
    boolean isInternal();
    boolean isProducer();
    boolean isConsumer();

    // String representation for debugging
    String toDebugString();
}
