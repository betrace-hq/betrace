package com.betrace.services;

import com.betrace.model.PIIType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("PIIDetectionService Unit Tests")
class PIIDetectionServiceTest {

    private PIIDetectionService service;

    @BeforeEach
    void setUp() {
        service = new PIIDetectionService();
    }

    // Pattern-based detection tests

    @Test
    @DisplayName("Should detect email by pattern")
    void testDetectEmailByPattern() {
        Map<String, Object> attributes = Map.of(
            "field1", "user@example.com",
            "field2", "test.user+tag@domain.co.uk"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(2, result.size());
        assertEquals(PIIType.EMAIL, result.get("field1"));
        assertEquals(PIIType.EMAIL, result.get("field2"));
    }

    @Test
    @DisplayName("Should detect SSN by pattern")
    void testDetectSSNByPattern() {
        Map<String, Object> attributes = Map.of(
            "social_security", "123-45-6789"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(1, result.size());
        assertEquals(PIIType.SSN, result.get("social_security"));
    }

    @Test
    @DisplayName("Should detect credit card by pattern")
    void testDetectCreditCardByPattern() {
        Map<String, Object> attributes = Map.of(
            "payment", "4111-1111-1111-1111",
            "card", "4111 1111 1111 1111",
            "pan", "4111111111111111"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(3, result.size());
        assertEquals(PIIType.CREDIT_CARD, result.get("payment"));
        assertEquals(PIIType.CREDIT_CARD, result.get("card"));
        assertEquals(PIIType.CREDIT_CARD, result.get("pan"));
    }

    @Test
    @DisplayName("Should detect phone by pattern")
    void testDetectPhoneByPattern() {
        Map<String, Object> attributes = Map.of(
            "contact1", "(555) 123-4567",
            "contact2", "555-123-4567",
            "contact3", "5551234567"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(3, result.size());
        assertEquals(PIIType.PHONE, result.get("contact1"));
        assertEquals(PIIType.PHONE, result.get("contact2"));
        assertEquals(PIIType.PHONE, result.get("contact3"));
    }

    // Convention-based detection tests

    @Test
    @DisplayName("Should detect email by convention")
    void testDetectEmailByConvention() {
        Map<String, Object> attributes = Map.of(
            "user_email", "some value",
            "e-mail", "some value",
            "e_mail", "some value",
            "EMAIL", "some value"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(4, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.EMAIL));
    }

    @Test
    @DisplayName("Should detect SSN by convention")
    void testDetectSSNByConvention() {
        Map<String, Object> attributes = Map.of(
            "ssn", "value",
            "social_security", "value",
            "social-security", "value",
            "socialsecurity", "value"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(4, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.SSN));
    }

    @Test
    @DisplayName("Should detect phone by convention")
    void testDetectPhoneByConvention() {
        Map<String, Object> attributes = Map.of(
            "phone", "value",
            "mobile", "value",
            "telephone", "value",
            "cell", "value"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(4, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.PHONE));
    }

    @Test
    @DisplayName("Should detect credit card by convention")
    void testDetectCreditCardByConvention() {
        Map<String, Object> attributes = Map.of(
            "credit_card", "value",
            "creditcard", "value",
            "card_number", "value",
            "cardnumber", "value",
            "pan", "value"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(5, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.CREDIT_CARD));
    }

    @Test
    @DisplayName("Should detect name by convention but exclude username/hostname")
    void testDetectNameByConvention() {
        Map<String, Object> attributes = Map.of(
            "full_name", "John Doe",
            "fullname", "John Doe",
            "name", "John Doe"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(3, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.NAME));

        // Should NOT detect these as NAME
        Map<String, Object> notPII = Map.of(
            "username", "jdoe",
            "hostname", "server01",
            "filename", "document.pdf",
            "display_name", "John"
        );

        Map<String, PIIType> notPIIResult = service.detectPII(notPII);
        assertEquals(0, notPIIResult.size());
    }

    @Test
    @DisplayName("Should detect address by convention")
    void testDetectAddressByConvention() {
        Map<String, Object> attributes = Map.of(
            "address", "123 Main St",
            "street", "Main St",
            "city", "Springfield",
            "zip", "12345",
            "postal", "12345"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(5, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.ADDRESS));
    }

    // Edge cases and multi-field tests

    @Test
    @DisplayName("Should detect multiple PII fields in single span")
    void testMultiplePIIFields() {
        Map<String, Object> attributes = Map.of(
            "user_email", "user@example.com",
            "ssn", "123-45-6789",
            "phone", "(555) 123-4567",
            "card", "4111-1111-1111-1111"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(4, result.size());
        assertEquals(PIIType.EMAIL, result.get("user_email"));
        assertEquals(PIIType.SSN, result.get("ssn"));
        assertEquals(PIIType.PHONE, result.get("phone"));
        assertEquals(PIIType.CREDIT_CARD, result.get("card"));
    }

    @Test
    @DisplayName("Should skip null and empty values without error")
    void testNullAndEmptyValues() {
        Map<String, Object> attributes = Map.of(
            "field1", "",
            "field2", "null",
            "field3", "valid@email.com"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        // Only field3 should be detected
        assertEquals(1, result.size());
        assertEquals(PIIType.EMAIL, result.get("field3"));
    }

    @Test
    @DisplayName("Should handle empty attributes map")
    void testEmptyAttributes() {
        Map<String, PIIType> result = service.detectPII(Map.of());
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("Should handle null attributes map")
    void testNullAttributes() {
        Map<String, PIIType> result = service.detectPII(null);
        assertEquals(0, result.size());
    }

    @Test
    @DisplayName("Should be case insensitive for field names")
    void testCaseInsensitivity() {
        Map<String, Object> attributes = Map.of(
            "EMAIL", "value",
            "Email", "value",
            "email", "value",
            "eMaIl", "value"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(4, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.EMAIL));
    }

    @Test
    @DisplayName("Pattern detection should take precedence over convention")
    void testPatternPrecedence() {
        // Field name suggests PHONE, but value matches EMAIL pattern
        Map<String, Object> attributes = Map.of(
            "phone_contact", "user@example.com"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        // Should detect as EMAIL by pattern (higher confidence)
        assertEquals(1, result.size());
        assertEquals(PIIType.EMAIL, result.get("phone_contact"));
    }

    @Test
    @DisplayName("Should handle unusual email formats")
    void testUnusualEmailFormats() {
        Map<String, Object> attributes = Map.of(
            "field1", "user+tag@example.com",
            "field2", "user.name@sub.domain.co.uk",
            "field3", "user_123@test-domain.com"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(3, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.EMAIL));
    }

    @Test
    @DisplayName("Should handle various field naming patterns")
    void testFieldNamingPatterns() {
        Map<String, Object> attributes = Map.of(
            "user_email", "value",      // snake_case
            "userEmail", "value",       // camelCase
            "user-email", "value",      // kebab-case
            "USER_EMAIL", "value"       // UPPER_SNAKE_CASE
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        assertEquals(4, result.size());
        assertTrue(result.values().stream().allMatch(t -> t == PIIType.EMAIL));
    }

    @Test
    @DisplayName("Should accept false positives over false negatives")
    void testAcceptableFalsePositives() {
        // These might be false positives, but acceptable
        Map<String, Object> attributes = Map.of(
            "contact_info", "Some generic text with email",
            "user_name_field", "John Doe"
        );

        Map<String, PIIType> result = service.detectPII(attributes);

        // Contact_info doesn't match any convention (no false positive here)
        // user_name_field should NOT match NAME (has excluded pattern)
        assertEquals(0, result.size());
    }
}
