package simulation

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInvariantChecker_Basic(t *testing.T) {
	checker := NewInvariantChecker()

	// Should have default invariants registered
	assert.Greater(t, len(checker.invariants), 0)
}

func TestInvariantChecker_CustomInvariant(t *testing.T) {
	checker := NewInvariantChecker()

	// Add custom invariant
	checker.Register("always_pass", func(sim *Simulator) (bool, string) {
		return true, ""
	})

	checker.Register("always_fail", func(sim *Simulator) (bool, string) {
		return false, "This invariant always fails"
	})

	// Create simulator
	sim := NewSimulator(12345)

	// Check all
	allPass := checker.CheckAll(sim)
	assert.False(t, allPass, "Should fail due to always_fail invariant")

	// Should have violations
	violations := checker.Violations()
	assert.Greater(t, len(violations), 0)

	// Find the specific violation
	found := false
	for _, v := range violations {
		if v.Name == "always_fail" {
			found = true
			assert.Contains(t, v.Message, "always fails")
		}
	}
	assert.True(t, found, "Should have recorded always_fail violation")
}

func TestRulePersistenceInvariant(t *testing.T) {
	seed := int64(22222)
	sim := NewSimulator(seed)

	// Create rules
	for i := 0; i < 10; i++ {
		sim.GenerateRule()
	}

	// Check invariant (includes crash/restart)
	pass, message := RulePersistenceInvariant(sim)
	assert.True(t, pass, "Invariant should pass: %s", message)
}

func TestNoDuplicateRulesInvariant(t *testing.T) {
	seed := int64(33333)
	sim := NewSimulator(seed)

	// Create rules normally
	for i := 0; i < 10; i++ {
		sim.GenerateRule()
	}

	// Check invariant
	pass, message := NoDuplicateRulesInvariant(sim)
	assert.True(t, pass, "Invariant should pass: %s", message)
}

func TestAtomicWriteInvariant(t *testing.T) {
	seed := int64(44444)
	sim := NewSimulator(seed)

	// Create rules
	for i := 0; i < 5; i++ {
		sim.GenerateRule()
	}

	// Check invariant
	pass, message := AtomicWriteInvariant(sim)
	assert.True(t, pass, "Invariant should pass: %s", message)
}

func TestIdempotentRecoveryInvariant(t *testing.T) {
	seed := int64(55555)
	sim := NewSimulator(seed)

	// Create rules
	for i := 0; i < 10; i++ {
		sim.GenerateRule()
	}

	// First restart
	err := sim.CrashAndRestart()
	require.NoError(t, err)

	// Check invariant (does second restart)
	pass, message := IdempotentRecoveryInvariant(sim)
	assert.True(t, pass, "Invariant should pass: %s", message)
}

func TestNoDataLossUnderFaultsInvariant(t *testing.T) {
	seed := int64(66666)
	sim := NewSimulator(seed)

	// Create initial rules
	for i := 0; i < 5; i++ {
		sim.GenerateRule()
	}

	// Check invariant (adds more rules under faults)
	pass, message := NoDataLossUnderFaultsInvariant(sim)
	assert.True(t, pass, "Invariant should pass: %s", message)
}

func TestGracefulDegradationInvariant(t *testing.T) {
	seed := int64(77777)
	sim := NewSimulator(seed)

	// Create some rules
	for i := 0; i < 10; i++ {
		sim.GenerateRule()
	}

	// Check invariant
	pass, message := GracefulDegradationInvariant(sim)
	assert.True(t, pass, "Invariant should pass: %s", message)
}

func TestInvariantChecker_CheckAll(t *testing.T) {
	seed := int64(88888)
	sim := NewSimulator(seed)

	// Create rules
	for i := 0; i < 20; i++ {
		sim.GenerateRule()
	}

	// Create checker
	checker := NewInvariantChecker()

	// Check all invariants
	allPass := checker.CheckAll(sim)
	assert.True(t, allPass, "All default invariants should pass")

	violations := checker.Violations()
	assert.Equal(t, 0, len(violations), "Should have no violations")
}

