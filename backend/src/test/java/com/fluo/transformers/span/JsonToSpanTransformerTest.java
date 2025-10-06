package com.fluo.transformers.span;

import com.fluo.model.Span;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.spi.DataType;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("JsonToSpanTransformer Tests")
class JsonToSpanTransformerTest {

    private JsonToSpanTransformer transformer;
    private CamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        transformer = new JsonToSpanTransformer();
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("Should transform valid JSON to Span")
    void testTransformValidJson() throws Exception {
        long startTime = System.currentTimeMillis();
        long endTime = startTime + 5000;

        String json = String.format("""
            {
                "spanId": "span-123",
                "traceId": "trace-456",
                "operationName": "GET /api/users",
                "serviceName": "user-service",
                "startTime": %d,
                "endTime": %d,
                "attributes": {
                    "http.method": "GET",
                    "http.status_code": 200,
                    "http.url": "/api/users",
                    "custom.field": "value"
                },
                "tenantId": "tenant-789"
            }
            """, startTime, endTime);

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span);
        assertEquals("span-123", span.spanId());
        assertEquals("trace-456", span.traceId());
        assertEquals("GET /api/users", span.operationName());
        assertEquals("user-service", span.serviceName());
        assertEquals(startTime, span.startTime().toEpochMilli());
        assertEquals(endTime, span.endTime().toEpochMilli());
        assertEquals("tenant-789", span.tenantId());

