package com.fluo.routes;

import org.apache.camel.CamelContext;
import org.apache.camel.impl.DefaultCamelContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("SpanApiRoute Tests")
class SpanApiRouteTest {

    private CamelContext context;
    private SpanApiRoute spanApiRoute;

    @BeforeEach
    void setUp() throws Exception {
        context = new DefaultCamelContext();
        spanApiRoute = new SpanApiRoute();
        context.addRoutes(spanApiRoute);
        context.start();
    }

    @AfterEach
    void tearDown() throws Exception {
        if (context != null) {
            context.stop();
        }
    }

    @Test
    @DisplayName("Should create SpanApiRoute instance")
    void testSpanApiRouteCreation() {
        assertNotNull(spanApiRoute);
    }

    @Test
    @DisplayName("Should configure routes successfully")
    void testRouteConfiguration() throws Exception {
        assertTrue(context.getRoutes().size() > 0);
        assertEquals("Started", context.getStatus().name());
    }

    @Test
    @DisplayName("Should have all expected span endpoints")
    void testSpanEndpoints() throws Exception {
        assertTrue(context.hasEndpoint("direct:ingestSpans") != null);
        assertTrue(context.hasEndpoint("direct:batchIngestSpans") != null);
        assertTrue(context.hasEndpoint("direct:getSpan") != null);
        assertTrue(context.hasEndpoint("direct:getSpansByTrace") != null);
    }

    @Test
    @DisplayName("Should have correct route IDs")
    void testRouteIds() throws Exception {
        assertNotNull(context.getRoute("ingestSpans"));
        assertNotNull(context.getRoute("batchIngestSpans"));
        assertNotNull(context.getRoute("getSpan"));
        assertNotNull(context.getRoute("getSpansByTrace"));
    }

    @Test
    @DisplayName("Should ingest single span successfully")
    void testIngestSingleSpan() throws Exception {
        Map<String, Object> spanData = createTestSpan();

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:ingestSpans", spanData, Map.class);

        assertNotNull(response);
        assertEquals("accepted", response.get("status"));
        assertNotNull(response.get("spanId"));
        assertNotNull(response.get("timestamp"));
    }

    @Test
    @DisplayName("Should handle null span in single ingestion")
    void testIngestNullSpan() throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:ingestSpans", null, Map.class);

