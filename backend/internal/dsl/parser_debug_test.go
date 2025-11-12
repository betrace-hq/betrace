package dsl

import (
	"fmt"
	"testing"
)

// TestParserDebug tests the parser directly with simple rules
func TestParserDebug(t *testing.T) {
	tests := []struct {
		name string
		rule string
	}{
		{
			name: "Simple dotted span name with where",
			rule: `when { payment.charge_card.where(amount > 1000) } always { payment.fraud_check }`,
		},
		{
			name: "Simple dotted span name without where",
			rule: `when { payment.charge_card } always { payment.fraud_check }`,
		},
		{
			name: "Single identifier with where",
			rule: `when { payment.where(amount > 1000) } always { fraud_check }`,
		},
		{
			name: "AI agent rule",
			rule: `when { agent.plan.created and agent.plan.executed } never { agent.action.where(goal_deviation_score > 0.3) }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fmt.Printf("\n=== Testing: %s ===\n", tt.name)
			fmt.Printf("Rule: %s\n", tt.rule)

			parsed, err := Parse(tt.rule)
			if err != nil {
				t.Errorf("❌ Parse FAILED: %v", err)
			} else {
				fmt.Printf("✅ Parse SUCCESS\n")
				fmt.Printf("Parsed: %+v\n", parsed)
			}
		})
	}
}
