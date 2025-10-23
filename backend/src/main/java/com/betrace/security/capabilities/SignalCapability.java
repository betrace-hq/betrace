package com.betrace.security.capabilities;

import java.util.Map;

/**
 * Capability for creating signals from within Drools rules.
 *
 * This interface provides a sandboxed way for rules to emit signals
 * without direct access to the SignalService or other internal services.
 *
 * Security Design (PRD-005):
 * - Rules can ONLY create signals, not query/modify existing ones
 * - No access to signal persistence layer or internal state
 * - All signals are scoped to the rule's tenant ID
 * - Cannot create signals for other tenants (tenant isolation enforced)
 * - Immutable parameters prevent rule-level tampering
 *
 * Example Rule Usage:
 * ```
 * rule "Detect unauthorized access"
 * when
 *     $span: SpanCapability(
 *         status == "PERMISSION_DENIED",
 *         hasAttribute("user.id")
 *     )
 * then
 *     sandbox.createSignal(
 *         "unauthorized-access",
 *         "User " + $span.getAttribute("user.id") + " denied access to resource"
 *     );
 * end
 * ```
 *
 * Thread Safety: Implementations must be thread-safe as rules may execute concurrently.
 */
public interface SignalCapability {

    /**
     * Create a signal with minimal information.
     *
     * @param ruleId The ID of the rule that created this signal
     * @param message Human-readable description of the signal
     * @throws SecurityException if tenant validation fails
     * @throws IllegalArgumentException if ruleId or message is null/blank
     */
    void createSignal(String ruleId, String message);

    /**
     * Create a signal with custom severity.
     *
     * @param ruleId The ID of the rule that created this signal
     * @param message Human-readable description of the signal
     * @param severity One of: "LOW", "MEDIUM", "HIGH", "CRITICAL"
     * @throws SecurityException if tenant validation fails
     * @throws IllegalArgumentException if parameters are invalid
     */
    void createSignal(String ruleId, String message, String severity);

    /**
     * Create a signal with custom attributes (metadata).
     *
     * @param ruleId The ID of the rule that created this signal
     * @param message Human-readable description of the signal
     * @param severity One of: "LOW", "MEDIUM", "HIGH", "CRITICAL"
     * @param attributes Custom metadata to attach to the signal (defensive copy made)
     * @throws SecurityException if tenant validation fails
     * @throws IllegalArgumentException if parameters are invalid
     */
    void createSignal(String ruleId, String message, String severity, Map<String, Object> attributes);

    /**
     * Get the tenant ID this capability is scoped to.
     * Rules cannot create signals for other tenants.
     *
     * @return The tenant ID this capability is bound to
     */
    String getTenantId();

    /**
     * Check if signal creation would succeed without actually creating a signal.
     * Useful for rule conditions that need to verify permissions.
     *
     * @param ruleId The rule ID to validate
     * @return true if createSignal() would succeed, false otherwise
     */
    boolean canCreateSignal(String ruleId);
}
