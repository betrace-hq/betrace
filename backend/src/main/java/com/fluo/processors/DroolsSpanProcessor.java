package com.fluo.processors;

import com.fluo.model.Span;
import com.fluo.services.TenantSessionManager;
import com.fluo.services.MetricsService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.jboss.logging.Logger;
import org.kie.api.runtime.KieSession;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Camel processor that inserts spans into Drools KieSession for rule evaluation.
 *
 * This processor:
 * 1. Extracts tenant ID from exchange headers
 * 2. Converts incoming span data to Span model
 * 3. Inserts span into tenant's Drools session
 * 4. Fires rules to evaluate trace patterns
 *
 * Designed for real-time evaluation as spans arrive.
 */
@ApplicationScoped
@Named("droolsSpanProcessor")
public class DroolsSpanProcessor implements Processor {

    private static final Logger LOG = Logger.getLogger(DroolsSpanProcessor.class);

    @Inject
    TenantSessionManager sessionManager;

    @Inject
    MetricsService metricsService;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract tenant ID from header (set by TenantContextPolicy)
        String tenantId = exchange.getIn().getHeader("X-Tenant-ID", String.class);
        if (tenantId == null) {
            LOG.warn("No tenant ID found in exchange, skipping Drools evaluation");
            return;
        }

        // Get or parse span from body
        Object body = exchange.getIn().getBody();
        Span span = null;

        if (body instanceof Span) {
            span = (Span) body;
        } else if (body instanceof Map) {
            span = convertMapToSpan((Map<String, Object>) body, tenantId);
        } else {
            LOG.warnf("Unsupported body type for Drools evaluation: %s",
                body != null ? body.getClass().getName() : "null");
            return;
        }

        if (span == null) {
            LOG.warn("Failed to convert body to Span, skipping Drools evaluation");
            return;
        }

        // Record span ingestion metric
        metricsService.recordSpanIngested(tenantId);

        // Insert span into Drools session
        try {
            long startTime = System.currentTimeMillis();
            long startNanos = System.nanoTime();

            KieSession session = sessionManager.getSessionForEvaluation(tenantId);

            LOG.debugf("Inserting span into Drools session: traceId=%s, spanId=%s, operation=%s",
                span.traceId(), span.spanId(), span.operationName());

            session.insert(span);

            // Fire rules immediately for real-time evaluation
            int rulesFired = session.fireAllRules();

            // Record metrics
            long evaluationMillis = System.currentTimeMillis() - startTime;
            long processingMicros = (System.nanoTime() - startNanos) / 1000;

            metricsService.recordRuleEvaluation(tenantId, evaluationMillis);
            metricsService.recordTraceProcessingTime(tenantId, span.traceId(), processingMicros);

            if (rulesFired > 0) {
                LOG.debugf("Fired %d rules for span %s in trace %s (took %d ms)",
                    rulesFired, span.spanId(), span.traceId(), evaluationMillis);
            }

        } catch (Exception e) {
            LOG.errorf(e, "Error evaluating span in Drools: traceId=%s, spanId=%s",
                span.traceId(), span.spanId());
            // Don't fail the exchange - span ingestion should continue even if rule evaluation fails
        } finally {
            sessionManager.releaseSession(tenantId);
        }
    }

    /**
     * Convert Map representation to Span model
     */
    private Span convertMapToSpan(Map<String, Object> spanMap, String tenantId) {
        try {
            String spanId = getStringValue(spanMap, "spanId");
            String traceId = getStringValue(spanMap, "traceId");
            String operationName = getStringValue(spanMap, "operationName");
            String serviceName = getStringValue(spanMap, "serviceName");

            Instant startTime = parseInstant(spanMap.get("startTime"));
            Instant endTime = parseInstant(spanMap.get("endTime"));

            @SuppressWarnings("unchecked")
            Map<String, Object> attributes = (Map<String, Object>) spanMap.getOrDefault("attributes", Map.of());

            return Span.create(
                spanId,
                traceId,
                operationName,
                serviceName,
                startTime,
                endTime,
                attributes,
                tenantId
            );

        } catch (Exception e) {
            LOG.errorf(e, "Error converting map to Span");
            return null;
        }
    }

    private String getStringValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }

    private Instant parseInstant(Object value) {
        if (value == null) {
            return Instant.now();
        }
        if (value instanceof Instant) {
            return (Instant) value;
        }
        if (value instanceof String) {
            return Instant.parse((String) value);
        }
        if (value instanceof Number) {
            return Instant.ofEpochMilli(((Number) value).longValue());
        }
        return Instant.now();
    }
}

