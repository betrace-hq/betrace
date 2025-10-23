package com.betrace.rules.dsl;

/**
 * Generates Drools DRL from FLUO DSL AST (PRD-005 Security: Sandboxed Execution)
 *
 * Translates expressions like:
 *   trace.has(payment.charge_card).where(amount > 1000) and trace.has(payment.fraud_check)
 *
 * Into Drools DRL:
 *   rule "rule-id"
 *   when
 *       $charge: Span(operationName == "payment.charge_card", attributes["amount"] > 1000, $tid: traceId)
 *       not Span(operationName == "payment.fraud_check", traceId == $tid)
 *   then
 *       sandbox.createSignal("rule-id", "description");
 *   end
 *
 * Security (PRD-005 Phase 1):
 * - Rules access SandboxedGlobals, NOT SignalService directly
 * - Tenant isolation enforced at capability level
 * - No service layer access from rules
 */
public class DroolsGenerator implements RuleVisitor {
    private final StringBuilder drl = new StringBuilder();
    private final String ruleId;
    private final String ruleName;
    private final String description;
    private int varCounter = 0;

    public DroolsGenerator(String ruleId, String ruleName, String description) {
        this.ruleId = ruleId;
        this.ruleName = ruleName;
        this.description = description;
    }

    /**
     * Generate DRL from AST (PRD-005: Uses sandboxed capabilities)
     */
    public String generate(RuleExpression ast) {
        return generate(ast, "SandboxedGlobals", "sandbox.createSignal(\"" + ruleId + "\", \"" + escapeString(description) + "\")");
    }

    /**
     * Generate DRL with custom global and action (for testing)
     */
    public String generate(RuleExpression ast, String globalType, String action) {
        drl.setLength(0); // reset
        varCounter = 0;

        // Start rule
        drl.append("package com.betrace.rules;\n\n");

        if (globalType.equals("SandboxedGlobals")) {
            // PRD-005 Phase 1: Use sandboxed capabilities instead of direct service access
            drl.append("import com.betrace.security.capabilities.SpanCapability;\n");
            drl.append("import com.betrace.security.capabilities.SandboxedGlobals;\n\n");
            drl.append("global SandboxedGlobals sandbox;\n\n");
        } else {
            // Legacy: Import Span for backward compatibility (testing only)
            drl.append("import com.betrace.model.Span;\n");

            if (globalType.equals("AtomicInteger")) {
                drl.append("import java.util.concurrent.atomic.AtomicInteger;\n\n");
                drl.append("global AtomicInteger signalCounter;\n\n");
            }
            // Note: SignalService removed in favor of ViolationSpanEmitter (ADR-026)
        }

        drl.append("rule \"").append(ruleId).append("\"\n");
        drl.append("when\n");

        // Generate conditions
        ast.accept(this);

        // End rule with signal generation
        drl.append("then\n");
        drl.append("    ").append(action).append(";\n");
        drl.append("end\n");

        return drl.toString();
    }

    @Override
    public void visit(BinaryExpression expr) {
        if (expr.operator().equals("and")) {
            // AND: both conditions in when clause
            expr.left().accept(this);
            expr.right().accept(this);
        } else {
            // OR: need separate rules or exists
            throw new UnsupportedOperationException("OR not yet implemented");
        }
    }

    @Override
    public void visit(NotExpression expr) {
        drl.append("    not ");
        expr.expression().accept(this);
    }

    @Override
    public void visit(HasExpression expr) {
        String varName = "$span" + varCounter++;

        // PRD-005: Use SpanCapability with getter methods instead of field access
        drl.append("    ").append(varName).append(": SpanCapability(\n");
        drl.append("        operationName == \"").append(expr.operationName()).append("\"");

        // Add where clauses
        for (WhereClause where : expr.whereClauses()) {
            drl.append(",\n        ");
            generateWhereClause(where);
        }

        // Capture traceId for correlation (use getter method for capability)
        if (varCounter == 1) {
            drl.append(",\n        $traceId: traceId");
        } else {
            drl.append(",\n        traceId == $traceId");
        }

        drl.append("\n    )\n");
    }

    private void generateWhereClause(WhereClause where) {
        drl.append("attributes[\"").append(where.attribute()).append("\"] ");

        switch (where.operator()) {
            case "==" -> drl.append("== ");
            case "!=" -> drl.append("!= ");
            case ">" -> drl.append("> ");
            case ">=" -> drl.append(">= ");
            case "<" -> drl.append("< ");
            case "<=" -> drl.append("<= ");
            case "in" -> {
                drl.append("in (");
                // TODO: handle list
                drl.append(")");
                return;
            }
            case "matches" -> {
                drl.append("matches \"");
                drl.append(escapeString(where.value().toString()));
                drl.append("\"");
                return;
            }
        }

        // Append value
        if (where.value() instanceof String) {
            drl.append("\"").append(escapeString(where.value().toString())).append("\"");
        } else if (where.value() instanceof Boolean) {
            drl.append(where.value());
        } else {
            drl.append(where.value());
        }
    }

    @Override
    public void visit(CountExpression expr) {
        // trace.count(pattern) op value
        // Drools needs to first find any span to get traceId, then count matching spans
        // PRD-005: Use SpanCapability instead of Span
        // $span0: SpanCapability($traceId: traceId)
        // Number($count: intValue) from accumulate(
        //    SpanCapability(operationName matches "pattern", traceId == $traceId),
        //    count(1)
        // )
        // eval($count > value)

        if (varCounter == 0) {
            // Need to bind a span first to get traceId
            drl.append("    $span").append(varCounter++).append(": SpanCapability($traceId: traceId)\n");
        }

        String varName = "$count" + varCounter++;
        drl.append("    Number(").append(varName).append(": intValue) from accumulate(\n");
        drl.append("        SpanCapability(operationName matches \"").append(expr.pattern())
           .append("\", traceId == $traceId),\n");
        drl.append("        count(1)\n");
        drl.append("    )\n");
        drl.append("    eval(").append(varName).append(" ").append(expr.operator())
           .append(" ").append(expr.value()).append(")\n");
    }

    private String escapeString(String str) {
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n");
    }
}
