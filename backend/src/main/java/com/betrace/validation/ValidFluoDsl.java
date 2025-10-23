package com.fluo.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Validation annotation for FLUO DSL expressions.
 * Validates that rule expressions are syntactically correct.
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = FluoDslValidator.class)
public @interface ValidFluoDsl {
    String message() default "Invalid FLUO DSL syntax";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
