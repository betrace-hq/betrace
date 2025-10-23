package com.betrace.rules.dsl;

/**
 * Visitor interface for traversing rule AST
 */
public interface RuleVisitor {
    void visit(BinaryExpression expr);
    void visit(NotExpression expr);
    void visit(HasExpression expr);
    void visit(CountExpression expr);
}
