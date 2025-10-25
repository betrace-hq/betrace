package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/betracehq/betrace/backend/internal/api"
	"github.com/betracehq/betrace/backend/internal/observability"
)

var (
	version = "2.0.0"
	commit  = "dev"
)

func main() {
	ctx := context.Background()

	// Initialize OpenTelemetry
	shutdown, err := observability.InitOpenTelemetry(ctx, "betrace-backend", version)
	if err != nil {
		log.Printf("Warning: Failed to initialize OpenTelemetry: %v", err)
		// Continue running without telemetry
	} else {
		defer func() {
			if err := shutdown(ctx); err != nil {
				log.Printf("Error shutting down OpenTelemetry: %v", err)
			}
		}()
		log.Println("✓ OpenTelemetry initialized")
	}

	// Get port from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("BETRACE_PORT_BACKEND")
	}
	if port == "" {
		port = "12011"
	}
	addr := ":" + port

	// Create API server
	server := api.NewServer(version)

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Start server in goroutine
	go func() {
		if err := server.Run(ctx, addr); err != nil {
			log.Printf("Server error: %v", err)
			stop <- syscall.SIGTERM
		}
	}()

	// Wait for interrupt signal
	<-stop
	fmt.Println("\n🛑 Shutting down server...")
	cancel()

	log.Println("✓ Server stopped gracefully")
}
