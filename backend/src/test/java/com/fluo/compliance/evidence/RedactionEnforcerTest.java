package com.fluo.compliance.evidence;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for RedactionEnforcer PII protection.
 */
class RedactionEnforcerTest {

    @Test
    @DisplayName("Safe attributes pass validation")
    void testSafeAttributes() {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("framework", "soc2");
        attributes.put("control", "CC6_1");
        attributes.put("result", "success");
        attributes.put("duration", 100L);

        Map<String, Object> validated = RedactionEnforcer.validateAndRedact(attributes);

        assertEquals(4, validated.size());
        assertEquals("soc2", validated.get("framework"));
        assertEquals("CC6_1", validated.get("control"));
        assertEquals("success", validated.get("result"));
        assertEquals(100L, validated.get("duration"));
    }

    @Test
    @DisplayName("Unredacted PII attribute throws exception")
    void testUnredactedPII() {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("email", "user@example.com");

        RedactionEnforcer.PIILeakageException exception = assertThrows(
            RedactionEnforcer.PIILeakageException.class,
            () -> RedactionEnforcer.validateAndRedact(attributes),
            "Unredacted PII should throw exception"
        );

        assertTrue(exception.getMessage().contains("email"));
        assertTrue(exception.getMessage().contains("PII pattern"));
    }

    @Test
    @DisplayName("Unknown attribute throws exception")
    void testUnknownAttribute() {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("customField", "value");

        RedactionEnforcer.UnsafeAttributeException exception = assertThrows(
            RedactionEnforcer.UnsafeAttributeException.class,
            () -> RedactionEnforcer.validateAndRedact(attributes),
            "Unknown attribute should throw exception"
        );

        assertTrue(exception.getMessage().contains("customField"));
        assertTrue(exception.getMessage().contains("whitelist"));
    }

    @Test
    @DisplayName("EXCLUDE strategy removes value")
    void testExcludeStrategy() {
        Object redacted = RedactionEnforcer.redact("sensitive data", RedactionStrategy.EXCLUDE, 0);
        assertNull(redacted, "EXCLUDE should return null");
    }

    @Test
    @DisplayName("REDACT strategy replaces with placeholder")
    void testRedactStrategy() {
        Object redacted = RedactionEnforcer.redact("password123", RedactionStrategy.REDACT, 0);
        assertEquals("<redacted>", redacted);
    }

    @Test
    @DisplayName("HASH strategy produces consistent hash")
    void testHashStrategy() {
        String value = "user-123";
        Object hash1 = RedactionEnforcer.redact(value, RedactionStrategy.HASH, 0);
        Object hash2 = RedactionEnforcer.redact(value, RedactionStrategy.HASH, 0);

        assertEquals(hash1, hash2, "Same value should produce same hash");
        assertNotEquals(value, hash1, "Hash should differ from original");
        assertTrue(hash1.toString().matches("^[a-f0-9]{64}$"), "Should be SHA-256 hex");
    }

    @Test
    @DisplayName("HASH strategy produces different hashes for different values")
    void testHashUniqueness() {
        Object hash1 = RedactionEnforcer.redact("user-123", RedactionStrategy.HASH, 0);
        Object hash2 = RedactionEnforcer.redact("user-456", RedactionStrategy.HASH, 0);

        assertNotEquals(hash1, hash2, "Different values should produce different hashes");
    }

    @Test
    @DisplayName("TRUNCATE strategy preserves start and end")
    void testTruncateStrategy() {
        Object redacted = RedactionEnforcer.redact("1234567890", RedactionStrategy.TRUNCATE, 2);
        assertEquals("12...90", redacted);
    }

    @Test
    @DisplayName("TRUNCATE strategy handles short values")
    void testTruncateShortValue() {
        Object redacted = RedactionEnforcer.redact("123", RedactionStrategy.TRUNCATE, 2);
        assertEquals("***", redacted, "Short values should be fully masked");
    }

    @Test
    @DisplayName("Extract redacted attributes from object with @Sensitive")
    void testExtractWithSensitive() {
        TestObject obj = new TestObject();
        obj.id = "123";
        obj.password = "secret";

        Map<String, Object> attributes = RedactionEnforcer.extractRedactedAttributes(obj);

        assertTrue(attributes.containsKey("id"));
        assertFalse(attributes.containsKey("password"), "@Sensitive field should be excluded");
    }

    @Test
    @DisplayName("Extract redacted attributes from object with @PII")
    void testExtractWithPII() {
        TestObject obj = new TestObject();
        obj.id = "123";
        obj.socialSecurityNumber = "123-45-6789";

        Map<String, Object> attributes = RedactionEnforcer.extractRedactedAttributes(obj);

        assertTrue(attributes.containsKey("socialSecurityNumber"));
        String redacted = (String) attributes.get("socialSecurityNumber");
        assertNotEquals("123-45-6789", redacted, "@PII should be hashed");
        assertTrue(redacted.matches("^[a-f0-9]{64}$"), "Should be SHA-256 hash");
    }

    @Test
    @DisplayName("Extract redacted attributes from object with @Redact")
    void testExtractWithRedact() {
        TestObject obj = new TestObject();
        obj.id = "123";
        obj.creditCard = "1234-5678-9012-3456";

        Map<String, Object> attributes = RedactionEnforcer.extractRedactedAttributes(obj);

        assertTrue(attributes.containsKey("creditCard"));
        assertEquals("1234...3456", attributes.get("creditCard"), "@Redact should truncate");
    }

    @Test
    @DisplayName("Extract throws exception for unannotated PII field")
    void testExtractUnannotatedPII() {
        UnsafeObject obj = new UnsafeObject();
        obj.email = "user@example.com"; // PII pattern without annotation

        RedactionEnforcer.PIILeakageException exception = assertThrows(
            RedactionEnforcer.PIILeakageException.class,
            () -> RedactionEnforcer.extractRedactedAttributes(obj),
            "Unannotated PII field should throw exception"
        );

        assertTrue(exception.getMessage().contains("email"));
        assertTrue(exception.getMessage().contains("not annotated"));
    }

    @Test
    @DisplayName("Null value handling")
    void testNullValue() {
        Object redacted = RedactionEnforcer.redact(null, RedactionStrategy.HASH, 0);
        assertNull(redacted, "Null should remain null");
    }

    // Test objects

    private static class TestObject {
        public String id; // Safe attribute

        @Sensitive
        public String password;

        @PII(strategy = RedactionStrategy.HASH)
        public String socialSecurityNumber;

        @Redact(strategy = RedactionStrategy.TRUNCATE, preserve = 4)
        public String creditCard;
    }

    private static class UnsafeObject {
        public String email; // PII pattern without annotation - should fail
    }
}
