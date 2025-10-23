package com.betrace.components;

import com.betrace.model.RuleDefinition;
import com.betrace.model.RuleResult;
import ognl.Ognl;
import ognl.OgnlException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.lang.reflect.Method;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive unit tests for RuleEvaluator to achieve 100% coverage.
 */
@DisplayName("RuleEvaluator Test - 100% Coverage")
class RuleEvaluatorTest {

    private RuleEvaluator ruleEvaluator;

    @BeforeEach
    void setUp() {
        ruleEvaluator = new RuleEvaluator();
    }

    // Tests for prepareRule method

    @Test
    @DisplayName("Should generate ID for rule without ID")
    void testPrepareRuleWithoutId() {
        // Given: Rule without ID
        RuleDefinition rule = new RuleDefinition();
        rule.setName("Test Rule");
        rule.setExpression("value > 10");

        // When: Preparing rule
        RuleDefinition prepared = ruleEvaluator.prepareRule(rule, "tenant-123");

        // Then: Should have generated ID
        assertNotNull(prepared.getId());
        assertTrue(prepared.getId().startsWith("rule_"));
        assertEquals("Test Rule", prepared.getName());
    }

    @Test
    @DisplayName("Should keep existing ID for rule with ID")
    void testPrepareRuleWithExistingId() {
        // Given: Rule with existing ID
        RuleDefinition rule = new RuleDefinition();
        rule.setId("existing-id");
        rule.setName("Test Rule");

        // When: Preparing rule
        RuleDefinition prepared = ruleEvaluator.prepareRule(rule, "tenant-123");

        // Then: Should keep existing ID
        assertEquals("existing-id", prepared.getId());
    }

    @Test
    @DisplayName("Should generate consistent ID for same rule")
    void testGenerateConsistentId() {
        // Given: Two identical rules
        RuleDefinition rule1 = new RuleDefinition();
        rule1.setName("Same Rule");
        rule1.setExpression("x > 5");

        RuleDefinition rule2 = new RuleDefinition();
        rule2.setName("Same Rule");
        rule2.setExpression("x > 5");

        // When: Preparing both rules with same tenant
        RuleDefinition prepared1 = ruleEvaluator.prepareRule(rule1, "tenant-456");
        RuleDefinition prepared2 = ruleEvaluator.prepareRule(rule2, "tenant-456");

        // Then: Should generate same ID
        assertEquals(prepared1.getId(), prepared2.getId());
    }

    @Test
    @DisplayName("Should generate different IDs for different tenants")
    void testGenerateDifferentIdsForDifferentTenants() {
        // Given: Same rule for different tenants
        RuleDefinition rule1 = new RuleDefinition();
        rule1.setName("Multi-tenant Rule");
        rule1.setExpression("status == 'active'");

        RuleDefinition rule2 = new RuleDefinition();
        rule2.setName("Multi-tenant Rule");
        rule2.setExpression("status == 'active'");

        // When: Preparing for different tenants
        RuleDefinition prepared1 = ruleEvaluator.prepareRule(rule1, "tenant-A");
        RuleDefinition prepared2 = ruleEvaluator.prepareRule(rule2, "tenant-B");

        // Then: Should generate different IDs
        assertNotEquals(prepared1.getId(), prepared2.getId());
    }

    @Test
    @DisplayName("Should handle null tenant ID")
    void testPrepareRuleWithNullTenantId() {
        // Given: Rule and null tenant ID
        RuleDefinition rule = new RuleDefinition();
        rule.setName("No Tenant Rule");
        rule.setExpression("value > 0");

        // When: Preparing with null tenant
        RuleDefinition prepared = ruleEvaluator.prepareRule(rule, null);

        // Then: Should generate ID using "default" tenant
        assertNotNull(prepared.getId());
        assertTrue(prepared.getId().startsWith("rule_"));
    }

