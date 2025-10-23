package com.betrace.compliance.annotations;

import java.lang.annotation.*;

/**
 * Compliance annotation for soc2 framework.
 *
 * <p>This annotation marks methods or classes as implementing specific
 * soc2 compliance controls. The annotation is processed at runtime
 * to generate compliance evidence and audit trails.</p>
 *
 * <p><b>Usage Example:</b></p>
 * <pre>
 * {@literal @}SOC2(controls = {SOC2Controls.CC6_1})
 * public void sensitiveOperation() {
 *     // Implementation
 * }
 * </pre>
 *
 * <p><b>Supported Controls:</b></p>
 * <ul>
 * <li>{@link SOC2Controls#CC6_1} - Logical Access - Authorization</li>
 * <li>{@link SOC2Controls#CC6_2} - Access Control - User Registration</li>
 * <li>{@link SOC2Controls#CC6_3} - Access Control - De-provisioning</li>
 * <li>{@link SOC2Controls#CC6_6} - Encryption - Data at Rest</li>
 * <li>{@link SOC2Controls#CC6_7} - Encryption - Data in Transit</li>
 * <li>{@link SOC2Controls#CC7_1} - System Operations - Detection</li>
 * <li>{@link SOC2Controls#CC7_2} - System Operations - Monitoring</li>
 * <li>{@link SOC2Controls#CC8_1} - Change Management - Authorization</li>
 * </ul>
 *
 * @see SOC2Controls
 * @see com.betrace.compliance.models.ComplianceControl
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE, ElementType.PARAMETER})
@Documented
public @interface SOC2 {
    /**
     * Array of control IDs from {@link SOC2Controls} that this code implements.
     *
     * <p>Use the constants from {@link SOC2Controls} for type-safe
     * control selection with IDE autocomplete support.</p>
     *
     * @return array of control ID strings
     */
    String[] controls() default {};

    /**
     * Additional implementation notes for auditors and reviewers.
     *
     * @return implementation notes
     */
    String notes() default "";

    /**
     * Whether to automatically log compliance events to audit trail.
     * When enabled, execution will emit OpenTelemetry spans with compliance attributes.
     *
     * @return true to enable automatic logging (default: true)
     */
    boolean autoLog() default true;

    /**
     * Priority level for this compliance control implementation.
     * Used for filtering and reporting.
     *
     * @return priority level
     */
    Priority priority() default Priority.MEDIUM;

    /**
     * Priority levels for compliance controls.
     */
    enum Priority {
        /** Low priority - informational controls */
        LOW,
        /** Medium priority - standard operational controls */
        MEDIUM,
        /** High priority - critical security controls */
        HIGH,
        /** Critical priority - essential compliance controls */
        CRITICAL
    }
}
