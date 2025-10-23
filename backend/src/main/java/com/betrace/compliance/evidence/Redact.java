package com.betrace.compliance.evidence;

import java.lang.annotation.*;

/**
 * Marks a parameter or field as sensitive data that should be redacted from evidence.
 *
 * <p>When applied to method parameters or class fields, the annotated data will not
 * appear in OpenTelemetry spans or compliance evidence records.</p>
 *
 * <p><b>Example:</b></p>
 * <pre>
 * public void login(
 *     String username,
 *     {@literal @}Redact String password
 * ) {
 *     // password will not appear in evidence spans
 * }
 * </pre>
 *
 * @see RedactionStrategy
 * @see Sensitive
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.PARAMETER, ElementType.FIELD})
@Documented
public @interface Redact {
    /**
     * The redaction strategy to apply.
     * Default is EXCLUDE (completely omit from evidence).
     *
     * @return redaction strategy
     */
    RedactionStrategy strategy() default RedactionStrategy.EXCLUDE;

    /**
     * For TRUNCATE strategy, number of characters to preserve at start/end.
     *
     * @return number of characters to preserve
     */
    int preserve() default 4;
}
