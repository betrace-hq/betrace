package com.betrace.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RuleResult Model Tests")
class RuleResultTest {

    private RuleResult result;

    @BeforeEach
    void setUp() {
        result = new RuleResult();
    }

    @Test
    @DisplayName("Should create result with default constructor")
    void testDefaultConstructor() {
        RuleResult r = new RuleResult();

        assertFalse(r.isMatched()); // Default boolean is false
        assertNull(r.getReason());
        assertNull(r.getRuleId());
        assertTrue(r.getTimestamp() > 0); // Should be set to current time

        // Timestamp should be recent (within last second)
        long now = System.currentTimeMillis();
        assertTrue(Math.abs(now - r.getTimestamp()) < 1000);
    }

    @Test
    @DisplayName("Should create result with parameterized constructor")
    void testParameterizedConstructor() {
        RuleResult r = new RuleResult(true, "Rule condition met");

        assertTrue(r.isMatched());
        assertEquals("Rule condition met", r.getReason());
        assertNull(r.getRuleId()); // Not set in constructor
        assertTrue(r.getTimestamp() > 0); // Should be set to current time

        // Timestamp should be recent
        long now = System.currentTimeMillis();
        assertTrue(Math.abs(now - r.getTimestamp()) < 1000);
    }

    @Test
    @DisplayName("Should test timestamp generation consistency")
    void testTimestampGeneration() {
        long before = System.currentTimeMillis();
        RuleResult r1 = new RuleResult();
        RuleResult r2 = new RuleResult(false, "test");
        long after = System.currentTimeMillis();

        // Both should have valid timestamps
        assertTrue(r1.getTimestamp() >= before);
        assertTrue(r1.getTimestamp() <= after);
        assertTrue(r2.getTimestamp() >= before);
        assertTrue(r2.getTimestamp() <= after);

        // Timestamps might be the same or different, but both should be valid
        assertTrue(r1.getTimestamp() > 0);
        assertTrue(r2.getTimestamp() > 0);
    }

    @Test
    @DisplayName("Should set and get matched status")
    void testSetAndGetMatched() {
        assertFalse(result.isMatched()); // Default

        result.setMatched(true);
        assertTrue(result.isMatched());

        result.setMatched(false);
        assertFalse(result.isMatched());
    }

    @Test
    @DisplayName("Should set and get reason")
    void testSetAndGetReason() {
        assertNull(result.getReason()); // Default

        result.setReason("Temperature exceeds threshold");
        assertEquals("Temperature exceeds threshold", result.getReason());

        result.setReason(null);
        assertNull(result.getReason());

        result.setReason("");
        assertEquals("", result.getReason());

        result.setReason("Complex reason with multiple conditions && operators");
        assertEquals("Complex reason with multiple conditions && operators", result.getReason());
    }

    @Test
    @DisplayName("Should set and get ruleId")
    void testSetAndGetRuleId() {
        assertNull(result.getRuleId()); // Default

        result.setRuleId("rule-123");
        assertEquals("rule-123", result.getRuleId());

        result.setRuleId(null);
        assertNull(result.getRuleId());

        result.setRuleId("");
        assertEquals("", result.getRuleId());

        result.setRuleId("rule-with-uuid-12345-67890");
        assertEquals("rule-with-uuid-12345-67890", result.getRuleId());
    }

    @Test
    @DisplayName("Should set and get timestamp")
    void testSetAndGetTimestamp() {
        long originalTimestamp = result.getTimestamp();
        assertTrue(originalTimestamp > 0); // Default is current time

        long customTimestamp = 1609459200000L; // Jan 1, 2021
        result.setTimestamp(customTimestamp);
        assertEquals(customTimestamp, result.getTimestamp());

        result.setTimestamp(0L);
        assertEquals(0L, result.getTimestamp());

        result.setTimestamp(Long.MAX_VALUE);
        assertEquals(Long.MAX_VALUE, result.getTimestamp());

        result.setTimestamp(-1L);
        assertEquals(-1L, result.getTimestamp());
    }

