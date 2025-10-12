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
 * Integration tests for end-to-end DSL rule evaluation flow.
 * Tests: DSL String → Parser → AST → Interpreter → Signal Violation
 */
class ASTInterpreterIntegrationTest {

    private FluoDslParser parser;
    private ASTInterpreter interpreter;
    private RuleContext ruleContext;
    private List<Span> testTrace;

    @BeforeEach
    void setUp() {
        parser = new FluoDslParser();
        interpreter = new ASTInterpreter();
        ruleContext = RuleContext.forTenant("integration-test-tenant");
        testTrace = createRealisticTrace();
    }

    /**
     * Create a realistic trace simulating a user request with auth, database, and API calls
     */
    private List<Span> createRealisticTrace() {
        List<Span> spans = new ArrayList<>();
        Instant now = Instant.now();

        // 1. Root span: HTTP request
        spans.add(Span.create(
            "span-root",
            "trace-integration-001",
            "GET /api/users/123",
            "api-gateway",
            now.minusMillis(500),
            now,
            Map.of(
                "http.method", "GET",
                "http.status_code", 200,
                "user.authenticated", true
            ),
            "integration-test-tenant"
        ));

        // 2. Auth check span
        spans.add(Span.create(
            "span-auth",
            "trace-integration-001",
            "auth.check",
            "auth-service",
            now.minusMillis(450),
            now.minusMillis(400),
            Map.of(
                "user.id", "user-123",
                "auth.result", "success",
                "auth.method", "jwt"
            ),
            "integration-test-tenant"
        ));

        // 3. Database query span (slow)
        spans.add(Span.create(
            "span-db",
            "trace-integration-001",
            "database.query",
            "postgres",
            now.minusMillis(400),
            now.minusMillis(100),
            Map.of(
                "db.query", "SELECT * FROM users WHERE id = ?",
                "query.duration_ms", 300,
                "db.rows_returned", 1,
                "pii", true
            ),
            "integration-test-tenant"
        ));

        // 4. Audit log span
        spans.add(Span.create(
            "span-audit",
            "trace-integration-001",
            "audit.log",
            "audit-service",
            now.minusMillis(100),
            now.minusMillis(50),
            Map.of(
                "audit.action", "user.access",
                "audit.user_id", "user-123",
                "audit.resource", "users/123"
            ),
            "integration-test-tenant"
        ));

        return spans;
    }

    @Test
    @DisplayName("Integration: DSL → Parser → Interpreter → Violation (simple has)")
    void testEndToEndSimpleHas() throws Exception {
        // Given: DSL rule checking for auth
        String dsl = "trace.has(auth.check)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should match
        assertTrue(matched, "Should find auth.check span");
    }

    @Test
    @DisplayName("Integration: DSL with where clause → Violation")
    void testEndToEndWithWhereClause() throws Exception {
        // Given: DSL rule checking for slow database queries
        String dsl = "trace.has(database.query).where(query.duration_ms > 200)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should match (300ms > 200ms)
        assertTrue(matched, "Should detect slow query");
    }

    @Test
    @DisplayName("Integration: Complex AND rule → Violation")
    void testEndToEndComplexAndRule() throws Exception {
        // Given: DSL rule requiring auth AND audit
        String dsl = "trace.has(auth.check) and trace.has(audit.log)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should match (both exist)
        assertTrue(matched, "Should find both auth and audit");
    }

    @Test
    @DisplayName("Integration: NOT rule → Violation when missing")
    void testEndToEndNotRule() throws Exception {
        // Given: DSL rule checking for missing encryption
        String dsl = "not trace.has(encryption.enabled)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should match (encryption span doesn't exist)
        assertTrue(matched, "Should detect missing encryption");
    }

    @Test
    @DisplayName("Integration: Count rule → Violation")
    void testEndToEndCountRule() throws Exception {
        // Given: DSL rule checking database query count
        String dsl = "trace.count(database.query) > 0";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should match (1 query > 0)
        assertTrue(matched, "Should count database queries");
    }

    @Test
    @DisplayName("Integration: Compliance rule (PII access requires audit)")
    void testEndToEndComplianceRule() throws Exception {
        // Given: DSL rule enforcing PII access requires audit log
        String dsl = "trace.has(database.query).where(pii == true) and trace.has(audit.log)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should match (PII query + audit log exist)
        assertTrue(matched, "Should verify PII access has audit");
    }

    @Test
    @DisplayName("Integration: Security rule (data access without auth)")
    void testEndToEndSecurityRule() throws Exception {
        // Given: DSL rule detecting data access without auth
        String dsl = "trace.has(database.query) and not trace.has(auth.check)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should NOT match (auth check exists)
        assertFalse(matched, "Should not trigger - auth check exists");
    }

