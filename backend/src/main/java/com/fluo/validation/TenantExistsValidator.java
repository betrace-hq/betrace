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
 *
 * SECURITY WARNING: This validator CANNOT check authorization because it runs
 * during JSON unmarshalling, before Camel routes execute. Authorization MUST
 * be enforced at the route layer using TenantSecurityProcessor.
 *
 * ENUMERATION RISK MITIGATION:
 * - Uses generic error messages to prevent obvious tenant enumeration
 * - However, timing attacks may still reveal tenant existence
 * - Routes MUST validate tenant access with TenantService.hasAccess() before processing
 *
 * @see com.fluo.security.TenantSecurityProcessor
 * @see com.fluo.services.TenantService#hasAccess(String, String)
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
            // Generic error message to prevent tenant enumeration
            context.buildConstraintViolationWithTemplate(
                "Invalid tenant identifier"
            ).addConstraintViolation();
        }

        return exists;
    }
}
