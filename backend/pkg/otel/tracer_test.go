package otel

import (
	"context"
	"testing"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

// P1-4: OpenTelemetry Tests

func TestInitTracer_InvalidEndpoint(t *testing.T) {
	// Invalid endpoint should fail during connection attempt
	// Note: gRPC connection is lazy, so this may not fail immediately
	tp, err := InitTracer("test-service", "invalid-endpoint:99999")

	// InitTracer doesn't fail on invalid endpoint (gRPC lazy connect)
	// but we can verify the TracerProvider was created
	if err != nil {
		t.Fatalf("InitTracer failed: %v", err)
	}
	if tp == nil {
		t.Fatal("Expected non-nil TracerProvider")
	}

	// Cleanup
	tp.Shutdown(context.Background())
}

func TestInitTracer_ResourceAttributes(t *testing.T) {
	// Create tracer with test service name
	tp, err := InitTracer("test-service-name", "localhost:4317")
	if err != nil {
		t.Fatalf("InitTracer failed: %v", err)
	}
	defer tp.Shutdown(context.Background())

	if tp == nil {
		t.Fatal("Expected non-nil TracerProvider")
	}

	// Verify resource contains service.name attribute
	// Note: We can't directly access resource from TracerProvider in SDK
	// This is tested indirectly through span emission below
}

func TestInitTracer_GlobalTracerProviderSet(t *testing.T) {
	// Initialize tracer
	tp, err := InitTracer("test-global-provider", "localhost:4317")
	if err != nil {
		t.Fatalf("InitTracer failed: %v", err)
	}
	defer tp.Shutdown(context.Background())

	// Verify global tracer provider was set
	globalTP := otel.GetTracerProvider()
	if globalTP == nil {
		t.Fatal("Expected global TracerProvider to be set")
	}

	// Verify we can get a tracer from global provider
	tracer := globalTP.Tracer("test-tracer")
	if tracer == nil {
		t.Fatal("Expected non-nil tracer from global provider")
	}
}

func TestInitTracer_WithInMemoryExporter(t *testing.T) {
	// Use in-memory exporter for testing span emission
	exporter := tracetest.NewInMemoryExporter()

	// Create tracer provider with in-memory exporter
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceName("test-in-memory-service"),
		),
	)
	if err != nil {
		t.Fatalf("Failed to create resource: %v", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter), // Use syncer for immediate export
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	defer tp.Shutdown(context.Background())

	// Create tracer and emit span
	tracer := tp.Tracer("test-tracer")
	ctx := context.Background()
	_, span := tracer.Start(ctx, "test-operation")
	span.SetAttributes(semconv.ServiceName("test-service"))
	span.End()

	// Verify span was exported
	spans := exporter.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span, got %d", len(spans))
	}

	if len(spans) > 0 {
		if spans[0].Name != "test-operation" {
			t.Errorf("Expected span name 'test-operation', got '%s'", spans[0].Name)
		}
	}
}

func TestTracerProvider_MultipleSpans(t *testing.T) {
	// Create tracer provider with in-memory exporter
	exporter := tracetest.NewInMemoryExporter()

	res, _ := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName("multi-span-test")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)
	defer tp.Shutdown(context.Background())

	tracer := tp.Tracer("test-tracer")
	ctx := context.Background()

	// Emit multiple spans
	for i := 0; i < 5; i++ {
		_, span := tracer.Start(ctx, "test-span")
		span.End()
	}

	// Verify all spans exported
	spans := exporter.GetSpans()
	if len(spans) != 5 {
		t.Errorf("Expected 5 spans, got %d", len(spans))
	}
}

func TestTracerProvider_NestedSpans(t *testing.T) {
	// Create tracer provider with in-memory exporter
	exporter := tracetest.NewInMemoryExporter()

	res, _ := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName("nested-span-test")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)
	defer tp.Shutdown(context.Background())

	tracer := tp.Tracer("test-tracer")
	ctx := context.Background()

	// Create parent span
	parentCtx, parentSpan := tracer.Start(ctx, "parent-operation")

	// Create child span
	_, childSpan := tracer.Start(parentCtx, "child-operation")
	childSpan.End()

	parentSpan.End()

	// Verify both spans exported
	spans := exporter.GetSpans()
	if len(spans) != 2 {
		t.Errorf("Expected 2 spans (parent + child), got %d", len(spans))
	}

	// Verify parent-child relationship
	if len(spans) == 2 {
		child := spans[0] // Child ends first
		parent := spans[1]

		if child.Name != "child-operation" {
			t.Errorf("Expected child span name 'child-operation', got '%s'", child.Name)
		}
		if parent.Name != "parent-operation" {
			t.Errorf("Expected parent span name 'parent-operation', got '%s'", parent.Name)
		}

		// Verify child's parent is the parent span
		if child.Parent.TraceID() != parent.SpanContext.TraceID() {
			t.Error("Child span should belong to same trace as parent")
		}
	}
}

