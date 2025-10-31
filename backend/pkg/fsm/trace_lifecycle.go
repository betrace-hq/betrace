package fsm

import (
	"fmt"
	"sync"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// InvalidTraceTransitionError represents an invalid state transition for a trace
type InvalidTraceTransitionError struct {
	TraceID string
	From    TraceLifecycleState
	Event   TraceLifecycleEvent
}

func (e *InvalidTraceTransitionError) Error() string {
	return fmt.Sprintf("trace %s: invalid transition from %s via event %s",
		e.TraceID, e.From, e.Event)
}

// TraceLifecycleState represents the lifecycle state of a trace
type TraceLifecycleState int

const (
	// TraceReceiving - actively receiving spans
	TraceReceiving TraceLifecycleState = iota
	// TraceComplete - no more spans expected, ready for evaluation
	TraceComplete
	// TraceEvaluating - currently evaluating trace-level rules
	TraceEvaluating
	// TraceProcessed - evaluation complete, ready for cleanup
	TraceProcessed
)

// String returns the string representation of the state
func (s TraceLifecycleState) String() string {
	switch s {
	case TraceReceiving:
		return "receiving"
	case TraceComplete:
		return "complete"
	case TraceEvaluating:
		return "evaluating"
	case TraceProcessed:
		return "processed"
	default:
		return fmt.Sprintf("unknown(%d)", s)
	}
}

// TraceLifecycleEvent represents an event that triggers a state transition
type TraceLifecycleEvent int

const (
	// EventSpanReceived - new span added to trace
	EventSpanReceived TraceLifecycleEvent = iota
	// EventTimeout - no spans received for timeout duration
	EventTimeout
	// EventStartEvaluation - begin trace-level rule evaluation
	EventStartEvaluation
	// EventEvaluationComplete - trace-level evaluation finished
	EventEvaluationComplete
	// EventEvaluationFailed - evaluation encountered error
	EventEvaluationFailed
)

// String returns the string representation of the event
func (e TraceLifecycleEvent) String() string {
	switch e {
	case EventSpanReceived:
		return "span_received"
	case EventTimeout:
		return "timeout"
	case EventStartEvaluation:
		return "start_evaluation"
	case EventEvaluationComplete:
		return "evaluation_complete"
	case EventEvaluationFailed:
		return "evaluation_failed"
	default:
		return fmt.Sprintf("unknown(%d)", e)
	}
}

// TraceLifecycleFSM tracks the lifecycle state of a single trace
type TraceLifecycleFSM struct {
	mu            sync.Mutex
	traceID       string
	state         TraceLifecycleState
	previousState TraceLifecycleState
	spans         []*models.Span
}

// NewTraceLifecycleFSM creates a new trace lifecycle FSM
func NewTraceLifecycleFSM(traceID string) *TraceLifecycleFSM {
	return &TraceLifecycleFSM{
		traceID:       traceID,
		state:         TraceReceiving,
		previousState: TraceReceiving,
		spans:         make([]*models.Span, 0),
	}
}

// State returns the current state
func (fsm *TraceLifecycleFSM) State() TraceLifecycleState {
	fsm.mu.Lock()
	defer fsm.mu.Unlock()
	return fsm.state
}

// TraceID returns the trace ID
func (fsm *TraceLifecycleFSM) TraceID() string {
	return fsm.traceID
}

// Spans returns a copy of the current spans
func (fsm *TraceLifecycleFSM) Spans() []*models.Span {
	fsm.mu.Lock()
	defer fsm.mu.Unlock()

	// Return copy to prevent concurrent modification
	spansCopy := make([]*models.Span, len(fsm.spans))
	copy(spansCopy, fsm.spans)
	return spansCopy
}

// AddSpan adds a span to the trace and transitions to Receiving state
func (fsm *TraceLifecycleFSM) AddSpan(span *models.Span) error {
	fsm.mu.Lock()
	defer fsm.mu.Unlock()

	// Can only add spans in Receiving or Complete states
	if fsm.state != TraceReceiving && fsm.state != TraceComplete {
		return &InvalidTraceTransitionError{
			TraceID: fsm.traceID,
			From:    fsm.state,
			Event:   EventSpanReceived,
		}
	}

	fsm.spans = append(fsm.spans, span)
	fsm.previousState = fsm.state
	fsm.state = TraceReceiving
	return nil
}

// Transition attempts to transition the FSM to a new state based on an event
func (fsm *TraceLifecycleFSM) Transition(event TraceLifecycleEvent) error {
	fsm.mu.Lock()
	defer fsm.mu.Unlock()

	validTransitions := fsm.validTransitions()
	nextState, valid := validTransitions[fsm.state][event]

	if !valid {
		return &InvalidTraceTransitionError{
			TraceID: fsm.traceID,
			From:    fsm.state,
			Event:   event,
		}
	}

	// Invariant: Cannot start evaluation with zero spans
	if event == EventStartEvaluation && len(fsm.spans) == 0 {
		return &InvalidTraceTransitionError{
			TraceID: fsm.traceID,
			From:    fsm.state,
			Event:   event,
		}
	}

	fsm.previousState = fsm.state
	fsm.state = nextState
	return nil
}

// Rollback reverts to the previous state (used for error recovery)
func (fsm *TraceLifecycleFSM) Rollback() {
	fsm.mu.Lock()
	defer fsm.mu.Unlock()
	fsm.state = fsm.previousState
}

// validTransitions defines the state transition table
func (fsm *TraceLifecycleFSM) validTransitions() map[TraceLifecycleState]map[TraceLifecycleEvent]TraceLifecycleState {
	return map[TraceLifecycleState]map[TraceLifecycleEvent]TraceLifecycleState{
		TraceReceiving: {
			EventSpanReceived:    TraceReceiving, // Stay in receiving
			EventTimeout:         TraceComplete,  // No more spans expected
		},
		TraceComplete: {
			EventSpanReceived:       TraceReceiving,  // Late span arrival
			EventStartEvaluation:    TraceEvaluating, // Begin evaluation
		},
		TraceEvaluating: {
			EventEvaluationComplete: TraceProcessed,  // Success
			EventEvaluationFailed:   TraceComplete,   // Retry later
		},
		TraceProcessed: {
			// Terminal state - no transitions allowed
		},
	}
}

// ValidEvents returns the list of valid events for the current state
func (fsm *TraceLifecycleFSM) ValidEvents() []TraceLifecycleEvent {
	fsm.mu.Lock()
	defer fsm.mu.Unlock()

	transitions := fsm.validTransitions()[fsm.state]
	events := make([]TraceLifecycleEvent, 0, len(transitions))
	for event := range transitions {
		events = append(events, event)
	}
	return events
}

// TraceLifecycleRegistry manages multiple trace FSMs
type TraceLifecycleRegistry struct {
	mu     sync.RWMutex
	traces map[string]*TraceLifecycleFSM
}

// NewTraceLifecycleRegistry creates a new registry
func NewTraceLifecycleRegistry() *TraceLifecycleRegistry {
	return &TraceLifecycleRegistry{
		traces: make(map[string]*TraceLifecycleFSM),
	}
}

// Get returns the FSM for a trace ID, creating one if it doesn't exist
func (r *TraceLifecycleRegistry) Get(traceID string) *TraceLifecycleFSM {
	r.mu.Lock()
	defer r.mu.Unlock()

	if fsm, exists := r.traces[traceID]; exists {
		return fsm
	}

	// Create new FSM
	fsm := NewTraceLifecycleFSM(traceID)
	r.traces[traceID] = fsm
	return fsm
}

// Remove removes a trace FSM from the registry
func (r *TraceLifecycleRegistry) Remove(traceID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.traces, traceID)
}

// Count returns the number of tracked traces
func (r *TraceLifecycleRegistry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.traces)
}

// GetByState returns all traces in a specific state
func (r *TraceLifecycleRegistry) GetByState(state TraceLifecycleState) []*TraceLifecycleFSM {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var traces []*TraceLifecycleFSM
	for _, fsm := range r.traces {
		if fsm.State() == state {
			traces = append(traces, fsm)
		}
	}
	return traces
}
