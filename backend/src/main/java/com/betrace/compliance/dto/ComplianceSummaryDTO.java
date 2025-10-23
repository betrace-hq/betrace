package com.fluo.compliance.dto;

import java.util.List;
import java.util.Map;

/**
 * Main response DTO for compliance dashboard summarizing all frameworks and controls.
 *
 * <p>PRD-004 Compliance Dashboard: Aggregates compliance evidence across frameworks
 * (SOC2, HIPAA) and provides per-control status for the last 24 hours.
 *
 * <p>Endpoint: GET /api/v1/compliance/summary?tenantId={uuid}&framework={soc2|hipaa}&hours={24}
 *
 * <p>Business Value:
 * <ul>
 *   <li>80% demo "wow moment" target via visual dashboard</li>
 *   <li>&lt;5 minutes to identify compliance gaps</li>
 *   <li>Real-time evidence visibility for auditors</li>
 * </ul>
 */
public record ComplianceSummaryDTO(
    /**
     * SOC2 framework summary (controls covered, total controls, coverage percentage).
     */
    FrameworkSummaryDTO soc2,

    /**
     * HIPAA framework summary (controls covered, total controls, coverage percentage).
     */
    FrameworkSummaryDTO hipaa,

    /**
     * Individual control summaries with evidence counts and status.
     * Includes both SOC2 and HIPAA controls unless filtered by framework parameter.
     */
    List<ControlSummaryDTO> controls,

    /**
     * Optional: Framework-specific breakdowns for extensibility.
     * Reserved for future use (ISO27001, FedRAMP, etc.).
     */
    Map<String, FrameworkSummaryDTO> frameworks
) {
    /**
     * Create summary without extended framework map (most common use case).
     */
    public ComplianceSummaryDTO(
        FrameworkSummaryDTO soc2,
        FrameworkSummaryDTO hipaa,
        List<ControlSummaryDTO> controls
    ) {
        this(soc2, hipaa, controls, Map.of("soc2", soc2, "hipaa", hipaa));
    }
}