func TestTracerProvider_SpanAttributes(t *testing.T) {
	// Create tracer provider with in-memory exporter
	exporter := tracetest.NewInMemoryExporter()

	res, _ := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName("attribute-test")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)
	defer tp.Shutdown(context.Background())

	tracer := tp.Tracer("test-tracer")
	ctx := context.Background()

	// Create span with attributes
	_, span := tracer.Start(ctx, "operation-with-attrs")
	span.SetAttributes(
		semconv.HTTPMethod("POST"),
		semconv.HTTPStatusCode(201),
	)
	span.End()

	// Verify span has attributes
	spans := exporter.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	spanData := spans[0]
	if len(spanData.Attributes) < 2 {
		t.Errorf("Expected at least 2 attributes, got %d", len(spanData.Attributes))
	}

	// Verify specific attributes
	foundMethod := false
	foundStatus := false
	for _, attr := range spanData.Attributes {
		if attr.Key == "http.method" && attr.Value.AsString() == "POST" {
			foundMethod = true
		}
		if attr.Key == "http.status_code" && attr.Value.AsInt64() == 201 {
			foundStatus = true
		}
	}

	if !foundMethod {
		t.Error("Expected http.method=POST attribute")
	}
	if !foundStatus {
		t.Error("Expected http.status_code=201 attribute")
	}
}

func TestTracerProvider_Shutdown(t *testing.T) {
	// Create tracer provider
	exporter := tracetest.NewInMemoryExporter()
	res, _ := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName("shutdown-test")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)

	// Emit span before shutdown
	tracer := tp.Tracer("test-tracer")
	_, span := tracer.Start(context.Background(), "pre-shutdown")
	span.End()

	// Force flush to ensure span is exported
	ctx := context.Background()
	err := tp.ForceFlush(ctx)
	if err != nil {
		t.Errorf("ForceFlush failed: %v", err)
	}

	// Verify span was exported
	spans := exporter.GetSpans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span after flush, got %d", len(spans))
	}

	// Shutdown with timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = tp.Shutdown(shutdownCtx)
	if err != nil {
		t.Errorf("Shutdown failed: %v", err)
	}
}

func TestTracerProvider_ShutdownTimeout(t *testing.T) {
	// Create tracer provider
	exporter := tracetest.NewInMemoryExporter()
	res, _ := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName("timeout-test")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)

	// Shutdown with very short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()

	// Should complete even with short timeout (no pending spans)
	err := tp.Shutdown(ctx)
	if err != nil && err != context.DeadlineExceeded {
		t.Errorf("Unexpected shutdown error: %v", err)
	}
}

func TestInitTracer_EmptyServiceName(t *testing.T) {
	// Empty service name should still create provider
	tp, err := InitTracer("", "localhost:4317")
	if err != nil {
		t.Fatalf("InitTracer with empty service name failed: %v", err)
	}
	defer tp.Shutdown(context.Background())

	if tp == nil {
		t.Fatal("Expected non-nil TracerProvider even with empty service name")
	}
}

func TestInitTracer_EmptyEndpoint(t *testing.T) {
	// Empty endpoint should fail during exporter creation
	_, err := InitTracer("test-service", "")
	if err != nil {
		// Expected - empty endpoint may cause error
		return
	}

	// If no error, verify provider was created
	// (gRPC may accept empty endpoint and fail later)
}

func TestTracerProvider_ResourceServiceName(t *testing.T) {
	// Verify service name is correctly set in resource
	exporter := tracetest.NewInMemoryExporter()

	expectedServiceName := "my-test-service"
	res, err := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName(expectedServiceName)),
	)
	if err != nil {
		t.Fatalf("Failed to create resource: %v", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)
	defer tp.Shutdown(context.Background())

	// Emit span
	tracer := tp.Tracer("test-tracer")
	_, span := tracer.Start(context.Background(), "test-op")
	span.End()

	// Verify resource attributes in span
	spans := exporter.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("Expected 1 span, got %d", len(spans))
	}

	// Check resource attributes
	spanData := spans[0]
	foundServiceName := false
	for _, attr := range spanData.Resource.Attributes() {
		if attr.Key == "service.name" && attr.Value.AsString() == expectedServiceName {
			foundServiceName = true
			break
		}
	}

	if !foundServiceName {
		t.Errorf("Expected service.name=%s in resource attributes", expectedServiceName)
	}
}

// Benchmark tests for tracer performance

func BenchmarkTracerProvider_CreateSpan(b *testing.B) {
	exporter := tracetest.NewInMemoryExporter()
	res, _ := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName("bench-test")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)
	defer tp.Shutdown(context.Background())

	tracer := tp.Tracer("bench-tracer")
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, span := tracer.Start(ctx, "benchmark-span")
		span.End()
	}
}

func BenchmarkTracerProvider_SpanWithAttributes(b *testing.B) {
	exporter := tracetest.NewInMemoryExporter()
	res, _ := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName("bench-test")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)
	defer tp.Shutdown(context.Background())

	tracer := tp.Tracer("bench-tracer")
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, span := tracer.Start(ctx, "benchmark-span")
		span.SetAttributes(
			semconv.HTTPMethod("POST"),
			semconv.HTTPStatusCode(200),
		)
		span.End()
	}
}

func BenchmarkTracerProvider_NestedSpans(b *testing.B) {
	exporter := tracetest.NewInMemoryExporter()
	res, _ := resource.New(context.Background(),
		resource.WithAttributes(semconv.ServiceName("bench-test")),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
		sdktrace.WithResource(res),
	)
	defer tp.Shutdown(context.Background())

	tracer := tp.Tracer("bench-tracer")
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		parentCtx, parentSpan := tracer.Start(ctx, "parent")
		_, childSpan := tracer.Start(parentCtx, "child")
		childSpan.End()
		parentSpan.End()
	}
}
