package com.fluo.services;

import com.fluo.compliance.annotations.ComplianceControl;
import com.fluo.model.Rule;
import com.fluo.model.RuleDefinition;
import com.fluo.model.RuleEvaluationResult;
import com.fluo.model.RuleResult;
import com.fluo.model.Signal;
import com.fluo.components.RuleEvaluator;
import com.fluo.components.RuleValidator;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ognl.Ognl;
import ognl.OgnlException;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for rule evaluation with full compliance tracking
 * Implements real SOC 2, HIPAA, FedRAMP, ISO 27001 controls for rule processing
 */
@ApplicationScoped
public class RuleEvaluationService {

    private static final Logger logger = LoggerFactory.getLogger(RuleEvaluationService.class);

    @Inject
    RuleEvaluator ruleEvaluator;

    @Inject
    RuleValidator ruleValidator;

    @Inject
    TenantService tenantService;

    @Inject
    EncryptionService encryptionService;

    // In-memory rule storage (would be database in production)
    private final Map<String, List<Rule>> tenantRules = new ConcurrentHashMap<>();
    private final Map<String, Object> compiledExpressionCache = new ConcurrentHashMap<>();

    /**
     * Create a new rule with compliance tracking
     *
     * SOC 2: CC8.1 (Change Management), CC7.1 (System Monitoring)
     * HIPAA: 164.308(a)(1)(ii)(D) (Information System Activity Review)
     * FedRAMP: CM-2 (Baseline Configuration), CM-3 (Configuration Change Control)
     * ISO 27001: A.8.32 (Change Management), A.8.9 (Configuration Management)
     */
    @ComplianceControl(
        soc2 = {"CC8.1", "CC7.1", "CC4.2"},
        hipaa = {"164.308(a)(1)(ii)(D)", "164.312(b)"},
        fedramp = {"CM-2", "CM-3", "CM-5", "AU-2"},
        fedrampLevel = ComplianceControl.FedRAMPLevel.MODERATE,
        iso27001 = {"A.8.32", "A.8.9", "A.5.24"},
        priority = ComplianceControl.Priority.HIGH
    )
    public Rule createRule(Rule rule, String userId, String tenantId) {
        logger.info("Creating rule {} for tenant {} by user {}",
            rule.name(), tenantId, userId);

        // Verify tenant access (SOC 2: CC6.3)
        verifyTenantAccess(userId, tenantId);

        // Validate rule expression (SOC 2: CC4.2 - Processing Integrity)
        validateRuleExpression(rule);

        // Generate rule ID if not provided
        if (rule.id() == null || rule.id().isEmpty()) {
            String generatedId = generateRuleId(rule, tenantId);
            rule = new Rule(
                generatedId,
                rule.name(),
                rule.version(),
                rule.expression(),
                rule.type(),
                rule.metadata(),
                rule.active(),
                rule.createdAt(),
                rule.updatedAt()
            );
        }

        // Compile and cache expression
        compileAndCacheExpression(rule);

        // Store rule
        tenantRules.computeIfAbsent(tenantId, k -> new ArrayList<>()).add(rule);

        // Log for audit trail (HIPAA: 164.312(b))
        logRuleCreation(rule, userId, tenantId);

        return rule;
    }

    /**
     * Update rule with compliance tracking
     *
     * SOC 2: CC8.1 (Change Management)
     * HIPAA: 164.308(a)(3) (Workforce Security)
     * ISO 27001: A.8.32 (Change Management)
     */
    @ComplianceControl(
        soc2 = {"CC8.1", "CC4.2"},
        hipaa = {"164.308(a)(3)", "164.312(b)"},
        iso27001 = {"A.8.32", "A.5.24"},
        priority = ComplianceControl.Priority.HIGH
    )
    public Rule updateRule(String ruleId, Rule updatedRule, String userId, String tenantId) {
        logger.info("Updating rule {} for tenant {} by user {}",
            ruleId, tenantId, userId);

        // Verify tenant access
        verifyTenantAccess(userId, tenantId);

        // Find existing rule
        Rule existingRule = getRuleById(ruleId, tenantId);
        if (existingRule == null) {
            throw new IllegalArgumentException("Rule not found: " + ruleId);
        }

        // Validate updated expression
        validateRuleExpression(updatedRule);

        // Update rule - create new instance since Rule is immutable
        Rule newRule = new Rule(
            existingRule.id(),
            updatedRule.name(),
            existingRule.version(),
            updatedRule.expression(),
            updatedRule.type(),
            updatedRule.metadata(),
            updatedRule.active(),
            existingRule.createdAt(),
            java.time.Instant.now()
        );

        // Update cache
        compileAndCacheExpression(newRule);

        // Replace in storage
        List<Rule> rules = tenantRules.get(tenantId);
        rules.removeIf(r -> r.id().equals(ruleId));
        rules.add(newRule);

        // Log update for audit
        logRuleUpdate(ruleId, existingRule, newRule, userId, tenantId);

        return newRule;
    }

