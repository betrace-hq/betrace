package fsm

import (
	"fmt"
	"testing"
)

// TestRuleLifecycleFSM_BasicTransitions tests basic state machine transitions
func TestRuleLifecycleFSM_BasicTransitions(t *testing.T) {
	fsm := NewRuleLifecycleFSM("test-rule")

	// Initial state should be nonexistent
	if fsm.State() != RuleNonExistent {
		t.Fatalf("Expected initial state RuleNonExistent, got %v", fsm.State())
	}

	// Create rule
	if err := fsm.Transition(EventCreate); err != nil {
		t.Fatalf("Create transition failed: %v", err)
	}
	if fsm.State() != RuleDraft {
		t.Fatalf("Expected state RuleDraft, got %v", fsm.State())
	}

	// Validate rule
	if err := fsm.Transition(EventValidate); err != nil {
		t.Fatalf("Validate transition failed: %v", err)
	}
	if fsm.State() != RuleValidated {
		t.Fatalf("Expected state RuleValidated, got %v", fsm.State())
	}

	// Compile rule
	if err := fsm.Transition(EventCompile); err != nil {
		t.Fatalf("Compile transition failed: %v", err)
	}
	if fsm.State() != RuleCompiled {
		t.Fatalf("Expected state RuleCompiled, got %v", fsm.State())
	}

	// Persist rule
	if err := fsm.Transition(EventPersist); err != nil {
		t.Fatalf("Persist transition failed: %v", err)
	}
	if fsm.State() != RulePersisted {
		t.Fatalf("Expected state RulePersisted, got %v", fsm.State())
	}
}

// TestRuleLifecycleFSM_InvalidTransitions tests that invalid transitions are rejected
func TestRuleLifecycleFSM_InvalidTransitions(t *testing.T) {
	fsm := NewRuleLifecycleFSM("test-rule")

	// Cannot validate before creating
	if err := fsm.Transition(EventValidate); err == nil {
		t.Fatal("Expected error validating nonexistent rule, got nil")
	}

	// Cannot compile before creating
	if err := fsm.Transition(EventCompile); err == nil {
		t.Fatal("Expected error compiling nonexistent rule, got nil")
	}

	// Cannot persist before creating
	if err := fsm.Transition(EventPersist); err == nil {
		t.Fatal("Expected error persisting nonexistent rule, got nil")
	}

	// Cannot delete nonexistent rule
	if err := fsm.Transition(EventDelete); err == nil {
		t.Fatal("Expected error deleting nonexistent rule, got nil")
	}

	// Create rule
	fsm.Transition(EventCreate)

	// Cannot compile without validation
	if err := fsm.Transition(EventCompile); err == nil {
		t.Fatal("Expected error compiling unvalidated rule, got nil")
	}

	// Cannot persist without compilation
	if err := fsm.Transition(EventPersist); err == nil {
		t.Fatal("Expected error persisting uncompiled rule, got nil")
	}
}

// TestRuleLifecycleFSM_Rollback tests rollback functionality
func TestRuleLifecycleFSM_Rollback(t *testing.T) {
	fsm := NewRuleLifecycleFSM("test-rule")

	// Create → Validate → Rollback
	fsm.Transition(EventCreate)
	fsm.Transition(EventValidate)

	if fsm.State() != RuleValidated {
		t.Fatalf("Expected state RuleValidated, got %v", fsm.State())
	}

	fsm.Rollback()

	if fsm.State() != RuleDraft {
		t.Fatalf("Expected rollback to RuleDraft, got %v", fsm.State())
	}
}

// TestRuleLifecycleFSM_DeleteFlow tests deletion workflow
func TestRuleLifecycleFSM_DeleteFlow(t *testing.T) {
	fsm := NewRuleLifecycleFSM("test-rule")

	// Create and persist a rule
	fsm.Transition(EventCreate)
	fsm.Transition(EventValidate)
	fsm.Transition(EventCompile)
	fsm.Transition(EventPersist)

	// Delete rule
	if err := fsm.Transition(EventDelete); err != nil {
		t.Fatalf("Delete transition failed: %v", err)
	}
	if fsm.State() != RuleDeleting {
		t.Fatalf("Expected state RuleDeleting, got %v", fsm.State())
	}

	// Complete deletion
	if err := fsm.Transition(EventDeleteComplete); err != nil {
		t.Fatalf("DeleteComplete transition failed: %v", err)
	}
	if fsm.State() != RuleNonExistent {
		t.Fatalf("Expected state RuleNonExistent after delete, got %v", fsm.State())
	}
}

