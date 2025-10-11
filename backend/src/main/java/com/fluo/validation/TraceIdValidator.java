package com.fluo.validation;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.regex.Pattern;

/**
 * Validator for OpenTelemetry Trace IDs.
 * Validates that Trace IDs are 32-character hexadecimal strings.
 */
@ApplicationScoped
public class TraceIdValidator implements ConstraintValidator<ValidTraceId, String> {

    private static final Pattern TRACE_ID_PATTERN = Pattern.compile("^[a-fA-F0-9]{32}$");

    @Override
    public boolean isValid(String traceId, ConstraintValidatorContext context) {
        if (traceId == null || traceId.isBlank()) {
            return true;  // @NotBlank handles this
        }

        boolean valid = TRACE_ID_PATTERN.matcher(traceId).matches();

        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Trace ID must be 32-character hexadecimal (OpenTelemetry format). Got: " + traceId
            ).addConstraintViolation();
        }

        return valid;
    }
}
