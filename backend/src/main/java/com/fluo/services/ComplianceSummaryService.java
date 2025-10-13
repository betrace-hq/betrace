package com.fluo.services;

import com.fluo.models.compliance.ComplianceSummary;
import com.fluo.models.compliance.ControlStatus;
import com.fluo.models.compliance.FrameworkScore;
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
}
