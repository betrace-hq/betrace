package com.fluo.compliance.models;

import java.util.*;

/**
 * <h2>Change Management - Authorization</h2>
 *
 * <p><b>Control ID:</b> CC8.1</p>
 * <p><b>Framework:</b> soc2</p>
 * <p><b>Category:</b> Change Management</p>
 * <p><b>Risk Level:</b> medium</p>
 *
 * <h3>Description</h3>
 * <p>The entity authorizes, designs, develops or acquires, configures,</p>\n * <p>documents, tests, approves, and implements changes to infrastructure,</p>\n * <p>data, software, and procedures to meet its objectives.</p>\n * <p></p>
 *
 * <h3>Requirements</h3>
 * <ul>
 * <li>Formal change approval process</li>
 * <li>Change documentation and tracking</li>
 * <li>Testing before deployment</li>
 * <li>Rollback procedures</li>
 * <li>Change review and audit</li>
 * </ul>
 *
 * <h3>Implementation Guidance</h3>
 * <p>Implement GitOps workflows with pull request approvals.</p>\n * <p>Use automated testing in CI/CD pipelines.</p>\n * <p>Maintain change logs with OpenTelemetry spans.</p>\n * <p>Implement canary deployments for risk reduction.</p>\n * <p></p>
 *
 * <h3>Testing Procedures</h3>
 * <ul>
 * <li>Review change request process</li>
 * <li>Verify approval workflows</li>
 * <li>Test rollback procedures</li>
 * </ul>
 *
 * @see com.compliance.annotations.SOC2
 * @see com.compliance.annotations.SOC2Controls#CC8_1
 */
public final class SOC2_CC8_1 implements ComplianceControl {
    /** Control ID constant */
    public static final String ID = "CC8.1";

    /** Control name */
    public static final String NAME = "Change Management - Authorization";

    /** Category */
    public static final String CATEGORY = "Change Management";

    /** Risk level */
    public static final String RISK_LEVEL = "medium";

    /** Requirements */
    public static final List<String> REQUIREMENTS = List.of(
        "Formal change approval process",
        "Change documentation and tracking",
        "Testing before deployment",
        "Rollback procedures",
        "Change review and audit"
    );

    /** Evidence types */
    public static final List<String> EVIDENCE_TYPES = List.of(
        "documentation",
        "audit_trail",
        "test",
        "code_review"
    );

    private SOC2_CC8_1() {}

    @Override
    public String getId() { return ID; }

    @Override
    public String getName() { return NAME; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getDescription() {
        return """
            The entity authorizes, designs, develops or acquires, configures,\ndocuments, tests, approves, and implements changes to infrastructure,\ndata, software, and procedures to meet its objectives.\n
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
            Implement GitOps workflows with pull request approvals.\nUse automated testing in CI/CD pipelines.\nMaintain change logs with OpenTelemetry spans.\nImplement canary deployments for risk reduction.\n
            """;
    }

    /**
     * Get testing procedures for this control.
     * @return list of testing procedures
     */
    public static List<String> getTestingProcedures() {
        return List.of(
            "Review change request process",
            "Verify approval workflows",
            "Test rollback procedures"
        );
    }
}
