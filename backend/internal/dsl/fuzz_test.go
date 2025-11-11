package dsl

import (
	"fmt"
	"os"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestFuzzDSLParser runs deterministic fuzzing of the DSL parser
func TestFuzzDSLParser(t *testing.T) {
	seed := getSeedFromEnv(t)
	t.Logf("[FUZZ: DSL parser] seed=%d", seed)

	fuzzer := NewDSLFuzzer(seed)

	// Test 100 valid DSL rules
	validCount := 100
	var validErrors []string

	for i := 0; i < validCount; i++ {
		dsl := fuzzer.nextGoodDSL()
		rule, err := Parse(dsl)

		if err != nil {
			errMsg := fmt.Sprintf("Valid DSL #%d failed to parse:\nDSL: %s\nError: %v", i+1, dsl, err)
			validErrors = append(validErrors, errMsg)
			t.Logf("FAILURE (valid): %s", errMsg)
		} else if rule == nil {
			errMsg := fmt.Sprintf("Valid DSL #%d parsed to nil rule:\nDSL: %s", i+1, dsl)
			validErrors = append(validErrors, errMsg)
			t.Logf("FAILURE (valid): %s", errMsg)
		}
	}

	// Test 50 invalid DSL rules (should fail to parse)
	invalidCount := 50
	var invalidErrors []string

	for i := 0; i < invalidCount; i++ {
		dsl := fuzzer.nextBadDSL()
		rule, err := Parse(dsl)

		if err == nil {
			errMsg := fmt.Sprintf("Invalid DSL #%d should have failed but parsed successfully:\nDSL: %s\nRule: %+v", i+1, dsl, rule)
			invalidErrors = append(invalidErrors, errMsg)
			t.Logf("FAILURE (invalid): %s", errMsg)
		}
	}

	// Report results
	if len(validErrors) > 0 {
		t.Errorf("SEED=%d: %d/%d valid DSL rules failed to parse:\n%v", seed, len(validErrors), validCount, validErrors[0])
	}

	if len(invalidErrors) > 0 {
		t.Errorf("SEED=%d: %d/%d invalid DSL rules incorrectly parsed:\n%v", seed, len(invalidErrors), invalidCount, invalidErrors[0])
	}

	if len(validErrors) == 0 && len(invalidErrors) == 0 {
		t.Logf("✅ SEED=%d: All %d valid rules parsed, all %d invalid rules rejected", seed, validCount, invalidCount)
	}
}

// TestFuzzDSLDeterminism verifies fuzzer is deterministic
func TestFuzzDSLDeterminism(t *testing.T) {
	seed := int64(12345)

	// Run twice with same seed
	run1 := generateDSLSamples(seed, 10)
	run2 := generateDSLSamples(seed, 10)

	// Results should be identical
	require.Equal(t, len(run1), len(run2), "Should generate same number of samples")
	for i := range run1 {
		require.Equal(t, run1[i], run2[i], "Sample %d should be identical", i)
	}

	t.Logf("✅ Determinism verified: same seed produces same DSL")
}

// TestFuzzDSLVariety verifies fuzzer generates diverse rules
func TestFuzzDSLVariety(t *testing.T) {
	seed := int64(99999)
	fuzzer := NewDSLFuzzer(seed)

	samples := make(map[string]bool)
	sampleCount := 50

	for i := 0; i < sampleCount; i++ {
		dsl := fuzzer.nextGoodDSL()
		samples[dsl] = true
	}

	uniqueRatio := float64(len(samples)) / float64(sampleCount)
	require.Greater(t, uniqueRatio, 0.8, "Should generate diverse rules (>80%% unique)")

	t.Logf("✅ Variety verified: %d/%d unique rules (%.1f%%)", len(samples), sampleCount, uniqueRatio*100)
}

// TestFuzzDSLComplexCases tests fuzzer can generate complex real-world patterns
func TestFuzzDSLComplexCases(t *testing.T) {
	seed := int64(77777)
	fuzzer := NewDSLFuzzer(seed)

	// Generate 20 rules and verify they contain complex patterns
	hasWhere := 0
	hasDirectComp := 0
	hasCount := 0
	hasGrouping := 0
	hasNegation := 0

	for i := 0; i < 100; i++ {
		dsl := fuzzer.nextGoodDSL()

		// Check for pattern presence (simple substring matching)
		if containsPattern(dsl, ".where(") {
			hasWhere++
		}
		if containsPattern(dsl, ".") && containsPattern(dsl, ">", ">=", "<", "<=", "==", "!=") && !containsPattern(dsl, ".where(") {
			hasDirectComp++
		}
		if containsPattern(dsl, "count(") {
			hasCount++
		}
		if containsPattern(dsl, "(") && containsPattern(dsl, "or", "and") {
			hasGrouping++
		}
		if containsPattern(dsl, "not ") {
			hasNegation++
		}
	}

	t.Logf("Pattern coverage (out of 100 samples):")
	t.Logf("  - .where() clauses: %d", hasWhere)
	t.Logf("  - Direct comparisons: %d", hasDirectComp)
	t.Logf("  - count() checks: %d", hasCount)
	t.Logf("  - Grouping: %d", hasGrouping)
	t.Logf("  - Negation: %d", hasNegation)

	// Require reasonable coverage of each pattern
	require.Greater(t, hasWhere, 5, "Should generate .where() clauses")
	require.Greater(t, hasDirectComp, 5, "Should generate direct comparisons")
	require.Greater(t, hasCount, 3, "Should generate count() checks")
	require.Greater(t, hasGrouping, 5, "Should generate grouped conditions")
	require.Greater(t, hasNegation, 3, "Should generate negations")
}

// Helper functions

func getSeedFromEnv(t *testing.T) int64 {
	if seedStr := os.Getenv("DSL_FUZZ_SEED"); seedStr != "" {
		seed, err := strconv.ParseInt(seedStr, 10, 64)
		if err == nil {
			return seed
		}
	}
	// Also check SIMULATION_SEED for consistency with other tests
	if seedStr := os.Getenv("SIMULATION_SEED"); seedStr != "" {
		seed, err := strconv.ParseInt(seedStr, 10, 64)
		if err == nil {
			return seed
		}
	}
	return 12345 // Default seed
}

func generateDSLSamples(seed int64, count int) []string {
	fuzzer := NewDSLFuzzer(seed)
	samples := make([]string, count)
	for i := 0; i < count; i++ {
		samples[i] = fuzzer.nextGoodDSL()
	}
	return samples
}

func containsPattern(s string, patterns ...string) bool {
	for _, p := range patterns {
		if contains(s, p) {
			return true
		}
	}
	return false
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || indexAny(s, substr) >= 0)
}

func indexAny(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
