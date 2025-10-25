package models

import (
	"strings"
	"testing"
)

func TestSpan_Validate(t *testing.T) {
	limits := SpanLimits{
		MaxAttributesPerSpan:    5,
		MaxAttributeKeyLength:   10,
		MaxAttributeValueLength: 20,
	}

	tests := []struct {
		name    string
		span    Span
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid span",
			span: Span{
				Attributes: map[string]string{
					"key1": "value1",
					"key2": "value2",
				},
			},
			wantErr: false,
		},
		{
			name: "too many attributes",
			span: Span{
				Attributes: map[string]string{
					"key1": "value1",
					"key2": "value2",
					"key3": "value3",
					"key4": "value4",
					"key5": "value5",
					"key6": "value6", // exceeds limit
				},
			},
			wantErr: true,
			errMsg:  "exceeds limit of 5",
		},
		{
			name: "attribute key too long",
			span: Span{
				Attributes: map[string]string{
					"verylongkey": "value", // 11 chars > 10 limit
				},
			},
			wantErr: true,
			errMsg:  "exceeds limit of 10 bytes",
		},
		{
			name: "attribute value too long",
			span: Span{
				Attributes: map[string]string{
					"key": strings.Repeat("x", 21), // 21 chars > 20 limit
				},
			},
			wantErr: true,
			errMsg:  "exceeds limit of 20 bytes",
		},
		{
			name: "at exact limits",
			span: Span{
				Attributes: map[string]string{
					"1234567890": strings.Repeat("x", 20), // exactly at limits
					"key2":       "value2",
					"key3":       "value3",
					"key4":       "value4",
					"key5":       "value5",
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.span.Validate(limits)
			if tt.wantErr && err == nil {
				t.Errorf("Validate() expected error but got none")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("Validate() unexpected error: %v", err)
			}
			if tt.wantErr && err != nil && !strings.Contains(err.Error(), tt.errMsg) {
				t.Errorf("Validate() error = %v, want error containing %q", err, tt.errMsg)
			}
		})
	}
}

func TestRule_Validate(t *testing.T) {
	limits := RuleLimits{
		MaxExpressionLength:  50,
		MaxDescriptionLength: 30,
		MaxNameLength:        15,
	}

	tests := []struct {
		name    string
		rule    Rule
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid rule",
			rule: Rule{
				Name:        "test-rule",
				Description: "A test rule",
				Expression:  "span.duration > 100",
			},
			wantErr: false,
		},
		{
			name: "name too long",
			rule: Rule{
				Name:        "very-long-rule-name-exceeding-limit", // 38 chars > 15 limit
				Description: "desc",
				Expression:  "expr",
			},
			wantErr: true,
			errMsg:  "exceeds limit of 15 bytes",
		},
		{
			name: "description too long",
			rule: Rule{
				Name:        "rule",
				Description: strings.Repeat("x", 31), // 31 chars > 30 limit
				Expression:  "expr",
			},
			wantErr: true,
			errMsg:  "exceeds limit of 30 bytes",
		},
		{
			name: "expression too long (Participle has NO built-in limits!)",
			rule: Rule{
				Name:        "rule",
				Description: "desc",
				Expression:  strings.Repeat("x", 51), // 51 chars > 50 limit
			},
			wantErr: true,
			errMsg:  "exceeds limit of 50 bytes",
		},
		{
			name: "at exact limits",
			rule: Rule{
				Name:        strings.Repeat("x", 15), // exactly 15
				Description: strings.Repeat("y", 30), // exactly 30
				Expression:  strings.Repeat("z", 50), // exactly 50
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.rule.Validate(limits)
			if tt.wantErr && err == nil {
				t.Errorf("Validate() expected error but got none")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("Validate() unexpected error: %v", err)
			}
			if tt.wantErr && err != nil && !strings.Contains(err.Error(), tt.errMsg) {
				t.Errorf("Validate() error = %v, want error containing %q", err, tt.errMsg)
			}
		})
	}
}
