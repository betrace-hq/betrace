package com.fluo.processors;

import com.fluo.model.Span;
import com.fluo.security.capabilities.ImmutableSpanWrapper;
import com.fluo.security.agent.SandboxContext;
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
import java.util.UUID;

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

    // ADR-023: Single-tenant deployment - one KieSession for entire deployment
    @Inject
    KieSession kieSession;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Get or parse span from body
        Object body = exchange.getIn().getBody();
        Span span = null;

        if (body instanceof Span) {
            span = (Span) body;
        } else if (body instanceof Map) {
            span = convertMapToSpan((Map<String, Object>) body);
        } else {
            LOG.warnf("Unsupported body type for Drools evaluation: %s",
                body != null ? body.getClass().getName() : "null");
            return;
        }

        if (span == null) {
            LOG.warn("Failed to convert body to Span, skipping Drools evaluation");
            return;
        }

        // Insert span into Drools session (single-tenant)
        try {
            long startTime = System.currentTimeMillis();
            long startNanos = System.nanoTime();

            LOG.debugf("Inserting span into Drools session: traceId=%s, spanId=%s, operation=%s",
                span.traceId(), span.spanId(), span.operationName());

            // ADR-023: Single-tenant - wrap span in immutable capability (security)
            ImmutableSpanWrapper wrappedSpan = ImmutableSpanWrapper.wrap(span);
            kieSession.insert(wrappedSpan);

            // Fire rules with execution timeout and sandbox protection
            int rulesFired;
            try {
                // 5 second timeout per rule evaluation
                java.util.concurrent.ExecutorService executor =
                    java.util.concurrent.Executors.newSingleThreadExecutor();
                java.util.concurrent.Future<Integer> future =
                    executor.submit(() -> {
                        try {
                            SandboxContext.enterRuleExecution();
                            return kieSession.fireAllRules();
                        } finally {
                            SandboxContext.exitRuleExecution();
                        }
                    });

                rulesFired = future.get(5, java.util.concurrent.TimeUnit.SECONDS);
                executor.shutdown();

            } catch (java.util.concurrent.TimeoutException e) {
                LOG.error("Rule execution timeout - possible infinite loop");
                throw new RuntimeException("Rule execution timeout exceeded 5 seconds");
            } catch (java.util.concurrent.ExecutionException e) {
                LOG.error("Rule execution failed", e);
                throw new RuntimeException("Rule execution failed", e.getCause());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Rule execution interrupted", e);
            }

            // Log metrics
            long evaluationMillis = System.currentTimeMillis() - startTime;

            if (rulesFired > 0) {
                LOG.debugf("Fired %d rules for span %s in trace %s (took %d ms)",
                    rulesFired, span.spanId(), span.traceId(), evaluationMillis);
            }

            // ADR-026: Emit violation spans (core competency #2)
            // TODO: Collect violations from RuleContext and emit as spans

        } catch (Exception e) {
            LOG.errorf(e, "Error evaluating span in Drools: traceId=%s, spanId=%s",
                span.traceId(), span.spanId());
            // Don't fail the exchange - span ingestion should continue even if rule evaluation fails
        }
    }

    /**
     * Convert Map representation to Span model (ADR-023: single-tenant)
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

            // ADR-023: Single-tenant - no tenantId needed
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