    @Test
    @DisplayName("Should test toString method")
    void testToString() {
        RuleResult r = new RuleResult(true, "Condition matched");
        r.setRuleId("rule-456");
        r.setTimestamp(1234567890L);

        String str = r.toString();

        assertNotNull(str);
        assertTrue(str.startsWith("RuleResult{"));
        assertTrue(str.endsWith("}"));
        assertTrue(str.contains("matched=true"));
        assertTrue(str.contains("reason='Condition matched'"));
        assertTrue(str.contains("ruleId='rule-456'"));
        assertTrue(str.contains("timestamp=1234567890"));
    }

    @Test
    @DisplayName("Should test toString with null values")
    void testToStringWithNulls() {
        RuleResult r = new RuleResult();
        r.setTimestamp(0L);

        String str = r.toString();

        assertNotNull(str);
        assertTrue(str.contains("matched=false"));
        assertTrue(str.contains("reason='null'"));
        assertTrue(str.contains("ruleId='null'"));
        assertTrue(str.contains("timestamp=0"));
    }

    @Test
    @DisplayName("Should test all field combinations")
    void testFieldCombinations() {
        // Test positive match
        RuleResult positive = new RuleResult(true, "All conditions met");
        positive.setRuleId("rule-positive");
        positive.setTimestamp(1000L);

        assertTrue(positive.isMatched());
        assertEquals("All conditions met", positive.getReason());
        assertEquals("rule-positive", positive.getRuleId());
        assertEquals(1000L, positive.getTimestamp());

        // Test negative match
        RuleResult negative = new RuleResult(false, "Conditions not met");
        negative.setRuleId("rule-negative");
        negative.setTimestamp(2000L);

        assertFalse(negative.isMatched());
        assertEquals("Conditions not met", negative.getReason());
        assertEquals("rule-negative", negative.getRuleId());
        assertEquals(2000L, negative.getTimestamp());
    }

    @Test
    @DisplayName("Should test state transitions")
    void testStateTransitions() {
        // Start with false match
        result.setMatched(false);
        result.setReason("Initial failure");
        result.setRuleId("rule-test");

        assertFalse(result.isMatched());
        assertEquals("Initial failure", result.getReason());

        // Change to true match
        result.setMatched(true);
        result.setReason("Condition now met");

        assertTrue(result.isMatched());
        assertEquals("Condition now met", result.getReason());
        assertEquals("rule-test", result.getRuleId()); // Should remain unchanged

        // Change back to false
        result.setMatched(false);
        result.setReason("Condition failed again");

        assertFalse(result.isMatched());
        assertEquals("Condition failed again", result.getReason());
    }

    @Test
    @DisplayName("Should test constructors call hierarchy correctly")
    void testConstructorHierarchy() {
        // Parameterized constructor should call default constructor
        // which sets timestamp
        RuleResult r1 = new RuleResult(true, "test reason");

        assertTrue(r1.isMatched());
        assertEquals("test reason", r1.getReason());
        assertTrue(r1.getTimestamp() > 0); // Timestamp should be set by default constructor

        // Verify timestamp is recent
        long now = System.currentTimeMillis();
        assertTrue(Math.abs(now - r1.getTimestamp()) < 1000);
    }

    @Test
    @DisplayName("Should handle empty and special strings")
    void testSpecialStringValues() {
        // Empty reason
        result.setReason("");
        assertEquals("", result.getReason());

        // Whitespace reason
        result.setReason("   ");
        assertEquals("   ", result.getReason());

        // Reason with special characters
        result.setReason("Rule failed: condition 'x > 5' && \"y < 10\" with newline\n");
        assertEquals("Rule failed: condition 'x > 5' && \"y < 10\" with newline\n", result.getReason());

        // Unicode reason
        result.setReason("温度过高 - Temperature too high 🌡️");
        assertEquals("温度过高 - Temperature too high 🌡️", result.getReason());
    }

    @Test
    @DisplayName("Should preserve field independence")
    void testFieldIndependence() {
        // Set all fields to specific values
        result.setMatched(true);
        result.setReason("Original reason");
        result.setRuleId("original-rule");
        result.setTimestamp(999L);

        // Change matched status - other fields should remain unchanged
        result.setMatched(false);
        assertEquals("Original reason", result.getReason());
        assertEquals("original-rule", result.getRuleId());
        assertEquals(999L, result.getTimestamp());

        // Change reason - other fields should remain unchanged
        result.setReason("New reason");
        assertFalse(result.isMatched());
        assertEquals("original-rule", result.getRuleId());
        assertEquals(999L, result.getTimestamp());
    }
}