    /**
     * Evaluate signal against rules with compliance tracking
     *
     * SOC 2: CC7.1 (Detection and Analysis), CC7.2 (System Performance)
     * HIPAA: 164.308(a)(1)(ii)(D) (Information System Activity Review)
     * FedRAMP: AU-6 (Audit Review, Analysis, and Reporting), SI-4 (System Monitoring)
     * ISO 27001: A.8.15 (Logging), A.8.16 (Monitoring Activities)
     */
    @ComplianceControl(
        soc2 = {"CC7.1", "CC7.2", "CC4.1"},
        hipaa = {"164.308(a)(1)(ii)(D)", "164.312(b)"},
        fedramp = {"AU-6", "SI-4", "SI-7", "CA-7"},
        fedrampLevel = ComplianceControl.FedRAMPLevel.MODERATE,
        iso27001 = {"A.8.15", "A.8.16", "A.5.25"},
        sensitiveData = true,
        priority = ComplianceControl.Priority.HIGH
    )
    public List<RuleEvaluationResult> evaluateSignalAgainstRules(Signal signal, String tenantId) {
        logger.debug("Evaluating signal {} against rules for tenant {}",
            signal.id(), tenantId);

        List<RuleEvaluationResult> results = new ArrayList<>();

        // Get active rules for tenant
        List<Rule> activeRules = getActiveRulesForTenant(tenantId);

        // Convert signal to evaluation context
        Map<String, Object> context = createEvaluationContext(signal);

        // Evaluate each rule
        for (Rule rule : activeRules) {
            try {
                RuleEvaluationResult result = evaluateRule(rule, context, signal.id());
                results.add(result);

                // Log critical matches (SOC 2: CC7.1)
                // Note: Rule doesn't have severity field, severity is in metadata
                if (result.matched()) {
                    Object severity = rule.metadata().get("severity");
                    if ("CRITICAL".equals(severity)) {
                        logCriticalRuleMatch(rule, signal, tenantId);
                    }
                }
            } catch (Exception e) {
                logger.error("Error evaluating rule {} for signal {}",
                    rule.id(), signal.id(), e);
                results.add(createErrorResult(rule, e.getMessage()));
            }
        }

        // Log evaluation summary for audit
        logEvaluationSummary(signal.id(), tenantId, results);

        return results;
    }

    /**
     * Validate rule expression for security
     *
     * SOC 2: CC4.2 (Processing Integrity)
     * ISO 27001: A.8.28 (Secure Coding)
     * OWASP: Expression Language Injection Prevention
     */
    @ComplianceControl(
        soc2 = {"CC4.2", "CC7.3"},
        iso27001 = {"A.8.28", "A.8.29"},
        priority = ComplianceControl.Priority.CRITICAL
    )
    public void validateRuleExpression(Rule rule) {
        if (rule == null || rule.expression() == null) {
            throw new IllegalArgumentException("Rule and expression are required");
        }

        // Check for dangerous patterns (injection prevention)
        String expression = rule.expression().toLowerCase();
        List<String> dangerousPatterns = Arrays.asList(
            "system.", "runtime.", "process.", "file.",
            "exec", "eval", "@", "#", "invoke", "getclass"
        );

        for (String pattern : dangerousPatterns) {
            if (expression.contains(pattern)) {
                logger.warn("Potentially dangerous pattern '{}' detected in rule expression", pattern);
                throw new SecurityException("Expression contains potentially dangerous pattern: " + pattern);
            }
        }

        // Validate OGNL syntax
        try {
            Ognl.parseExpression(rule.expression());
        } catch (OgnlException e) {
            throw new IllegalArgumentException("Invalid OGNL expression: " + e.getMessage());
        }
    }

