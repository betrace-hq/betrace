package com.fluo.processors;

import com.fluo.model.Signal;
import com.fluo.model.Span;
import com.fluo.rules.RuleContext;
import com.fluo.services.SignalService;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.UUID;

/**
 * Batch processor for multiple spans.
 * Inserts multiple spans into Drools session and fires rules once for the entire batch.
 */
@ApplicationScoped
@Named("droolsBatchSpanProcessor")
public class DroolsBatchSpanProcessor implements Processor {

    private static final Logger LOG = Logger.getLogger(DroolsBatchSpanProcessor.class);

    @Inject
    TenantSessionManager sessionManager;

    @Inject
    MetricsService metricsService;

    @Inject
    SignalService signalService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("X-Tenant-ID", String.class);
        if (tenantId == null) {
            LOG.warn("No tenant ID found in exchange, skipping Drools evaluation");
            return;
        }

        Object body = exchange.getIn().getBody();
        if (!(body instanceof List)) {
            LOG.warn("Batch processor expects List body");
            return;
        }

        @SuppressWarnings("unchecked")
        List<Object> spans = (List<Object>) body;

        LOG.debugf("Processing batch of %d spans for tenant %s", spans.size(), tenantId);

        try {
            long startTime = System.currentTimeMillis();
            long startNanos = System.nanoTime();

            KieSession session = sessionManager.getSessionForEvaluation(tenantId);

            int inserted = 0;
            HashSet<String> traceIds = new HashSet<>();

            for (Object spanObj : spans) {
                Span span = null;
                if (spanObj instanceof Map) {
                    span = convertMapToSpan((Map<String, Object>) spanObj, tenantId);
                } else if (spanObj instanceof Span) {
                    span = (Span) spanObj;
                }

                if (span != null) {
                    session.insert(span);
                    inserted++;
                    traceIds.add(span.traceId());
                    metricsService.recordSpanIngested(tenantId);
                }
            }

            // Security: Fire rules with execution timeout (P0 #11 fix)
            int rulesFired;
            try {
                // 10 second timeout for batch processing (larger than single span)
                java.util.concurrent.ExecutorService executor =
                    java.util.concurrent.Executors.newSingleThreadExecutor();
                java.util.concurrent.Future<Integer> future =
                    executor.submit(() -> session.fireAllRules());

                rulesFired = future.get(10, java.util.concurrent.TimeUnit.SECONDS);
                executor.shutdown();

            } catch (java.util.concurrent.TimeoutException e) {
                LOG.errorf("Batch rule execution timeout for tenant %s - possible infinite loop", tenantId);
                metricsService.recordRuleTimeout(tenantId);
                throw new RuntimeException("Batch rule execution timeout exceeded 10 seconds");
            } catch (java.util.concurrent.ExecutionException e) {
                LOG.errorf(e, "Batch rule execution failed for tenant %s", tenantId);
                throw new RuntimeException("Batch rule execution failed", e.getCause());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Batch rule execution interrupted", e);
            }

            // Record metrics
            long evaluationMillis = System.currentTimeMillis() - startTime;
            long processingMicros = (System.nanoTime() - startNanos) / 1000;

            metricsService.recordRuleEvaluation(tenantId, evaluationMillis);

            // Record average processing time per trace
            for (String traceId : traceIds) {
                metricsService.recordTraceProcessingTime(tenantId, traceId, processingMicros / traceIds.size());
            }

            LOG.debugf("Batch evaluation complete: %d spans inserted, %d rules fired (took %d ms)",
                inserted, rulesFired, evaluationMillis);

            // Security: Collect violations from sandboxed RuleContext (P0 #9 fix)
            RuleContext ruleContext = sessionManager.getRuleContext(tenantId);
            if (ruleContext != null && ruleContext.hasViolations()) {
                List<RuleContext.SignalViolation> violations = ruleContext.getViolations();
                LOG.infof("Found %d rule violations in batch for tenant %s", violations.size(), tenantId);

                for (RuleContext.SignalViolation violation : violations) {
                    Signal signal = convertViolationToSignal(violation);
                    signalService.emit(signal);
                }

                // Clear violations for next evaluation cycle
                ruleContext.clearViolations();
            }

        } catch (Exception e) {
            LOG.errorf(e, "Error evaluating batch spans in Drools");
        } finally {
            sessionManager.releaseSession(tenantId);
        }
    }

    /**
     * Convert RuleContext.SignalViolation to Signal entity
     */
    private Signal convertViolationToSignal(RuleContext.SignalViolation violation) {
        Map<String, Object> attributes = new HashMap<>(violation.context);
        attributes.put("ruleName", violation.ruleName);

        return Signal.create(
            violation.ruleId,                  // ruleId
            "1.0",                            // ruleVersion
            null,                             // spanId not available
            violation.traceId,                // traceId
            Signal.SignalSeverity.valueOf(violation.severity.toUpperCase()),  // severity
            violation.description,            // message
            attributes,                       // attributes
            "drools",                         // source
            violation.tenantId                // tenantId
        );
    }

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