        assertNotNull(span.attributes());
        assertEquals("GET", span.attributes().get("http.method"));
        assertEquals(200, span.attributes().get("http.status_code"));
        assertEquals("/api/users", span.attributes().get("http.url"));
        assertEquals("value", span.attributes().get("custom.field"));
    }

    @Test
    @DisplayName("Should handle minimal JSON with defaults")
    void testTransformMinimalJson() throws Exception {
        long timestamp = System.currentTimeMillis();

        String json = String.format("""
            {
                "spanId": "min-span",
                "traceId": "min-trace",
                "operationName": "minimal",
                "serviceName": "min-service",
                "startTime": %d,
                "endTime": %d,
                "attributes": {},
                "tenantId": "min-tenant"
            }
            """, timestamp, timestamp + 1000);

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span);
        assertEquals("min-span", span.spanId());
        assertEquals("min-trace", span.traceId());
        assertEquals("minimal", span.operationName());
        assertEquals("min-service", span.serviceName());
        assertNotNull(span.attributes());
        assertTrue(span.attributes().isEmpty());

        // Check defaults from Span.create
        assertEquals(Span.SpanKind.INTERNAL, span.kind());
        assertEquals(Span.SpanStatus.OK, span.status());
        assertNull(span.parentSpanId());
        assertNotNull(span.resourceAttributes());
        assertTrue(span.resourceAttributes().isEmpty());
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
                "spanId": "complex-span",
                "traceId": "complex-trace",
                "operationName": "POST /api/orders",
                "serviceName": "order-service",
                "startTime": 1000000,
                "endTime": 1005000,
                "attributes": {
                    "http.request": {
                        "method": "POST",
                        "url": "/api/orders",
                        "headers": {
                            "content-type": "application/json",
                            "authorization": "Bearer token"
                        }
                    },
                    "order": {
                        "id": "order-123",
                        "total": 99.99,
                        "items": ["item1", "item2", "item3"]
                    },
                    "metrics": {
                        "db.query.time": 45,
                        "cache.hit.ratio": 0.85
                    },
                    "tags": ["production", "critical"],
                    "enabled": true,
                    "count": 42
                },
                "tenantId": "complex-tenant"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span);
        assertNotNull(span.attributes());

        @SuppressWarnings("unchecked")
        Map<String, Object> httpRequest = (Map<String, Object>) span.attributes().get("http.request");
        assertNotNull(httpRequest);
        assertEquals("POST", httpRequest.get("method"));

        @SuppressWarnings("unchecked")
        Map<String, Object> order = (Map<String, Object>) span.attributes().get("order");
        assertNotNull(order);
        assertEquals("order-123", order.get("id"));
        assertEquals(99.99, order.get("total"));

        assertTrue(span.attributes().get("enabled") instanceof Boolean);
        assertEquals(true, span.attributes().get("enabled"));
        assertEquals(42, span.attributes().get("count"));
    }

    @Test
    @DisplayName("Should calculate duration correctly")
    void testDurationCalculation() throws Exception {
        long startTime = 1000000; // 1 second in millis
        long endTime = 1005000;   // 1.005 seconds in millis

        String json = String.format("""
            {
                "spanId": "duration-span",
                "traceId": "duration-trace",
                "operationName": "duration-test",
                "serviceName": "duration-service",
                "startTime": %d,
                "endTime": %d,
                "attributes": {},
                "tenantId": "duration-tenant"
            }
            """, startTime, endTime);

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span);

        // Duration should be calculated correctly
        long expectedDurationNanos = (endTime - startTime) * 1_000_000L;
        assertEquals(expectedDurationNanos, span.durationNanos());
        assertEquals(5000, span.durationMillis()); // 5000 ms = 5 seconds
    }

    @Test
    @DisplayName("Should handle missing optional fields")
    void testMissingOptionalFields() throws Exception {
        // Test with missing non-critical fields that should default to empty/null
        String json = """
            {
                "spanId": "no-attr-span",
                "traceId": "no-attr-trace",
                "operationName": "no-attributes",
                "serviceName": "no-attr-service",
                "startTime": 1000,
                "endTime": 2000,
                "tenantId": "no-attr-tenant"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span);
        assertNotNull(span.attributes());
        // When attributes field is missing, it should be converted to an empty map
        assertTrue(span.attributes().isEmpty());
    }

    @Test
    @DisplayName("Should handle special characters in strings")
    void testSpecialCharacters() throws Exception {
        String json = """
            {
                "spanId": "special-span",
                "traceId": "special-trace",
                "operationName": "GET /api/users\\n\\t\\r",
                "serviceName": "service-with-special-chars: \\u2764",
                "startTime": 1000,
                "endTime": 2000,
                "attributes": {
                    "path": "/usr/local/bin",
                    "query": "field='value' AND status=\\"active\\"",
                    "unicode": "Test \\u2764 emoji"
                },
                "tenantId": "special-tenant"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span);
        assertTrue(span.operationName().contains("\n"));
        assertTrue(span.operationName().contains("\t"));
        assertEquals("/usr/local/bin", span.attributes().get("path"));
        assertNotNull(span.attributes().get("unicode"));
    }

    @Test
    @DisplayName("Should handle very large attributes map")
    void testLargeAttributesMap() throws Exception {
        StringBuilder jsonBuilder = new StringBuilder();
        jsonBuilder.append("""
            {
                "spanId": "large-span",
                "traceId": "large-trace",
                "operationName": "large-operation",
                "serviceName": "large-service",
                "startTime": 1000,
                "endTime": 2000,
                "attributes": {
            """);

        // Add many attributes
        for (int i = 0; i < 100; i++) {
            if (i > 0) jsonBuilder.append(",");
            jsonBuilder.append(String.format("\n    \"field%d\": \"value%d\"", i, i));
        }

        jsonBuilder.append("""
                },
                "tenantId": "large-tenant"
            }
            """);

        exchange.getIn().setBody(jsonBuilder.toString());
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span);
        assertEquals(100, span.attributes().size());
        assertEquals("value50", span.attributes().get("field50"));
    }

    @Test
    @DisplayName("Should handle zero duration spans")
    void testZeroDurationSpan() throws Exception {
        long timestamp = 1000000;

        String json = String.format("""
            {
                "spanId": "zero-duration",
                "traceId": "zero-trace",
                "operationName": "instant-operation",
                "serviceName": "instant-service",
                "startTime": %d,
                "endTime": %d,
                "attributes": {},
                "tenantId": "zero-tenant"
            }
            """, timestamp, timestamp);

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span);
        assertEquals(0, span.durationNanos());
        assertEquals(0, span.durationMillis());
    }

    @Test
    @DisplayName("Should preserve numeric types in attributes")
    void testNumericAttributeTypes() throws Exception {
        String json = """
            {
                "spanId": "numeric-span",
                "traceId": "numeric-trace",
                "operationName": "numeric-test",
                "serviceName": "numeric-service",
                "startTime": 1000,
                "endTime": 2000,
                "attributes": {
                    "int_value": 42,
                    "long_value": 9223372036854775807,
                    "float_value": 3.14,
                    "double_value": 2.71828,
                    "boolean_value": true,
                    "null_value": null
                },
                "tenantId": "numeric-tenant"
            }
            """;

        exchange.getIn().setBody(json);
        transformer.transform(exchange.getIn(), null, null);

        Span span = exchange.getIn().getBody(Span.class);
        assertNotNull(span.attributes());

        // Jackson should preserve numeric types
        assertEquals(42, span.attributes().get("int_value"));
        assertNotNull(span.attributes().get("long_value"));
        assertNotNull(span.attributes().get("float_value"));
        assertNotNull(span.attributes().get("double_value"));
        assertEquals(true, span.attributes().get("boolean_value"));
        assertNull(span.attributes().get("null_value"));
    }
}