    @Test
    @DisplayName("Should handle rule with null name and expression")
    void testPrepareRuleWithNullFields() {
        // Given: Rule with null fields
        RuleDefinition rule = new RuleDefinition();
        rule.setName(null);
        rule.setExpression(null);

        // When: Preparing rule
        RuleDefinition prepared = ruleEvaluator.prepareRule(rule, "tenant-789");

        // Then: Should still generate ID
        assertNotNull(prepared.getId());
        assertTrue(prepared.getId().startsWith("rule_"));
    }

    // Tests for compileExpression method

    @Test
    @DisplayName("Should compile valid OGNL expression")
    void testCompileValidExpression() throws OgnlException {
        // Given: Rule with valid expression
        RuleDefinition rule = new RuleDefinition();
        rule.setId("compile-test");
        rule.setExpression("temperature > 30");

        Map<String, Object> headers = new HashMap<>();

        // When: Compiling expression
        ruleEvaluator.compileExpression(rule, headers);

        // Then: Should have compiled expression in headers
        assertNotNull(headers.get("compiledExpression"));
        assertEquals("temperature > 30", headers.get("expression"));
        assertEquals(rule, headers.get("rule"));
        assertEquals("compile-test", headers.get("ruleId"));
    }

    @Test
    @DisplayName("Should handle invalid OGNL expression")
    void testCompileInvalidExpression() {
        // Given: Rule with invalid expression
        RuleDefinition rule = new RuleDefinition();
        rule.setId("invalid-expr");
        rule.setExpression("this is not valid OGNL ><>");

        Map<String, Object> headers = new HashMap<>();

        // When: Compiling expression
        ruleEvaluator.compileExpression(rule, headers);

        // Then: Should set compiledExpression to null
        assertNull(headers.get("compiledExpression"));
    }

    @Test
    @DisplayName("Should handle null expression")
    void testCompileNullExpression() {
        // Given: Rule with null expression
        RuleDefinition rule = new RuleDefinition();
        rule.setId("null-expr");
        rule.setExpression(null);

        Map<String, Object> headers = new HashMap<>();

        // When: Compiling expression
        ruleEvaluator.compileExpression(rule, headers);

        // Then: Headers should be empty
        assertTrue(headers.isEmpty());
    }

    // Tests for evaluateWithCachedExpression method

    @Test
    @DisplayName("Should evaluate with pre-compiled expression")
    void testEvaluateWithCompiledExpression() throws OgnlException {
        // Given: Pre-compiled expression and matching data
        RuleDefinition rule = new RuleDefinition();
        rule.setId("eval-test");
        rule.setExpression("temperature > 25");

        Object compiledExpression = Ognl.parseExpression("temperature > 25");

        Map<String, Object> data = new HashMap<>();
        data.put("temperature", 30);

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, compiledExpression);

