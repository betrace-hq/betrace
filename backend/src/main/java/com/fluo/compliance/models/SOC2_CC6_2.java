package com.fluo.compliance.models;

import java.util.*;

/**
 * <h2>Access Control - User Registration</h2>
 *
 * <p><b>Control ID:</b> CC6.2</p>
 * <p><b>Framework:</b> soc2</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> medium</p>
 *
 * <h3>Description</h3>
 * <p>Prior to issuing system credentials and granting system access, the entity</p>\n * <p>registers and authorizes new internal and external users whose access is</p>\n * <p>administered by the entity.</p>\n * <p></p>
 *
 * <h3>Requirements</h3>
 * <ul>
 * <li>Formal user registration process</li>
 * <li>Manager approval for access requests</li>
 * <li>Background checks for sensitive access</li>
 * <li>Documentation of access justification</li>
 * <li>Automated provisioning workflows</li>
 * </ul>
 *
 * <h3>Implementation Guidance</h3>
 * <p>Implement automated user provisioning with approval workflows.</p>\n * <p>Integrate with identity providers (SSO/SAML) where possible.</p>\n * <p>Track all access grants with justification and approval chain.</p>\n * <p></p>
 *
 * <h3>Testing Procedures</h3>
 * <ul>
 * <li>Review user provisioning logs</li>
 * <li>Validate approval workflows</li>
 * <li>Test unauthorized provisioning attempts</li>
 * </ul>
 *
 * @see com.compliance.annotations.SOC2
 * @see com.compliance.annotations.SOC2Controls#CC6_2
 */
public final class SOC2_CC6_2 implements ComplianceControl {
    /** Control ID constant */
    public static final String ID = "CC6.2";

    /** Control name */
    public static final String NAME = "Access Control - User Registration";

    /** Category */
    public static final String CATEGORY = "Logical and Physical Access Controls";

    /** Risk level */
    public static final String RISK_LEVEL = "medium";

    /** Requirements */
    public static final List<String> REQUIREMENTS = List.of(
        "Formal user registration process",
        "Manager approval for access requests",
        "Background checks for sensitive access",
        "Documentation of access justification",
        "Automated provisioning workflows"
    );

    /** Evidence types */
    public static final List<String> EVIDENCE_TYPES = List.of(
        "audit_trail",
        "documentation",
        "log"
    );

    private SOC2_CC6_2() {}

    @Override
    public String getId() { return ID; }

    @Override
    public String getName() { return NAME; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getDescription() {
        return """
            Prior to issuing system credentials and granting system access, the entity\nregisters and authorizes new internal and external users whose access is\nadministered by the entity.\n
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
            Implement automated user provisioning with approval workflows.\nIntegrate with identity providers (SSO/SAML) where possible.\nTrack all access grants with justification and approval chain.\n
            """;
    }

    /**
     * Get testing procedures for this control.
     * @return list of testing procedures
     */
    public static List<String> getTestingProcedures() {
        return List.of(
            "Review user provisioning logs",
            "Validate approval workflows",
            "Test unauthorized provisioning attempts"
        );
    }
}
