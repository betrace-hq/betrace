package middleware

import (
	"context"
	"time"

	"github.com/betracehq/betrace/backend/internal/observability"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// UnaryServerLoggingInterceptor logs all gRPC requests
func UnaryServerLoggingInterceptor() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		start := time.Now()

		// Log incoming request
		observability.Debug(ctx, "gRPC request: %s", info.FullMethod)

		// Call handler
		resp, err := handler(ctx, req)

		// Calculate duration
		duration := time.Since(start)

		// Log response
		if err != nil {
			st, _ := status.FromError(err)
			observability.Warn(ctx, "gRPC error: %s code=%s duration=%v error=%v",
				info.FullMethod, st.Code(), duration, err)
		} else {
			observability.Debug(ctx, "gRPC success: %s duration=%v", info.FullMethod, duration)
		}

		// Record metrics
		codeStr := codes.OK.String()
		if err != nil {
			st, _ := status.FromError(err)
			codeStr = st.Code().String()
		}

		observability.RecordRuleEvaluation(ctx, info.FullMethod, codeStr, duration.Seconds())

		return resp, err
	}
}
