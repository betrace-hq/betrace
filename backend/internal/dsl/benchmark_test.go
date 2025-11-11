package dsl

import (
	"fmt"
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// Benchmark parser performance with different rule complexities
func BenchmarkParser(b *testing.B) {
	benchmarks := []struct {
		name string
		dsl  string
	}{
		{
			name: "Simple",
			dsl:  `when { payment } always { fraud_check }`,
		},
		{
			name: "Moderate",
			dsl: `when { payment.where(amount > 1000) }
always { fraud_check }
never { bypass }`,
		},
		{
			name: "Complex",
			dsl: `when {
  payment.where(amount > 1000).where(currency == USD) and
  (customer.new or not customer.verified)
}
always {
  fraud_check and
  (fraud_score.where(score < 0.3) or manual_review)
}
never {
  bypass or skip_validation
}`,
		},
		{
			name: "WithCounts",
			dsl: `when { count(http_request) > 100 and count(http_request) != count(http_response) }
always { alert }`,
		},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_, err := Parse(bm.dsl)
				if err != nil {
					b.Fatalf("Parse failed: %v", err)
				}
			}
		})
	}
}

// Benchmark evaluator performance with different trace sizes
func BenchmarkEvaluator(b *testing.B) {
	evaluator := NewEvaluator()

	// Parse a moderate complexity rule once
	rule, err := Parse(`when { payment.where(amount > 1000) }
always { fraud_check }
never { bypass }`)
	if err != nil {
		b.Fatalf("Parse failed: %v", err)
	}

	benchmarks := []struct {
		name      string
		spanCount int
	}{
		{name: "SmallTrace_10spans", spanCount: 10},
		{name: "MediumTrace_100spans", spanCount: 100},
		{name: "LargeTrace_1000spans", spanCount: 1000},
	}

	for _, bm := range benchmarks {
		b.Run(bm.name, func(b *testing.B) {
			// Create test trace
			spans := createBenchmarkSpans(bm.spanCount)

			b.ResetTimer()
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_, err := evaluator.EvaluateRule(rule, spans)
				if err != nil {
					b.Fatalf("Evaluation failed: %v", err)
				}
			}
		})
	}
}

// Benchmark evaluator with realistic patterns
func BenchmarkEvaluatorPatterns(b *testing.B) {
	evaluator := NewEvaluator()

	patterns := []struct {
		name string
		dsl  string
		span string
		attr map[string]interface{}
	}{
		{
			name: "BasicExistence",
			dsl:  `when { payment } always { fraud_check }`,
			span: "payment",
			attr: nil,
		},
		{
			name: "WhereClause",
			dsl:  `when { payment.where(amount > 1000) } always { fraud_check }`,
			span: "payment",
			attr: map[string]interface{}{"amount": 5000},
		},
		{
			name: "ChainedWhere",
			dsl:  `when { payment.where(amount > 1000).where(currency == USD) } always { fraud_check }`,
			span: "payment",
			attr: map[string]interface{}{"amount": 5000, "currency": "USD"},
		},
		{
			name: "CountComparison",
			dsl:  `when { count(http_retry) > 3 } always { alert }`,
			span: "http_retry",
			attr: nil,
		},
	}

	for _, pattern := range patterns {
		b.Run(pattern.name, func(b *testing.B) {
			rule, err := Parse(pattern.dsl)
			if err != nil {
				b.Fatalf("Parse failed: %v", err)
			}

			// Create relevant spans
			spans := []*models.Span{
				createBenchmarkSpan(pattern.span, pattern.attr),
				createBenchmarkSpan("fraud_check", nil),
			}

			b.ResetTimer()
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_, err := evaluator.EvaluateRule(rule, spans)
				if err != nil {
					b.Fatalf("Evaluation failed: %v", err)
				}
			}
		})
	}
}

// Benchmark count operations specifically
func BenchmarkCountOperations(b *testing.B) {
	evaluator := NewEvaluator()

	rule, err := Parse(`when { count(http_request) != count(http_response) } never { orphaned }`)
	if err != nil {
		b.Fatalf("Parse failed: %v", err)
	}

	spanCounts := []struct {
		name      string
		requests  int
		responses int
	}{
		{name: "10req_10resp", requests: 10, responses: 10},
		{name: "100req_100resp", requests: 100, responses: 100},
		{name: "1000req_1000resp", requests: 1000, responses: 1000},
	}

	for _, sc := range spanCounts {
		b.Run(sc.name, func(b *testing.B) {
			spans := make([]*models.Span, 0, sc.requests+sc.responses)
			for i := 0; i < sc.requests; i++ {
				spans = append(spans, createBenchmarkSpan("http_request", nil))
			}
			for i := 0; i < sc.responses; i++ {
				spans = append(spans, createBenchmarkSpan("http_response", nil))
			}

			b.ResetTimer()
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				_, err := evaluator.EvaluateRule(rule, spans)
				if err != nil {
					b.Fatalf("Evaluation failed: %v", err)
				}
			}
		})
	}
}

// Benchmark parsing throughput
func BenchmarkParserThroughput(b *testing.B) {
	rules := []string{
		`when { payment } always { fraud_check }`,
		`when { api_request.where(path contains admin) } always { auth_check }`,
		`when { count(http_retry) > 3 } always { alert }`,
	}

	b.ReportAllocs()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			_, err := Parse(rules[i%len(rules)])
			if err != nil {
				b.Fatalf("Parse failed: %v", err)
			}
			i++
		}
	})
}

// Benchmark evaluator throughput
func BenchmarkEvaluatorThroughput(b *testing.B) {
	evaluator := NewEvaluator()
	rule, _ := Parse(`when { payment.where(amount > 1000) } always { fraud_check }`)
	spans := createBenchmarkSpans(50)

	b.ReportAllocs()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := evaluator.EvaluateRule(rule, spans)
			if err != nil {
				b.Fatalf("Evaluation failed: %v", err)
			}
		}
	})
}

// Helper functions

func createBenchmarkSpans(count int) []*models.Span {
	spans := make([]*models.Span, count)
	for i := 0; i < count; i++ {
		spans[i] = &models.Span{
			SpanID:        fmt.Sprintf("span-%d", i),
			TraceID:       "trace-bench",
			OperationName: fmt.Sprintf("operation_%d", i%10),
			ServiceName:   "benchmark-service",
			Attributes: map[string]string{
				"index": fmt.Sprintf("%d", i),
			},
			Status: "OK",
		}
	}
	return spans
}

func createBenchmarkSpan(name string, attrs map[string]interface{}) *models.Span {
	attrMap := make(map[string]string)
	for k, v := range attrs {
		attrMap[k] = fmt.Sprintf("%v", v)
	}

	return &models.Span{
		SpanID:        "span-1",
		TraceID:       "trace-bench",
		OperationName: name,
		ServiceName:   "benchmark-service",
		Attributes:    attrMap,
		Status:        "OK",
	}
}
