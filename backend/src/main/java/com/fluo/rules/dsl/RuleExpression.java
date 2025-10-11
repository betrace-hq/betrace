package com.fluo.rules.dsl;

/**
 * Base interface for all rule expression AST nodes
 */
public interface RuleExpression {
    /**
     * Accept a visitor for AST traversal
     */
    void accept(RuleVisitor visitor);
}
