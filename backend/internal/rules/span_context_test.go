package rules

import (
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
)

func TestBuildFieldFilter(t *testing.T) {
	tests := []struct {
		name                  string
		expression            string
		expectedScalarFields  []string
		expectedAttributeKeys []string
		accessesAllAttributes bool
	}{
		{
			name:                 "status only",
			expression:           `span.status == "ERROR"`,
			expectedScalarFields: []string{"status"},
		},
		{
			name:                 "duration only",
			expression:           `span.duration > 1000000000`,
			expectedScalarFields: []string{"duration"},
		},
		{
			name:                 "multiple scalar fields",
			expression:           `span.status == "ERROR" and span.duration > 1000000000`,
			expectedScalarFields: []string{"status", "duration"},
		},
		{
			name:                  "single attribute",
			expression:            `span.attributes["http.method"] == "POST"`,
			expectedAttributeKeys: []string{"http.method"},
		},
		{
			name:                  "multiple attributes",
			expression:            `span.attributes["http.method"] == "POST" and span.attributes["http.status"] == "500"`,
			expectedAttributeKeys: []string{"http.method", "http.status"},
		},
		{
			name:                  "scalar + attribute",
			expression:            `span.status == "ERROR" and span.attributes["user.id"] == "12345"`,
			expectedScalarFields:  []string{"status"},
			expectedAttributeKeys: []string{"user.id"},
		},
		{
			name:                  "access all attributes",
			expression:            `span.attributes`,
			accessesAllAttributes: true,
		},
		{
			name:                  "nested attribute access",
			expression:            `span.attributes.user_id == "12345"`,
			expectedAttributeKeys: []string{"user_id"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expression)
			ast, err := parser.Parse()
			if err != nil {
				t.Fatalf("Failed to parse: %v", err)
			}

			filter := BuildFieldFilter(ast)

			// Check scalar fields
			for _, field := range tt.expectedScalarFields {
				if !filter.ScalarFields[field] {
					t.Errorf("Expected scalar field '%s' to be in filter", field)
				}
			}

			// Check attribute keys
			for _, key := range tt.expectedAttributeKeys {
				if !filter.AttributeKeys[key] {
					t.Errorf("Expected attribute key '%s' to be in filter", key)
				}
			}

			// Check all attributes access
			if filter.AccessesAllAttributes != tt.accessesAllAttributes {
				t.Errorf("Expected AccessesAllAttributes=%v, got %v",
					tt.accessesAllAttributes, filter.AccessesAllAttributes)
			}
		})
	}
}

func TestSpanContext_LazyLoading(t *testing.T) {
	span := &models.Span{
		Status:        "ERROR",
		Duration:      2000000000,
		ServiceName:   "payment-service",
		OperationName: "charge_card",
		TraceID:       "trace-123",
		SpanID:        "span-456",
		Attributes: map[string]string{
			"http.method": "POST",
			"http.status": "500",
			"user.id":     "12345",
		},
	}

	// Filter that only accesses status and http.method
	filter := &FieldFilter{
		ScalarFields: map[string]bool{
			"status": true,
		},
		AttributeKeys: map[string]bool{
			"http.method": true,
		},
	}

	ctx := NewSpanContext(span, filter)

	// Access fields in filter
	if status := ctx.GetStatus(); status != "ERROR" {
		t.Errorf("Expected status 'ERROR', got '%s'", status)
	}

	attr, ok := ctx.GetAttribute("http.method")
	if !ok || attr != "POST" {
		t.Errorf("Expected http.method='POST', got '%s' (ok=%v)", attr, ok)
	}

	// Access fields NOT in filter - should return zero values
	if duration := ctx.GetDuration(); duration != 0 {
		t.Errorf("Expected duration=0 (not in filter), got %f", duration)
	}

	_, ok = ctx.GetAttribute("user.id")
	if ok {
		t.Error("Expected user.id to not be accessible (not in filter)")
	}
}

func TestSpanContext_Caching(t *testing.T) {
	span := &models.Span{
		Status: "ERROR",
		Attributes: map[string]string{
			"key": "value",
		},
	}

	filter := &FieldFilter{
		ScalarFields: map[string]bool{
			"status": true,
		},
		AttributeKeys: map[string]bool{
			"key": true,
		},
	}

	ctx := NewSpanContext(span, filter)

	// First access - should cache
	status1 := ctx.GetStatus()
	// Second access - should use cache
	status2 := ctx.GetStatus()

	if status1 != status2 {
		t.Error("Cached value should match")
	}

	// First attribute access
	attr1, ok1 := ctx.GetAttribute("key")
	// Second attribute access
	attr2, ok2 := ctx.GetAttribute("key")

	if attr1 != attr2 || ok1 != ok2 {
		t.Error("Cached attribute should match")
	}
}

