package services

import (
	"context"
	"time"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
)

// HealthService implements the gRPC HealthService
type HealthService struct {
	pb.UnimplementedHealthServiceServer
	version   string
	startTime time.Time
}

// NewHealthService creates a new HealthService
func NewHealthService(version string) *HealthService {
	return &HealthService{
		version:   version,
		startTime: time.Now(),
	}
}

// Check returns the health status of the service
func (s *HealthService) Check(ctx context.Context, req *pb.HealthCheckRequest) (*pb.HealthCheckResponse, error) {
	return &pb.HealthCheckResponse{
		Status:        pb.HealthCheckResponse_HEALTHY,
		Version:       s.version,
		UptimeSeconds: int64(time.Since(s.startTime).Seconds()),
		Metadata: map[string]string{
			"storage": "in-memory",
		},
	}, nil
}

// Ready returns readiness status
func (s *HealthService) Ready(ctx context.Context, req *pb.HealthCheckRequest) (*pb.HealthCheckResponse, error) {
	// Same as Check for now - could add dependency checks here
	return s.Check(ctx, req)
}
