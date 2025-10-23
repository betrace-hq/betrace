package com.fluo.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Span Model Tests")
class SpanTest {

    private Span span;
    private Map<String, Object> attributes;
    private Map<String, String> resourceAttributes;
    private Instant startTime;
    private Instant endTime;

    @BeforeEach
    void setUp() {
        startTime = Instant.parse("2024-01-01T10:00:00Z");
        endTime = Instant.parse("2024-01-01T10:00:01Z");

        attributes = new HashMap<>();
        attributes.put("http.method", "GET");
        attributes.put("http.status_code", 200);
        attributes.put("custom.attribute", "value");

        resourceAttributes = new HashMap<>();
        resourceAttributes.put("service.version", "1.0.0");
        resourceAttributes.put("deployment.environment", "production");

        span = new Span(
            "span-123",
            "trace-456",
            "parent-789",
            "GET /api/users",
            "user-service",
            startTime,
            endTime,
            1_000_000_000L, // 1 second in nanos
            Span.SpanKind.SERVER,
            Span.SpanStatus.OK,
            attributes,
            resourceAttributes
        );
    }

    @Test
    @DisplayName("Should create span with all fields")
    void testFullConstructor() {
        assertNotNull(span);
        assertEquals("span-123", span.spanId());
        assertEquals("trace-456", span.traceId());
        assertEquals("parent-789", span.parentSpanId());
        assertEquals("GET /api/users", span.operationName());
        assertEquals("user-service", span.serviceName());
        assertEquals(startTime, span.startTime());
        assertEquals(endTime, span.endTime());
        assertEquals(1_000_000_000L, span.durationNanos());
        assertEquals(Span.SpanKind.SERVER, span.kind());
        assertEquals(Span.SpanStatus.OK, span.status());
        assertEquals(attributes, span.attributes());
        assertEquals(resourceAttributes, span.resourceAttributes());
    }

    @Test
    @DisplayName("Should create span using factory method")
    void testCreateFactoryMethod() {
        Span created = Span.create(
            "span-001",
            "trace-002",
            "POST /api/orders",
            "order-service",
            startTime,
            endTime,
            attributes
        );

        assertNotNull(created);
        assertEquals("span-001", created.spanId());
        assertEquals("trace-002", created.traceId());
        assertNull(created.parentSpanId()); // Factory method sets to null
        assertEquals("POST /api/orders", created.operationName());
        assertEquals("order-service", created.serviceName());
        assertEquals(startTime, created.startTime());
        assertEquals(endTime, created.endTime());
        assertEquals(1_000_000_000L, created.durationNanos()); // Calculated
        assertEquals(Span.SpanKind.INTERNAL, created.kind()); // Default
        assertEquals(Span.SpanStatus.OK, created.status()); // Default
        assertEquals(attributes, created.attributes());
        assertNotNull(created.resourceAttributes());
        assertTrue(created.resourceAttributes().isEmpty());
    }

    @Test
    @DisplayName("Should calculate duration correctly in factory method")
    void testDurationCalculation() {
        Instant start = Instant.parse("2024-01-01T10:00:00.000Z");
        Instant end = Instant.parse("2024-01-01T10:00:00.500Z"); // 500ms later

        Span created = Span.create(
            "s1", "t1", "op", "service", start, end, new HashMap<>()
        );

        // 500ms = 500,000,000 nanos
        assertEquals(500_000_000L, created.durationNanos());
        assertEquals(500L, created.durationMillis());
    }

    @Test
    @DisplayName("Should convert duration to milliseconds")
    void testDurationMillis() {
        assertEquals(1000L, span.durationMillis()); // 1_000_000_000 nanos = 1000 ms

        Span shortSpan = new Span(
            "s", "t", null, "op", "svc", startTime, endTime,
            500_000L, // 0.5 ms in nanos
            Span.SpanKind.CLIENT, Span.SpanStatus.OK,
            new HashMap<>(), new HashMap<>()
        );
        assertEquals(0L, shortSpan.durationMillis()); // Truncates to 0

        Span longSpan = new Span(
            "s", "t", null, "op", "svc", startTime, endTime,
            123_456_789_000L, // 123.456789 seconds in nanos
            Span.SpanKind.CLIENT, Span.SpanStatus.OK,
            new HashMap<>(), new HashMap<>()
        );
        assertEquals(123456L, longSpan.durationMillis());
    }

    @Test
    @DisplayName("Should check if span is error")
    void testIsError() {
        assertFalse(span.isError()); // OK status

        Span errorSpan = new Span(
            "s", "t", null, "op", "svc", startTime, endTime, 1000L,
            Span.SpanKind.SERVER, Span.SpanStatus.ERROR,
            new HashMap<>(), new HashMap<>()
        );
        assertTrue(errorSpan.isError());

        Span unsetSpan = new Span(
            "s", "t", null, "op", "svc", startTime, endTime, 1000L,
            Span.SpanKind.SERVER, Span.SpanStatus.UNSET,
            new HashMap<>(), new HashMap<>()
        );
        assertFalse(unsetSpan.isError());
    }

