package com.fluo.compliance.routes;

import com.fluo.compliance.dto.*;
import com.fluo.compliance.models.*;
import com.fluo.model.Span;
import com.fluo.model.Trace;
import com.fluo.services.DuckDBService;
import io.quarkus.logging.Log;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import org.apache.camel.model.rest.RestParamType;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * PRD-004: Compliance Dashboard API Route
 *
 * <p>Provides compliance posture summary endpoint for visual dashboard:
 * - Framework coverage (SOC2, HIPAA)
 * - Control status (ACTIVE, PARTIAL, NO_EVIDENCE)
 * - Evidence counts per control
 * - Trend data (optional sparklines)
 *
 * <p>Query Parameters:
 * - tenantId (required): Tenant UUID
 * - framework (optional): Filter by "soc2" or "hipaa" (default: all)
 * - hours (optional): Lookback period in hours (default: 24)
 * - includeTrends (optional): Include sparkline data (default: false)
 *
 * <p>Business Value:
 * - 80% demo "wow moment" target via visual dashboard
 * - <5 minutes to identify compliance gaps
 * - Real-time evidence visibility for auditors
 *
 * <p>Compliance:
 * - SOC2 CC7.2 (System Performance) - Monitoring compliance posture
 * - SOC2 CC8.1 (Change Management) - Tracking control effectiveness
 */
public class ComplianceApiRoute extends RouteBuilder {

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

    @Override
    public void configure() throws Exception {
        // Configure REST endpoint
        restConfiguration()
            .component("platform-http")
            .bindingMode(RestBindingMode.json)
            .dataFormatProperty("prettyPrint", "true")
            .contextPath("/api/v1");

        // GET /api/v1/compliance/summary
        rest("/compliance")
            .get("/summary")
            .description("Get compliance posture summary")
            .produces(MediaType.APPLICATION_JSON)
            .param().name("tenantId").type(RestParamType.query).required(true).description("Tenant UUID").endParam()
            .param().name("framework").type(RestParamType.query).required(false).description("Filter by framework (soc2, hipaa)").endParam()
            .param().name("hours").type(RestParamType.query).required(false).description("Lookback period in hours (default: 24)").endParam()
            .param().name("includeTrends").type(RestParamType.query).required(false).description("Include sparkline trend data (default: false)").endParam()
            .to("direct:complianceSummary");

        // Route implementation
        from("direct:complianceSummary")
            .routeId("compliance-summary-route")
            .log("Fetching compliance summary for tenant: ${header.tenantId}")
            .process(exchange -> {
                // Extract query parameters
                String tenantIdStr = exchange.getIn().getHeader("tenantId", String.class);
                String framework = exchange.getIn().getHeader("framework", String.class);
                Integer hours = exchange.getIn().getHeader("hours", Integer.class);
                Boolean includeTrends = exchange.getIn().getHeader("includeTrends", Boolean.class);

                // Validate tenantId
                if (tenantIdStr == null || tenantIdStr.isBlank()) {
                    exchange.getIn().setBody(Response.status(400).entity(Map.of("error", "tenantId is required")).build());
                    return;
                }

                UUID tenantId;
                try {
                    tenantId = UUID.fromString(tenantIdStr);
                } catch (IllegalArgumentException e) {
                    exchange.getIn().setBody(Response.status(400).entity(Map.of("error", "Invalid tenantId format")).build());
                    return;
                }

                // Default parameters
                int lookbackHours = hours != null ? hours : 24;
                boolean includeSparklines = includeTrends != null && includeTrends;

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
                    includeSparklines,
                    startTime,
                    endTime
                );

                // Generate framework summaries
                FrameworkSummaryDTO soc2Summary = generateFrameworkSummary("soc2", controlSummaries);
                FrameworkSummaryDTO hipaaSummary = generateFrameworkSummary("hipaa", controlSummaries);

                // Build response
                ComplianceSummaryDTO summary = new ComplianceSummaryDTO(soc2Summary, hipaaSummary, controlSummaries);

                exchange.getIn().setBody(Response.ok(summary).build());
            })
            .end();
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
    private Map<String, String> getActiveControls(String framework) {
        if (framework == null) {
            // Return all controls
            Map<String, String> allControls = new HashMap<>();
            allControls.putAll(SOC2_CONTROLS);
            allControls.putAll(HIPAA_CONTROLS);
            return allControls;
        } else if ("soc2".equalsIgnoreCase(framework)) {
            return SOC2_CONTROLS;
        } else if ("hipaa".equalsIgnoreCase(framework)) {
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
