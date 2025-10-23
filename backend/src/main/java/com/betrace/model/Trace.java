package com.betrace.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Trace model representing a complete distributed trace with all spans.
 * Stored in DuckDB for hot storage (last 7 days).
 */
public record Trace(
    String traceId,
    UUID tenantId,
    Instant timestamp,
    String rootSpanName,
    long durationMs,
    String serviceName,
    List<Span> spans,
    Map<String, Object> resourceAttributes
) {
    /**
     * Get span count for this trace.
     */
    public int getSpanCount() {
        return spans != null ? spans.size() : 0;
    }

    /**
     * Find root span (span with no parent).
     */
    public Span getRootSpan() {
        if (spans == null || spans.isEmpty()) {
            return null;
        }

        return spans.stream()
            .filter(span -> span.parentSpanId() == null || span.parentSpanId().isEmpty())
            .findFirst()
            .orElse(spans.get(0));
    }

    /**
     * Calculate trace duration from span timestamps (in milliseconds).
     */
    public static long calculateDuration(List<Span> spans) {
        if (spans == null || spans.isEmpty()) {
            return 0;
        }

        long minStartNanos = spans.stream()
            .map(Span::startTime)
            .mapToLong(instant -> instant.toEpochMilli() * 1_000_000)
            .min()
            .orElse(0);

        long maxEndNanos = spans.stream()
            .map(Span::endTime)
            .mapToLong(instant -> instant.toEpochMilli() * 1_000_000)
            .max()
            .orElse(0);

        return (maxEndNanos - minStartNanos) / 1_000_000; // Convert nanoseconds to milliseconds
    }
}
