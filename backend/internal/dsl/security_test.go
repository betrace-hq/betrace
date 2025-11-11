package dsl

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestSecurityRobustness validates parser handles adversarial inputs safely
func TestSecurityRobustness(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		shouldParse bool
		maxDuration time.Duration
	}{
		{
			name:        "SQL injection in string literal",
			input:       `when { payment.where(user == "1' OR '1'='1") } always { fraud_check }`,
			shouldParse: true, // Strings are safe, this is just a literal
		},
		{
			name:        "SQL injection with comments",
			input:       `when { payment.where(user == "admin'--") } always { approved }`,
			shouldParse: true, // Safe - just a string literal
		},
		{
			name:        "Unicode in strings",
			input:       `when { payment.where(name == "日本語") } always { fraud_check }`,
			shouldParse: true, // Unicode is valid
		},
		{
			name:        "Emoji in strings",
			input:       `when { payment.where(name == "💰🔒") } always { fraud_check }`,
			shouldParse: true,
		},
		{
			name:        "Null byte in string",
			input:       "when { payment.where(name == \"test\u0000null\") } always { fraud_check }",
			shouldParse: true, // Parser should handle, runtime may reject
		},
		{
			name:        "Very long identifier (10KB)",
			input:       "when { " + strings.Repeat("a", 10000) + " } always { fraud_check }",
			shouldParse: true, // Parser allows, runtime may limit
		},
		{
			name: "Deep nesting (100 levels)",
			input: func() string {
				rule := "payment"
				for i := 0; i < 100; i++ {
					rule = "(" + rule + " and fraud_check)"
				}
				return "when { " + rule + " } always { approved }"
			}(),
			shouldParse: true,  // Parser allows
			maxDuration: 100 * time.Millisecond, // Should still be fast
		},
		{
			name:        "matches operator (not implemented)",
			input:       `when { payment.name matches "(.+)+$" } always { fraud_check }`,
			shouldParse: true, // Syntax is valid, operator just not implemented
		},
		{
			name:        "Very long string literal (1MB)",
			input:       `when { payment.where(data == "` + strings.Repeat("x", 1000000) + `") } always { fraud_check }`,
			shouldParse: true,
			maxDuration: 500 * time.Millisecond, // Should handle large strings
		},
		{
			name:        "Multiple unicode categories",
			input:       `when { payment.where(name == "Hello世界مرحبا🌍") } always { fraud_check }`,
			shouldParse: true,
		},
		{
			name:        "Escaped quotes in string",
			input:       `when { payment.where(name == "test\"quote") } always { fraud_check }`,
			shouldParse: false, // Currently we don't support escaped quotes
		},
		{
			name:        "Newline in string",
			input:       "when { payment.where(name == \"line1\nline2\") } always { fraud_check }",
			shouldParse: true, // Currently allowed - may want to restrict in future
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start := time.Now()

			rule, err := Parse(tt.input)

			duration := time.Since(start)

			// Check parse result
			if tt.shouldParse {
				require.NoError(t, err, "Should parse successfully")
				require.NotNil(t, rule, "Should return non-nil rule")
			} else {
				require.Error(t, err, "Should fail to parse")
			}

			// Check performance (prevent DoS)
			if tt.maxDuration > 0 {
				require.Less(t, duration, tt.maxDuration,
					"Parsing took too long: %v (max: %v)", duration, tt.maxDuration)
			} else {
				// Default: all parsing should complete in <100ms
				require.Less(t, duration, 100*time.Millisecond,
					"Parsing took too long: %v", duration)
			}

			t.Logf("Parsed in %v", duration)
		})
	}
}

// TestParserDoesNotPanic validates parser never panics on any input
func TestParserDoesNotPanic(t *testing.T) {
	fuzzer := NewDSLFuzzer(12345)

	for i := 0; i < 100; i++ {
		// Test both good and bad inputs
		inputs := []string{
			fuzzer.nextGoodDSL(),
			fuzzer.nextBadDSL(),
		}

		for _, input := range inputs {
			func() {
				defer func() {
					if r := recover(); r != nil {
						t.Fatalf("Parser panicked on input:\n%s\nPanic: %v", input, r)
					}
				}()

				_, _ = Parse(input) // Ignore errors, just check for panics
			}()
		}
	}

	t.Logf("✅ Tested 200 inputs, no panics")
}

// TestParserMemoryBounds validates parser doesn't allocate excessive memory
func TestParserMemoryBounds(t *testing.T) {
	// This test would require memory profiling
	// For now, just test that very large inputs don't cause issues

	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "100KB identifier",
			input: "when { " + strings.Repeat("a", 100000) + " } always { fraud_check }",
		},
		{
			name:  "1000 operations",
			input: func() string {
				ops := []string{}
				for i := 0; i < 1000; i++ {
					ops = append(ops, "op"+string(rune('a'+i%26)))
				}
				return "when { " + strings.Join(ops, " and ") + " } always { fraud_check }"
			}(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start := time.Now()
			_, err := Parse(tt.input)
			duration := time.Since(start)

			// Should complete in reasonable time
			require.Less(t, duration, 1*time.Second, "Parser took too long")

			// Error is OK, we're just testing it doesn't hang/OOM
			t.Logf("Result: %v, Duration: %v", err, duration)
		})
	}
}