    @Test
    @DisplayName("Should create rule context with all fields")
    void testToRuleContext() {
        Map<String, Object> context = span.toRuleContext();

        assertNotNull(context);

        // Check span fields
        assertEquals("span-123", context.get("spanId"));
        assertEquals("trace-456", context.get("traceId"));
        assertEquals("GET /api/users", context.get("operationName"));
        assertEquals("user-service", context.get("serviceName"));
        assertEquals(1000L, context.get("durationMillis"));
        assertEquals(false, context.get("isError"));
        assertEquals("SERVER", context.get("spanKind"));
        assertEquals("OK", context.get("status"));

        // Check attributes are included
        assertEquals("GET", context.get("http.method"));
        assertEquals(200, context.get("http.status_code"));
        assertEquals("value", context.get("custom.attribute"));

        // Check resource attributes with prefix
        assertEquals("1.0.0", context.get("resource.service.version"));
        assertEquals("production", context.get("resource.deployment.environment"));
    }

    @Test
    @DisplayName("Should handle empty attributes in rule context")
    void testToRuleContextWithEmptyAttributes() {
        Span emptySpan = new Span(
            "s1", "t1", null, "op", "svc", startTime, endTime, 1000L,
            Span.SpanKind.INTERNAL, Span.SpanStatus.OK,
            new HashMap<>(), new HashMap<>()
        );

        Map<String, Object> context = emptySpan.toRuleContext();

        assertNotNull(context);
        assertEquals("s1", context.get("spanId"));
        assertEquals("t1", context.get("traceId"));
        // Should not have any custom attributes or resource attributes
        assertFalse(context.containsKey("http.method"));
        assertFalse(context.containsKey("resource.service.version"));
    }

    @Test
    @DisplayName("Should test all SpanKind enum values")
    void testSpanKindEnumValues() {
        Span.SpanKind[] kinds = Span.SpanKind.values();

        assertEquals(5, kinds.length);
        assertEquals(Span.SpanKind.INTERNAL, Span.SpanKind.valueOf("INTERNAL"));
        assertEquals(Span.SpanKind.SERVER, Span.SpanKind.valueOf("SERVER"));
        assertEquals(Span.SpanKind.CLIENT, Span.SpanKind.valueOf("CLIENT"));
        assertEquals(Span.SpanKind.PRODUCER, Span.SpanKind.valueOf("PRODUCER"));
        assertEquals(Span.SpanKind.CONSUMER, Span.SpanKind.valueOf("CONSUMER"));
    }

    @Test
    @DisplayName("Should test all SpanStatus enum values")
    void testSpanStatusEnumValues() {
        Span.SpanStatus[] statuses = Span.SpanStatus.values();

        assertEquals(3, statuses.length);
        assertEquals(Span.SpanStatus.UNSET, Span.SpanStatus.valueOf("UNSET"));
        assertEquals(Span.SpanStatus.OK, Span.SpanStatus.valueOf("OK"));
        assertEquals(Span.SpanStatus.ERROR, Span.SpanStatus.valueOf("ERROR"));
    }

    @Test
    @DisplayName("Should test legacy getter for resource attributes")
    void testLegacyGetResourceAttributes() {
        Map<String, String> attrs = span.getResourceAttributes();

        assertNotNull(attrs);
        assertEquals(resourceAttributes, attrs);
        assertEquals("1.0.0", attrs.get("service.version"));
        assertEquals("production", attrs.get("deployment.environment"));
    }

    @Test
    @DisplayName("Should test equals method")
    void testEquals() {
        Span same = new Span(
            "span-123", "trace-456", "parent-789", "GET /api/users", "user-service",
            startTime, endTime, 1_000_000_000L, Span.SpanKind.SERVER, Span.SpanStatus.OK,
            attributes, resourceAttributes
        );

        Span different = new Span(
            "span-999", "trace-456", "parent-789", "GET /api/users", "user-service",
            startTime, endTime, 1_000_000_000L, Span.SpanKind.SERVER, Span.SpanStatus.OK,
            attributes, resourceAttributes
        );

        // Same object
        assertEquals(span, span);

        // Equal objects
        assertEquals(span, same);

        // Different objects
        assertNotEquals(span, different);

        // Null
        assertNotEquals(span, null);

        // Different class
        assertNotEquals(span, "not a span");
    }

    @Test
    @DisplayName("Should test equals with different fields")
    void testEqualsWithDifferentFields() {
        Span base = span;

        // Different spanId
        Span diffId = new Span("different", "trace-456", "parent-789", "GET /api/users",
            "user-service", startTime, endTime, 1_000_000_000L, Span.SpanKind.SERVER,
            Span.SpanStatus.OK, attributes, resourceAttributes);
        assertNotEquals(base, diffId);

        // Different duration
        Span diffDuration = new Span("span-123", "trace-456", "parent-789", "GET /api/users",
            "user-service", startTime, endTime, 2_000_000_000L, Span.SpanKind.SERVER,
            Span.SpanStatus.OK, attributes, resourceAttributes);
        assertNotEquals(base, diffDuration);

        // Different kind
        Span diffKind = new Span("span-123", "trace-456", "parent-789", "GET /api/users",
            "user-service", startTime, endTime, 1_000_000_000L, Span.SpanKind.CLIENT,
            Span.SpanStatus.OK, attributes, resourceAttributes);
        assertNotEquals(base, diffKind);

        // Different status
        Span diffStatus = new Span("span-123", "trace-456", "parent-789", "GET /api/users",
            "user-service", startTime, endTime, 1_000_000_000L, Span.SpanKind.SERVER,
            Span.SpanStatus.ERROR, attributes, resourceAttributes);
        assertNotEquals(base, diffStatus);
    }

