package services

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/betracehq/betrace/backend/pkg/fsm"
	"github.com/betracehq/betrace/backend/pkg/models"
)

// TraceBufferFSM is a trace buffer enhanced with FSM state tracking
// This prevents race conditions between:
// - Adding spans to a trace
// - Marking trace as complete
// - Evaluating trace-level rules
type TraceBufferFSM struct {
	mu sync.RWMutex

	// FSM registry tracks state of each trace
	registry *fsm.TraceLifecycleRegistry

	// lastActivity maps trace_id -> last span received time
	lastActivity map[string]time.Time

	// completionTimeout is how long to wait after last span before considering trace complete
	completionTimeout time.Duration

	// onTraceComplete is called when a trace is considered complete
	onTraceComplete func(ctx context.Context, traceID string, spans []*models.Span)

	// stopCh is used to signal the cleanup goroutine to stop
	stopCh chan struct{}
}

// NewTraceBufferFSM creates a new FSM-enhanced trace buffer
func NewTraceBufferFSM(completionTimeout time.Duration, onTraceComplete func(ctx context.Context, traceID string, spans []*models.Span)) *TraceBufferFSM {
	tb := &TraceBufferFSM{
		registry:          fsm.NewTraceLifecycleRegistry(),
		lastActivity:      make(map[string]time.Time),
		completionTimeout: completionTimeout,
		onTraceComplete:   onTraceComplete,
		stopCh:            make(chan struct{}),
	}

	// Start background goroutine to detect completed traces
	go tb.cleanupLoop()

	return tb
}

// AddSpan adds a span to the trace buffer with FSM state tracking
func (tb *TraceBufferFSM) AddSpan(span *models.Span) error {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	traceID := span.TraceID

	// Get or create FSM for this trace
	traceFSM := tb.registry.Get(traceID)

	// FSM prevents adding spans during evaluation
	if err := traceFSM.AddSpan(span); err != nil {
		log.Printf("Cannot add span to trace %s (state: %s): %v",
			traceID, traceFSM.State(), err)
		return err
	}

	// Update last activity time
	tb.lastActivity[traceID] = time.Now()
	return nil
}

// cleanupLoop runs in background and detects completed traces
func (tb *TraceBufferFSM) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			tb.checkCompletedTraces()
		case <-tb.stopCh:
			return
		}
	}
}

// checkCompletedTraces finds traces that haven't received spans recently and marks them complete
func (tb *TraceBufferFSM) checkCompletedTraces() {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()

	// Find traces that have timed out
	for traceID, lastActivity := range tb.lastActivity {
		if now.Sub(lastActivity) < tb.completionTimeout {
			continue
		}

		traceFSM := tb.registry.Get(traceID)

		// Try to transition to Complete state
		if err := traceFSM.Transition(fsm.EventTimeout); err != nil {
			// Trace might already be evaluating or processed
			log.Printf("Cannot mark trace %s as complete (state: %s): %v",
				traceID, traceFSM.State(), err)
			continue
		}

		// Try to start evaluation
		if err := traceFSM.Transition(fsm.EventStartEvaluation); err != nil {
			log.Printf("Cannot start evaluation for trace %s (state: %s): %v",
				traceID, traceFSM.State(), err)
			continue
		}

		// Get spans before evaluation
		spans := traceFSM.Spans()

		// Remove from activity tracking
		delete(tb.lastActivity, traceID)

		// Call completion callback in goroutine
		// FSM prevents concurrent AddSpan during evaluation
		if tb.onTraceComplete != nil {
			go func(tid string, s []*models.Span, tfsm *fsm.TraceLifecycleFSM) {
				tb.onTraceComplete(context.Background(), tid, s)

				// Mark evaluation complete
				if err := tfsm.Transition(fsm.EventEvaluationComplete); err != nil {
					log.Printf("Failed to mark evaluation complete for trace %s: %v", tid, err)
				} else {
					// Clean up FSM
					tb.registry.Remove(tid)
				}
			}(traceID, spans, traceFSM)
		}
	}
}

// Stop stops the trace buffer's background goroutine
func (tb *TraceBufferFSM) Stop() {
	close(tb.stopCh)
}

// GetTrace returns all spans for a trace (mainly for testing)
func (tb *TraceBufferFSM) GetTrace(traceID string) []*models.Span {
	tb.mu.RLock()
	defer tb.mu.RUnlock()

	traceFSM := tb.registry.Get(traceID)
	return traceFSM.Spans()
}

// GetState returns the FSM state for a trace (for testing/debugging)
func (tb *TraceBufferFSM) GetState(traceID string) fsm.TraceLifecycleState {
	traceFSM := tb.registry.Get(traceID)
	return traceFSM.State()
}
