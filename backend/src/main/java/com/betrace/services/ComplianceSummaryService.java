package com.fluo.services;

import com.fluo.models.compliance.*;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * PRD-004: Compliance Summary Service
 *
 * Calculates compliance posture from ComplianceSpan telemetry data.
 *
 * Status Calculation:
 * - "covered": ≥10 spans/hour in last 24h
 * - "partial": 1-9 spans/hour in last 24h
 * - "no_evidence": 0 spans in last 24h
 *
 * Framework Coverage:
 * - Percentage of controls with "covered" or "partial" status
 *
 * Note: This is a demo implementation using mock data.
 * Production version would query OpenTelemetry/Grafana for real spans.
 */
@ApplicationScoped
public class ComplianceSummaryService {

    private static final Logger LOG = Logger.getLogger(ComplianceSummaryService.class);

    // SOC2 control definitions
    private static final Map<String, String> SOC2_CONTROLS = Map.of(
            "CC6_1", "Logical and Physical Access Controls",
            "CC6_2", "Access Provisioning and Removal",
            "CC6_3", "Logical Access Control Data Isolation",
            "CC6_6", "Encryption of Data at Rest",
            "CC6_7", "Encryption of Data in Transit",
            "CC7_1", "System Monitoring - Detection",
            "CC7_2", "System Monitoring - Audit Logging",
            "CC8_1", "Change Management"
    );

    // HIPAA control definitions
    private static final Map<String, String> HIPAA_CONTROLS = Map.of(
            "164.312(a)", "Access Control",
            "164.312(b)", "Audit Controls",
            "164.312(a)(2)(i)", "Unique User Identification",
            "164.312(a)(2)(iv)", "Encryption and Decryption",
            "164.312(e)(2)(ii)", "Transmission Security",
            "164.312(c)(1)", "Integrity Controls",
            "164.312(d)", "Person or Entity Authentication"
    );

    /**
     * Get compliance summary with optional filtering.
     *
     * @param framework Optional framework filter ("soc2", "hipaa", null for all)
     * @param hoursAgo Number of hours to look back for evidence (default 24)
     * @return ComplianceSummary with framework scores and control statuses
     */
    public ComplianceSummary getSummary(String framework, Integer hoursAgo) {
        int lookbackHours = hoursAgo != null ? hoursAgo : 24;

        LOG.infof("Calculating compliance summary: framework=%s, hoursAgo=%d", framework, lookbackHours);

        // In production, this would query OpenTelemetry/Grafana for ComplianceSpans
        // For demo purposes, we'll use mock data

        List<ControlStatus> allControls = new ArrayList<>();
        List<FrameworkScore> frameworkScores = new ArrayList<>();

        // Calculate SOC2 controls
        if (framework == null || "soc2".equalsIgnoreCase(framework)) {
            List<ControlStatus> soc2Controls = calculateControlStatuses("soc2", SOC2_CONTROLS, lookbackHours);
            allControls.addAll(soc2Controls);

            int covered = (int) soc2Controls.stream().filter(c -> "covered".equals(c.getStatus())).count();
            int coveragePercent = (int) ((covered / (double) SOC2_CONTROLS.size()) * 100);

            frameworkScores.add(new FrameworkScore(
                    "soc2",
                    coveragePercent,
                    covered,
                    SOC2_CONTROLS.size()
            ));
        }

        // Calculate HIPAA controls
        if (framework == null || "hipaa".equalsIgnoreCase(framework)) {
            List<ControlStatus> hipaaControls = calculateControlStatuses("hipaa", HIPAA_CONTROLS, lookbackHours);
            allControls.addAll(hipaaControls);

            int covered = (int) hipaaControls.stream().filter(c -> "covered".equals(c.getStatus())).count();
            int coveragePercent = (int) ((covered / (double) HIPAA_CONTROLS.size()) * 100);

            frameworkScores.add(new FrameworkScore(
                    "hipaa",
                    coveragePercent,
                    covered,
                    HIPAA_CONTROLS.size()
            ));
        }

        long totalSpans = allControls.stream().mapToLong(ControlStatus::getSpanCount).sum();

        return new ComplianceSummary(
                frameworkScores,
                allControls,
                totalSpans,
                Instant.now().toString()
        );
    }

