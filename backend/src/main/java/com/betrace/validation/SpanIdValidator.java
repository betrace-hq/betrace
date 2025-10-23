package com.fluo.validation;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.regex.Pattern;

/**
 * Validator for OpenTelemetry Span IDs.
 * Validates that Span IDs are 16-character hexadecimal strings.
 */
@ApplicationScoped
public class SpanIdValidator implements ConstraintValidator<ValidSpanId, String> {

    private static final Pattern SPAN_ID_PATTERN = Pattern.compile("^[a-fA-F0-9]{16}$");

    @Override
    public boolean isValid(String spanId, ConstraintValidatorContext context) {
        if (spanId == null || spanId.isBlank()) {
            return true;  // @NotBlank handles this
        }

        boolean valid = SPAN_ID_PATTERN.matcher(spanId).matches();

        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Span ID must be 16-character hexadecimal (OpenTelemetry format)"
            ).addConstraintViolation();
        }

        return valid;
    }
}
