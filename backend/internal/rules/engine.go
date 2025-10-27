package rules

import (
	"context"
	"fmt"
	"sync"

	"github.com/betracehq/betrace/backend/pkg/models"
)

const (
	// MaxRules is the maximum number of compiled rules allowed in memory
	// Prevents unbounded memory growth (150K rules ~= 128MB with typical mix)
	MaxRules = 100000
)

// CompiledRule represents a rule with its pre-parsed AST and field filter
type CompiledRule struct {
	Rule        models.Rule
	AST         Expr         // Pre-parsed AST (cached)
	FieldFilter *FieldFilter // Fields accessed by this rule (lazy evaluation)
}

// RuleEngine manages compiled rules and evaluates them against spans
type RuleEngine struct {
	mu            sync.RWMutex
	rules         map[string]*CompiledRule
	evaluator     *Evaluator
	parseErrors   map[string]error // Track rules that failed to parse
}

// NewRuleEngine creates a new rule engine
func NewRuleEngine() *RuleEngine {
	return &RuleEngine{
		rules:       make(map[string]*CompiledRule),
		evaluator:   NewEvaluator(),
		parseErrors: make(map[string]error),
	}
}

// LoadRule parses and caches a rule's AST
func (e *RuleEngine) LoadRule(rule models.Rule) error {
	e.mu.Lock()
	// Check rule limit (unless replacing existing rule)
	if _, exists := e.rules[rule.ID]; !exists && len(e.rules) >= MaxRules {
		e.mu.Unlock()
		return fmt.Errorf("rule limit exceeded: %d/%d (delete rules to add new ones)", len(e.rules), MaxRules)
	}
	e.mu.Unlock()

	// Parse the rule expression
	parser := NewParser(rule.Expression)
	ast, err := parser.Parse()
	if err != nil {
		e.mu.Lock()
		e.parseErrors[rule.ID] = err
		e.mu.Unlock()
		return fmt.Errorf("failed to parse rule %s: %w", rule.ID, err)
	}

	// Build field filter for lazy evaluation
	fieldFilter := BuildFieldFilter(ast)

	// Cache the compiled rule
	e.mu.Lock()
	e.rules[rule.ID] = &CompiledRule{
		Rule:        rule,
		AST:         ast,
		FieldFilter: fieldFilter,
	}
	delete(e.parseErrors, rule.ID) // Clear any previous error
	e.mu.Unlock()

	return nil
}

// UnloadRule removes a rule from the engine
func (e *RuleEngine) UnloadRule(ruleID string) {
	e.mu.Lock()
	delete(e.rules, ruleID)
	delete(e.parseErrors, ruleID)
	e.mu.Unlock()
}

// DeleteRule is an alias for UnloadRule (API consistency)
func (e *RuleEngine) DeleteRule(ruleID string) {
	e.UnloadRule(ruleID)
}

// GetRule returns a compiled rule by ID
func (e *RuleEngine) GetRule(ruleID string) (*CompiledRule, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	rule, ok := e.rules[ruleID]
	return rule, ok
}

// ListRules returns all loaded rules
func (e *RuleEngine) ListRules() []*CompiledRule {
	e.mu.RLock()
	defer e.mu.RUnlock()

	rules := make([]*CompiledRule, 0, len(e.rules))
	for _, r := range e.rules {
		rules = append(rules, r)
	}
	return rules
}

// EvaluateRule evaluates a single rule against a span
func (e *RuleEngine) EvaluateRule(ctx context.Context, ruleID string, span *models.Span) (bool, error) {
	// Get compiled rule (read lock only)
	e.mu.RLock()
	compiled, ok := e.rules[ruleID]
	e.mu.RUnlock()

	if !ok {
		return false, fmt.Errorf("rule not found: %s", ruleID)
	}

	// Check if rule is enabled
	if !compiled.Rule.Enabled {
		return false, nil
	}

	// Create lazy span context (only loads fields referenced by rule)
	spanCtx := NewSpanContext(span, compiled.FieldFilter)

	// Evaluate using cached AST + lazy context
	return e.evaluator.EvaluateWithContext(compiled.AST, spanCtx)
}

