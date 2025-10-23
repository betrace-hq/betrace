package com.fluo.compliance.annotations;

import java.lang.annotation.*;
import jakarta.interceptor.InterceptorBinding;

/**
 * Marks methods for compliance tracking with specific framework controls
 * Based on real compliance frameworks: SOC 2, HIPAA, FedRAMP, ISO 27001, PCI-DSS
 *
 * Example:
 * @ComplianceControl(
 *     soc2 = {"CC6.1", "CC6.2", "CC7.1"},
 *     hipaa = {"164.312(a)", "164.312(b)"},
 *     fedramp = {"AC-2", "AU-2", "SC-13"}
 * )
 */
@Inherited
@InterceptorBinding
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
@Documented
public @interface ComplianceControl {

    /**
     * SOC 2 Common Criteria controls
     * Examples: CC6.1 (Logical Access), CC6.7 (Encryption), CC7.1 (Monitoring)
     */
    String[] soc2() default {};

    /**
     * HIPAA Security Rule safeguards
     * Examples: 164.312(a) (Access Control), 164.312(b) (Audit Controls)
     */
    String[] hipaa() default {};

    /**
     * FedRAMP controls from NIST 800-53
     * Examples: AC-2 (Account Management), SC-13 (Cryptographic Protection)
     */
    String[] fedramp() default {};

    /**
     * ISO 27001:2022 Annex A controls
     * Examples: A.5.15 (Access Control), A.8.24 (Cryptography)
     */
    String[] iso27001() default {};

    /**
     * PCI-DSS v4.0 requirements
     * Examples: 3.4 (Encryption), 7.1 (Access Control), 10.1 (Audit Trails)
     */
    String[] pcidss() default {};

    /**
     * Impact level for FedRAMP controls
     */
    FedRAMPLevel fedrampLevel() default FedRAMPLevel.MODERATE;

    /**
     * Indicates if this control handles sensitive data
     */
    boolean sensitiveData() default false;

    /**
     * Audit retention period in days (default: 2555 = 7 years for HIPAA)
     */
    int retentionDays() default 2555;

    /**
     * Priority for audit and compliance reporting
     */
    Priority priority() default Priority.NORMAL;

    enum FedRAMPLevel {
        LOW,      // 150 controls
        MODERATE, // 304 controls
        HIGH      // 392 controls
    }

    enum Priority {
        LOW,
        NORMAL,
        HIGH,
        CRITICAL
    }
}