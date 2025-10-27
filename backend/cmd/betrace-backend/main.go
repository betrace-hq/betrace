package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	grpcmiddleware "github.com/betracehq/betrace/backend/internal/grpc/middleware"
	grpcServices "github.com/betracehq/betrace/backend/internal/grpc/services"
	"github.com/betracehq/betrace/backend/internal/middleware"
	"github.com/betracehq/betrace/backend/internal/observability"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/internal/storage"
)

var (
	version = "2.0.0"
	commit  = "dev"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize OpenTelemetry
	shutdown, err := observability.InitOpenTelemetry(ctx, "betrace-backend", version)
	if err != nil {
		log.Printf("Warning: Failed to initialize OpenTelemetry: %v", err)
	} else {
		defer func() {
			if err := shutdown(ctx); err != nil {
				log.Printf("Error shutting down OpenTelemetry: %v", err)
			}
		}()
		log.Println("✓ OpenTelemetry initialized")
	}

	// Get ports from environment
	grpcPort := getEnv("BETRACE_PORT_GRPC", "12012")
	httpPort := getEnv("BETRACE_PORT_BACKEND", "12011")
	dataDir := getEnv("BETRACE_DATA_DIR", "./data")

	// Initialize persistence layer
	log.Printf("📁 Data directory: %s", dataDir)

	// Create disk-backed rule store
	ruleStore, err := storage.NewDiskRuleStore(dataDir)
	if err != nil {
		log.Fatalf("Failed to initialize rule store: %v", err)
	}
	log.Printf("✓ Rule store initialized (%d rules recovered)", ruleStore.Count())

	// Create rule engine and load persisted rules
	engine := rules.NewRuleEngine()
	recoveredRules, err := ruleStore.List()
	if err != nil {
		log.Printf("Warning: Failed to load rules: %v", err)
	} else {
		for _, rule := range recoveredRules {
			if err := engine.LoadRule(rule); err != nil {
				log.Printf("Warning: Failed to load rule %s: %v", rule.ID, err)
			} else {
				log.Printf("  ↳ Recovered rule: %s", rule.Name)
			}
		}
	}
	log.Println("✓ Rule engine initialized")

	// Create violation store (in-memory with signing)
	// Note: Violations are ephemeral - they're meant to be sent to Tempo
	signatureKey := getEnv("BETRACE_SIGNATURE_KEY", "dev-signature-key-change-in-production")
	violationStore := services.NewViolationStoreMemory(signatureKey)
	log.Println("✓ Violation store initialized (in-memory with signing)")

	// Create gRPC services with persistent rule store
	ruleService := grpcServices.NewRuleService(engine, ruleStore)
	healthService := grpcServices.NewHealthService(version)
	spanService := grpcServices.NewSpanService(engine, violationStore)
	violationService := grpcServices.NewViolationService(violationStore)

	// Start gRPC server with logging middleware
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			grpcmiddleware.UnaryServerLoggingInterceptor(),
		),
	)
	pb.RegisterRuleServiceServer(grpcServer, ruleService)
	pb.RegisterHealthServiceServer(grpcServer, healthService)
	pb.RegisterSpanServiceServer(grpcServer, spanService)
	pb.RegisterViolationServiceServer(grpcServer, violationService)

	grpcListener, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("Failed to listen on gRPC port %s: %v", grpcPort, err)
	}

	go func() {
		log.Printf("🚀 gRPC server listening on :%s\n", grpcPort)
		if err := grpcServer.Serve(grpcListener); err != nil {
			log.Fatalf("gRPC server error: %v", err)
		}
	}()

	// Start grpc-gateway (REST proxy)
	mux := runtime.NewServeMux()

	// Connect to local gRPC server
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	endpoint := "localhost:" + grpcPort

	// Register services with gateway
	if err := pb.RegisterRuleServiceHandlerFromEndpoint(ctx, mux, endpoint, opts); err != nil {
		log.Fatalf("Failed to register RuleService handler: %v", err)
	}
	if err := pb.RegisterHealthServiceHandlerFromEndpoint(ctx, mux, endpoint, opts); err != nil {
		log.Fatalf("Failed to register HealthService handler: %v", err)
	}
	if err := pb.RegisterSpanServiceHandlerFromEndpoint(ctx, mux, endpoint, opts); err != nil {
		log.Fatalf("Failed to register SpanService handler: %v", err)
	}
	if err := pb.RegisterViolationServiceHandlerFromEndpoint(ctx, mux, endpoint, opts); err != nil {
		log.Fatalf("Failed to register ViolationService handler: %v", err)
	}

	// Add middleware chain
	// Body limit first (10MB max), then CORS
	httpHandler := middleware.BodyLimitMiddleware(10 * 1024 * 1024)(mux)
	httpHandler = corsMiddleware(httpHandler)

	// Add Prometheus metrics endpoint (bypasses grpc-gateway)
	httpMux := http.NewServeMux()
	httpMux.Handle("/metrics", promhttp.Handler())
	httpMux.Handle("/", httpHandler)

	httpServer := &http.Server{
		Addr:         ":" + httpPort,
		Handler:      httpMux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("🌐 REST API (grpc-gateway) listening on :%s\n", httpPort)
		log.Printf("📊 Metrics: http://localhost:%s/metrics\n", httpPort)
		log.Printf("💚 Health: http://localhost:%s/health\n", httpPort)
		log.Printf("📖 OpenAPI: backend/api/openapi/betrace.swagger.json\n")
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	<-stop
	fmt.Println("\n🛑 Shutting down servers...")

	// Stop HTTP server
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	// Stop gRPC server
	grpcServer.GracefulStop()

	log.Println("✓ Servers stopped gracefully")
}

// corsMiddleware adds CORS headers for browser access
func corsMiddleware(next http.Handler) http.Handler {
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

// getEnv gets environment variable with default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
