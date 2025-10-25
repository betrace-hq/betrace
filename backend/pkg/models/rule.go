package models

import (
	"fmt"
	"time"
)

// Rule represents a BeTrace DSL rule
type Rule struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Severity    string    `json:"severity"`    // HIGH, MEDIUM, LOW
	Expression  string    `json:"expression"`  // BeTrace DSL syntax
	LuaCode     string    `json:"luaCode"`     // Compiled Lua code
	Enabled     bool      `json:"enabled"`
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// RuleLimits defines validation limits for rules
type RuleLimits struct {
	MaxExpressionLength  int
	MaxDescriptionLength int
	MaxNameLength        int
}

// Validate checks if rule meets configured limits
func (r *Rule) Validate(limits RuleLimits) error {
	// Check name length
	if len(r.Name) > limits.MaxNameLength {
		return fmt.Errorf("rule name length %d exceeds limit of %d bytes", len(r.Name), limits.MaxNameLength)
	}

	// Check expression length (Participle parser has NO built-in limits!)
	if len(r.Expression) > limits.MaxExpressionLength {
		return fmt.Errorf("rule expression length %d exceeds limit of %d bytes", len(r.Expression), limits.MaxExpressionLength)
	}

	// Check description length
	if len(r.Description) > limits.MaxDescriptionLength {
		return fmt.Errorf("rule description length %d exceeds limit of %d bytes", len(r.Description), limits.MaxDescriptionLength)
	}

	return nil
}
