package fsm

import (
	"sync"
	"testing"
	"time"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// TestTraceLifecycleFSM_BasicTransitions tests valid state transitions
func TestTraceLifecycleFSM_BasicTransitions(t *testing.T) {
	fsm := NewTraceLifecycleFSM("trace-123")

	// Start in Receiving state
	if fsm.State() != TraceReceiving {
		t.Errorf("Expected initial state=Receiving, got %s", fsm.State())
	}

	// Receive span - stay in Receiving
	span := &models.Span{SpanID: "span-1", TraceID: "trace-123"}
	if err := fsm.AddSpan(span); err != nil {
		t.Fatalf("Failed to add span: %v", err)
	}

	if fsm.State() != TraceReceiving {
		t.Errorf("Expected state=Receiving after AddSpan, got %s", fsm.State())
	}

	// Timeout - transition to Complete
	if err := fsm.Transition(EventTimeout); err != nil {
		t.Fatalf("Failed to transition on timeout: %v", err)
	}

	if fsm.State() != TraceComplete {
		t.Errorf("Expected state=Complete after timeout, got %s", fsm.State())
	}

	// Start evaluation
	if err := fsm.Transition(EventStartEvaluation); err != nil {
		t.Fatalf("Failed to start evaluation: %v", err)
	}

	if fsm.State() != TraceEvaluating {
		t.Errorf("Expected state=Evaluating, got %s", fsm.State())
	}

	// Complete evaluation
	if err := fsm.Transition(EventEvaluationComplete); err != nil {
		t.Fatalf("Failed to complete evaluation: %v", err)
	}

	if fsm.State() != TraceProcessed {
		t.Errorf("Expected state=Processed, got %s", fsm.State())
	}
}

// TestTraceLifecycleFSM_LateSpanArrival tests handling of late spans
func TestTraceLifecycleFSM_LateSpanArrival(t *testing.T) {
	fsm := NewTraceLifecycleFSM("trace-123")

	// Add initial span
	span1 := &models.Span{SpanID: "span-1", TraceID: "trace-123"}
	fsm.AddSpan(span1)

	// Timeout - mark complete
	fsm.Transition(EventTimeout)

	if fsm.State() != TraceComplete {
		t.Fatalf("Expected state=Complete, got %s", fsm.State())
	}

	// Late span arrives - should transition back to Receiving
	span2 := &models.Span{SpanID: "span-2", TraceID: "trace-123"}
	if err := fsm.AddSpan(span2); err != nil {
		t.Fatalf("Failed to add late span: %v", err)
	}

	if fsm.State() != TraceReceiving {
		t.Errorf("Expected state=Receiving after late span, got %s", fsm.State())
	}

	// Verify both spans are tracked
	spans := fsm.Spans()
	if len(spans) != 2 {
		t.Errorf("Expected 2 spans, got %d", len(spans))
	}
}

// TestTraceLifecycleFSM_InvalidTransitions tests that invalid transitions are rejected
func TestTraceLifecycleFSM_InvalidTransitions(t *testing.T) {
	tests := []struct {
		name       string
		startState TraceLifecycleState
		event      TraceLifecycleEvent
		setup      func(*TraceLifecycleFSM)
	}{
		{
			name:       "start evaluation while receiving",
			startState: TraceReceiving,
			event:      EventStartEvaluation,
			setup:      func(f *TraceLifecycleFSM) {},
		},
		{
			name:       "complete evaluation while receiving",
			startState: TraceReceiving,
			event:      EventEvaluationComplete,
			setup:      func(f *TraceLifecycleFSM) {},
		},
		{
			name:       "timeout while evaluating",
			startState: TraceEvaluating,
			event:      EventTimeout,
			setup: func(f *TraceLifecycleFSM) {
				f.Transition(EventTimeout)
				f.Transition(EventStartEvaluation)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fsm := NewTraceLifecycleFSM("test-trace")
			tt.setup(fsm)

			err := fsm.Transition(tt.event)
			if err == nil {
				t.Fatalf("Expected invalid transition error, got nil")
			}

			if _, ok := err.(*InvalidTraceTransitionError); !ok {
				t.Errorf("Expected InvalidTraceTransitionError, got %T", err)
			}
		})
	}
}

// TestTraceLifecycleFSM_AddSpanWhileEvaluating tests race prevention
func TestTraceLifecycleFSM_AddSpanWhileEvaluating(t *testing.T) {
	fsm := NewTraceLifecycleFSM("trace-123")

	// Add span and complete
	span := &models.Span{SpanID: "span-1", TraceID: "trace-123"}
	fsm.AddSpan(span)
	fsm.Transition(EventTimeout)
	fsm.Transition(EventStartEvaluation)

	// Try to add span while evaluating - should fail
	span2 := &models.Span{SpanID: "span-2", TraceID: "trace-123"}
	err := fsm.AddSpan(span2)

	if err == nil {
		t.Fatal("Expected error when adding span during evaluation, got nil")
	}

	// Verify only 1 span exists
	spans := fsm.Spans()
	if len(spans) != 1 {
		t.Errorf("Expected 1 span, got %d", len(spans))
	}
}

// TestTraceLifecycleFSM_Rollback tests state rollback on error
func TestTraceLifecycleFSM_Rollback(t *testing.T) {
	fsm := NewTraceLifecycleFSM("trace-123")

	// Add span and timeout
	span := &models.Span{SpanID: "span-1", TraceID: "trace-123"}
	fsm.AddSpan(span)
	fsm.Transition(EventTimeout)

	// Start evaluation
	if err := fsm.Transition(EventStartEvaluation); err != nil {
		t.Fatalf("Failed to start evaluation: %v", err)
	}

	if fsm.State() != TraceEvaluating {
		t.Fatalf("Expected state=Evaluating, got %s", fsm.State())
	}

	// Simulate evaluation failure - rollback
	fsm.Rollback()

	if fsm.State() != TraceComplete {
		t.Errorf("Expected state=Complete after rollback, got %s", fsm.State())
	}
}

// TestTraceLifecycleFSM_ConcurrentSpanAddition tests race conditions
func TestTraceLifecycleFSM_ConcurrentSpanAddition(t *testing.T) {
	fsm := NewTraceLifecycleFSM("trace-123")

	var wg sync.WaitGroup
	errors := make(chan error, 100)

	// Add 100 spans concurrently
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			span := &models.Span{
				SpanID:  string(rune('a' + id%26)),
				TraceID: "trace-123",
			}
			if err := fsm.AddSpan(span); err != nil {
				errors <- err
			}
		}(i)
	}

	wg.Wait()
	close(errors)

	// Check for errors
	for err := range errors {
		t.Errorf("Concurrent AddSpan failed: %v", err)
	}

	// Verify all spans were added
	spans := fsm.Spans()
	if len(spans) != 100 {
		t.Errorf("Expected 100 spans, got %d", len(spans))
	}
}

