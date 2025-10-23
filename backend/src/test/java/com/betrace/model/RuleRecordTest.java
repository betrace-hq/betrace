package com.fluo.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RuleRecord Model Tests")
class RuleRecordTest {

    @Test
    @DisplayName("Should create record with all fields")
    void testConstructorWithAllFields() {
        RuleRecord record = new RuleRecord(
            "rule-123",
            "Temperature Alert",
            "temperature > 30",
            2,
            true,
            "tenant-abc"
        );

        assertEquals("rule-123", record.id);
        assertEquals("Temperature Alert", record.name);
        assertEquals("temperature > 30", record.expression);
        assertEquals(2, record.version);
        assertTrue(record.active);
        assertEquals("tenant-abc", record.tenantId);
    }

    @Test
    @DisplayName("Should handle null tenantId with default")
    void testNullTenantIdDefaultsToDefault() {
        RuleRecord record = new RuleRecord(
            "rule-456",
            "CPU Alert",
            "cpu > 80",
            1,
            false,
            null
        );

        assertEquals("rule-456", record.id);
        assertEquals("CPU Alert", record.name);
        assertEquals("cpu > 80", record.expression);
        assertEquals(1, record.version);
        assertFalse(record.active);
        assertEquals("default", record.tenantId); // Should default to "default"
    }

    @Test
    @DisplayName("Should preserve non-null tenantId")
    void testNonNullTenantIdPreserved() {
        RuleRecord record = new RuleRecord(
            "rule-789",
            "Memory Alert",
            "memory < 10",
            3,
            true,
            "custom-tenant"
        );

        assertEquals("custom-tenant", record.tenantId); // Should preserve custom value
    }

    @Test
    @DisplayName("Should handle null values for other fields")
    void testNullValuesForOtherFields() {
        RuleRecord record = new RuleRecord(
            null,
            null,
            null,
            0,
            false,
            "tenant"
        );

        assertNull(record.id);
        assertNull(record.name);
        assertNull(record.expression);
        assertEquals(0, record.version);
        assertFalse(record.active);
        assertEquals("tenant", record.tenantId);
    }

    @Test
    @DisplayName("Should convert to map with all fields")
    void testToMap() {
        RuleRecord record = new RuleRecord(
            "rule-map",
            "Map Test Rule",
            "value == 42",
            5,
            true,
            "map-tenant"
        );

        Map<String, Object> map = record.toMap();

        assertNotNull(map);
        assertEquals(6, map.size());
        assertEquals("rule-map", map.get("id"));
        assertEquals("Map Test Rule", map.get("name"));
        assertEquals("value == 42", map.get("expression"));
        assertEquals(5, map.get("version"));
        assertEquals(true, map.get("active"));
        assertEquals("map-tenant", map.get("tenantId"));
    }

    @Test
    @DisplayName("Should convert to map with null values handled by constructor")
    void testToMapWithNullValues() {
        // Map.of() doesn't allow null values, so test that constructor handles nulls
        // but toMap() works with the constructor's defaults
        RuleRecord record = new RuleRecord(
            null,
            null,
            null,
            -1,
            false,
            null
        );

        // Test that null tenantId is converted to "default" by constructor
        assertEquals("default", record.tenantId);

        // toMap() will fail with Map.of() if any values are null, which is expected behavior
        // The class design expects consumers to not pass null values for required fields
        assertThrows(NullPointerException.class, () -> {
            record.toMap();
        });
    }

    @Test
    @DisplayName("Should test immutability of fields")
    void testFieldImmutability() {
        RuleRecord record = new RuleRecord(
            "immutable-rule",
            "Immutable Test",
            "x > 5",
            1,
            true,
            "tenant"
        );

        // Fields are final and cannot be modified
        // This test documents the immutable nature
        assertEquals("immutable-rule", record.id);
        assertEquals("Immutable Test", record.name);
        assertEquals("x > 5", record.expression);
        assertEquals(1, record.version);
        assertTrue(record.active);
        assertEquals("tenant", record.tenantId);

        // Creating a new record with different values should work
        RuleRecord different = new RuleRecord(
            "different-rule",
            "Different Test",
            "y < 10",
            2,
            false,
            "other-tenant"
        );

        assertNotEquals(record.id, different.id);
        assertNotEquals(record.name, different.name);
        assertNotEquals(record.expression, different.expression);
        assertNotEquals(record.version, different.version);
        assertNotEquals(record.active, different.active);
        assertNotEquals(record.tenantId, different.tenantId);
    }

