package com.betrace.services;

import com.betrace.rules.dsl.ASTInterpreter;
import com.betrace.rules.dsl.FluoDslParser;
import com.betrace.rules.dsl.ParseError;
import com.betrace.rules.dsl.RuleExpression;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Manages per-tenant compiled AST rules (replaces TenantSessionManager/Drools).
 *
 * <p><b>Security Model:</b></p>
 * <ul>
 *   <li>Rules are parsed to AST (no Java compilation)</li>
 *   <li>Thread-safe for concurrent access and rule updates</li>
 *   <li>Per-tenant isolation of rules</li>
 * </ul>
 *
 * @see ASTInterpreter
 * @see FluoDslParser
 */
@ApplicationScoped
public class ASTRuleManager {

    private static final Logger LOG = Logger.getLogger(ASTRuleManager.class);

    @Inject
    FluoDslParser parser;

    @Inject
    MetricsService metricsService;

    // Per-tenant compiled rules
    private final Map<String, Map<String, ASTInterpreter.CompiledRule>> tenantRules = new ConcurrentHashMap<>();

    // Per-tenant locks for rule updates
    private final Map<String, ReadWriteLock> tenantLocks = new ConcurrentHashMap<>();

    /**
     * Get compiled rules for a tenant
     *
     * @param tenantId Tenant ID
     * @return Map of ruleId -> CompiledRule
     */
    public Map<String, ASTInterpreter.CompiledRule> getRulesForTenant(String tenantId) {
        return tenantRules.get(tenantId);
    }

    /**
     * Add or update a rule for a tenant
     *
     * @param tenantId Tenant ID
     * @param ruleId Rule ID
     * @param ruleName Human-readable rule name
     * @param dslSource FLUO DSL source code
     * @param description Rule description for violations
     * @param severity Severity level (LOW, MEDIUM, HIGH, CRITICAL)
     * @return true if successful, false if parsing failed
     */
    public boolean addRule(String tenantId, String ruleId, String ruleName,
                          String dslSource, String description, String severity) {
        ReadWriteLock lock = tenantLocks.computeIfAbsent(tenantId, tid -> new ReentrantReadWriteLock());

        lock.writeLock().lock();
        try {
            LOG.infof("Adding rule %s for tenant %s", ruleId, tenantId);

            // Parse DSL to AST
            RuleExpression ast;
            try {
                ast = parser.parse(dslSource);
            } catch (ParseError e) {
                LOG.errorf("Failed to parse rule %s: %s", ruleId, e.getMessage());
                return false;
            }

            // Create compiled rule
            ASTInterpreter.CompiledRule compiled = new ASTInterpreter.CompiledRule(
                ruleId,
                ruleName,
                description,
                severity,
                ast
            );

            // Store rule
            tenantRules.computeIfAbsent(tenantId, k -> new ConcurrentHashMap<>())
                .put(ruleId, compiled);

            LOG.infof("Successfully added rule %s for tenant %s", ruleId, tenantId);
            return true;

        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Remove a rule for a tenant
     *
     * @param tenantId Tenant ID
     * @param ruleId Rule ID
     */
    public void removeRule(String tenantId, String ruleId) {
        ReadWriteLock lock = tenantLocks.get(tenantId);
        if (lock != null) {
            lock.writeLock().lock();
        }

        try {
            LOG.infof("Removing rule %s for tenant %s", ruleId, tenantId);

            Map<String, ASTInterpreter.CompiledRule> rules = tenantRules.get(tenantId);
            if (rules != null) {
                rules.remove(ruleId);
            }

        } finally {
            if (lock != null) {
                lock.writeLock().unlock();
            }
        }
    }

    /**
     * Remove all rules for a tenant
     *
     * @param tenantId Tenant ID
     */
    public void removeTenant(String tenantId) {
        ReadWriteLock lock = tenantLocks.get(tenantId);
        if (lock != null) {
            lock.writeLock().lock();
        }

        try {
            LOG.infof("Removing all rules for tenant %s", tenantId);
            tenantRules.remove(tenantId);
            tenantLocks.remove(tenantId);

        } finally {
            if (lock != null) {
                lock.writeLock().unlock();
            }
        }
    }

    /**
     * Get statistics for monitoring
     */
    public Map<String, Object> getStats() {
        int totalTenants = tenantRules.size();
        int totalRules = tenantRules.values().stream()
            .mapToInt(Map::size)
            .sum();

        return Map.of(
            "activeTenants", totalTenants,
            "totalRules", totalRules
        );
    }

    /**
     * Batch update rules for a tenant (replaces all existing rules)
     *
     * @param tenantId Tenant ID
     * @param rules Map of ruleId -> (ruleName, dslSource, description, severity)
     * @return true if all rules parsed successfully
     */
    public boolean updateRules(String tenantId, Map<String, RuleDefinition> rules) {
        ReadWriteLock lock = tenantLocks.computeIfAbsent(tenantId, tid -> new ReentrantReadWriteLock());

        lock.writeLock().lock();
        try {
            LOG.infof("Updating %d rules for tenant %s", rules.size(), tenantId);

            Map<String, ASTInterpreter.CompiledRule> compiled = new ConcurrentHashMap<>();

            for (Map.Entry<String, RuleDefinition> entry : rules.entrySet()) {
                String ruleId = entry.getKey();
                RuleDefinition def = entry.getValue();

                try {
                    RuleExpression ast = parser.parse(def.dslSource);

                    ASTInterpreter.CompiledRule rule = new ASTInterpreter.CompiledRule(
                        ruleId,
                        def.ruleName,
                        def.description,
                        def.severity,
                        ast
                    );

                    compiled.put(ruleId, rule);

                } catch (ParseError e) {
                    LOG.errorf("Failed to parse rule %s: %s", ruleId, e.getMessage());
                    return false;
                }
            }

            // Replace all rules atomically
            tenantRules.put(tenantId, compiled);

            LOG.infof("Successfully updated %d rules for tenant %s", compiled.size(), tenantId);
            return true;

        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Rule definition for batch updates
     */
    public static class RuleDefinition {
        public final String ruleName;
        public final String dslSource;
        public final String description;
        public final String severity;

        public RuleDefinition(String ruleName, String dslSource, String description, String severity) {
            this.ruleName = ruleName;
            this.dslSource = dslSource;
            this.description = description;
            this.severity = severity;
        }
    }
}
