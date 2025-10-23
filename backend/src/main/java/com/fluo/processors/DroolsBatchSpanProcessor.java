package com.fluo.processors;

import com.fluo.compliance.evidence.ViolationSpan;
import com.fluo.model.Span;
import com.fluo.rules.RuleContext;
import com.fluo.services.ViolationSpanEmitter;
import com.fluo.services.MetricsService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.jboss.logging.Logger;
import org.kie.api.runtime.KieSession;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.UUID;

/**
 * Batch processor for multiple spans.
 * ADR-023: Single-tenant deployment - one KieSession for entire deployment.
 * ADR-026: Emits violation spans when patterns match.
 */
@ApplicationScoped
@Named("droolsBatchSpanProcessor")
public class DroolsBatchSpanProcessor implements Processor {

    private static final Logger LOG = Logger.getLogger(DroolsBatchSpanProcessor.class);

    @Inject
    KieSession kieSession;

    @Inject
    MetricsService metricsService;

    @Inject
    ViolationSpanEmitter violationSpanEmitter;

    @Override
    public void process(Exchange exchange) throws Exception {
        // ADR-023: Single-tenant deployment (no tenant ID needed)

        Object body = exchange.getIn().getBody();
        if (!(body instanceof List)) {
            LOG.warn("Batch processor expects List body");
            return;
        }

        @SuppressWarnings("unchecked")
        List<Object> spans = (List<Object>) body;

        LOG.debugf("Processing batch of %d spans", spans.size());

        try {
            long startTime = System.currentTimeMillis();
            long startNanos = System.nanoTime();

            int inserted = 0;
            HashSet<String> traceIds = new HashSet<>();

            for (Object spanObj : spans) {
                Span span = null;
                if (spanObj instanceof Map) {
                    span = convertMapToSpan((Map<String, Object>) spanObj);
                } else if (spanObj instanceof Span) {
                    span = (Span) spanObj;
                }

                if (span != null) {
                    kieSession.insert(span);
                    inserted++;
                    traceIds.add(span.traceId());
                }
            }

            // Security: Fire rules with execution timeout (P0 #11 fix)
            int rulesFired;
            try {
                // 10 second timeout for batch processing (larger than single span)
                java.util.concurrent.ExecutorService executor =
                    java.util.concurrent.Executors.newSingleThreadExecutor();
                java.util.concurrent.Future<Integer> future =
                    executor.submit(() -> kieSession.fireAllRules());

                rulesFired = future.get(10, java.util.concurrent.TimeUnit.SECONDS);
                executor.shutdown();

            } catch (java.util.concurrent.TimeoutException e) {
                LOG.error("Batch rule execution timeout - possible infinite loop");
                metricsService.recordRuleTimeout();
                throw new RuntimeException("Batch rule execution timeout exceeded 10 seconds");
            } catch (java.util.concurrent.ExecutionException e) {
                LOG.errorf(e, "Batch rule execution failed");
                throw new RuntimeException("Batch rule execution failed", e.getCause());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Batch rule execution interrupted", e);
            }

            // Record metrics (ADR-023: single-tenant)
            long evaluationMillis = System.currentTimeMillis() - startTime;
            long processingMicros = (System.nanoTime() - startNanos) / 1000;

            metricsService.recordRuleEvaluation(evaluationMillis);

            // Record average processing time per trace
            for (String traceId : traceIds) {
                metricsService.recordTraceProcessingTime(traceId, processingMicros / traceIds.size());
            }

            LOG.debugf("Batch evaluation complete: %d spans inserted, %d rules fired (took %d ms)",
                inserted, rulesFired, evaluationMillis);

            // ADR-026: Emit violation spans (replaces Signal model)
            // Note: In Drools batch mode, violations are collected via global RuleContext
            // TODO: Integrate RuleContext with DroolsBatchSpanProcessor
            // For now, this processor fires rules but violation collection needs refactoring

        } catch (Exception e) {
            LOG.errorf(e, "Error evaluating batch spans in Drools");
        }
    }

    /**
     * Convert RuleContext.SignalViolation to ViolationSpan.
     * ADR-026: Core competency #2 - Emit violation spans when patterns match.
     */
    private ViolationSpan convertViolationToSpan(RuleContext.SignalViolation violation) {
        ViolationSpan.Builder builder = ViolationSpan.builder()
            .ruleId(violation.ruleId)
            .ruleName(violation.ruleName)
            .severity(violation.severity.toUpperCase())
            .traceId(violation.traceId)
            .message(violation.description);

        // Add custom attributes from violation context
        if (violation.context != null) {
            violation.context.forEach((key, value) -> {
                builder.attribute(key, value);
            });
        }

        // Add source attribute
        builder.attribute("source", "drools");

        return builder.build();
    }

    /**
     * Convert Map representation to Span model.
     * ADR-023: Single-tenant deployment (no tenantId parameter).
     */
    private Span convertMapToSpan(Map<String, Object> spanMap) {
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
                attributes
            );

        } catch (Exception e) {
            LOG.errorf(e, "Error converting map to Span in batch");
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
