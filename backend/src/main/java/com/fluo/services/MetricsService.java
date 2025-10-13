package com.fluo.services;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Centralized metrics service for FLUO performance and compliance monitoring.
 * Exposes Prometheus metrics for Grafana dashboards.
 */
@ApplicationScoped
public class MetricsService {

    @Inject
    MeterRegistry registry;

    // Counters
    private Counter spansIngestedCounter;
    private final Map<String, Counter> rulesFiredCounters = new ConcurrentHashMap<>();
    private final Map<String, Counter> complianceSignalCounters = new ConcurrentHashMap<>();

    // Timers (histograms)
    private Timer ruleEvaluationTimer;

    // Summaries (for trace processing time)
    private Timer traceProcessingTimer;

    // Gauges (per-tenant session memory and active traces)
    private final Map<String, Gauge> sessionMemoryGauges = new ConcurrentHashMap<>();
    private final Map<String, Gauge> activeTracesGauges = new ConcurrentHashMap<>();

    /**
     * Initialize base metrics on startup
     */
    public void init() {
        spansIngestedCounter = Counter.builder("fluo_spans_ingested_total")
            .description("Total number of spans ingested")
            .tag("component", "ingestion")
            .register(registry);

        ruleEvaluationTimer = Timer.builder("fluo_rule_evaluation_duration_milliseconds")
            .description("Duration of rule evaluation in milliseconds")
            .tag("component", "rules")
            .register(registry);

        traceProcessingTimer = Timer.builder("fluo_trace_processing_time_microseconds")
            .description("CPU time spent processing traces in microseconds")
            .tag("component", "processing")
            .register(registry);
    }

    /**
     * Record a span ingestion
     */
    public void recordSpanIngested(String tenantId) {
        if (spansIngestedCounter == null) {
            init();
        }
        Counter.builder("fluo_spans_ingested_total")
            .description("Total number of spans ingested")
            .tag("tenant_id", tenantId)
            .register(registry)
            .increment();
    }

    /**
     * Record rule evaluation time
     */
    public void recordRuleEvaluation(String tenantId, long durationMillis) {
        if (ruleEvaluationTimer == null) {
            init();
        }
        Timer.builder("fluo_rule_evaluation_duration_milliseconds")
            .description("Duration of rule evaluation in milliseconds")
            .tag("tenant_id", tenantId)
            .register(registry)
            .record(java.time.Duration.ofMillis(durationMillis));
    }

    /**
     * Record trace processing time
     */
    public void recordTraceProcessingTime(String tenantId, String traceId, long microseconds) {
        if (traceProcessingTimer == null) {
            init();
        }
        Timer.builder("fluo_trace_processing_time_microseconds")
            .description("CPU time spent processing traces in microseconds")
            .tag("tenant_id", tenantId)
            .tag("trace_id", traceId)
            .register(registry)
            .record(java.time.Duration.ofNanos(microseconds * 1000));
    }

    /**
     * Record a rule firing
     */
    public void recordRuleFired(String tenantId, String ruleId, String ruleName) {
        String key = tenantId + ":" + ruleId;
        Counter counter = rulesFiredCounters.computeIfAbsent(key, k ->
            Counter.builder("fluo_rules_fired_total")
                .description("Total number of times rules have fired")
                .tag("tenant_id", tenantId)
                .tag("rule_id", ruleId)
                .tag("rule_name", ruleName)
                .register(registry)
        );
        counter.increment();
    }

    /**
     * Record a compliance signal (invariant violation)
     */
    public void recordComplianceSignal(String tenantId, String ruleName, String severity, String framework) {
        String key = tenantId + ":" + ruleName + ":" + severity;
        Counter counter = complianceSignalCounters.computeIfAbsent(key, k ->
            Counter.builder("fluo_compliance_signals_total")
                .description("Total number of compliance invariant violations detected")
                .tag("tenant_id", tenantId)
                .tag("rule_name", ruleName)
                .tag("severity", severity)
                .tag("framework", framework != null ? framework : "unknown")
                .register(registry)
        );
        counter.increment();
    }

    /**
     * Register session memory gauge for a tenant
     */
    public void registerSessionMemoryGauge(String tenantId, java.util.function.Supplier<Long> valueSupplier) {
        sessionMemoryGauges.computeIfAbsent(tenantId, k ->
            Gauge.builder("fluo_drools_session_memory_bytes", valueSupplier, supplier -> supplier.get().doubleValue())
                .description("Memory used by Drools session in bytes")
                .tag("tenant_id", tenantId)
                .register(registry)
        );
    }

