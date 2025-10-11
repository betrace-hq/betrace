package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.Processor;
import org.apache.camel.Exchange;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fluo.processors.SpanApiProcessors;
import com.fluo.processors.DroolsSpanProcessor;
import com.fluo.processors.DroolsBatchSpanProcessor;
import com.fluo.compliance.processors.ComplianceOtelProcessor;

import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;
import java.time.Instant;

/**
 * Apache Camel routes for Span API endpoints.
 * Handles OpenTelemetry span ingestion and processing.
 */
@ApplicationScoped
public class SpanApiRoute extends RouteBuilder {

    private static final Logger LOG = LoggerFactory.getLogger(SpanApiRoute.class);

    @Inject
    SpanApiProcessors.IngestResponseProcessor ingestResponseProcessor;

    @Inject
    SpanApiProcessors.BatchIngestResponseProcessor batchIngestResponseProcessor;

    @Inject
    SpanApiProcessors.GetSpanProcessor getSpanProcessor;

    @Inject
    SpanApiProcessors.GetSpansByTraceProcessor getSpansByTraceProcessor;

    @Inject
    DroolsSpanProcessor droolsSpanProcessor;

    @Inject
    DroolsBatchSpanProcessor droolsBatchSpanProcessor;

    @Override
    public void configure() throws Exception {

        // REST configuration is handled by ApiRoutes

        // REST endpoints for span processing
        rest("/api/spans")
            .post()
                .consumes("application/json")
                .produces("application/json")
                .to("direct:ingestSpans")
            .post("/batch")
                .consumes("application/json")
                .produces("application/json")
                .to("direct:batchIngestSpans")
            .get("/{id}")
                .produces("application/json")
                .to("direct:getSpan")
            .get("/trace/{traceId}")
                .produces("application/json")
                .to("direct:getSpansByTrace");

        // Single span ingestion route with compliance tracking
        from("direct:ingestSpans")
            .routeId("ingestSpans")
            .log("Ingesting span: ${body}")
            // Add OpenTelemetry compliance tracking for span ingestion
            // SOC 2: CC7.1 (Monitoring), CC7.2 (System Performance)
            // HIPAA: 164.312(b) (Audit Controls)
            // FedRAMP: AU-2 (Event Logging), AU-3 (Content of Audit Records)
            .process(ComplianceOtelProcessor.builder()
                .withOperation("span_ingestion")
                .withSOC2("CC7.1", "CC7.2")
                .withHIPAA("164.312(b)", "164.308(a)(1)(ii)(D)")
                .withFedRAMP("moderate", "AU-2", "AU-3", "AU-6")
                .withISO27001("A.8.15", "A.8.16")
                .withMetadata("data_type", "telemetry")
                .withPriority("HIGH")
                .tracksSensitiveData(false)
                .build())
            .process(new SpanProcessor())
            // Evaluate span against Drools rules
            .process(droolsSpanProcessor)
            .process(ingestResponseProcessor);

        // Batch span ingestion route
        from("direct:batchIngestSpans")
            .routeId("batchIngestSpans")
            .log("Ingesting batch of spans")
            .process(new BatchSpanProcessor())
            // Batch evaluate spans against Drools rules
            .process(droolsBatchSpanProcessor)
            .process(batchIngestResponseProcessor);

        // Get span by ID
        from("direct:getSpan")
            .routeId("getSpan")
            .process(getSpanProcessor);

        // Get spans by trace ID
        from("direct:getSpansByTrace")
            .routeId("getSpansByTrace")
            .process(getSpansByTraceProcessor);
    }

    /**
     * Processor for single span ingestion
     */
    private static class SpanProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            @SuppressWarnings("unchecked")
            Map<String, Object> span = exchange.getIn().getBody(Map.class);

            if (span != null) {
                // Extract span ID or generate one
                String spanId = (String) span.getOrDefault("spanId", UUID.randomUUID().toString());
                String traceId = (String) span.get("traceId");

                LOG.debug("Processing span: spanId={}, traceId={}", spanId, traceId);

                // Add metadata
                span.put("processedAt", Instant.now().toString());
                span.put("spanId", spanId);

                // Store span ID in header for response
                exchange.getIn().setHeader("spanId", spanId);

                // In production, this would send to TigerBeetle or another storage backend
                // For now, just log it
                LOG.info("Span processed: {}", span);
            }
        }
    }

    /**
     * Processor for batch span ingestion
     */
    private static class BatchSpanProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> spans = exchange.getIn().getBody(List.class);

            if (spans != null) {
                LOG.debug("Processing batch of {} spans", spans.size());

                for (Map<String, Object> span : spans) {
                    // Extract or generate span ID
                    String spanId = (String) span.getOrDefault("spanId", UUID.randomUUID().toString());
                    String traceId = (String) span.get("traceId");

                    // Add metadata
                    span.put("processedAt", Instant.now().toString());
                    span.put("spanId", spanId);

                    LOG.debug("Batch processing span: spanId={}, traceId={}", spanId, traceId);
                }

                // In production, this would batch send to TigerBeetle
                LOG.info("Batch processed {} spans", spans.size());
            }
        }
    }

    /**
     * Create a mock span for testing
     */
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

    /**
     * Create mock spans for a trace
     */
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