package com.betrace.transformers.rule;

import com.betrace.model.Rule;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.spi.DataType;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JsonToRuleTransformer Tests")
class JsonToRuleTransformerTest {

    private JsonToRuleTransformer transformer;
    private CamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        transformer = new JsonToRuleTransformer();
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("Should transform valid JSON to Rule")
    void testTransformValidJson() throws Exception {
        String json = """
            {
                "id": "rule-123",
                "name": "High CPU Alert",
                "version": "2.0",
                "expression": "cpu > 90 && duration > 60000",
                "type": "OGNL"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule);
        assertEquals("rule-123", rule.id());
        assertEquals("High CPU Alert", rule.name());
        assertEquals("2.0", rule.version());
        assertEquals("cpu > 90 && duration > 60000", rule.expression());
        assertEquals(Rule.RuleType.OGNL, rule.type());
        assertTrue(rule.active());
        assertNotNull(rule.metadata());
        assertNotNull(rule.createdAt());
        assertNotNull(rule.updatedAt());
    }

    @Test
    @DisplayName("Should use default values for missing optional fields")
    void testTransformWithDefaults() throws Exception {
        String json = """
            {
                "id": "rule-minimal",
                "name": "Minimal Rule",
                "expression": "value > 0"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule);
        assertEquals("rule-minimal", rule.id());
        assertEquals("Minimal Rule", rule.name());
        assertEquals("1.0", rule.version()); // Default version
        assertEquals("value > 0", rule.expression());
        assertEquals(Rule.RuleType.OGNL, rule.type()); // Default type
    }

    @Test
    @DisplayName("Should handle all rule types")
    void testAllRuleTypes() throws Exception {
        for (Rule.RuleType type : Rule.RuleType.values()) {
            String json = String.format("""
                {
                    "id": "rule-%s",
                    "name": "Test %s Rule",
                    "version": "1.0",
                    "expression": "test expression",
                    "type": "%s"
                }
                """, type.name().toLowerCase(), type.name(), type.name());

            Exchange testExchange = new DefaultExchange(context);
            testExchange.getIn().setBody(json);
            transformer.transform(testExchange.getIn(), null, null);

            Rule rule = testExchange.getIn().getBody(Rule.class);
            assertEquals(type, rule.type(), "Failed for rule type: " + type);
        }
    }

    @Test
    @DisplayName("Should throw exception for null JSON")
    void testTransformNullJson() {
        exchange.getIn().setBody(null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );

        assertEquals("JSON input cannot be null or empty", exception.getMessage());
    }

    @Test
    @DisplayName("Should throw exception for empty JSON")
    void testTransformEmptyJson() {
        exchange.getIn().setBody("   ");

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );

        assertEquals("JSON input cannot be null or empty", exception.getMessage());
    }

    @Test
    @DisplayName("Should throw exception for invalid JSON")
    void testTransformInvalidJson() {
        exchange.getIn().setBody("not a valid json");

        assertThrows(
            Exception.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );
    }

    @Test
    @DisplayName("Should handle complex expressions")
    void testComplexExpression() throws Exception {
        String json = """
            {
                "id": "complex-rule",
                "name": "Complex Rule",
                "version": "3.0",
                "expression": "(cpu > 90 && memory > 85) || (diskUsage > 95 && isProduction == true) || errorCount > 100",
                "type": "OGNL"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule);
        assertEquals("(cpu > 90 && memory > 85) || (diskUsage > 95 && isProduction == true) || errorCount > 100",
                     rule.expression());
    }

    @Test
    @DisplayName("Should handle special characters in expression")
    void testSpecialCharactersInExpression() throws Exception {
        String json = """
            {
                "id": "special-rule",
                "name": "Special Characters Rule",
                "version": "1.0",
                "expression": "message.contains(\\"error\\") && level == 'SEVERE' && tags.contains(\\\"production\\\")",
                "type": "JAVASCRIPT"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule);
        assertTrue(rule.expression().contains("\"error\""));
        assertEquals(Rule.RuleType.JAVASCRIPT, rule.type());
    }

    @Test
    @DisplayName("Should handle missing fields gracefully")
    void testMissingFields() throws Exception {
        String json = """
            {
                "id": "",
                "name": "",
                "expression": ""
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule);
        assertEquals("", rule.id());
        assertEquals("", rule.name());
        assertEquals("", rule.expression());
        assertEquals("1.0", rule.version()); // Default
        assertEquals(Rule.RuleType.OGNL, rule.type()); // Default
    }

    @Test
    @DisplayName("Should use default for invalid rule type")
    void testInvalidRuleType() throws Exception {
        String json = """
            {
                "id": "invalid-type",
                "name": "Invalid Type Rule",
                "expression": "true",
                "type": "INVALID_TYPE"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule);
        assertEquals(Rule.RuleType.OGNL, rule.type()); // Should use default
    }

    @Test
    @DisplayName("Should handle Python rule type")
    void testPythonRuleType() throws Exception {
        String json = """
            {
                "id": "python-rule",
                "name": "Python Rule",
                "version": "1.0",
                "expression": "def evaluate(context):\\n    return context['cpu'] > 90",
                "type": "PYTHON"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule);
        assertEquals(Rule.RuleType.PYTHON, rule.type());
        assertTrue(rule.expression().contains("def evaluate"));
    }

    @Test
    @DisplayName("Should handle CEL rule type")
    void testCELRuleType() throws Exception {
        String json = """
            {
                "id": "cel-rule",
                "name": "CEL Rule",
                "version": "1.0",
                "expression": "request.auth.claims.email == 'admin@example.com'",
                "type": "CEL"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule);
        assertEquals(Rule.RuleType.CEL, rule.type());
        assertEquals("request.auth.claims.email == 'admin@example.com'", rule.expression());
    }

    @Test
    @DisplayName("Should create rule with current timestamps")
    void testTimestamps() throws Exception {
        String json = """
            {
                "id": "timestamp-rule",
                "name": "Timestamp Rule",
                "expression": "true",
                "type": "OGNL"
            }
            """;

        long beforeTransform = System.currentTimeMillis();
        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);
        long afterTransform = System.currentTimeMillis();

        Rule rule = exchange.getIn().getBody(Rule.class);

        // Timestamps should be set and recent
        assertNotNull(rule.createdAt());
        assertNotNull(rule.updatedAt());

        long createdMillis = rule.createdAt().toEpochMilli();
        long updatedMillis = rule.updatedAt().toEpochMilli();

        assertTrue(createdMillis >= beforeTransform);
        assertTrue(createdMillis <= afterTransform);
        assertTrue(updatedMillis >= beforeTransform);
        assertTrue(updatedMillis <= afterTransform);

        // Created and updated should be the same for new rules
        assertEquals(rule.createdAt(), rule.updatedAt());
    }

    @Test
    @DisplayName("Should create active rule by default")
    void testActiveByDefault() throws Exception {
        String json = """
            {
                "id": "active-rule",
                "name": "Active Rule",
                "expression": "true"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertTrue(rule.active());
    }

    @Test
    @DisplayName("Should create empty metadata map")
    void testEmptyMetadata() throws Exception {
        String json = """
            {
                "id": "metadata-rule",
                "name": "Metadata Rule",
                "expression": "true"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Rule rule = exchange.getIn().getBody(Rule.class);
        assertNotNull(rule.metadata());
        assertTrue(rule.metadata().isEmpty());
    }
}