package com.betrace.security;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.util.List;
import java.util.logging.Logger;

/**
 * Validates JVM security configuration at startup.
 *
 * Security Concern: Attackers can bypass module restrictions with JVM flags:
 *   java --add-opens java.base/java.lang=ALL-UNNAMED ...
 *
 * This validator detects and rejects dangerous JVM flags that weaken sandbox.
 *
 * Forbidden Flags:
 * - --add-opens: Opens sealed modules, bypasses encapsulation
 * - --add-exports: Exports internal APIs, allows reflection bypass
 * - --illegal-access=permit: Allows illegal reflective access
 * - --add-modules=jdk.unsupported: Enables Unsafe API
 *
 * Compliance:
 * - SOC2 CC6.3 (Data Isolation) - Module boundary enforcement
 * - SOC2 CC8.1 (Change Management) - Prevents runtime configuration tampering
 *
 * @see com.betrace.security.agent.SandboxAgent
 */
@ApplicationScoped
public class JvmSecurityValidator {

    private static final Logger log = Logger.getLogger(JvmSecurityValidator.class.getName());

    /**
     * Forbidden JVM flags that weaken security sandbox.
     */
    private static final String[] FORBIDDEN_FLAGS = {
        "--add-opens",
        "--add-exports",
        "--illegal-access=permit",
        "--add-modules=jdk.unsupported",
        "--permit-illegal-access",
        "-Xbootclasspath"
    };

    /**
     * Validate JVM configuration at application startup.
     *
     * Throws SecurityException if dangerous flags detected.
     *
     * @param event Quarkus startup event
     */
    void onStart(@Observes StartupEvent event) {
        log.info("Validating JVM security configuration...");

        RuntimeMXBean runtimeMXBean = ManagementFactory.getRuntimeMXBean();
        List<String> jvmArgs = runtimeMXBean.getInputArguments();

        log.fine("JVM arguments: " + String.join(" ", jvmArgs));

        // Check for forbidden flags
        for (String arg : jvmArgs) {
            for (String forbidden : FORBIDDEN_FLAGS) {
                if (arg.contains(forbidden)) {
                    String message = String.format(
                        "SECURITY VIOLATION: Forbidden JVM flag detected: '%s'. " +
                        "This flag weakens sandbox security. Remove it and restart.",
                        arg
                    );
                    log.severe(message);
                    throw new SecurityException(message);
                }
            }
        }

        // Warn about development mode flags (not blocking, but should not be in production)
        if (isProductionMode() && hasDevelopmentFlags(jvmArgs)) {
            log.warning("Development JVM flags detected in production mode. Review configuration.");
        }

        log.info("JVM security validation passed ✓");
    }

    /**
     * Check if application is running in production mode.
     *
     * @return true if production mode
     */
    private boolean isProductionMode() {
        String profile = System.getProperty("quarkus.profile");
        return profile != null && profile.equals("prod");
    }

    /**
     * Check if JVM args contain development-only flags.
     *
     * @param jvmArgs JVM arguments
     * @return true if development flags present
     */
    private boolean hasDevelopmentFlags(List<String> jvmArgs) {
        return jvmArgs.stream().anyMatch(arg ->
            arg.contains("-agentlib:jdwp") ||  // Debugger
            arg.contains("-Xdebug") ||          // Debug mode
            arg.contains("-XX:+UnlockDiagnosticVMOptions")  // Diagnostic options
        );
    }
}