// TestTraceLifecycleFSM_ConcurrentAddAndComplete tests race between adding and completing
func TestTraceLifecycleFSM_ConcurrentAddAndComplete(t *testing.T) {
	// This test verifies that the FSM prevents race conditions between:
	// - Thread A: Adding spans
	// - Thread B: Marking trace complete and evaluating

	fsm := NewTraceLifecycleFSM("trace-123")

	var wg sync.WaitGroup
	inconsistencies := 0

	// Run 50 iterations
	for iteration := 0; iteration < 50; iteration++ {
		wg.Add(2)

		// Thread A: Add spans
		go func() {
			defer wg.Done()
			for i := 0; i < 10; i++ {
				span := &models.Span{SpanID: string(rune('a' + i)), TraceID: "trace-123"}
				fsm.AddSpan(span)
				time.Sleep(1 * time.Millisecond)
			}
		}()

		// Thread B: Try to complete and evaluate
		go func() {
			defer wg.Done()
			time.Sleep(5 * time.Millisecond)

			// Try to timeout
			if err := fsm.Transition(EventTimeout); err == nil {
				// If timeout succeeded, try to evaluate
				if err := fsm.Transition(EventStartEvaluation); err == nil {
					// FSM should prevent adding spans while evaluating
					span := &models.Span{SpanID: "test", TraceID: "trace-123"}
					if err := fsm.AddSpan(span); err == nil {
						// BUG: Span was added during evaluation!
						inconsistencies++
					}
					// Complete evaluation
					fsm.Transition(EventEvaluationComplete)
				}
			}
		}()

		wg.Wait()

		// Reset FSM for next iteration
		fsm = NewTraceLifecycleFSM("trace-123")
	}

	if inconsistencies > 0 {
		t.Errorf("Found %d race conditions (spans added during evaluation)", inconsistencies)
	} else {
		t.Logf("✅ No race conditions found in 50 iterations")
	}
}

