package fsm

import (
	"fmt"
	"sync"
)

// RuleLifecycleState represents all possible states in a rule's lifecycle
type RuleLifecycleState int

const (
	// RuleNonExistent: Rule doesn't exist (initial state)
	RuleNonExistent RuleLifecycleState = iota

	// RuleDraft: Rule created/updated but not validated
	RuleDraft

	// RuleValidated: Rule passed validation but not compiled
	RuleValidated

	// RuleCompiled: Rule loaded into engine but not persisted
	RuleCompiled

	// RulePersisted: Rule saved to disk (stable state)
	RulePersisted

	// RuleUpdating: Update in progress (prevents concurrent delete)
	RuleUpdating

	// RuleDeleting: Delete in progress (prevents concurrent modifications)
	RuleDeleting
)

// String returns human-readable state name
func (s RuleLifecycleState) String() string {
	switch s {
	case RuleNonExistent:
		return "nonexistent"
	case RuleDraft:
		return "draft"
	case RuleValidated:
		return "validated"
	case RuleCompiled:
		return "compiled"
	case RulePersisted:
		return "persisted"
	case RuleUpdating:
		return "updating"
	case RuleDeleting:
		return "deleting"
	default:
		return fmt.Sprintf("unknown(%d)", s)
	}
}

// RuleLifecycleEvent represents events that trigger state transitions
type RuleLifecycleEvent int

const (
	EventCreate RuleLifecycleEvent = iota
	EventValidate
	EventValidationFailed
	EventCompile
	EventCompilationFailed
	EventPersist
	EventPersistenceFailed
	EventUpdate
	EventDelete
	EventDeleteComplete
	EventDeleteFailed
	EventCancel
)

func (e RuleLifecycleEvent) String() string {
	switch e {
	case EventCreate:
		return "create"
	case EventValidate:
		return "validate"
	case EventValidationFailed:
		return "validation_failed"
	case EventCompile:
		return "compile"
	case EventCompilationFailed:
		return "compilation_failed"
	case EventPersist:
		return "persist"
	case EventPersistenceFailed:
		return "persistence_failed"
	case EventUpdate:
		return "update"
	case EventDelete:
		return "delete"
	case EventDeleteComplete:
		return "delete_complete"
	case EventDeleteFailed:
		return "delete_failed"
	case EventCancel:
		return "cancel"
	default:
		return fmt.Sprintf("unknown_event(%d)", e)
	}
}

// InvalidTransitionError indicates an illegal state transition
type InvalidTransitionError struct {
	RuleID string
	From   RuleLifecycleState
	Event  RuleLifecycleEvent
}

func (e *InvalidTransitionError) Error() string {
	return fmt.Sprintf("rule %s: invalid transition from %s via event %s",
		e.RuleID, e.From, e.Event)
}

// RuleLifecycleFSM manages the lifecycle state of a single rule
type RuleLifecycleFSM struct {
	ruleID string
	state  RuleLifecycleState
	mu     sync.RWMutex

	// Snapshot for rollback
	previousState RuleLifecycleState
}

// NewRuleLifecycleFSM creates a new FSM for a rule
func NewRuleLifecycleFSM(ruleID string) *RuleLifecycleFSM {
	return &RuleLifecycleFSM{
		ruleID:        ruleID,
		state:         RuleNonExistent,
		previousState: RuleNonExistent,
	}
}

// State returns the current state (thread-safe)
func (fsm *RuleLifecycleFSM) State() RuleLifecycleState {
	fsm.mu.RLock()
	defer fsm.mu.RUnlock()
	return fsm.state
}

// Transition attempts a state transition via an event
// Returns error if transition is invalid for current state
func (fsm *RuleLifecycleFSM) Transition(event RuleLifecycleEvent) error {
	fsm.mu.Lock()
	defer fsm.mu.Unlock()

	nextState, valid := fsm.validTransitions()[fsm.state][event]
	if !valid {
		return &InvalidTransitionError{
			RuleID: fsm.ruleID,
			From:   fsm.state,
			Event:  event,
		}
	}

	fsm.previousState = fsm.state
	fsm.state = nextState
	return nil
}

