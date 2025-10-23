package com.fluo.compliance.models;

import java.util.*;

/**
 * <h2>Encryption - Data in Transit</h2>
 *
 * <p><b>Control ID:</b> CC6.7</p>
 * <p><b>Framework:</b> soc2</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> critical</p>
 *
 * <h3>Description</h3>
 * <p>The entity restricts the transmission, movement, and removal of information</p>\n * <p>to authorized internal and external users and processes, and protects it</p>\n * <p>during transmission, movement, or removal.</p>\n * <p></p>
 *
 * <h3>Requirements</h3>
 * <ul>
 * <li>Use TLS 1.2+ for all communications</li>
 * <li>Implement certificate management</li>
 * <li>Enforce HTTPS for web applications</li>
 * <li>Encrypt API communications</li>
 * <li>Secure file transfer protocols</li>
 * </ul>
 *
 * <h3>Implementation Guidance</h3>
 * <p>Enforce TLS 1.3 for all external communications.</p>\n * <p>Use mutual TLS (mTLS) for service-to-service communication.</p>\n * <p>Implement certificate pinning for mobile applications.</p>\n * <p>Regularly scan for weak ciphers and protocols.</p>\n * <p></p>
 *
 * <h3>Testing Procedures</h3>
 * <ul>
 * <li>Scan for TLS version support</li>
 * <li>Test certificate validity</li>
 * <li>Verify cipher suite configuration</li>
 * <li>Test unencrypted connections</li>
 * </ul>
 *
 * @see com.compliance.annotations.SOC2
 * @see com.compliance.annotations.SOC2Controls#CC6_7
 */
public final class SOC2_CC6_7 implements ComplianceControl {
    /** Control ID constant */
    public static final String ID = "CC6.7";

    /** Control name */
    public static final String NAME = "Encryption - Data in Transit";

    /** Category */
    public static final String CATEGORY = "Logical and Physical Access Controls";

    /** Risk level */
    public static final String RISK_LEVEL = "critical";

    /** Requirements */
    public static final List<String> REQUIREMENTS = List.of(
        "Use TLS 1.2+ for all communications",
        "Implement certificate management",
        "Enforce HTTPS for web applications",
        "Encrypt API communications",
        "Secure file transfer protocols"
    );

    /** Evidence types */
    public static final List<String> EVIDENCE_TYPES = List.of(
        "config",
        "scan",
        "certificate",
        "code_review"
    );

    private SOC2_CC6_7() {}

    @Override
    public String getId() { return ID; }

    @Override
    public String getName() { return NAME; }

    @Override
    public String getCategory() { return CATEGORY; }

    @Override
    public String getDescription() {
        return """
            The entity restricts the transmission, movement, and removal of information\nto authorized internal and external users and processes, and protects it\nduring transmission, movement, or removal.\n
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
            Enforce TLS 1.3 for all external communications.\nUse mutual TLS (mTLS) for service-to-service communication.\nImplement certificate pinning for mobile applications.\nRegularly scan for weak ciphers and protocols.\n
            """;
    }

    /**
     * Get testing procedures for this control.
     * @return list of testing procedures
     */
    public static List<String> getTestingProcedures() {
        return List.of(
            "Scan for TLS version support",
            "Test certificate validity",
            "Verify cipher suite configuration",
            "Test unencrypted connections"
        );
    }
}
