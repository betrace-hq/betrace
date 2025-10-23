package com.betrace.processors;

import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.util.Map;
import java.util.HashMap;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TestStubProcessors Tests")
class TestStubProcessorsTest {

    private DefaultCamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("CreateRuleProcessor should create rule with generated ID when not provided")
    void testCreateRuleProcessorGeneratesId() throws Exception {
        TestStubProcessors.CreateRuleProcessor processor = new TestStubProcessors.CreateRuleProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("name", "Test Rule");
        body.put("expression", "temperature > 90");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertNotNull(result.get("id"));
        assertEquals("Test Rule", result.get("name"));
        assertEquals("temperature > 90", result.get("expression"));
        assertEquals(true, result.get("active"));
        assertNotNull(result.get("createdAt"));
    }

    @Test
    @DisplayName("CreateRuleProcessor should preserve existing ID")
    void testCreateRuleProcessorPreservesId() throws Exception {
        TestStubProcessors.CreateRuleProcessor processor = new TestStubProcessors.CreateRuleProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("id", "custom-rule-123");
        body.put("name", "Test Rule");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertEquals("custom-rule-123", result.get("id"));
    }

    @Test
    @DisplayName("CreateRuleProcessor should handle null body")
    void testCreateRuleProcessorNullBody() throws Exception {
        TestStubProcessors.CreateRuleProcessor processor = new TestStubProcessors.CreateRuleProcessor();
        exchange.getIn().setBody(null);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertNotNull(result.get("id"));
        assertEquals(true, result.get("active"));
        assertNotNull(result.get("createdAt"));
    }

    @Test
    @DisplayName("CreateSignalProcessor should create signal with new ID")
    void testCreateSignalProcessor() throws Exception {
        TestStubProcessors.CreateSignalProcessor processor = new TestStubProcessors.CreateSignalProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("message", "High temperature detected");
        body.put("severity", "HIGH");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertNotNull(result.get("id"));
        assertEquals("High temperature detected", result.get("message"));
        assertEquals("HIGH", result.get("severity"));
        assertEquals("STORED", result.get("status"));
        assertNotNull(result.get("createdAt"));
    }

    @Test
    @DisplayName("CreateSignalProcessor should handle null body")
    void testCreateSignalProcessorNullBody() throws Exception {
        TestStubProcessors.CreateSignalProcessor processor = new TestStubProcessors.CreateSignalProcessor();
        exchange.getIn().setBody(null);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertNotNull(result.get("id"));
        assertEquals("STORED", result.get("status"));
        assertNotNull(result.get("createdAt"));
    }

    @Test
    @DisplayName("ValidateRuleProcessor should validate valid expression")
    void testValidateRuleProcessorValid() throws Exception {
        TestStubProcessors.ValidateRuleProcessor processor = new TestStubProcessors.ValidateRuleProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("expression", "temperature > 90 && humidity < 50");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals(true, result.get("valid"));
        assertEquals("Expression is valid", result.get("message"));
    }

    @Test
    @DisplayName("ValidateRuleProcessor should reject invalid expression")
    void testValidateRuleProcessorInvalid() throws Exception {
        TestStubProcessors.ValidateRuleProcessor processor = new TestStubProcessors.ValidateRuleProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("expression", "temperature >>> invalid");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals(false, result.get("valid"));
        assertEquals("Invalid expression syntax", result.get("message"));
    }

    @Test
    @DisplayName("ValidateRuleProcessor should handle null expression")
    void testValidateRuleProcessorNullExpression() throws Exception {
        TestStubProcessors.ValidateRuleProcessor processor = new TestStubProcessors.ValidateRuleProcessor();

        Map<String, Object> body = new HashMap<>();
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertEquals(false, result.get("valid"));
        assertEquals("Invalid expression syntax", result.get("message"));
    }

    @Test
    @DisplayName("ValidateRuleProcessor should handle null body")
    void testValidateRuleProcessorNullBody() throws Exception {
        TestStubProcessors.ValidateRuleProcessor processor = new TestStubProcessors.ValidateRuleProcessor();
        exchange.getIn().setBody(null);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertEquals(false, result.get("valid"));
        assertEquals("Invalid expression syntax", result.get("message"));
    }

    @Test
    @DisplayName("GetSignalProcessor should return signal with provided ID")
    void testGetSignalProcessor() throws Exception {
        TestStubProcessors.GetSignalProcessor processor = new TestStubProcessors.GetSignalProcessor();

        exchange.getIn().setHeader("id", "signal-123");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals("signal-123", result.get("id"));
        assertEquals("STORED", result.get("status"));
        assertEquals("test-rule", result.get("ruleId"));
        assertEquals("Test signal", result.get("message"));
        assertEquals("MEDIUM", result.get("severity"));
    }

    @Test
    @DisplayName("GetSignalProcessor should handle missing ID header")
    void testGetSignalProcessorNoId() throws Exception {
        TestStubProcessors.GetSignalProcessor processor = new TestStubProcessors.GetSignalProcessor();

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertNull(result.get("id"));
        assertEquals("STORED", result.get("status"));
        assertEquals("test-rule", result.get("ruleId"));
        assertEquals("Test signal", result.get("message"));
        assertEquals("MEDIUM", result.get("severity"));
    }

    @Test
    @DisplayName("GetRuleProcessor should return rule with provided ID")
    void testGetRuleProcessor() throws Exception {
        TestStubProcessors.GetRuleProcessor processor = new TestStubProcessors.GetRuleProcessor();

        exchange.getIn().setHeader("id", "rule-456");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals("rule-456", result.get("id"));
        assertEquals("Test Rule", result.get("name"));
        assertEquals("temperature > 90", result.get("expression"));
        assertEquals(true, result.get("active"));
    }

    @Test
    @DisplayName("GetRuleProcessor should handle missing ID header")
    void testGetRuleProcessorNoId() throws Exception {
        TestStubProcessors.GetRuleProcessor processor = new TestStubProcessors.GetRuleProcessor();

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertNull(result.get("id"));
        assertEquals("Test Rule", result.get("name"));
        assertEquals("temperature > 90", result.get("expression"));
        assertEquals(true, result.get("active"));
    }

    @Test
    @DisplayName("All processors should be annotated correctly")
    void testProcessorAnnotations() {
        // Verify CreateRuleProcessor annotations
        assertTrue(TestStubProcessors.CreateRuleProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TestStubProcessors.CreateRuleProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("createRuleProcessor",
            TestStubProcessors.CreateRuleProcessor.class.getAnnotation(Named.class).value());

        // Verify CreateSignalProcessor annotations
        assertTrue(TestStubProcessors.CreateSignalProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TestStubProcessors.CreateSignalProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("createSignalProcessor",
            TestStubProcessors.CreateSignalProcessor.class.getAnnotation(Named.class).value());

        // Verify ValidateRuleProcessor annotations
        assertTrue(TestStubProcessors.ValidateRuleProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TestStubProcessors.ValidateRuleProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("validateRuleProcessor",
            TestStubProcessors.ValidateRuleProcessor.class.getAnnotation(Named.class).value());

        // Verify GetSignalProcessor annotations
        assertTrue(TestStubProcessors.GetSignalProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TestStubProcessors.GetSignalProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("getSignalProcessor",
            TestStubProcessors.GetSignalProcessor.class.getAnnotation(Named.class).value());

        // Verify GetRuleProcessor annotations
        assertTrue(TestStubProcessors.GetRuleProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TestStubProcessors.GetRuleProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("getRuleProcessor",
            TestStubProcessors.GetRuleProcessor.class.getAnnotation(Named.class).value());
    }
}