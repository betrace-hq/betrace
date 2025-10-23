package com.fluo.processors;

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
import java.util.List;
import java.util.ArrayList;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("SpanApiProcessors Tests")
class SpanApiProcessorsTest {

    private DefaultCamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("IngestResponseProcessor should create response with span ID from header")
    void testIngestResponseProcessor() throws Exception {
        SpanApiProcessors.IngestResponseProcessor processor = new SpanApiProcessors.IngestResponseProcessor();

        exchange.getIn().setHeader("spanId", "span-123");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals("accepted", result.get("status"));
        assertEquals("span-123", result.get("spanId"));
        assertNotNull(result.get("timestamp"));
        assertTrue(result.get("timestamp").toString().contains("T"));
    }

    @Test
    @DisplayName("IngestResponseProcessor should handle missing span ID header")
    void testIngestResponseProcessorNoSpanId() throws Exception {
        SpanApiProcessors.IngestResponseProcessor processor = new SpanApiProcessors.IngestResponseProcessor();

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals("accepted", result.get("status"));
        assertFalse(result.containsKey("spanId"));
        assertNotNull(result.get("timestamp"));
    }

    @Test
    @DisplayName("BatchIngestResponseProcessor should count spans in body")
    void testBatchIngestResponseProcessor() throws Exception {
        SpanApiProcessors.BatchIngestResponseProcessor processor = new SpanApiProcessors.BatchIngestResponseProcessor();

        List<Map<String, Object>> spans = new ArrayList<>();
        spans.add(Map.of("spanId", "span-1", "traceId", "trace-1"));
        spans.add(Map.of("spanId", "span-2", "traceId", "trace-1"));
        spans.add(Map.of("spanId", "span-3", "traceId", "trace-2"));

        exchange.getIn().setBody(spans);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals("accepted", result.get("status"));
        assertEquals(3, result.get("count"));
        assertNotNull(result.get("timestamp"));
    }

    @Test
    @DisplayName("BatchIngestResponseProcessor should handle null body")
    void testBatchIngestResponseProcessorNullBody() throws Exception {
        SpanApiProcessors.BatchIngestResponseProcessor processor = new SpanApiProcessors.BatchIngestResponseProcessor();

        exchange.getIn().setBody(null);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals("accepted", result.get("status"));
        assertEquals(0, result.get("count"));
        assertNotNull(result.get("timestamp"));
    }

    @Test
    @DisplayName("BatchIngestResponseProcessor should handle empty list")
    void testBatchIngestResponseProcessorEmptyList() throws Exception {
        SpanApiProcessors.BatchIngestResponseProcessor processor = new SpanApiProcessors.BatchIngestResponseProcessor();

        exchange.getIn().setBody(new ArrayList<>());

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertEquals("accepted", result.get("status"));
        assertEquals(0, result.get("count"));
        assertNotNull(result.get("timestamp"));
    }

    @Test
    @DisplayName("GetSpanProcessor should return mock span with provided ID")
    void testGetSpanProcessor() throws Exception {
        SpanApiProcessors.GetSpanProcessor processor = new SpanApiProcessors.GetSpanProcessor();

        exchange.getIn().setHeader("id", "span-456");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertEquals("span-456", result.get("spanId"));
        assertNotNull(result.get("traceId"));
        assertTrue(result.get("traceId").toString().startsWith("trace-"));
        assertNotNull(result.get("parentSpanId"));
        assertEquals("test-operation", result.get("operationName"));
        assertEquals("test-service", result.get("serviceName"));
        assertNotNull(result.get("startTime"));
        assertNotNull(result.get("endTime"));
        assertEquals(60000, result.get("duration"));
        assertEquals("OK", result.get("status"));

        @SuppressWarnings("unchecked")
        Map<String, Object> attributes = (Map<String, Object>) result.get("attributes");
        assertNotNull(attributes);
        assertEquals("GET", attributes.get("http.method"));
        assertEquals("/api/test", attributes.get("http.url"));
        assertEquals(200, attributes.get("http.status_code"));
    }

