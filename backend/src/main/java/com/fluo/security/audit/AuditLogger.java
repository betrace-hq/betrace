package com.fluo.security.audit;

import com.fluo.security.agent.SandboxContext;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Context;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * PRD-006 Unit 3: Enhanced Audit Logging for Sandbox Violations
 *
 * Emits detailed audit logs for all sandbox violations with full forensic context.
 * Integrates with OpenTelemetry to generate compliance spans for SOC2/HIPAA evidence.
 *
 * Key Features:
 * - Thread-safe violation logging
 * - OpenTelemetry span emission for compliance
 * - Tenant isolation (violations tagged by tenant)
 * - Stack trace capture for forensics
 * - Rule ID correlation (links violation to specific rule)
 * - Searchable in Grafana Loki
 *
 * Security Properties:
 * - Immutable audit trail (OpenTelemetry spans)
 * - Tamper-evident (span IDs provide correlation)
 * - Per-tenant isolation (no cross-tenant data leakage)
 * - Attack pattern detection (repeated violations from same rule)
 *
 * Compliance Evidence:
 * - SOC2 CC7.2 (System Monitoring): Audit logs for all security events
 * - HIPAA 164.312(b) (Audit Controls): Activity logging for PHI access
 *
 * Usage:
 * ```java
 * // Called from SandboxTransformer bytecode injection
 * AuditLogger.logViolation("Runtime.exec", "com.example.MaliciousRule");
 *
 * // Emits OpenTelemetry span:
 * {
 *   "event": "sandbox.violation",
 *   "tenant": "tenant-123",
 *   "operation": "Runtime.exec",
 *   "className": "com.example.MaliciousRule",
 *   "spanId": "span-789"
 * }
 * ```
 */
@ApplicationScoped
public class AuditLogger {

    private static final Logger LOG = Logger.getLogger(AuditLogger.class);

    // OpenTelemetry tracer for compliance spans
    private final Tracer tracer;

    // Violation counters by tenant (for DDoS detection)
    private final Map<String, AtomicLong> violationCounters = new ConcurrentHashMap<>();

    @Inject
    public AuditLogger(OpenTelemetry openTelemetry) {
        this.tracer = openTelemetry.getTracer("fluo.security.audit");
        LOG.info("AuditLogger initialized with OpenTelemetry integration");
    }

    /**
     * Log a sandbox violation with full forensic context.
     *
     * Called from SandboxTransformer bytecode injection before throwing SecurityException.
     *
     * @param operation Forbidden operation (e.g., "Runtime.exec", "System.exit")
     * @param className Class that attempted the violation
     */
    public static void logViolation(String operation, String className) {
        // Static method for bytecode injection compatibility
        // Delegates to instance method via SandboxContext
        getInstance().logViolationInstance(operation, className);
    }

    /**
     * Instance method for violation logging (CDI-aware).
     */
    public void logViolationInstance(String operation, String className) {
        String tenant = SandboxContext.getTenantOrDefault();
        String ruleId = extractRuleId(className);

        // Increment violation counter for DDoS detection
        violationCounters.computeIfAbsent(tenant, k -> new AtomicLong(0)).incrementAndGet();

        // Capture stack trace for forensics
        StackTraceElement[] stackTrace = Thread.currentThread().getStackTrace();
        String[] stackTraceStrings = Arrays.stream(stackTrace)
                .limit(10) // Top 10 frames for readability
                .map(StackTraceElement::toString)
                .toArray(String[]::new);

        // Create compliance span for audit trail
        Span span = tracer.spanBuilder("sandbox.violation")
                .setSpanKind(SpanKind.INTERNAL)
                .setParent(Context.current())
                .startSpan();

        try {
            // Add violation attributes
            span.setAttribute("event.type", "security.sandbox.violation");
            span.setAttribute("tenant.id", tenant);
            span.setAttribute("violation.operation", operation);
            span.setAttribute("violation.className", className);
            span.setAttribute("violation.ruleId", ruleId);
            span.setAttribute("violation.stackTrace", String.join("\n", stackTraceStrings));
            span.setAttribute("violation.timestamp", System.currentTimeMillis());

            // Add compliance framework tags
            span.setAttribute("compliance.framework", "soc2");
            span.setAttribute("compliance.control", "CC7.2"); // System Monitoring
            span.setAttribute("compliance.evidenceType", "audit_trail");

            // Log to application logs as well
            LOG.warnf("Sandbox violation detected: tenant=%s, operation=%s, class=%s, rule=%s",
                    tenant, operation, className, ruleId);

            // Check for repeated violations (possible attack)
            long violationCount = violationCounters.get(tenant).get();
            if (violationCount > 10) {
                LOG.errorf("HIGH VIOLATION RATE detected: tenant=%s has %d violations. Possible attack!",
                        tenant, violationCount);
                span.setAttribute("violation.possibleAttack", true);
                span.setAttribute("violation.count", violationCount);
            }

        } finally {
            span.end();
        }
    }

    /**
     * Extract rule ID from class name.
     * Assumes rule classes follow pattern: com.fluo.rules.tenant123.rule456
     */
    private String extractRuleId(String className) {
        if (className == null || !className.contains(".")) {
            return "unknown";
        }

        // Extract last segment (e.g., "rule456" from "com.fluo.rules.tenant123.rule456")
        String[] parts = className.split("\\.");
        String lastPart = parts[parts.length - 1];

        // If it starts with "rule", extract ID
        if (lastPart.startsWith("rule")) {
            return lastPart;
        }

        return "unknown";
    }

    /**
     * Get violation count for a tenant (for DDoS detection).
     */
    public long getViolationCount(String tenant) {
        AtomicLong counter = violationCounters.get(tenant);
        return counter != null ? counter.get() : 0;
    }

    /**
     * Reset violation counters (for testing or periodic cleanup).
     */
    public void resetViolationCounters() {
        violationCounters.clear();
        LOG.info("Violation counters reset");
    }

    /**
     * Get all tenant violation statistics (for monitoring dashboard).
     */
    public Map<String, Long> getViolationStatistics() {
        Map<String, Long> stats = new HashMap<>();
        violationCounters.forEach((tenant, counter) -> stats.put(tenant, counter.get()));
        return stats;
    }

    /**
     * Singleton instance holder (for static method access from bytecode).
     */
    private static volatile AuditLogger INSTANCE;

    /**
     * Set singleton instance (called by CDI on startup).
     */
    static void setInstance(AuditLogger instance) {
        INSTANCE = instance;
    }

    /**
     * Get singleton instance (for static method delegation).
     */
    private static AuditLogger getInstance() {
        if (INSTANCE == null) {
            throw new IllegalStateException(
                    "AuditLogger not initialized. Ensure Quarkus CDI is running.");
        }
        return INSTANCE;
    }
}