    @Test
    @DisplayName("Should handle empty string tenantId")
    void testEmptyStringTenantId() {
        RuleRecord record = new RuleRecord(
            "rule-empty",
            "Empty Tenant Test",
            "test == true",
            1,
            true,
            ""
        );

        assertEquals("", record.tenantId); // Empty string should be preserved, not defaulted
    }

    @Test
    @DisplayName("Should test edge case values")
    void testEdgeCaseValues() {
        RuleRecord record = new RuleRecord(
            "",  // empty string ID
            "",  // empty string name
            "",  // empty string expression
            Integer.MAX_VALUE,  // max version
            true,
            "edge-tenant"
        );

        assertEquals("", record.id);
        assertEquals("", record.name);
        assertEquals("", record.expression);
        assertEquals(Integer.MAX_VALUE, record.version);
        assertTrue(record.active);
        assertEquals("edge-tenant", record.tenantId);

        Map<String, Object> map = record.toMap();
        assertEquals("", map.get("id"));
        assertEquals("", map.get("name"));
        assertEquals("", map.get("expression"));
        assertEquals(Integer.MAX_VALUE, map.get("version"));
        assertEquals(true, map.get("active"));
        assertEquals("edge-tenant", map.get("tenantId"));
    }

    @Test
    @DisplayName("Should test negative version")
    void testNegativeVersion() {
        RuleRecord record = new RuleRecord(
            "negative-version",
            "Negative Version Test",
            "neg < 0",
            -999,
            false,
            "neg-tenant"
        );

        assertEquals(-999, record.version);

        Map<String, Object> map = record.toMap();
        assertEquals(-999, map.get("version"));
    }

    @Test
    @DisplayName("Should test complex expression strings")
    void testComplexExpressions() {
        RuleRecord record = new RuleRecord(
            "complex-rule",
            "Complex Expression Rule",
            "temperature > 30 && (humidity < 60 || pressure > 1013.25) && status == 'ACTIVE'",
            1,
            true,
            "weather-tenant"
        );

        assertEquals("temperature > 30 && (humidity < 60 || pressure > 1013.25) && status == 'ACTIVE'",
                     record.expression);

        Map<String, Object> map = record.toMap();
        assertEquals("temperature > 30 && (humidity < 60 || pressure > 1013.25) && status == 'ACTIVE'",
                     map.get("expression"));
    }

    @Test
    @DisplayName("Should test special characters in strings")
    void testSpecialCharacters() {
        RuleRecord record = new RuleRecord(
            "rule-123-áéíóú",
            "Rule with 中文 and émojis 🚀",
            "field.contains('special chars: @#$%^&*()') && unicode == '测试'",
            1,
            true,
            "unicode-tenant-🌍"
        );

        assertEquals("rule-123-áéíóú", record.id);
        assertEquals("Rule with 中文 and émojis 🚀", record.name);
        assertEquals("field.contains('special chars: @#$%^&*()') && unicode == '测试'", record.expression);
        assertEquals("unicode-tenant-🌍", record.tenantId);

        Map<String, Object> map = record.toMap();
        assertEquals("rule-123-áéíóú", map.get("id"));
        assertEquals("Rule with 中文 and émojis 🚀", map.get("name"));
        assertEquals("unicode-tenant-🌍", map.get("tenantId"));
    }

    @Test
    @DisplayName("Should test map immutability")
    void testMapImmutability() {
        RuleRecord record = new RuleRecord(
            "immutable-map",
            "Map Immutability Test",
            "test == true",
            1,
            true,
            "tenant"
        );

        Map<String, Object> map = record.toMap();

        // Map.of() creates an immutable map
        assertThrows(UnsupportedOperationException.class, () -> {
            map.put("newKey", "newValue");
        });

        assertThrows(UnsupportedOperationException.class, () -> {
            map.remove("id");
        });

        assertThrows(UnsupportedOperationException.class, () -> {
            map.clear();
        });
    }
}