    @Test
    @DisplayName("GetSpanProcessor should handle missing ID header")
    void testGetSpanProcessorNoId() throws Exception {
        SpanApiProcessors.GetSpanProcessor processor = new SpanApiProcessors.GetSpanProcessor();

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result);
        assertNull(result.get("spanId"));
        assertNotNull(result.get("traceId"));
        assertEquals("test-operation", result.get("operationName"));
        assertEquals("test-service", result.get("serviceName"));
    }

    @Test
    @DisplayName("GetSpansByTraceProcessor should return multiple spans for trace ID")
    void testGetSpansByTraceProcessor() throws Exception {
        SpanApiProcessors.GetSpansByTraceProcessor processor = new SpanApiProcessors.GetSpansByTraceProcessor();

        exchange.getIn().setHeader("traceId", "trace-789");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> result = exchange.getIn().getBody(List.class);
        assertNotNull(result);
        assertEquals(3, result.size());

        // Check root span
        Map<String, Object> rootSpan = result.get(0);
        assertEquals("span-root", rootSpan.get("spanId"));
        assertEquals("trace-789", rootSpan.get("traceId"));
        assertNull(rootSpan.get("parentSpanId"));
        assertEquals("root-operation", rootSpan.get("operationName"));
        assertEquals("gateway", rootSpan.get("serviceName"));
        assertEquals(60000, rootSpan.get("duration"));

        // Check child span 1
        Map<String, Object> childSpan1 = result.get(1);
        assertEquals("span-child1", childSpan1.get("spanId"));
        assertEquals("trace-789", childSpan1.get("traceId"));
        assertEquals("span-root", childSpan1.get("parentSpanId"));
        assertEquals("database-query", childSpan1.get("operationName"));
        assertEquals("database", childSpan1.get("serviceName"));
        assertEquals(10000, childSpan1.get("duration"));

        // Check child span 2
        Map<String, Object> childSpan2 = result.get(2);
        assertEquals("span-child2", childSpan2.get("spanId"));
        assertEquals("trace-789", childSpan2.get("traceId"));
        assertEquals("span-root", childSpan2.get("parentSpanId"));
        assertEquals("cache-lookup", childSpan2.get("operationName"));
        assertEquals("cache", childSpan2.get("serviceName"));
        assertEquals(5000, childSpan2.get("duration"));
    }

    @Test
    @DisplayName("GetSpansByTraceProcessor should handle missing trace ID")
    void testGetSpansByTraceProcessorNoTraceId() throws Exception {
        SpanApiProcessors.GetSpansByTraceProcessor processor = new SpanApiProcessors.GetSpansByTraceProcessor();

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> result = exchange.getIn().getBody(List.class);
        assertNotNull(result);
        assertEquals(3, result.size());

        // Should still return spans but with null traceId
        Map<String, Object> rootSpan = result.get(0);
        assertEquals("span-root", rootSpan.get("spanId"));
        assertNull(rootSpan.get("traceId"));
    }

    @Test
    @DisplayName("GetSpansByTraceProcessor should create valid time hierarchy")
    void testGetSpansByTraceProcessorTimeHierarchy() throws Exception {
        SpanApiProcessors.GetSpansByTraceProcessor processor = new SpanApiProcessors.GetSpansByTraceProcessor();

        exchange.getIn().setHeader("traceId", "trace-time-test");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> result = exchange.getIn().getBody(List.class);

        // Verify time hierarchy - child spans should be within parent span time
        Map<String, Object> rootSpan = result.get(0);
        Instant rootStart = Instant.parse(rootSpan.get("startTime").toString());
        Instant rootEnd = Instant.parse(rootSpan.get("endTime").toString());

        Map<String, Object> childSpan1 = result.get(1);
        Instant child1Start = Instant.parse(childSpan1.get("startTime").toString());
        Instant child1End = Instant.parse(childSpan1.get("endTime").toString());

        // Child should start after parent and end before parent
        assertTrue(child1Start.isAfter(rootStart));
        assertTrue(child1End.isBefore(rootEnd));

        Map<String, Object> childSpan2 = result.get(2);
        Instant child2Start = Instant.parse(childSpan2.get("startTime").toString());
        Instant child2End = Instant.parse(childSpan2.get("endTime").toString());

        assertTrue(child2Start.isAfter(rootStart));
        assertTrue(child2End.isBefore(rootEnd));
    }

    @Test
    @DisplayName("All processors should be annotated correctly")
    void testProcessorAnnotations() {
        // Verify IngestResponseProcessor annotations
        assertTrue(SpanApiProcessors.IngestResponseProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(SpanApiProcessors.IngestResponseProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("ingestResponseProcessor",
            SpanApiProcessors.IngestResponseProcessor.class.getAnnotation(Named.class).value());

        // Verify BatchIngestResponseProcessor annotations
        assertTrue(SpanApiProcessors.BatchIngestResponseProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(SpanApiProcessors.BatchIngestResponseProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("batchIngestResponseProcessor",
            SpanApiProcessors.BatchIngestResponseProcessor.class.getAnnotation(Named.class).value());

        // Verify GetSpanProcessor annotations
        assertTrue(SpanApiProcessors.GetSpanProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(SpanApiProcessors.GetSpanProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("getSpanProcessor",
            SpanApiProcessors.GetSpanProcessor.class.getAnnotation(Named.class).value());

        // Verify GetSpansByTraceProcessor annotations
        assertTrue(SpanApiProcessors.GetSpansByTraceProcessor.class.isAnnotationPresent(ApplicationScoped.class));
        assertTrue(SpanApiProcessors.GetSpansByTraceProcessor.class.isAnnotationPresent(Named.class));
        assertEquals("getSpansByTraceProcessor",
            SpanApiProcessors.GetSpansByTraceProcessor.class.getAnnotation(Named.class).value());
    }
}