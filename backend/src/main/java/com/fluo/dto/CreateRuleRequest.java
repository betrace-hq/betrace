package com.fluo.dto;

import com.fluo.validation.TenantExists;
import com.fluo.validation.ValidFluoDsl;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Request DTO for creating a new rule.
 * Uses Bean Validation (JSR-380) annotations per PRD-007a.
 * Custom validators added per PRD-007b.
 */
public record CreateRuleRequest(
    @NotBlank(message = "Rule name is required")
    @Size(max = 255, message = "Rule name must not exceed 255 characters")
    String name,

    @NotBlank(message = "Rule expression is required")
    @Size(max = 5000, message = "Rule expression must not exceed 5000 characters")
    @ValidFluoDsl
    String expression,

    @NotNull(message = "Severity is required")
    String severity,

    @NotNull(message = "Tenant ID is required")
    @TenantExists
    UUID tenantId
) {}
