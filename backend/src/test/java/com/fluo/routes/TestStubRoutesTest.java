package com.fluo.routes;

import org.apache.camel.CamelContext;
import org.apache.camel.impl.DefaultCamelContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Disabled;

import java.util.Map;
import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.*;

@Disabled("Route tests require Quarkus context with CDI beans - missing createRuleProcessor bean")
@DisplayName("TestStubRoutes Tests")
class TestStubRoutesTest {

    private CamelContext context;
    private TestStubRoutes testStubRoutes;

    @BeforeEach
    void setUp() throws Exception {
        context = new DefaultCamelContext();

        // Create test stub routes with stubs enabled
        testStubRoutes = new TestStubRoutes();
        testStubRoutes.stubRoutesEnabled = true; // Enable for testing

        context.addRoutes(testStubRoutes);
        context.start();
    }

    @AfterEach
    void tearDown() throws Exception {
        if (context != null) {
            context.stop();
        }
    }

    @Test
    @DisplayName("Should create rule with generated ID when not provided")
    void testCreateRuleWithGeneratedId() throws Exception {
        Map<String, Object> input = new HashMap<>();
        input.put("name", "Test Rule");
        input.put("expression", "temperature > 90");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:createRule", input, Map.class);

        assertNotNull(response);
        assertEquals("Test Rule", response.get("name"));
        assertEquals("temperature > 90", response.get("expression"));
        assertNotNull(response.get("id")); // Should be generated
        assertEquals(true, response.get("active"));
        assertNotNull(response.get("createdAt"));
    }

    @Test
    @DisplayName("Should preserve existing ID when provided")
    void testCreateRuleWithExistingId() throws Exception {
        Map<String, Object> input = new HashMap<>();
        input.put("id", "existing-rule-123");
        input.put("name", "Existing Rule");
        input.put("expression", "cpu > 80");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:createRule", input, Map.class);

        assertNotNull(response);
        assertEquals("existing-rule-123", response.get("id"));
        assertEquals("Existing Rule", response.get("name"));
        assertEquals("cpu > 80", response.get("expression"));
        assertEquals(true, response.get("active"));
        assertNotNull(response.get("createdAt"));
    }

    @Test
    @DisplayName("Should create signal with generated ID")
    void testCreateSignal() throws Exception {
        Map<String, Object> input = new HashMap<>();
        input.put("message", "Test signal");
        input.put("severity", "HIGH");
        input.put("ruleId", "rule-123");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:createSignal", input, Map.class);

        assertNotNull(response);
        assertEquals("Test signal", response.get("message"));
        assertEquals("HIGH", response.get("severity"));
        assertEquals("rule-123", response.get("ruleId"));
        assertNotNull(response.get("id")); // Should be generated
        assertEquals("STORED", response.get("status"));
        assertNotNull(response.get("createdAt"));
    }

    @Test
    @DisplayName("Should validate rule expression successfully")
    void testValidateRuleValid() throws Exception {
        Map<String, Object> input = new HashMap<>();
        input.put("expression", "temperature > 30");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:validateRule", input, Map.class);

        assertNotNull(response);
        assertEquals(true, response.get("valid"));
        assertEquals("Expression is valid", response.get("message"));
    }

    @Test
    @DisplayName("Should detect invalid rule expression")
    void testValidateRuleInvalid() throws Exception {
        Map<String, Object> input = new HashMap<>();
        input.put("expression", "temperature >>> 30"); // Invalid syntax

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:validateRule", input, Map.class);

        assertNotNull(response);
        assertEquals(false, response.get("valid"));
        assertEquals("Invalid expression syntax", response.get("message"));
    }

    @Test
    @DisplayName("Should handle null expression in validation")
    void testValidateRuleNullExpression() throws Exception {
        Map<String, Object> input = new HashMap<>();
        input.put("expression", null);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:validateRule", input, Map.class);

        assertNotNull(response);
        assertEquals(false, response.get("valid"));
        assertEquals("Invalid expression syntax", response.get("message"));
    }

    @Test
    @DisplayName("Should get signal by ID")
    void testGetSignal() throws Exception {
        Map<String, Object> headers = new HashMap<>();
        headers.put("id", "signal-123");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBodyAndHeaders("direct:getSignal", null, headers, Map.class);

        assertNotNull(response);
        assertEquals("signal-123", response.get("id"));
        assertEquals("STORED", response.get("status"));
        assertEquals("test-rule", response.get("ruleId"));
        assertEquals("Test signal", response.get("message"));
        assertEquals("MEDIUM", response.get("severity"));
    }

    @Test
    @DisplayName("Should get rule by ID")
    void testGetRule() throws Exception {
        Map<String, Object> headers = new HashMap<>();
        headers.put("id", "rule-456");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBodyAndHeaders("direct:getRule", null, headers, Map.class);

        assertNotNull(response);
        assertEquals("rule-456", response.get("id"));
        assertEquals("Test Rule", response.get("name"));
        assertEquals("temperature > 90", response.get("expression"));
        assertEquals(true, response.get("active"));
    }

    @Test
    @DisplayName("Should handle null ID in getSignal")
    void testGetSignalNullId() throws Exception {
        Map<String, Object> headers = new HashMap<>();
        headers.put("id", null);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBodyAndHeaders("direct:getSignal", null, headers, Map.class);

        assertNotNull(response);
        assertNull(response.get("id"));
        assertEquals("STORED", response.get("status"));
    }