        assertNotNull(response);
        assertEquals("accepted", response.get("status"));
        assertNull(response.get("spanId"));
        assertNotNull(response.get("timestamp"));
    }

    @Test
    @DisplayName("Should generate span ID when not provided")
    void testSpanIdGeneration() throws Exception {
        Map<String, Object> spanData = new HashMap<>();
        spanData.put("traceId", "trace-123");
        spanData.put("operationName", "test-operation");

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:ingestSpans", spanData, Map.class);

        assertNotNull(response);
        assertEquals("accepted", response.get("status"));
        assertNotNull(response.get("spanId"));

        String spanId = (String) response.get("spanId");
        assertNotNull(spanId);
        assertTrue(spanId.length() > 0);
    }

    @Test
    @DisplayName("Should ingest batch of spans successfully")
    void testBatchIngestSpans() throws Exception {
        List<Map<String, Object>> spanBatch = new ArrayList<>();
        spanBatch.add(createTestSpan());
        spanBatch.add(createTestSpan());
        spanBatch.add(createTestSpan());

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:batchIngestSpans", spanBatch, Map.class);

        assertNotNull(response);
        assertEquals("accepted", response.get("status"));
        assertEquals(3, response.get("count"));
        assertNotNull(response.get("timestamp"));
    }

    @Test
    @DisplayName("Should handle empty batch")
    void testEmptyBatch() throws Exception {
        List<Map<String, Object>> emptyBatch = new ArrayList<>();

        @SuppressWarnings("unchecked")
        Map<String, Object> response = context.createProducerTemplate()
            .requestBody("direct:batchIngestSpans", emptyBatch, Map.class);

        assertNotNull(response);
        assertEquals("accepted", response.get("status"));
        assertEquals(0, response.get("count"));
        assertNotNull(response.get("timestamp"));
    }

    @Test
    @DisplayName("Should get span by ID")
    void testGetSpan() throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> span = context.createProducerTemplate()
            .requestBodyAndHeader("direct:getSpan", null, "id", "test-span-123", Map.class);

        assertNotNull(span);
        assertEquals("test-span-123", span.get("spanId"));
        assertNotNull(span.get("traceId"));
        assertNotNull(span.get("operationName"));
        assertNotNull(span.get("serviceName"));
        assertNotNull(span.get("startTime"));
        assertNotNull(span.get("endTime"));
        assertNotNull(span.get("duration"));
        assertNotNull(span.get("status"));
        assertNotNull(span.get("attributes"));
    }

    @Test
    @DisplayName("Should get spans by trace ID")
    void testGetSpansByTrace() throws Exception {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> spans = context.createProducerTemplate()
            .requestBodyAndHeader("direct:getSpansByTrace", null, "traceId", "test-trace-456", List.class);

        assertNotNull(spans);
        assertEquals(3, spans.size()); // Root + 2 children

        // Verify root span
        Map<String, Object> rootSpan = spans.get(0);
        assertEquals("span-root", rootSpan.get("spanId"));
        assertEquals("test-trace-456", rootSpan.get("traceId"));
        assertNull(rootSpan.get("parentSpanId"));
        assertEquals("root-operation", rootSpan.get("operationName"));
        assertEquals("gateway", rootSpan.get("serviceName"));

        // Verify child spans have parent relationships
        Map<String, Object> childSpan1 = spans.get(1);
        assertEquals("span-child1", childSpan1.get("spanId"));
        assertEquals("test-trace-456", childSpan1.get("traceId"));
        assertEquals("span-root", childSpan1.get("parentSpanId"));

        Map<String, Object> childSpan2 = spans.get(2);
        assertEquals("span-child2", childSpan2.get("spanId"));
        assertEquals("test-trace-456", childSpan2.get("traceId"));
        assertEquals("span-root", childSpan2.get("parentSpanId"));
    }

    @Test
    @DisplayName("Should create mock span with all required fields")
    void testMockSpanCreation() throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> span = context.createProducerTemplate()
            .requestBodyAndHeader("direct:getSpan", null, "id", "mock-span-test", Map.class);

        // Verify all required fields are present
        assertNotNull(span.get("spanId"));
        assertNotNull(span.get("traceId"));
        assertNotNull(span.get("parentSpanId"));
        assertNotNull(span.get("operationName"));
        assertNotNull(span.get("serviceName"));
        assertNotNull(span.get("startTime"));
        assertNotNull(span.get("endTime"));
        assertNotNull(span.get("duration"));
        assertNotNull(span.get("status"));

        @SuppressWarnings("unchecked")
        Map<String, Object> attributes = (Map<String, Object>) span.get("attributes");
        assertNotNull(attributes);
        assertEquals("GET", attributes.get("http.method"));
        assertEquals("/api/test", attributes.get("http.url"));
        assertEquals(200, attributes.get("http.status_code"));
    }

    @Test
    @DisplayName("Should have correct route count")
    void testRouteCount() throws Exception {
        assertEquals(4, context.getRoutes().size());
    }

    @Test
    @DisplayName("Should handle route lifecycle")
    void testRouteLifecycle() throws Exception {
        assertTrue(context.getStatus().isStarted());

        context.stop();
        assertEquals("Stopped", context.getStatus().name());

        context.start();
        assertEquals("Started", context.getStatus().name());
    }

    /**
     * Helper method to create a test span
     */
    private Map<String, Object> createTestSpan() {
        Map<String, Object> span = new HashMap<>();
        span.put("traceId", "trace-" + UUID.randomUUID().toString());
        span.put("operationName", "test-operation");
        span.put("serviceName", "test-service");
        span.put("startTime", "2024-01-01T10:00:00Z");
        span.put("endTime", "2024-01-01T10:00:01Z");
        span.put("duration", 1000);
        span.put("status", "OK");

        Map<String, Object> attributes = new HashMap<>();
        attributes.put("test.attribute", "test-value");
        span.put("attributes", attributes);

        return span;
    }
}