    /**
     * Register active traces gauge for a tenant
     */
    public void registerActiveTracesGauge(String tenantId, java.util.function.Supplier<Integer> valueSupplier) {
        activeTracesGauges.computeIfAbsent(tenantId, k ->
            Gauge.builder("fluo_drools_active_traces", valueSupplier, supplier -> supplier.get().doubleValue())
                .description("Number of active traces in Drools session")
                .tag("tenant_id", tenantId)
                .register(registry)
        );
    }

    // === Rate Limiting Metrics (PRD-007c) ===

    /**
     * Record rate limit violation.
     *
     * @param tenantId Tenant UUID (for logging, not metrics)
     * @param limitType Type of limit violated (tenant/user/anonymous)
     * @param retryAfter Seconds to wait before retrying
     */
    public void recordRateLimitViolation(java.util.UUID tenantId, String limitType, long retryAfter) {
        // Counter with only limit_type tag (low cardinality)
        Counter.builder("fluo_ratelimit_violations_total")
            .description("Total number of rate limit violations")
            .tag("limit_type", limitType)
            .register(registry)
            .increment();

        // Gauge for latest retry-after value
        Gauge.builder("fluo_ratelimit_retry_after_seconds", () -> (double) retryAfter)
            .description("Seconds to wait before retrying after rate limit")
            .register(registry);
    }

    /**
     * Record allowed request (passed rate limiting).
     *
     * @param tenantId Tenant UUID (for logging, not metrics)
     * @param userId User ID (for logging, not metrics)
     */
    public void recordAllowedRequest(java.util.UUID tenantId, String userId) {
        // Aggregate counter without tenant/user tags
        Counter.builder("fluo_ratelimit_allowed_total")
            .description("Total number of requests that passed rate limiting")
            .register(registry)
            .increment();
    }

    /**
     * Record rate limit utilization (percentage of quota used).
     *
     * @param tenantId Tenant UUID
     * @param tokensRemaining Tokens remaining in bucket
     * @param maxTokens Maximum tokens
     */
    public void recordRateLimitUtilization(java.util.UUID tenantId, double tokensRemaining, double maxTokens) {
        double utilizationPercent = ((maxTokens - tokensRemaining) / maxTokens) * 100;

        registry.summary(
            "fluo_ratelimit_utilization_percent",
            "limit_type", "tenant"
        ).record(utilizationPercent);
    }

    // === Trace Storage Metrics (PRD-002b) ===

    /**
     * Record trace stored in DuckDB.
     *
     * @param tenantId Tenant UUID (for logging, not metrics)
     * @param spanCount Number of spans in trace
     * @param durationMs Storage operation duration
     */
    public void recordTraceStored(java.util.UUID tenantId, int spanCount, long durationMs) {
        Counter.builder("fluo_trace_storage_total")
            .description("Total number of traces stored in DuckDB")
            .register(registry)
            .increment();

        registry.summary("fluo_trace_storage_duration_ms")
            .record(durationMs);

        registry.summary("fluo_trace_span_count")
            .record(spanCount);
    }

    /**
     * Record trace storage error.
     *
     * @param tenantId Tenant UUID (for logging, not metrics)
     */
    public void recordTraceStorageError(java.util.UUID tenantId) {
        Counter.builder("fluo_trace_storage_errors_total")
            .description("Total number of trace storage errors")
            .register(registry)
            .increment();
    }

    // === Rule Execution Metrics (Security) ===

    /**
     * Record rule execution timeout (P0 #11 - infinite loop detection).
     *
     * @param tenantId Tenant ID where timeout occurred
     */
    public void recordRuleTimeout(String tenantId) {
        Counter.builder("fluo_rule_timeout_total")
            .description("Total number of rule execution timeouts (infinite loops)")
            .tag("tenant_id", tenantId)
            .register(registry)
            .increment();
    }

    // === Injection Attempt Metrics (PRD-007 Unit D) ===

    /**
     * Record injection attempt detection.
     *
     * PRD-007 Unit D: Request Sanitization & Injection Prevention
     *
     * @param tenantId Tenant ID (for logging, not metrics)
     * @param userId User ID (for logging, not metrics)
     * @param injectionType Type of injection (sql_injection, xss, ldap_injection, command_injection)
     */
    public void recordInjectionAttempt(java.util.UUID tenantId, String userId, String injectionType) {
        Counter.builder("fluo_security_injection_attempts_total")
            .description("Total number of injection attempts detected and blocked")
            .tag("injection_type", injectionType != null ? injectionType : "unknown")
            .register(registry)
            .increment();
    }
}
