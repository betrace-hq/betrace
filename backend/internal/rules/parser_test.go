package rules

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestParser_SimpleLiterals tests parsing of simple literal values
func TestParser_SimpleLiterals(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantType string
		wantVal  interface{}
	}{
		{
			name:     "boolean true",
			input:    "true",
			wantType: "Literal",
			wantVal:  true,
		},
		{
			name:     "boolean false",
			input:    "false",
			wantType: "Literal",
			wantVal:  false,
		},
		{
			name:     "string literal",
			input:    `"hello"`,
			wantType: "Literal",
			wantVal:  "hello",
		},
		{
			name:     "number literal",
			input:    "42",
			wantType: "Literal",
			wantVal:  float64(42),
		},
		{
			name:     "decimal number",
			input:    "3.14",
			wantType: "Literal",
			wantVal:  3.14,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.input)
			expr, err := parser.Parse()
			require.NoError(t, err)

			lit, ok := expr.(*Literal)
			require.True(t, ok, "Expected Literal, got %T", expr)
			assert.Equal(t, tt.wantVal, lit.Value)
		})
	}
}

// TestParser_FieldAccess tests parsing field access expressions
func TestParser_FieldAccess(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantObject string
		wantFields []string
	}{
		{
			name:       "simple field",
			input:      "span.status",
			wantObject: "span",
			wantFields: []string{"status"},
		},
		{
			name:       "nested field",
			input:      "span.attributes.key",
			wantObject: "span",
			wantFields: []string{"attributes", "key"},
		},
		{
			name:       "single identifier",
			input:      "span",
			wantObject: "span",
			wantFields: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.input)
			expr, err := parser.Parse()
			require.NoError(t, err)

			field, ok := expr.(*FieldAccess)
			require.True(t, ok, "Expected FieldAccess, got %T", expr)
			assert.Equal(t, tt.wantObject, field.Object)
			assert.Equal(t, tt.wantFields, field.Fields)
		})
	}
}

// TestParser_IndexAccess tests parsing bracket notation
func TestParser_IndexAccess(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantKey   interface{}
		wantField string
	}{
		{
			name:      "string index",
			input:     `span.attributes["http.method"]`,
			wantKey:   "http.method",
			wantField: "attributes",
		},
		{
			name:      "number index",
			input:     `span.events[0]`,
			wantKey:   float64(0),
			wantField: "events",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.input)
			expr, err := parser.Parse()
			require.NoError(t, err)

			idx, ok := expr.(*IndexAccess)
			require.True(t, ok, "Expected IndexAccess, got %T", expr)

			// Check object is FieldAccess
			field, ok := idx.Object.(*FieldAccess)
			require.True(t, ok)
			assert.Contains(t, field.Fields, tt.wantField)

			// Check index
			lit, ok := idx.Index.(*Literal)
			require.True(t, ok)
			assert.Equal(t, tt.wantKey, lit.Value)
		})
	}
}

// TestParser_BinaryExpressions tests binary operators
func TestParser_BinaryExpressions(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		wantOp TokenType
	}{
		{
			name:   "equality",
			input:  `span.status == "ERROR"`,
			wantOp: TokenEqual,
		},
		{
			name:   "inequality",
			input:  `span.status != "OK"`,
			wantOp: TokenNotEqual,
		},
		{
			name:   "greater than",
			input:  "span.duration > 1000",
			wantOp: TokenGreater,
		},
		{
			name:   "greater or equal",
			input:  "span.duration >= 1000",
			wantOp: TokenGreaterEqual,
		},
		{
			name:   "less than",
			input:  "span.duration < 1000",
			wantOp: TokenLess,
		},
		{
			name:   "less or equal",
			input:  "span.duration <= 1000",
			wantOp: TokenLessEqual,
		},
		{
			name:   "logical and",
			input:  "true and false",
			wantOp: TokenAnd,
		},
		{
			name:   "logical or",
			input:  "true or false",
			wantOp: TokenOr,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.input)
			expr, err := parser.Parse()
			require.NoError(t, err)

			bin, ok := expr.(*BinaryExpr)
			require.True(t, ok, "Expected BinaryExpr, got %T", expr)
			assert.Equal(t, tt.wantOp, bin.Op)
		})
	}
}

