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
	"github.com/betracehq/betrace/backend/internal/observability"
	"github.com/betracehq/betrace/backend/internal/rules"
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
	grpcPort := getEnv("BETRACE_PORT_GRPC", "50051")
	httpPort := getEnv("BETRACE_PORT_BACKEND", "12011")

	// Create rule engine
	engine := rules.NewRuleEngine()
	log.Println("✓ Rule engine initialized")

	// Create gRPC services
	ruleService := grpcServices.NewRuleService(engine)
	healthService := grpcServices.NewHealthService(version)

	// Start gRPC server with logging middleware
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			grpcmiddleware.UnaryServerLoggingInterceptor(),
		),
	)
	pb.RegisterRuleServiceServer(grpcServer, ruleService)
	pb.RegisterHealthServiceServer(grpcServer, healthService)

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

	// Add CORS middleware
	httpHandler := corsMiddleware(mux)

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
