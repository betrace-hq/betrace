package com.fluo.compliance.dto;

import java.time.Instant;
import java.util.List;

/**
 * Summary of compliance evidence for a single control (e.g., SOC2 CC6.1).
 *
 * <p>Used by PRD-004 Compliance Dashboard to display control cards with:
 * <ul>
 *   <li>Status indicator (✅ Active, ⚠️ Partial, ❌ No Evidence)</li>
 *   <li>Evidence count in last 24h</li>
 *   <li>Last evidence timestamp (relative time)</li>
 *   <li>Optional sparkline trend data (24 hourly buckets)</li>
 * </ul>
 */
public record ControlSummaryDTO(
    /**
     * Control ID (e.g., "cc6_1", "164.312(a)").
     */
    String id,

    /**
     * Human-readable control name (e.g., "Logical Access Controls").
     */
    String name,

    /**
     * Framework this control belongs to ("soc2", "hipaa", "iso27001").
     */
    String framework,

    /**
     * Number of evidence spans in last 24h.
     */
    long spanCount,

    /**
     * Timestamp of most recent evidence span, or null if never.
     */
    Instant lastEvidence,

    /**
     * Control status based on evidence recency and volume.
     */
    ControlStatus status,

    /**
     * Optional sparkline data: evidence count per hour for last 24h (0-23 buckets).
     * Null if not requested or feature disabled.
     */
    List<Integer> trendData
) {
    /**
     * Create control summary without trend data.
     */
    public ControlSummaryDTO(
        String id,
        String name,
        String framework,
        long spanCount,
        Instant lastEvidence,
        ControlStatus status
    ) {
        this(id, name, framework, spanCount, lastEvidence, status, null);
    }
}
