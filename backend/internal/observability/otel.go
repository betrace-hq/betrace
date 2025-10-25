package observability

import (
	"context"
	"fmt"
	"os"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// InitOpenTelemetry initializes OpenTelemetry with Tempo exporter
func InitOpenTelemetry(ctx context.Context, serviceName, serviceVersion string) (func(context.Context) error, error) {
	// Get OTLP endpoint from environment (Alloy/Tempo)
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "localhost:4317" // Default to Alloy gRPC port
	}

	// Create resource with service information
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(serviceVersion),
			semconv.DeploymentEnvironment("development"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create gRPC connection to OTLP exporter
	conn, err := grpc.DialContext(ctx, endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(5*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to OTLP endpoint %s: %w", endpoint, err)
	}

	// Create OTLP trace exporter
	traceExporter, err := otlptrace.New(ctx, otlptracegrpc.NewClient(
		otlptracegrpc.WithGRPCConn(conn),
	))
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	// Create trace provider with batch span processor
	bsp := sdktrace.NewBatchSpanProcessor(traceExporter)
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(bsp),
	)

	// Set global trace provider
	otel.SetTracerProvider(tracerProvider)

	// Set global propagator for distributed tracing
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Return shutdown function
	return func(shutdownCtx context.Context) error {
		// Flush any remaining spans
		if err := tracerProvider.ForceFlush(shutdownCtx); err != nil {
			return fmt.Errorf("failed to flush spans: %w", err)
		}

		// Shutdown trace provider
		if err := tracerProvider.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("failed to shutdown tracer provider: %w", err)
		}

		// Close gRPC connection
		if err := conn.Close(); err != nil {
			return fmt.Errorf("failed to close gRPC connection: %w", err)
		}

		return nil
	}, nil
}

// InitOpenTelemetryOrNoop initializes OpenTelemetry or uses noop if unavailable
func InitOpenTelemetryOrNoop(ctx context.Context, serviceName, serviceVersion string) func(context.Context) error {
	shutdown, err := InitOpenTelemetry(ctx, serviceName, serviceVersion)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: OpenTelemetry initialization failed: %v\n", err)
		fmt.Fprintf(os.Stderr, "Continuing with noop tracer (no traces will be exported)\n")
		return func(context.Context) error { return nil }
	}

	fmt.Printf("✅ OpenTelemetry initialized (exporting to %s)\n", os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
	return shutdown
}
