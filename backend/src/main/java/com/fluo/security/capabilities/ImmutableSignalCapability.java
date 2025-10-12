package com.fluo.security.capabilities;

import com.fluo.model.Signal;
import com.fluo.services.SignalService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.Map;

/**
 * Immutable implementation of SignalCapability with strict tenant isolation.
 *
 * Security Properties:
 * - Rules can ONLY create signals for their own tenant
 * - No access to underlying SignalService (prevents bypassing rate limits)
 * - Tenant validation enforced at construction time
 * - All operations logged for audit trail
 *
 * Usage:
 * <pre>
 * SignalCapability capability = new ImmutableSignalCapability(tenantId, signalService);
 * capability.createSignal("rule-001", "Anomaly detected");
 * </pre>
 *
 * SOC2 CC6.1: Logical access controls (tenant isolation for signal creation)
 * SOC2 CC6.3: Data isolation (prevent cross-tenant signal pollution)
 */
public final class ImmutableSignalCapability implements SignalCapability {

    private static final Logger log = LoggerFactory.getLogger(ImmutableSignalCapability.class);

    private final String tenantId;
    private final SignalService signalService;

    /**
     * Create a tenant-scoped signal capability.
     *
     * @param tenantId The tenant ID this capability is scoped to (MUST match all signals)
     * @param signalService The underlying signal service (cannot be accessed by rules)
     * @throws IllegalArgumentException if tenantId is null/blank or signalService is null
     */
    public ImmutableSignalCapability(String tenantId, SignalService signalService) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("TenantId cannot be null or blank");
        }
        if (signalService == null) {
            throw new IllegalArgumentException("SignalService cannot be null");
        }

        this.tenantId = tenantId;
        this.signalService = signalService;

        log.debug("Created ImmutableSignalCapability for tenant: {}", tenantId);
    }

    @Override
    public void createSignal(String ruleId, String message) {
        createSignal(ruleId, message, "MEDIUM");
    }

    @Override
    public void createSignal(String ruleId, String message, String severity) {
        createSignal(ruleId, message, severity, Collections.emptyMap());
    }

    @Override
    public void createSignal(String ruleId, String message, String severity, Map<String, Object> attributes) {
        // Input validation
        if (ruleId == null || ruleId.isBlank()) {
            log.warn("Attempted to create signal with null/blank ruleId for tenant: {}", tenantId);
            throw new IllegalArgumentException("RuleId cannot be null or blank");
        }
        if (message == null || message.isBlank()) {
            log.warn("Attempted to create signal with null/blank message for ruleId: {} tenant: {}",
                ruleId, tenantId);
            throw new IllegalArgumentException("Message cannot be null or blank");
        }

        // Severity validation and conversion
        Signal.SignalSeverity signalSeverity;
        try {
            signalSeverity = Signal.SignalSeverity.valueOf(severity.toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Invalid severity '{}' for ruleId: {} tenant: {}, defaulting to MEDIUM",
                severity, ruleId, tenantId);
            signalSeverity = Signal.SignalSeverity.MEDIUM;
        }

        // Audit logging for compliance
        log.info("Creating signal via capability - tenant: {}, ruleId: {}, severity: {}",
            tenantId, ruleId, signalSeverity);

        // Create signal with tenant context enforced
        Signal signal = Signal.create(
            ruleId,
            "v1",                    // Rule version
            null,                    // spanId (not available in this context)
            null,                    // traceId (not available in this context)
            signalSeverity,
            message,
            attributes != null ? attributes : Collections.emptyMap(),
            "rule-engine",           // Source identifier
            tenantId                 // Tenant ID enforced from capability
        );

        // Delegate to SignalService
        signalService.emit(signal);

        log.debug("Signal created successfully - id: {}, tenant: {}, ruleId: {}",
            signal.id(), tenantId, ruleId);
    }

    @Override
    public String getTenantId() {
        return tenantId;
    }

    @Override
    public boolean canCreateSignal(String ruleId) {
        // Phase 1: Basic validation only
        // Phase 2: Check rate limits, quotas, resource constraints
        if (ruleId == null || ruleId.isBlank()) {
            return false;
        }

        // Always true for Phase 1 (assumes rate limiting handled by SignalService)
        return true;
    }

    @Override
    public String toString() {
        return "ImmutableSignalCapability{" +
            "tenantId='" + tenantId + '\'' +
            '}';
    }
}
