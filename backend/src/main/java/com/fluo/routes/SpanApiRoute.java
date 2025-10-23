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
// ADR-023: Removed tenant-specific imports (TenantSecurityProcessor, RateLimiter, RateLimitException)
import com.fluo.processors.redaction.DetectPIIProcessor;
import com.fluo.processors.redaction.LoadRedactionRulesProcessor;
import com.fluo.processors.redaction.ApplyRedactionProcessor;
import com.fluo.processors.redaction.RecordRedactionEventProcessor;
import com.fluo.processors.redaction.GenerateRedactionComplianceSpanProcessor;

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

    // ADR-023: RateLimiter removed - handled at infrastructure level

    @Inject
    DetectPIIProcessor detectPIIProcessor;

    @Inject
    LoadRedactionRulesProcessor loadRedactionRulesProcessor;

    @Inject
    ApplyRedactionProcessor applyRedactionProcessor;

    @Inject
    RecordRedactionEventProcessor recordRedactionEventProcessor;

    @Inject
    GenerateRedactionComplianceSpanProcessor generateRedactionComplianceSpanProcessor;

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

        // ADR-023: Single-tenant span ingestion route
        // Security handled at infrastructure level (API gateway, TLS, mTLS)
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
            // PRD-004: PII Redaction Pipeline (5 processors)
            // SOC2: CC6.7 (Data Classification), HIPAA: 164.530(c) (Privacy Safeguards)
            .process(detectPIIProcessor)              // 1. Detect PII in span attributes
            .process(loadRedactionRulesProcessor)     // 2. Load tenant redaction rules
            .process(applyRedactionProcessor)         // 3. Apply redaction strategies
            .process(recordRedactionEventProcessor)   // 4. Record audit trail
            .process(generateRedactionComplianceSpanProcessor) // 5. Generate compliance evidence
            // Evaluate span against Drools rules
            .process(droolsSpanProcessor)
            .process(ingestResponseProcessor);

        // ADR-023: Single-tenant batch span ingestion
        from("direct:batchIngestSpans")
            .routeId("batchIngestSpans")
            .process(new BatchSizeValidator())  // Prevent memory exhaustion
            .log("Ingesting batch of spans")
            .process(new BatchSpanProcessor())
            // Batch evaluate spans against Drools rules
            .process(droolsBatchSpanProcessor)
            .process(batchIngestResponseProcessor);

        // ADR-023: Single-tenant get span by ID
        from("direct:getSpan")
            .routeId("getSpan")
            .process(getSpanProcessor);

        // ADR-023: Single-tenant get spans by trace ID
        from("direct:getSpansByTrace")
            .routeId("getSpansByTrace")
            .process(getSpansByTraceProcessor);
    }

    // ADR-023: Rate limiting removed - handled at infrastructure level (API gateway, Envoy, NGINX)

    /**
     * Batch size validator.
     * Security: Prevents memory exhaustion from large payloads (SOC2 CC7.2)
     */
    private static class BatchSizeValidator implements Processor {
        private static final int MAX_BATCH_SIZE = 1000;
        private static final long MAX_PAYLOAD_BYTES = 10_000_000; // 10MB

        @Override
        public void process(Exchange exchange) throws Exception {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> spans = exchange.getIn().getBody(List.class);

            if (spans == null || spans.isEmpty()) {
                exchange.getMessage().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
                exchange.getMessage().setBody(Map.of("error", "Empty batch"));
                throw new IllegalArgumentException("Empty batch");
            }

            if (spans.size() > MAX_BATCH_SIZE) {
                exchange.getMessage().setHeader(Exchange.HTTP_RESPONSE_CODE, 413);
                exchange.getMessage().setBody(Map.of(
                    "error", "Batch too large",
                    "maxBatchSize", MAX_BATCH_SIZE,
                    "receivedSize", spans.size()
                ));
                throw new IllegalArgumentException("Batch size " + spans.size() + " exceeds maximum " + MAX_BATCH_SIZE);
            }

            // Estimate payload size (rough approximation)
            String bodyStr = exchange.getIn().getBody(String.class);
            if (bodyStr != null && bodyStr.length() > MAX_PAYLOAD_BYTES) {
                exchange.getMessage().setHeader(Exchange.HTTP_RESPONSE_CODE, 413);
                exchange.getMessage().setBody(Map.of(
                    "error", "Payload too large",
                    "maxBytes", MAX_PAYLOAD_BYTES,
                    "receivedBytes", bodyStr.length()
                ));
                throw new IllegalArgumentException("Payload size exceeds maximum");
            }

            LOG.debug("Batch size validation passed: {} spans", spans.size());
        }
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