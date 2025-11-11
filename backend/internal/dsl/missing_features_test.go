package dsl

import (
	"testing"
)

// TestPotentiallyMissingFeatures checks what might be missing from the DSL
func TestPotentiallyMissingFeatures(t *testing.T) {
	tests := []struct {
		name       string
		dsl        string
		shouldWork bool
		notes      string
	}{
		{
			name:       "Regex matching with matches operator",
			dsl:        `when { api_request.where(endpoint matches "/admin/.*") }`,
			shouldWork: true,
			notes:      "matches operator exists in grammar",
		},
		{
			name:       "List membership with in operator",
			dsl:        `when { payment.where(processor in ["stripe", "square"]) }`,
			shouldWork: true,
			notes:      "in operator exists, list literals supported",
		},
		{
			name:       "Negation inside where clause",
			dsl:        `when { payment.where(not verified) }`,
			shouldWork: false, // WhereComparison expects comparison, not boolean
			notes:      "Would need WhereAtomicTerm to support bare identifiers",
		},
		{
			name:       "Chained where clauses",
			dsl:        `when { payment.where(amount > 1000).where(currency == "USD") }`,
			shouldWork: false,
			notes:      "Grammar doesn't support chaining .where() calls",
		},
		{
			name:       "Arithmetic expressions",
			dsl:        `when { payment.where(amount - refund > 1000) }`,
			shouldWork: false,
			notes:      "No arithmetic operators in Expression type",
		},
		{
			name:       "Attribute-to-attribute comparison (same span)",
			dsl:        `when { payment.where(refund_amount > charge_amount) }`,
			shouldWork: false,
			notes:      "Expression.Path exists but not implemented in WhereComparison",
		},
		{
			name:       "Cross-span attribute comparison",
			dsl:        `when { payment.amount > fraud_score.threshold }`,
			shouldWork: false,
			notes:      "Would need cross-span context resolution",
		},
		{
			name:       "Logical operators without parens",
			dsl:        `when { a and b or c }`,
			shouldWork: true,
			notes:      "Precedence: and binds tighter than or",
		},
		{
			name:       "Empty when clause",
			dsl:        `when { } always { fraud_check }`,
			shouldWork: false,
			notes:      "Grammar requires at least one term",
		},
		{
			name:       "Just when clause (no always/never)",
			dsl:        `when { payment }`,
			shouldWork: true,
			notes:      "Both always and never are optional",
		},
		{
			name:       "Count with complex operation name",
			dsl:        `when { count(http.request.retry) > 3 }`,
			shouldWork: true,
			notes:      "Dotted identifiers supported",
		},
		{
			name:       "Boolean literal in comparison",
			dsl:        `when { payment.where(verified == true) }`,
			shouldWork: true,
			notes:      "Boolean literals supported in Value",
		},
		{
			name:       "Null/nil checks",
			dsl:        `when { payment.where(customer_id == null) }`,
			shouldWork: false,
			notes:      "No null keyword in grammar",
		},
		{
			name:       "String contains",
			dsl:        `when { payment.where(description contains "fraud") }`,
			shouldWork: false,
			notes:      "No 'contains' operator - use 'matches' with regex",
		},
		{
			name:       "Case-insensitive matching",
			dsl:        `when { payment.where(currency imatches "usd") }`,
			shouldWork: false,
			notes:      "No case-insensitive operator",
		},
	}

	missingFeatures := []string{}
	implementedFeatures := []string{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Parse(tt.dsl)
			actuallyWorks := (err == nil)

			if actuallyWorks != tt.shouldWork {
				if actuallyWorks {
					t.Logf("✨ UNEXPECTED: Works but thought it wouldn't: %s", tt.notes)
				} else {
					t.Logf("❌ MISSING: Doesn't work as expected: %s", tt.notes)
					if !tt.shouldWork {
						missingFeatures = append(missingFeatures, tt.name)
					}
				}
			} else {
				if actuallyWorks {
					t.Logf("✅ WORKS: %s", tt.notes)
					implementedFeatures = append(implementedFeatures, tt.name)
				} else {
					t.Logf("⚠️  NOT IMPLEMENTED: %s", tt.notes)
					missingFeatures = append(missingFeatures, tt.name)
				}
			}
		})
	}

	t.Logf("\n=== Summary ===")
	t.Logf("Implemented: %d features", len(implementedFeatures))
	t.Logf("Missing/Not Implemented: %d features", len(missingFeatures))

	if len(missingFeatures) > 0 {
		t.Logf("\nMissing features:")
		for _, f := range missingFeatures {
			t.Logf("  - %s", f)
		}
	}
}
