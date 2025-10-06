package com.fluo.transformers.signal;

import com.fluo.model.Signal;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.spi.DataType;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JsonToSignalTransformer Tests")
class JsonToSignalTransformerTest {

    private JsonToSignalTransformer transformer;
    private CamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        transformer = new JsonToSignalTransformer();
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("Should transform valid JSON to Signal")
    void testTransformValidJson() throws Exception {
        String json = """
            {
                "ruleId": "rule-123",
                "ruleVersion": "2.0",
                "spanId": "span-456",
                "traceId": "trace-789",
                "severity": "HIGH",
                "message": "Critical issue detected",
                "attributes": {
                    "cpu": 95,
                    "memory": 85,
                    "host": "server01"
                },
                "source": "monitoring-system",
                "tenantId": "tenant-001"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertNotNull(signal);
        assertEquals("rule-123", signal.ruleId());
        assertEquals("2.0", signal.ruleVersion());
        assertEquals("span-456", signal.spanId());
        assertEquals("trace-789", signal.traceId());
        assertEquals(Signal.SignalSeverity.HIGH, signal.severity());
        assertEquals("Critical issue detected", signal.message());
        assertNotNull(signal.attributes());
        assertEquals(95, signal.attributes().get("cpu"));
        assertEquals(85, signal.attributes().get("memory"));
        assertEquals("server01", signal.attributes().get("host"));
        assertEquals("monitoring-system", signal.source());
        assertEquals("tenant-001", signal.tenantId());
    }

    @Test
    @DisplayName("Should use default values for missing optional fields")
    void testTransformWithDefaults() throws Exception {
        String json = """
            {
                "ruleId": "rule-minimal",
                "spanId": "span-minimal",
                "traceId": "trace-minimal",
                "message": "Minimal signal",
                "attributes": {},
                "source": "test",
                "tenantId": "tenant-002"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertNotNull(signal);
        assertEquals("rule-minimal", signal.ruleId());
        assertEquals("1.0", signal.ruleVersion()); // Default version
        assertEquals(Signal.SignalSeverity.MEDIUM, signal.severity()); // Default severity
    }

    @Test
    @DisplayName("Should handle all severity levels")
    void testAllSeverityLevels() throws Exception {
        Signal.SignalSeverity[] severities = Signal.SignalSeverity.values();

        for (Signal.SignalSeverity severity : severities) {
            String json = String.format("""
                {
                    "ruleId": "rule-sev",
                    "spanId": "span-sev",
                    "traceId": "trace-sev",
                    "severity": "%s",
                    "message": "Test %s severity",
                    "attributes": {},
                    "source": "test",
                    "tenantId": "tenant-sev"
                }
                """, severity.name(), severity.name());

            Exchange testExchange = new DefaultExchange(context);
            testExchange.getIn().setBody(json);
            transformer.transform(testExchange.getIn(), null, null);

            Signal signal = testExchange.getIn().getBody(Signal.class);
            assertEquals(severity, signal.severity(), "Failed for severity: " + severity);
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
    @DisplayName("Should handle complex nested attributes")
    void testComplexAttributes() throws Exception {
        String json = """
            {
                "ruleId": "rule-complex",
                "spanId": "span-complex",
                "traceId": "trace-complex",
                "severity": "LOW",
                "message": "Complex attributes test",
                "attributes": {
                    "metrics": {
                        "cpu": 45.5,
                        "memory": 67.8
                    },
                    "tags": ["production", "critical"],
                    "enabled": true,
                    "count": 42
                },
                "source": "complex-system",
                "tenantId": "tenant-complex"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertNotNull(signal);
        assertNotNull(signal.attributes());

        @SuppressWarnings("unchecked")
        Map<String, Object> metrics = (Map<String, Object>) signal.attributes().get("metrics");
        assertNotNull(metrics);
        assertEquals(45.5, metrics.get("cpu"));
        assertEquals(67.8, metrics.get("memory"));

        assertTrue(signal.attributes().get("enabled") instanceof Boolean);
        assertEquals(true, signal.attributes().get("enabled"));
        assertEquals(42, signal.attributes().get("count"));
    }

    @Test
    @DisplayName("Should handle missing attributes gracefully")
    void testMissingAttributes() throws Exception {
        String json = """
            {
                "ruleId": "rule-no-attr",
                "spanId": "span-no-attr",
                "traceId": "trace-no-attr",
                "message": "No attributes",
                "source": "test",
                "tenantId": "tenant-no-attr"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertNotNull(signal);
        // attributes() should return empty map when not present in JSON
        assertNotNull(signal.attributes());
        assertTrue(signal.attributes().isEmpty());
    }

    @Test
    @DisplayName("Should preserve special characters in strings")
    void testSpecialCharacters() throws Exception {
        String json = """
            {
                "ruleId": "rule-special",
                "spanId": "span-special",
                "traceId": "trace-special",
                "severity": "HIGH",
                "message": "Test with special chars: \\n\\t\\r and unicode: \\u2764",
                "attributes": {
                    "path": "/usr/local/bin",
                    "query": "field='value' AND status=\\"active\\""
                },
                "source": "special-source",
                "tenantId": "tenant-special"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertNotNull(signal);
        assertTrue(signal.message().contains("\n"));
        assertTrue(signal.message().contains("\t"));
        assertEquals("/usr/local/bin", signal.attributes().get("path"));
    }

    @Test
    @DisplayName("Should handle very large JSON")
    void testLargeJson() throws Exception {
        StringBuilder jsonBuilder = new StringBuilder();
        jsonBuilder.append("""
            {
                "ruleId": "rule-large",
                "spanId": "span-large",
                "traceId": "trace-large",
                "severity": "MEDIUM",
                "message": "Large attributes test",
                "attributes": {
            """);

        // Add many attributes
        for (int i = 0; i < 100; i++) {
            if (i > 0) jsonBuilder.append(",");
            jsonBuilder.append(String.format("\"field%d\": \"value%d\"", i, i));
        }

        jsonBuilder.append("""
                },
                "source": "large-system",
                "tenantId": "tenant-large"
            }
            """);

        exchange.getIn().setBody(jsonBuilder.toString());
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertNotNull(signal);
        assertEquals(100, signal.attributes().size());
        assertEquals("value50", signal.attributes().get("field50"));
    }

}