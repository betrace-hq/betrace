package com.fluo.services;

import com.fluo.model.Rule;
import com.fluo.rules.dsl.DroolsGenerator;
import com.fluo.rules.dsl.FluoDslParser;
import com.fluo.rules.dsl.ParseError;
import com.fluo.rules.dsl.RuleExpression;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Drools Rule Engine - Converts FLUO DSL rules to Drools DRL and manages compilation.
 *
 * Flow:
 * 1. FLUO DSL → Parse → AST
 * 2. AST → Generate → DRL
 * 3. DRL → Compile → KieContainer
 * 4. KieContainer → newKieSession → Rule Evaluation
 */
@ApplicationScoped
public class DroolsRuleEngine {

    private static final Logger LOG = Logger.getLogger(DroolsRuleEngine.class);

    @Inject
    TenantSessionManager sessionManager;

    private final FluoDslParser parser = new FluoDslParser();

    /**
     * Compile and deploy rules for a tenant
     *
     * @param tenantId Tenant ID
     * @param rules List of FLUO rules
     * @return Compilation result with errors if any
     */
    public CompilationResult compileAndDeployRules(String tenantId, List<Rule> rules) {
        LOG.infof("Compiling %d rules for tenant: %s", rules.size(), tenantId);

        List<String> drlRules = new ArrayList<>();
        List<CompilationError> errors = new ArrayList<>();

        // Parse and generate DRL for each rule
        for (Rule rule : rules) {
            try {
                // Parse FLUO DSL to AST
                RuleExpression ast = parser.parse(rule.expression());

                // Generate Drools DRL from AST
                DroolsGenerator generator = new DroolsGenerator(
                    rule.id(),
                    rule.name(),
                    rule.name() // Use name as description since Rule doesn't have description field
                );
                String drl = generator.generate(ast);

                drlRules.add(drl);

            } catch (ParseError e) {
                LOG.errorf("Parse error for rule %s: %s", rule.id(), e.getMessage());
                errors.add(new CompilationError(
                    rule.id(),
                    rule.name(),
                    "Parse error: " + e.getMessage(),
                    e.getLine(),
                    e.getColumn()
                ));
            } catch (Exception e) {
                LOG.errorf(e, "Unexpected error compiling rule %s", rule.id());
                errors.add(new CompilationError(
                    rule.id(),
                    rule.name(),
                    "Compilation error: " + e.getMessage(),
                    -1,
                    -1
                ));
            }
        }

        // If any parse errors, don't deploy
        if (!errors.isEmpty()) {
            return new CompilationResult(false, errors);
        }

        // Deploy to tenant session manager
        boolean success = sessionManager.updateRules(tenantId, drlRules);

        if (!success) {
            errors.add(new CompilationError(
                null,
                null,
                "Drools compilation failed - check logs for details",
                -1,
                -1
            ));
        }

        return new CompilationResult(success, errors);
    }

    /**
     * Validate a FLUO DSL expression without deploying
     *
     * @param expression FLUO DSL expression
     * @return Validation result
     */
    public ValidationResult validateExpression(String expression) {
        try {
            RuleExpression ast = parser.parse(expression);

            // Try generating DRL to ensure it's valid
            DroolsGenerator generator = new DroolsGenerator("validation", "Validation", "Validation");
            String drl = generator.generate(ast);

            return new ValidationResult(true, null, null, -1, -1);

        } catch (ParseError e) {
            return new ValidationResult(
                false,
                e.getMessage(),
                e.getSuggestion(),
                e.getLine(),
                e.getColumn()
            );
        } catch (Exception e) {
            return new ValidationResult(
                false,
                "Unexpected error: " + e.getMessage(),
                null,
                -1,
                -1
            );
        }
    }

    /**
     * Get DRL output for a FLUO DSL expression (for debugging)
     */
    public String generateDrl(String ruleId, String name, String description, String expression) {
        try {
            RuleExpression ast = parser.parse(expression);
            DroolsGenerator generator = new DroolsGenerator(ruleId, name, description);
            return generator.generate(ast);
        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }

    // ========== Result Classes ==========

    public record CompilationResult(
        boolean success,
        List<CompilationError> errors
    ) {
        public String getErrorSummary() {
            if (success) {
                return "Success";
            }
            return errors.stream()
                .map(e -> e.ruleId() + ": " + e.message())
                .collect(Collectors.joining("; "));
        }
    }

    public record CompilationError(
        String ruleId,
        String ruleName,
        String message,
        int line,
        int column
    ) {}

    public record ValidationResult(
        boolean valid,
        String errorMessage,
        String suggestion,
        int line,
        int column
    ) {}
}
