package com.fluo.processors;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;
import java.time.Instant;

/**
 * Processors for span API routes.
 * Contains all exchange processing logic extracted from SpanApiRoute.
 */
@ApplicationScoped
public class SpanApiProcessors {

    private static final Logger LOG = LoggerFactory.getLogger(SpanApiProcessors.class);

    @Named("ingestResponseProcessor")
    @ApplicationScoped
    public static class IngestResponseProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "accepted");

            String spanId = exchange.getIn().getHeader("spanId", String.class);
            if (spanId != null) {
                response.put("spanId", spanId);
            }

            response.put("timestamp", Instant.now().toString());
            exchange.getIn().setBody(response);
        }
    }

    @Named("batchIngestResponseProcessor")
    @ApplicationScoped
    public static class BatchIngestResponseProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> spans = exchange.getIn().getBody(List.class);
            Map<String, Object> response = Map.of(
                "status", "accepted",
                "count", spans != null ? spans.size() : 0,
                "timestamp", Instant.now().toString()
            );
            exchange.getIn().setBody(response);
        }
    }

    @Named("getSpanProcessor")
    @ApplicationScoped
    public static class GetSpanProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            String spanId = exchange.getIn().getHeader("id", String.class);
            // In production, this would query TigerBeetle or the storage backend
            Map<String, Object> span = createMockSpan(spanId);
            exchange.getIn().setBody(span);
        }

        private Map<String, Object> createMockSpan(String spanId) {
            Map<String, Object> span = new HashMap<>();
            span.put("spanId", spanId);
            span.put("traceId", "trace-" + UUID.randomUUID().toString());
            span.put("parentSpanId", "parent-" + UUID.randomUUID().toString());
            span.put("operationName", "test-operation");
            span.put("serviceName", "test-service");
            span.put("startTime", Instant.now().minusSeconds(60).toString());
            span.put("endTime", Instant.now().toString());
            span.put("duration", 60000);
            span.put("status", "OK");

            Map<String, Object> attributes = new HashMap<>();
            attributes.put("http.method", "GET");
            attributes.put("http.url", "/api/test");
            attributes.put("http.status_code", 200);
            span.put("attributes", attributes);

            return span;
        }
    }

    @Named("getSpansByTraceProcessor")
    @ApplicationScoped
    public static class GetSpansByTraceProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            String traceId = exchange.getIn().getHeader("traceId", String.class);
            // In production, this would query all spans for a trace
            List<Map<String, Object>> spans = createMockSpansForTrace(traceId);
            exchange.getIn().setBody(spans);
        }

        private List<Map<String, Object>> createMockSpansForTrace(String traceId) {
            List<Map<String, Object>> spans = new ArrayList<>();

            // Root span
            Map<String, Object> rootSpan = new HashMap<>();
            rootSpan.put("spanId", "span-root");
            rootSpan.put("traceId", traceId);
            rootSpan.put("parentSpanId", null);
            rootSpan.put("operationName", "root-operation");
            rootSpan.put("serviceName", "gateway");
            rootSpan.put("startTime", Instant.now().minusSeconds(120).toString());
            rootSpan.put("endTime", Instant.now().minusSeconds(60).toString());
            rootSpan.put("duration", 60000);
            spans.add(rootSpan);

            // Child span 1
            Map<String, Object> childSpan1 = new HashMap<>();
            childSpan1.put("spanId", "span-child1");
            childSpan1.put("traceId", traceId);
            childSpan1.put("parentSpanId", "span-root");
            childSpan1.put("operationName", "database-query");
            childSpan1.put("serviceName", "database");
            childSpan1.put("startTime", Instant.now().minusSeconds(100).toString());
            childSpan1.put("endTime", Instant.now().minusSeconds(90).toString());
            childSpan1.put("duration", 10000);
            spans.add(childSpan1);

            // Child span 2
            Map<String, Object> childSpan2 = new HashMap<>();
            childSpan2.put("spanId", "span-child2");
            childSpan2.put("traceId", traceId);
            childSpan2.put("parentSpanId", "span-root");
            childSpan2.put("operationName", "cache-lookup");
            childSpan2.put("serviceName", "cache");
            childSpan2.put("startTime", Instant.now().minusSeconds(85).toString());
            childSpan2.put("endTime", Instant.now().minusSeconds(80).toString());
            childSpan2.put("duration", 5000);
            spans.add(childSpan2);

            return spans;
        }
    }
}