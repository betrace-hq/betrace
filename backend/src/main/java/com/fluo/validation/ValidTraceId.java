package com.fluo.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Validation annotation for OpenTelemetry Trace IDs.
 * Trace IDs must be 32-character hexadecimal strings per OpenTelemetry specification.
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = TraceIdValidator.class)
public @interface ValidTraceId {
    String message() default "Invalid Trace ID format (must be 32-character hex)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