    @Test
    @DisplayName("Should handle null ID in getRule")
    void testGetRuleNullId() throws Exception {
        Map<String, Object> headers = new HashMap<>();
        headers.put("id", null);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBodyAndHeaders("direct:getRule", null, headers, Map.class);

        assertNotNull(response);
        assertNull(response.get("id"));
        assertEquals("Test Rule", response.get("name"));
    }

    @Test
    @DisplayName("Should handle null input gracefully in createRule")
    void testCreateRuleNullInput() throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:createRule", null, Map.class);

        assertNotNull(response);
        assertNotNull(response.get("id")); // Should be generated
        assertEquals(true, response.get("active"));
        assertNotNull(response.get("createdAt"));
    }

    @Test
    @DisplayName("Should handle null input gracefully in createSignal")
    void testCreateSignalNullInput() throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:createSignal", null, Map.class);

        assertNotNull(response);
        assertNotNull(response.get("id")); // Should be generated
        assertEquals("STORED", response.get("status"));
        assertNotNull(response.get("createdAt"));
    }

    @Test
    @DisplayName("Should handle null input gracefully in validateRule")
    void testValidateRuleNullInput() throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:validateRule", null, Map.class);

        assertNotNull(response);
        assertEquals(false, response.get("valid"));
        assertEquals("Invalid expression syntax", response.get("message"));
    }

    @Test
    @DisplayName("Should generate unique IDs for multiple rule creations")
    void testUniqueIdGeneration() throws Exception {
        Map<String, Object> input1 = Map.of("name", "Rule 1");
        Map<String, Object> input2 = Map.of("name", "Rule 2");

        @SuppressWarnings("unchecked")
        Map<String, Object> response1 = context.createProducerTemplate()
            .requestBody("direct:createRule", input1, Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> response2 = context.createProducerTemplate()
            .requestBody("direct:createRule", input2, Map.class);

        assertNotNull(response1.get("id"));
        assertNotNull(response2.get("id"));
        assertNotEquals(response1.get("id"), response2.get("id"));
    }

    @Test
    @DisplayName("Should generate unique IDs for multiple signal creations")
    void testUniqueSignalIdGeneration() throws Exception {
        Map<String, Object> input1 = Map.of("message", "Signal 1");
        Map<String, Object> input2 = Map.of("message", "Signal 2");

        @SuppressWarnings("unchecked")
        Map<String, Object> response1 = context.createProducerTemplate()
            .requestBody("direct:createSignal", input1, Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> response2 = context.createProducerTemplate()
            .requestBody("direct:createSignal", input2, Map.class);

        assertNotNull(response1.get("id"));
        assertNotNull(response2.get("id"));
        assertNotEquals(response1.get("id"), response2.get("id"));
    }

    @Test
    @DisplayName("Should have all expected routes when enabled")
    void testAllRoutesPresent() throws Exception {
        // Verify all expected direct routes are present
        assertNotNull(context.hasEndpoint("direct:createRule"));
        assertNotNull(context.hasEndpoint("direct:createSignal"));
        assertNotNull(context.hasEndpoint("direct:validateRule"));
        assertNotNull(context.hasEndpoint("direct:getSignal"));
        assertNotNull(context.hasEndpoint("direct:getRule"));
    }

    @Test
    @DisplayName("Should preserve input data structure in responses")
    void testInputDataPreservation() throws Exception {
        Map<String, Object> ruleInput = new HashMap<>();
        ruleInput.put("name", "Complex Rule");
        ruleInput.put("expression", "temperature > 30 && humidity < 60");
        ruleInput.put("description", "A complex rule for testing");
        ruleInput.put("priority", "HIGH");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:createRule", ruleInput, Map.class);

        // Original data should be preserved
        assertEquals("Complex Rule", response.get("name"));
        assertEquals("temperature > 30 && humidity < 60", response.get("expression"));
        assertEquals("A complex rule for testing", response.get("description"));
        assertEquals("HIGH", response.get("priority"));

        // New data should be added
        assertNotNull(response.get("id"));
        assertEquals(true, response.get("active"));
        assertNotNull(response.get("createdAt"));
    }

    @Test
    @DisplayName("Should validate various expression patterns")
    void testValidationPatterns() throws Exception {
        // Valid expressions
        String[] validExpressions = {
            "temperature > 30",
            "cpu < 80",
            "memory >= 50",
            "status == 'OK'",
            "temp > 30 && cpu < 80",
            "value != null"
        };

        for (String expr : validExpressions) {
            Map<String, Object> input = Map.of("expression", expr);
            @SuppressWarnings("unchecked")
            Map<String, Object> response = context.createProducerTemplate()
                .requestBody("direct:validateRule", input, Map.class);
            assertEquals(true, response.get("valid"), "Expression should be valid: " + expr);
        }

        // Invalid expressions (containing >>>)
        String[] invalidExpressions = {
            "temperature >>> 30",
            "invalid >>> syntax",
            "test >>> expression"
        };

        for (String expr : invalidExpressions) {
            Map<String, Object> input = Map.of("expression", expr);
            @SuppressWarnings("unchecked")
            Map<String, Object> response = context.createProducerTemplate()
                .requestBody("direct:validateRule", input, Map.class);
            assertEquals(false, response.get("valid"), "Expression should be invalid: " + expr);
        }
    }
}