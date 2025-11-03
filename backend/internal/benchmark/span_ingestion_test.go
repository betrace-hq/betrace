package benchmark

import (
	"context"
	"fmt"
	"testing"
	"time"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	grpcServices "github.com/betracehq/betrace/backend/internal/grpc/services"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/pkg/models"
)

// BenchmarkSpanIngestion_NoRules benchmarks span ingestion with no rules
func BenchmarkSpanIngestion_NoRules(b *testing.B) {
	engine := rules.NewRuleEngine()
	violationStore := services.NewViolationStoreMemory("bench-key")
	service := grpcServices.NewSpanService(engine, violationStore)

	ctx := context.Background()
	req := &pb.IngestSpansRequest{
		Spans: generateTestSpans(1),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.IngestSpans(ctx, req)
		if err != nil {
			b.Fatalf("IngestSpans failed: %v", err)
		}
	}
}

// BenchmarkSpanIngestion_OneRule benchmarks span ingestion with 1 rule
func BenchmarkSpanIngestion_OneRule(b *testing.B) {
	engine := rules.NewRuleEngine()
	rule := createBenchmarkRule("rule-1", "true")
	_ = engine.LoadRule(rule)

	violationStore := services.NewViolationStoreMemory("bench-key")
	service := grpcServices.NewSpanService(engine, violationStore)

	ctx := context.Background()
	req := &pb.IngestSpansRequest{
		Spans: generateTestSpans(1),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.IngestSpans(ctx, req)
		if err != nil {
			b.Fatalf("IngestSpans failed: %v", err)
		}
	}
}

// BenchmarkSpanIngestion_TenRules benchmarks span ingestion with 10 rules
func BenchmarkSpanIngestion_TenRules(b *testing.B) {
	engine := rules.NewRuleEngine()
	for i := 0; i < 10; i++ {
		rule := createBenchmarkRule(
			fmt.Sprintf("rule-%d", i),
			"true",
		)
		_ = engine.LoadRule(rule)
	}

	violationStore := services.NewViolationStoreMemory("bench-key")
	service := grpcServices.NewSpanService(engine, violationStore)

	ctx := context.Background()
	req := &pb.IngestSpansRequest{
		Spans: generateTestSpans(1),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.IngestSpans(ctx, req)
		if err != nil {
			b.Fatalf("IngestSpans failed: %v", err)
		}
	}
}

// BenchmarkSpanIngestion_Batch10 benchmarks ingesting 10 spans at once
func BenchmarkSpanIngestion_Batch10(b *testing.B) {
	engine := rules.NewRuleEngine()
	violationStore := services.NewViolationStoreMemory("bench-key")
	service := grpcServices.NewSpanService(engine, violationStore)

	ctx := context.Background()
	req := &pb.IngestSpansRequest{
		Spans: generateTestSpans(10),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.IngestSpans(ctx, req)
		if err != nil {
			b.Fatalf("IngestSpans failed: %v", err)
		}
	}
}

// BenchmarkSpanIngestion_Batch100 benchmarks ingesting 100 spans at once
func BenchmarkSpanIngestion_Batch100(b *testing.B) {
	engine := rules.NewRuleEngine()
	violationStore := services.NewViolationStoreMemory("bench-key")
	service := grpcServices.NewSpanService(engine, violationStore)

	ctx := context.Background()
	req := &pb.IngestSpansRequest{
		Spans: generateTestSpans(100),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.IngestSpans(ctx, req)
		if err != nil {
			b.Fatalf("IngestSpans failed: %v", err)
		}
	}
}

// BenchmarkSpanIngestion_Parallel benchmarks parallel span ingestion
func BenchmarkSpanIngestion_Parallel(b *testing.B) {
	engine := rules.NewRuleEngine()
	rule := createBenchmarkRule("rule-1", "true")
	_ = engine.LoadRule(rule)

	violationStore := services.NewViolationStoreMemory("bench-key")
	service := grpcServices.NewSpanService(engine, violationStore)

	ctx := context.Background()

	b.ResetTimer()
	b.RunParallel(func(testingPB *testing.PB) {
		req := &pb.IngestSpansRequest{
			Spans: generateTestSpans(10),
		}

		for testingPB.Next() {
			_, err := service.IngestSpans(ctx, req)
			if err != nil {
				b.Fatalf("IngestSpans failed: %v", err)
			}
		}
	})
}


// Helpers

func generateTestSpans(count int) []*pb.Span {
	spans := make([]*pb.Span, count)
	now := time.Now().UnixNano()

	for i := 0; i < count; i++ {
		spans[i] = &pb.Span{
			TraceId:   fmt.Sprintf("trace-%d", i),
			SpanId:    fmt.Sprintf("span-%d", i),
			Name:      "benchmark-operation",
			StartTime: now,
			EndTime:   now + int64(150*time.Millisecond), // 150ms duration
			Attributes: map[string]string{
				"service.name": "benchmark-service",
			},
		}
	}

	return spans
}

func createBenchmarkRule(id, expression string) models.Rule {
	return models.Rule{
		ID:         id,
		Name:       id,
		Expression: expression,
		Enabled:    true,
		Severity:   "HIGH",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
}
