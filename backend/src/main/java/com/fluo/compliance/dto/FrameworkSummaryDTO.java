package com.fluo.compliance.dto;

/**
 * Summary of compliance control coverage for a specific framework (SOC2, HIPAA, etc.).
 *
 * <p>Used by PRD-004 Compliance Dashboard to display framework-level metrics.</p>
 */
public record FrameworkSummaryDTO(
    /**
     * Number of controls with evidence in last 24h.
     */
    int covered,

    /**
     * Total number of controls for this framework.
     */
    int total,

    /**
     * Coverage percentage (0.0 to 100.0).
     * Formula: (covered / total) * 100
     */
    double score
) {
    /**
     * Create framework summary with automatic score calculation.
     */
    public FrameworkSummaryDTO(int covered, int total) {
        this(covered, total, total > 0 ? (covered * 100.0) / total : 0.0);
    }
}
