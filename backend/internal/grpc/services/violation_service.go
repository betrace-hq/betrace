package services

import (
	"context"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	internalServices "github.com/betracehq/betrace/backend/internal/services"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// ViolationService implements the gRPC ViolationService
type ViolationService struct {
	pb.UnimplementedViolationServiceServer
	violationStore *internalServices.ViolationStoreMemory
}

// NewViolationService creates a new violation service
func NewViolationService(violationStore *internalServices.ViolationStoreMemory) *ViolationService {
	return &ViolationService{
		violationStore: violationStore,
	}
}

// ListViolations returns rule violations
func (s *ViolationService) ListViolations(ctx context.Context, req *pb.ListViolationsRequest) (*pb.ListViolationsResponse, error) {
	// Build query filters
	filters := internalServices.QueryFilters{
		RuleID: req.RuleId,
		Limit:  100,
	}

	if req.Limit > 0 {
		filters.Limit = int(req.Limit)
	}

	// Query violations
	violations, err := s.violationStore.Query(ctx, filters)
	if err != nil {
		return nil, err
	}

	// Convert to proto violations
	pbViolations := make([]*pb.Violation, len(violations))
	for i, v := range violations {
		pbViolations[i] = &pb.Violation{
			Id:        v.ID,
			RuleId:    v.RuleID,
			RuleName:  v.RuleName,
			TraceId:   "", // Use first trace ID if available
			SpanId:    "",  // Use first span ID if available
			Timestamp: timestamppb.New(v.CreatedAt),
			Severity:  v.Severity,
			Message:   v.Message,
			Context:   make(map[string]string), // Empty for now
		}

		// Set trace/span IDs from first reference
		if len(v.SpanRefs) > 0 {
			pbViolations[i].TraceId = v.SpanRefs[0].TraceID
			pbViolations[i].SpanId = v.SpanRefs[0].SpanID
		}
	}

	return &pb.ListViolationsResponse{
		Violations: pbViolations,
		TotalCount: int32(len(violations)),
	}, nil
}
