package com.betrace.rules.dsl;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for error message quality and helpfulness
 */
class ErrorMessagesTest {

    private final FluoDslParser parser = new FluoDslParser();

    @Test
    void testErrorMessageShowsPosition() {
        try {
            parser.parse("trace.has(payment.charge) and trace.has(");
            fail("Should have thrown ParseError");
        } catch (ParseError error) {
            // Error message should include line and column
            assertTrue(error.getMessage().contains("line"));
            assertTrue(error.getMessage().contains("column"));
        }
    }

    @Test
    void testErrorMessageShowsPointer() {
        try {
            parser.parse("trace.has(payment.charge) and trace.has(");
            fail("Should have thrown ParseError");
        } catch (ParseError error) {
            // Error message should include visual pointer (^)
            assertTrue(error.getMessage().contains("^"));
        }
    }

    @Test
    void testErrorMessageShowsSuggestion() {
        try {
            parser.parse("trace.has(");
            fail("Should have thrown ParseError");
        } catch (ParseError error) {
            // Error message should include suggestion
            assertTrue(error.getMessage().contains("Suggestion") ||
                      error.getMessage().contains("suggestion"));
        }
    }

    @Test
    void testErrorMessageShowsContext() {
        String dsl = "trace.has(payment.charge).where(amount > 1000) and trace.has(";
        try {
            parser.parse(dsl);
            fail("Should have thrown ParseError");
        } catch (ParseError error) {
            // Should show the problematic part of the input
            String message = error.getMessage();
            assertNotNull(message);
            assertTrue(message.length() > 50); // Has context
        }
    }

    @Test
    void testMultilineErrorMessage() {
        String dsl = """
            trace.has(payment.charge_card).where(amount > 1000)
            and trace.has(
            """;

        try {
            parser.parse(dsl);
            fail("Should have thrown ParseError");
        } catch (ParseError error) {
            // Should handle multiline input correctly
            assertTrue(error.getLine() > 1);
            assertNotNull(error.getMessage());
        }
    }

    @Test
    void testValidationErrorFormatting() {
        String dsl = "trace.has(x)"; // Too short
        RuleExpression ast = parser.parse(dsl);

        RuleValidator validator = new RuleValidator();
        RuleValidator.ValidationResult result = validator.validate(ast);

        String formatted = result.formatErrors();

        // Should have nice formatting
        assertTrue(formatted.contains("error"));
        assertTrue(formatted.contains("Suggestion") || formatted.contains("💡"));
    }
}