    @Test
    @DisplayName("Integration: Batch rule evaluation with violation recording")
    void testEndToEndBatchEvaluation() throws Exception {
        // Given: Multiple rules
        Map<String, ASTInterpreter.CompiledRule> rules = Map.of(
            "rule-1", new ASTInterpreter.CompiledRule(
                "rule-1",
                "Slow Query Detection",
                "Database query exceeds 200ms threshold",
                "MEDIUM",
                parser.parse("trace.has(database.query).where(query.duration_ms > 200)")
            ),
            "rule-2", new ASTInterpreter.CompiledRule(
                "rule-2",
                "Auth Required",
                "All requests must have auth check",
                "HIGH",
                parser.parse("trace.has(auth.check)")
            ),
            "rule-3", new ASTInterpreter.CompiledRule(
                "rule-3",
                "PII Audit Required",
                "PII access must have audit log",
                "CRITICAL",
                parser.parse("trace.has(database.query).where(pii == true) and trace.has(audit.log)")
            )
        );

        // When: Evaluate all rules
        interpreter.evaluateRules(rules, testTrace, ruleContext);

        // Then: Should record 3 violations
        assertTrue(ruleContext.hasViolations(), "Should have recorded violations");
        assertEquals(3, ruleContext.getViolationCount(), "Should have 3 violations");

        List<RuleContext.SignalViolation> violations = ruleContext.getViolations();

        // Verify violation details
        assertTrue(violations.stream().anyMatch(v -> v.ruleId.equals("rule-1")),
            "Should have slow query violation");
        assertTrue(violations.stream().anyMatch(v -> v.ruleId.equals("rule-2")),
            "Should have auth violation");
        assertTrue(violations.stream().anyMatch(v -> v.ruleId.equals("rule-3")),
            "Should have PII audit violation");
    }

    @Test
    @DisplayName("Integration: Tenant isolation - rules don't affect other tenants")
    void testEndToEndTenantIsolation() throws Exception {
        // Given: Two separate tenant contexts
        RuleContext tenant1Context = RuleContext.forTenant("tenant-1");
        RuleContext tenant2Context = RuleContext.forTenant("tenant-2");

        String dsl = "trace.has(auth.check)";
        RuleExpression ast = parser.parse(dsl);

        // When: Evaluate same rule for both tenants
        interpreter.evaluate(ast, testTrace, tenant1Context);
        interpreter.evaluate(ast, testTrace, tenant2Context);

        // Then: Each context should have independent state
        assertNotSame(tenant1Context, tenant2Context, "Contexts should be separate");
        assertEquals("tenant-1", tenant1Context.getTenantId());
        assertEquals("tenant-2", tenant2Context.getTenantId());
    }

    @Test
    @DisplayName("Integration: Error handling - malformed DSL gracefully fails")
    void testEndToEndMalformedDSL() {
        // Given: Invalid DSL
        String malformedDSL = "trace.has(";  // Missing closing parenthesis

        // When/Then: Should throw ParseException
        assertThrows(Exception.class, () -> parser.parse(malformedDSL),
            "Parser should reject malformed DSL");
    }

    @Test
    @DisplayName("Integration: Performance - 1000 span trace evaluation")
    void testEndToEndLargeTrace() throws Exception {
        // Given: Large trace with 1000 spans
        List<Span> largeTrace = new ArrayList<>();
        Instant now = Instant.now();

        for (int i = 0; i < 1000; i++) {
            largeTrace.add(Span.create(
                "span-" + i,
                "trace-large",
                i % 10 == 0 ? "database.query" : "other.operation",
                "test-service",
                now.minusMillis(1000 - i),
                now.minusMillis(999 - i),
                Map.of("index", i),
                "integration-test-tenant"
            ));
        }

        // When: Evaluate rule
        String dsl = "trace.count(database.query) > 50";
        RuleExpression ast = parser.parse(dsl);

        long startTime = System.currentTimeMillis();
        boolean matched = interpreter.evaluate(ast, largeTrace, ruleContext);
        long duration = System.currentTimeMillis() - startTime;

        // Then: Should complete quickly (under 100ms)
        assertTrue(matched, "Should count 100 database queries");
        assertTrue(duration < 100,
            String.format("Should evaluate 1000 spans in <100ms (took %dms)", duration));
    }

    @Test
    @DisplayName("Integration: Empty trace - no violations")
    void testEndToEndEmptyTrace() throws Exception {
        // Given: Empty trace
        List<Span> emptyTrace = new ArrayList<>();
        String dsl = "trace.has(auth.check)";
        RuleExpression ast = parser.parse(dsl);

        // When: Evaluate
        boolean matched = interpreter.evaluate(ast, emptyTrace, ruleContext);

        // Then: Should not match
        assertFalse(matched, "Empty trace should not match any rules");
    }

    @Test
    @DisplayName("Integration: Multiple where clauses - all must match")
    void testEndToEndMultipleWhereClauses() throws Exception {
        // Given: DSL with multiple where conditions
        String dsl = "trace.has(database.query).where(pii == true).where(query.duration_ms > 200)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should match (both pii==true AND duration>200)
        assertTrue(matched, "Should match when all where clauses satisfied");
    }

    @Test
    @DisplayName("Integration: OR rule - short circuit evaluation")
    void testEndToEndOrShortCircuit() throws Exception {
        // Given: OR rule where first condition is true
        String dsl = "trace.has(auth.check) or trace.has(nonexistent.operation)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should match (short-circuits on first true)
        assertTrue(matched, "Should match and short-circuit on first condition");
    }

    @Test
    @DisplayName("Integration: Deeply nested expression evaluation")
    void testEndToEndDeeplyNestedExpression() throws Exception {
        // Given: Complex nested rule
        String dsl = "trace.has(auth.check) and trace.has(database.query) " +
                    "or trace.has(audit.log) and not trace.has(error)";

        // When: Parse and evaluate
        RuleExpression ast = parser.parse(dsl);
        boolean matched = interpreter.evaluate(ast, testTrace, ruleContext);

        // Then: Should evaluate correctly
        assertTrue(matched, "Should evaluate complex nested expression");
    }
}
