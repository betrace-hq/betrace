package com.fluo.rules.dsl;

import com.fluo.model.Span;
import com.fluo.rules.RuleContext;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Safe AST interpreter for FLUO DSL rules.
 *
 * <p><b>Security Model:</b></p>
 * <ul>
 *   <li>No Java code execution - pure data structure traversal</li>
 *   <li>No reflection possible - interprets AST directly</li>
 *   <li>Whitelisted operations only (has, where, count, AND, OR, NOT)</li>
 *   <li>No file system, network, or system access</li>
 * </ul>
 *
 * <p><b>Resource Limits (DoS Prevention):</b></p>
 * <ul>
 *   <li>Max AST depth: 100 levels (prevents stack overflow)</li>
 *   <li>Max spans per evaluation: 100,000 (prevents memory exhaustion)</li>
 *   <li>Max attributes per span: 10,000 (prevents attribute map bombs)</li>
 *   <li>Max string value length: 10MB (prevents string allocation DoS)</li>
 * </ul>
 *
 * <p>This replaces Drools rule engine to eliminate reflection-based sandbox bypass (P0 #10).</p>
 *
 * @see RuleExpression
 * @see FluoDslParser
 */
@ApplicationScoped
public class ASTInterpreter {

    private static final Logger LOG = Logger.getLogger(ASTInterpreter.class);

    // Resource limits to prevent DoS attacks
    private static final int MAX_AST_DEPTH = 100;
    private static final int MAX_SPANS_PER_EVALUATION = 100_000;
    private static final int MAX_ATTRIBUTES_PER_SPAN = 10_000;
    private static final int MAX_STRING_VALUE_LENGTH = 10_000_000; // 10MB

    // Thread-local depth tracking for recursive evaluation
    private static final ThreadLocal<Integer> evaluationDepth = ThreadLocal.withInitial(() -> 0);

    /**
     * Evaluate a rule expression against spans in a trace.
     *
     * @param expression Parsed AST from FluoDslParser
     * @param spans All spans in the trace
     * @param ruleContext Rule context for recording violations
     * @return true if rule matches, false otherwise
     * @throws ResourceLimitExceededException if resource limits are exceeded
     */
    public boolean evaluate(RuleExpression expression, List<Span> spans, RuleContext ruleContext) {
        if (expression == null || spans == null || spans.isEmpty()) {
            return false;
        }

        // Defensive copy to prevent TOCTOU race conditions
        final List<Span> immutableSpans = List.copyOf(spans);
        final int spanCount = immutableSpans.size();

        // Enforce span count limit (checked on immutable copy)
        if (spanCount > MAX_SPANS_PER_EVALUATION) {
            throw new ResourceLimitExceededException(
                String.format("Span count %d exceeds maximum %d", spanCount, MAX_SPANS_PER_EVALUATION)
            );
        }

        // Validate span attributes don't exceed limits
        for (Span span : immutableSpans) {
            validateSpan(span);
        }

        try {
            evaluationDepth.set(0); // Reset depth at start of evaluation
            return evaluateExpression(expression, immutableSpans, ruleContext);
        } catch (ResourceLimitExceededException e) {
            // Re-throw resource limit exceptions (don't suppress DoS protection)
            throw e;
        } catch (Exception e) {
            LOG.errorf(e, "Error evaluating rule expression");
            return false;
        } finally {
            evaluationDepth.remove(); // Prevent ThreadLocal memory leak
        }
    }

    /**
     * Validate a span doesn't exceed resource limits.
     *
     * @param span Span to validate
     * @throws ResourceLimitExceededException if limits exceeded
     */
    private void validateSpan(Span span) {
        Map<String, Object> attributes = span.attributes();

        // Check attribute count
        if (attributes.size() > MAX_ATTRIBUTES_PER_SPAN) {
            throw new ResourceLimitExceededException(
                String.format("Span %s has %d attributes, exceeds maximum %d",
                    span.spanId(), attributes.size(), MAX_ATTRIBUTES_PER_SPAN)
            );
        }

        // Check string value lengths
        for (Map.Entry<String, Object> entry : attributes.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof String) {
                String strValue = (String) value;
                if (strValue.length() > MAX_STRING_VALUE_LENGTH) {
                    throw new ResourceLimitExceededException(
                        String.format("Attribute '%s' value length %d exceeds maximum %d",
                            entry.getKey(), strValue.length(), MAX_STRING_VALUE_LENGTH)
                    );
                }
            }
        }
    }

    /**
     * Recursively evaluate expression AST
     *
     * @throws ResourceLimitExceededException if AST depth exceeds MAX_AST_DEPTH
     */
    private boolean evaluateExpression(RuleExpression expr, List<Span> spans, RuleContext ctx) {
        // Enforce AST depth limit to prevent stack overflow
        int depth = evaluationDepth.get();
        if (depth > MAX_AST_DEPTH) {
            throw new ResourceLimitExceededException(
                String.format("AST depth %d exceeds maximum %d (possible infinite recursion)", depth, MAX_AST_DEPTH)
            );
        }

        evaluationDepth.set(depth + 1);
        try {
            if (expr instanceof HasExpression) {
                return evaluateHasExpression((HasExpression) expr, spans);
            } else if (expr instanceof CountExpression) {
                return evaluateCountExpression((CountExpression) expr, spans);
            } else if (expr instanceof BinaryExpression) {
                return evaluateBinaryExpression((BinaryExpression) expr, spans, ctx);
            } else if (expr instanceof NotExpression) {
                return evaluateNotExpression((NotExpression) expr, spans, ctx);
            } else {
                LOG.warnf("Unknown expression type: %s", expr.getClass().getName());
                return false;
            }
        } finally {
            evaluationDepth.set(depth);
        }
    }

    /**
     * Evaluate: trace.has(operationName).where(...)
     */
    private boolean evaluateHasExpression(HasExpression expr, List<Span> spans) {
        String targetOp = expr.operationName();
        List<WhereClause> whereClauses = expr.whereClauses();

        // Find spans matching the operation name
        List<Span> matchingSpans = new ArrayList<>();
        for (Span span : spans) {
            if (span.operationName() != null && span.operationName().equals(targetOp)) {
                matchingSpans.add(span);
            }
        }

        if (matchingSpans.isEmpty()) {
            return false;
        }

        // If no where clauses, just check existence
        if (whereClauses.isEmpty()) {
            return true;
        }

        // Check if any span satisfies all where clauses
        for (Span span : matchingSpans) {
            boolean allClausesSatisfied = true;

            for (WhereClause clause : whereClauses) {
                if (!evaluateWhereClause(clause, span)) {
                    allClausesSatisfied = false;
                    break;
                }
            }

            if (allClausesSatisfied) {
                return true;
            }
        }

        return false;
    }

    /**
     * Evaluate: .where(attribute op value)
     *
     * Supported operators: ==, !=, >, <, >=, <=, contains
     */
    private boolean evaluateWhereClause(WhereClause clause, Span span) {
        Object actualValue = getSpanAttribute(span, clause.attribute());
        Object expectedValue = clause.value();
        String operator = clause.operator();

        if (actualValue == null) {
            return false;
        }

        switch (operator) {
            case "==":
                return compareEquals(actualValue, expectedValue);
            case "!=":
                return !compareEquals(actualValue, expectedValue);
            case ">":
                return compareGreaterThan(actualValue, expectedValue);
            case "<":
                return compareLessThan(actualValue, expectedValue);
            case ">=":
                return compareGreaterThan(actualValue, expectedValue) || compareEquals(actualValue, expectedValue);
            case "<=":
                return compareLessThan(actualValue, expectedValue) || compareEquals(actualValue, expectedValue);
            case "contains":
                return containsValue(actualValue, expectedValue);
            default:
                LOG.warnf("Unknown operator: %s", operator);
                return false;
        }
    }

    /**
     * Get attribute value from span (supports nested paths)
     */
    private Object getSpanAttribute(Span span, String attributePath) {
        // Handle special built-in attributes
        switch (attributePath) {
            case "operationName":
                return span.operationName();
            case "serviceName":
                return span.serviceName();
            case "status":
                return span.status() != null ? span.status().toString() : null;
            case "kind":
                return span.kind() != null ? span.kind().toString() : null;
            case "duration":
                return span.durationNanos();
            default:
                // Custom attribute from attributes map
                return span.attributes().get(attributePath);
        }
    }

    /**
     * Compare equality (handles different types safely)
     */
    private boolean compareEquals(Object actual, Object expected) {
        if (actual == null || expected == null) {
            return actual == expected;
        }

        // String comparison
        if (actual instanceof String && expected instanceof String) {
            return actual.equals(expected);
        }

        // Numeric comparison (handle different numeric types)
        if (actual instanceof Number && expected instanceof Number) {
            double actualNum = ((Number) actual).doubleValue();
            double expectedNum = ((Number) expected).doubleValue();
            return Math.abs(actualNum - expectedNum) < 0.0001; // Floating point tolerance
        }

        // Boolean comparison
        if (actual instanceof Boolean && expected instanceof Boolean) {
            return actual.equals(expected);
        }

        // Fallback to string comparison
        return actual.toString().equals(expected.toString());
    }

    /**
     * Compare greater than (numeric only)
     */
    private boolean compareGreaterThan(Object actual, Object expected) {
        if (!(actual instanceof Number) || !(expected instanceof Number)) {
            return false;
        }

        double actualNum = ((Number) actual).doubleValue();
        double expectedNum = ((Number) expected).doubleValue();
        return actualNum > expectedNum;
    }

    /**
     * Compare less than (numeric only)
     */
    private boolean compareLessThan(Object actual, Object expected) {
        if (!(actual instanceof Number) || !(expected instanceof Number)) {
            return false;
        }

        double actualNum = ((Number) actual).doubleValue();
        double expectedNum = ((Number) expected).doubleValue();
        return actualNum < expectedNum;
    }

    /**
     * Check if actual contains expected (string contains)
     */
    private boolean containsValue(Object actual, Object expected) {
        if (actual == null || expected == null) {
            return false;
        }

        String actualStr = actual.toString();
        String expectedStr = expected.toString();
        return actualStr.contains(expectedStr);
    }

    /**
     * Evaluate: trace.count(pattern) op value
     */
    private boolean evaluateCountExpression(CountExpression expr, List<Span> spans) {
        String pattern = expr.pattern();
        String operator = expr.operator();
        int expectedCount = expr.value();

        // Count spans matching the pattern (operation name)
        int actualCount = 0;
        for (Span span : spans) {
            if (span.operationName() != null && span.operationName().equals(pattern)) {
                actualCount++;
            }
        }

        // Compare count using operator
        switch (operator) {
            case "==":
                return actualCount == expectedCount;
            case "!=":
                return actualCount != expectedCount;
            case ">":
                return actualCount > expectedCount;
            case "<":
                return actualCount < expectedCount;
            case ">=":
                return actualCount >= expectedCount;
            case "<=":
                return actualCount <= expectedCount;
            default:
                LOG.warnf("Unknown count operator: %s", operator);
                return false;
        }
    }

    /**
     * Evaluate: expr1 AND expr2 / expr1 OR expr2
     */
    private boolean evaluateBinaryExpression(BinaryExpression expr, List<Span> spans, RuleContext ctx) {
        String operator = expr.operator();
        boolean leftResult = evaluateExpression(expr.left(), spans, ctx);

        // Short-circuit evaluation
        if ("and".equalsIgnoreCase(operator)) {
            if (!leftResult) {
                return false; // AND short-circuit: false AND x = false
            }
            return evaluateExpression(expr.right(), spans, ctx);
        } else if ("or".equalsIgnoreCase(operator)) {
            if (leftResult) {
                return true; // OR short-circuit: true OR x = true
            }
            return evaluateExpression(expr.right(), spans, ctx);
        } else {
            LOG.warnf("Unknown binary operator: %s", operator);
            return false;
        }
    }

    /**
     * Evaluate: NOT expr
     */
    private boolean evaluateNotExpression(NotExpression expr, List<Span> spans, RuleContext ctx) {
        return !evaluateExpression(expr.expression(), spans, ctx);
    }

    /**
     * Evaluate multiple rules and record violations in RuleContext.
     *
     * @param rules Map of ruleId -> parsed RuleExpression
     * @param spans All spans in the trace
     * @param ruleContext Rule context for recording violations
     */
    public void evaluateRules(Map<String, CompiledRule> rules, List<Span> spans, RuleContext ruleContext) {
        if (rules == null || rules.isEmpty() || spans == null || spans.isEmpty()) {
            return;
        }

        String traceId = spans.get(0).traceId();

        for (Map.Entry<String, CompiledRule> entry : rules.entrySet()) {
            String ruleId = entry.getKey();
            CompiledRule rule = entry.getValue();

            try {
                boolean matched = evaluate(rule.expression(), spans, ruleContext);

                if (matched) {
                    LOG.debugf("Rule %s matched for trace %s", ruleId, traceId);

                    // Record violation in RuleContext
                    RuleContext.SignalViolation violation = RuleContext.SignalViolation.builder()
                        .tenantId(ruleContext.getTenantId())
                        .ruleId(ruleId)
                        .ruleName(rule.name())
                        .traceId(traceId)
                        .severity(rule.severity())
                        .description(rule.description())
                        .context(Map.of(
                            "spanCount", spans.size(),
                            "matchedRule", ruleId
                        ))
                        .build();

                    ruleContext.recordViolation(violation);
                }
            } catch (Exception e) {
                LOG.errorf(e, "Error evaluating rule %s for trace %s", ruleId, traceId);
            }
        }
    }

    /**
     * Compiled rule with metadata
     */
    public static class CompiledRule {
        private final String ruleId;
        private final String name;
        private final String description;
        private final String severity;
        private final RuleExpression expression;

        public CompiledRule(String ruleId, String name, String description, String severity, RuleExpression expression) {
            this.ruleId = ruleId;
            this.name = name;
            this.description = description;
            this.severity = severity != null ? severity : "MEDIUM";
            this.expression = expression;
        }

        public String ruleId() { return ruleId; }
        public String name() { return name; }
        public String description() { return description; }
        public String severity() { return severity; }
        public RuleExpression expression() { return expression; }
    }
}