// EvaluateAll evaluates all enabled rules against a span
// Returns list of rule IDs that matched
func (e *RuleEngine) EvaluateAll(ctx context.Context, span *models.Span) ([]string, error) {
	// Get snapshot of rules (read lock only)
	e.mu.RLock()
	rules := make([]*CompiledRule, 0, len(e.rules))
	for _, r := range e.rules {
		if r.Rule.Enabled {
			rules = append(rules, r)
		}
	}
	e.mu.RUnlock()

	// Evaluate each rule (no locks needed - AST is immutable)
	matches := make([]string, 0, 10)
	for _, compiled := range rules {
		// Create lazy span context (only loads fields referenced by this rule)
		spanCtx := NewSpanContext(span, compiled.FieldFilter)

		result, err := e.evaluator.EvaluateWithContext(compiled.AST, spanCtx)
		if err != nil {
			// Log error but continue evaluating other rules
			continue
		}

		if result {
			matches = append(matches, compiled.Rule.ID)
		}
	}

	return matches, nil
}

// EvaluateTrace evaluates all enabled rules against a complete trace
// Returns list of rule IDs that matched
func (e *RuleEngine) EvaluateTrace(ctx context.Context, traceID string, spans []*models.Span) ([]string, error) {
	// Get snapshot of rules (read lock only)
	e.mu.RLock()
	rules := make([]*CompiledRule, 0, len(e.rules))
	for _, r := range e.rules {
		if r.Rule.Enabled {
			rules = append(rules, r)
		}
	}
	e.mu.RUnlock()

	// Evaluate each rule
	matches := make([]string, 0, 10)
	for _, compiled := range rules {
		// Check if this rule uses trace.has() - if so, use trace evaluation
		// Otherwise use span-level evaluation (for backward compatibility)
		if e.evaluator.UsesTraceLevel(compiled.AST) {
			result, err := e.evaluator.EvaluateTrace(compiled.AST, spans)
			if err != nil {
				// Log error but continue evaluating other rules
				continue
			}

			if result {
				matches = append(matches, compiled.Rule.ID)
			}
		} else {
			// Legacy span-level evaluation - check each span
			for _, span := range spans {
				spanCtx := NewSpanContext(span, compiled.FieldFilter)
				result, err := e.evaluator.EvaluateWithContext(compiled.AST, spanCtx)
				if err != nil {
					continue
				}
				if result {
					matches = append(matches, compiled.Rule.ID)
					break // Only need one match
				}
			}
		}
	}

	return matches, nil
}

// EvaluateAllDetailed evaluates all enabled rules and returns detailed results
type EvaluationResult struct {
	RuleID   string
	RuleName string
	Matched  bool
	Error    error
}

func (e *RuleEngine) EvaluateAllDetailed(ctx context.Context, span *models.Span) []EvaluationResult {
	// Get snapshot of rules
	e.mu.RLock()
	rules := make([]*CompiledRule, 0, len(e.rules))
	for _, r := range e.rules {
		if r.Rule.Enabled {
			rules = append(rules, r)
		}
	}
	e.mu.RUnlock()

	// Evaluate each rule
	results := make([]EvaluationResult, 0, len(rules))
	for _, compiled := range rules {
		matched, err := e.evaluator.Evaluate(compiled.AST, span)
		results = append(results, EvaluationResult{
			RuleID:   compiled.Rule.ID,
			RuleName: compiled.Rule.Name,
			Matched:  matched,
			Error:    err,
		})
	}

	return results
}

// Stats returns statistics about the rule engine
type EngineStats struct {
	TotalRules   int
	EnabledRules int
	DisabledRules int
	ParseErrors  int
}

func (e *RuleEngine) Stats() EngineStats {
	e.mu.RLock()
	defer e.mu.RUnlock()

	stats := EngineStats{
		TotalRules:  len(e.rules),
		ParseErrors: len(e.parseErrors),
	}

	for _, r := range e.rules {
		if r.Rule.Enabled {
			stats.EnabledRules++
		} else {
			stats.DisabledRules++
		}
	}

	return stats
}

// GetParseErrors returns all rules that failed to parse
func (e *RuleEngine) GetParseErrors() map[string]error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	errors := make(map[string]error, len(e.parseErrors))
	for k, v := range e.parseErrors {
		errors[k] = v
	}
	return errors
}
