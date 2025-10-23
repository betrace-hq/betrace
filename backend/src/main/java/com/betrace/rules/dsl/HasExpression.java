package com.fluo.rules.dsl;

import java.util.ArrayList;
import java.util.List;

/**
 * trace.has(operationName).where(...) expression
 */
public class HasExpression implements RuleExpression {
    private final String operationName;
    private final List<WhereClause> whereClauses = new ArrayList<>();

    public HasExpression(String operationName) {
        this.operationName = operationName;
    }

    public void addWhereClause(WhereClause clause) {
        whereClauses.add(clause);
    }

    public String operationName() {
        return operationName;
    }

    public List<WhereClause> whereClauses() {
        return whereClauses;
    }

    @Override
    public void accept(RuleVisitor visitor) {
        visitor.visit(this);
    }
}
