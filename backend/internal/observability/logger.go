package observability

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.opentelemetry.io/otel/trace"
)

// LogLevel represents logging levels
type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

var (
	currentLogLevel = LogLevelInfo
	debugEnabled    = false
)

func init() {
	// Enable debug logging if DEBUG env var is set
	if os.Getenv("DEBUG") != "" || os.Getenv("BETRACE_DEBUG") != "" {
		currentLogLevel = LogLevelDebug
		debugEnabled = true
		log.Println("🐛 Debug logging enabled")
	}
}

// Debug logs debug-level messages (only if DEBUG=1)
func Debug(ctx context.Context, format string, args ...interface{}) {
	if currentLogLevel <= LogLevelDebug {
		logWithContext(ctx, "DEBUG", format, args...)
	}
}

// Info logs info-level messages
func Info(ctx context.Context, format string, args ...interface{}) {
	if currentLogLevel <= LogLevelInfo {
		logWithContext(ctx, "INFO", format, args...)
	}
}

// Warn logs warning-level messages
func Warn(ctx context.Context, format string, args ...interface{}) {
	if currentLogLevel <= LogLevelWarn {
		logWithContext(ctx, "WARN", format, args...)
	}
}

// Error logs error-level messages
func Error(ctx context.Context, format string, args ...interface{}) {
	if currentLogLevel <= LogLevelError {
		logWithContext(ctx, "ERROR", format, args...)
	}
}

// logWithContext logs with trace ID if available
func logWithContext(ctx context.Context, level string, format string, args ...interface{}) {
	timestamp := time.Now().Format("2006/01/02 15:04:05.000")
	message := fmt.Sprintf(format, args...)

	// Extract trace ID from context
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().HasTraceID() {
		traceID := span.SpanContext().TraceID().String()
		log.Printf("%s [%s] [trace=%s] %s", timestamp, level, traceID[:8], message)
	} else {
		log.Printf("%s [%s] %s", timestamp, level, message)
	}
}

// LogRequest logs an incoming request
func LogRequest(ctx context.Context, method, path string, params map[string]interface{}) {
	if debugEnabled {
		Debug(ctx, "→ Request: %s %s params=%v", method, path, params)
	}
}

// LogResponse logs an outgoing response
func LogResponse(ctx context.Context, method, path string, statusCode int, duration time.Duration) {
	if debugEnabled {
		Debug(ctx, "← Response: %s %s status=%d duration=%v", method, path, statusCode, duration)
	} else if statusCode >= 400 {
		Warn(ctx, "← Response: %s %s status=%d duration=%v", method, path, statusCode, duration)
	}
}

// LogError logs an error with stack context
func LogError(ctx context.Context, operation string, err error) {
	Error(ctx, "Operation failed: %s error=%v", operation, err)
}

// IsDebugEnabled returns true if debug logging is enabled
func IsDebugEnabled() bool {
	return debugEnabled
}
