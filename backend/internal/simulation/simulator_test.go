package simulation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSimulator_Basic(t *testing.T) {
	seed := int64(12345)
	sim := NewSimulator(seed)

	// Verify deterministic initialization
	assert.Equal(t, seed, sim.Seed())
	assert.Equal(t, 0, len(sim.GetRules()))

	// Create a rule
	rule := sim.CreateRule(`when { http.request.where(status == ERROR) } always { error.logged }`)
	assert.Equal(t, 1, len(sim.GetRules()))
	assert.Equal(t, rule.Expression, `when { http.request.where(status == ERROR) } always { error.logged }`)

	// Verify rule was persisted
	recovered, err := sim.GetRule(rule.ID)
	require.NoError(t, err)
	assert.Equal(t, rule.Expression, recovered.Expression)
}

func TestSimulator_CrashRecovery(t *testing.T) {
	seed := int64(54321)
	sim := NewSimulator(seed)

	// Create rules
	rule1 := sim.CreateRule(`when { db.query.where(duration_ms > 1000) } always { performance_alert }`)
	rule2 := sim.CreateRule(`when { http.request.where(status == ERROR) } always { error.logged }`)
	assert.Equal(t, 2, len(sim.GetRules()))

	// Crash and restart
	err := sim.CrashAndRestart()
	require.NoError(t, err)

	// Verify rules recovered
	rules := sim.GetRules()
	assert.Equal(t, 2, len(rules), "Should recover 2 rules after crash")

	// Verify rule content intact
	recovered1, err := sim.GetRule(rule1.ID)
	require.NoError(t, err)
	assert.Equal(t, rule1.Expression, recovered1.Expression)

	recovered2, err := sim.GetRule(rule2.ID)
	require.NoError(t, err)
	assert.Equal(t, rule2.Expression, recovered2.Expression)
}

func TestSimulator_MultipleCrashes(t *testing.T) {
	seed := int64(99999)
	sim := NewSimulator(seed)

	// Create initial rules
	for i := 0; i < 10; i++ {
		sim.GenerateRule()
	}
	assert.Equal(t, 10, len(sim.GetRules()))

	// Crash 5 times
	for i := 0; i < 5; i++ {
		err := sim.CrashAndRestart()
		require.NoError(t, err, "Crash %d should not error", i)

		// Rules should survive each crash
		rules := sim.GetRules()
		assert.Equal(t, 10, len(rules), "Should have 10 rules after crash %d", i)
	}

	// Final verification
	assert.Equal(t, 5, sim.Stats().CrashesInjected)
}

func TestSimulator_Workload(t *testing.T) {
	seed := int64(11111)
	sim := NewSimulator(seed)

	// Run simulation for 10 seconds (simulated time)
	profile := WorkloadProfile{
		Name:             "test",
		RuleCount:        10,
		SpansPerSecond:   100,
		TraceCount:       10,
		SpansPerTrace:    5,
		RuleUpdateRate:   0.1,
		BurstProbability: 0.0,
		BurstMultiplier:  1,
	}

	err := sim.Run(10*time.Second, profile)
	require.NoError(t, err)

	stats := sim.Stats()

	// Verify simulation ran
	assert.Equal(t, 10*time.Second, stats.SimulatedTime)
	assert.Greater(t, stats.SpansGenerated, 800, "Should generate ~1000 spans in 10 seconds")
	assert.GreaterOrEqual(t, stats.RulesCreated, 10, "Should create at least 10 rules")

	// Verify speedup (simulated time should be much faster than real time)
	assert.Greater(t, stats.SpeeupFactor, 10.0, "Simulation should be at least 10x faster than real-time")

	sim.Report() // Print summary
}

func TestSimulator_Determinism(t *testing.T) {
	seed := int64(77777)

	// Run simulation twice with same seed
	run1 := runDeterministicTest(t, seed)
	run2 := runDeterministicTest(t, seed)

	// Results should be identical
	assert.Equal(t, run1.SpansGenerated, run2.SpansGenerated)
	assert.Equal(t, run1.RulesCreated, run2.RulesCreated)
	assert.Equal(t, len(run1.RuleIDs), len(run2.RuleIDs))
}

func runDeterministicTest(t *testing.T, seed int64) struct {
	SpansGenerated int
	RulesCreated   int
	RuleIDs        []string
} {
	sim := NewSimulator(seed)

	// Create 5 rules
	ruleIDs := make([]string, 5)
	for i := 0; i < 5; i++ {
		rule := sim.GenerateRule()
		ruleIDs[i] = rule.ID
	}

	// Generate 100 spans
	sim.GenerateSpans(100)

	stats := sim.Stats()
	return struct {
		SpansGenerated int
		RulesCreated   int
		RuleIDs        []string
	}{
		SpansGenerated: stats.SpansGenerated,
		RulesCreated:   stats.RulesCreated,
		RuleIDs:        ruleIDs,
	}
}

// TestSimulator_SpeedBenchmark measures simulation performance
func TestSimulator_SpeedBenchmark(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping benchmark in short mode")
	}

	seed := int64(88888)
	sim := NewSimulator(seed)

	// Run 1 minute of simulated time
	profile := SteadyStateWorkload()
	profile.RuleCount = 50

	realStart := time.Now()
	err := sim.Run(60*time.Second, profile)
	require.NoError(t, err)
	realDuration := time.Since(realStart)

	stats := sim.Stats()

	t.Logf("Simulated: 60s, Real: %v, Speedup: %.1fx", realDuration, stats.SpeeupFactor)
	t.Logf("Spans: %d, Rules: %d", stats.SpansGenerated, stats.RulesCreated)

	// Target: at least 50x speedup
	assert.Greater(t, stats.SpeeupFactor, 50.0, "Simulation should be at least 50x faster")
}
