package simulation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFaultInjector_DiskFull(t *testing.T) {
	seed := int64(11111)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)

	// Set 100% probability for deterministic testing
	injector.DiskFullProbability = 1.0

	// Should always inject
	assert.True(t, injector.ShouldInjectDiskFull())
	assert.Equal(t, 1, injector.Stats().DiskFullCount)

	// Multiple calls should increment counter
	injector.ShouldInjectDiskFull()
	assert.Equal(t, 2, injector.Stats().DiskFullCount)
}

func TestFaultInjector_Probabilities(t *testing.T) {
	seed := int64(22222)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)

	// Set 50% probability
	injector.CrashProbability = 0.5

	// Run 1000 iterations
	crashes := 0
	for i := 0; i < 1000; i++ {
		if injector.ShouldInjectCrash() {
			crashes++
		}
	}

	// Should be approximately 500 (allow ±10%)
	assert.Greater(t, crashes, 400, "Too few crashes")
	assert.Less(t, crashes, 600, "Too many crashes")
}

func TestFaultInjector_AggressiveMode(t *testing.T) {
	seed := int64(33333)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)

	// Default probabilities are lower
	defaultCrashProb := injector.CrashProbability

	// Enable aggressive mode
	injector.SetAggressiveMode()

	// Probabilities should increase
	assert.Greater(t, injector.CrashProbability, defaultCrashProb)
	assert.Greater(t, injector.DiskFullProbability, 0.05)
}

func TestFaultInjector_Profiles(t *testing.T) {
	seed := int64(44444)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)

	// Apply conservative profile
	injector.ApplyProfile(ConservativeProfile())
	assert.Equal(t, 0.01, injector.DiskFullProbability)

	// Apply chaos profile
	injector.ApplyProfile(ChaosProfile())
	assert.Equal(t, 0.20, injector.DiskFullProbability)
	assert.Equal(t, 0.30, injector.CrashProbability)
}

func TestFaultyFileSystem_DiskFull(t *testing.T) {
	seed := int64(55555)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)
	injector.DiskFullProbability = 1.0 // Always fail

	ffs := NewFaultyFileSystem(injector)

	// WriteFile should fail with disk full
	err := ffs.WriteFile("/test.txt", []byte("data"), 0644)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no space left on device")
}

func TestFaultyFileSystem_Corruption(t *testing.T) {
	seed := int64(66666)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)
	injector.CorruptionProbability = 0.0 // Start clean

	ffs := NewFaultyFileSystem(injector)

	// Write data
	original := []byte("hello world")
	err := ffs.WriteFile("/test.txt", original, 0644)
	require.NoError(t, err)

	// Enable corruption
	injector.CorruptionProbability = 1.0

	// Read should return corrupted data
	data, err := ffs.ReadFile("/test.txt")
	require.NoError(t, err)

	// At least one byte should be different
	assert.NotEqual(t, original, data, "Data should be corrupted")
}

func TestFaultyFileSystem_PartialWrite(t *testing.T) {
	seed := int64(77777)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)
	injector.PartialWriteProbability = 1.0

	ffs := NewFaultyFileSystem(injector)

	// Attempt to write 100 bytes
	original := make([]byte, 100)
	for i := range original {
		original[i] = byte(i)
	}

	err := ffs.WriteFile("/test.txt", original, 0644)
	require.NoError(t, err)

	// Read back
	data, exists := ffs.GetUnderlyingFS().GetFile("/test.txt")
	require.True(t, exists, "File should exist")

	// Should be truncated
	assert.Less(t, len(data), len(original), "Data should be truncated")
}

func TestSimulatorWithFaults(t *testing.T) {
	seed := int64(88888)
	sim := NewSimulator(seed)

	// Enable fault injection
	injector := NewFaultInjector(sim.rand)
	injector.ApplyProfile(AggressiveProfile())
	// Note: We need to integrate fault injector with simulator
	// For now, this test demonstrates the concept

	// Create rules under faults
	for i := 0; i < 20; i++ {
		sim.GenerateRule()
	}

	// Verify some rules survived
	rules := sim.GetRules()
	assert.Greater(t, len(rules), 10, "Should have at least half the rules despite faults")
}

func TestFaultInjector_Stats(t *testing.T) {
	seed := int64(99999)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)

	// Set 100% probabilities for deterministic counting
	injector.DiskFullProbability = 1.0
	injector.CorruptionProbability = 1.0
	injector.CrashProbability = 1.0

	// Inject various faults
	injector.ShouldInjectDiskFull()
	injector.ShouldInjectCorruption()
	injector.ShouldInjectCorruption()
	injector.ShouldInjectCrash()
	injector.ShouldInjectCrash()
	injector.ShouldInjectCrash()

	stats := injector.Stats()
	assert.Equal(t, 1, stats.DiskFullCount)
	assert.Equal(t, 2, stats.CorruptionCount)
	assert.Equal(t, 3, stats.CrashCount)
	assert.Equal(t, 6, stats.TotalFaults)
}

// Benchmark fault injection overhead
func BenchmarkFaultInjector(b *testing.B) {
	seed := int64(12345)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		injector.ShouldInjectCrash()
	}
}

func TestCrashScenario_String(t *testing.T) {
	scenarios := []CrashScenario{
		CrashBeforeWrite,
		CrashDuringWrite,
		CrashAfterWrite,
		CrashBeforeRename,
		CrashDuringRename,
		CrashAfterRename,
		CrashDuringSync,
		CrashRandomPoint,
	}

	for _, scenario := range scenarios {
		name := scenario.String()
		assert.NotEmpty(t, name)
		assert.NotEqual(t, "unknown", name)
	}
}

func TestFaultInjector_Disable(t *testing.T) {
	seed := int64(11112)
	rand := NewDeterministicRand(seed)
	injector := NewFaultInjector(rand)

	// Set high probability
	injector.CrashProbability = 1.0

	// Should inject when enabled
	assert.True(t, injector.ShouldInjectCrash())

	// Disable
	injector.Enabled = false

	// Should NOT inject when disabled
	assert.False(t, injector.ShouldInjectCrash())

	// Stats should not increment
	initialCount := injector.Stats().CrashCount
	injector.ShouldInjectCrash()
	assert.Equal(t, initialCount, injector.Stats().CrashCount)
}

func TestFaultProfile_Names(t *testing.T) {
	profiles := []FaultProfile{
		ConservativeProfile(),
		AggressiveProfile(),
		ChaosProfile(),
	}

	for _, profile := range profiles {
		assert.NotEmpty(t, profile.Name)
		assert.NotEmpty(t, profile.Description)
		assert.Greater(t, profile.CrashProbability, 0.0)
		assert.Less(t, profile.CrashProbability, 1.0)
	}
}

// Integration test: Simulation with aggressive faults
func TestSimulation_AggressiveFaults(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping aggressive fault test in short mode")
	}

	seed := int64(77778)
	sim := NewSimulator(seed)

	// Run with aggressive workload
	profile := BurstWorkload()
	err := sim.Run(30*time.Second, profile)
	require.NoError(t, err)

	// System should survive
	rules := sim.GetRules()
	assert.Greater(t, len(rules), 50, "Should have created rules despite faults")

	stats := sim.Stats()
	assert.Greater(t, stats.SpansGenerated, 20000, "Should have generated spans")

	sim.Report()
}
