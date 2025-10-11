package com.fluo.compliance.models;

import java.util.*;

/**
 * <h2>Access Control - De-provisioning</h2>
 *
 * <p><b>Control ID:</b> CC6.3</p>
 * <p><b>Framework:</b> soc2</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> high</p>
 *
 * <h3>Description</h3>
 * <p>The entity authorizes, modifies, or removes access to data, software,</p>\n * <p>functions, and other protected information assets based on roles,</p>\n * <p>responsibilities, or the system design and changes.</p>\n * <p></p>
 *
 * <h3>Requirements</h3>
 * <ul>
 * <li>Automated deprovisioning on termination</li>
 * <li>Regular access reviews</li>
 * <li>Role change handling</li>
 * <li>Orphaned account detection</li>
 * <li>Audit trail of access changes</li>
 * </ul>
 *
 * <h3>Implementation Guidance</h3>
 * <p>Implement automated deprovisioning triggered by HR system events.</p>\n * <p>Conduct quarterly access reviews to identify orphaned accounts.</p>\n * <p>Log all access modifications with before/after state.</p>\n * <p></p>
 *
 * <h3>Testing Procedures</h3>
 * <ul>
 * <li>Review deprovisioning logs</li>
 * <li>Test automated deprovisioning</li>
 * <li>Identify orphaned accounts</li>
 * </ul>
 *
 * @see com.compliance.annotations.SOC2
 * @see com.compliance.annotations.SOC2Controls#CC6_3
 */
public final class SOC2_CC6_3 implements ComplianceControl {
    /** Control ID constant */
    public static final String ID = "CC6.3";

    /** Control name */
    public static final String NAME = "Access Control - De-provisioning";

    /** Category */
    public static final String CATEGORY = "Logical and Physical Access Controls";

    /** Risk level */
    public static final String RISK_LEVEL = "high";

    /** Requirements */
    public static final List<String> REQUIREMENTS = List.of(
        "Automated deprovisioning on termination",
        "Regular access reviews",
        "Role change handling",
        "Orphaned account detection",
        "Audit trail of access changes"
    );

    /** Evidence types */
    public static final List<String> EVIDENCE_TYPES = List.of(
        "audit_trail",
        "log",
        "config"
    );

    private SOC2_CC6_3() {}

    @Override
    public String getId() { return ID; }

    @Override
    public String getName() { return NAME; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getDescription() {
        return """
            The entity authorizes, modifies, or removes access to data, software,\nfunctions, and other protected information assets based on roles,\nresponsibilities, or the system design and changes.\n
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
            Implement automated deprovisioning triggered by HR system events.\nConduct quarterly access reviews to identify orphaned accounts.\nLog all access modifications with before/after state.\n
            """;
    }

    /**
     * Get testing procedures for this control.
     * @return list of testing procedures
     */
    public static List<String> getTestingProcedures() {
        return List.of(
            "Review deprovisioning logs",
            "Test automated deprovisioning",
            "Identify orphaned accounts"
        );
    }
}
