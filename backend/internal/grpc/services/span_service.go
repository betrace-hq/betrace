package services

import (
	"context"
	"fmt"
	"log"
	"time"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	"github.com/betracehq/betrace/backend/internal/rules"
	internalServices "github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/pkg/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// SpanService implements the gRPC SpanService
type SpanService struct {
	pb.UnimplementedSpanServiceServer
	engine         *rules.RuleEngine
	violationStore *internalServices.ViolationStoreMemory
	traceBuffer    *internalServices.TraceBuffer
}

// NewSpanService creates a new span service
func NewSpanService(engine *rules.RuleEngine, violationStore *internalServices.ViolationStoreMemory) *SpanService {
	s := &SpanService{
		engine:         engine,
		violationStore: violationStore,
	}

	// Create trace buffer with 3 second timeout
	s.traceBuffer = internalServices.NewTraceBuffer(3*time.Second, s.onTraceComplete)

	return s
}

// IngestSpans handles span ingestion and rule evaluation
func (s *SpanService) IngestSpans(ctx context.Context, req *pb.IngestSpansRequest) (*pb.IngestSpansResponse, error) {
	if req == nil || len(req.Spans) == 0 {
		return &pb.IngestSpansResponse{
			Accepted: 0,
			Rejected: 0,
		}, nil
	}

	accepted := 0
	rejected := 0
	var errors []string

	// Validation limits
	const (
		maxSpansPerBatch    = 10000
		maxAttributesPerSpan = 128
		maxBodySize         = 10 * 1024 * 1024 // 10MB
	)

	if len(req.Spans) > maxSpansPerBatch {
		return nil, status.Errorf(codes.InvalidArgument, "batch too large: %d spans exceeds limit of %d", len(req.Spans), maxSpansPerBatch)
	}

	// Process each span
	for _, protoSpan := range req.Spans {
		// Validate span
		if err := s.validateSpan(protoSpan); err != nil {
			// For malformed spans, return error immediately
			return nil, status.Errorf(codes.InvalidArgument, "invalid span: %v", err)
		}

		// Check attributes limit
		if len(protoSpan.Attributes) > maxAttributesPerSpan {
			return nil, status.Errorf(codes.InvalidArgument, "span %s has too many attributes: %d > %d", protoSpan.SpanId, len(protoSpan.Attributes), maxAttributesPerSpan)
		}

		// Convert proto span to models.Span for rule evaluation
		modelSpan := s.protoToModelSpan(protoSpan)

		// Evaluate rules against span
		matchedRuleIDs, err := s.engine.EvaluateAll(ctx, &modelSpan)
		if err != nil {
			log.Printf("Error evaluating rules for span %s: %v", protoSpan.SpanId, err)
		}

		// Create violations for matched rules (span-level)
		if len(matchedRuleIDs) > 0 {
			for _, ruleID := range matchedRuleIDs {
				// Get rule details
				compiledRule, ok := s.engine.GetRule(ruleID)
				if !ok {
					continue
				}

				// Create violation
				violation := models.Violation{
					RuleID:   ruleID,
					RuleName: compiledRule.Rule.Name,
					Severity: compiledRule.Rule.Severity,
					Message:  fmt.Sprintf("Rule '%s' matched span '%s' in trace '%s'", compiledRule.Rule.Name, protoSpan.SpanId, protoSpan.TraceId),
				}

				spanRefs := []models.SpanRef{
					{
						TraceID:     protoSpan.TraceId,
						SpanID:      protoSpan.SpanId,
						ServiceName: modelSpan.ServiceName,
					},
				}

				// Record violation
				_, err := s.violationStore.Record(ctx, violation, spanRefs)
				if err != nil {
					log.Printf("Error recording violation for rule %s: %v", ruleID, err)
				} else {
					log.Printf("Violation recorded: rule=%s trace=%s span=%s", ruleID, protoSpan.TraceId, protoSpan.SpanId)
				}
			}
		}

		// Add span to trace buffer for trace-level evaluation
		s.traceBuffer.AddSpan(&modelSpan)

		accepted++
		log.Printf("Ingested span: trace_id=%s span_id=%s name=%s matched_rules=%d", protoSpan.TraceId, protoSpan.SpanId, protoSpan.Name, len(matchedRuleIDs))
	}

	return &pb.IngestSpansResponse{
		Accepted: int32(accepted),
		Rejected: int32(rejected),
		Errors:   errors,
	}, nil
}

func (s *SpanService) validateSpan(span *pb.Span) error {
	if span == nil {
		return fmt.Errorf("span is nil")
	}
	if span.TraceId == "" {
		return fmt.Errorf("trace_id is required")
	}
	if span.SpanId == "" {
		return fmt.Errorf("span_id is required")
	}
	if span.Name == "" {
		return fmt.Errorf("span name is required")
	}
	return nil
}

// protoToModelSpan converts a protobuf Span to a models.Span
func (s *SpanService) protoToModelSpan(protoSpan *pb.Span) models.Span {
	// Convert timestamps from Unix nanoseconds to time.Time
	startTime := time.Unix(0, protoSpan.StartTime)
	endTime := time.Unix(0, protoSpan.EndTime)

	// Calculate duration if not provided
	duration := protoSpan.DurationMs * 1000000 // Convert ms to nanoseconds
	if duration == 0 && !endTime.IsZero() && !startTime.IsZero() {
		duration = endTime.Sub(startTime).Nanoseconds()
	}

	return models.Span{
		SpanID:        protoSpan.SpanId,
		TraceID:       protoSpan.TraceId,
		ParentSpanID:  protoSpan.ParentSpanId,
		OperationName: protoSpan.Name,
		ServiceName:   "", // Not in proto, could be added later
		StartTime:     startTime,
		EndTime:       endTime,
		Duration:      duration,
		Attributes:    protoSpan.Attributes,
		Status:        protoSpan.Status,
	}
}

// onTraceComplete is called when a trace is considered complete
func (s *SpanService) onTraceComplete(ctx context.Context, traceID string, spans []*models.Span) {
	log.Printf("Trace complete: trace_id=%s spans=%d", traceID, len(spans))

	// Debug: log span names
	spanNames := make([]string, len(spans))
	for i, span := range spans {
		spanNames[i] = span.OperationName
	}
	log.Printf("  Span names: %v", spanNames)

	// Evaluate trace-level rules
	matchedRuleIDs, err := s.engine.EvaluateTrace(ctx, traceID, spans)
	if err != nil {
		log.Printf("Error evaluating trace-level rules for trace %s: %v", traceID, err)
		return
	}

	log.Printf("Trace evaluation complete: trace_id=%s matched_rules=%d rule_ids=%v", traceID, len(matchedRuleIDs), matchedRuleIDs)

	// Create violations for matched trace-level rules
	for _, ruleID := range matchedRuleIDs {
		compiledRule, ok := s.engine.GetRule(ruleID)
		if !ok {
			continue
		}

		// Create violation
		violation := models.Violation{
			RuleID:   ruleID,
			RuleName: compiledRule.Rule.Name,
			Severity: compiledRule.Rule.Severity,
			Message:  fmt.Sprintf("Rule '%s' matched trace '%s' with %d spans", compiledRule.Rule.Name, traceID, len(spans)),
		}

		// Create span references for all spans in the trace
		spanRefs := make([]models.SpanRef, len(spans))
		for i, span := range spans {
			spanRefs[i] = models.SpanRef{
				TraceID:     span.TraceID,
				SpanID:      span.SpanID,
				ServiceName: span.ServiceName,
			}
		}

		// Record violation
		_, err := s.violationStore.Record(ctx, violation, spanRefs)
		if err != nil {
			log.Printf("Error recording trace-level violation for rule %s: %v", ruleID, err)
		} else {
			log.Printf("Trace-level violation recorded: rule=%s trace=%s spans=%d", ruleID, traceID, len(spans))
		}
	}
}
