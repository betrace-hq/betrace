package com.fluo.repository;

import com.fluo.model.Rule;
import com.fluo.model.Signal;
import com.fluo.services.TigerBeetleService;
import com.fluo.services.TigerBeetleService.RuleMetadata;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Repository for Rule persistence (PRD-002a).
 *
 * <p>Provides a clean domain-layer interface for rule operations,
 * delegating to TigerBeetleService for actual persistence.</p>
 *
 * <p><b>Storage Strategy:</b></p>
 * <ul>
 *   <li>Rule metadata (ID, tenant, enabled, severity) → TigerBeetle Account</li>
 *   <li>Rule expression + DRL → Filesystem (./data-rules/{tenant}/{rule}.json)</li>
 *   <li>Signal count → TigerBeetle Account.debitsPosted</li>
 * </ul>
 *
 * @see TigerBeetleService
 * @see Rule
 */
@ApplicationScoped
public class RuleRepository {

    @Inject
    TigerBeetleService tigerBeetle;

    /**
     * Create a new rule.
     *
     * @param rule Rule domain model
     * @param drl Compiled Drools DRL
     */
    public void create(Rule rule, String drl) {
        // Map Rule.RuleType to Signal.SignalSeverity (default to MEDIUM)
        Signal.SignalSeverity severity = Signal.SignalSeverity.MEDIUM;

        tigerBeetle.createRule(
            UUID.fromString(rule.id()),
            extractTenantId(rule),
            rule.expression(),
            drl,
            severity,
            rule.active()
        );
    }

    /**
     * Find rule by ID.
     *
     * @param ruleId Rule UUID
     * @return Rule domain model
     */
    public Rule findById(UUID ruleId) {
        RuleMetadata metadata = tigerBeetle.getRuleMetadata(ruleId);

        // Reconstruct Rule from metadata
        // Note: This is a simplified version - production would need full metadata
        return Rule.create(
            ruleId.toString(),
            "Rule " + ruleId, // Name not stored in TigerBeetle
            "1", // Version
            metadata.expression(),
            Rule.RuleType.CEL // Default type
        );
    }

    /**
     * Find all rules for a tenant.
     *
     * @param tenantId Tenant UUID
     * @return List of rules
     */
    public List<Rule> findByTenant(UUID tenantId) {
        List<UUID> ruleIds = tigerBeetle.getRuleIdsByTenant(tenantId);

        List<Rule> rules = new ArrayList<>();
        for (UUID ruleId : ruleIds) {
            try {
                rules.add(findById(ruleId));
            } catch (Exception e) {
                // Skip rules that fail to load
                continue;
            }
        }

        return rules;
    }

    /**
     * Get signal count for a rule.
     *
     * @param ruleId Rule UUID
     * @return Number of signals fired by this rule
     */
    public long getSignalCount(UUID ruleId) {
        return tigerBeetle.getRuleSignalCount(ruleId);
    }

    /**
     * Get rule metadata (expression + DRL).
     *
     * @param ruleId Rule UUID
     * @return Rule metadata
     */
    public RuleMetadata getMetadata(UUID ruleId) {
        return tigerBeetle.getRuleMetadata(ruleId);
    }

    /**
     * Extract tenant ID from Rule model.
     * Note: Rule model doesn't currently store tenantId directly,
     * so this is a placeholder for future enhancement.
     */
    private UUID extractTenantId(Rule rule) {
        // Placeholder: Extract from metadata or require explicit tenantId parameter
        Object tenantIdObj = rule.metadata().get("tenantId");
        if (tenantIdObj instanceof String) {
            return UUID.fromString((String) tenantIdObj);
        }
        throw new IllegalArgumentException("Rule must have tenantId in metadata");
    }
}
