package api

import (
	"encoding/json"
	"net/http"

	"github.com/betracehq/betrace/backend/internal/dsl"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// ValidateRuleRequest is the request body for rule validation
type ValidateRuleRequest struct {
	Expression string `json:"expression"`
}

// ValidateRuleResponse is the response for rule validation
type ValidateRuleResponse struct {
	Valid  bool   `json:"valid"`
	Error  string `json:"error,omitempty"`
	AST    string `json:"ast,omitempty"` // String representation of parsed AST (for debugging)
}

// ValidateRule handles POST /api/rules/validate
// Validates DSL v2.0 expression syntax without saving
func (h *RuleHandlers) ValidateRule(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "ValidateRule")
		defer span.End()
	}

	// Parse request body
	var req ValidateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Expression == "" {
		respondError(w, "Missing required field: expression", http.StatusBadRequest)
		return
	}

	// Parse DSL v2.0 expression
	ast, err := dsl.Parse(req.Expression)
	if err != nil {
		// Parsing failed - invalid syntax
		if h.tracer != nil {
			span := trace.SpanFromContext(ctx)
			span.SetAttributes(
				attribute.Bool("validation.valid", false),
				attribute.String("validation.error", err.Error()),
			)
		}

		respondJSON(w, http.StatusOK, ValidateRuleResponse{
			Valid: false,
			Error: err.Error(),
		})
		return
	}

	// Parsing succeeded - valid syntax
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(
			attribute.Bool("validation.valid", true),
		)
	}

	// Return success with AST representation for debugging
	astString := formatAST(ast)
	respondJSON(w, http.StatusOK, ValidateRuleResponse{
		Valid: true,
		AST:   astString,
	})
}

// formatAST creates a simple string representation of the AST for debugging
func formatAST(ast *dsl.Rule) string {
	if ast == nil {
		return "nil"
	}

	result := "when { ... }"
	if ast.Always != nil {
		result += " always { ... }"
	}
	if ast.Never != nil {
		result += " never { ... }"
	}
	return result
}
