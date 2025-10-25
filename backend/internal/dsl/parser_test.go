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
			input: `when { trace.has(payment) }
always { trace.has(fraud_check) }`,
			wantErr: false,
		},
		{
			name: "basic when-never",
			input: `when { trace.has(test) }
never { trace.has(production) }`,
			wantErr: false,
		},
		{
			name: "when-always-never",
			input: `when { trace.has(payment) }
always { trace.has(required) }
never { trace.has(forbidden) }`,
			wantErr: false,
		},
		{
			name: "with grouping",
			input: `when { (trace.has(a) or trace.has(b)) and trace.has(c) }
always { trace.has(required) }`,
			wantErr: false,
		},
		{
			name: "with where clause",
			input: `when { trace.has(payment).where(amount > 1000) }
always { trace.has(fraud_check) }`,
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
