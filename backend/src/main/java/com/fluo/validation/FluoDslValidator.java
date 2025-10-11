package com.fluo.validation;

import com.fluo.rules.dsl.FluoDslParser;
import com.fluo.rules.dsl.ParseError;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Validator for FLUO DSL expressions.
 * Validates that rule expressions can be successfully parsed.
 */
@ApplicationScoped
public class FluoDslValidator implements ConstraintValidator<ValidFluoDsl, String> {

    @Inject
    public FluoDslParser dslParser;

    @Override
    public boolean isValid(String expression, ConstraintValidatorContext context) {
        if (expression == null || expression.isBlank()) {
            return true;  // @NotBlank handles this
        }

        try {
            dslParser.parse(expression);
            return true;
        } catch (Exception e) {
            // Catch both ParseError and any other parser exceptions
            context.disableDefaultConstraintViolation();

            String errorMessage = e.getMessage() != null ? e.getMessage() : "Parse error";
            context.buildConstraintViolationWithTemplate(
                "Invalid FLUO DSL: " + errorMessage
            ).addConstraintViolation();

            return false;
        }
    }
}
