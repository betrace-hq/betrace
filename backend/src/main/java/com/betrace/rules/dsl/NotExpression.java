package com.fluo.rules.dsl;

/**
 * NOT expression
 */
public record NotExpression(RuleExpression expression) implements RuleExpression {

    @Override
    public void accept(RuleVisitor visitor) {
        visitor.visit(this);
    }
}
