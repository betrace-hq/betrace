package com.fluo.compliance.annotations;

/**
 * Type-safe constants for soc2 control IDs.
 *
 * <p>This class provides compile-time validated control identifiers for use with
 * the {@link SOC2} annotation. Using these constants ensures:</p>
 * <ul>
 * <li>IDE autocomplete support</li>
 * <li>Compile-time validation of control IDs</li>
 * <li>Refactoring safety</li>
 * <li>Documentation links to control details</li>
 * </ul>
 *
 * <p><b>Generated from compliance-as-code definitions.</b></p>
 *
 * @see SOC2
 * @see com.compliance.models.SOC2ControlRegistry
 */
public final class SOC2Controls {
    private SOC2Controls() {
        throw new UnsupportedOperationException("Constants class cannot be instantiated");
    }

    /**
 * <b>Logical Access - Authorization</b>
 *
 * <p><b>Control ID:</b> CC6.1</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> high</p>
 *
 * <p><b>Description:</b><br>
 * The entity implements logical access security software, infrastructure,\n     * and architectures over protected information assets to protect them from\n     * security events to meet the entity's objectives.\n     * </p>
 *
 * <p><b>Requirements:</b></p>
 * <ul>
 * <li>Implement access control lists (ACLs)</li>
     * <li>Define user roles and permissions</li>
     * <li>Enforce least privilege principle</li>
     * <li>Maintain separation of duties</li>
     * <li>Regular access reviews</li>
 * </ul>
 *
 * <p><b>Implementation Guidance:</b><br>
 * Implement role-based access control (RBAC) with clear separation between\n     * user roles. All access decisions should be logged and auditable.\n     * Use tenant isolation to ensure data separation in multi-tenant systems.\n     * </p>
 *
 * @see com.compliance.models.SOC2_CC6_1
 */
public static final String CC6_1 = "CC6.1";


    /**
 * <b>Access Control - User Registration</b>
 *
 * <p><b>Control ID:</b> CC6.2</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> medium</p>
 *
 * <p><b>Description:</b><br>
 * Prior to issuing system credentials and granting system access, the entity\n     * registers and authorizes new internal and external users whose access is\n     * administered by the entity.\n     * </p>
 *
 * <p><b>Requirements:</b></p>
 * <ul>
 * <li>Formal user registration process</li>
     * <li>Manager approval for access requests</li>
     * <li>Background checks for sensitive access</li>
     * <li>Documentation of access justification</li>
     * <li>Automated provisioning workflows</li>
 * </ul>
 *
 * <p><b>Implementation Guidance:</b><br>
 * Implement automated user provisioning with approval workflows.\n     * Integrate with identity providers (SSO/SAML) where possible.\n     * Track all access grants with justification and approval chain.\n     * </p>
 *
 * @see com.compliance.models.SOC2_CC6_2
 */
public static final String CC6_2 = "CC6.2";


    /**
 * <b>Access Control - De-provisioning</b>
 *
 * <p><b>Control ID:</b> CC6.3</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> high</p>
 *
 * <p><b>Description:</b><br>
 * The entity authorizes, modifies, or removes access to data, software,\n     * functions, and other protected information assets based on roles,\n     * responsibilities, or the system design and changes.\n     * </p>
 *
 * <p><b>Requirements:</b></p>
 * <ul>
 * <li>Automated deprovisioning on termination</li>
     * <li>Regular access reviews</li>
     * <li>Role change handling</li>
     * <li>Orphaned account detection</li>
     * <li>Audit trail of access changes</li>
 * </ul>
 *
 * <p><b>Implementation Guidance:</b><br>
 * Implement automated deprovisioning triggered by HR system events.\n     * Conduct quarterly access reviews to identify orphaned accounts.\n     * Log all access modifications with before/after state.\n     * </p>
 *
 * @see com.compliance.models.SOC2_CC6_3
 */
public static final String CC6_3 = "CC6.3";


    /**
 * <b>Encryption - Data at Rest</b>
 *
 * <p><b>Control ID:</b> CC6.6</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> critical</p>
 *
 * <p><b>Description:</b><br>
 * The entity implements logical access security measures to protect against\n     * threats from sources outside its system boundaries.\n     * </p>
 *
 * <p><b>Requirements:</b></p>
 * <ul>
 * <li>Encrypt sensitive data at rest</li>
     * <li>Use strong encryption algorithms (AES-256)</li>
     * <li>Secure key management</li>
     * <li>Regular key rotation</li>
     * <li>Hardware security modules (HSM) for key storage</li>
 * </ul>
 *
 * <p><b>Implementation Guidance:</b><br>
 * Use database-level encryption or application-level encryption for sensitive data.\n     * Store encryption keys in a separate key management service (KMS).\n     * Implement automatic key rotation policies.\n     * </p>
 *
 * @see com.compliance.models.SOC2_CC6_6
 */
public static final String CC6_6 = "CC6.6";