func TestInvariantChecker_MultipleCrashes(t *testing.T) {
	seed := int64(99999)
	sim := NewSimulator(seed)

	// Create rules
	for i := 0; i < 15; i++ {
		sim.GenerateRule()
	}

	// Crash multiple times
	for i := 0; i < 5; i++ {
		err := sim.CrashAndRestart()
		require.NoError(t, err)

		// Check invariants after each crash
		checker := NewInvariantChecker()
		allPass := checker.CheckAll(sim)
		assert.True(t, allPass, "Invariants should pass after crash %d", i+1)
	}
}

func TestCheckInvariant_Panic(t *testing.T) {
	seed := int64(11111)
	sim := NewSimulator(seed)

	// Invariant that always fails
	failingInvariant := func(sim *Simulator) (bool, string) {
		return false, "Test failure"
	}

	// Should panic
	assert.Panics(t, func() {
		CheckInvariant(sim, "test", failingInvariant)
	}, "Should panic on invariant failure")
}

func TestMustHold(t *testing.T) {
	seed := int64(22221)
	sim := NewSimulator(seed)

	// Passing invariant
	passingInvariant := func(sim *Simulator) (bool, string) {
		return true, ""
	}

	// Should NOT panic
	assert.NotPanics(t, func() {
		MustHold(sim, passingInvariant, "test context")
	})

	// Failing invariant
	failingInvariant := func(sim *Simulator) (bool, string) {
		return false, "Test failure"
	}

	// Should panic
	assert.Panics(t, func() {
		MustHold(sim, failingInvariant, "test context")
	})
}

func TestInvariantViolation_Recording(t *testing.T) {
	seed := int64(33332)
	sim := NewSimulator(seed)

	// Create checker
	checker := NewInvariantChecker()

	// Add failing invariant
	checker.Register("test_fail", func(sim *Simulator) (bool, string) {
		return false, "Expected test failure"
	})

	// Check all
	allPass := checker.CheckAll(sim)
	assert.False(t, allPass)

	// Verify violation recorded
	violations := checker.Violations()
	require.Len(t, violations, 1)

	v := violations[0]
	assert.Equal(t, "test_fail", v.Name)
	assert.Contains(t, v.Message, "Expected test failure")
	assert.Equal(t, seed, v.Seed)
	assert.NotEmpty(t, v.SimulatedTime)
}

// Comprehensive invariant test: multiple crashes with rule operations
func TestInvariants_ComprehensiveScenario(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping comprehensive test in short mode")
	}

	seed := int64(44443)
	sim := NewSimulator(seed)

	checker := NewInvariantChecker()

	// Phase 1: Create rules
	for i := 0; i < 30; i++ {
		sim.GenerateRule()
	}

	// Check invariants
	assert.True(t, checker.CheckAll(sim), "Invariants should pass after creation")

	// Phase 2: Crash and verify
	for crash := 0; crash < 10; crash++ {
		err := sim.CrashAndRestart()
		require.NoError(t, err, "Crash %d should not error", crash+1)

		// Reset checker for fresh check
		checker = NewInvariantChecker()
		allPass := checker.CheckAll(sim)
		assert.True(t, allPass, "Invariants should pass after crash %d", crash+1)

		// Add more rules
		sim.GenerateRule()
		sim.GenerateRule()
	}

	// Phase 3: Final verification
	checker = NewInvariantChecker()
	allPass := checker.CheckAll(sim)
	assert.True(t, allPass, "All invariants should pass at end")

	// Should have original 30 + 20 new rules (2 per crash)
	rules := sim.GetRules()
	assert.Greater(t, len(rules), 40, "Should have accumulated rules")

	checker.Report()
}

// Benchmark invariant checking
func BenchmarkInvariantCheck(b *testing.B) {
	seed := int64(12345)
	sim := NewSimulator(seed)

	// Create rules
	for i := 0; i < 50; i++ {
		sim.GenerateRule()
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		checker := NewInvariantChecker()
		checker.CheckAll(sim)
	}
}
