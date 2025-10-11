package com.fluo.compliance.models;

import java.util.*;

/**
 * <h2>System Operations - Detection</h2>
 *
 * <p><b>Control ID:</b> CC7.1</p>
 * <p><b>Framework:</b> soc2</p>
 * <p><b>Category:</b> System Operations</p>
 * <p><b>Risk Level:</b> high</p>
 *
 * <h3>Description</h3>
 * <p>To meet its objectives, the entity uses detection and monitoring procedures</p>\n * <p>to identify (1) changes to configurations that result in the introduction</p>\n * <p>of new vulnerabilities, and (2) susceptibilities to newly discovered</p>\n * <p>vulnerabilities.</p>\n * <p></p>
 *
 * <h3>Requirements</h3>
 * <ul>
 * <li>Real-time monitoring of system events</li>
 * <li>Automated alerting for security events</li>
 * <li>Log aggregation and analysis</li>
 * <li>Anomaly detection</li>
 * <li>Security information and event management (SIEM)</li>
 * </ul>
 *
 * <h3>Implementation Guidance</h3>
 * <p>Implement distributed tracing with OpenTelemetry.</p>\n * <p>Use spans to track all security-relevant operations.</p>\n * <p>Set up automated alerts for anomalies.</p>\n * <p>Integrate with SIEM solutions for correlation.</p>\n * <p></p>
 *
 * <h3>Testing Procedures</h3>
 * <ul>
 * <li>Verify monitoring coverage</li>
 * <li>Test alerting rules</li>
 * <li>Review log retention</li>
 * <li>Validate anomaly detection</li>
 * </ul>
 *
 * @see com.compliance.annotations.SOC2
 * @see com.compliance.annotations.SOC2Controls#CC7_1
 */
public final class SOC2_CC7_1 implements ComplianceControl {
    /** Control ID constant */
    public static final String ID = "CC7.1";

    /** Control name */
    public static final String NAME = "System Operations - Detection";

    /** Category */
    public static final String CATEGORY = "System Operations";

    /** Risk level */
    public static final String RISK_LEVEL = "high";

    /** Requirements */
    public static final List<String> REQUIREMENTS = List.of(
        "Real-time monitoring of system events",
        "Automated alerting for security events",
        "Log aggregation and analysis",
        "Anomaly detection",
        "Security information and event management (SIEM)"
    );

    /** Evidence types */
    public static final List<String> EVIDENCE_TYPES = List.of(
        "log",
        "metric",
        "audit_trail",
        "scan"
    );

    private SOC2_CC7_1() {}

    @Override
    public String getId() { return ID; }

    @Override
    public String getName() { return NAME; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getDescription() {
        return """
            To meet its objectives, the entity uses detection and monitoring procedures\nto identify (1) changes to configurations that result in the introduction\nof new vulnerabilities, and (2) susceptibilities to newly discovered\nvulnerabilities.\n
            """;
    }

    @Override
    public String getRiskLevel() { return RISK_LEVEL; }

    @Override
    public List<String> getRequirements() { return REQUIREMENTS; }

    @Override
    public List<String> getEvidenceTypes() { return EVIDENCE_TYPES; }

    /**
     * Get implementation guidance for this control.
     * @return detailed implementation guidance
     */
    public static String getImplementationGuidance() {
        return """
            Implement distributed tracing with OpenTelemetry.\nUse spans to track all security-relevant operations.\nSet up automated alerts for anomalies.\nIntegrate with SIEM solutions for correlation.\n
            """;
    }

    /**
     * Get testing procedures for this control.
     * @return list of testing procedures
     */
    public static List<String> getTestingProcedures() {
        return List.of(
            "Verify monitoring coverage",
            "Test alerting rules",
            "Review log retention",
            "Validate anomaly detection"
        );
    }
}
