package com.fluo.compliance.models;

import java.util.*;

/**
 * <h2>Logical Access - Authorization</h2>
 *
 * <p><b>Control ID:</b> CC6.1</p>
 * <p><b>Framework:</b> soc2</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> high</p>
 *
 * <h3>Description</h3>
 * <p>The entity implements logical access security software, infrastructure,</p>\n * <p>and architectures over protected information assets to protect them from</p>\n * <p>security events to meet the entity's objectives.</p>\n * <p></p>
 *
 * <h3>Requirements</h3>
 * <ul>
 * <li>Implement access control lists (ACLs)</li>
 * <li>Define user roles and permissions</li>
 * <li>Enforce least privilege principle</li>
 * <li>Maintain separation of duties</li>
 * <li>Regular access reviews</li>
 * </ul>
 *
 * <h3>Implementation Guidance</h3>
 * <p>Implement role-based access control (RBAC) with clear separation between</p>\n * <p>user roles. All access decisions should be logged and auditable.</p>\n * <p>Use tenant isolation to ensure data separation in multi-tenant systems.</p>\n * <p></p>
 *
 * <h3>Testing Procedures</h3>
 * <ul>
 * <li>Verify RBAC implementation</li>
 * <li>Test unauthorized access attempts</li>
 * <li>Review access logs</li>
 * <li>Validate tenant isolation</li>
 * </ul>
 *
 * @see com.compliance.annotations.SOC2
 * @see com.compliance.annotations.SOC2Controls#CC6_1
 */
public final class SOC2_CC6_1 implements ComplianceControl {
    /** Control ID constant */
    public static final String ID = "CC6.1";

    /** Control name */
    public static final String NAME = "Logical Access - Authorization";

    /** Category */
    public static final String CATEGORY = "Logical and Physical Access Controls";

    /** Risk level */
    public static final String RISK_LEVEL = "high";

    /** Requirements */
    public static final List<String> REQUIREMENTS = List.of(
        "Implement access control lists (ACLs)",
        "Define user roles and permissions",
        "Enforce least privilege principle",
        "Maintain separation of duties",
        "Regular access reviews"
    );

    /** Evidence types */
    public static final List<String> EVIDENCE_TYPES = List.of(
        "audit_trail",
        "config",
        "log",
        "code_review"
    );

    private SOC2_CC6_1() {}

    @Override
    public String getId() { return ID; }

    @Override
    public String getName() { return NAME; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getDescription() {
        return """
            The entity implements logical access security software, infrastructure,\nand architectures over protected information assets to protect them from\nsecurity events to meet the entity's objectives.\n
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
            Implement role-based access control (RBAC) with clear separation between\nuser roles. All access decisions should be logged and auditable.\nUse tenant isolation to ensure data separation in multi-tenant systems.\n
            """;
    }

    /**
     * Get testing procedures for this control.
     * @return list of testing procedures
     */
    public static List<String> getTestingProcedures() {
        return List.of(
            "Verify RBAC implementation",
            "Test unauthorized access attempts",
            "Review access logs",
            "Validate tenant isolation"
        );
    }
}
