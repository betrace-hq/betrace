package com.fluo.processors;

import com.fluo.compliance.evidence.ViolationSpan;
import com.fluo.model.Span;
import com.fluo.rules.RuleContext;
import com.fluo.rules.dsl.ASTInterpreter;
import com.fluo.services.ASTRuleManager;
import com.fluo.services.ViolationStore;
import com.fluo.services.MetricsService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.*;

/**
 * Camel processor that evaluates spans using safe AST interpreter (replaces Drools).
 *
 * <p><b>Security Model:</b></p>
 * <ul>
 *   <li>No Java code execution - interprets AST directly</li>
 *   <li>No reflection possible - pure data structure traversal</li>
 *   <li>Sandboxed RuleContext for violation recording</li>
 *   <li>5 second execution timeout per trace</li>
 * </ul>
 *
 * <p>This replaces DroolsSpanProcessor to fix P0 #10 (reflection bypass).</p>
 */
@ApplicationScoped
@Named("astSpanProcessor")
public class ASTSpanProcessor implements Processor {

    private static final Logger LOG = Logger.getLogger(ASTSpanProcessor.class);

    @Inject
    ASTRuleManager ruleManager;

    @Inject
    MetricsService metricsService;

    @Inject
    ViolationStore violationStore;

    @Inject
    ASTInterpreter interpreter;

    // Group spans by trace for pattern matching
    private final Map<String, List<Span>> traceBuffers = new HashMap<>();
    private final Map<String, Long> traceTimestamps = new HashMap<>();

    // Timeout for incomplete traces (5 seconds)
    private static final long TRACE_TIMEOUT_MS = 5000;

    @Override
    public void process(Exchange exchange) throws Exception {
        // ADR-023: Single-tenant deployment (no tenant ID extraction needed)

        // Get or parse span from body
        Object body = exchange.getIn().getBody();
        Span span = null;

        if (body instanceof Span) {
            span = (Span) body;
        } else if (body instanceof Map) {
            span = convertMapToSpan((Map<String, Object>) body);
        } else {
            LOG.warnf("Unsupported body type for rule evaluation: %s",
                body != null ? body.getClass().getName() : "null");
            return;
        }

        if (span == null) {
            LOG.warn("Failed to convert body to Span, skipping rule evaluation");
            return;
        }

        // Buffer span by trace
        String traceId = span.traceId();
        synchronized (traceBuffers) {
            traceBuffers.computeIfAbsent(traceId, k -> new ArrayList<>()).add(span);
            traceTimestamps.put(traceId, System.currentTimeMillis());
        }

        // Check if trace is complete (heuristic: root span received)
        boolean isRootSpan = span.parentSpanId() == null || span.parentSpanId().isEmpty();

        if (isRootSpan) {
            // Evaluate trace immediately
            evaluateTrace(traceId);
        }

        // Clean up old incomplete traces
        cleanupOldTraces();
    }

    /**
     * Evaluate all rules against spans in a trace.
     * ADR-023: Single-tenant deployment - one set of rules for entire deployment.
     */
    private void evaluateTrace(String traceId) {
        List<Span> spans;
        synchronized (traceBuffers) {
            spans = traceBuffers.remove(traceId);
            traceTimestamps.remove(traceId);
        }

        if (spans == null || spans.isEmpty()) {
            return;
        }

        try {
            long startTime = System.currentTimeMillis();
            long startNanos = System.nanoTime();

            LOG.debugf("Evaluating %d spans for trace %s", spans.size(), traceId);

            // ADR-023: Single-tenant deployment (use default tenant ID)
            final String DEFAULT_TENANT = "default";
            Map<String, ASTInterpreter.CompiledRule> rules = ruleManager.getRulesForTenant(DEFAULT_TENANT);

            if (rules == null || rules.isEmpty()) {
                LOG.debug("No rules defined for default tenant");
                return;
            }

            // Create sandboxed RuleContext (ADR-023: single-tenant with default ID)
            RuleContext ruleContext = RuleContext.forTenant(DEFAULT_TENANT);

            // Security: Evaluate with timeout (P0 #11 fix)
            int rulesFired = 0;
            try {
                java.util.concurrent.ExecutorService executor =
                    java.util.concurrent.Executors.newSingleThreadExecutor();
                java.util.concurrent.Future<Integer> future = executor.submit(() -> {
                    interpreter.evaluateRules(rules, spans, ruleContext);
                    return ruleContext.getViolationCount();
                });

                rulesFired = future.get(5, java.util.concurrent.TimeUnit.SECONDS);
                executor.shutdown();

            } catch (java.util.concurrent.TimeoutException e) {
                LOG.errorf("Rule execution timeout for trace %s", traceId);
                metricsService.recordRuleTimeout(DEFAULT_TENANT);
                throw new RuntimeException("Rule execution timeout exceeded 5 seconds");
            } catch (java.util.concurrent.ExecutionException e) {
                LOG.errorf(e, "Rule execution failed for trace %s", traceId);
                throw new RuntimeException("Rule execution failed", e.getCause());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Rule execution interrupted", e);
            }

            // Record metrics (ADR-023: single-tenant with default tenant ID)
            long evaluationMillis = System.currentTimeMillis() - startTime;
            long processingMicros = (System.nanoTime() - startNanos) / 1000;

            metricsService.recordRuleEvaluation(DEFAULT_TENANT, evaluationMillis);
            metricsService.recordTraceProcessingTime(DEFAULT_TENANT, traceId, processingMicros);

            if (rulesFired > 0) {
                LOG.debug(String.format("Found %d violations for trace %s (took %d ms)",
                    rulesFired, traceId, evaluationMillis));
            }

            // ADR-026: Emit violation spans (replaces Signal model)
            if (ruleContext.hasViolations()) {
                List<RuleContext.SignalViolation> violations = ruleContext.getViolations();

                for (RuleContext.SignalViolation violation : violations) {
                    ViolationSpan violationSpan = convertViolationToSpan(violation);
                    violationStore.store(violationSpan);
                }

                // Clear violations for next evaluation cycle
                ruleContext.clearViolations();
            }

        } catch (Exception e) {
            LOG.errorf(e, "Error evaluating trace %s", traceId);
            // Don't fail the exchange - span ingestion should continue even if rule evaluation fails
        }
    }

    /**
     * Clean up traces that have been buffered too long (incomplete traces).
     * ADR-023: Single-tenant deployment.
     */
    private void cleanupOldTraces() {
        long now = System.currentTimeMillis();
        List<String> expiredTraces = new ArrayList<>();

        synchronized (traceBuffers) {
            for (Map.Entry<String, Long> entry : traceTimestamps.entrySet()) {
                if (now - entry.getValue() > TRACE_TIMEOUT_MS) {
                    expiredTraces.add(entry.getKey());
                }
            }

            for (String traceId : expiredTraces) {
                List<Span> spans = traceBuffers.remove(traceId);
                traceTimestamps.remove(traceId);

                if (spans != null && !spans.isEmpty()) {
                    LOG.debugf("Evaluating incomplete trace %s after timeout", traceId);
                    evaluateTrace(traceId);
                }
            }
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
        builder.attribute("source", "ast-interpreter");

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
