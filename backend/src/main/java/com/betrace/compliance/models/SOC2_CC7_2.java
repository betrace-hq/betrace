package com.betrace.compliance.models;

import java.util.*;

/**
 * <h2>System Operations - Monitoring</h2>
 *
 * <p><b>Control ID:</b> CC7.2</p>
 * <p><b>Framework:</b> soc2</p>
 * <p><b>Category:</b> System Operations</p>
 * <p><b>Risk Level:</b> medium</p>
 *
 * <h3>Description</h3>
 * <p>The entity monitors system components and the operation of those components</p>\n * <p>for anomalies that are indicative of malicious acts, natural disasters,</p>\n * <p>and errors affecting the entity's ability to meet its objectives.</p>\n * <p></p>
 *
 * <h3>Requirements</h3>
 * <ul>
 * <li>Continuous system monitoring</li>
 * <li>Performance metrics tracking</li>
 * <li>Health checks and status monitoring</li>
 * <li>Automated incident response</li>
 * <li>Capacity planning and alerts</li>
 * </ul>
 *
 * <h3>Implementation Guidance</h3>
 * <p>Use Prometheus for metrics collection.</p>\n * <p>Implement Grafana dashboards for visualization.</p>\n * <p>Set up health check endpoints for all services.</p>\n * <p>Configure auto-scaling based on metrics.</p>\n * <p></p>
 *
 * <h3>Testing Procedures</h3>
 * <ul>
 * <li>Review monitoring coverage</li>
 * <li>Test alerting thresholds</li>
 * <li>Validate health checks</li>
 * </ul>
 *
 * @see com.compliance.annotations.SOC2
 * @see com.compliance.annotations.SOC2Controls#CC7_2
 */
public final class SOC2_CC7_2 implements ComplianceControl {
    /** Control ID constant */
    public static final String ID = "CC7.2";

    /** Control name */
    public static final String NAME = "System Operations - Monitoring";

    /** Category */
    public static final String CATEGORY = "System Operations";

    /** Risk level */
    public static final String RISK_LEVEL = "medium";

    /** Requirements */
    public static final List<String> REQUIREMENTS = List.of(
        "Continuous system monitoring",
        "Performance metrics tracking",
        "Health checks and status monitoring",
        "Automated incident response",
        "Capacity planning and alerts"
    );

    /** Evidence types */
    public static final List<String> EVIDENCE_TYPES = List.of(
        "metric",
        "log",
        "audit_trail"
    );

    private SOC2_CC7_2() {}

    @Override
    public String getId() { return ID; }

    @Override
    public String getName() { return NAME; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getDescription() {
        return """
            The entity monitors system components and the operation of those components\nfor anomalies that are indicative of malicious acts, natural disasters,\nand errors affecting the entity's ability to meet its objectives.\n
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
            Use Prometheus for metrics collection.\nImplement Grafana dashboards for visualization.\nSet up health check endpoints for all services.\nConfigure auto-scaling based on metrics.\n
            """;
    }

    /**
     * Get testing procedures for this control.
     * @return list of testing procedures
     */
    public static List<String> getTestingProcedures() {
        return List.of(
            "Review monitoring coverage",
            "Test alerting thresholds",
            "Validate health checks"
        );
    }
}
