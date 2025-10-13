package com.fluo.security;

import com.fluo.exceptions.InjectionAttemptException;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive tests for InputSanitizer (PRD-007 Unit D).
 *
 * Coverage Target: 90%+ instruction coverage
 *
 * Test Categories:
 * 1. XSS Prevention (5 tests)
 * 2. SQL Injection Detection (5 tests)
 * 3. LDAP Injection Detection (3 tests)
 * 4. Command Injection Detection (4 tests)
 * 5. Map Sanitization (4 tests)
 * 6. List Sanitization (2 tests)
 * 7. Record Sanitization (2 tests)
 * 8. Edge Cases (4 tests)
 */
@QuarkusTest
class InputSanitizerTest {

    @Inject
    InputSanitizer sanitizer;

    // ==================== XSS Prevention Tests ====================

    @Test
    void testSanitize_RemovesScript() {
        String malicious = "<script>alert('XSS')</script>Hello";
        String sanitized = sanitizer.sanitize(malicious);
        assertFalse(sanitized.contains("<script>"));
        assertFalse(sanitized.contains("alert"));
    }

    @Test
    void testSanitize_RemovesOnEventHandlers() {
        String malicious = "<img src=x onerror='alert(1)'>";
        String sanitized = sanitizer.sanitize(malicious);
        assertFalse(sanitized.contains("onerror"));
        assertFalse(sanitized.contains("alert"));
    }

    @Test
    void testSanitize_AllowsSafeHtml() {
        String safe = "<p>Hello <strong>world</strong></p>";
        String sanitized = sanitizer.sanitize(safe);
        assertTrue(sanitized.contains("<p>"));
        assertTrue(sanitized.contains("<strong>"));
    }

    @Test
    void testSanitize_RemovesIframe() {
        String malicious = "<iframe src='evil.com'></iframe>";
        String sanitized = sanitizer.sanitize(malicious);
        assertFalse(sanitized.contains("<iframe>"));
    }

    @Test
    void testSanitize_RemovesJavaScriptUrl() {
        String malicious = "<a href='javascript:void(0)'>Click</a>";
        String sanitized = sanitizer.sanitize(malicious);
        assertFalse(sanitized.contains("javascript:"));
    }

    // ==================== SQL Injection Detection Tests ====================

