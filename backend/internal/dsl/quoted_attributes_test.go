package dsl

import (
	"testing"
)

// TestQuotedAttributeNames tests that quoted attribute names work in where clauses
func TestQuotedAttributeNames(t *testing.T) {
	tests := []struct {
		name string
		rule string
	}{
		{
			name: "Quoted dotted attribute name",
			rule: `when { database.query.where("data.contains_pii" == true) } always { auth.check }`,
		},
		{
			name: "Mixed quoted and unquoted attributes",
			rule: `when { database.write.where("data.sensitive" == true) } always { encryption.at_rest.where(enabled == true) }`,
		},
		{
			name: "Quoted attribute with underscores",
			rule: `when { api.request.where("user_id" == 123) } always { auth.token }`,
		},
		{
			name: "Quoted attribute in chained where",
			rule: `when { payment.charge.where(amount > 1000).where("card.type" == "corporate") } always { approval.manager }`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed, err := Parse(tt.rule)
			if err != nil {
				t.Errorf("❌ Parse FAILED: %v", err)
			} else {
				t.Logf("✅ Parse SUCCESS: %s", tt.name)
				_ = parsed // Use the parsed result
			}
		})
	}
}
