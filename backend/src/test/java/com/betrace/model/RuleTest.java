package com.betrace.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Rule model.
 */
@DisplayName("Rule Model Test")
class RuleTest {

    @Test
    @DisplayName("Should create rule with factory method")
    void testCreateRule() {
        // When: Creating rule with factory method
        Rule rule = Rule.create(
            "rule-123",
            "Temperature Alert",
            "1.0.0",
            "temperature > 30",
            Rule.RuleType.OGNL
        );

        // Then: Should have correct values
        assertNotNull(rule);
        assertEquals("rule-123", rule.id());
        assertEquals("Temperature Alert", rule.name());
        assertEquals("1.0.0", rule.version());
        assertEquals("temperature > 30", rule.expression());
        assertEquals(Rule.RuleType.OGNL, rule.type());
        assertTrue(rule.active());
        assertNotNull(rule.metadata());
        assertTrue(rule.metadata().isEmpty());
        assertNotNull(rule.createdAt());
        assertNotNull(rule.updatedAt());
        assertEquals(rule.createdAt(), rule.updatedAt());
    }

    @Test
    @DisplayName("Should create rule with full constructor")
    void testFullConstructor() {
        // Given: Rule data
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("author", "admin");
        metadata.put("category", "monitoring");

        Instant created = Instant.now().minusSeconds(3600);
        Instant updated = Instant.now();

        // When: Creating rule with full constructor
        Rule rule = new Rule(
            "rule-456",
            "Pressure Check",
            "2.0.0",
            "pressure < 100",
            Rule.RuleType.JAVASCRIPT,
            metadata,
            false,
            created,
            updated
        );

        // Then: Should have all values
        assertEquals("rule-456", rule.id());
        assertEquals("Pressure Check", rule.name());
        assertEquals("2.0.0", rule.version());
        assertEquals("pressure < 100", rule.expression());
        assertEquals(Rule.RuleType.JAVASCRIPT, rule.type());
        assertFalse(rule.active());
        assertEquals(2, rule.metadata().size());
        assertEquals("admin", rule.metadata().get("author"));
        assertEquals("monitoring", rule.metadata().get("category"));
        assertEquals(created, rule.createdAt());
        assertEquals(updated, rule.updatedAt());
    }

    @Test
    @DisplayName("Should test all rule types")
    void testRuleTypes() {
        // Then: All rule types should exist
        assertNotNull(Rule.RuleType.OGNL);
        assertNotNull(Rule.RuleType.JAVASCRIPT);
        assertNotNull(Rule.RuleType.PYTHON);
        assertNotNull(Rule.RuleType.CEL);

        // Verify enum values
        Rule.RuleType[] types = Rule.RuleType.values();
        assertEquals(4, types.length);
    }

    @Test
    @DisplayName("Should test equality")
    void testEquality() {
        // Given: Two identical rules
        Rule rule1 = Rule.create(
            "rule-eq",
            "Equal Rule",
            "1.0.0",
            "x > 0",
            Rule.RuleType.OGNL
        );

        Rule rule2 = new Rule(
            "rule-eq",
            "Equal Rule",
            "1.0.0",
            "x > 0",
            Rule.RuleType.OGNL,
            new HashMap<>(),
            true,
            rule1.createdAt(),
            rule1.updatedAt()
        );

        // Then: Should be equal
        assertEquals(rule1, rule2);
        assertEquals(rule1.hashCode(), rule2.hashCode());
    }

    @Test
    @DisplayName("Should test inequality")
    void testInequality() {
        // Given: Two different rules
        Rule rule1 = Rule.create(
            "rule-1",
            "Rule 1",
            "1.0.0",
            "x > 0",
            Rule.RuleType.OGNL
        );

        Rule rule2 = Rule.create(
            "rule-2",
            "Rule 2",
            "1.0.0",
            "x > 0",
            Rule.RuleType.OGNL
        );

        // Then: Should not be equal
        assertNotEquals(rule1, rule2);
    }

    @Test
    @DisplayName("Should test toString representation")
    void testToString() {
        // Given: A rule
        Rule rule = Rule.create(
            "str-rule",
            "String Rule",
            "1.0.0",
            "value > 10",
            Rule.RuleType.CEL
        );

        // When: Getting string representation
        String str = rule.toString();

        // Then: Should contain key information
        assertNotNull(str);
        assertTrue(str.contains("str-rule"));
        assertTrue(str.contains("String Rule"));
        assertTrue(str.contains("1.0.0"));
        assertTrue(str.contains("value > 10"));
        assertTrue(str.contains("CEL"));
    }
}