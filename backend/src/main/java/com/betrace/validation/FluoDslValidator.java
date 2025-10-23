package com.betrace.validation;

import com.betrace.rules.dsl.FluoDslParser;
import com.betrace.rules.dsl.ParseError;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.*;

/**
 * Validator for FLUO DSL expressions.
 * Validates that rule expressions can be successfully parsed.
 *
 * Security: Implements timeout and length limits to prevent ReDoS attacks.
 */
@ApplicationScoped
public class FluoDslValidator implements ConstraintValidator<ValidFluoDsl, String> {

    private static final Logger logger = LoggerFactory.getLogger(FluoDslValidator.class);
    private static final int MAX_DSL_LENGTH = 10_000; // 10KB limit
    private static final long PARSE_TIMEOUT_MS = 500; // 500ms timeout

    @Inject
    public FluoDslParser dslParser;

    @Override
    public boolean isValid(String expression, ConstraintValidatorContext context) {
        if (expression == null || expression.isBlank()) {
            return true;  // @NotBlank handles this
        }

        // Length check (DoS prevention)
        if (expression.length() > MAX_DSL_LENGTH) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "DSL expression exceeds maximum length of " + MAX_DSL_LENGTH + " characters"
            ).addConstraintViolation();
            return false;
        }

        // Timeout protection (ReDoS prevention)
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<Void> parseFuture = executor.submit(() -> {
                dslParser.parse(expression);
                return null;
            });

            parseFuture.get(PARSE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            return true;

        } catch (TimeoutException e) {
            logger.warn("DSL parsing timeout for expression length: {}", expression.length());
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "DSL expression too complex (parsing timeout)"
            ).addConstraintViolation();
            return false;

        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            // Log detailed error server-side only (security: don't leak parser internals)
            logger.debug("DSL parse error: {}", cause.getMessage());
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(
                "Invalid FLUO DSL syntax"
            ).addConstraintViolation();
            return false;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            logger.error("DSL validation interrupted", e);
            return false;

        } finally {
            executor.shutdownNow();
        }
    }
}
