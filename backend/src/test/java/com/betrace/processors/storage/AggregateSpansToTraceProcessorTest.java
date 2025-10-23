package com.betrace.processors.storage;

import com.betrace.model.Span;
import com.betrace.model.Trace;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class AggregateSpansToTraceProcessorTest {

    private AggregateSpansToTraceProcessor processor;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        processor = new AggregateSpansToTraceProcessor();
        exchange = new DefaultExchange(new DefaultCamelContext());
    }

    @Test
    @DisplayName("Should aggregate list of spans into trace")
    void testAggregateListOfSpans() throws Exception {
        // Given
        String traceId = "12345678901234567890123456789012";
        String tenantId = UUID.randomUUID().toString();
        Instant now = Instant.now();

        List<Span> spans = Arrays.asList(
            createSpan("span1", traceId, null, "GET /api", now, tenantId),
            createSpan("span2", traceId, "span1", "DB Query", now.plusMillis(10), tenantId),
            createSpan("span3", traceId, "span1", "Cache Check", now.plusMillis(5), tenantId)
        );

        exchange.getIn().setBody(spans);

        // When
        processor.process(exchange);

        // Then
        Trace trace = exchange.getIn().getBody(Trace.class);
        assertNotNull(trace);
        assertEquals(traceId, trace.traceId());
        assertEquals(3, trace.spans().size());
        assertEquals(3, trace.getSpanCount());
        assertEquals("GET /api", trace.rootSpanName());
        assertEquals("test-service", trace.serviceName());
    }

    @Test
    @DisplayName("Should aggregate single span into trace")
    void testAggregateSingleSpan() throws Exception {
        // Given
        String traceId = "12345678901234567890123456789012";
        String tenantId = UUID.randomUUID().toString();
        Instant now = Instant.now();

        Span span = createSpan("span1", traceId, null, "GET /api", now, tenantId);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then
        Trace trace = exchange.getIn().getBody(Trace.class);
        assertNotNull(trace);
        assertEquals(traceId, trace.traceId());
        assertEquals(1, trace.spans().size());
        assertEquals("GET /api", trace.rootSpanName());
    }

    @Test
    @DisplayName("Should find root span correctly")
    void testFindRootSpan() throws Exception {
        // Given
        String traceId = "12345678901234567890123456789012";
        String tenantId = UUID.randomUUID().toString();
        Instant now = Instant.now();

        // Root span is NOT first in list
        List<Span> spans = Arrays.asList(
            createSpan("span2", traceId, "span1", "DB Query", now.plusMillis(10), tenantId),
            createSpan("span1", traceId, null, "GET /api", now, tenantId),  // Root
            createSpan("span3", traceId, "span1", "Cache Check", now.plusMillis(5), tenantId)
        );

        exchange.getIn().setBody(spans);

        // When
        processor.process(exchange);

        // Then
        Trace trace = exchange.getIn().getBody(Trace.class);
        assertEquals("GET /api", trace.rootSpanName());
        assertEquals("span1", trace.getRootSpan().spanId());
    }

    @Test
    @DisplayName("Should handle empty span list gracefully")
    void testEmptySpanList() throws Exception {
        // Given
        exchange.getIn().setBody(Collections.emptyList());

        // When
        processor.process(exchange);

        // Then
        assertNull(exchange.getIn().getBody());
    }

    @Test
    @DisplayName("Should calculate trace duration correctly")
    void testCalculateDuration() throws Exception {
        // Given
        String traceId = "12345678901234567890123456789012";
        String tenantId = UUID.randomUUID().toString();
        Instant start = Instant.now();

        List<Span> spans = Arrays.asList(
            createSpan("span1", traceId, null, "GET /api", start, tenantId),
            createSpan("span2", traceId, "span1", "DB Query", start.plusMillis(10), start.plusMillis(50), tenantId),
            createSpan("span3", traceId, "span1", "Cache", start.plusMillis(5), start.plusMillis(15), tenantId)
        );

        exchange.getIn().setBody(spans);

        // When
        processor.process(exchange);

        // Then
        Trace trace = exchange.getIn().getBody(Trace.class);
        assertTrue(trace.durationMs() > 0);
    }

    @Test
    @DisplayName("Should extract tenant ID from spans")
    void testExtractTenantId() throws Exception {
        // Given
        String traceId = "12345678901234567890123456789012";
        String tenantId = UUID.randomUUID().toString();
        Instant now = Instant.now();

        List<Span> spans = Arrays.asList(
            createSpan("span1", traceId, null, "GET /api", now, tenantId)
        );

        exchange.getIn().setBody(spans);

        // When
        processor.process(exchange);

        // Then
        Trace trace = exchange.getIn().getBody(Trace.class);
        assertEquals(UUID.fromString(tenantId), trace.tenantId());
    }

    // Helper methods

    private Span createSpan(String spanId, String traceId, String parentSpanId,
                           String operationName, Instant startTime, String tenantId) {
        return createSpan(spanId, traceId, parentSpanId, operationName,
            startTime, startTime.plusMillis(100), tenantId);
    }

    private Span createSpan(String spanId, String traceId, String parentSpanId,
                           String operationName, Instant startTime, Instant endTime, String tenantId) {
        return new Span(
            spanId,
            traceId,
            parentSpanId,
            operationName,
            "test-service",
            startTime,
            endTime,
            (endTime.toEpochMilli() - startTime.toEpochMilli()) * 1_000_000,
            Span.SpanKind.SERVER,
            Span.SpanStatus.OK,
            new HashMap<>(),
            new HashMap<>()
        );
    }
}
