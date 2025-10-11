package com.fluo.validation;

import com.fluo.services.TenantService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.UUID;

/**
 * Validator for TenantExists annotation.
 * Validates that a tenant ID references an existing tenant in the system.
 */
@ApplicationScoped
public class TenantExistsValidator implements ConstraintValidator<TenantExists, UUID> {

    @Inject
    public TenantService tenantService;

    @Override
    public boolean isValid(UUID tenantId, ConstraintValidatorContext context) {
        // @NotNull handles null check
        if (tenantId == null) {
            return true;
        }

        boolean exists = tenantService.exists(tenantId);

        if (!exists) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Tenant with ID " + tenantId + " does not exist"
            ).addConstraintViolation();
        }

        return exists;
    }
}
