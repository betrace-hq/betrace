package com.fluo.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for RuleEvaluationResult model.
 */
@DisplayName("RuleEvaluationResult Model Test")
class RuleEvaluationResultTest {

    @Test
    @DisplayName("Should create successful evaluation result")
    void testSuccessResult() {
        // When: Creating successful result
        RuleEvaluationResult result = RuleEvaluationResult.success(
            "signal-123",
            "rule-456",
            true,
            "Alert triggered",
            100L
        );

        // Then: Should have correct values
        assertNotNull(result);
        assertEquals("signal-123", result.signalId());
        assertEquals("rule-456", result.ruleId());
        assertTrue(result.matched());
        assertEquals("Alert triggered", result.result());
        assertEquals(100L, result.evaluationTimeMs());
        assertNotNull(result.evaluatedAt());
        assertNotNull(result.metadata());
        assertEquals("success", result.metadata().get("status"));
    }

    @Test
    @DisplayName("Should create failed evaluation result")
    void testFailureResult() {
        // When: Creating failure result
        RuleEvaluationResult result = RuleEvaluationResult.failure(
            "signal-789",
            "rule-012",
            "Division by zero",
            50L
        );

        // Then: Should have correct values
        assertNotNull(result);
        assertEquals("signal-789", result.signalId());
        assertEquals("rule-012", result.ruleId());
        assertFalse(result.matched());
        assertNull(result.result());
        assertEquals(50L, result.evaluationTimeMs());
        assertNotNull(result.evaluatedAt());
        assertNotNull(result.metadata());
        assertEquals("failed", result.metadata().get("status"));
        assertEquals("Division by zero", result.metadata().get("error"));
    }

    @Test
    @DisplayName("Should create result with full constructor")
    void testFullConstructor() {
        // Given: Result data
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("status", "custom");
        metadata.put("details", "Complex evaluation");
        metadata.put("score", 0.95);

        Instant evaluatedAt = Instant.now();

        // When: Creating with full constructor
        RuleEvaluationResult result = new RuleEvaluationResult(
            "sig-custom",
            "rule-custom",
            true,
            42,
            metadata,
            evaluatedAt,
            75L
        );

        // Then: Should have all values
        assertEquals("sig-custom", result.signalId());
        assertEquals("rule-custom", result.ruleId());
        assertTrue(result.matched());
        assertEquals(42, result.result());
        assertEquals(75L, result.evaluationTimeMs());
        assertEquals(evaluatedAt, result.evaluatedAt());
        assertEquals(3, result.metadata().size());
        assertEquals("custom", result.metadata().get("status"));
        assertEquals("Complex evaluation", result.metadata().get("details"));
        assertEquals(0.95, result.metadata().get("score"));
    }

    @Test
    @DisplayName("Should handle non-matched successful evaluation")
    void testNonMatchedSuccess() {
        // When: Creating successful but non-matched result
        RuleEvaluationResult result = RuleEvaluationResult.success(
            "signal-no-match",
            "rule-no-match",
            false,
            "No match found",
            25L
        );

        // Then: Should be successful but not matched
        assertNotNull(result);
        assertFalse(result.matched());
        assertEquals("No match found", result.result());
        assertEquals("success", result.metadata().get("status"));
        assertFalse(result.metadata().containsKey("error"));
    }

    @Test
    @DisplayName("Should test equality")
    void testEquality() {
        // Given: Two identical results
        Instant now = Instant.now();
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("status", "success");

        RuleEvaluationResult result1 = new RuleEvaluationResult(
            "sig-eq",
            "rule-eq",
            true,
            "same",
            metadata,
            now,
            100L
        );

        RuleEvaluationResult result2 = new RuleEvaluationResult(
            "sig-eq",
            "rule-eq",
            true,
            "same",
            metadata,
            now,
            100L
        );

        // Then: Should be equal
        assertEquals(result1, result2);
        assertEquals(result1.hashCode(), result2.hashCode());
    }

    @Test
    @DisplayName("Should test inequality")
    void testInequality() {
        // Given: Two different results
        RuleEvaluationResult result1 = RuleEvaluationResult.success(
            "sig-1",
            "rule-1",
            true,
            "result1",
            100L
        );

        RuleEvaluationResult result2 = RuleEvaluationResult.success(
            "sig-2",
            "rule-2",
            false,
            "result2",
            200L
        );

        // Then: Should not be equal
        assertNotEquals(result1, result2);
    }

    @Test
    @DisplayName("Should test toString representation")
    void testToString() {
        // Given: A result
        RuleEvaluationResult result = RuleEvaluationResult.success(
            "sig-str",
            "rule-str",
            true,
            "String test",
            150L
        );

        // When: Getting string representation
        String str = result.toString();

        // Then: Should contain key information
        assertNotNull(str);
        assertTrue(str.contains("sig-str"));
        assertTrue(str.contains("rule-str"));
        assertTrue(str.contains("matched=true"));
        assertTrue(str.contains("String test"));
        assertTrue(str.contains("150"));
    }

    @Test
    @DisplayName("Should handle various result types")
    void testVariousResultTypes() {
        // Test with different result types
        RuleEvaluationResult stringResult = RuleEvaluationResult.success(
            "sig", "rule", true, "text result", 10L
        );
        assertEquals("text result", stringResult.result());

        RuleEvaluationResult intResult = RuleEvaluationResult.success(
            "sig", "rule", true, 42, 10L
        );
        assertEquals(42, intResult.result());

        RuleEvaluationResult boolResult = RuleEvaluationResult.success(
            "sig", "rule", true, true, 10L
        );
        assertEquals(true, boolResult.result());

        Map<String, Object> mapValue = new HashMap<>();
        mapValue.put("key", "value");
        RuleEvaluationResult mapResult = RuleEvaluationResult.success(
            "sig", "rule", true, mapValue, 10L
        );
        assertEquals(mapValue, mapResult.result());
    }
}