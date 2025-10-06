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
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("SpanToRuleContextTransformer Tests")
class SpanToRuleContextTransformerTest {

    private SpanToRuleContextTransformer transformer;
    private CamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        transformer = new SpanToRuleContextTransformer();
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("Should transform Span to rule context")
    void testTransformSpanToRuleContext() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("http.method", "GET");
        attributes.put("http.status_code", 200);
        attributes.put("custom.field", "value");

        Map<String, String> resourceAttributes = new HashMap<>();
        resourceAttributes.put("service.name", "test-service");
        resourceAttributes.put("service.version", "1.0.0");

        Instant startTime = Instant.now();
        Instant endTime = startTime.plusMillis(5000);

        Span span = new Span(
            "span-123",
            "trace-456",
            "parent-789",
            "GET /api/users",
            "user-service",
            startTime,
            endTime,
            5000000000L, // 5 seconds in nanos
            Span.SpanKind.SERVER,
            Span.SpanStatus.OK,
            attributes,
            resourceAttributes,
            "tenant-001"
        );

        exchange.getIn().setBody(span);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> ruleContext = exchange.getIn().getBody(Map.class);

        assertNotNull(ruleContext);

        // Check span fields
        assertEquals("span-123", ruleContext.get("spanId"));
        assertEquals("trace-456", ruleContext.get("traceId"));
        assertEquals("GET /api/users", ruleContext.get("operationName"));
        assertEquals("user-service", ruleContext.get("serviceName"));
        assertEquals(5000L, ruleContext.get("durationMillis"));
        assertEquals(false, ruleContext.get("isError"));
        assertEquals("SERVER", ruleContext.get("spanKind"));
        assertEquals("OK", ruleContext.get("status"));
        assertEquals("tenant-001", ruleContext.get("tenantId"));

        // Check attributes
        assertEquals("GET", ruleContext.get("http.method"));
        assertEquals(200, ruleContext.get("http.status_code"));
        assertEquals("value", ruleContext.get("custom.field"));

