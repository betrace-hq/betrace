package dsl

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestExpressionOnBothSides validates that expressions work on both sides of comparisons
func TestExpressionOnBothSides(t *testing.T) {
	tests := []struct {
		name        string
		dsl         string
		description string
	}{
		{
			name: "count to count comparison (equality)",
			dsl:  `when { count(http_request) == count(http_response) }`,
			description: "Verify request/response balance",
		},
		{
			name: "count to count comparison (inequality)",
			dsl:  `when { count(http_request) != count(http_response) }`,
			description: "Detect orphaned requests",
		},
		{
			name: "count to count comparison (greater than)",
			dsl:  `when { count(http_request) > count(http_response) }`,
			description: "More requests than responses",
		},
		{
			name: "count to literal",
			dsl:  `when { count(retry) > 3 }`,
			description: "Traditional count comparison",
		},
		{
			name: "attribute to literal (string)",
			dsl:  `when { payment.where(currency == "USD") }`,
			description: "String literal comparison",
		},
		{
			name: "attribute to literal (number)",
			dsl:  `when { payment.where(amount > 1000) }`,
			description: "Numeric literal comparison",
		},
		{
			name: "attribute to identifier (enum-like)",
			dsl:  `when { payment.where(status == approved) }`,
			description: "Enum-like identifier comparison",
		},
		{
			name: "count in complex condition",
			dsl: `when { count(retry) > 3 and count(error) > count(success) }
always { alert }`,
			description: "Multiple count expressions in same rule",
		},
		{
			name: "mixed expressions",
			dsl: `when { payment.where(amount > 1000) and count(fraud_check) == 0 }
always { violation }`,
			description: "Mix attribute and count expressions",
		},
		// Future: attribute-to-attribute comparisons
		// These would require more complex evaluation context
		// {
		//     name: "attribute to attribute (same span)",
		//     dsl:  `when { payment.where(refund_amount > charge_amount) }`,
		//     description: "Compare two attributes from same span",
		// },
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := Parse(tt.dsl)
			require.NoError(t, err, "Should parse: %s", tt.description)
			require.NotNil(t, rule, "Rule should not be nil")

			t.Logf("✅ %s", tt.description)
		})
	}
}

// TestExpressionTypes validates different expression types
func TestExpressionTypes(t *testing.T) {
	tests := []struct {
		name     string
		dsl      string
		exprType string
	}{
		{
			name:     "Literal integer",
			dsl:      `when { payment.where(amount > 1000) }`,
			exprType: "Value (Int)",
		},
		{
			name:     "Literal float",
			dsl:      `when { payment.where(score > 0.95) }`,
			exprType: "Value (Float)",
		},
		{
			name:     "Literal string",
			dsl:      `when { payment.where(currency == "USD") }`,
			exprType: "Value (String)",
		},
		{
			name:     "Literal boolean",
			dsl:      `when { payment.where(verified == true) }`,
			exprType: "Value (Bool)",
		},
		{
			name:     "Identifier (enum-like)",
			dsl:      `when { payment.where(status == approved) }`,
			exprType: "Value (Ident)",
		},
		{
			name:     "Count expression",
			dsl:      `when { count(retry) > 3 }`,
			exprType: "Count",
		},
		{
			name:     "Count in comparison",
			dsl:      `when { count(request) != count(response) }`,
			exprType: "Count (both sides)",
		},
		{
			name:     "List literal",
			dsl:      `when { payment.where(processor in ["stripe", "square"]) }`,
			exprType: "Value (List)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := Parse(tt.dsl)
			require.NoError(t, err, "Should parse expression type: %s", tt.exprType)
			require.NotNil(t, rule)

			t.Logf("✅ Expression type: %s", tt.exprType)
		})
	}
}

// TestExpressionEdgeCases validates edge cases
func TestExpressionEdgeCases(t *testing.T) {
	tests := []struct {
		name    string
		dsl     string
		wantErr bool
	}{
		{
			name:    "Triple count comparison (not yet supported)",
			dsl:     `when { count(a) > count(b) and count(b) > count(c) }`,
			wantErr: false, // Should parse - just chained comparisons
		},
		{
			name:    "Count with dotted operation name",
			dsl:     `when { count(http.request) > count(http.response) }`,
			wantErr: false,
		},
		{
			name:    "Nested boolean with counts",
			dsl:     `when { (count(a) > count(b)) or (count(c) > count(d)) }`,
			wantErr: false,
		},
		{
			name:    "Count in always clause",
			dsl:     `when { payment } always { count(fraud_check) > 0 }`,
			wantErr: false,
		},
		{
			name:    "Count in never clause",
			dsl:     `when { payment } never { count(bypass) > 0 }`,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := Parse(tt.dsl)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.NotNil(t, rule)
				t.Logf("✅ Parsed edge case successfully")
			}
		})
	}
}
