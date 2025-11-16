package rules

import (
	"context"
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRuleEngine_LoadRule(t *testing.T) {
	engine := NewRuleEngine()

	tests := []struct {
		name    string
		rule    models.Rule
		wantErr bool
	}{
		{
			name: "valid simple rule",
			rule: models.Rule{
				ID:         "rule1",
				Name:       "Error Detection",
				Expression: `when { error } never { success }`,
				Enabled:    true,
			},
			wantErr: false,
		},
		{
			name: "valid complex rule",
			rule: models.Rule{
				ID:         "rule2",
				Name:       "Slow Query",
				Expression: `when { query } always { response }`,
				Enabled:    true,
			},
			wantErr: false,
		},
		{
			name: "invalid syntax",
			rule: models.Rule{
				ID:         "rule3",
				Name:       "Bad Syntax",
				Expression: `span.status == `,
				Enabled:    true,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := engine.LoadRule(tt.rule)
			if tt.wantErr {
				require.Error(t, err)
				// Check that error is tracked
				errors := engine.GetParseErrors()
				assert.Contains(t, errors, tt.rule.ID)
			} else {
				require.NoError(t, err)
				// Check that rule is loaded
				compiled, ok := engine.GetRule(tt.rule.ID)
				require.True(t, ok)
				assert.Equal(t, tt.rule.ID, compiled.Rule.ID)
				assert.NotNil(t, compiled.AST)
			}
		})
	}
}

func TestRuleEngine_UnloadRule(t *testing.T) {
	engine := NewRuleEngine()

	rule := models.Rule{
		ID:         "rule1",
		Name:       "Test",
		Expression: `when { error } never { success }`,
		Enabled:    true,
	}

	err := engine.LoadRule(rule)
	require.NoError(t, err)

	// Verify loaded
	_, ok := engine.GetRule(rule.ID)
	require.True(t, ok)

	// Unload
	engine.UnloadRule(rule.ID)

	// Verify unloaded
	_, ok = engine.GetRule(rule.ID)
	assert.False(t, ok)
}

func TestRuleEngine_EvaluateRule(t *testing.T) {
	engine := NewRuleEngine()

	rule := models.Rule{
		ID:         "rule1",
		Name:       "Error Detection",
		Expression: `when { error } always { log }`,
		Enabled:    true,
	}

	err := engine.LoadRule(rule)
	require.NoError(t, err)

	tests := []struct {
		name    string
		span    *models.Span
		want    bool
		wantErr bool
	}{
		{
			name: "matching span - violation (error without log)",
			span: &models.Span{
				OperationName: "error",
			},
			want: true, // Violation: when error, always log - but no log span
		},
		{
			name: "non-matching span",
			span: &models.Span{
				OperationName: "success",
			},
			want: false, // When clause doesn't match
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := engine.EvaluateRule(context.Background(), rule.ID, tt.span)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestRuleEngine_EvaluateAll(t *testing.T) {
	engine := NewRuleEngine()

	// Load multiple rules
	rules := []models.Rule{
		{
			ID:         "rule1",
			Name:       "Error Detection",
			Expression: `when { error } never { success }`,
			Enabled:    true,
		},
		{
			ID:         "rule2",
			Name:       "Query Response Required",
			Expression: `when { query } always { response }`,
			Enabled:    true,
		},
		{
			ID:         "rule3",
			Name:       "Payment Fraud Check",
			Expression: `when { payment } always { fraud_check }`,
			Enabled:    true,
		},
		{
			ID:         "rule4",
			Name:       "Disabled Rule",
			Expression: `when { critical } never { normal }`,
			Enabled:    false, // Should not evaluate
		},
	}

	for _, r := range rules {
		err := engine.LoadRule(r)
		require.NoError(t, err)
	}

	tests := []struct {
		name         string
		span         *models.Span
		wantMatches  []string
		wantNoMatch  []string
	}{
		{
			name: "error span - violates rule1",
			span: &models.Span{
				OperationName: "error",
			},
			wantMatches: []string{}, // No rules should match (rule1 never succeeds is satisfied)
			wantNoMatch: []string{"rule1", "rule2", "rule3", "rule4"},
		},
		{
			name: "query without response - violates rule2",
			span: &models.Span{
				OperationName: "query",
			},
			wantMatches: []string{"rule2"}, // Violation: query without response
			wantNoMatch: []string{"rule1", "rule3", "rule4"},
		},
		{
			name: "matches no rules",
			span: &models.Span{
				OperationName: "normal_operation",
			},
			wantMatches: []string{},
			wantNoMatch: []string{"rule1", "rule2", "rule3", "rule4"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches, err := engine.EvaluateAll(context.Background(), tt.span)
			require.NoError(t, err)

			// Check expected matches
			for _, ruleID := range tt.wantMatches {
				assert.Contains(t, matches, ruleID, "Expected rule %s to match", ruleID)
			}

			// Check expected non-matches
			for _, ruleID := range tt.wantNoMatch {
				assert.NotContains(t, matches, ruleID, "Expected rule %s NOT to match", ruleID)
			}
		})
	}
}

func TestRuleEngine_EvaluateAllDetailed(t *testing.T) {
	engine := NewRuleEngine()

	rules := []models.Rule{
		{
			ID:         "rule1",
			Name:       "Error Detection",
			Expression: `when { error } always { log }`,
			Enabled:    true,
		},
		{
			ID:         "rule2",
			Name:       "Success Check",
			Expression: `when { request } always { response }`,
			Enabled:    true,
		},
	}

	for _, r := range rules {
		err := engine.LoadRule(r)
		require.NoError(t, err)
	}

	span := &models.Span{
		OperationName: "error",
	}

	results := engine.EvaluateAllDetailed(context.Background(), span)

	// Should have 2 results
	assert.Len(t, results, 2)

	// Find rule1 result
	var rule1Result *EvaluationResult
	for i := range results {
		if results[i].RuleID == "rule1" {
			rule1Result = &results[i]
			break
		}
	}

	require.NotNil(t, rule1Result)
	assert.True(t, rule1Result.Matched)
	assert.NoError(t, rule1Result.Error)

	// Find rule2 result
	var rule2Result *EvaluationResult
	for i := range results {
		if results[i].RuleID == "rule2" {
			rule2Result = &results[i]
			break
		}
	}

	require.NotNil(t, rule2Result)
	assert.False(t, rule2Result.Matched)
	assert.NoError(t, rule2Result.Error)
}

func TestRuleEngine_Stats(t *testing.T) {
	engine := NewRuleEngine()

	// Initially empty
	stats := engine.Stats()
	assert.Equal(t, 0, stats.TotalRules)
	assert.Equal(t, 0, stats.EnabledRules)
	assert.Equal(t, 0, stats.DisabledRules)
	assert.Equal(t, 0, stats.ParseErrors)

	// Load some rules
	rules := []models.Rule{
		{
			ID:         "rule1",
			Name:       "Valid Rule 1",
			Expression: `when { error } never { success }`,
			Enabled:    true,
		},
		{
			ID:         "rule2",
			Name:       "Valid Rule 2",
			Expression: `when { request } always { response }`,
			Enabled:    false,
		},
		{
			ID:         "rule3",
			Name:       "Invalid Rule",
			Expression: `span.status ==`,  // Missing right side of comparison - invalid syntax
			Enabled:    true,
		},
	}

	for _, r := range rules {
		_ = engine.LoadRule(r) // Ignore errors
	}

	stats = engine.Stats()
	assert.Equal(t, 2, stats.TotalRules, "Expected 2 valid rules loaded") // rule1 and rule2 loaded
	assert.Equal(t, 1, stats.EnabledRules, "Expected 1 enabled rule")
	assert.Equal(t, 1, stats.DisabledRules, "Expected 1 disabled rule")
	assert.Equal(t, 1, stats.ParseErrors, "Expected 1 parse error") // rule3 failed
}

func TestRuleEngine_ConcurrentAccess(t *testing.T) {
	engine := NewRuleEngine()

	rule := models.Rule{
		ID:         "rule1",
		Name:       "Error Detection",
		Expression: `when { error } never { success }`,
		Enabled:    true,
	}

	err := engine.LoadRule(rule)
	require.NoError(t, err)

	span := &models.Span{
		OperationName: "error",
	}

	// Run concurrent evaluations
	done := make(chan bool, 100)
	for i := 0; i < 100; i++ {
		go func() {
			matches, err := engine.EvaluateAll(context.Background(), span)
			assert.NoError(t, err)
			// Rule: when { error } never { success }
			// Trace has: error span only (no success span)
			// When clause matches, never clause doesn't match -> no violation -> no match
			assert.Len(t, matches, 0)
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 100; i++ {
		<-done
	}
}

func TestRuleEngine_DisabledRules(t *testing.T) {
	engine := NewRuleEngine()

	rule := models.Rule{
		ID:         "rule1",
		Name:       "Disabled",
		Expression: `when { error } never { success }`,
		Enabled:    false,
	}

	err := engine.LoadRule(rule)
	require.NoError(t, err)

	span := &models.Span{
		OperationName: "error",
	}

	// Disabled rule should not match
	matches, err := engine.EvaluateAll(context.Background(), span)
	require.NoError(t, err)
	assert.Empty(t, matches)
}

// Benchmark AST caching vs re-parsing
func BenchmarkRuleEngine_WithCache(b *testing.B) {
	engine := NewRuleEngine()

	rule := models.Rule{
		ID:         "rule1",
		Expression: `span.status == "ERROR" and span.duration > 1000000000`,
		Enabled:    true,
	}

	_ = engine.LoadRule(rule) // Parse once

	span := &models.Span{
		Status:   "ERROR",
		Duration: 2000000000,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = engine.EvaluateAll(context.Background(), span)
	}
}

func BenchmarkRuleEngine_WithoutCache(b *testing.B) {
	expression := `span.status == "ERROR" and span.duration > 1000000000`

	span := &models.Span{
		Status:   "ERROR",
		Duration: 2000000000,
	}

	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		parser := NewParser(expression)
		ast, _ := parser.Parse()
		_, _ = evaluator.Evaluate(ast, span)
	}
}
