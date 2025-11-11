package dsl

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestChainedWhere validates chained .where() clauses
func TestChainedWhere(t *testing.T) {
	tests := []struct {
		name string
		dsl  string
	}{
		{
			name: "Single chain",
			dsl:  `when { payment.where(amount > 1000).where(currency == "USD") }`,
		},
		{
			name: "Triple chain",
			dsl:  `when { payment.where(amount > 1000).where(currency == "USD").where(verified == true) }`,
		},
		{
			name: "Chain with complex conditions",
			dsl:  `when { payment.where(amount > 1000 and status == "pending").where(currency in ["USD", "EUR"]) }`,
		},
		{
			name: "Chain in always clause",
			dsl: `when { payment }
always { fraud_check.where(score < 0.5).where(manual_review == false) }`,
		},
		{
			name: "Multiple chained operations",
			dsl: `when { payment.where(amount > 1000).where(currency == "USD") and customer.where(verified == false).where(new == true) }
always { fraud_check }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := Parse(tt.dsl)
			require.NoError(t, err, "Should parse chained where")
			require.NotNil(t, rule)
			t.Logf("✅ Chained where works")
		})
	}
}

// TestContainsOperator validates the contains operator
func TestContainsOperator(t *testing.T) {
	tests := []struct {
		name string
		dsl  string
	}{
		{
			name: "String contains in where",
			dsl:  `when { payment.where(description contains "fraud") }`,
		},
		{
			name: "Contains with string literal",
			dsl:  `when { api_request.where(path contains "/admin") }`,
		},
		{
			name: "Contains in direct comparison",
			dsl:  `when { payment.description contains "suspicious" }`,
		},
		{
			name: "Contains with identifier",
			dsl:  `when { payment.where(tags contains premium) }`,
		},
		{
			name: "Multiple contains",
			dsl:  `when { payment.where(description contains "fraud" or notes contains "suspicious") }`,
		},
		{
			name: "Contains vs matches comparison",
			dsl: `when {
  api_request.where(path contains "/admin") or
  api_request.where(path matches "/api/v[0-9]+/admin/.*")
}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := Parse(tt.dsl)
			require.NoError(t, err, "Should parse contains operator")
			require.NotNil(t, rule)
			t.Logf("✅ Contains operator works")
		})
	}
}

// TestNegationInWhere validates negation inside where clauses
func TestNegationInWhere(t *testing.T) {
	tests := []struct {
		name string
		dsl  string
	}{
		{
			name: "Simple negation of boolean",
			dsl:  `when { payment.where(not verified) }`,
		},
		{
			name: "Negation in complex condition",
			dsl:  `when { payment.where(amount > 1000 and not verified) }`,
		},
		{
			name: "Multiple negations",
			dsl:  `when { payment.where(not verified and not approved) }`,
		},
		{
			name: "Negation with comparison",
			dsl:  `when { payment.where(not verified or amount > 10000) }`,
		},
		{
			name: "Grouped negation",
			dsl:  `when { payment.where(not (verified and approved)) }`,
		},
		{
			name: "Negation of span reference",
			dsl:  `when { payment.where(not fraud_check.completed) }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := Parse(tt.dsl)
			require.NoError(t, err, "Should parse negation in where")
			require.NotNil(t, rule)
			t.Logf("✅ Negation in where works")
		})
	}
}

// TestCombinedNewFeatures validates all new features together
func TestCombinedNewFeatures(t *testing.T) {
	tests := []struct {
		name string
		dsl  string
	}{
		{
			name: "Chained where with contains",
			dsl:  `when { payment.where(description contains "fraud").where(amount > 1000) }`,
		},
		{
			name: "Chained where with negation",
			dsl:  `when { payment.where(not verified).where(amount > 1000) }`,
		},
		{
			name: "Contains with negation",
			dsl:  `when { payment.where(description contains "fraud" and not verified) }`,
		},
		{
			name: "All features combined",
			dsl: `when {
  payment
    .where(description contains "suspicious" or notes contains "fraud")
    .where(not verified)
    .where(amount > 10000)
}
always { fraud_check and manual_review }
never { auto_approve }`,
		},
		{
			name: "Complex real-world example",
			dsl: `when {
  payment.where(amount > 1000).where(currency in ["USD", "EUR"]) and
  customer.where(not verified).where(account_age < 30) and
  count(fraud_alert) > 0
}
always {
  fraud_check.where(score < 0.3).where(not bypassed) and
  manual_review
}
never {
  auto_approve or skip_validation
}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := Parse(tt.dsl)
			require.NoError(t, err, "Should parse combined features")
			require.NotNil(t, rule)
			t.Logf("✅ Combined features work")
		})
	}
}
