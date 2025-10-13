package com.fluo.security.agent;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * Thread-local execution context for sandbox enforcement.
 *
 * PRD-006 Unit 1: Performance Monitoring
 * Tracks whether current thread is executing rule code, enabling
 * bytecode-level restrictions only during rule execution.
 *
 * Performance Monitoring:
 *   - Tracks sandbox invocations (enter/exit)
 *   - Measures execution time within sandbox context
 *   - Counts violations by type and tenant
 *
 * Thread Safety:
 *   ThreadLocal ensures per-thread isolation
 *   Micrometer counters are thread-safe
 *
 * Usage:
 *   SandboxContext.enterRuleExecution();
 *   try {
 *       session.fireAllRules();  // Restrictions active
 *   } finally {
 *       SandboxContext.exitRuleExecution();
 *   }
 */
public final class SandboxContext {

    private static final ThreadLocal<Boolean> inRuleExecution = ThreadLocal.withInitial(() -> false);
    private static final ThreadLocal<Long> executionStartTime = new ThreadLocal<>();
    private static final ThreadLocal<String> currentTenant = new ThreadLocal<>();

    // Micrometer registry (lazily initialized to support agent loading before Quarkus)
    private static volatile MeterRegistry meterRegistry = new SimpleMeterRegistry();

    // Metric names (constants for consistency)
    private static final String METRIC_INVOCATIONS = "sandbox.invocations.total";
    private static final String METRIC_VIOLATIONS = "sandbox.violations.total";
    private static final String METRIC_EXECUTION_TIME = "sandbox.execution.duration";

    private SandboxContext() {
        // Utility class
    }

    /**
     * Set the MeterRegistry for metrics collection.
     *
     * Called by Quarkus during application startup to inject the CDI MeterRegistry.
     *
     * @param registry The Micrometer MeterRegistry
     */
    public static void setMeterRegistry(MeterRegistry registry) {
        if (registry != null) {
            meterRegistry = registry;
        }
    }

    /**
     * Set the tenant ID for current thread context.
     *
     * Used for tenant-specific metrics tagging.
     *
     * @param tenantId The tenant identifier
     */
    public static void setTenant(String tenantId) {
        currentTenant.set(tenantId != null ? tenantId : "unknown");
    }

    /**
     * Mark current thread as executing rule code.
     *
     * PRD-006: Tracks invocation metrics and starts execution timer.
     *
     * Activates bytecode-level restrictions for:
     * - Reflection API (setAccessible, Unsafe)
     * - System.exit()
     * - File I/O
     * - Network I/O
     */
    public static void enterRuleExecution() {
        inRuleExecution.set(true);
        executionStartTime.set(System.nanoTime());

        // Increment invocation counter
        String tenant = getTenantOrDefault();
        Counter.builder(METRIC_INVOCATIONS)
                .tag("operation", "enter")
                .tag("tenant", tenant)
                .register(meterRegistry)
                .increment();
    }

    /**
     * Mark current thread as exiting rule code.
     *
     * PRD-006: Records execution duration and tracks exit metrics.
     *
     * Deactivates bytecode-level restrictions.
     */
    public static void exitRuleExecution() {
        // Calculate execution time
        Long startTime = executionStartTime.get();
        if (startTime != null) {
            long durationNanos = System.nanoTime() - startTime;
            String tenant = getTenantOrDefault();

            // Record execution duration
            Timer.builder(METRIC_EXECUTION_TIME)
                    .tag("tenant", tenant)
                    .register(meterRegistry)
                    .record(durationNanos, java.util.concurrent.TimeUnit.NANOSECONDS);

            executionStartTime.remove();
        }

        // Increment exit counter
        Counter.builder(METRIC_INVOCATIONS)
                .tag("operation", "exit")
                .tag("tenant", getTenantOrDefault())
                .register(meterRegistry)
                .increment();

        inRuleExecution.set(false);
    }

    /**
     * Record a sandbox violation.
     *
     * PRD-006: Tracks violations by type and tenant for security monitoring.
     *
     * @param violationType The type of violation (e.g., "reflection", "runtime.exec")
     */
    public static void recordViolation(String violationType) {
        String tenant = getTenantOrDefault();
        Counter.builder(METRIC_VIOLATIONS)
                .tag("violation_type", violationType)
                .tag("tenant", tenant)
                .register(meterRegistry)
                .increment();
    }

    /**
     * Check if current thread is executing rule code.
     *
     * @return true if restrictions are active for this thread
     */
    public static boolean isInRuleExecution() {
        return inRuleExecution.get();
    }

    /**
     * Clear thread-local state.
     *
     * PRD-006: Clears all thread-local variables including timing data.
     *
     * Called during thread cleanup to prevent memory leaks.
     */
    public static void clear() {
        inRuleExecution.remove();
        executionStartTime.remove();
        currentTenant.remove();
    }

    /**
     * Get current tenant ID or default value.
     *
     * @return Tenant ID or "unknown" if not set
     */
    public static String getTenantOrDefault() {
        String tenant = currentTenant.get();
        return tenant != null ? tenant : "unknown";
    }

    /**
     * Get current MeterRegistry for testing.
     *
     * @return The current MeterRegistry
     */
    static MeterRegistry getMeterRegistry() {
        return meterRegistry;
    }
}
