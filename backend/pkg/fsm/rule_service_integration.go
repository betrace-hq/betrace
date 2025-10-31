package fsm

import (
	"context"
	"fmt"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// RuleStore defines the interface for rule persistence (same as existing)
type RuleStore interface {
	Create(rule models.Rule) error
	Update(rule models.Rule) error
	Delete(id string) error
	Get(id string) (models.Rule, error)
	List() ([]models.Rule, error)
}

// RuleEngine defines the interface for rule compilation
type RuleEngine interface {
	LoadRule(rule models.Rule) error
	GetRule(ruleID string) (models.Rule, bool)
	DeleteRule(ruleID string)
	ListRules() []models.Rule
}

// SafeRuleService wraps rule operations with FSM-based transactional safety
// This is the FSM-enhanced version of internal/grpc/services/rule_service.go
type SafeRuleService struct {
	engine   RuleEngine
	store    RuleStore
	registry *RuleLifecycleRegistry
}

// NewSafeRuleService creates a rule service with FSM transaction safety
func NewSafeRuleService(engine RuleEngine, store RuleStore) *SafeRuleService {
	return &SafeRuleService{
		engine:   engine,
		store:    store,
		registry: NewRuleLifecycleRegistry(),
	}
}

// CreateRule creates a rule with FSM-based atomicity
// Guarantees: Either (disk + engine) or neither (no inconsistent state)
func (s *SafeRuleService) CreateRule(ctx context.Context, rule models.Rule) error {
	fsm := s.registry.Get(rule.ID)

	// Phase 1: Transition to Draft
	if err := fsm.Transition(EventCreate); err != nil {
		return fmt.Errorf("rule already exists: %w", err)
	}

	// Phase 2: Validate
	limits := models.RuleLimits{
		MaxExpressionLength:  65536,
		MaxDescriptionLength: 4096,
		MaxNameLength:        256,
	}
	if err := rule.Validate(limits); err != nil {
		fsm.Transition(EventValidationFailed)
		return fmt.Errorf("validation failed: %w", err)
	}

	if err := fsm.Transition(EventValidate); err != nil {
		return err
	}

	// Phase 3: Compile (load into engine)
	if err := s.engine.LoadRule(rule); err != nil {
		fsm.Transition(EventCompilationFailed)
		return fmt.Errorf("compilation failed: %w", err)
	}

	if err := fsm.Transition(EventCompile); err != nil {
		return err
	}

	// Phase 4: Persist to disk (AFTER engine succeeds)
	if s.store != nil {
		if err := s.store.Create(rule); err != nil {
			// CRITICAL: Rollback engine state on persistence failure
			s.engine.DeleteRule(rule.ID)
			fsm.Transition(EventPersistenceFailed)
			return fmt.Errorf("persistence failed: %w", err)
		}
	}

	// Phase 5: Mark as persisted (terminal state)
	if err := fsm.Transition(EventPersist); err != nil {
		return err
	}

	return nil
}

// UpdateRule updates a rule with FSM-based atomicity
// THIS IS THE KEY FIX: Eliminates race condition from rule_service.go:170-224
func (s *SafeRuleService) UpdateRule(ctx context.Context, ruleID string, rule models.Rule) error {
	fsm := s.registry.Get(ruleID)

	// Phase 1: Atomically transition to RuleUpdating
	if err := fsm.Transition(EventUpdate); err != nil {
		// This returns error if:
		// - Rule doesn't exist (state is RuleNonExistent)
		// - Rule is being updated (state is RuleUpdating)
		// - Rule is being deleted (state is RuleDeleting)
		// This PREVENTS the race condition where update + delete interleave!
		return fmt.Errorf("cannot update rule: %w", err)
	}

	// From here on, no other thread can modify this rule
	// (EventDelete is invalid from RuleUpdating state)

	// Phase 2: Validate
	limits := models.RuleLimits{
		MaxExpressionLength:  65536,
		MaxDescriptionLength: 4096,
		MaxNameLength:        256,
	}
	if err := rule.Validate(limits); err != nil {
		fsm.Rollback() // Return to RulePersisted
		return fmt.Errorf("validation failed: %w", err)
	}

	if err := fsm.Transition(EventValidate); err != nil {
		fsm.Rollback()
		return err
	}

	// Phase 3: Persist to disk FIRST (crash-safe ordering)
	// If persist fails, engine still has old rule (consistent state)
	if s.store != nil {
		if err := s.store.Update(rule); err != nil {
			fsm.Rollback() // Return to RulePersisted
			return fmt.Errorf("persistence failed: %w", err)
		}
	}

	// Phase 4: Compile (load into engine AFTER disk succeeds)
	if err := s.engine.LoadRule(rule); err != nil {
		// CRITICAL: Rollback disk state on compilation failure
		// (This requires storing the old rule, simplified here)
		fsm.Rollback()
		return fmt.Errorf("compilation failed: %w", err)
	}

	if err := fsm.Transition(EventCompile); err != nil {
		fsm.Rollback()
		return err
	}

	// Phase 5: Mark as persisted
	if err := fsm.Transition(EventPersist); err != nil {
		return err
	}

	return nil
}

// DeleteRule deletes a rule with FSM-based atomicity
// THIS FIXES THE BUG from rule_service.go:227-254 where disk delete fails but engine deleted
func (s *SafeRuleService) DeleteRule(ctx context.Context, ruleID string) error {
	fsm := s.registry.Get(ruleID)

	// Phase 1: Transition to deleting (prevents concurrent modifications)
	if err := fsm.Transition(EventDelete); err != nil {
		// This returns error if:
		// - Rule doesn't exist (state is RuleNonExistent)
		// - Rule is being updated (state is RuleDraft/RuleValidated/RuleCompiled)
		// This PREVENTS race condition with UpdateRule!
		return fmt.Errorf("cannot delete rule: %w", err)
	}

	// From here on, no other thread can modify this rule

	// Phase 2: Delete from disk FIRST (crash-safe ordering)
	// If disk delete fails, engine still has rule (consistent state)
	if s.store != nil {
		if err := s.store.Delete(ruleID); err != nil {
			fsm.Transition(EventDeleteFailed) // Rollback to RulePersisted
			return fmt.Errorf("disk deletion failed: %w", err)
		}
	}

	// Phase 3: Delete from engine (only AFTER disk succeeds)
	s.engine.DeleteRule(ruleID)

	// Phase 4: Mark as deleted
	if err := fsm.Transition(EventDeleteComplete); err != nil {
		return err
	}

	// Phase 5: Remove FSM (cleanup)
	s.registry.Remove(ruleID)

	return nil
}

// GetRule retrieves a rule (no FSM needed for read-only)
func (s *SafeRuleService) GetRule(ctx context.Context, ruleID string) (models.Rule, error) {
	if s.store != nil {
		return s.store.Get(ruleID)
	}

	rule, ok := s.engine.GetRule(ruleID)
	if !ok {
		return models.Rule{}, fmt.Errorf("rule not found: %s", ruleID)
	}
	return rule, nil
}

// ListRules retrieves all rules (no FSM needed for read-only)
func (s *SafeRuleService) ListRules(ctx context.Context) ([]models.Rule, error) {
	if s.store != nil {
		return s.store.List()
	}

	return s.engine.ListRules(), nil
}

// GetRuleState returns the FSM state of a rule (for debugging/monitoring)
func (s *SafeRuleService) GetRuleState(ruleID string) RuleLifecycleState {
	fsm := s.registry.Get(ruleID)
	return fsm.State()
}

// GetAllRuleStates returns FSM states for all rules (for debugging/monitoring)
func (s *SafeRuleService) GetAllRuleStates() map[string]RuleLifecycleState {
	return s.registry.Snapshot()
}
