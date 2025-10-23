package com.betrace.security.agent;

import java.lang.instrument.Instrumentation;
import java.util.logging.Logger;

/**
 * Java Instrumentation Agent for rule engine sandboxing.
 *
 * Replaces deprecated SecurityManager (JEP 411) with bytecode-level restrictions.
 *
 * Security Properties:
 * - Blocks reflection API abuse (setAccessible, Unsafe access)
 * - Prevents System.exit() calls
 * - Blocks file I/O operations
 * - Prevents network I/O operations
 * - Injects resource limits (heap, CPU time)
 *
 * Usage:
 *   java -javaagent:fluo-sandbox-agent.jar -jar fluo-backend.jar
 *
 * Thread Safety:
 *   ThreadLocal context tracks rule execution state
 *
 * @see SandboxTransformer
 * @see SandboxContext
 */
public class SandboxAgent {

    private static final Logger log = Logger.getLogger(SandboxAgent.class.getName());

    private static Instrumentation instrumentation;

    /**
     * JVM entry point for agent initialization.
     *
     * Called by JVM before main() when -javaagent flag is present.
     *
     * @param agentArgs Optional agent arguments (unused)
     * @param inst Instrumentation interface for bytecode transformation
     */
    public static void premain(String agentArgs, Instrumentation inst) {
        log.info("FLUO Sandbox Agent initializing...");

        instrumentation = inst;

        // Register bytecode transformer
        SandboxTransformer transformer = new SandboxTransformer();
        inst.addTransformer(transformer, true);

        log.info("FLUO Sandbox Agent initialized - reflection restrictions active");
        log.info("SecurityManager deprecated API replaced with bytecode enforcement");
    }

    /**
     * Get instrumentation interface for runtime bytecode operations.
     *
     * @return Instrumentation instance, or null if agent not loaded
     */
    public static Instrumentation getInstrumentation() {
        return instrumentation;
    }

    /**
     * Check if sandbox agent is active.
     *
     * @return true if agent is loaded and active
     */
    public static boolean isActive() {
        return instrumentation != null;
    }
}
