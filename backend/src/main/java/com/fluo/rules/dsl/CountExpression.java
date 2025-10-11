package com.fluo.rules.dsl;

/**
 * trace.count(pattern) op value expression
 */
public record CountExpression(String pattern, String operator, int value) implements RuleExpression {

    @Override
    public void accept(RuleVisitor visitor) {
        visitor.visit(this);
    }
}
