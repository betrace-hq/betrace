package com.betrace.compliance.evidence;

import java.lang.annotation.*;

/**
 * Marks a field as Personally Identifiable Information (PII).
 *
 * <p>PII handling is configurable: can be included, hashed, or excluded
 * based on compliance requirements and evidence configuration.</p>
 *
 * <p><b>Example:</b></p>
 * <pre>
 * public class User {
 *     {@literal @}PII
 *     public String ssn;
 *
 *     {@literal @}PII
 *     public String email;
 * }
 * </pre>
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Documented
public @interface PII {
    /**
     * Optional redaction strategy override.
     * If not specified, uses global PII configuration.
     */
    RedactionStrategy strategy() default RedactionStrategy.HASH;
}