func TestEvaluateWithContext(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		span       *models.Span
		expected   bool
	}{
		{
			name:       "status check",
			expression: `span.status == "ERROR"`,
			span: &models.Span{
				Status: "ERROR",
			},
			expected: true,
		},
		{
			name:       "duration check",
			expression: `span.duration > 1000`, // duration is in milliseconds
			span: &models.Span{
				Duration: 2000000000, // 2 seconds in nanoseconds = 2000 milliseconds
			},
			expected: true,
		},
		{
			name:       "attribute check",
			expression: `span.attributes["http.method"] == "POST"`,
			span: &models.Span{
				Attributes: map[string]string{
					"http.method": "POST",
				},
			},
			expected: true,
		},
		{
			name:       "complex expression",
			expression: `span.status == "ERROR" and span.duration > 1000 and span.attributes["user.id"] == "12345"`,
			span: &models.Span{
				Status:   "ERROR",
				Duration: 2000000000, // 2 seconds in nanoseconds = 2000 milliseconds
				Attributes: map[string]string{
					"user.id": "12345",
				},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := NewParser(tt.expression)
			ast, err := parser.Parse()
			if err != nil {
				t.Fatalf("Parse failed: %v", err)
			}

			filter := BuildFieldFilter(ast)
			ctx := NewSpanContext(tt.span, filter)

			evaluator := NewEvaluator()
			result, err := evaluator.EvaluateWithContext(ast, ctx)
			if err != nil {
				t.Fatalf("Evaluate failed: %v", err)
			}

			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func BenchmarkEvaluateWithContext_StatusOnly(b *testing.B) {
	expression := `span.status == "ERROR"`
	parser := NewParser(expression)
	ast, _ := parser.Parse()
	filter := BuildFieldFilter(ast)

	span := &models.Span{
		Status:        "ERROR",
		Duration:      2000000000,
		ServiceName:   "payment-service",
		OperationName: "charge_card",
		TraceID:       "trace-123",
		SpanID:        "span-456",
		Attributes: map[string]string{
			"http.method":  "POST",
			"http.status":  "500",
			"user.id":      "12345",
			"request.id":   "req-789",
			"session.id":   "sess-abc",
			"product.sku":  "SKU-123",
			"payment.type": "credit_card",
			"amount":       "99.99",
			"currency":     "USD",
			"region":       "us-west-2",
		},
	}

	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := NewSpanContext(span, filter)
		_, _ = evaluator.EvaluateWithContext(ast, ctx)
	}
}

func BenchmarkEvaluateWithContext_ThreeAttributes(b *testing.B) {
	expression := `span.attributes["http.method"] == "POST" and span.attributes["http.status"] == "500" and span.attributes["user.id"] == "12345"`
	parser := NewParser(expression)
	ast, _ := parser.Parse()
	filter := BuildFieldFilter(ast)

	span := &models.Span{
		Status:        "ERROR",
		Duration:      2000000000,
		ServiceName:   "payment-service",
		OperationName: "charge_card",
		TraceID:       "trace-123",
		SpanID:        "span-456",
		Attributes: map[string]string{
			"http.method":  "POST",
			"http.status":  "500",
			"user.id":      "12345",
			"request.id":   "req-789",
			"session.id":   "sess-abc",
			"product.sku":  "SKU-123",
			"payment.type": "credit_card",
			"amount":       "99.99",
			"currency":     "USD",
			"region":       "us-west-2",
		},
	}

	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := NewSpanContext(span, filter)
		_, _ = evaluator.EvaluateWithContext(ast, ctx)
	}
}

func BenchmarkEvaluateWithContext_AllAttributes(b *testing.B) {
	expression := `span.attributes` // Accesses all attributes
	parser := NewParser(expression)
	ast, _ := parser.Parse()
	filter := BuildFieldFilter(ast)

	span := &models.Span{
		Status:        "ERROR",
		Duration:      2000000000,
		ServiceName:   "payment-service",
		OperationName: "charge_card",
		TraceID:       "trace-123",
		SpanID:        "span-456",
		Attributes: map[string]string{
			"http.method":  "POST",
			"http.status":  "500",
			"user.id":      "12345",
			"request.id":   "req-789",
			"session.id":   "sess-abc",
			"product.sku":  "SKU-123",
			"payment.type": "credit_card",
			"amount":       "99.99",
			"currency":     "USD",
			"region":       "us-west-2",
		},
	}

	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := NewSpanContext(span, filter)
		_, _ = evaluator.EvaluateWithContext(ast, ctx)
	}
}

func BenchmarkEvaluate_FullSpan_StatusOnly(b *testing.B) {
	// Baseline: old approach (full span access)
	expression := `span.status == "ERROR"`
	parser := NewParser(expression)
	ast, _ := parser.Parse()

	span := &models.Span{
		Status:        "ERROR",
		Duration:      2000000000,
		ServiceName:   "payment-service",
		OperationName: "charge_card",
		TraceID:       "trace-123",
		SpanID:        "span-456",
		Attributes: map[string]string{
			"http.method":  "POST",
			"http.status":  "500",
			"user.id":      "12345",
			"request.id":   "req-789",
			"session.id":   "sess-abc",
			"product.sku":  "SKU-123",
			"payment.type": "credit_card",
			"amount":       "99.99",
			"currency":     "USD",
			"region":       "us-west-2",
		},
	}

	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = evaluator.Evaluate(ast, span)
	}
}