    /**
     * Calculate control statuses for a framework.
     *
     * Demo Implementation: Returns mock data with realistic patterns.
     * Production: Would query OpenTelemetry for actual ComplianceSpan data.
     */
    private List<ControlStatus> calculateControlStatuses(String framework, Map<String, String> controls, int hoursAgo) {
        List<ControlStatus> statuses = new ArrayList<>();

        // Mock data: Simulate realistic compliance posture
        // - Most controls have evidence (covered)
        // - Some have limited evidence (partial)
        // - A few have no evidence (no_evidence)

        int index = 0;
        for (Map.Entry<String, String> entry : controls.entrySet()) {
            String controlId = entry.getKey();
            String name = entry.getValue();

            // Simulate different statuses
            String status;
            long spanCount;
            String lastEvidence;

            if (index % 5 == 0) {
                // 20% no evidence
                status = "no_evidence";
                spanCount = 0;
                lastEvidence = null;
            } else if (index % 3 == 0) {
                // 20% partial coverage
                status = "partial";
                spanCount = 8 + (index % 5);
                lastEvidence = Instant.now().minus(18, ChronoUnit.HOURS).toString();
            } else {
                // 60% covered
                status = "covered";
                spanCount = 1000 + (index * 100);
                lastEvidence = Instant.now().minus(3, ChronoUnit.MINUTES).toString();
            }

            statuses.add(new ControlStatus(
                    controlId,
                    framework,
                    name,
                    status,
                    spanCount,
                    lastEvidence,
                    "Evidence for " + name
            ));

            index++;
        }

        return statuses;
    }

    /**
     * Get detailed view of a specific control with paginated evidence spans.
     *
     * @param framework Framework identifier ("soc2", "hipaa")
     * @param controlId Control identifier (e.g., "CC6_1", "164.312(a)")
     * @param page Page number (0-indexed)
     * @param pageSize Number of spans per page
     * @return ControlDetail with control status and paginated spans
     */
    public ControlDetail getControlDetail(String framework, String controlId, int page, int pageSize) {
        LOG.infof("Getting control detail: framework=%s, controlId=%s, page=%d, pageSize=%d",
                framework, controlId, page, pageSize);

        // Get control status
        Map<String, String> controls = "soc2".equalsIgnoreCase(framework) ? SOC2_CONTROLS : HIPAA_CONTROLS;
        String controlName = controls.get(controlId);

        if (controlName == null) {
            throw new IllegalArgumentException("Unknown control: " + framework + "/" + controlId);
        }

        List<ControlStatus> statuses = calculateControlStatuses(framework, Map.of(controlId, controlName), 24);
        ControlStatus control = statuses.get(0);

        // Generate mock evidence spans
        List<EvidenceSpan> allSpans = generateMockSpans(framework, controlId, control.getSpanCount());

        // Paginate
        int start = page * pageSize;
        int end = Math.min(start + pageSize, allSpans.size());
        List<EvidenceSpan> pageSpans = start < allSpans.size() ? allSpans.subList(start, end) : List.of();

        return new ControlDetail(
                control,
                pageSpans,
                (int) control.getSpanCount(),
                page,
                pageSize,
                end < allSpans.size()
        );
    }