    @Test
    void testSanitize_DetectsSqlInjection_OR() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("' OR 1=1 --")
        );
        assertTrue(exception.getMessage().contains("SQL injection"));
    }

    @Test
    void testSanitize_DetectsSqlInjection_UNION() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("' UNION SELECT * FROM users --")
        );
        assertTrue(exception.getMessage().contains("SQL injection"));
    }

    @Test
    void testSanitize_DetectsSqlInjection_DROP() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("'; DROP TABLE users; --")
        );
        assertTrue(exception.getMessage().contains("SQL injection"));
    }

    @Test
    void testSanitize_DetectsSqlInjection_SingleQuote() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("admin'--")
        );
        assertTrue(exception.getMessage().contains("SQL injection"));
    }

    @Test
    void testSanitize_DetectsSqlInjection_Comment() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("username-- comment")
        );
        assertTrue(exception.getMessage().contains("SQL injection"));
    }

    // ==================== LDAP Injection Detection Tests ====================

    @Test
    void testSanitize_DetectsLdapInjection_Asterisk() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("*)(uid=*))(|(uid=*")
        );
        assertTrue(exception.getMessage().contains("LDAP injection"));
    }

    @Test
    void testSanitize_DetectsLdapInjection_Parentheses() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("user)(|(password=*))")
        );
        assertTrue(exception.getMessage().contains("LDAP injection"));
    }

    @Test
    void testSanitize_DetectsLdapInjection_Pipe() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("admin|manager")
        );
        assertTrue(exception.getMessage().contains("LDAP injection"));
    }

    // ==================== Command Injection Detection Tests ====================

    @Test
    void testSanitize_DetectsCommandInjection_Semicolon() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("file.txt; rm -rf /")
        );
        assertTrue(exception.getMessage().contains("Command injection"));
    }

    @Test
    void testSanitize_DetectsCommandInjection_Pipe() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("ls | grep password")
        );
        assertTrue(exception.getMessage().contains("Command injection"));
    }

    @Test
    void testSanitize_DetectsCommandInjection_Backtick() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("file`whoami`.txt")
        );
        assertTrue(exception.getMessage().contains("Command injection"));
    }

    @Test
    void testSanitize_DetectsCommandInjection_Dollar() {
        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitize("$(cat /etc/passwd)")
        );
        assertTrue(exception.getMessage().contains("Command injection"));
    }

    // ==================== Map Sanitization Tests ====================

    @Test
    void testSanitizeMap_SanitizesStringValues() {
        Map<String, Object> input = Map.of(
            "name", "<script>alert(1)</script>John",
            "age", 30
        );

        Map<String, Object> sanitized = sanitizer.sanitizeMap(input);

        assertTrue(sanitized.get("name") instanceof String);
        assertFalse(((String) sanitized.get("name")).contains("<script>"));
        assertEquals(30, sanitized.get("age"));
    }

    @Test
    void testSanitizeMap_DetectsInjectionInValues() {
        Map<String, Object> input = Map.of("query", "' OR 1=1 --");

        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitizeMap(input)
        );
        assertTrue(exception.getMessage().contains("SQL injection"));
    }

    @Test
    void testSanitizeMap_SanitizesNestedMaps() {
        Map<String, Object> nested = Map.of("innerKey", "<script>alert(1)</script>");
        Map<String, Object> input = Map.of("outerKey", nested);

        Map<String, Object> sanitized = sanitizer.sanitizeMap(input);

        @SuppressWarnings("unchecked")
        Map<String, Object> sanitizedNested = (Map<String, Object>) sanitized.get("outerKey");
        assertFalse(((String) sanitizedNested.get("innerKey")).contains("<script>"));
    }

    @Test
    void testSanitizeMap_SanitizesListsInMaps() {
        List<String> tags = List.of("safe", "<script>bad</script>");
        Map<String, Object> input = Map.of("tags", tags);

        Map<String, Object> sanitized = sanitizer.sanitizeMap(input);

        @SuppressWarnings("unchecked")
        List<String> sanitizedTags = (List<String>) sanitized.get("tags");
        assertEquals("safe", sanitizedTags.get(0));
        assertFalse(sanitizedTags.get(1).contains("<script>"));
    }

    // ==================== List Sanitization Tests ====================

    @Test
    void testSanitizeList_SanitizesStrings() {
        // Use sanitizeMap to access private sanitizeList method
        Map<String, Object> input = Map.of(
            "items", List.of("safe", "<script>xss</script>")
        );

        Map<String, Object> sanitized = sanitizer.sanitizeMap(input);

        @SuppressWarnings("unchecked")
        List<String> items = (List<String>) sanitized.get("items");
        assertEquals("safe", items.get(0));
        assertFalse(items.get(1).contains("<script>"));
    }

    @Test
    void testSanitizeList_DetectsInjection() {
        Map<String, Object> input = Map.of("commands", List.of("ls", "rm -rf /"));

        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitizeMap(input)
        );
        assertTrue(exception.getMessage().contains("Command injection"));
    }

    // ==================== Record Sanitization Tests ====================

    record TestRecord(String name, String description, int count) {}

    @Test
    void testSanitizeRecord_SanitizesStringFields() {
        TestRecord record = new TestRecord(
            "<script>alert(1)</script>Name",
            "Safe description",
            42
        );

        TestRecord sanitized = (TestRecord) sanitizer.sanitizeRecord(record);

        assertFalse(sanitized.name().contains("<script>"));
        assertEquals("Safe description", sanitized.description());
        assertEquals(42, sanitized.count());
    }

    @Test
    void testSanitizeRecord_DetectsInjection() {
        TestRecord record = new TestRecord("John", "' OR 1=1 --", 0);

        InjectionAttemptException exception = assertThrows(
            InjectionAttemptException.class,
            () -> sanitizer.sanitizeRecord(record)
        );
        assertTrue(exception.getMessage().contains("SQL injection"));
    }

    // ==================== Edge Cases ====================

    @Test
    void testSanitize_HandlesNull() {
        String result = sanitizer.sanitize(null);
        assertNull(result);
    }

    @Test
    void testSanitize_HandlesEmptyString() {
        String result = sanitizer.sanitize("");
        assertTrue(result.isEmpty());
    }

    @Test
    void testSanitize_HandlesBlankString() {
        String result = sanitizer.sanitize("   ");
        assertEquals("   ", result);
    }

    @Test
    void testSanitize_HandlesCleanString() {
        String clean = "Hello World 123";
        String result = sanitizer.sanitize(clean);
        assertEquals(clean, result);
    }
}