// Rollback returns to previous state (used when operations fail)
func (fsm *RuleLifecycleFSM) Rollback() {
	fsm.mu.Lock()
	defer fsm.mu.Unlock()

	fsm.state = fsm.previousState
}

// ValidEvents returns events that are legal for current state
func (fsm *RuleLifecycleFSM) ValidEvents() []RuleLifecycleEvent {
	fsm.mu.RLock()
	defer fsm.mu.RUnlock()

	validMap := fsm.validTransitions()[fsm.state]
	events := make([]RuleLifecycleEvent, 0, len(validMap))
	for event := range validMap {
		events = append(events, event)
	}
	return events
}

// validTransitions defines the state machine transition table
// Maps: CurrentState -> Event -> NextState
func (fsm *RuleLifecycleFSM) validTransitions() map[RuleLifecycleState]map[RuleLifecycleEvent]RuleLifecycleState {
	return map[RuleLifecycleState]map[RuleLifecycleEvent]RuleLifecycleState{
		RuleNonExistent: {
			EventCreate: RuleDraft,
		},
		RuleDraft: {
			EventValidate:         RuleValidated,
			EventValidationFailed: RuleNonExistent, // Validation failed, discard
			EventCancel:           RuleNonExistent,
		},
		RuleValidated: {
			EventCompile:           RuleCompiled,
			EventCompilationFailed: RuleDraft, // Retry from draft
			EventCancel:            RuleNonExistent,
		},
		RuleCompiled: {
			EventPersist:           RulePersisted,
			EventPersistenceFailed: RuleValidated, // Retry persistence
		},
		RulePersisted: {
			EventUpdate: RuleUpdating, // Enter updating state (prevents concurrent delete)
			EventDelete: RuleDeleting,  // Enter deleting state (prevents concurrent update)
		},
		RuleUpdating: {
			EventValidate:         RuleValidated,
			EventValidationFailed: RulePersisted, // Rollback on validation failure
			EventCancel:           RulePersisted,
		},
		RuleDeleting: {
			EventDeleteComplete: RuleNonExistent,
			EventDeleteFailed:   RulePersisted, // Rollback on delete failure
		},
	}
}

// RuleLifecycleRegistry manages FSMs for all rules
type RuleLifecycleRegistry struct {
	mu   sync.RWMutex
	fsms map[string]*RuleLifecycleFSM
}

// NewRuleLifecycleRegistry creates a registry for tracking rule FSMs
func NewRuleLifecycleRegistry() *RuleLifecycleRegistry {
	return &RuleLifecycleRegistry{
		fsms: make(map[string]*RuleLifecycleFSM),
	}
}

// Get retrieves or creates an FSM for a rule
func (r *RuleLifecycleRegistry) Get(ruleID string) *RuleLifecycleFSM {
	r.mu.Lock()
	defer r.mu.Unlock()

	if fsm, exists := r.fsms[ruleID]; exists {
		return fsm
	}

	fsm := NewRuleLifecycleFSM(ruleID)
	r.fsms[ruleID] = fsm
	return fsm
}

// Remove removes a rule's FSM (called after successful deletion)
func (r *RuleLifecycleRegistry) Remove(ruleID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.fsms, ruleID)
}

// Snapshot returns the current state of all rules (for debugging)
func (r *RuleLifecycleRegistry) Snapshot() map[string]RuleLifecycleState {
	r.mu.RLock()
	defer r.mu.RUnlock()

	snapshot := make(map[string]RuleLifecycleState, len(r.fsms))
	for ruleID, fsm := range r.fsms {
		snapshot[ruleID] = fsm.State()
	}
	return snapshot
}
