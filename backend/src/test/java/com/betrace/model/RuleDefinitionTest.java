package com.betrace.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RuleDefinition Model Tests")
class RuleDefinitionTest {

    private RuleDefinition rule;

    @BeforeEach
    void setUp() {
        rule = new RuleDefinition();
    }

    @Test
    @DisplayName("Should create empty rule with default values")
    void testDefaultConstructor() {
        RuleDefinition r = new RuleDefinition();

        assertNull(r.getId());
        assertNull(r.getName());
        assertNull(r.getExpression());
        assertTrue(r.isActive());
        assertEquals(1, r.getVersion());
        assertEquals(0L, r.getLastAccessed());
        assertEquals("default", r.getTenantId());
    }

    @Test
    @DisplayName("Should create rule with parameterized constructor")
    void testParameterizedConstructor() {
        RuleDefinition r = new RuleDefinition("rule-123", "Test Rule", "temperature > 30");

        assertEquals("rule-123", r.getId());
        assertEquals("Test Rule", r.getName());
        assertEquals("temperature > 30", r.getExpression());
        assertTrue(r.isActive()); // Default
        assertEquals(1, r.getVersion()); // Default
        assertEquals(0L, r.getLastAccessed()); // Default
        assertEquals("default", r.getTenantId()); // Default
    }

    @Test
    @DisplayName("Should set and get id")
    void testSetAndGetId() {
        rule.setId("rule-456");
        assertEquals("rule-456", rule.getId());

        rule.setId(null);
        assertNull(rule.getId());

        rule.setId("");
        assertEquals("", rule.getId());
    }

    @Test
    @DisplayName("Should set and get name")
    void testSetAndGetName() {
        rule.setName("High Temperature Alert");
        assertEquals("High Temperature Alert", rule.getName());

        rule.setName(null);
        assertNull(rule.getName());

        rule.setName("");
        assertEquals("", rule.getName());
    }

    @Test
    @DisplayName("Should set and get expression")
    void testSetAndGetExpression() {
        rule.setExpression("cpu.usage > 0.8");
        assertEquals("cpu.usage > 0.8", rule.getExpression());

        rule.setExpression(null);
        assertNull(rule.getExpression());

        rule.setExpression("complex && (expression || with > operators)");
        assertEquals("complex && (expression || with > operators)", rule.getExpression());
    }

    @Test
    @DisplayName("Should set and get active status")
    void testSetAndGetActive() {
        assertTrue(rule.isActive()); // Default is true

        rule.setActive(false);
        assertFalse(rule.isActive());

        rule.setActive(true);
        assertTrue(rule.isActive());
    }

    @Test
    @DisplayName("Should set and get version")
    void testSetAndGetVersion() {
        assertEquals(1, rule.getVersion()); // Default is 1

        rule.setVersion(5);
        assertEquals(5, rule.getVersion());

        rule.setVersion(0);
        assertEquals(0, rule.getVersion());

        rule.setVersion(-1);
        assertEquals(-1, rule.getVersion());

        rule.setVersion(Integer.MAX_VALUE);
        assertEquals(Integer.MAX_VALUE, rule.getVersion());
    }

    @Test
    @DisplayName("Should set and get lastAccessed")
    void testSetAndGetLastAccessed() {
        assertEquals(0L, rule.getLastAccessed()); // Default is 0

        long timestamp = System.currentTimeMillis();
        rule.setLastAccessed(timestamp);
        assertEquals(timestamp, rule.getLastAccessed());

        rule.setLastAccessed(0L);
        assertEquals(0L, rule.getLastAccessed());

        rule.setLastAccessed(Long.MAX_VALUE);
        assertEquals(Long.MAX_VALUE, rule.getLastAccessed());

        rule.setLastAccessed(-1L);
        assertEquals(-1L, rule.getLastAccessed());
    }

