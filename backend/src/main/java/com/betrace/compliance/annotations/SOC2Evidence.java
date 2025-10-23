package com.betrace.compliance.annotations;

import com.betrace.compliance.evidence.*;
import java.lang.annotation.*;

/**
 * Marks a method as producing evidence for soc2 compliance controls.
 *
 * <p>When a method is annotated with @SOC2Evidence, an interceptor
 * automatically captures method inputs, outputs, and side effects, and emits
 * an immutable OpenTelemetry span with compliance attributes.</p>
 *
 * <p><b>Automatic Capture:</b></p>
 * <ul>
 * <li>Method inputs (with redaction of @Redact/@Sensitive fields)</li>
 * <li>Method outputs (with redaction)</li>
 * <li>Side effects (database calls, HTTP requests, etc.)</li>
 * <li>Execution duration</li>
 * <li>Errors and exceptions</li>
 * </ul>
 *
 * <p><b>Example:</b></p>
 * <pre>
 * {@literal @}SOC2Evidence(
 *     control = SOC2Controls.CC6_1,
 *     evidenceType = EvidenceType.AUDIT_TRAIL
 * )
 * public User createUser(
 *     String email,
 *     {@literal @}Redact String password
 * ) {
 *     // Evidence automatically captured:
 *     // - Input: email (password redacted)
 *     // - Output: User object
 *     // - Side effects: database.save()
 *     // - Emitted as immutable OpenTelemetry span
 *     User user = new User(email, hashPassword(password));
 *     database.save(user);
 *     return user;
 * }
 * </pre>
 *
 * @see Redact
 * @see Sensitive
 * @see ComplianceSpan
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
@Documented
public @interface SOC2Evidence {
    /**
     * Control ID from SOC2Controls that this method provides evidence for.
     *
     * @return control ID
     */
    String control();

    /**
     * Type of evidence produced by this method.
     *
     * @return evidence type
     */
    EvidenceType evidenceType() default EvidenceType.AUDIT_TRAIL;

    /**
     * Additional notes about the evidence.
     *
     * @return notes
     */
    String notes() default "";

    /**
     * Whether to capture method inputs.
     *
     * @return true to capture inputs (default: true)
     */
    boolean captureInputs() default true;

    /**
     * Whether to capture method outputs.
     *
     * @return true to capture outputs (default: true)
     */
    boolean captureOutputs() default true;

    /**
     * Whether to capture side effects (DB calls, HTTP requests).
     *
     * @return true to capture side effects (default: true)
     */
    boolean captureSideEffects() default true;
}
