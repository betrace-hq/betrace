package com.fluo.rules.dsl;

/**
 * Binary expression (AND/OR)
 */
public record BinaryExpression(String operator, RuleExpression left, RuleExpression right)
    implements RuleExpression {

    @Override
    public void accept(RuleVisitor visitor) {
        visitor.visit(this);
    }
}
