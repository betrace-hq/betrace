package dsl

import (
	"testing"
)

func TestParserV2_Simple(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{
			name: "basic when-always",
			input: `when { payment }
always { fraud_check }`,
			wantErr: false,
		},
		{
			name: "basic when-never",
			input: `when { test }
never { production }`,
			wantErr: false,
		},
		{
			name: "when-always-never",
			input: `when { payment }
always { required }
never { forbidden }`,
			wantErr: false,
		},
		{
			name: "with grouping",
			input: `when { (a or b) and c }
always { required }`,
			wantErr: false,
		},
		{
			name: "with where clause",
			input: `when { payment.where(amount > 1000) }
always { fraud_check }`,
			wantErr: false,
		},
		{
			name: "direct attribute comparison",
			input: `when { payment.amount > 1000 }
always { fraud_check }`,
			wantErr: false,
		},
		{
			name: "direct comparison with existence check",
			input: `when { payment.amount > 1000 and fraud_check }
always { approved }`,
			wantErr: false,
		},
		{
			name: "where with single condition",
			input: `when { payment.where(amount > 1000) }
always { fraud_check and approved }`,
			wantErr: false,
		},
		{
			name: "multiple attribute checks via direct comparison",
			input: `when { payment.amount > 1000 and approved }
always { fraud_check }`,
			wantErr: false,
		},
		{
			name: "complex predicate in where clause",
			input: `when { payment.where(amount > 1000 and currency == USD) }
always { fraud_check }`,
			wantErr: false,
		},
		{
			name: "with count",
			input: `when { payment }
always { count(retry) < 3 }`,
			wantErr: false,
		},
		{
			name: "count to count comparison",
			input: `when { count(http_request) != count(http_response) }`,
			wantErr: false,
		},
		{
			name: "count to count with other conditions",
			input: `when { count(http_request) > count(http_response) and error_logged }
always { alert }`,
			wantErr: false,
		},
		{
			name: "complex example",
			input: `when { payment.where(amount > 1000) and (customer.new or not customer.verified) }
always { fraud_check and (fraud_score.where(score < 0.3) or manual_review) }
never { bypass_validation or skip_check }`,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, err := Parse(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Parse() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && rule == nil {
				t.Error("Parse() returned nil rule without error")
			}
		})
	}
}
