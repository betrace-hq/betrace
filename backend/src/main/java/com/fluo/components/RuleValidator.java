package com.fluo.components;

import com.fluo.model.RuleDefinition;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.Exchange;
import org.apache.camel.Handler;

/**
 * Simple bean to validate rules before storage.
 */
@ApplicationScoped
public class RuleValidator {

    @Handler
    public void validate(Exchange exchange) {
        String name = exchange.getIn().getHeader("ruleName", String.class);
        String expression = exchange.getIn().getHeader("ruleExpression", String.class);

        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Rule name is required");
        }

        if (expression == null || expression.trim().isEmpty()) {
            throw new IllegalArgumentException("Rule expression is required");
        }

        // Create a RuleDefinition object with only the provided data
        RuleDefinition rule = new RuleDefinition();
        rule.setName(name);
        rule.setExpression(expression);
        // Don't set ID, version, or active status here - let the RuleDefinition model defaults
        // or downstream processors handle these fields

        exchange.getIn().setBody(rule);
    }
}