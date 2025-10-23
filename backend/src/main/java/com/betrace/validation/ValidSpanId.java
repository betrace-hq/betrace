package com.betrace.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Validation annotation for OpenTelemetry Span IDs.
 * Span IDs must be 16-character hexadecimal strings per OpenTelemetry specification.
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = SpanIdValidator.class)
public @interface ValidSpanId {
    String message() default "Invalid Span ID format (must be 16-character hex)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
