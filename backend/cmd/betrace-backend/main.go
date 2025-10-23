package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/betracehq/betrace/backend/internal/api"
	"github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/pkg/otel"
	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var (
	version = "dev"
	commit  = "unknown"
	tracer  oteltrace.Tracer
)

func main() {
	// Configuration
	port := getEnv("PORT", "8080")
	otlpEndpoint := getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317")
	signatureKey := getEnv("BETRACE_SIGNATURE_KEY", "dev-key-change-in-production")

	// Initialize OpenTelemetry
	tp, err := otel.InitTracer("betrace-backend", otlpEndpoint)
	if err != nil {
		log.Printf("Warning: Failed to initialize tracer: %v", err)
	} else {
		defer func() {
			if err := tp.Shutdown(context.Background()); err != nil {
				log.Printf("Error shutting down tracer: %v", err)
			}
		}()
		tracer = tp.Tracer("betrace-backend")
		log.Println("✓ OpenTelemetry tracing initialized")
	}

	// Initialize services (in-memory storage for development)
	violationStore := services.NewViolationStoreMemory(signatureKey)
	ruleStore := services.NewRuleStore()
	log.Println("✓ ViolationStore initialized (in-memory)")
	log.Println("✓ RuleStore initialized (in-memory)")

	// Initialize API handlers
	violationHandlers := api.NewViolationHandlers(violationStore, tracer)
	ruleHandlers := api.NewRuleHandlers(ruleStore, tracer)

	// HTTP router (Go 1.22+ stdlib with pattern matching)
	mux := http.NewServeMux()

	// Health checks
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /ready", handleReady)

	// Violation API (fully implemented)
	mux.HandleFunc("GET /api/violations", violationHandlers.GetViolations)
	mux.HandleFunc("POST /api/violations", violationHandlers.CreateViolation)
	mux.HandleFunc("GET /api/violations/{id}", violationHandlers.GetViolationByID)

	// Rule API (fully implemented)
	mux.HandleFunc("GET /api/rules", ruleHandlers.GetRules)
	mux.HandleFunc("POST /api/rules", ruleHandlers.CreateRule)
	mux.HandleFunc("GET /api/rules/{id}", ruleHandlers.GetRuleByID)
	mux.HandleFunc("PUT /api/rules/{id}", ruleHandlers.UpdateRule)
	mux.HandleFunc("DELETE /api/rules/{id}", ruleHandlers.DeleteRule)

	mux.HandleFunc("POST /api/spans", handleIngestSpans)
	mux.HandleFunc("POST /api/spans/batch", handleIngestSpansBatch)

	// Middleware chain
	handler := withLogging(withCORS(mux))

	// HTTP server
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Start server
	go func() {
		log.Printf("🚀 BeTrace Backend %s (%s) starting on http://localhost:%s\n", version, commit, port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	<-stop
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped gracefully")
}

// Health check endpoint
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"healthy","version":"%s"}`, version)
}

// Readiness check endpoint
func handleReady(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ready","storage":"in-memory"}`)
}

// Placeholder handlers for span ingestion (TODO: implement)
func handleIngestSpans(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]string{
		"message": "Span ingestion not implemented yet",
	})
}

func handleIngestSpansBatch(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]string{
		"message": "Batch span ingestion not implemented yet",
	})
}

// Middleware: CORS
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Middleware: Logging with OpenTelemetry tracing
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ctx := r.Context()

		// Create span if tracer is initialized
		if tracer != nil {
			var span oteltrace.Span
			ctx, span = tracer.Start(ctx, r.Method+" "+r.URL.Path,
				oteltrace.WithAttributes(
					attribute.String("http.method", r.Method),
					attribute.String("http.url", r.URL.Path),
					attribute.String("http.user_agent", r.UserAgent()),
				),
			)
			defer span.End()
			r = r.WithContext(ctx)
		}

		// Wrap ResponseWriter to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		// Add status code to span if tracer is initialized
		if tracer != nil {
			span := oteltrace.SpanFromContext(ctx)
			span.SetAttributes(
				attribute.Int("http.status_code", wrapped.statusCode),
				attribute.Int64("http.response_time_ms", time.Since(start).Milliseconds()),
			)
		}

		log.Printf("%s %s %d %s",
			r.Method,
			r.URL.Path,
			wrapped.statusCode,
			time.Since(start),
		)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Helper: Respond with JSON
func respondJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	// Proper JSON encoding
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

// Helper: Get environment variable with default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
