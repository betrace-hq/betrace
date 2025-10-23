package com.fluo.compliance.evidence;

import java.lang.annotation.*;

/**
 * Marks a field as sensitive - always excluded from evidence.
 *
 * <p>Equivalent to {@literal @}Redact(strategy = RedactionStrategy.EXCLUDE)</p>
 *
 * <p><b>Example:</b></p>
 * <pre>
 * public class User {
 *     public String id;         // Captured in evidence
 *     public String email;      // Captured in evidence
 *
 *     {@literal @}Sensitive
 *     public String password;   // Never captured
 * }
 * </pre>
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Documented
public @interface Sensitive {
}
