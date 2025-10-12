package com.fluo.processors;

import com.fluo.model.Signal;
import com.fluo.model.Span;
import com.fluo.rules.RuleContext;
import com.fluo.security.capabilities.ImmutableSpanWrapper;
import com.fluo.security.capabilities.SandboxSecurityManager;
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

    @Inject
    TenantSessionManager sessionManager;

    @Inject
    MetricsService metricsService;

    @Inject
    SignalService signalService;

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

            // Security P0 #1 (PRD-005): Wrap span in immutable capability before insertion
            // This prevents rules from mutating span data or accessing mutable collections
            ImmutableSpanWrapper wrappedSpan = ImmutableSpanWrapper.forTenant(span, tenantId);
            session.insert(wrappedSpan);

            // Security P0 #2 (PRD-005): Enable SecurityManager to block reflection attacks
            // Fire rules with execution timeout and sandbox protection
            int rulesFired;
            try {
                // 5 second timeout per rule evaluation
                java.util.concurrent.ExecutorService executor =
                    java.util.concurrent.Executors.newSingleThreadExecutor();
                java.util.concurrent.Future<Integer> future =
                    executor.submit(() -> {
                        try {
                            // Enable sandbox restrictions for this thread
                            SandboxSecurityManager.enterRuleExecution();
                            return session.fireAllRules();
                        } finally {
                            // Always disable sandbox restrictions after rule execution
                            SandboxSecurityManager.exitRuleExecution();
                        }
                    });

                rulesFired = future.get(5, java.util.concurrent.TimeUnit.SECONDS);
                executor.shutdown();

            } catch (java.util.concurrent.TimeoutException e) {
                LOG.errorf("Rule execution timeout for tenant %s - possible infinite loop", tenantId);
                metricsService.recordRuleTimeout(tenantId);
                throw new RuntimeException("Rule execution timeout exceeded 5 seconds");
            } catch (java.util.concurrent.ExecutionException e) {
                LOG.errorf(e, "Rule execution failed for tenant %s", tenantId);
                throw new RuntimeException("Rule execution failed", e.getCause());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Rule execution interrupted", e);
            }

            // Record metrics
            long evaluationMillis = System.currentTimeMillis() - startTime;
            long processingMicros = (System.nanoTime() - startNanos) / 1000;

            metricsService.recordRuleEvaluation(tenantId, evaluationMillis);
            metricsService.recordTraceProcessingTime(tenantId, span.traceId(), processingMicros);

            if (rulesFired > 0) {
                LOG.debugf("Fired %d rules for span %s in trace %s (took %d ms)",
                    rulesFired, span.spanId(), span.traceId(), evaluationMillis);
            }

            // Security: Collect violations from sandboxed RuleContext (P0 #9 fix)
            RuleContext ruleContext = sessionManager.getRuleContext(tenantId);
            if (ruleContext != null && ruleContext.hasViolations()) {
                List<RuleContext.SignalViolation> violations = ruleContext.getViolations();
                LOG.infof("Found %d rule violations for tenant %s", violations.size(), tenantId);

                for (RuleContext.SignalViolation violation : violations) {
                    Signal signal = convertViolationToSignal(violation);
                    signalService.emit(signal);
                }

                // Clear violations for next evaluation cycle
                ruleContext.clearViolations();
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

