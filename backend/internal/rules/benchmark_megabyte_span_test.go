package rules

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// createMassiveSpan creates a span with 1000 attributes (simulating real-world multi-MB spans)
func createMassiveSpan() *models.Span {
	attributes := make(map[string]string, 1000)

	// Simulate realistic large attributes
	for i := 0; i < 1000; i++ {
		key := fmt.Sprintf("attr_%d", i)
		// Each value is 1KB (simulating large payloads, stack traces, etc.)
		attributes[key] = strings.Repeat(fmt.Sprintf("data%d", i), 100)
	}

	return &models.Span{
		Status:        "ERROR",
		Duration:      2000000000,
		ServiceName:   "payment-service",
		OperationName: "charge_card",
		TraceID:       "trace-123",
		SpanID:        "span-456",
		Attributes:    attributes, // ~1MB of attribute data
	}
}

// BenchmarkMassiveSpan_LazyEvaluation - Rule only accesses 3 attributes
func BenchmarkMassiveSpan_LazyEvaluation(b *testing.B) {
	// Rule that only checks status + 2 specific attributes (out of 1000!)
	expression := `span.status == "ERROR" and span.attributes["attr_5"] contains "data5" and span.attributes["attr_10"] contains "data10"`

	parser := NewParser(expression)
	ast, _ := parser.Parse()
	filter := BuildFieldFilter(ast)

	span := createMassiveSpan()
	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := NewSpanContext(span, filter)
		_, _ = evaluator.EvaluateWithContext(ast, ctx)
	}
}

// BenchmarkMassiveSpan_FullSpanLoad - Baseline: loads entire span
func BenchmarkMassiveSpan_FullSpanLoad(b *testing.B) {
	// Same rule, but old approach (loads all 1000 attributes)
	expression := `span.status == "ERROR" and span.attributes["attr_5"] contains "data5" and span.attributes["attr_10"] contains "data10"`

	parser := NewParser(expression)
	ast, _ := parser.Parse()

	span := createMassiveSpan()
	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = evaluator.Evaluate(ast, span)
	}
}

// BenchmarkMassiveSpan_LazyEvaluation_StatusOnly - Minimal rule
func BenchmarkMassiveSpan_LazyEvaluation_StatusOnly(b *testing.B) {
	// Rule that only checks status (ignores all 1000 attributes!)
	expression := `span.status == "ERROR"`

	parser := NewParser(expression)
	ast, _ := parser.Parse()
	filter := BuildFieldFilter(ast)

	span := createMassiveSpan()
	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx := NewSpanContext(span, filter)
		_, _ = evaluator.EvaluateWithContext(ast, ctx)
	}
}

// BenchmarkMassiveSpan_FullSpanLoad_StatusOnly - Baseline
func BenchmarkMassiveSpan_FullSpanLoad_StatusOnly(b *testing.B) {
	// Same status-only rule, but loads all 1000 attributes
	expression := `span.status == "ERROR"`

	parser := NewParser(expression)
	ast, _ := parser.Parse()

	span := createMassiveSpan()
	evaluator := NewEvaluator()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = evaluator.Evaluate(ast, span)
	}
}

// BenchmarkMassiveSpan_RuleEngine_LazyEvaluation - Full engine with lazy eval
func BenchmarkMassiveSpan_RuleEngine_LazyEvaluation(b *testing.B) {
	engine := NewRuleEngine()

	// Load 10 rules that only access 3 fields each
	for i := 0; i < 10; i++ {
		rule := models.Rule{
			ID:         fmt.Sprintf("rule_%d", i),
			Expression: fmt.Sprintf(`span.status == "ERROR" and span.attributes["attr_%d"] contains "data%d"`, i, i),
			Enabled:    true,
		}
		_ = engine.LoadRule(rule)
	}

	span := createMassiveSpan()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = engine.EvaluateAll(context.Background(), span)
	}
}

// BenchmarkMassiveSpan_Realistic_Production - Simulates production: 100 rules, massive spans
func BenchmarkMassiveSpan_Realistic_Production(b *testing.B) {
	engine := NewRuleEngine()

	// Load 100 realistic rules (each accesses 2-5 fields)
	for i := 0; i < 100; i++ {
		rule := models.Rule{
			ID: fmt.Sprintf("rule_%d", i),
			Expression: fmt.Sprintf(
				`span.status == "ERROR" and span.duration > 1000000000 and span.attributes["attr_%d"] contains "data%d"`,
				i%10, i%10,
			),
			Enabled: true,
		}
		_ = engine.LoadRule(rule)
	}

	span := createMassiveSpan()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = engine.EvaluateAll(context.Background(), span)
	}
}
