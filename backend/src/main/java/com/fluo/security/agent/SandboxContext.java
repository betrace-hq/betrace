package com.fluo.security.agent;

/**
 * Thread-local execution context for sandbox enforcement.
 *
 * Tracks whether current thread is executing rule code, enabling
 * bytecode-level restrictions only during rule execution.
 *
 * Thread Safety:
 *   ThreadLocal ensures per-thread isolation
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

    private SandboxContext() {
        // Utility class
    }

    /**
     * Mark current thread as executing rule code.
     *
     * Activates bytecode-level restrictions for:
     * - Reflection API (setAccessible, Unsafe)
     * - System.exit()
     * - File I/O
     * - Network I/O
     */
    public static void enterRuleExecution() {
        inRuleExecution.set(true);
    }

    /**
     * Mark current thread as exiting rule code.
     *
     * Deactivates bytecode-level restrictions.
     */
    public static void exitRuleExecution() {
        inRuleExecution.set(false);
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
     * Called during thread cleanup to prevent memory leaks.
     */
    public static void clear() {
        inRuleExecution.remove();
    }
}
