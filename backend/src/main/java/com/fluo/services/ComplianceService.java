package com.fluo.services;

import com.fluo.compliance.dto.*;
import com.fluo.model.Span;
import com.fluo.model.Trace;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * PRD-004: Compliance Dashboard Service
 *
 * <p>Business logic for compliance posture summary.
 * Separated from ComplianceApiRoute per ADR-013 (Apache Camel First Architecture).
 *
 * <p>Responsibilities:
 * - Fetch compliance spans from DuckDB
 * - Aggregate spans by control
 * - Calculate control status (ACTIVE/PARTIAL/NO_EVIDENCE)
 * - Generate framework summaries (SOC2, HIPAA)
 * - Generate sparkline trend data
 *
 * <p>Compliance:
 * - SOC2 CC7.2 (System Performance) - Monitoring compliance posture
 * - SOC2 CC8.1 (Change Management) - Tracking control effectiveness
 */
@ApplicationScoped
public class ComplianceService {

    @Inject
    DuckDBService duckDBService;

    // SOC2 control definitions
    private static final Map<String, String> SOC2_CONTROLS = Map.of(
        "cc6_1", "Logical Access Controls",
        "cc6_2", "Access Provisioning",
        "cc6_3", "Data Isolation",
        "cc6_6", "Encryption at Rest",
        "cc6_7", "Encryption in Transit",
        "cc7_1", "System Monitoring",
        "cc7_2", "System Performance",
        "cc8_1", "Change Management"
    );

    // HIPAA control definitions
    private static final Map<String, String> HIPAA_CONTROLS = Map.of(
        "164.312(a)", "Access Control",
        "164.312(b)", "Audit Controls",
        "164.312(a)(2)(i)", "Unique User Identification",
        "164.312(a)(2)(iv)", "Encryption and Decryption",
        "164.312(e)(2)(ii)", "Transmission Security"
    );

    /**
     * Get compliance summary for tenant.
     *
     * @param tenantId Tenant UUID
     * @param framework Optional framework filter ("soc2", "hipaa", or null for all)
     * @param lookbackHours Lookback period in hours (default: 24)
     * @param includeTrends Include sparkline trend data (default: false)
     * @return Compliance summary with framework and control status
     */
    public ComplianceSummaryDTO getComplianceSummary(
        UUID tenantId,
        Optional<String> framework,
        int lookbackHours,
        boolean includeTrends
    ) {
        // Calculate time range
        Instant endTime = Instant.now();
        Instant startTime = endTime.minus(lookbackHours, ChronoUnit.HOURS);

        // Fetch all compliance spans for tenant in time range
        List<Span> complianceSpans = fetchComplianceSpans(tenantId, startTime, endTime);

        Log.infof("Found %d compliance spans for tenant %s in last %d hours",
            complianceSpans.size(), tenantId, lookbackHours);

        // Aggregate spans by framework and control
        Map<String, List<Span>> spansByControl = aggregateSpansByControl(complianceSpans);

        // Filter by framework if specified
        Map<String, String> activeControls = getActiveControls(framework);

        // Generate control summaries
        List<ControlSummaryDTO> controlSummaries = generateControlSummaries(
            activeControls,
            spansByControl,
            lookbackHours,
            includeTrends,
            startTime,
            endTime
        );

        // Generate framework summaries
        FrameworkSummaryDTO soc2Summary = generateFrameworkSummary("soc2", controlSummaries);
        FrameworkSummaryDTO hipaaSummary = generateFrameworkSummary("hipaa", controlSummaries);

        // Build response
        return new ComplianceSummaryDTO(soc2Summary, hipaaSummary, controlSummaries);
    }

    /**
     * Fetch all compliance spans for tenant in time range.
     */
    private List<Span> fetchComplianceSpans(UUID tenantId, Instant startTime, Instant endTime) {
        try {
            // Query DuckDB for traces in time range
            List<Trace> traces = duckDBService.queryTraces(tenantId, startTime, endTime, 10000);

            // Flatten traces to spans and filter for compliance spans
            return traces.stream()
                .flatMap(trace -> trace.spans().stream())
                .filter(span -> span.startTime().isAfter(startTime) || span.startTime().equals(startTime))
                .filter(span -> span.endTime().isBefore(endTime) || span.endTime().equals(endTime))
                .filter(span -> span.attributes().containsKey("compliance.framework"))
                .collect(Collectors.toList());

        } catch (Exception e) {
            Log.errorf(e, "Failed to fetch compliance spans for tenant: %s", tenantId);
            return List.of();
        }
    }

    /**
     * Aggregate spans by control ID (e.g., "cc6_1", "164.312(a)").
     */
    private Map<String, List<Span>> aggregateSpansByControl(List<Span> spans) {
        return spans.stream()
            .filter(span -> span.attributes().containsKey("compliance.control"))
            .collect(Collectors.groupingBy(
                span -> (String) span.attributes().get("compliance.control")
            ));
    }

