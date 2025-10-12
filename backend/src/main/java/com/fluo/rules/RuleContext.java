package com.fluo.rules;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Read-only context object provided to Drools rules for sandboxed execution.
 *
 * <p>Rules can query this context but cannot call service methods directly.
 * This prevents malicious rules from bypassing tenant isolation or causing side effects.</p>
 *
 * <p><b>Security Model:</b></p>
 * <ul>
 *   <li>No service references exposed to rules</li>
 *   <li>All methods are read-only (no setters)</li>
 *   <li>Collections are immutable views</li>
 *   <li>Rules communicate violations via facts, not callbacks</li>
 * </ul>
 *
 * @see TenantSessionManager
 */
public final class RuleContext {

    private final String tenantId;
    private final Map<String, Object> metadata;
    private final List<SignalViolation> violations;

    private RuleContext(String tenantId, Map<String, Object> metadata) {
        this.tenantId = tenantId;
        this.metadata = Collections.unmodifiableMap(new ConcurrentHashMap<>(metadata));
        this.violations = new java.util.concurrent.CopyOnWriteArrayList<>();
    }

    /**
     * Create a new rule context for a tenant.
     *
     * @param tenantId Tenant ID
     * @param metadata Read-only metadata
     * @return New RuleContext instance
     */
    public static RuleContext forTenant(String tenantId, Map<String, Object> metadata) {
        return new RuleContext(tenantId, metadata);
    }

    /**
     * Create a new rule context for a tenant with empty metadata.
     *
     * @param tenantId Tenant ID
     * @return New RuleContext instance
     */
    public static RuleContext forTenant(String tenantId) {
        return new RuleContext(tenantId, Map.of());
    }

    /**
     * Get the tenant ID for this context.
     *
     * @return Tenant ID
     */
    public String getTenantId() {
        return tenantId;
    }

    /**
     * Get read-only metadata value.
     *
     * @param key Metadata key
     * @return Metadata value or null
     */
    public Object getMetadata(String key) {
        return metadata.get(key);
    }

    /**
     * Check if metadata key exists.
     *
     * @param key Metadata key
     * @return true if key exists
     */
    public boolean hasMetadata(String key) {
        return metadata.containsKey(key);
    }

    /**
     * Get all metadata keys.
     *
     * @return Immutable set of metadata keys
     */
    public java.util.Set<String> getMetadataKeys() {
        return metadata.keySet();
    }

    /**
     * Record a signal violation (called by rules when violations are detected).
     *
     * <p>This is the only mutable operation allowed. Rules should use this
     * to communicate violations instead of calling service methods directly.</p>
     *
     * @param violation Signal violation detected by rule
     */
    public void recordViolation(SignalViolation violation) {
        if (violation == null) {
            throw new IllegalArgumentException("Violation cannot be null");
        }
        if (!tenantId.equals(violation.tenantId)) {
            throw new SecurityException("Violation tenantId must match context tenantId");
        }
        violations.add(violation);
    }

    /**
     * Get all recorded violations.
     *
     * @return Immutable list of violations
     */
    public List<SignalViolation> getViolations() {
        return Collections.unmodifiableList(violations);
    }

    /**
     * Check if any violations were recorded.
     *
     * @return true if violations exist
     */
    public boolean hasViolations() {
        return !violations.isEmpty();
    }

    /**
     * Get count of recorded violations.
     *
     * @return Number of violations
     */
    public int getViolationCount() {
        return violations.size();
    }

    /**
     * Clear all recorded violations (for reuse across evaluation cycles).
     */
    public void clearViolations() {
        violations.clear();
    }

    @Override
    public String toString() {
        return String.format("RuleContext[tenantId=%s, metadata=%d keys, violations=%d]",
            tenantId, metadata.size(), violations.size());
    }

    /**
     * Immutable record of a signal violation detected by a rule.
     *
     * <p>Rules create these when they detect violations and add them to the RuleContext.
     * The RuleEvaluationService collects these and creates Signal entities.</p>
     */
    public static final class SignalViolation {
        public final String tenantId;
        public final String ruleId;
        public final String ruleName;
        public final String traceId;
        public final String severity;
        public final String description;
        public final Map<String, Object> context;

        private SignalViolation(Builder builder) {
            this.tenantId = builder.tenantId;
            this.ruleId = builder.ruleId;
            this.ruleName = builder.ruleName;
            this.traceId = builder.traceId;
            this.severity = builder.severity != null ? builder.severity : "MEDIUM";
            this.description = builder.description;
            this.context = Collections.unmodifiableMap(new ConcurrentHashMap<>(builder.context));
        }

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {
            private String tenantId;
            private String ruleId;
            private String ruleName;
            private String traceId;
            private String severity;
            private String description;
            private Map<String, Object> context = Map.of();

            public Builder tenantId(String tenantId) {
                this.tenantId = tenantId;
                return this;
            }

            public Builder ruleId(String ruleId) {
                this.ruleId = ruleId;
                return this;
            }

            public Builder ruleName(String ruleName) {
                this.ruleName = ruleName;
                return this;
            }

            public Builder traceId(String traceId) {
                this.traceId = traceId;
                return this;
            }

            public Builder severity(String severity) {
                this.severity = severity;
                return this;
            }

            public Builder description(String description) {
                this.description = description;
                return this;
            }

            public Builder context(Map<String, Object> context) {
                this.context = context != null ? context : Map.of();
                return this;
            }

            public SignalViolation build() {
                if (tenantId == null || tenantId.isBlank()) {
                    throw new IllegalArgumentException("tenantId is required");
                }
                if (ruleId == null || ruleId.isBlank()) {
                    throw new IllegalArgumentException("ruleId is required");
                }
                if (traceId == null || traceId.isBlank()) {
                    throw new IllegalArgumentException("traceId is required");
                }
                if (description == null || description.isBlank()) {
                    throw new IllegalArgumentException("description is required");
                }
                return new SignalViolation(this);
            }
        }

        @Override
        public String toString() {
            return String.format("SignalViolation[rule=%s, trace=%s, severity=%s]",
                ruleId, traceId, severity);
        }
    }
}
