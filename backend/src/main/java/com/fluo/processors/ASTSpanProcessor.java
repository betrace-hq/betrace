package com.fluo.processors;

import com.fluo.model.Signal;
import com.fluo.model.Span;
import com.fluo.rules.RuleContext;
import com.fluo.rules.dsl.ASTInterpreter;
import com.fluo.services.ASTRuleManager;
import com.fluo.services.SignalService;
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
    SignalService signalService;

    @Inject
    ASTInterpreter interpreter;

    // Group spans by trace for pattern matching
    private final Map<String, List<Span>> traceBuffers = new HashMap<>();
    private final Map<String, Long> traceTimestamps = new HashMap<>();

    // Timeout for incomplete traces (5 seconds)
    private static final long TRACE_TIMEOUT_MS = 5000;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract tenant ID from header (set by TenantSecurityProcessor)
        String tenantId = exchange.getIn().getHeader("X-Tenant-ID", String.class);
        if (tenantId == null) {
            LOG.warn("No tenant ID found in exchange, skipping rule evaluation");
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
            LOG.warnf("Unsupported body type for rule evaluation: %s",
                body != null ? body.getClass().getName() : "null");
            return;
        }

        if (span == null) {
            LOG.warn("Failed to convert body to Span, skipping rule evaluation");
            return;
        }

        // Record span ingestion metric
        metricsService.recordSpanIngested(tenantId);

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
            evaluateTrace(tenantId, traceId);
        }

        // Clean up old incomplete traces
        cleanupOldTraces();
    }

    /**
     * Evaluate all rules against spans in a trace
     */
    private void evaluateTrace(String tenantId, String traceId) {
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

            LOG.debugf("Evaluating %d spans for trace %s (tenant %s)", spans.size(), traceId, tenantId);

            // Get compiled rules for tenant
            Map<String, ASTInterpreter.CompiledRule> rules = ruleManager.getRulesForTenant(tenantId);

            if (rules == null || rules.isEmpty()) {
                LOG.debugf("No rules defined for tenant %s", tenantId);
                return;
            }

            // Create sandboxed RuleContext
            RuleContext ruleContext = RuleContext.forTenant(tenantId);

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
                LOG.errorf("Rule execution timeout for tenant %s, trace %s", tenantId, traceId);
                metricsService.recordRuleTimeout(tenantId);
                throw new RuntimeException("Rule execution timeout exceeded 5 seconds");
            } catch (java.util.concurrent.ExecutionException e) {
                LOG.errorf(e, "Rule execution failed for tenant %s, trace %s", tenantId, traceId);
                throw new RuntimeException("Rule execution failed", e.getCause());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Rule execution interrupted", e);
            }

            // Record metrics
            long evaluationMillis = System.currentTimeMillis() - startTime;
            long processingMicros = (System.nanoTime() - startNanos) / 1000;

            metricsService.recordRuleEvaluation(tenantId, evaluationMillis);
            metricsService.recordTraceProcessingTime(tenantId, traceId, processingMicros);

            if (rulesFired > 0) {
                LOG.debug(String.format("Found %d violations for trace %s (took %d ms)",
                    rulesFired, traceId, evaluationMillis));
            }

            // Collect violations from RuleContext and emit signals
            if (ruleContext.hasViolations()) {
                List<RuleContext.SignalViolation> violations = ruleContext.getViolations();

                for (RuleContext.SignalViolation violation : violations) {
                    Signal signal = convertViolationToSignal(violation);
                    signalService.emit(signal);
                }

                // Clear violations for next evaluation cycle
                ruleContext.clearViolations();
            }

        } catch (Exception e) {
            LOG.errorf(e, "Error evaluating trace %s for tenant %s", traceId, tenantId);
            // Don't fail the exchange - span ingestion should continue even if rule evaluation fails
        }
    }

    /**
     * Clean up traces that have been buffered too long (incomplete traces)
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
                    String tenantId = spans.get(0).tenantId();
                    LOG.debugf("Evaluating incomplete trace %s after timeout (tenant %s)", traceId, tenantId);
                    evaluateTrace(tenantId, traceId);
                }
            }
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
            "ast-interpreter",                // source
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
