package services

import (
	"context"
	"time"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	"github.com/betracehq/betrace/backend/internal/observability"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/pkg/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// RuleService implements the gRPC RuleService
type RuleService struct {
	pb.UnimplementedRuleServiceServer
	engine *rules.RuleEngine
}

// NewRuleService creates a new RuleService
func NewRuleService(engine *rules.RuleEngine) *RuleService {
	return &RuleService{engine: engine}
}

// ListRules returns all rules
func (s *RuleService) ListRules(ctx context.Context, req *pb.ListRulesRequest) (*pb.ListRulesResponse, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.ListRules")
	defer span.End()

	observability.Debug(ctx, "ListRules: enabled_only=%v severity=%s tags=%v",
		req.EnabledOnly, req.Severity, req.Tags)

	allRules := s.engine.ListRules()
	observability.Debug(ctx, "ListRules: found %d total rules", len(allRules))

	// Apply filters
	var filteredRules []*rules.CompiledRule
	for _, r := range allRules {
		if req.EnabledOnly && !r.Rule.Enabled {
			continue
		}
		if req.Severity != "" && r.Rule.Severity != req.Severity {
			continue
		}
		if len(req.Tags) > 0 {
			hasTag := false
			for _, reqTag := range req.Tags {
				for _, ruleTag := range r.Rule.Tags {
					if reqTag == ruleTag {
						hasTag = true
						break
					}
				}
				if hasTag {
					break
				}
			}
			if !hasTag {
				continue
			}
		}
		filteredRules = append(filteredRules, r)
	}

	// Convert to protobuf
	pbRules := make([]*pb.Rule, len(filteredRules))
	for i, r := range filteredRules {
		pbRules[i] = modelToProto(&r.Rule)
	}

	observability.Debug(ctx, "ListRules: returning %d filtered rules", len(pbRules))

	return &pb.ListRulesResponse{
		Rules:      pbRules,
		TotalCount: int32(len(pbRules)),
	}, nil
}

// GetRule returns a single rule by ID
func (s *RuleService) GetRule(ctx context.Context, req *pb.GetRuleRequest) (*pb.Rule, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.GetRule")
	defer span.End()

	observability.Debug(ctx, "GetRule: id=%s", req.Id)

	compiled, ok := s.engine.GetRule(req.Id)
	if !ok {
		observability.Warn(ctx, "GetRule: rule not found: %s", req.Id)
		return nil, status.Errorf(codes.NotFound, "rule not found: %s", req.Id)
	}

	return modelToProto(&compiled.Rule), nil
}

// CreateRule creates a new rule
func (s *RuleService) CreateRule(ctx context.Context, req *pb.CreateRuleRequest) (*pb.Rule, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.CreateRule")
	defer span.End()

	observability.Info(ctx, "CreateRule: name=%s expression=%s enabled=%v",
		req.Name, req.Expression, req.Enabled)

	id := req.Name

	rule := models.Rule{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Expression:  req.Expression,
		Enabled:     req.Enabled,
		Severity:    req.Severity,
		Tags:        req.Tags,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Validate rule against configured limits (defense in depth before parser)
	// TODO: Load limits from config
	limits := models.RuleLimits{
		MaxExpressionLength:  65536, // 64KB - allows pathological rules
		MaxDescriptionLength: 4096,  // 4KB
		MaxNameLength:        256,   // bytes
	}
	if err := rule.Validate(limits); err != nil {
		observability.Error(ctx, "CreateRule: validation failed: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "rule validation failed: %v", err)
	}

	if err := s.engine.LoadRuleWithObservability(ctx, rule); err != nil {
		observability.Error(ctx, "CreateRule: failed to compile rule: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "failed to compile rule: %v", err)
	}

	observability.EmitComplianceEvidence(ctx, observability.SOC2_CC8_1, "rule_created", map[string]interface{}{
		"rule_id":    rule.ID,
		"expression": rule.Expression,
	})

	observability.Info(ctx, "CreateRule: success id=%s", rule.ID)

	return modelToProto(&rule), nil
}

// UpdateRule updates an existing rule
func (s *RuleService) UpdateRule(ctx context.Context, req *pb.UpdateRuleRequest) (*pb.Rule, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.UpdateRule")
	defer span.End()

	observability.Info(ctx, "UpdateRule: id=%s", req.Id)

	_, ok := s.engine.GetRule(req.Id)
	if !ok {
		observability.Warn(ctx, "UpdateRule: rule not found: %s", req.Id)
		return nil, status.Errorf(codes.NotFound, "rule not found: %s", req.Id)
	}

	rule := models.Rule{
		ID:          req.Id,
		Name:        req.Name,
		Description: req.Description,
		Expression:  req.Expression,
		Enabled:     req.Enabled,
		Severity:    req.Severity,
		Tags:        req.Tags,
		UpdatedAt:   time.Now(),
	}

	// Validate rule against configured limits (defense in depth before parser)
	// TODO: Load limits from config
	limits := models.RuleLimits{
		MaxExpressionLength:  65536, // 64KB - allows pathological rules
		MaxDescriptionLength: 4096,  // 4KB
		MaxNameLength:        256,   // bytes
	}
	if err := rule.Validate(limits); err != nil {
		observability.Error(ctx, "UpdateRule: validation failed: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "rule validation failed: %v", err)
	}

	if err := s.engine.LoadRuleWithObservability(ctx, rule); err != nil {
		observability.Error(ctx, "UpdateRule: failed to compile rule: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "failed to compile rule: %v", err)
	}

	observability.EmitComplianceEvidence(ctx, observability.SOC2_CC8_1, "rule_updated", map[string]interface{}{
		"rule_id":    rule.ID,
		"expression": rule.Expression,
	})

	return modelToProto(&rule), nil
}

// DeleteRule deletes a rule
func (s *RuleService) DeleteRule(ctx context.Context, req *pb.DeleteRuleRequest) (*pb.DeleteRuleResponse, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.DeleteRule")
	defer span.End()

	observability.Info(ctx, "DeleteRule: id=%s", req.Id)

	_, ok := s.engine.GetRule(req.Id)
	if !ok {
		observability.Warn(ctx, "DeleteRule: rule not found: %s", req.Id)
		return nil, status.Errorf(codes.NotFound, "rule not found: %s", req.Id)
	}

	s.engine.DeleteRule(req.Id)

	observability.EmitComplianceEvidence(ctx, observability.SOC2_CC8_1, "rule_deleted", map[string]interface{}{
		"rule_id": req.Id,
	})

	return &pb.DeleteRuleResponse{Success: true}, nil
}

// EnableRule enables a disabled rule
func (s *RuleService) EnableRule(ctx context.Context, req *pb.EnableRuleRequest) (*pb.Rule, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.EnableRule")
	defer span.End()

	observability.Info(ctx, "EnableRule: id=%s", req.Id)

	compiled, ok := s.engine.GetRule(req.Id)
	if !ok {
		return nil, status.Errorf(codes.NotFound, "rule not found: %s", req.Id)
	}

	rule := compiled.Rule
	rule.Enabled = true
	rule.UpdatedAt = time.Now()

	if err := s.engine.LoadRuleWithObservability(ctx, rule); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to enable rule: %v", err)
	}

	return modelToProto(&rule), nil
}

// DisableRule disables an enabled rule
func (s *RuleService) DisableRule(ctx context.Context, req *pb.DisableRuleRequest) (*pb.Rule, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.DisableRule")
	defer span.End()

	observability.Info(ctx, "DisableRule: id=%s", req.Id)

	compiled, ok := s.engine.GetRule(req.Id)
	if !ok {
		return nil, status.Errorf(codes.NotFound, "rule not found: %s", req.Id)
	}

	rule := compiled.Rule
	rule.Enabled = false
	rule.UpdatedAt = time.Now()

	if err := s.engine.LoadRuleWithObservability(ctx, rule); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to disable rule: %v", err)
	}

	return modelToProto(&rule), nil
}

// Helper: Convert models.Rule to pb.Rule
func modelToProto(r *models.Rule) *pb.Rule {
	return &pb.Rule{
		Id:          r.ID,
		Name:        r.Name,
		Description: r.Description,
		Expression:  r.Expression,
		Enabled:     r.Enabled,
		Severity:    r.Severity,
		Tags:        r.Tags,
		CreatedAt:   timestamppb.New(r.CreatedAt),
		UpdatedAt:   timestamppb.New(r.UpdatedAt),
	}
}
