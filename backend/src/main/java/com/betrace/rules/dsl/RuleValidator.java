package com.betrace.rules.dsl;

import com.betrace.model.Span;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Validates FLUO DSL rules for semantic correctness
 * Catches errors that the parser doesn't, like invalid attribute names or unrealistic conditions
 */
public class RuleValidator {

    private static final Set<String> KNOWN_SPAN_ATTRIBUTES = Set.of(
        "amount", "currency", "status", "processor", "endpoint", "method",
        "data.contains_pii", "pii_types", "db.system", "db.statement",
        "http.status_code", "http.method", "card.last4", "fraud.risk_score"
    );

    public static class ValidationResult {
        private final boolean valid;
        private final List<ValidationError> errors = new ArrayList<>();
        private final List<String> warnings = new ArrayList<>();

        public ValidationResult(boolean valid) {
            this.valid = valid;
        }

        public void addError(ValidationError error) {
            errors.add(error);
        }

        public void addWarning(String warning) {
            warnings.add(warning);
        }

        public boolean isValid() { return valid && errors.isEmpty(); }
        public List<ValidationError> getErrors() { return errors; }
        public List<String> getWarnings() { return warnings; }

        public String formatErrors() {
            StringBuilder sb = new StringBuilder();
            sb.append("Validation failed with ").append(errors.size()).append(" error(s):\n\n");
            for (ValidationError error : errors) {
                sb.append(error.format()).append("\n\n");
            }
            if (!warnings.isEmpty()) {
                sb.append("Warnings:\n");
                for (String warning : warnings) {
                    sb.append("  - ").append(warning).append("\n");
                }
            }
            return sb.toString();
        }
    }

    public static class ValidationError {
        private final String message;
        private final String suggestion;
        private final ErrorSeverity severity;

        public enum ErrorSeverity {
            ERROR, WARNING
        }

        public ValidationError(String message, String suggestion) {
            this(message, suggestion, ErrorSeverity.ERROR);
        }

        public ValidationError(String message, String suggestion, ErrorSeverity severity) {
            this.message = message;
            this.suggestion = suggestion;
            this.severity = severity;
        }

        public String format() {
            StringBuilder sb = new StringBuilder();
            sb.append("[").append(severity).append("] ").append(message);
            if (suggestion != null) {
                sb.append("\n  💡 Suggestion: ").append(suggestion);
            }
            return sb.toString();
        }
    }

    /**
     * Validate a parsed AST
     */
    public ValidationResult validate(RuleExpression ast) {
        ValidationResult result = new ValidationResult(true);
        ValidationVisitor visitor = new ValidationVisitor(result);
        ast.accept(visitor);
        return result;
    }

    private static class ValidationVisitor implements RuleVisitor {
        private final ValidationResult result;
        private int spanCheckCount = 0;

        public ValidationVisitor(ValidationResult result) {
            this.result = result;
        }

        @Override
        public void visit(BinaryExpression expr) {
            expr.left().accept(this);
            expr.right().accept(this);

            if (expr.operator().equals("or")) {
                result.addWarning("OR expressions may create multiple signals. Consider using separate rules.");
            }
        }

        @Override
        public void visit(NotExpression expr) {
            expr.expression().accept(this);
        }

        @Override
        public void visit(HasExpression expr) {
            spanCheckCount++;

            // Check for reasonable operation name
            String opName = expr.operationName();
            if (opName.length() < 3) {
                result.addError(new ValidationError(
                    "Operation name '" + opName + "' is too short",
                    "Use descriptive names like 'payment.charge_card' or 'database.query'"
                ));
            }

            if (!opName.contains(".")) {
                result.addWarning("Operation name '" + opName + "' doesn't follow convention. Consider using 'service.operation' format.");
            }

            // Validate where clauses
            for (WhereClause where : expr.whereClauses()) {
                validateWhereClause(where);
            }
        }

        private void validateWhereClause(WhereClause where) {
            // Warn about unknown attributes (might be intentional)
            if (!KNOWN_SPAN_ATTRIBUTES.contains(where.attribute())) {
                result.addWarning("Attribute '" + where.attribute() + "' is not commonly used. Make sure it's emitted by your spans.");
            }

            // Check for common mistakes
            if (where.attribute().equals("amount") && where.operator().equals("==")) {
                result.addWarning("Exact amount comparison (==) is fragile. Consider using ranges (>, <) instead.");
            }

            // Type checking
            if (where.attribute().contains("status") && !(where.value() instanceof String || where.value() instanceof Integer)) {
                result.addError(new ValidationError(
                    "Status attribute usually expects a string or number",
                    "Use quotes for string values: status == \"success\""
                ));
            }
        }

        @Override
        public void visit(CountExpression expr) {
            if (expr.value() > 1000) {
                result.addWarning("Counting more than 1000 spans may impact performance");
            }

            if (expr.operator().equals("==")) {
                result.addWarning("Exact count matching (==) is fragile. Consider using ranges (>, <) instead.");
            }
        }
    }

    /**
     * Validate generated Drools DRL
     */
    public static DroolsValidationResult validateDrools(String drl) {
        // This would actually try to compile the DRL and catch Drools errors
        // For now, just do basic checks
        List<String> errors = new ArrayList<>();

        if (!drl.contains("rule \"")) {
            errors.add("Generated DRL doesn't contain a rule definition");
        }

        if (!drl.contains("when") || !drl.contains("then")) {
            errors.add("Generated DRL is missing 'when' or 'then' clause");
        }

        return new DroolsValidationResult(errors.isEmpty(), errors);
    }

    public static class DroolsValidationResult {
        private final boolean valid;
        private final List<String> errors;

        public DroolsValidationResult(boolean valid, List<String> errors) {
            this.valid = valid;
            this.errors = errors;
        }

        public boolean isValid() { return valid; }
        public List<String> getErrors() { return errors; }

        public String formatErrors() {
            StringBuilder sb = new StringBuilder();
            sb.append("Drools DRL validation failed:\n");
            for (String error : errors) {
                sb.append("  ❌ ").append(error).append("\n");
            }
            return sb.toString();
        }
    }
}
