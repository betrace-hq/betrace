package com.fluo.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Validation annotation for tenant existence checks.
 * Validates that a tenant ID references an existing tenant in the system.
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = TenantExistsValidator.class)
public @interface TenantExists {
    String message() default "Tenant does not exist";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