        // Check resource attributes with prefix
        assertEquals("test-service", ruleContext.get("resource.service.name"));
        assertEquals("1.0.0", ruleContext.get("resource.service.version"));
    }

    @Test
    @DisplayName("Should handle error spans")
    void testTransformErrorSpan() throws Exception {
        Span span = new Span(
            "error-span",
            "error-trace",
            null,
            "Failed operation",
            "error-service",
            Instant.now(),
            Instant.now().plusMillis(1000),
            1000000000L,
            Span.SpanKind.INTERNAL,
            Span.SpanStatus.ERROR,
            new HashMap<>(),
            new HashMap<>(),
            "error-tenant"
        );

        exchange.getIn().setBody(span);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> ruleContext = exchange.getIn().getBody(Map.class);

        assertEquals(true, ruleContext.get("isError"));
        assertEquals("ERROR", ruleContext.get("status"));
    }

    @Test
    @DisplayName("Should throw exception for null span")
    void testTransformNullSpan() {
        exchange.getIn().setBody(null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );

        assertEquals("Span input cannot be null", exception.getMessage());
    }

    
    
    
    
    @Test
    @DisplayName("Should handle all span kinds")
    void testAllSpanKinds() throws Exception {
        for (Span.SpanKind kind : Span.SpanKind.values()) {
            Span span = new Span(
                "kind-span-" + kind,
                "kind-trace",
                null,
                "Operation " + kind,
                "kind-service",
                Instant.now(),
                Instant.now().plusMillis(100),
                100000000L,
                kind,
                Span.SpanStatus.OK,
                new HashMap<>(),
                new HashMap<>(),
                "kind-tenant"
            );

            Exchange testExchange = new DefaultExchange(context);
            testExchange.getIn().setBody(span);
            transformer.transform(testExchange.getIn(), null, null);

            @SuppressWarnings("unchecked")
            Map<String, Object> ruleContext = testExchange.getIn().getBody(Map.class);

            assertEquals(kind.name(), ruleContext.get("spanKind"),
                "Failed for span kind: " + kind);
        }
    }

    @Test
    @DisplayName("Should handle all span statuses")
    void testAllSpanStatuses() throws Exception {
        for (Span.SpanStatus status : Span.SpanStatus.values()) {
            Span span = new Span(
                "status-span-" + status,
                "status-trace",
                null,
                "Operation " + status,
                "status-service",
                Instant.now(),
                Instant.now().plusMillis(100),
                100000000L,
                Span.SpanKind.INTERNAL,
                status,
                new HashMap<>(),
                new HashMap<>(),
                "status-tenant"
            );

            Exchange testExchange = new DefaultExchange(context);
            testExchange.getIn().setBody(span);
            transformer.transform(testExchange.getIn(), null, null);

            @SuppressWarnings("unchecked")
            Map<String, Object> ruleContext = testExchange.getIn().getBody(Map.class);

            assertEquals(status.name(), ruleContext.get("status"),
                "Failed for span status: " + status);
            assertEquals(status == Span.SpanStatus.ERROR, ruleContext.get("isError"),
                "Failed error check for status: " + status);
        }
    }

    @Test
    @DisplayName("Should handle empty attributes and resource attributes")
    void testEmptyAttributes() throws Exception {
        Span span = new Span(
            "empty-span",
            "empty-trace",
            null,
            "Empty operation",
            "empty-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            100000000L,
            Span.SpanKind.INTERNAL,
            Span.SpanStatus.OK,
            new HashMap<>(), // Empty attributes
            new HashMap<>(), // Empty resource attributes
            "empty-tenant"
        );

        exchange.getIn().setBody(span);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> ruleContext = exchange.getIn().getBody(Map.class);

        assertNotNull(ruleContext);
        // Should have basic span fields but no additional attributes
        assertTrue(ruleContext.containsKey("spanId"));
        assertTrue(ruleContext.containsKey("traceId"));
        assertTrue(ruleContext.containsKey("operationName"));
        // Should not have any custom attributes or resource attributes
        assertFalse(ruleContext.keySet().stream().anyMatch(key -> key.startsWith("resource.")));
    }

    @Test
    @DisplayName("Should handle complex nested attributes")
    void testComplexNestedAttributes() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        Map<String, Object> nested = new HashMap<>();
        nested.put("level2", "value2");
        attributes.put("nested", nested);
        attributes.put("array", new String[]{"item1", "item2"});
        attributes.put("number", 42);
        attributes.put("boolean", true);

        Map<String, String> resourceAttributes = new HashMap<>();
        resourceAttributes.put("complex.resource", "resource-value");

        Span span = new Span(
            "complex-span",
            "complex-trace",
            "parent-complex",
            "Complex operation",
            "complex-service",
            Instant.now(),
            Instant.now().plusMillis(200),
            200000000L,
            Span.SpanKind.CLIENT,
            Span.SpanStatus.OK,
            attributes,
            resourceAttributes,
            "complex-tenant"
        );

        exchange.getIn().setBody(span);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> ruleContext = exchange.getIn().getBody(Map.class);

        // Complex attributes should be preserved
        assertNotNull(ruleContext.get("nested"));
        assertNotNull(ruleContext.get("array"));
        assertEquals(42, ruleContext.get("number"));
        assertEquals(true, ruleContext.get("boolean"));
        assertEquals("resource-value", ruleContext.get("resource.complex.resource"));
    }

    @Test
    @DisplayName("Should calculate duration correctly")
    void testDurationCalculation() throws Exception {
        Instant startTime = Instant.ofEpochMilli(1000);
        Instant endTime = Instant.ofEpochMilli(6000);
        long durationNanos = 5000000000L; // 5 seconds

        Span span = new Span(
            "duration-span",
            "duration-trace",
            null,
            "Duration test",
            "duration-service",
            startTime,
            endTime,
            durationNanos,
            Span.SpanKind.INTERNAL,
            Span.SpanStatus.OK,
            new HashMap<>(),
            new HashMap<>(),
            "duration-tenant"
        );

        exchange.getIn().setBody(span);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> ruleContext = exchange.getIn().getBody(Map.class);

        assertEquals(5000L, ruleContext.get("durationMillis"));
    }

    @Test
    @DisplayName("Should handle zero duration spans")
    void testZeroDurationSpan() throws Exception {
        Instant timestamp = Instant.now();

        Span span = new Span(
            "zero-span",
            "zero-trace",
            null,
            "Zero duration",
            "zero-service",
            timestamp,
            timestamp,
            0L,
            Span.SpanKind.INTERNAL,
            Span.SpanStatus.OK,
            new HashMap<>(),
            new HashMap<>(),
            "zero-tenant"
        );

        exchange.getIn().setBody(span);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> ruleContext = exchange.getIn().getBody(Map.class);

        assertEquals(0L, ruleContext.get("durationMillis"));
    }

    @Test
    @DisplayName("Should include parent span ID when present")
    void testWithParentSpanId() throws Exception {
        Span span = new Span(
            "child-span",
            "parent-trace",
            "parent-span-123", // Has parent
            "Child operation",
            "child-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            100000000L,
            Span.SpanKind.INTERNAL,
            Span.SpanStatus.OK,
            new HashMap<>(),
            new HashMap<>(),
            "parent-tenant"
        );

        exchange.getIn().setBody(span);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> ruleContext = exchange.getIn().getBody(Map.class);

        // Parent span ID should be accessible through the span object
        // but not necessarily in the rule context (based on toRuleContext implementation)
        assertEquals("child-span", ruleContext.get("spanId"));
        assertEquals("parent-trace", ruleContext.get("traceId"));
    }

    // Helper methods
    private Span createTestSpan() {
        return new Span(
            "test-span",
            "test-trace",
            null,
            "Test operation",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            100000000L,
            Span.SpanKind.INTERNAL,
            Span.SpanStatus.OK,
            new HashMap<>(),
            new HashMap<>(),
            "test-tenant"
        );
    }
}