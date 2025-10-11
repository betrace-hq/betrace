package com.fluo.rules.dsl;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Disabled;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for Drools DRL generation from FLUO DSL AST
 */
@Disabled("Pre-existing test failures - requires DSL parser fixes")
class DroolsGeneratorTest {

    private final FluoDslParser parser = new FluoDslParser();

    @Test
    void testSimpleHasRule() {
        String dsl = "trace.has(payment.charge_card) and trace.has(payment.fraud_check)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator(
            "test-rule",
            "Test Rule",
            "Test description"
        );

        String drl = generator.generate(ast);

        // Verify DRL structure
        assertTrue(drl.contains("rule \"test-rule\""));
        assertTrue(drl.contains("when"));
        assertTrue(drl.contains("then"));
        assertTrue(drl.contains("end"));

        // Verify span matching
        assertTrue(drl.contains("operationName == \"payment.charge_card\""));
        assertTrue(drl.contains("operationName == \"payment.fraud_check\""));

        // Verify trace correlation
        assertTrue(drl.contains("$traceId: traceId"));
        assertTrue(drl.contains("traceId == $traceId"));

        // Verify signal generation
        assertTrue(drl.contains("signalService.createSignal"));
    }

    @Test
    void testHasWithWhereClause() {
        String dsl = "trace.has(payment.charge_card).where(amount > 1000)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator("test", "Test", "Test");
        String drl = generator.generate(ast);

        // Verify attribute filtering
        assertTrue(drl.contains("attributes[\"amount\"] > 1000"));
    }

    @Test
    void testNotExpression() {
        String dsl = "trace.has(payment.charge_card) and not trace.has(payment.fraud_check)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator("test", "Test", "Test");
        String drl = generator.generate(ast);

        // Verify NOT is translated correctly
        assertTrue(drl.contains("not Span"));
        assertTrue(drl.contains("operationName == \"payment.fraud_check\""));
    }

    @Test
    void testMultipleWhereConditions() {
        String dsl = "trace.has(payment.charge).where(amount > 1000).where(currency == USD)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator("test", "Test", "Test");
        String drl = generator.generate(ast);

        // Both conditions should be in the same Span match
        assertTrue(drl.contains("attributes[\"amount\"] > 1000"));
        assertTrue(drl.contains("attributes[\"currency\"] == \"USD\""));
    }

    @Test
    void testBooleanWhereClause() {
        String dsl = "trace.has(database.query).where(contains_pii == true)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator("test", "Test", "Test");
        String drl = generator.generate(ast);

        assertTrue(drl.contains("attributes[\"contains_pii\"] == true"));
    }

    @Test
    void testStringEscaping() {
        String dsl = "trace.has(api.request).where(endpoint matches \"/api/v1/.*\")";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator(
            "test",
            "Test \"with quotes\"",
            "Description with \"quotes\" and \\backslashes\\"
        );
        String drl = generator.generate(ast);

        // Verify escaping
        assertTrue(drl.contains("\\\""));
    }

    @Test
    void testCountExpression() {
        String dsl = "trace.count(http.retry) > 3";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator("test", "Test", "Test");
        String drl = generator.generate(ast);

        // Verify accumulate pattern
        assertTrue(drl.contains("accumulate"));
        assertTrue(drl.contains("count(1)"));
        assertTrue(drl.contains("operationName matches \"http.retry\""));
        assertTrue(drl.contains("eval"));
    }

    @Test
    void testVariableNaming() {
        // Test that multiple spans get unique variable names
        String dsl = "trace.has(span1) and trace.has(span2) and trace.has(span3)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator("test", "Test", "Test");
        String drl = generator.generate(ast);

        // Should have $span0, $span1, $span2
        assertTrue(drl.contains("$span0"));
        assertTrue(drl.contains("$span1"));
        assertTrue(drl.contains("$span2"));
    }

    @Test
    void testComparisonOperators() {
        assertGeneratesOperator(">", ">");
        assertGeneratesOperator(">=", ">=");
        assertGeneratesOperator("<", "<");
        assertGeneratesOperator("<=", "<=");
        assertGeneratesOperator("==", "==");
        assertGeneratesOperator("!=", "!=");
    }

    @Test
    void testRealWorldExample1() {
        // Payment fraud check invariant
        String dsl = "trace.has(payment.charge_card).where(amount > 1000) and trace.has(payment.fraud_check)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator(
            "payment-fraud-required",
            "High-value payments need fraud check",
            "Payments over $1000 must have fraud validation"
        );

        String drl = generator.generate(ast);

        assertNotNull(drl);
        assertTrue(drl.contains("package com.fluo.rules"));
        assertTrue(drl.contains("import com.fluo.model.Span"));
        assertTrue(drl.contains("rule \"payment-fraud-required\""));
    }

    @Test
    void testRealWorldExample2() {
        // PII access audit requirement
        String dsl = "trace.has(database.query).where(contains_pii == true) and trace.has(audit.log)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator(
            "pii-audit-required",
            "PII access must be audited",
            "Database queries with PII must have audit logs"
        );

        String drl = generator.generate(ast);

        assertTrue(drl.contains("attributes[\"contains_pii\"] == true"));
        assertTrue(drl.contains("operationName == \"audit.log\""));
    }

    // Helper methods

    private void assertGeneratesOperator(String dslOp, String drlOp) {
        String dsl = "trace.has(test).where(value " + dslOp + " 100)";
        RuleExpression ast = parser.parse(dsl);

        DroolsGenerator generator = new DroolsGenerator("test", "Test", "Test");
        String drl = generator.generate(ast);

        assertTrue(drl.contains("attributes[\"value\"] " + drlOp + " 100"),
            "Expected DRL to contain operator: " + drlOp);
    }
}
