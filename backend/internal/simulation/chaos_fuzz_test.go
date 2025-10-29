package simulation

import (
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"
)

// TestFuzzChaosMode runs simulation with CHAOS-level fault injection
func TestFuzzChaosMode(t *testing.T) {
	seed := getChaosSeedFromEnv(t)
	t.Logf("[CHAOS TEST] seed=%d", seed)

	sim := NewSimulator(seed)

	// Enable CHAOS profile
	injector := NewFaultInjector(sim.rand)
	injector.ApplyProfile(ChaosProfile())

	t.Logf("[FAULT PROFILE] CHAOS")
	t.Logf("  💥 Crash: %.0f%%", injector.CrashProbability*100)
	t.Logf("  💾 Disk full: %.0f%%", injector.DiskFullProbability*100)

	// Create initial rules
	for i := 0; i < 30; i++ {
		sim.GenerateRule()
	}

	rulesAfterCreation := len(sim.GetRules())
	t.Logf("[CREATION] Created %d rules", rulesAfterCreation)

	// Chaos phase: 20 crashes with high fault rates
	crashCount := 20
	var errors []string

	for crashNum := 0; crashNum < crashCount; crashNum++ {
		err := sim.CrashAndRestart()
		if err != nil {
			errMsg := fmt.Sprintf("Crash %d failed: %v", crashNum+1, err)
			errors = append(errors, errMsg)
		}

		// Check for excessive data loss
		rulesNow := len(sim.GetRules())
		if rulesNow < rulesAfterCreation-10 {
			errMsg := fmt.Sprintf("Excessive loss: had %d, now %d", rulesAfterCreation, rulesNow)
			errors = append(errors, errMsg)
		}
	}

	stats := injector.Stats()
	failureRate := float64(len(errors)) / float64(crashCount)

	t.Logf("[RESULT] Chaos test completed")
	t.Logf("  Crashes: %d", crashCount)
	t.Logf("  Recoveries: %d", crashCount-len(errors))
	t.Logf("  Failures: %d", len(errors))
	t.Logf("  Total faults: %d", stats.TotalFaults)

	// Allow up to 50% failure rate in chaos mode
	if failureRate > 0.5 {
		t.Fatalf("CHAOS_SEED=%d failed: %.0f%% failure rate", seed, failureRate*100)
	}

	t.Logf("✅ CHAOS SURVIVED: %.0f%% uptime", (1-failureRate)*100)
}

func getChaosSeedFromEnv(t *testing.T) int64 {
	if seedStr := os.Getenv("CHAOS_SEED"); seedStr != "" {
		seed, err := strconv.ParseInt(seedStr, 10, 64)
		if err == nil {
			return seed
		}
	}
	seed := time.Now().UnixNano() % 1000000
	t.Logf("[CHAOS] Random seed: %d", seed)
	return seed
}