    @Test
    @DisplayName("Should set and get tenantId")
    void testSetAndGetTenantId() {
        assertEquals("default", rule.getTenantId()); // Default is "default"

        rule.setTenantId("tenant-123");
        assertEquals("tenant-123", rule.getTenantId());

        rule.setTenantId(null);
        assertNull(rule.getTenantId());

        rule.setTenantId("");
        assertEquals("", rule.getTenantId());
    }

    @Test
    @DisplayName("Should test toString method")
    void testToString() {
        RuleDefinition r = new RuleDefinition("id-1", "Rule Name", "x > 5");
        r.setVersion(3);
        r.setTenantId("tenant-xyz");
        r.setActive(false);

        String str = r.toString();

        assertNotNull(str);
        assertTrue(str.startsWith("RuleDefinition{"));
        assertTrue(str.endsWith("}"));
        assertTrue(str.contains("id='id-1'"));
        assertTrue(str.contains("name='Rule Name'"));
        assertTrue(str.contains("expression='x > 5'"));
        assertTrue(str.contains("active=false"));
        assertTrue(str.contains("version=3"));
        assertTrue(str.contains("tenantId='tenant-xyz'"));
    }

    @Test
    @DisplayName("Should test toString with null values")
    void testToStringWithNulls() {
        RuleDefinition r = new RuleDefinition();
        r.setTenantId(null);

        String str = r.toString();

        assertNotNull(str);
        assertTrue(str.contains("id='null'"));
        assertTrue(str.contains("name='null'"));
        assertTrue(str.contains("expression='null'"));
        assertTrue(str.contains("active=true"));
        assertTrue(str.contains("version=1"));
        assertTrue(str.contains("tenantId='null'"));
    }

    @Test
    @DisplayName("Should test field modifications")
    void testFieldModifications() {
        RuleDefinition r = new RuleDefinition("original", "Original Name", "original > 0");

        // Initial state
        assertEquals("original", r.getId());
        assertEquals("Original Name", r.getName());
        assertEquals("original > 0", r.getExpression());

        // Modify all fields
        r.setId("modified");
        r.setName("Modified Name");
        r.setExpression("modified < 100");
        r.setActive(false);
        r.setVersion(10);
        r.setLastAccessed(123456789L);
        r.setTenantId("modified-tenant");

        // Verify modifications
        assertEquals("modified", r.getId());
        assertEquals("Modified Name", r.getName());
        assertEquals("modified < 100", r.getExpression());
        assertFalse(r.isActive());
        assertEquals(10, r.getVersion());
        assertEquals(123456789L, r.getLastAccessed());
        assertEquals("modified-tenant", r.getTenantId());
    }

    @Test
    @DisplayName("Should test lastAccessed not included in toString")
    void testLastAccessedNotInToString() {
        rule.setLastAccessed(999999L);
        String str = rule.toString();

        // lastAccessed is not included in toString
        assertFalse(str.contains("lastAccessed"));
        assertFalse(str.contains("999999"));
    }

    @Test
    @DisplayName("Should test default values are set correctly")
    void testDefaultValues() {
        RuleDefinition r = new RuleDefinition();

        // Test all default values
        assertTrue(r.isActive()); // Default: true
        assertEquals(1, r.getVersion()); // Default: 1
        assertEquals(0L, r.getLastAccessed()); // Default: 0
        assertEquals("default", r.getTenantId()); // Default: "default"
    }

    @Test
    @DisplayName("Should handle state changes correctly")
    void testStateChanges() {
        RuleDefinition r = new RuleDefinition("r1", "Rule 1", "exp1");

        // Toggle active state multiple times
        assertTrue(r.isActive());
        r.setActive(false);
        assertFalse(r.isActive());
        r.setActive(true);
        assertTrue(r.isActive());

        // Increment version multiple times
        assertEquals(1, r.getVersion());
        r.setVersion(r.getVersion() + 1);
        assertEquals(2, r.getVersion());
        r.setVersion(r.getVersion() + 1);
        assertEquals(3, r.getVersion());
    }
}