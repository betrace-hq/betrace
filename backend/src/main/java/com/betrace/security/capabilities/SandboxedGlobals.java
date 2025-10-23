package com.betrace.security.capabilities;

/**
 * Sandboxed global object exposed to Drools rules.
 *
 * This is the ONLY object that rules have access to via Drools globals.
 * All rule actions must go through this sandbox to maintain security isolation.
 *
 * Security Design (PRD-005):
 * - Replaces direct access to SignalService and other services
 * - Enforces tenant isolation at the capability level
 * - Provides read-only view of spans (SpanCapability)
 * - Provides write-only signal creation (SignalCapability)
 * - No access to service layer, database, or internal state
 * - Immutable after construction
 *
 * Example Rule Usage:
 * ```
 * global com.betrace.security.capabilities.SandboxedGlobals sandbox
 *
 * rule "Detect slow database query"
 * when
 *     $span: SpanCapability(
 *         operationName == "db.query",
 *         durationMillis > 1000
 *     )
 * then
 *     sandbox.createSignal("slow-query",
 *         "Database query exceeded 1s: " + $span.getOperationName());
 * end
 * ```
 *
 * Thread Safety: This class is immutable and thread-safe.
 * The underlying capabilities must also be thread-safe.
 */
public final class SandboxedGlobals {

    private final SignalCapability signalCapability;
    private final String tenantId;

    /**
     * Create a new sandboxed globals instance for a specific tenant.
     *
     * @param signalCapability The signal creation capability
     * @param tenantId The tenant this sandbox is scoped to
     * @throws IllegalArgumentException if any parameter is null
     */
    public SandboxedGlobals(SignalCapability signalCapability, String tenantId) {
        if (signalCapability == null) {
            throw new IllegalArgumentException("SignalCapability cannot be null");
        }
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("TenantId cannot be null or blank");
        }
        if (!signalCapability.getTenantId().equals(tenantId)) {
            throw new SecurityException("SignalCapability tenant mismatch: expected " +
                tenantId + ", got " + signalCapability.getTenantId());
        }

        this.signalCapability = signalCapability;
        this.tenantId = tenantId;
    }

    /**
     * Create a signal with minimal information.
     * Delegates to the underlying SignalCapability.
     *
     * @param ruleId The ID of the rule creating this signal
     * @param message Human-readable description
     * @throws SecurityException if tenant validation fails
     */
    public void createSignal(String ruleId, String message) {
        signalCapability.createSignal(ruleId, message);
    }

    /**
     * Create a signal with custom severity.
     * Delegates to the underlying SignalCapability.
     *
     * @param ruleId The ID of the rule creating this signal
     * @param message Human-readable description
     * @param severity One of: "LOW", "MEDIUM", "HIGH", "CRITICAL"
     * @throws SecurityException if tenant validation fails
     */
    public void createSignal(String ruleId, String message, String severity) {
        signalCapability.createSignal(ruleId, message, severity);
    }

    /**
     * Get the tenant ID this sandbox is scoped to.
     * Rules can use this to verify their tenant context.
     *
     * @return The tenant ID
     */
    public String getTenantId() {
        return tenantId;
    }

    /**
     * Check if this sandbox can create signals.
     * Always returns true in Phase 1 (basic validation).
     * Phase 2 will add quota/rate limit checking.
     *
     * @param ruleId The rule ID to check
     * @return true if signal creation is allowed
     */
    public boolean canCreateSignal(String ruleId) {
        return signalCapability.canCreateSignal(ruleId);
    }

    @Override
    public String toString() {
        return "SandboxedGlobals{tenantId='" + tenantId + "'}";
    }
}