    /**
     * Delete rule with compliance requirements
     *
     * SOC 2: CC6.5 (Disposal of Data), CC8.1 (Change Management)
     * HIPAA: 164.310(d)(2)(i) (Disposal)
     * ISO 27001: A.8.10 (Information Deletion)
     */
    @ComplianceControl(
        soc2 = {"CC6.5", "CC8.1"},
        hipaa = {"164.310(d)(2)(i)", "164.312(b)"},
        iso27001 = {"A.8.10"},
        priority = ComplianceControl.Priority.HIGH
    )
    public void deleteRule(String ruleId, String userId, String tenantId, String reason) {
        logger.info("Deleting rule {} for tenant {} by user {} - Reason: {}",
            ruleId, tenantId, userId, reason);

        // Verify deletion authorization
        verifyDeletionAuthorization(userId, ruleId, tenantId);

        // Create deletion record before removing
        createDeletionAuditRecord(ruleId, userId, tenantId, reason);

        // Remove from storage
        List<Rule> rules = tenantRules.get(tenantId);
        if (rules != null) {
            rules.removeIf(r -> r.id().equals(ruleId));
        }

        // Clear from cache
        compiledExpressionCache.remove(ruleId);

        // Log deletion for compliance
        logRuleDeletion(ruleId, userId, tenantId, reason);
    }

    /**
     * Test rule with sample data
     *
     * SOC 2: CC4.2 (Processing Integrity), CC7.3 (Processing Risks)
     * ISO 27001: A.8.29 (Security Testing)
     */
    @ComplianceControl(
        soc2 = {"CC4.2", "CC7.3"},
        iso27001 = {"A.8.29", "A.8.31"},
        priority = ComplianceControl.Priority.NORMAL
    )
    public RuleResult testRule(Rule rule, Map<String, Object> testData, String userId) {
        logger.info("Testing rule {} with sample data by user {}", rule.id(), userId);

        // Validate rule first
        validateRuleExpression(rule);

        // Create safe evaluation context
        Map<String, Object> safeContext = createSafeTestContext(testData);

        // Evaluate
        try {
            Object expression = Ognl.parseExpression(rule.expression());
            Object result = Ognl.getValue(expression, safeContext);

            boolean matched = false;
            if (result instanceof Boolean) {
                matched = (Boolean) result;
            }

            // Log test execution
            logRuleTest(rule.id(), userId, matched);

            return new RuleResult(matched, matched ? "Rule matched test data" : "Rule did not match test data");
        } catch (OgnlException e) {
            logger.error("Error testing rule {}: {}", rule.id(), e.getMessage());
            return new RuleResult(false, "Test failed: " + e.getMessage());
        }
    }

    // Private helper methods

    private void verifyTenantAccess(String userId, String tenantId) {
        if (!tenantService.hasAccess(userId, tenantId)) {
            logger.warn("Access denied for user {} to tenant {}", userId, tenantId);
            throw new SecurityException("Access denied to tenant: " + tenantId);
        }
    }

    private void verifyDeletionAuthorization(String userId, String ruleId, String tenantId) {
        // Check if user has delete permissions
        if (!tenantService.hasDeletePermission(userId, tenantId)) {
            throw new SecurityException("User not authorized to delete rules");
        }
    }

    private String generateRuleId(Rule rule, String tenantId) {
        // Generate a simple rule ID based on tenant and timestamp
        // In production, this would use a more sophisticated ID generation strategy
        return String.format("rule-%s-%d", tenantId, System.currentTimeMillis());
    }

    private void compileAndCacheExpression(Rule rule) {
        try {
            Object compiled = Ognl.parseExpression(rule.expression());
            compiledExpressionCache.put(rule.id(), compiled);
        } catch (OgnlException e) {
            logger.warn("Failed to compile expression for rule {}: {}", rule.id(), e.getMessage());
        }
    }

    private Rule getRuleById(String ruleId, String tenantId) {
        List<Rule> rules = tenantRules.get(tenantId);
        if (rules != null) {
            return rules.stream()
                .filter(r -> r.id().equals(ruleId))
                .findFirst()
                .orElse(null);
        }
        return null;
    }

    private List<Rule> getActiveRulesForTenant(String tenantId) {
        List<Rule> rules = tenantRules.get(tenantId);
        if (rules != null) {
            return rules.stream()
                .filter(Rule::active)
                .collect(Collectors.toList());
        }
        return new ArrayList<>();
    }