    /**
     * Get active controls based on framework filter.
     */
    private Map<String, String> getActiveControls(Optional<String> framework) {
        if (framework.isEmpty()) {
            // Return all controls
            Map<String, String> allControls = new HashMap<>();
            allControls.putAll(SOC2_CONTROLS);
            allControls.putAll(HIPAA_CONTROLS);
            return allControls;
        } else if ("soc2".equalsIgnoreCase(framework.get())) {
            return SOC2_CONTROLS;
        } else if ("hipaa".equalsIgnoreCase(framework.get())) {
            return HIPAA_CONTROLS;
        } else {
            return Map.of();
        }
    }

    /**
     * Generate control summaries with status determination.
     */
    private List<ControlSummaryDTO> generateControlSummaries(
        Map<String, String> controls,
        Map<String, List<Span>> spansByControl,
        int lookbackHours,
        boolean includeTrends,
        Instant startTime,
        Instant endTime
    ) {
        return controls.entrySet().stream()
            .map(entry -> {
                String controlId = entry.getKey();
                String controlName = entry.getValue();
                String framework = determineFramework(controlId);

                // Get spans for this control
                List<Span> controlSpans = spansByControl.getOrDefault(controlId, List.of());
                long spanCount = controlSpans.size();

                // Determine last evidence timestamp
                Instant lastEvidence = controlSpans.isEmpty() ? null :
                    controlSpans.stream()
                        .map(Span::endTime)
                        .max(Instant::compareTo)
                        .orElse(null);

                // Determine control status based on evidence volume
                ControlStatus status = determineControlStatus(spanCount, lookbackHours);

                // Generate sparkline trend data if requested
                List<Integer> trendData = includeTrends ?
                    generateSparklineData(controlSpans, startTime, endTime) : null;

                return new ControlSummaryDTO(
                    controlId,
                    controlName,
                    framework,
                    spanCount,
                    lastEvidence,
                    status,
                    trendData
                );
            })
            .sorted(Comparator.comparing(ControlSummaryDTO::framework)
                .thenComparing(ControlSummaryDTO::id))
            .collect(Collectors.toList());
    }

    /**
     * Determine framework from control ID.
     */
    private String determineFramework(String controlId) {
        if (SOC2_CONTROLS.containsKey(controlId)) {
            return "soc2";
        } else if (HIPAA_CONTROLS.containsKey(controlId)) {
            return "hipaa";
        } else {
            return "unknown";
        }
    }

    /**
     * Determine control status based on evidence count and time period.
     *
     * <p>Status Logic (PRD-004):
     * - ACTIVE: ≥10 spans/hour in last 24h (≥240 total for 24h)
     * - PARTIAL: 1-9 spans/hour (1-239 total for 24h)
     * - NO_EVIDENCE: 0 spans
     */
    private ControlStatus determineControlStatus(long spanCount, int lookbackHours) {
        double spansPerHour = (double) spanCount / lookbackHours;

        if (spanCount == 0) {
            return ControlStatus.NO_EVIDENCE;
        } else if (spansPerHour >= 10.0) {
            return ControlStatus.ACTIVE;
        } else {
            return ControlStatus.PARTIAL;
        }
    }

    /**
     * Generate sparkline data: evidence count per hour for last N hours.
     *
     * @return List of hourly span counts (0-based index = hours ago)
     */
    private List<Integer> generateSparklineData(List<Span> spans, Instant startTime, Instant endTime) {
        // Calculate number of hours
        long hours = ChronoUnit.HOURS.between(startTime, endTime);
        if (hours > 168) { // Cap at 1 week
            hours = 168;
        }

        // Initialize hourly buckets
        int[] buckets = new int[(int) hours];

        // Count spans per hour bucket
        for (Span span : spans) {
            Instant spanTime = span.endTime();
            long hoursSinceStart = ChronoUnit.HOURS.between(startTime, spanTime);

            if (hoursSinceStart >= 0 && hoursSinceStart < hours) {
                buckets[(int) hoursSinceStart]++;
            }
        }

        // Convert to List<Integer>
        return Arrays.stream(buckets).boxed().collect(Collectors.toList());
    }

    /**
     * Generate framework summary (coverage percentage).
     */
    private FrameworkSummaryDTO generateFrameworkSummary(String framework, List<ControlSummaryDTO> controls) {
        List<ControlSummaryDTO> frameworkControls = controls.stream()
            .filter(c -> framework.equals(c.framework()))
            .collect(Collectors.toList());

        int total = frameworkControls.size();
        int covered = (int) frameworkControls.stream()
            .filter(c -> c.status() == ControlStatus.ACTIVE || c.status() == ControlStatus.PARTIAL)
            .count();

        return new FrameworkSummaryDTO(covered, total);
    }
}