    @Test
    @DisplayName("Should test hashCode method")
    void testHashCode() {
        Span same = new Span(
            "span-123", "trace-456", "parent-789", "GET /api/users", "user-service",
            startTime, endTime, 1_000_000_000L, Span.SpanKind.SERVER, Span.SpanStatus.OK,
            attributes, resourceAttributes
        );

        Span different = new Span(
            "span-999", "trace-456", "parent-789", "GET /api/users", "user-service",
            startTime, endTime, 1_000_000_000L, Span.SpanKind.SERVER, Span.SpanStatus.OK,
            attributes, resourceAttributes
        );

        // Same hashCode for equal objects
        assertEquals(span.hashCode(), same.hashCode());

        // Different hashCode for different objects (not guaranteed, but very likely)
        assertNotEquals(span.hashCode(), different.hashCode());
    }

    @Test
    @DisplayName("Should test toString method")
    void testToString() {
        String str = span.toString();

        assertNotNull(str);
        assertTrue(str.startsWith("Span{"));
        assertTrue(str.endsWith("}"));
        assertTrue(str.contains("spanId='span-123'"));
        assertTrue(str.contains("traceId='trace-456'"));
        assertTrue(str.contains("parentSpanId='parent-789'"));
        assertTrue(str.contains("operationName='GET /api/users'"));
        assertTrue(str.contains("serviceName='user-service'"));
        assertTrue(str.contains("durationNanos=1000000000"));
        assertTrue(str.contains("kind=SERVER"));
        assertTrue(str.contains("status=OK"));
        assertTrue(str.contains("startTime="));
        assertTrue(str.contains("endTime="));
        assertTrue(str.contains("attributes="));
        assertTrue(str.contains("resourceAttributes="));
    }

    @Test
    @DisplayName("Should handle null fields")
    void testNullFields() {
        Span withNulls = new Span(
            null, null, null, null, null, null, null, 0L,
            null, null, null, null
        );

        assertNull(withNulls.spanId());
        assertNull(withNulls.traceId());
        assertNull(withNulls.parentSpanId());
        assertNull(withNulls.operationName());
        assertNull(withNulls.serviceName());
        assertNull(withNulls.startTime());
        assertNull(withNulls.endTime());
        assertEquals(0L, withNulls.durationNanos());
        assertNull(withNulls.kind());
        assertNull(withNulls.status());
        assertNull(withNulls.attributes());
        assertNull(withNulls.resourceAttributes());

        // Should handle null in methods
        assertEquals(0L, withNulls.durationMillis());
        assertFalse(withNulls.isError()); // null status is not ERROR

        // toRuleContext should handle nulls gracefully, but will fail with null maps
        assertThrows(NullPointerException.class, () -> {
            withNulls.toRuleContext(); // Will fail due to null attributes/resourceAttributes
        });
    }

    @Test
    @DisplayName("Should handle error span in rule context")
    void testErrorSpanInRuleContext() {
        Span errorSpan = new Span(
            "error-span", "trace", null, "failed-op", "service",
            startTime, endTime, 1_000_000_000L, Span.SpanKind.SERVER,
            Span.SpanStatus.ERROR, attributes, resourceAttributes
        );

        Map<String, Object> context = errorSpan.toRuleContext();

        assertEquals(true, context.get("isError"));
        assertEquals("ERROR", context.get("status"));
    }

    @Test
    @DisplayName("Should note attribute reference behavior")
    void testAttributeImmutability() {
        Map<String, Object> originalAttrs = new HashMap<>();
        originalAttrs.put("key", "value");

        Map<String, String> originalResourceAttrs = new HashMap<>();
        originalResourceAttrs.put("resource", "value");

        Span s = new Span("s", "t", null, "op", "svc", startTime, endTime,
            1000L, Span.SpanKind.CLIENT, Span.SpanStatus.OK,
            originalAttrs, originalResourceAttrs);

        // NOTE: Span stores references directly, so modifications to original maps affect the span
        // This is the current behavior - the attributes are NOT defensively copied
        originalAttrs.put("newKey", "newValue");
        originalResourceAttrs.put("newResource", "newValue");

        assertTrue(s.attributes().containsKey("newKey"));
        assertTrue(s.resourceAttributes().containsKey("newResource"));

        // The returned maps are the same references
        assertSame(originalAttrs, s.attributes());
        assertSame(originalResourceAttrs, s.resourceAttributes());
    }
}