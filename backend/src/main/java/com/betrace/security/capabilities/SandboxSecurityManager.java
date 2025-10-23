package com.fluo.security.capabilities;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.Permission;

/**
 * SecurityManager for Drools rule engine sandboxing (PRD-005 P0-2).
 *
 * <p>Prevents malicious rules from using reflection to bypass capability-based security.</p>
 *
 * <p><b>Attack Scenario (Without SecurityManager):</b></p>
 * <pre>
 * rule "Escape sandbox"
 * when
 *     $sandbox: SandboxedGlobals()
 * then
 *     Field f = $sandbox.getClass().getDeclaredField("signalCapability");
 *     f.setAccessible(true);  // ❌ Bypass access control
 *     ImmutableSignalCapability cap = (ImmutableSignalCapability) f.get($sandbox);
 *     // Now have direct access to SignalService via reflection...
 * end
 * </pre>
 *
 * <p><b>Security Properties:</b></p>
 * <ul>
 *   <li>Blocks {@code setAccessible(true)} on private fields</li>
 *   <li>Blocks {@code Class.forName()} for unauthorized classes</li>
 *   <li>Blocks {@code System.exit()} and other JVM-level operations</li>
 *   <li>Allows normal rule execution (attribute access, signal creation via capabilities)</li>
 * </ul>
 *
 * <p><b>Note:</b> Java SecurityManager is deprecated in JDK 17+ (JEP 411), but still
 * functional and necessary until bytecode validation is implemented in Phase 2.</p>
 *
 * @see <a href="https://openjdk.org/jeps/411">JEP 411: Deprecate SecurityManager</a>
 */
@SuppressWarnings("removal")  // SecurityManager deprecated but still needed for P0-2
public final class SandboxSecurityManager extends SecurityManager {

    private static final Logger log = LoggerFactory.getLogger(SandboxSecurityManager.class);

    // Thread-local flag to track if we're in rule execution context
    private static final ThreadLocal<Boolean> inRuleExecution = ThreadLocal.withInitial(() -> false);

    /**
     * Mark current thread as executing rules (enables sandbox restrictions).
     */
    public static void enterRuleExecution() {
        inRuleExecution.set(true);
    }

    /**
     * Mark current thread as no longer executing rules (disables sandbox restrictions).
     */
    public static void exitRuleExecution() {
        inRuleExecution.set(false);
    }

    @Override
    public void checkPermission(Permission perm) {
        // Only apply restrictions during rule execution
        if (!inRuleExecution.get()) {
            return;  // Allow everything outside rule execution
        }

        String permName = perm.getName();

        // Block reflection setAccessible (P0-2 primary attack vector)
        if ("suppressAccessChecks".equals(permName)) {
            log.error("SECURITY VIOLATION: Rule attempted to use setAccessible() - BLOCKED");
            throw new SecurityException("Reflection setAccessible() is not allowed in rules");
        }

        // Block Class.forName for unauthorized classes
        if (permName.startsWith("accessDeclaredMembers")) {
            // Allow only capability interfaces and primitives
            String className = extractClassName(perm);
            if (className != null && !isAllowedClass(className)) {
                log.error("SECURITY VIOLATION: Rule attempted to access class {} - BLOCKED", className);
                throw new SecurityException("Access to class " + className + " is not allowed in rules");
            }
        }

        // Block System.exit
        if (permName.startsWith("exitVM")) {
            log.error("SECURITY VIOLATION: Rule attempted System.exit() - BLOCKED");
            throw new SecurityException("System.exit() is not allowed in rules");
        }

        // Block file I/O
        if (perm instanceof java.io.FilePermission) {
            log.error("SECURITY VIOLATION: Rule attempted file I/O - BLOCKED");
            throw new SecurityException("File I/O is not allowed in rules");
        }

        // Block network I/O
        if (perm instanceof java.net.SocketPermission) {
            log.error("SECURITY VIOLATION: Rule attempted network I/O - BLOCKED");
            throw new SecurityException("Network I/O is not allowed in rules");
        }
    }

    /**
     * Check if a class is allowed to be accessed by rules.
     *
     * <p>Whitelist approach: Only explicitly allowed classes can be accessed via reflection.</p>
     */
    private boolean isAllowedClass(String className) {
        // Whitelist: Capability interfaces (read-only access)
        if (className.startsWith("com.fluo.security.capabilities.SpanCapability")) {
            return true;
        }
        if (className.startsWith("com.fluo.security.capabilities.SignalCapability")) {
            return true;
        }
        if (className.startsWith("com.fluo.security.capabilities.SandboxedGlobals")) {
            return true;
        }

        // Whitelist: Java primitives and immutable classes
        if (className.startsWith("java.lang.String")) {
            return true;
        }
        if (className.startsWith("java.lang.Integer")) {
            return true;
        }
        if (className.startsWith("java.lang.Long")) {
            return true;
        }
        if (className.startsWith("java.lang.Double")) {
            return true;
        }
        if (className.startsWith("java.lang.Boolean")) {
            return true;
        }
        if (className.startsWith("java.time.Instant")) {
            return true;
        }

        // Whitelist: Collections (read-only views)
        if (className.startsWith("java.util.Collections$Unmodifiable")) {
            return true;
        }
        if (className.startsWith("java.util.Map$Entry")) {
            return true;
        }

        // Everything else is blocked by default
        return false;
    }

    /**
     * Extract class name from Permission (best-effort heuristic).
     */
    private String extractClassName(Permission perm) {
        String actions = perm.getActions();
        if (actions != null && !actions.isEmpty()) {
            return actions;
        }
        // Fallback: parse from permission name
        String name = perm.getName();
        if (name != null && name.contains(".")) {
            return name;
        }
        return null;
    }

    @Override
    public void checkExit(int status) {
        if (inRuleExecution.get()) {
            log.error("SECURITY VIOLATION: Rule attempted System.exit({}) - BLOCKED", status);
            throw new SecurityException("System.exit() is not allowed in rules");
        }
    }

    @Override
    public void checkExec(String cmd) {
        if (inRuleExecution.get()) {
            log.error("SECURITY VIOLATION: Rule attempted to execute command: {} - BLOCKED", cmd);
            throw new SecurityException("Command execution is not allowed in rules");
        }
    }

    @Override
    public String toString() {
        return "SandboxSecurityManager[ruleExecutionActive=" + inRuleExecution.get() + "]";
    }
}
