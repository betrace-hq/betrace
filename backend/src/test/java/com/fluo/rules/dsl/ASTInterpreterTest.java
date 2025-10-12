package com.fluo.rules.dsl;

import com.fluo.model.Span;
import com.fluo.rules.RuleContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for ASTInterpreter - Safe AST evaluation without Java code execution.
 */
class ASTInterpreterTest {

    private ASTInterpreter interpreter;
    private RuleContext ruleContext;
    private List<Span> testSpans;

    @BeforeEach
    void setUp() {
        interpreter = new ASTInterpreter();
        ruleContext = RuleContext.forTenant("test-tenant");
        testSpans = createTestSpans();
    }

    private List<Span> createTestSpans() {
        List<Span> spans = new ArrayList<>();

        // Root span
        spans.add(Span.create(
            "span-1",
            "trace-123",
            "GET /api/users",
            "api-gateway",
            Instant.now().minusSeconds(5),
            Instant.now().minusSeconds(4),
            Map.of("http.status_code", 200, "user.authenticated", true),
            "test-tenant"
        ));

        // Database query span
        spans.add(Span.create(
            "span-2",
            "trace-123",
            "database.query",
            "postgres",
            Instant.now().minusSeconds(4),
            Instant.now().minusSeconds(3),
            Map.of("query.duration_ms", 1500, "pii", true),
            "test-tenant"
        ));

        // Auth check span
        spans.add(Span.create(
            "span-3",
            "trace-123",
            "auth.check",
            "auth-service",
            Instant.now().minusSeconds(3),
            Instant.now().minusSeconds(2),
            Map.of("user.id", "user-456", "result", "success"),
            "test-tenant"
        ));

        return spans;
    }

    @Test
    @DisplayName("HasExpression: Should match span by operation name")
    void testHasExpressionSimple() {
        HasExpression expr = new HasExpression("auth.check");

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should find span with operationName 'auth.check'");
    }

    @Test
    @DisplayName("HasExpression: Should return false for non-existent operation")
    void testHasExpressionNotFound() {
        HasExpression expr = new HasExpression("nonexistent.operation");

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertFalse(result, "Should not find non-existent operation");
    }

    @Test
    @DisplayName("HasExpression with where clause: Equality operator")
    void testHasExpressionWithWhereEquals() {
        HasExpression expr = new HasExpression("auth.check");
        expr.addWhereClause(new WhereClause("result", "==", "success"));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match span with result == 'success'");
    }