// TestParser_UnaryExpressions tests unary operators
func TestParser_UnaryExpressions(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "not operator",
			input: "not true",
		},
		{
			name:  "not with field",
			input: "not span.enabled",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.input)
			expr, err := parser.Parse()
			require.NoError(t, err)

			unary, ok := expr.(*UnaryExpr)
			require.True(t, ok, "Expected UnaryExpr, got %T", expr)
			assert.Equal(t, TokenNot, unary.Op)
		})
	}
}

// TestParser_ComplexExpressions tests real-world complex expressions
func TestParser_ComplexExpressions(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "AND with comparisons",
			input: `span.status == "ERROR" and span.duration > 1000`,
		},
		{
			name:  "OR with AND (precedence)",
			input: `span.status == "ERROR" or span.status == "FAILED" and span.retry == true`,
		},
		{
			name:  "NOT with comparison",
			input: `not span.status == "OK"`,
		},
		{
			name:  "parenthesized expression",
			input: `(span.status == "ERROR" or span.status == "FAILED") and span.duration > 1000`,
		},
		{
			name:  "attribute access",
			input: `span.attributes["http.status_code"] >= 500`,
		},
		{
			name:  "complex nested",
			input: `span.name == "http.request" and span.attributes["http.method"] == "POST" and span.attributes["http.status_code"] >= 500`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.input)
			expr, err := parser.Parse()
			require.NoError(t, err)
			require.NotNil(t, expr)

			// Just verify it parses without error
			// Detailed structure tests are in other test functions
			t.Logf("Parsed: %s", expr.String())
		})
	}
}

// TestParser_Errors tests error handling
func TestParser_Errors(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantError string
	}{
		{
			name:      "unclosed string",
			input:     `"hello`,
			wantError: "unterminated string",
		},
		{
			name:      "unexpected token",
			input:     "span.status ==",
			wantError: "expected",
		},
		{
			name:      "unclosed bracket",
			input:     `span.attributes["key"`,
			wantError: "expected",
		},
		{
			name:      "unclosed paren",
			input:     "(span.status == true",
			wantError: "expected",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.input)
			_, err := parser.Parse()
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantError)
		})
	}
}

// TestParser_OperatorPrecedence tests that operators have correct precedence
func TestParser_OperatorPrecedence(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantTree string // String representation of expected AST
	}{
		{
			name:     "AND before OR",
			input:    "true or false and true",
			wantTree: "(true OR (false AND true))",
		},
		{
			name:     "comparison before AND",
			input:    "a == b and c == d",
			wantTree: "((a EQUAL b) AND (c EQUAL d))",
		},
		{
			name:     "NOT has highest precedence",
			input:    "not a and b",
			wantTree: "((NOT a) AND b)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.input)
			expr, err := parser.Parse()
			require.NoError(t, err)

			// Compare string representation
			assert.Equal(t, tt.wantTree, expr.String())
		})
	}
}

// TestParser_RealWorldRules tests actual BeTrace rules
func TestParser_RealWorldRules(t *testing.T) {
	rules := []string{
		// Slow database query
		`span.name == "database.query" and span.duration > 1000000000`,

		// HTTP 5xx errors
		`span.status == "ERROR" and span.attributes["http.status_code"] >= 500 and span.attributes["http.status_code"] < 600`,

		// Authentication failure
		`span.name == "auth.verify" and span.status == "ERROR" and span.attributes["auth.result"] == "failed"`,

		// Missing audit log
		`span.attributes["data.contains_pii"] == "true" and not span.attributes["audit.logged"]`,

		// Slow request to specific service
		`span.service_name == "payment-service" and span.duration > 2000000000`,

		// Complex pattern with OR
		`(span.status == "ERROR" or span.status == "FAILED") and span.attributes["retry_count"] >= 3`,
	}

	for i, rule := range rules {
		t.Run(fmt.Sprintf("rule_%d", i), func(t *testing.T) {
			parser := NewParser(rule)
			expr, err := parser.Parse()
			require.NoError(t, err)
			require.NotNil(t, expr)

			t.Logf("Rule: %s", rule)
			t.Logf("AST:  %s", expr.String())
		})
	}
}
