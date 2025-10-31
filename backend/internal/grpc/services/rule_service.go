package services

import (
	"context"
	"time"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	"github.com/betracehq/betrace/backend/internal/observability"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/pkg/fsm"
	"github.com/betracehq/betrace/backend/pkg/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// RuleStore is the interface for persisting rules
type RuleStore interface {
	Create(rule models.Rule) error
	Update(rule models.Rule) error
	Delete(id string) error
	Get(id string) (models.Rule, error)
	List() ([]models.Rule, error)
}

// RuleService implements the gRPC RuleService with FSM-based race condition protection
type RuleService struct {
	pb.UnimplementedRuleServiceServer
	engine   *rules.RuleEngine
	store    RuleStore // Optional: nil means no persistence
	registry *fsm.RuleLifecycleRegistry // FSM state tracking to prevent race conditions
}

// NewRuleService creates a new RuleService with FSM protection
func NewRuleService(engine *rules.RuleEngine, store RuleStore) *RuleService {
	return &RuleService{
		engine:   engine,
		store:    store,
		registry: fsm.NewRuleLifecycleRegistry(),
	}
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

// CreateRule creates a new rule with FSM-based atomicity
func (s *RuleService) CreateRule(ctx context.Context, req *pb.CreateRuleRequest) (*pb.Rule, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.CreateRule")
	defer span.End()

	observability.Info(ctx, "CreateRule: name=%s expression=%s enabled=%v",
		req.Name, req.Expression, req.Enabled)

	id := req.Name
	ruleFSM := s.registry.Get(id)

	// Phase 1: Transition to Draft state (prevents concurrent creates)
	if err := ruleFSM.Transition(fsm.EventCreate); err != nil {
		observability.Error(ctx, "CreateRule: rule already exists: %v", err)
		return nil, status.Errorf(codes.AlreadyExists, "rule already exists: %s", id)
	}

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

	// Phase 2: Validate
	limits := models.RuleLimits{
		MaxExpressionLength:  65536,
		MaxDescriptionLength: 4096,
		MaxNameLength:        256,
	}
	if err := rule.Validate(limits); err != nil {
		ruleFSM.Transition(fsm.EventValidationFailed)
		observability.Error(ctx, "CreateRule: validation failed: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "rule validation failed: %v", err)
	}

	if err := ruleFSM.Transition(fsm.EventValidate); err != nil {
		return nil, status.Errorf(codes.Internal, "FSM transition failed: %v", err)
	}

	// Phase 3: Compile
	if err := s.engine.LoadRuleWithObservability(ctx, rule); err != nil {
		ruleFSM.Transition(fsm.EventCompilationFailed)
		observability.Error(ctx, "CreateRule: failed to compile rule: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "failed to compile rule: %v", err)
	}

	if err := ruleFSM.Transition(fsm.EventCompile); err != nil {
		return nil, status.Errorf(codes.Internal, "FSM transition failed: %v", err)
	}

	// Phase 4: Persist to disk (AFTER engine succeeds)
	if s.store != nil {
		if err := s.store.Create(rule); err != nil {
			// CRITICAL: Rollback engine state on persistence failure
			s.engine.DeleteRule(rule.ID)
			ruleFSM.Transition(fsm.EventPersistenceFailed)
			observability.Error(ctx, "CreateRule: failed to persist rule: %v", err)
			return nil, status.Errorf(codes.Internal, "failed to persist rule: %v", err)
		}
	}

	// Phase 5: Mark as persisted (terminal state)
	if err := ruleFSM.Transition(fsm.EventPersist); err != nil {
		return nil, status.Errorf(codes.Internal, "FSM transition failed: %v", err)
	}

	observability.EmitComplianceEvidence(ctx, observability.SOC2_CC8_1, "rule_created", map[string]interface{}{
		"rule_id":    rule.ID,
		"expression": rule.Expression,
	})

	observability.Info(ctx, "CreateRule: success id=%s", rule.ID)

	return modelToProto(&rule), nil
}

// UpdateRule updates an existing rule with FSM-based atomicity
// FIXES: Bug #1 (race condition) and Bug #2 (engine updated despite disk failure)
func (s *RuleService) UpdateRule(ctx context.Context, req *pb.UpdateRuleRequest) (*pb.Rule, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.UpdateRule")
	defer span.End()

	observability.Info(ctx, "UpdateRule: id=%s", req.Id)

	ruleFSM := s.registry.Get(req.Id)

	// Phase 1: Atomically transition to RuleUpdating
	// FIXES Bug #1: This blocks concurrent Delete operations
	if err := ruleFSM.Transition(fsm.EventUpdate); err != nil {
		observability.Warn(ctx, "UpdateRule: cannot update rule (state: %v): %v", ruleFSM.State(), err)
		return nil, status.Errorf(codes.FailedPrecondition, "cannot update rule: %v", err)
	}

	// From here, no other thread can delete this rule
	// (EventDelete is invalid from RuleUpdating state)

	// Save old rule for rollback on failure
	oldRule, ok := s.engine.GetRule(req.Id)
	if !ok {
		ruleFSM.Rollback()
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

	// Phase 2: Validate
	limits := models.RuleLimits{
		MaxExpressionLength:  65536,
		MaxDescriptionLength: 4096,
		MaxNameLength:        256,
	}
	if err := rule.Validate(limits); err != nil {
		ruleFSM.Rollback() // Return to RulePersisted
		observability.Error(ctx, "UpdateRule: validation failed: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "rule validation failed: %v", err)
	}

	if err := ruleFSM.Transition(fsm.EventValidate); err != nil {
		ruleFSM.Rollback()
		return nil, status.Errorf(codes.Internal, "FSM transition failed: %v", err)
	}

	// Phase 3: Compile
	if err := s.engine.LoadRuleWithObservability(ctx, rule); err != nil {
		ruleFSM.Transition(fsm.EventCompilationFailed)
		observability.Error(ctx, "UpdateRule: failed to compile rule: %v", err)
		return nil, status.Errorf(codes.InvalidArgument, "failed to compile rule: %v", err)
	}

	if err := ruleFSM.Transition(fsm.EventCompile); err != nil {
		ruleFSM.Rollback()
		return nil, status.Errorf(codes.Internal, "FSM transition failed: %v", err)
	}

	// Phase 4: Persist to disk (AFTER compilation succeeds)
	// FIXES Bug #2: Disk write happens AFTER engine update, with rollback on failure
	if s.store != nil {
		if err := s.store.Update(rule); err != nil {
			// CRITICAL: Rollback engine to old state
			s.engine.LoadRule(oldRule.Rule)
			ruleFSM.Transition(fsm.EventPersistenceFailed)
			observability.Error(ctx, "UpdateRule: failed to persist rule (rolled back): %v", err)
			return nil, status.Errorf(codes.Internal, "failed to persist rule: %v", err)
		}
	}

	// Phase 5: Mark as persisted
	if err := ruleFSM.Transition(fsm.EventPersist); err != nil {
		return nil, status.Errorf(codes.Internal, "FSM transition failed: %v", err)
	}

	observability.EmitComplianceEvidence(ctx, observability.SOC2_CC8_1, "rule_updated", map[string]interface{}{
		"rule_id":    rule.ID,
		"expression": rule.Expression,
	})

	return modelToProto(&rule), nil
}

// DeleteRule deletes a rule with FSM-based atomicity
// FIXES: Bug #1 (race condition with UpdateRule)
func (s *RuleService) DeleteRule(ctx context.Context, req *pb.DeleteRuleRequest) (*pb.DeleteRuleResponse, error) {
	ctx, span := observability.Tracer.Start(ctx, "RuleService.DeleteRule")
	defer span.End()

	observability.Info(ctx, "DeleteRule: id=%s", req.Id)

	ruleFSM := s.registry.Get(req.Id)

	// Phase 1: Atomically transition to RuleDeleting
	// FIXES Bug #1: This blocks concurrent Update operations
	if err := ruleFSM.Transition(fsm.EventDelete); err != nil {
		observability.Warn(ctx, "DeleteRule: cannot delete rule (state: %v): %v", ruleFSM.State(), err)
		return nil, status.Errorf(codes.FailedPrecondition, "cannot delete rule: %v", err)
	}

	// From here, no other thread can update this rule
	// (EventUpdate is invalid from RuleDeleting state)

	// Phase 2: Delete from disk FIRST (crash-safe ordering)
	if s.store != nil {
		if err := s.store.Delete(req.Id); err != nil {
			ruleFSM.Transition(fsm.EventDeleteFailed) // Rollback to RulePersisted
			observability.Error(ctx, "DeleteRule: failed to persist deletion: %v", err)
			return nil, status.Errorf(codes.Internal, "failed to delete rule from disk: %v", err)
		}
	}

	// Phase 3: Delete from engine (only AFTER disk succeeds)
	s.engine.DeleteRule(req.Id)

	// Phase 4: Mark as deleted
	if err := ruleFSM.Transition(fsm.EventDeleteComplete); err != nil {
		return nil, status.Errorf(codes.Internal, "FSM transition failed: %v", err)
	}

	// Phase 5: Remove FSM (cleanup)
	s.registry.Remove(req.Id)

	observability.EmitComplianceEvidence(ctx, observability.SOC2_CC8_1, "rule_deleted", map[string]interface{}{
		"rule_id": req.Id,
	})

	return &pb.DeleteRuleResponse{Success: true}, nil
}

// EnableRule enables a disabled rule
// FIXES: Bug #3 (enable/disable not persisted to disk)
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

	// FIXES Bug #3: Persist to disk FIRST (crash-safe)
	if s.store != nil {
		if err := s.store.Update(rule); err != nil {
			observability.Error(ctx, "EnableRule: failed to persist: %v", err)
			return nil, status.Errorf(codes.Internal, "failed to persist enable state: %v", err)
		}
	}

	// Load into engine AFTER disk succeeds
	if err := s.engine.LoadRuleWithObservability(ctx, rule); err != nil {
		// Rollback disk state (need old rule for full rollback)
		observability.Error(ctx, "EnableRule: failed to load rule: %v", err)
		return nil, status.Errorf(codes.Internal, "failed to enable rule: %v", err)
	}

	return modelToProto(&rule), nil
}

// DisableRule disables an enabled rule
// FIXES: Bug #3 (enable/disable not persisted to disk)
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

	// FIXES Bug #3: Persist to disk FIRST (crash-safe)
	if s.store != nil {
		if err := s.store.Update(rule); err != nil {
			observability.Error(ctx, "DisableRule: failed to persist: %v", err)
			return nil, status.Errorf(codes.Internal, "failed to persist disable state: %v", err)
		}
	}

	// Load into engine AFTER disk succeeds
	if err := s.engine.LoadRuleWithObservability(ctx, rule); err != nil {
		// Rollback disk state (need old rule for full rollback)
		observability.Error(ctx, "DisableRule: failed to load rule: %v", err)
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