// TestRuleLifecycleFSM_UpdateFlow tests update workflow
func TestRuleLifecycleFSM_UpdateFlow(t *testing.T) {
	fsm := NewRuleLifecycleFSM("test-rule")

	// Create and persist initial rule
	fsm.Transition(EventCreate)
	fsm.Transition(EventValidate)
	fsm.Transition(EventCompile)
	fsm.Transition(EventPersist)

	// Update rule (enters updating state)
	if err := fsm.Transition(EventUpdate); err != nil {
		t.Fatalf("Update transition failed: %v", err)
	}
	if fsm.State() != RuleUpdating {
		t.Fatalf("Expected state RuleUpdating after update, got %v", fsm.State())
	}

	// Re-validate and persist updated rule
	fsm.Transition(EventValidate)
	fsm.Transition(EventCompile)
	fsm.Transition(EventPersist)

	if fsm.State() != RulePersisted {
		t.Fatalf("Expected state RulePersisted after update, got %v", fsm.State())
	}
}

// TestRuleLifecycleFSM_ErrorRecovery tests error recovery workflows
func TestRuleLifecycleFSM_ErrorRecovery(t *testing.T) {
	tests := []struct {
		name          string
		transitions   []RuleLifecycleEvent
		expectedState RuleLifecycleState
	}{
		{
			name:          "validation_failure",
			transitions:   []RuleLifecycleEvent{EventCreate, EventValidationFailed},
			expectedState: RuleNonExistent,
		},
		{
			name:          "compilation_failure",
			transitions:   []RuleLifecycleEvent{EventCreate, EventValidate, EventCompilationFailed},
			expectedState: RuleDraft,
		},
		{
			name:          "persistence_failure",
			transitions:   []RuleLifecycleEvent{EventCreate, EventValidate, EventCompile, EventPersistenceFailed},
			expectedState: RuleValidated,
		},
		{
			name:          "delete_failure",
			transitions:   []RuleLifecycleEvent{EventCreate, EventValidate, EventCompile, EventPersist, EventDelete, EventDeleteFailed},
			expectedState: RulePersisted,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fsm := NewRuleLifecycleFSM("test-rule")

			// Apply all transitions
			for _, event := range tt.transitions {
				if err := fsm.Transition(event); err != nil {
					t.Fatalf("Transition %v failed: %v", event, err)
				}
			}

			// Check final state
			if fsm.State() != tt.expectedState {
				t.Fatalf("Expected state %v, got %v", tt.expectedState, fsm.State())
			}
		})
	}
}

// TestRuleLifecycleFSM_DeterministicSimulation runs fuzzing with deterministic seeds
// This is the SAME technique as frontend RulesStateMachine.test.ts
func TestRuleLifecycleFSM_DeterministicSimulation(t *testing.T) {
	seed := int64(12345)
	rng := NewDeterministicRand(seed)

	fsm := NewRuleLifecycleFSM("fuzz-rule")
	state := RuleNonExistent

	successfulTransitions := 0
	transitionCounts := make(map[string]int)

	// Run 1000 random transitions
	for i := 0; i < 1000; i++ {
		validEvents := fsm.ValidEvents()
		if len(validEvents) == 0 {
			t.Fatalf("Iteration %d: Stuck in state %v with no valid events", i, state)
		}

		// Pick random valid event
		event := validEvents[rng.Intn(len(validEvents))]

		// Attempt transition
		previousState := fsm.State()
		if err := fsm.Transition(event); err != nil {
			t.Fatalf("Iteration %d: Valid transition %v->%v failed: %v",
				i, previousState, event, err)
		}

		// Track transition
		transitionKey := fmt.Sprintf("%v->%v", previousState, event)
		transitionCounts[transitionKey]++
		successfulTransitions++

		state = fsm.State()
	}

	t.Logf("Completed 1000 transitions successfully (seed: %d)", seed)
	t.Logf("Successful transitions: %d", successfulTransitions)
	t.Logf("Unique transition paths: %d", len(transitionCounts))

	// Verify we explored multiple paths
	if len(transitionCounts) < 5 {
		t.Errorf("Only explored %d unique transitions, expected at least 5", len(transitionCounts))
	}
}

