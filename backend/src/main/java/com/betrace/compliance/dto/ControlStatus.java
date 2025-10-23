package com.betrace.compliance.dto;

/**
 * Status of compliance control based on evidence recency and volume.
 *
 * <p>Status determination logic (per PRD-004):</p>
 * <ul>
 *   <li>{@link #ACTIVE}: ≥10 spans/hour in last 24h</li>
 *   <li>{@link #PARTIAL}: 1-9 spans in last 24h</li>
 *   <li>{@link #NO_EVIDENCE}: 0 spans in last 24h</li>
 * </ul>
 */
public enum ControlStatus {
    /**
     * Control has active evidence generation (≥10 spans/hour).
     * Indicates healthy compliance instrumentation.
     */
    ACTIVE,

    /**
     * Control has partial evidence (<10 spans/hour).
     * Indicates low coverage or infrequent operations.
     */
    PARTIAL,

    /**
     * Control has no evidence in last 24 hours.
     * Indicates missing instrumentation or broken annotations.
     */
    NO_EVIDENCE
}
