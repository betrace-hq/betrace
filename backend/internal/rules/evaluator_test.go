package rules

import (
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEvaluator_SimpleLiterals(t *testing.T) {
	ev := NewEvaluator()
	span := &models.Span{}

	tests := []struct {
		name   string
		expr   string
		want   bool
		errMsg string
	}{
		{
			name: "true literal",
			expr: "true",
			want: true,
		},
		{
			name: "false literal",
			expr: "false",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expr)
			ast, err := parser.Parse()
			require.NoError(t, err)

			result, err := ev.Evaluate(ast, span)
			if tt.errMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestEvaluator_FieldAccess(t *testing.T) {
	ev := NewEvaluator()
	span := &models.Span{
		Status:        "ERROR",
		OperationName: "database.query",
		ServiceName:   "payment-service",
		Duration:      1500000000,
		TraceID:       "trace-123",
		SpanID:        "span-456",
	}

	tests := []struct {
		name   string
		expr   string
		want   bool
		errMsg string
	}{
		{
			name: "status equals ERROR",
			expr: `span.status == "ERROR"`,
			want: true,
		},
		{
			name: "status equals OK",
			expr: `span.status == "OK"`,
			want: false,
		},
		{
			name: "operation name",
			expr: `span.name == "database.query"`,
			want: true,
		},
		{
			name: "service name",
			expr: `span.service_name == "payment-service"`,
			want: true,
		},
		{
			name: "duration greater than",
			expr: "span.duration > 1000000000",
			want: true,
		},
		{
			name: "duration less than",
			expr: "span.duration < 2000000000",
			want: true,
		},
		{
			name: "trace ID",
			expr: `span.trace_id == "trace-123"`,
			want: true,
		},
		{
			name: "span ID",
			expr: `span.span_id == "span-456"`,
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expr)
			ast, err := parser.Parse()
			require.NoError(t, err)

			result, err := ev.Evaluate(ast, span)
			if tt.errMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestEvaluator_AttributeAccess(t *testing.T) {
	ev := NewEvaluator()
	span := &models.Span{
		Attributes: map[string]string{
			"http.method":      "POST",
			"http.status_code": "500",
			"auth.result":      "failed",
			"retry_count":      "3",
		},
	}

	tests := []struct {
		name   string
		expr   string
		want   bool
		errMsg string
	}{
		{
			name: "attribute equals string",
			expr: `span.attributes["http.method"] == "POST"`,
			want: true,
		},
		{
			name: "attribute not equals",
			expr: `span.attributes["http.method"] == "GET"`,
			want: false,
		},
		{
			name: "attribute numeric comparison",
			expr: `span.attributes["http.status_code"] >= "500"`,
			want: true,
		},
		{
			name: "missing attribute",
			expr: `span.attributes["missing.key"] == "value"`,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expr)
			ast, err := parser.Parse()
			require.NoError(t, err)

			result, err := ev.Evaluate(ast, span)
			if tt.errMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestEvaluator_LogicalOperators(t *testing.T) {
	ev := NewEvaluator()
	span := &models.Span{
		Status:   "ERROR",
		Duration: 2000000000,
	}

	tests := []struct {
		name   string
		expr   string
		want   bool
		errMsg string
	}{
		{
			name: "AND both true",
			expr: `span.status == "ERROR" and span.duration > 1000000000`,
			want: true,
		},
		{
			name: "AND one false",
			expr: `span.status == "OK" and span.duration > 1000000000`,
			want: false,
		},
		{
			name: "OR both true",
			expr: `span.status == "ERROR" or span.duration > 3000000000`,
			want: true,
		},
		{
			name: "OR one true",
			expr: `span.status == "OK" or span.duration > 1000000000`,
			want: true,
		},
		{
			name: "OR both false",
			expr: `span.status == "OK" or span.duration < 1000000000`,
			want: false,
		},
		{
			name: "NOT true",
			expr: `not (span.status == "OK")`,
			want: true,
		},
		{
			name: "NOT false",
			expr: `not (span.status == "ERROR")`,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expr)
			ast, err := parser.Parse()
			require.NoError(t, err)

			result, err := ev.Evaluate(ast, span)
			if tt.errMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestEvaluator_ComparisonOperators(t *testing.T) {
	ev := NewEvaluator()
	span := &models.Span{
		Duration: 1500000000,
	}

	tests := []struct {
		name   string
		expr   string
		want   bool
		errMsg string
	}{
		{
			name: "greater than true",
			expr: "span.duration > 1000000000",
			want: true,
		},
		{
			name: "greater than false",
			expr: "span.duration > 2000000000",
			want: false,
		},
		{
			name: "greater equal true (greater)",
			expr: "span.duration >= 1000000000",
			want: true,
		},
		{
			name: "greater equal true (equal)",
			expr: "span.duration >= 1500000000",
			want: true,
		},
		{
			name: "less than true",
			expr: "span.duration < 2000000000",
			want: true,
		},
		{
			name: "less than false",
			expr: "span.duration < 1000000000",
			want: false,
		},
		{
			name: "less equal true (less)",
			expr: "span.duration <= 2000000000",
			want: true,
		},
		{
			name: "less equal true (equal)",
			expr: "span.duration <= 1500000000",
			want: true,
		},
		{
			name: "not equal true",
			expr: "span.duration != 1000000000",
			want: true,
		},
		{
			name: "not equal false",
			expr: "span.duration != 1500000000",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expr)
			ast, err := parser.Parse()
			require.NoError(t, err)

			result, err := ev.Evaluate(ast, span)
			if tt.errMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestEvaluator_ComplexExpressions(t *testing.T) {
	ev := NewEvaluator()
	span := &models.Span{
		Status:        "ERROR",
		OperationName: "http.request",
		ServiceName:   "payment-service",
		Duration:      2000000000,
		Attributes: map[string]string{
			"http.method":      "POST",
			"http.status_code": "500",
			"retry_count":      "3",
		},
	}

	tests := []struct {
		name   string
		expr   string
		want   bool
		errMsg string
	}{
		{
			name: "complex AND chain",
			expr: `span.status == "ERROR" and span.duration > 1000000000 and span.attributes["http.status_code"] >= "500"`,
			want: true,
		},
		{
			name: "complex OR with AND precedence",
			expr: `span.status == "OK" or span.status == "ERROR" and span.duration > 1000000000`,
			want: true,
		},
		{
			name: "parenthesized expression",
			expr: `(span.status == "ERROR" or span.status == "FAILED") and span.duration > 1000000000`,
			want: true,
		},
		{
			name: "multiple attribute checks",
			expr: `span.attributes["http.method"] == "POST" and span.attributes["http.status_code"] >= "500"`,
			want: true,
		},
		{
			name: "NOT with complex expression",
			expr: `not (span.status == "OK" and span.duration < 1000000000)`,
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expr)
			ast, err := parser.Parse()
			require.NoError(t, err)

			result, err := ev.Evaluate(ast, span)
			if tt.errMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}

func TestEvaluator_RealWorldRules(t *testing.T) {
	ev := NewEvaluator()

	tests := []struct {
		name string
		expr string
		span *models.Span
		want bool
	}{
		{
			name: "slow database query",
			expr: `span.name == "database.query" and span.duration > 1000000000`,
			span: &models.Span{
				OperationName: "database.query",
				Duration:      1500000000,
			},
			want: true,
		},
		{
			name: "HTTP 5xx errors",
			expr: `span.status == "ERROR" and span.attributes["http.status_code"] >= "500" and span.attributes["http.status_code"] < "600"`,
			span: &models.Span{
				Status: "ERROR",
				Attributes: map[string]string{
					"http.status_code": "503",
				},
			},
			want: true,
		},
		{
			name: "authentication failure",
			expr: `span.name == "auth.verify" and span.status == "ERROR" and span.attributes["auth.result"] == "failed"`,
			span: &models.Span{
				OperationName: "auth.verify",
				Status:        "ERROR",
				Attributes: map[string]string{
					"auth.result": "failed",
				},
			},
			want: true,
		},
		{
			name: "slow payment service request",
			expr: `span.service_name == "payment-service" and span.duration > 2000000000`,
			span: &models.Span{
				ServiceName: "payment-service",
				Duration:    2500000000,
			},
			want: true,
		},
		{
			name: "retry threshold exceeded",
			expr: `(span.status == "ERROR" or span.status == "FAILED") and span.attributes["retry_count"] >= "3"`,
			span: &models.Span{
				Status: "ERROR",
				Attributes: map[string]string{
					"retry_count": "5",
				},
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expr)
			ast, err := parser.Parse()
			require.NoError(t, err)

			result, err := ev.Evaluate(ast, tt.span)
			require.NoError(t, err)
			assert.Equal(t, tt.want, result)

			t.Logf("Rule: %s", tt.expr)
			t.Logf("Result: %v", result)
		})
	}
}

func TestEvaluator_EdgeCases(t *testing.T) {
	ev := NewEvaluator()

	tests := []struct {
		name   string
		expr   string
		span   *models.Span
		want   bool
		errMsg string
	}{
		{
			name: "nil attribute comparison",
			expr: `span.attributes["missing"] == "value"`,
			span: &models.Span{
				Attributes: map[string]string{},
			},
			want: false,
		},
		{
			name: "empty string comparison",
			expr: `span.status == ""`,
			span: &models.Span{
				Status: "",
			},
			want: true,
		},
		{
			name: "zero duration",
			expr: "span.duration == 0",
			span: &models.Span{
				Duration: 0,
			},
			want: true,
		},
		{
			name: "string numeric comparison",
			expr: `span.attributes["count"] >= "5"`,
			span: &models.Span{
				Attributes: map[string]string{
					"count": "10",
				},
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expr)
			ast, err := parser.Parse()
			require.NoError(t, err)

			result, err := ev.Evaluate(ast, tt.span)
			if tt.errMsg != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.want, result)
			}
		})
	}
}
