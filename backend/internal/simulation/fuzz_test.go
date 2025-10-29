package simulation

import (
	"fmt"
	"os"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

// FuzzSimulatorWithCrashes runs simulation with random seed from environment
func TestFuzzSimulatorWithCrashes(t *testing.T) {
	seed := getSeedFromEnv(t)
	t.Logf("[TEST: fuzzing with crashes] seed=%d", seed)

	sim := NewSimulator(seed)

	// Create initial rules
	initialRuleCount := 20
	for i := 0; i < initialRuleCount; i++ {
		sim.GenerateRule()
	}

	rulesBeforeCrash := len(sim.GetRules())
	require.Equal(t, initialRuleCount, rulesBeforeCrash)

	// Inject 10 crashes with recovery
	crashCount := 10
	var errors []string

	for crashNum := 0; crashNum < crashCount; crashNum++ {
		err := sim.CrashAndRestart()
		if err != nil {
			errMsg := fmt.Sprintf("Crash %d failed: %v", crashNum+1, err)
			errors = append(errors, errMsg)
		}

		// Verify no data loss
		rulesAfterCrash := len(sim.GetRules())
		if rulesAfterCrash != rulesBeforeCrash {
			errMsg := fmt.Sprintf("Data loss: expected %d, got %d", rulesBeforeCrash, rulesAfterCrash)
			errors = append(errors, errMsg)
		}
	}

	if len(errors) > 0 {
		t.Fatalf("SIMULATION_SEED=%d failed with %d errors", seed, len(errors))
	}
}

func getSeedFromEnv(t *testing.T) int64 {
	if seedStr := os.Getenv("SIMULATION_SEED"); seedStr != "" {
		seed, err := strconv.ParseInt(seedStr, 10, 64)
		if err == nil {
			return seed
		}
	}
	return 12345 // Default seed
}