        // Then: Should match
        assertNotNull(result);
        assertTrue(result.isMatched());
        assertEquals("Rule matched", result.getReason());
        assertEquals("eval-test", result.getRuleId());
    }

    @Test
    @DisplayName("Should evaluate to false when expression doesn't match")
    void testEvaluateNonMatching() throws OgnlException {
        // Given: Expression that won't match data
        RuleDefinition rule = new RuleDefinition();
        rule.setId("no-match");
        rule.setExpression("humidity > 80");

        Object compiledExpression = Ognl.parseExpression("humidity > 80");

        Map<String, Object> data = new HashMap<>();
        data.put("humidity", 60);

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, compiledExpression);

        // Then: Should not match
        assertFalse(result.isMatched());
        assertEquals("Rule did not match", result.getReason());
    }

    @Test
    @DisplayName("Should compile expression on the fly if not cached")
    void testEvaluateWithoutCachedExpression() {
        // Given: No cached expression but rule has expression
        RuleDefinition rule = new RuleDefinition();
        rule.setId("no-cache");
        rule.setExpression("value >= 100");

        Map<String, Object> data = new HashMap<>();
        data.put("value", 150);

        // When: Evaluating without cached expression
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, null);

        // Then: Should compile and evaluate
        assertTrue(result.isMatched());
        assertEquals("Rule matched", result.getReason());
    }

    @Test
    @DisplayName("Should handle null rule")
    void testEvaluateWithNullRule() {
        // Given: Null rule
        Map<String, Object> data = new HashMap<>();
        data.put("value", 10);

        // When: Evaluating with null rule
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, null, null);

        // Then: Should return error result
        assertFalse(result.isMatched());
        assertEquals("Missing rule or data", result.getReason());
    }

    @Test
    @DisplayName("Should handle null data")
    void testEvaluateWithNullData() {
        // Given: Null data
        RuleDefinition rule = new RuleDefinition();
        rule.setId("null-data");

        // When: Evaluating with null data
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(null, rule, null);

        // Then: Should return error result
        assertFalse(result.isMatched());
        assertEquals("Missing rule or data", result.getReason());
    }

    @Test
    @DisplayName("Should handle no expression available")
    void testEvaluateWithNoExpression() {
        // Given: Rule with null expression and no cached expression
        RuleDefinition rule = new RuleDefinition();
        rule.setId("no-expr");
        rule.setExpression(null);

        Map<String, Object> data = new HashMap<>();

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, null);

        // Then: Should return error result
        assertFalse(result.isMatched());
        assertEquals("No expression to evaluate", result.getReason());
    }

    @Test
    @DisplayName("Should handle OGNL evaluation exception")
    void testEvaluateWithOgnlException() throws OgnlException {
        // Given: Expression that will throw exception during evaluation
        RuleDefinition rule = new RuleDefinition();
        rule.setId("error-rule");
        rule.setExpression("nonExistentMethod()");

        Object compiledExpression = Ognl.parseExpression("nonExistentMethod()");

        Map<String, Object> data = new HashMap<>();

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, compiledExpression);

        // Then: Should return error result
        assertFalse(result.isMatched());
        assertTrue(result.getReason().startsWith("Evaluation error:"));
    }

    @Test
    @DisplayName("Should handle runtime exception during evaluation")
    void testEvaluateWithRuntimeException() {
        // Given: Rule that will cause runtime exception
        RuleDefinition rule = new RuleDefinition();
        rule.setId("runtime-error");
        rule.setExpression("1/0"); // This will cause ArithmeticException

        Map<String, Object> data = new HashMap<>();

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, null);

        // Then: Should return error result
        assertFalse(result.isMatched());
        assertTrue(result.getReason().contains("error") || result.getReason().contains("Error"));
    }

    @Test
    @DisplayName("Should handle non-boolean result as string")
    void testEvaluateNonBooleanResultAsString() throws OgnlException {
        // Given: Expression returning string "true"
        RuleDefinition rule = new RuleDefinition();
        rule.setId("string-bool");
        rule.setExpression("status");

        Object compiledExpression = Ognl.parseExpression("status");

        Map<String, Object> data = new HashMap<>();
        data.put("status", "true");

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, compiledExpression);

        // Then: Should parse string as boolean
        assertTrue(result.isMatched());
    }

    @Test
    @DisplayName("Should handle non-boolean result as false")
    void testEvaluateNonBooleanResultAsFalse() throws OgnlException {
        // Given: Expression returning non-boolean value
        RuleDefinition rule = new RuleDefinition();
        rule.setId("non-bool");
        rule.setExpression("count");

        Object compiledExpression = Ognl.parseExpression("count");

        Map<String, Object> data = new HashMap<>();
        data.put("count", 42);

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, compiledExpression);

        // Then: Should evaluate as false
        assertFalse(result.isMatched());
    }

    @Test
    @DisplayName("Should handle null result as false")
    void testEvaluateNullResult() throws OgnlException {
        // Given: Expression returning null
        RuleDefinition rule = new RuleDefinition();
        rule.setId("null-result");
        rule.setExpression("missingField");

        Object compiledExpression = Ognl.parseExpression("missingField");

        Map<String, Object> data = new HashMap<>();
        data.put("otherField", "value");

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, compiledExpression);

        // Then: Should evaluate as false
        assertFalse(result.isMatched());
        assertEquals("Rule did not match", result.getReason());
    }

    @Test
    @DisplayName("Should handle complex boolean expression")
    void testEvaluateComplexExpression() throws OgnlException {
        // Given: Complex expression
        RuleDefinition rule = new RuleDefinition();
        rule.setId("complex");
        rule.setExpression("(temperature > 20 && temperature < 30) || status == 'override'");

        Object compiledExpression = Ognl.parseExpression(
            "(temperature > 20 && temperature < 30) || status == 'override'"
        );

        Map<String, Object> data = new HashMap<>();
        data.put("temperature", 25);
        data.put("status", "normal");

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, compiledExpression);

        // Then: Should match based on temperature condition
        assertTrue(result.isMatched());
    }

    @Test
    @DisplayName("Should handle expression with nested properties")
    void testEvaluateNestedProperties() throws OgnlException {
        // Given: Expression accessing nested properties
        RuleDefinition rule = new RuleDefinition();
        rule.setId("nested");
        rule.setExpression("sensor.temperature > 30");

        Object compiledExpression = Ognl.parseExpression("sensor.temperature > 30");

        Map<String, Object> sensor = new HashMap<>();
        sensor.put("temperature", 35);

        Map<String, Object> data = new HashMap<>();
        data.put("sensor", sensor);

        // When: Evaluating
        RuleResult result = ruleEvaluator.evaluateWithCachedExpression(data, rule, compiledExpression);

        // Then: Should evaluate nested property
        assertTrue(result.isMatched());
    }

    @Test
    @DisplayName("Should use fallback when hash algorithm is not available")
    void testGenerateIdWithNoSuchAlgorithmException() {
        // To test the NoSuchAlgorithmException catch block, we create a custom
        // RuleEvaluator that returns an invalid algorithm name

        // Create a custom RuleEvaluator that uses an invalid algorithm
        RuleEvaluator customEvaluator = new RuleEvaluator() {
            @Override
            String getHashAlgorithm() {
                // Return an invalid algorithm name to trigger NoSuchAlgorithmException
                return "INVALID-ALGORITHM-THAT-DOES-NOT-EXIST";
            }
        };

        // Given: A rule for ID generation
        RuleDefinition rule = new RuleDefinition();
        rule.setName("Fallback Test");
        rule.setExpression("value > 0");

        // When: Preparing rule with the custom evaluator that will trigger exception
        RuleDefinition prepared = customEvaluator.prepareRule(rule, "test-tenant");

        // Then: Should have generated ID using the fallback method (hashCode)
        assertNotNull(prepared.getId());
        assertTrue(prepared.getId().startsWith("rule_"));

        // Verify it's using the hashCode fallback
        String expectedContent = "test-tenant:Fallback Test:value > 0";
        String expectedId = "rule_" + Integer.toHexString(expectedContent.hashCode());
        assertEquals(expectedId, prepared.getId());

        // Also test the generateIdWithAlgorithm method directly with invalid algorithm
        String testContent = "test-content";
        String fallbackId = customEvaluator.generateIdWithAlgorithm(testContent, "INVALID-ALGO");
        assertEquals("rule_" + Integer.toHexString(testContent.hashCode()), fallbackId);

        // Now test with the regular evaluator to ensure it uses SHA-256 normally
        RuleDefinition rule2 = new RuleDefinition();
        rule2.setName("Fallback Test");
        rule2.setExpression("value > 0");
        RuleDefinition regularPrepared = ruleEvaluator.prepareRule(rule2, "test-tenant");

        // The regular evaluator should produce a different (longer) ID using SHA-256
        assertNotEquals(prepared.getId(), regularPrepared.getId());
        assertTrue(regularPrepared.getId().length() > prepared.getId().length());
    }
}