    /**
     * Export compliance evidence in CSV or JSON format.
     *
     * @param format Export format ("csv" or "json")
     * @param framework Optional framework filter
     * @param controlId Optional control filter
     * @param hoursAgo Lookback period in hours
     * @return Formatted evidence data
     */
    public String exportEvidence(String format, String framework, String controlId, int hoursAgo) {
        LOG.infof("Exporting evidence: format=%s, framework=%s, controlId=%s, hoursAgo=%d",
                format, framework, controlId, hoursAgo);

        // Get spans to export
        List<EvidenceSpan> spans;
        if (framework != null && controlId != null) {
            // Single control
            ControlDetail detail = getControlDetail(framework, controlId, 0, 1000);
            spans = detail.getSpans();
        } else if (framework != null) {
            // All controls for framework
            spans = new ArrayList<>();
            Map<String, String> controls = "soc2".equalsIgnoreCase(framework) ? SOC2_CONTROLS : HIPAA_CONTROLS;
            for (String cid : controls.keySet()) {
                ControlDetail detail = getControlDetail(framework, cid, 0, 100);
                spans.addAll(detail.getSpans());
            }
        } else {
            // All frameworks
            spans = new ArrayList<>();
            for (String fw : List.of("soc2", "hipaa")) {
                Map<String, String> controls = "soc2".equals(fw) ? SOC2_CONTROLS : HIPAA_CONTROLS;
                for (String cid : controls.keySet()) {
                    ControlDetail detail = getControlDetail(fw, cid, 0, 100);
                    spans.addAll(detail.getSpans());
                }
            }
        }

        // Format output
        if ("json".equalsIgnoreCase(format)) {
            return formatAsJson(spans);
        } else {
            return formatAsCsv(spans);
        }
    }

    /**
     * Generate mock evidence spans for a control.
     */
    private List<EvidenceSpan> generateMockSpans(String framework, String controlId, long totalSpans) {
        List<EvidenceSpan> spans = new ArrayList<>();
        int count = (int) Math.min(totalSpans, 100); // Limit to 100 for demo

        String[] evidenceTypes = {"audit_trail", "access_control", "encryption", "monitoring"};
        String[] outcomes = {"success", "success", "success", "failure"}; // 75% success rate
        String[] operations = {"user.login", "data.access", "key.rotation", "alert.generated"};

        for (int i = 0; i < count; i++) {
            Instant timestamp = Instant.now().minus(i * 10, ChronoUnit.MINUTES);
            spans.add(new EvidenceSpan(
                    timestamp.toString(),
                    framework,
                    controlId,
                    evidenceTypes[i % evidenceTypes.length],
                    outcomes[i % outcomes.length],
                    "trace-" + UUID.randomUUID().toString().substring(0, 8),
                    "span-" + UUID.randomUUID().toString().substring(0, 8),
                    "tenant-123",
                    operations[i % operations.length]
            ));
        }

        return spans;
    }

    /**
     * Format spans as CSV.
     */
    private String formatAsCsv(List<EvidenceSpan> spans) {
        StringBuilder csv = new StringBuilder();
        csv.append("timestamp,framework,control,evidenceType,outcome,traceId,spanId,tenantId,operation\n");

        for (EvidenceSpan span : spans) {
            csv.append(String.format("%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
                    span.getTimestamp(),
                    span.getFramework(),
                    span.getControl(),
                    span.getEvidenceType(),
                    span.getOutcome(),
                    span.getTraceId(),
                    span.getSpanId(),
                    span.getTenantId(),
                    span.getOperation()
            ));
        }

        return csv.toString();
    }

    /**
     * Format spans as JSON.
     */
    private String formatAsJson(List<EvidenceSpan> spans) {
        StringBuilder json = new StringBuilder();
        json.append("{\n  \"spans\": [\n");

        for (int i = 0; i < spans.size(); i++) {
            EvidenceSpan span = spans.get(i);
            json.append("    {\n");
            json.append(String.format("      \"timestamp\": \"%s\",\n", span.getTimestamp()));
            json.append(String.format("      \"framework\": \"%s\",\n", span.getFramework()));
            json.append(String.format("      \"control\": \"%s\",\n", span.getControl()));
            json.append(String.format("      \"evidenceType\": \"%s\",\n", span.getEvidenceType()));
            json.append(String.format("      \"outcome\": \"%s\",\n", span.getOutcome()));
            json.append(String.format("      \"traceId\": \"%s\",\n", span.getTraceId()));
            json.append(String.format("      \"spanId\": \"%s\",\n", span.getSpanId()));
            json.append(String.format("      \"tenantId\": \"%s\",\n", span.getTenantId()));
            json.append(String.format("      \"operation\": \"%s\"\n", span.getOperation()));
            json.append(i < spans.size() - 1 ? "    },\n" : "    }\n");
        }

        json.append("  ],\n");
        json.append(String.format("  \"total\": %d\n", spans.size()));
        json.append("}\n");

        return json.toString();
    }
}
