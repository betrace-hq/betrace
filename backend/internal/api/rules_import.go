package api

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/betracehq/betrace/backend/pkg/models"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"gopkg.in/yaml.v3"
)

// YAMLRuleFile represents the structure of our example YAML rule files
type YAMLRuleFile struct {
	Rules []YAMLRule `yaml:"rules"`
}

// YAMLRule represents a single rule in YAML format
type YAMLRule struct {
	ID                    string              `yaml:"id"`
	Name                  string              `yaml:"name"`
	Description           string              `yaml:"description"`
	Severity              string              `yaml:"severity"`
	ComplianceFrameworks  []string            `yaml:"compliance_frameworks"`
	Condition             string              `yaml:"condition"`
	ExampleViolation      *YAMLExampleViolation `yaml:"example_violation,omitempty"`
}

// YAMLExampleViolation represents the example_violation section (for documentation only)
type YAMLExampleViolation struct {
	Description string                   `yaml:"description"`
	Trace       []map[string]interface{} `yaml:"trace"`
}

// ImportRules handles POST /api/rules/import
// Accepts YAML files with multiple rules and bulk imports them
func (h *RuleHandlers) ImportRules(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "ImportRules")
		defer span.End()
	}

	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		respondError(w, "Failed to read request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Parse YAML
	var yamlFile YAMLRuleFile
	if err := yaml.Unmarshal(body, &yamlFile); err != nil {
		respondError(w, "Invalid YAML format: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validate
	if len(yamlFile.Rules) == 0 {
		respondError(w, "No rules found in YAML file", http.StatusBadRequest)
		return
	}

	// Import results
	results := ImportResults{
		Total:     len(yamlFile.Rules),
		Succeeded: 0,
		Failed:    0,
		Errors:    make([]ImportError, 0),
		Imported:  make([]models.Rule, 0),
	}

	// Import each rule
	for i, yamlRule := range yamlFile.Rules {
		// Validate required fields
		if yamlRule.Name == "" {
			results.Failed++
			results.Errors = append(results.Errors, ImportError{
				Index:   i,
				RuleID:  yamlRule.ID,
				Message: "Missing required field: name",
			})
			continue
		}

		if yamlRule.Condition == "" {
			results.Failed++
			results.Errors = append(results.Errors, ImportError{
				Index:   i,
				RuleID:  yamlRule.ID,
				Message: "Missing required field: condition",
			})
			continue
		}

		// Convert YAML rule to models.Rule
		rule := models.Rule{
			ID:          yamlRule.ID,
			Name:        yamlRule.Name,
			Description: yamlRule.Description,
			Severity:    strings.ToUpper(yamlRule.Severity), // Normalize to uppercase
			Expression:  strings.TrimSpace(yamlRule.Condition), // Use condition as expression
			Enabled:     true, // Enable by default
		}

		// Generate ID if not provided
		if rule.ID == "" {
			rule.ID = uuid.New().String()
		}

		// Normalize severity
		if rule.Severity == "" {
			rule.Severity = "MEDIUM"
		}

		// Create rule
		created, err := h.store.Create(ctx, rule)
		if err != nil {
			results.Failed++
			results.Errors = append(results.Errors, ImportError{
				Index:   i,
				RuleID:  yamlRule.ID,
				Message: fmt.Sprintf("Failed to create rule: %v", err),
			})
			continue
		}

		results.Succeeded++
		results.Imported = append(results.Imported, created)
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(
			attribute.Int("import.total", results.Total),
			attribute.Int("import.succeeded", results.Succeeded),
			attribute.Int("import.failed", results.Failed),
		)
	}

	// Return results
	if results.Failed > 0 {
		// Partial success - return 207 Multi-Status
		respondJSON(w, http.StatusMultiStatus, results)
	} else {
		// Full success - return 200 OK
		respondJSON(w, http.StatusOK, results)
	}
}

// ImportResults represents the response from bulk import
type ImportResults struct {
	Total     int           `json:"total"`
	Succeeded int           `json:"succeeded"`
	Failed    int           `json:"failed"`
	Errors    []ImportError `json:"errors,omitempty"`
	Imported  []models.Rule `json:"imported"`
}

// ImportError represents a single import failure
type ImportError struct {
	Index   int    `json:"index"`
	RuleID  string `json:"rule_id,omitempty"`
	Message string `json:"message"`
}
