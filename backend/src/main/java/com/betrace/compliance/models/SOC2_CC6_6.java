package com.betrace.compliance.models;

import java.util.*;

/**
 * <h2>Encryption - Data at Rest</h2>
 *
 * <p><b>Control ID:</b> CC6.6</p>
 * <p><b>Framework:</b> soc2</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> critical</p>
 *
 * <h3>Description</h3>
 * <p>The entity implements logical access security measures to protect against</p>\n * <p>threats from sources outside its system boundaries.</p>\n * <p></p>
 *
 * <h3>Requirements</h3>
 * <ul>
 * <li>Encrypt sensitive data at rest</li>
 * <li>Use strong encryption algorithms (AES-256)</li>
 * <li>Secure key management</li>
 * <li>Regular key rotation</li>
 * <li>Hardware security modules (HSM) for key storage</li>
 * </ul>
 *
 * <h3>Implementation Guidance</h3>
 * <p>Use database-level encryption or application-level encryption for sensitive data.</p>\n * <p>Store encryption keys in a separate key management service (KMS).</p>\n * <p>Implement automatic key rotation policies.</p>\n * <p></p>
 *
 * <h3>Testing Procedures</h3>
 * <ul>
 * <li>Verify encryption at rest configuration</li>
 * <li>Test key rotation procedures</li>
 * <li>Review encryption algorithms</li>
 * <li>Validate key storage security</li>
 * </ul>
 *
 * @see com.compliance.annotations.SOC2
 * @see com.compliance.annotations.SOC2Controls#CC6_6
 */
public final class SOC2_CC6_6 implements ComplianceControl {
    /** Control ID constant */
    public static final String ID = "CC6.6";

    /** Control name */
    public static final String NAME = "Encryption - Data at Rest";

    /** Category */
    public static final String CATEGORY = "Logical and Physical Access Controls";

    /** Risk level */
    public static final String RISK_LEVEL = "critical";

    /** Requirements */
    public static final List<String> REQUIREMENTS = List.of(
        "Encrypt sensitive data at rest",
        "Use strong encryption algorithms (AES-256)",
        "Secure key management",
        "Regular key rotation",
        "Hardware security modules (HSM) for key storage"
    );

    /** Evidence types */
    public static final List<String> EVIDENCE_TYPES = List.of(
        "config",
        "scan",
        "code_review",
        "certificate"
    );

    private SOC2_CC6_6() {}

    @Override
    public String getId() { return ID; }

    @Override
    public String getName() { return NAME; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getDescription() {
        return """
            The entity implements logical access security measures to protect against\nthreats from sources outside its system boundaries.\n
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
            Use database-level encryption or application-level encryption for sensitive data.\nStore encryption keys in a separate key management service (KMS).\nImplement automatic key rotation policies.\n
            """;
    }

    /**
     * Get testing procedures for this control.
     * @return list of testing procedures
     */
    public static List<String> getTestingProcedures() {
        return List.of(
            "Verify encryption at rest configuration",
            "Test key rotation procedures",
            "Review encryption algorithms",
            "Validate key storage security"
        );
    }
}