// TestTraceLifecycleRegistry tests the registry functionality
func TestTraceLifecycleRegistry(t *testing.T) {
	registry := NewTraceLifecycleRegistry()

	// Get FSM for new trace
	fsm1 := registry.Get("trace-1")
	if fsm1 == nil {
		t.Fatal("Expected FSM for trace-1, got nil")
	}
	if fsm1.TraceID() != "trace-1" {
		t.Errorf("Expected traceID=trace-1, got %s", fsm1.TraceID())
	}

	// Get same trace again - should return same FSM
	fsm1Again := registry.Get("trace-1")
	if fsm1Again != fsm1 {
		t.Error("Expected same FSM instance for trace-1")
	}

	// Get different trace
	fsm2 := registry.Get("trace-2")
	if fsm2 == nil {
		t.Fatal("Expected FSM for trace-2, got nil")
	}
	if fsm2 == fsm1 {
		t.Error("Expected different FSM instances")
	}

	// Verify count
	if registry.Count() != 2 {
		t.Errorf("Expected 2 traces in registry, got %d", registry.Count())
	}

	// Remove trace
	registry.Remove("trace-1")
	if registry.Count() != 1 {
		t.Errorf("Expected 1 trace after removal, got %d", registry.Count())
	}
}

// TestTraceLifecycleRegistry_GetByState tests filtering by state
func TestTraceLifecycleRegistry_GetByState(t *testing.T) {
	registry := NewTraceLifecycleRegistry()

	// Create traces in different states
	fsm1 := registry.Get("trace-1")
	fsm1.AddSpan(&models.Span{SpanID: "s1", TraceID: "trace-1"})
	// trace-1 is in Receiving state

	fsm2 := registry.Get("trace-2")
	fsm2.AddSpan(&models.Span{SpanID: "s2", TraceID: "trace-2"})
	fsm2.Transition(EventTimeout)
	// trace-2 is in Complete state

	fsm3 := registry.Get("trace-3")
	fsm3.AddSpan(&models.Span{SpanID: "s3", TraceID: "trace-3"})
	fsm3.Transition(EventTimeout)
	fsm3.Transition(EventStartEvaluation)
	// trace-3 is in Evaluating state

	// Get traces by state
	receiving := registry.GetByState(TraceReceiving)
	if len(receiving) != 1 {
		t.Errorf("Expected 1 trace in Receiving, got %d", len(receiving))
	}

	complete := registry.GetByState(TraceComplete)
	if len(complete) != 1 {
		t.Errorf("Expected 1 trace in Complete, got %d", len(complete))
	}

	evaluating := registry.GetByState(TraceEvaluating)
	if len(evaluating) != 1 {
		t.Errorf("Expected 1 trace in Evaluating, got %d", len(evaluating))
	}

	processed := registry.GetByState(TraceProcessed)
	if len(processed) != 0 {
		t.Errorf("Expected 0 traces in Processed, got %d", len(processed))
	}
}

// TestTraceLifecycleFSM_ValidEvents tests getting valid events for current state
func TestTraceLifecycleFSM_ValidEvents(t *testing.T) {
	fsm := NewTraceLifecycleFSM("trace-123")

	// In Receiving state
	events := fsm.ValidEvents()
	if len(events) != 2 {
		t.Errorf("Expected 2 valid events in Receiving state, got %d", len(events))
	}

	// Add span so evaluation is allowed
	span := &models.Span{SpanID: "span-1", TraceID: "trace-123"}
	fsm.AddSpan(span)

	// Transition to Complete
	fsm.Transition(EventTimeout)
	events = fsm.ValidEvents()
	if len(events) != 2 {
		t.Errorf("Expected 2 valid events in Complete state, got %d", len(events))
	}

	// Transition to Evaluating
	fsm.Transition(EventStartEvaluation)
	events = fsm.ValidEvents()
	if len(events) != 2 {
		t.Errorf("Expected 2 valid events in Evaluating state, got %d", len(events))
	}

	// Transition to Processed (terminal state)
	fsm.Transition(EventEvaluationComplete)
	events = fsm.ValidEvents()
	if len(events) != 0 {
		t.Errorf("Expected 0 valid events in Processed state, got %d", len(events))
	}
}
