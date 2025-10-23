package com.betrace.components;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.Body;
import org.apache.camel.Header;
import org.apache.camel.Headers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.betrace.model.RuleDefinition;
import com.betrace.model.RuleResult;

import ognl.Ognl;
import ognl.OgnlException;

/**
 * Bean to evaluate OGNL expressions against data.
 * Works with Caffeine cache components in routes for caching.
 */
@ApplicationScoped
public class RuleEvaluator {

    private static final Logger LOG = LoggerFactory.getLogger(RuleEvaluator.class);

    /**
     * Prepare a rule for storage - ensures it has a deterministic ID.
     * The ID is generated from a hash of the tenant ID, rule name and expression.
     * The actual caching is handled by the route using Caffeine cache.
     */
    public RuleDefinition prepareRule(@Body RuleDefinition rule, @Header("tenantId") String tenantId) {
        if (rule.getId() == null) {
            rule.setId(generateRuleId(rule, tenantId));
        }
        return rule;
    }

    /**
     * Generate a deterministic rule ID based on tenant ID, rule name and expression.
     * This ensures the same rule always gets the same ID within a tenant.
     */
    String generateRuleId(RuleDefinition rule, String tenantId) {
        // Include tenant ID to ensure rules are unique per tenant
        String content = (tenantId != null ? tenantId : "default") +
                        ":" +
                        (rule.getName() != null ? rule.getName() : "") +
                        ":" +
                        (rule.getExpression() != null ? rule.getExpression() : "");

        return generateIdWithAlgorithm(content, getHashAlgorithm());
    }

    /**
     * Get the hash algorithm to use. This method is package-private for testing.
     */
    String getHashAlgorithm() {
        return "SHA-256";
    }

    /**
     * Generate ID using the specified algorithm. Package-private for testing.
     */
    String generateIdWithAlgorithm(String content, String algorithm) {
        try {
            MessageDigest md = MessageDigest.getInstance(algorithm);
            byte[] hash = md.digest(content.getBytes(StandardCharsets.UTF_8));

            // Convert first 8 bytes to hex string for a shorter ID
            StringBuilder hexString = new StringBuilder("rule_");
            for (int i = 0; i < 8 && i < hash.length; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            // Fallback to hashCode if the algorithm is not available
            return "rule_" + Integer.toHexString(content.hashCode());
        }
    }

    /**
     * Compile an OGNL expression and return it as a header.
     * The route will store this in the Caffeine expression cache.
     */
    public void compileExpression(@Body RuleDefinition rule, @Headers Map<String, Object> headers) {
        if (rule.getExpression() != null) {
            try {
                Object compiled = Ognl.parseExpression(rule.getExpression());
                headers.put("compiledExpression", compiled);
                headers.put("expression", rule.getExpression());
                headers.put("rule", rule);
                headers.put("ruleId", rule.getId());
            } catch (OgnlException e) {
                LOG.warn("Failed to pre-compile OGNL expression for rule {}: {}", rule.getId(), e.getMessage());
                headers.put("compiledExpression", null);
            }
        }
    }

    /**
     * Evaluate using a pre-compiled expression from cache.
     * Called by the route after getting compiled expression from Caffeine cache.
     */
    public RuleResult evaluateWithCachedExpression(@Body Map<String, Object> data,
                                                        @Header("rule") RuleDefinition rule,
                                                        @Header("compiledExpression") Object compiledExpression) {
        if (rule == null || data == null) {
            return new RuleResult(false, "Missing rule or data");
        }

        try {
            Object expressionToUse = compiledExpression;

            // If no cached expression, compile on the fly
            if (expressionToUse == null && rule.getExpression() != null) {
                expressionToUse = Ognl.parseExpression(rule.getExpression());
            }

            if (expressionToUse == null) {
                return new RuleResult(false, "No expression to evaluate");
            }

            // Evaluate the compiled expression against the data
            Object result = Ognl.getValue(expressionToUse, data);

            // Ensure result is boolean
            boolean matches = false;
            if (result instanceof Boolean) {
                matches = (Boolean) result;
            } else if (result != null) {
                matches = Boolean.parseBoolean(result.toString());
            }

            RuleResult ruleResult = new RuleResult(matches,
                matches ? "Rule matched" : "Rule did not match");
            ruleResult.setRuleId(rule.getId());
            return ruleResult;
        } catch (OgnlException | RuntimeException e) {
            return new RuleResult(false, "Evaluation error: " + e.getMessage());
        }
    }

}