    @Test
    @DisplayName("HasExpression with where clause: Greater than operator")
    void testHasExpressionWithWhereGreaterThan() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("query.duration_ms", ">", 1000));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match span with duration > 1000");
    }

    @Test
    @DisplayName("HasExpression with where clause: Less than operator")
    void testHasExpressionWithWhereLessThan() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("query.duration_ms", "<", 2000));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match span with duration < 2000");
    }

    @Test
    @DisplayName("HasExpression with where clause: Boolean attribute")
    void testHasExpressionWithBooleanAttribute() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("pii", "==", true));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match span with pii == true");
    }

    @Test
    @DisplayName("HasExpression with multiple where clauses: All must match")
    void testHasExpressionWithMultipleWhereClauses() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("pii", "==", true));
        expr.addWhereClause(new WhereClause("query.duration_ms", ">", 1000));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match span with pii==true AND duration>1000");
    }

    @Test
    @DisplayName("HasExpression: Built-in operationName attribute")
    void testHasExpressionBuiltInAttribute() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("operationName", "==", "database.query"));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match span by built-in operationName attribute");
    }

    @Test
    @DisplayName("CountExpression: Equals operator")
    void testCountExpressionEquals() {
        CountExpression expr = new CountExpression("database.query", "==", 1);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should count exactly 1 database.query span");
    }

    @Test
    @DisplayName("CountExpression: Greater than operator")
    void testCountExpressionGreaterThan() {
        CountExpression expr = new CountExpression("database.query", ">", 0);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should have more than 0 database.query spans");
    }

    @Test
    @DisplayName("CountExpression: Zero count")
    void testCountExpressionZero() {
        CountExpression expr = new CountExpression("nonexistent.operation", "==", 0);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should count 0 for non-existent operation");
    }

    @Test
    @DisplayName("BinaryExpression: AND operator - both true")
    void testBinaryExpressionAndBothTrue() {
        HasExpression left = new HasExpression("auth.check");
        HasExpression right = new HasExpression("database.query");
        BinaryExpression expr = new BinaryExpression("and", left, right);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should return true for true AND true");
    }

    @Test
    @DisplayName("BinaryExpression: AND operator - left false (short-circuit)")
    void testBinaryExpressionAndShortCircuit() {
        HasExpression left = new HasExpression("nonexistent");
        HasExpression right = new HasExpression("database.query");
        BinaryExpression expr = new BinaryExpression("and", left, right);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertFalse(result, "Should return false and short-circuit on left false");
    }

    @Test
    @DisplayName("BinaryExpression: OR operator - left true (short-circuit)")
    void testBinaryExpressionOrShortCircuit() {
        HasExpression left = new HasExpression("auth.check");
        HasExpression right = new HasExpression("nonexistent");
        BinaryExpression expr = new BinaryExpression("or", left, right);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should return true and short-circuit on left true");
    }

    @Test
    @DisplayName("BinaryExpression: OR operator - both false")
    void testBinaryExpressionOrBothFalse() {
        HasExpression left = new HasExpression("nonexistent1");
        HasExpression right = new HasExpression("nonexistent2");
        BinaryExpression expr = new BinaryExpression("or", left, right);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertFalse(result, "Should return false for false OR false");
    }

    @Test
    @DisplayName("NotExpression: Negates true to false")
    void testNotExpressionTrue() {
        HasExpression inner = new HasExpression("auth.check");
        NotExpression expr = new NotExpression(inner);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertFalse(result, "Should negate true to false");
    }

    @Test
    @DisplayName("NotExpression: Negates false to true")
    void testNotExpressionFalse() {
        HasExpression inner = new HasExpression("nonexistent");
        NotExpression expr = new NotExpression(inner);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should negate false to true");
    }

    @Test
    @DisplayName("Complex expression: (A AND B) OR (C AND D)")
    void testComplexExpression() {
        // (auth.check AND database.query) OR (nonexistent1 AND nonexistent2)
        HasExpression a = new HasExpression("auth.check");
        HasExpression b = new HasExpression("database.query");
        HasExpression c = new HasExpression("nonexistent1");
        HasExpression d = new HasExpression("nonexistent2");

        BinaryExpression left = new BinaryExpression("and", a, b);
        BinaryExpression right = new BinaryExpression("and", c, d);
        BinaryExpression expr = new BinaryExpression("or", left, right);

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should evaluate complex expression correctly");
    }

    @Test
    @DisplayName("evaluateRules: Should record violations for matching rules")
    void testEvaluateRulesRecordsViolations() {
        // Create compiled rules
        Map<String, ASTInterpreter.CompiledRule> rules = Map.of(
            "rule-1", new ASTInterpreter.CompiledRule(
                "rule-1",
                "Auth Check Required",
                "Missing auth check before data access",
                "HIGH",
                new HasExpression("auth.check")
            ),
            "rule-2", new ASTInterpreter.CompiledRule(
                "rule-2",
                "Slow Database Query",
                "Database query exceeds 1000ms",
                "MEDIUM",
                createSlowQueryExpression()
            )
        );

        interpreter.evaluateRules(rules, testSpans, ruleContext);

        assertTrue(ruleContext.hasViolations(), "Should have recorded violations");
        assertEquals(2, ruleContext.getViolationCount(), "Should have 2 violations");

        List<RuleContext.SignalViolation> violations = ruleContext.getViolations();

        // Check violations exist (order not guaranteed due to HashMap iteration)
        assertTrue(violations.stream().anyMatch(v -> v.ruleId.equals("rule-1") && v.severity.equals("HIGH")),
            "Should have rule-1 violation with HIGH severity");
        assertTrue(violations.stream().anyMatch(v -> v.ruleId.equals("rule-2") && v.severity.equals("MEDIUM")),
            "Should have rule-2 violation with MEDIUM severity");
    }

    private HasExpression createSlowQueryExpression() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("query.duration_ms", ">", 1000));
        return expr;
    }

    @Test
    @DisplayName("evaluateRules: Should not record violations for non-matching rules")
    void testEvaluateRulesNoViolations() {
        Map<String, ASTInterpreter.CompiledRule> rules = Map.of(
            "rule-1", new ASTInterpreter.CompiledRule(
                "rule-1",
                "Nonexistent Check",
                "Should not match",
                "LOW",
                new HasExpression("nonexistent.operation")
            )
        );

        interpreter.evaluateRules(rules, testSpans, ruleContext);

        assertFalse(ruleContext.hasViolations(), "Should not have violations");
        assertEquals(0, ruleContext.getViolationCount());
    }

    @Test
    @DisplayName("Security: Empty spans list should return false")
    void testSecurityEmptySpansList() {
        HasExpression expr = new HasExpression("auth.check");

        boolean result = interpreter.evaluate(expr, new ArrayList<>(), ruleContext);

        assertFalse(result, "Should return false for empty spans list");
    }

    @Test
    @DisplayName("Security: Null expression should return false")
    void testSecurityNullExpression() {
        boolean result = interpreter.evaluate(null, testSpans, ruleContext);

        assertFalse(result, "Should return false for null expression");
    }

    @Test
    @DisplayName("Security: Invalid attribute access returns false")
    void testSecurityInvalidAttributeAccess() {
        HasExpression expr = new HasExpression("auth.check");
        expr.addWhereClause(new WhereClause("nonexistent.attribute", "==", "value"));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertFalse(result, "Should return false for invalid attribute");
    }

    @Test
    @DisplayName("Type safety: Compare number to string safely")
    void testTypeSafetyNumberToString() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("query.duration_ms", "==", "1500"));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should handle number to string comparison safely");
    }

    @Test
    @DisplayName("Contains operator: String contains substring")
    void testContainsOperator() {
        HasExpression expr = new HasExpression("auth.check");
        expr.addWhereClause(new WhereClause("result", "contains", "succ"));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match 'success' contains 'succ'");
    }

    @Test
    @DisplayName("Not equals operator: Should work correctly")
    void testNotEqualsOperator() {
        HasExpression expr = new HasExpression("auth.check");
        expr.addWhereClause(new WhereClause("result", "!=", "failure"));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match result != 'failure'");
    }

    @Test
    @DisplayName("Greater than or equal operator")
    void testGreaterThanOrEqualOperator() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("query.duration_ms", ">=", 1500));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match duration >= 1500");
    }

    @Test
    @DisplayName("Less than or equal operator")
    void testLessThanOrEqualOperator() {
        HasExpression expr = new HasExpression("database.query");
        expr.addWhereClause(new WhereClause("query.duration_ms", "<=", 1500));

        boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

        assertTrue(result, "Should match duration <= 1500");
    }
}