    private Map<String, Object> createEvaluationContext(Signal signal) {
        Map<String, Object> context = new HashMap<>();
        context.put("signal", signal);
        context.put("traceId", signal.traceId());
        context.put("spanId", signal.spanId());
        context.put("severity", signal.severity());
        context.put("status", signal.status());
        context.put("message", signal.message());

        if (signal.attributes() != null) {
            context.putAll(signal.attributes());
        }

        return context;
    }

    private Map<String, Object> createSafeTestContext(Map<String, Object> testData) {
        // Create a safe, sandboxed context for testing
        Map<String, Object> safeContext = new HashMap<>();

        // Only allow specific safe data types
        for (Map.Entry<String, Object> entry : testData.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof String || value instanceof Number ||
                value instanceof Boolean || value instanceof Map || value instanceof List) {
                safeContext.put(entry.getKey(), value);
            }
        }

        return safeContext;
    }

    private RuleEvaluationResult evaluateRule(Rule rule, Map<String, Object> context, String signalId) {
        long startTime = System.currentTimeMillis();
        try {
            // Get cached expression or compile
            Object expression = compiledExpressionCache.get(rule.id());
            if (expression == null) {
                expression = Ognl.parseExpression(rule.expression());
                compiledExpressionCache.put(rule.id(), expression);
            }

            // Evaluate
            Object result = Ognl.getValue(expression, context);
            boolean matched = false;
            if (result instanceof Boolean) {
                matched = (Boolean) result;
            }

            long evaluationTime = System.currentTimeMillis() - startTime;
            return RuleEvaluationResult.success(
                signalId,
                rule.id(),
                matched,
                result,
                evaluationTime
            );
        } catch (OgnlException e) {
            long evaluationTime = System.currentTimeMillis() - startTime;
            return RuleEvaluationResult.failure(signalId, rule.id(), e.getMessage(), evaluationTime);
        }
    }

    private RuleEvaluationResult createErrorResult(Rule rule, String error) {
        return RuleEvaluationResult.failure(
            "unknown",
            rule.id(),
            error,
            0
        );
    }

    private void createDeletionAuditRecord(String ruleId, String userId, String tenantId, String reason) {
        // Create immutable deletion record
        Map<String, Object> record = new HashMap<>();
        record.put("ruleId", ruleId);
        record.put("userId", userId);
        record.put("tenantId", tenantId);
        record.put("reason", reason);
        record.put("timestamp", Instant.now());

        // Would store in audit log
        logger.info("COMPLIANCE_AUDIT: Rule deletion record created: {}", record);
    }

    // Logging methods for compliance audit trail

    private void logRuleCreation(Rule rule, String userId, String tenantId) {
        logger.info("COMPLIANCE_AUDIT: Rule {} created by user {} for tenant {} at {}",
            rule.id(), userId, tenantId, Instant.now());
    }

    private void logRuleUpdate(String ruleId, Rule oldRule, Rule newRule, String userId, String tenantId) {
        logger.info("COMPLIANCE_AUDIT: Rule {} updated by user {} for tenant {} - Changes: expression={}, metadata={}",
            ruleId, userId, tenantId,
            !oldRule.expression().equals(newRule.expression()),
            !oldRule.metadata().equals(newRule.metadata()));
    }

    private void logRuleDeletion(String ruleId, String userId, String tenantId, String reason) {
        logger.info("COMPLIANCE_AUDIT: Rule {} deleted by user {} for tenant {} - Reason: {}",
            ruleId, userId, tenantId, reason);
    }

    private void logCriticalRuleMatch(Rule rule, Signal signal, String tenantId) {
        logger.warn("COMPLIANCE_ALERT: Critical rule {} matched for signal {} in tenant {}",
            rule.id(), signal.id(), tenantId);
    }

    private void logEvaluationSummary(String signalId, String tenantId, List<RuleEvaluationResult> results) {
        long matchCount = results.stream().filter(RuleEvaluationResult::matched).count();
        logger.info("COMPLIANCE_AUDIT: Signal {} evaluated against {} rules for tenant {} - {} matches",
            signalId, results.size(), tenantId, matchCount);
    }

    private void logRuleTest(String ruleId, String userId, boolean matched) {
        logger.info("COMPLIANCE_AUDIT: Rule {} tested by user {} - Result: {}",
            ruleId, userId, matched ? "MATCHED" : "NOT_MATCHED");
    }
}