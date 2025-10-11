package com.fluo.processors.validation;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Named processor for handling Bean Validation errors.
 * Converts ConstraintViolationException to structured JSON error response.
 * Follows ADR-014 (Named Processors) pattern.
 */
@Named("validationErrorProcessor")
@ApplicationScoped
public class ValidationErrorProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);

        if (cause instanceof ConstraintViolationException cve) {
            List<Map<String, Object>> violations = extractViolations(cve.getConstraintViolations());

            Map<String, Object> response = Map.of(
                "error", "Validation failed",
                "violations", violations
            );

            exchange.getIn().setBody(response);
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
        }
    }

    private List<Map<String, Object>> extractViolations(Set<ConstraintViolation<?>> violations) {
        return violations.stream()
            .map(v -> Map.<String, Object>of(
                "field", v.getPropertyPath().toString(),
                "message", v.getMessage(),
                "rejectedValue", v.getInvalidValue() != null ? v.getInvalidValue() : "null"
            ))
            .collect(Collectors.toList());
    }
}