    /**
 * <b>Encryption - Data in Transit</b>
 *
 * <p><b>Control ID:</b> CC6.7</p>
 * <p><b>Category:</b> Logical and Physical Access Controls</p>
 * <p><b>Risk Level:</b> critical</p>
 *
 * <p><b>Description:</b><br>
 * The entity restricts the transmission, movement, and removal of information\n     * to authorized internal and external users and processes, and protects it\n     * during transmission, movement, or removal.\n     * </p>
 *
 * <p><b>Requirements:</b></p>
 * <ul>
 * <li>Use TLS 1.2+ for all communications</li>
     * <li>Implement certificate management</li>
     * <li>Enforce HTTPS for web applications</li>
     * <li>Encrypt API communications</li>
     * <li>Secure file transfer protocols</li>
 * </ul>
 *
 * <p><b>Implementation Guidance:</b><br>
 * Enforce TLS 1.3 for all external communications.\n     * Use mutual TLS (mTLS) for service-to-service communication.\n     * Implement certificate pinning for mobile applications.\n     * Regularly scan for weak ciphers and protocols.\n     * </p>
 *
 * @see com.compliance.models.SOC2_CC6_7
 */
public static final String CC6_7 = "CC6.7";


    /**
 * <b>System Operations - Detection</b>
 *
 * <p><b>Control ID:</b> CC7.1</p>
 * <p><b>Category:</b> System Operations</p>
 * <p><b>Risk Level:</b> high</p>
 *
 * <p><b>Description:</b><br>
 * To meet its objectives, the entity uses detection and monitoring procedures\n     * to identify (1) changes to configurations that result in the introduction\n     * of new vulnerabilities, and (2) susceptibilities to newly discovered\n     * vulnerabilities.\n     * </p>
 *
 * <p><b>Requirements:</b></p>
 * <ul>
 * <li>Real-time monitoring of system events</li>
     * <li>Automated alerting for security events</li>
     * <li>Log aggregation and analysis</li>
     * <li>Anomaly detection</li>
     * <li>Security information and event management (SIEM)</li>
 * </ul>
 *
 * <p><b>Implementation Guidance:</b><br>
 * Implement distributed tracing with OpenTelemetry.\n     * Use spans to track all security-relevant operations.\n     * Set up automated alerts for anomalies.\n     * Integrate with SIEM solutions for correlation.\n     * </p>
 *
 * @see com.compliance.models.SOC2_CC7_1
 */
public static final String CC7_1 = "CC7.1";


    /**
 * <b>System Operations - Monitoring</b>
 *
 * <p><b>Control ID:</b> CC7.2</p>
 * <p><b>Category:</b> System Operations</p>
 * <p><b>Risk Level:</b> medium</p>
 *
 * <p><b>Description:</b><br>
 * The entity monitors system components and the operation of those components\n     * for anomalies that are indicative of malicious acts, natural disasters,\n     * and errors affecting the entity's ability to meet its objectives.\n     * </p>
 *
 * <p><b>Requirements:</b></p>
 * <ul>
 * <li>Continuous system monitoring</li>
     * <li>Performance metrics tracking</li>
     * <li>Health checks and status monitoring</li>
     * <li>Automated incident response</li>
     * <li>Capacity planning and alerts</li>
 * </ul>
 *
 * <p><b>Implementation Guidance:</b><br>
 * Use Prometheus for metrics collection.\n     * Implement Grafana dashboards for visualization.\n     * Set up health check endpoints for all services.\n     * Configure auto-scaling based on metrics.\n     * </p>
 *
 * @see com.compliance.models.SOC2_CC7_2
 */
public static final String CC7_2 = "CC7.2";


    /**
 * <b>Change Management - Authorization</b>
 *
 * <p><b>Control ID:</b> CC8.1</p>
 * <p><b>Category:</b> Change Management</p>
 * <p><b>Risk Level:</b> medium</p>
 *
 * <p><b>Description:</b><br>
 * The entity authorizes, designs, develops or acquires, configures,\n     * documents, tests, approves, and implements changes to infrastructure,\n     * data, software, and procedures to meet its objectives.\n     * </p>
 *
 * <p><b>Requirements:</b></p>
 * <ul>
 * <li>Formal change approval process</li>
     * <li>Change documentation and tracking</li>
     * <li>Testing before deployment</li>
     * <li>Rollback procedures</li>
     * <li>Change review and audit</li>
 * </ul>
 *
 * <p><b>Implementation Guidance:</b><br>
 * Implement GitOps workflows with pull request approvals.\n     * Use automated testing in CI/CD pipelines.\n     * Maintain change logs with OpenTelemetry spans.\n     * Implement canary deployments for risk reduction.\n     * </p>
 *
 * @see com.compliance.models.SOC2_CC8_1
 */
public static final String CC8_1 = "CC8.1";

}