// TestRuleLifecycleFSM_ConcurrentTransitions tests thread safety
func TestRuleLifecycleFSM_ConcurrentTransitions(t *testing.T) {
	fsm := NewRuleLifecycleFSM("concurrent-rule")

	// Create and persist a rule
	fsm.Transition(EventCreate)
	fsm.Transition(EventValidate)
	fsm.Transition(EventCompile)
	fsm.Transition(EventPersist)

	// Try concurrent update and delete (should serialize via mutex)
	done := make(chan bool, 2)

	go func() {
		err := fsm.Transition(EventUpdate)
		if err != nil {
			// Either update succeeds OR delete happened first
			t.Logf("Update failed (expected if delete won race): %v", err)
		}
		done <- true
	}()

	go func() {
		err := fsm.Transition(EventDelete)
		if err != nil {
			// Either delete succeeds OR update happened first
			t.Logf("Delete failed (expected if update won race): %v", err)
		}
		done <- true
	}()

	// Wait for both goroutines
	<-done
	<-done

	// FSM should be in a valid state (either RuleUpdating or RuleDeleting)
	state := fsm.State()
	if state != RuleUpdating && state != RuleDeleting {
		t.Fatalf("Expected RuleUpdating or RuleDeleting after concurrent ops, got %v", state)
	}

	t.Logf("Final state after concurrent transitions: %v", state)
}

// TestRuleLifecycleRegistry_BasicOperations tests registry management
func TestRuleLifecycleRegistry_BasicOperations(t *testing.T) {
	registry := NewRuleLifecycleRegistry()

	// Get FSM for new rule (should auto-create)
	fsm1 := registry.Get("rule-1")
	if fsm1 == nil {
		t.Fatal("Expected FSM for rule-1, got nil")
	}

	// Get same FSM again (should return existing)
	fsm2 := registry.Get("rule-1")
	if fsm1 != fsm2 {
		t.Fatal("Expected same FSM instance, got different")
	}

	// Get FSM for different rule
	fsm3 := registry.Get("rule-2")
	if fsm3 == fsm1 {
		t.Fatal("Expected different FSM for rule-2, got same")
	}

	// Transition rules
	fsm1.Transition(EventCreate)
	fsm3.Transition(EventCreate)
	fsm3.Transition(EventValidate)

	// Snapshot should show both rules
	snapshot := registry.Snapshot()
	if len(snapshot) != 2 {
		t.Fatalf("Expected 2 rules in snapshot, got %d", len(snapshot))
	}

	if snapshot["rule-1"] != RuleDraft {
		t.Fatalf("Expected rule-1 in RuleDraft, got %v", snapshot["rule-1"])
	}
	if snapshot["rule-2"] != RuleValidated {
		t.Fatalf("Expected rule-2 in RuleValidated, got %v", snapshot["rule-2"])
	}

	// Remove rule
	registry.Remove("rule-1")
	snapshot = registry.Snapshot()
	if len(snapshot) != 1 {
		t.Fatalf("Expected 1 rule after removal, got %d", len(snapshot))
	}
}

// BenchmarkRuleLifecycleFSM_Transitions benchmarks FSM transition speed
func BenchmarkRuleLifecycleFSM_Transitions(b *testing.B) {
	fsm := NewRuleLifecycleFSM("bench-rule")

	// Warm up: create and persist a rule
	fsm.Transition(EventCreate)
	fsm.Transition(EventValidate)
	fsm.Transition(EventCompile)
	fsm.Transition(EventPersist)

	b.ResetTimer()

	// Benchmark update flow
	for i := 0; i < b.N; i++ {
		fsm.Transition(EventUpdate)
		fsm.Transition(EventValidate)
		fsm.Transition(EventCompile)
		fsm.Transition(EventPersist)
	}

	// Calculate transitions per second
	transitionsPerOp := 4 // Update -> Validate -> Compile -> Persist
	totalTransitions := b.N * transitionsPerOp
	elapsed := b.Elapsed().Seconds()
	transitionsPerSec := float64(totalTransitions) / elapsed

	b.ReportMetric(transitionsPerSec, "transitions/sec")
}
