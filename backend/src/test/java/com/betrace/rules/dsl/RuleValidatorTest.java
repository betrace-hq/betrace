package com.betrace.rules.dsl;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for rule validation
 */
class RuleValidatorTest {

    private final FluoDslParser parser = new FluoDslParser();
    private final RuleValidator validator = new RuleValidator();

    @Test
    void testValidRulePasses() {
        String dsl = "trace.has(payment.charge_card).where(amount > 1000) and trace.has(payment.fraud_check)";
        RuleExpression ast = parser.parse(dsl);

        RuleValidator.ValidationResult result = validator.validate(ast);

        assertTrue(result.isValid());
        assertTrue(result.getErrors().isEmpty());
    }

    @Test
    void testShortOperationNameWarning() {
        String dsl = "trace.has(ab)";
        RuleExpression ast = parser.parse(dsl);

        RuleValidator.ValidationResult result = validator.validate(ast);

        assertFalse(result.isValid());
        assertFalse(result.getErrors().isEmpty());
        assertTrue(result.getErrors().get(0).format().contains("too short"));
    }

    @Test
    void testUnconventionalOperationNameWarning() {
        String dsl = "trace.has(paymentcharge)"; // no dot
        RuleExpression ast = parser.parse(dsl);

        RuleValidator.ValidationResult result = validator.validate(ast);

        // Should warn about convention
        assertFalse(result.getWarnings().isEmpty());
        assertTrue(result.getWarnings().get(0).contains("convention"));
    }

    @Test
    void testUnknownAttributeWarning() {
        String dsl = "trace.has(payment.charge).where(unknown_attribute > 100)";
        RuleExpression ast = parser.parse(dsl);

        RuleValidator.ValidationResult result = validator.validate(ast);

        // Should warn about unknown attribute
        assertFalse(result.getWarnings().isEmpty());
        assertTrue(result.getWarnings().get(0).contains("not commonly used"));
    }

    @Test
    void testExactAmountComparisonWarning() {
        String dsl = "trace.has(payment.charge).where(amount == 100)";
        RuleExpression ast = parser.parse(dsl);

        RuleValidator.ValidationResult result = validator.validate(ast);

        // Should warn about exact comparison
        assertFalse(result.getWarnings().isEmpty());
        assertTrue(result.getWarnings().get(0).contains("fragile"));
    }

    @Test
    void testHighCountWarning() {
        String dsl = "trace.count(http.request) > 1001";
        RuleExpression ast = parser.parse(dsl);

        RuleValidator.ValidationResult result = validator.validate(ast);

        assertFalse(result.getWarnings().isEmpty());
        assertTrue(result.getWarnings().get(0).contains("performance"));
    }

    @Test
    void testOrExpressionWarning() {
        String dsl = "trace.has(payment.charge) or trace.has(payment.refund)";
        RuleExpression ast = parser.parse(dsl);

        RuleValidator.ValidationResult result = validator.validate(ast);

        assertFalse(result.getWarnings().isEmpty());
        assertTrue(result.getWarnings().get(0).contains("OR expressions"));
    }

    @Test
    void testDroolsValidation() {
        String validDrl = """
            rule "test"
            when
                $span: Span()
            then
                signalService.createSignal($span, "test", "desc");
            end
            """;

        RuleValidator.DroolsValidationResult result = RuleValidator.validateDrools(validDrl);
        assertTrue(result.isValid());
    }

    @Test
    void testDroolsValidationInvalidDrl() {
        String invalidDrl = "not a valid rule";

        RuleValidator.DroolsValidationResult result = RuleValidator.validateDrools(invalidDrl);
        assertFalse(result.isValid());
        assertFalse(result.getErrors().isEmpty());
    }
}
