package com.fluo.rules.dsl;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for FLUO DSL Parser
 */
class FluoDslParserTest {

    private final FluoDslParser parser = new FluoDslParser();

    @Test
    void testSimpleHasExpression() {
        String dsl = "trace.has(payment.charge_card)";
        RuleExpression ast = parser.parse(dsl);

        assertInstanceOf(HasExpression.class, ast);
        HasExpression has = (HasExpression) ast;
        assertEquals("payment.charge_card", has.operationName());
        assertTrue(has.whereClauses().isEmpty());
    }

    @Test
    void testHasWithSingleWhere() {
        String dsl = "trace.has(payment.charge_card).where(amount > 1000)";
        RuleExpression ast = parser.parse(dsl);

        assertInstanceOf(HasExpression.class, ast);
        HasExpression has = (HasExpression) ast;
        assertEquals("payment.charge_card", has.operationName());
        assertEquals(1, has.whereClauses().size());

        WhereClause where = has.whereClauses().get(0);
        assertEquals("amount", where.attribute());
        assertEquals(">", where.operator());
        assertEquals(1000.0, where.value());
    }

    @Test
    void testHasWithMultipleWhere() {
        String dsl = "trace.has(payment.charge).where(amount > 1000).where(currency == USD)";
        RuleExpression ast = parser.parse(dsl);

        assertInstanceOf(HasExpression.class, ast);
        HasExpression has = (HasExpression) ast;
        assertEquals(2, has.whereClauses().size());

        assertEquals("amount", has.whereClauses().get(0).attribute());
        assertEquals("currency", has.whereClauses().get(1).attribute());
    }

    @Test
    void testAndExpression() {
        String dsl = "trace.has(payment.charge_card) and trace.has(payment.fraud_check)";
        RuleExpression ast = parser.parse(dsl);

        assertInstanceOf(BinaryExpression.class, ast);
        BinaryExpression binary = (BinaryExpression) ast;
        assertEquals("and", binary.operator());
        assertInstanceOf(HasExpression.class, binary.left());
        assertInstanceOf(HasExpression.class, binary.right());
    }

    @Test
    void testNotExpression() {
        String dsl = "not trace.has(payment.fraud_check)";
        RuleExpression ast = parser.parse(dsl);

        assertInstanceOf(NotExpression.class, ast);
        NotExpression not = (NotExpression) ast;
        assertInstanceOf(HasExpression.class, not.expression());
    }

    @Test
    void testComplexExpression() {
        String dsl = "trace.has(payment.charge_card).where(amount > 1000) and not trace.has(payment.fraud_check)";
        RuleExpression ast = parser.parse(dsl);

        assertInstanceOf(BinaryExpression.class, ast);
        BinaryExpression binary = (BinaryExpression) ast;
        assertEquals("and", binary.operator());

        // Left side: has with where
        assertInstanceOf(HasExpression.class, binary.left());
        HasExpression left = (HasExpression) binary.left();
        assertEquals("payment.charge_card", left.operationName());
        assertEquals(1, left.whereClauses().size());

        // Right side: not has
        assertInstanceOf(NotExpression.class, binary.right());
    }

    @Test
    void testComparisonOperators() {
        assertParsesWhereOperator("amount == 100", "==", 100.0);
        assertParsesWhereOperator("amount != 100", "!=", 100.0);
        assertParsesWhereOperator("amount > 100", ">", 100.0);
        assertParsesWhereOperator("amount >= 100", ">=", 100.0);
        assertParsesWhereOperator("amount < 100", "<", 100.0);
        assertParsesWhereOperator("amount <= 100", "<=", 100.0);
    }

    @Test
    void testBooleanValues() {
        String dsl = "trace.has(database.query).where(contains_pii == true)";
        RuleExpression ast = parser.parse(dsl);

        HasExpression has = (HasExpression) ast;
        WhereClause where = has.whereClauses().get(0);
        assertEquals(true, where.value());
    }

    @Test
    void testStringValues() {
        String dsl = "trace.has(payment.charge).where(currency == \"USD\")";
        RuleExpression ast = parser.parse(dsl);

        HasExpression has = (HasExpression) ast;
        WhereClause where = has.whereClauses().get(0);
        assertEquals("USD", where.value());
    }

    @Test
    void testCountExpression() {
        String dsl = "trace.count(http.retry) > 3";
        RuleExpression ast = parser.parse(dsl);

        assertInstanceOf(CountExpression.class, ast);
        CountExpression count = (CountExpression) ast;
        assertEquals("http.retry", count.pattern());
        assertEquals(">", count.operator());
        assertEquals(3, count.value());
    }

    // Error handling tests

    @Test
    void testEmptyExpression() {
        ParseError error = assertThrows(ParseError.class, () -> parser.parse(""));
        assertTrue(error.getMessage().contains("Empty DSL expression"));
    }

    @Test
    void testMissingClosingParen() {
        ParseError error = assertThrows(ParseError.class, () ->
            parser.parse("trace.has(payment.charge")
        );
        assertTrue(error.getMessage().contains("Expected ')'"));
    }

    @Test
    void testInvalidOperator() {
        ParseError error = assertThrows(ParseError.class, () ->
            parser.parse("trace.has(payment.charge).where(amount === 100)")
        );
        // Should fail because === is not a valid operator
        assertNotNull(error);
    }

    @Test
    void testUnexpectedToken() {
        ParseError error = assertThrows(ParseError.class, () ->
            parser.parse("trace.has(payment.charge) &&& trace.has(fraud.check)")
        );
        assertNotNull(error);
    }

    @Test
    void testMissingOperationName() {
        ParseError error = assertThrows(ParseError.class, () ->
            parser.parse("trace.has()")
        );
        assertTrue(error.getMessage().contains("Expected operation name"));
    }

    // Helper methods

    private void assertParsesWhereOperator(String whereClause, String expectedOp, Object expectedValue) {
        String dsl = "trace.has(test)." + whereClause;
        RuleExpression ast = parser.parse(dsl);

        HasExpression has = (HasExpression) ast;
        WhereClause where = has.whereClauses().get(0);
        assertEquals(expectedOp, where.operator());
        assertEquals(expectedValue, where.value());
    }
}
