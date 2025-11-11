package dsl

import (
	"fmt"
	"math/rand"
)

// DSLFuzzer generates random DSL rules for testing
type DSLFuzzer struct {
	rand *rand.Rand
}

// NewDSLFuzzer creates a new fuzzer with given seed
func NewDSLFuzzer(seed int64) *DSLFuzzer {
	return &DSLFuzzer{
		rand: rand.New(rand.NewSource(seed)),
	}
}

// nextGoodDSL generates a syntactically valid DSL rule
func (f *DSLFuzzer) nextGoodDSL() string {
	// Choose rule structure
	hasAlways := f.rand.Float64() < 0.7
	hasNever := f.rand.Float64() < 0.5

	whenClause := fmt.Sprintf("when { %s }", f.randomCondition(2))

	result := whenClause
	if hasAlways {
		result += fmt.Sprintf("\nalways { %s }", f.randomCondition(2))
	}
	if hasNever {
		result += fmt.Sprintf("\nnever { %s }", f.randomCondition(1))
	}

	return result
}

// nextBadDSL generates syntactically invalid DSL
func (f *DSLFuzzer) nextBadDSL() string {
	badPatterns := []func() string{
		// Basic syntax errors
		func() string { return "when payment always fraud_check" },
		func() string { return "always { fraud_check }" },
		func() string { return "when { payment.amount >> 1000 } always { fraud_check }" },
		func() string { return "when { payment always { fraud_check }" },
		func() string { return "when { payment.where } always { fraud_check }" },
		func() string { return "when { payment.amount > } always { fraud_check }" },
		func() string { return "when { payment.123invalid } always { fraud_check }" },
		func() string { return "when { not not payment } always { fraud_check }" },
		func() string { return "when { } always { fraud_check }" },
		func() string { return "when { count() > 5 } always { fraud_check }" },
		func() string { return "when { count(payment > 5 } always { fraud_check }" },
		func() string { return "when { payment && fraud_check } always { approved }" },
		func() string { return "when { payment.where(currency == U S D) } always { fraud_check }" },
		func() string { return "when { payment and } always { fraud_check }" },

		// NOTE: These are actually VALID syntax (testing parser robustness, not security)
		// SQL injection in strings is safe - they're just literals
		// Unicode is valid in strings
		// Long identifiers should parse (may fail at runtime)
		// Deep nesting should parse (may hit depth limits at runtime)

		// True invalid cases: unmatched delimiters
		func() string { return "when { (payment } always { fraud_check }" },
		func() string { return "when { payment) } always { fraud_check }" },
		func() string { return "when { payment.where(amount > 1000 } always { fraud_check }" },
		func() string { return "when { payment.where amount > 1000) } always { fraud_check }" },
	}

	return f.choice(badPatterns)()
}

// nextMaliciousDSL generates adversarial inputs (for security testing)
func (f *DSLFuzzer) nextMaliciousDSL() string {
	return f.nextBadDSL() // Currently same as bad DSL, but separated for future expansion
}

// randomCondition generates a random boolean condition
func (f *DSLFuzzer) randomCondition(maxDepth int) string {
	if maxDepth == 0 {
		return f.randomSpanCheck()
	}

	patterns := []func() string{
		// Simple span check
		func() string { return f.randomSpanCheck() },

		// AND combination
		func() string {
			return fmt.Sprintf("%s and %s", f.randomSpanCheck(), f.randomSpanCheck())
		},

		// OR combination
		func() string {
			return fmt.Sprintf("%s or %s", f.randomSpanCheck(), f.randomSpanCheck())
		},

		// NOT
		func() string {
			return fmt.Sprintf("not %s", f.randomSpanCheck())
		},

		// Grouped
		func() string {
			return fmt.Sprintf("(%s)", f.randomCondition(maxDepth-1))
		},

		// Complex combination
		func() string {
			return fmt.Sprintf("%s and (%s or %s)",
				f.randomSpanCheck(),
				f.randomSpanCheck(),
				f.randomSpanCheck())
		},
	}

	return f.choice(patterns)()
}

// randomSpanCheck generates a random span check
func (f *DSLFuzzer) randomSpanCheck() string {
	patterns := []func() string{
		// Simple existence check
		func() string { return f.randomOpName() },

		// Direct attribute comparison
		func() string {
			return fmt.Sprintf("%s.%s %s %s",
				f.randomOpName(),
				f.randomAttribute(),
				f.randomCompOp(),
				f.randomValue())
		},

		// Where clause with single condition
		func() string {
			return fmt.Sprintf("%s.where(%s %s %s)",
				f.randomOpName(),
				f.randomAttribute(),
				f.randomCompOp(),
				f.randomValue())
		},

		// Where clause with complex condition
		func() string {
			return fmt.Sprintf("%s.where(%s %s %s and %s %s %s)",
				f.randomOpName(),
				f.randomAttribute(),
				f.randomCompOp(),
				f.randomValue(),
				f.randomAttribute(),
				f.randomCompOp(),
				f.randomValue())
		},

		// Where clause with OR
		func() string {
			return fmt.Sprintf("%s.where(%s %s %s or %s %s %s)",
				f.randomOpName(),
				f.randomAttribute(),
				f.randomCompOp(),
				f.randomValue(),
				f.randomAttribute(),
				f.randomCompOp(),
				f.randomValue())
		},

		// Count check
		func() string {
			return fmt.Sprintf("count(%s) %s %d",
				f.randomOpName(),
				f.randomCompOp(),
				f.rand.Intn(10))
		},

		// Dotted operation name
		func() string {
			return fmt.Sprintf("%s.%s", f.randomOpName(), f.randomOpName())
		},
	}

	return f.choice(patterns)()
}

// randomOpName returns a random operation name
func (f *DSLFuzzer) randomOpName() string {
	names := []string{
		"payment", "fraud_check", "approved", "customer", "transaction",
		"auth", "db_query", "cache_lookup", "api_call", "validation",
		"audit_log", "encryption", "decryption", "signature", "token",
		"session", "user", "order", "invoice", "notification",
	}
	return names[f.rand.Intn(len(names))]
}

// randomAttribute returns a random attribute name (excluding reserved keywords)
func (f *DSLFuzzer) randomAttribute() string {
	// Avoid keywords: where, count, and, or, not, in, matches, true, false, when, always, never
	attrs := []string{
		"amount", "currency", "status", "score", "duration",
		"verified", "active", "tier", "level", "priority",
		"region", "country", "plan", "role", "age",
		"user_id", "transaction_id", "session_id", "request_id",
	}
	return attrs[f.rand.Intn(len(attrs))]
}

// randomCompOp returns a random comparison operator
func (f *DSLFuzzer) randomCompOp() string {
	ops := []string{"==", "!=", "<", "<=", ">", ">="}
	return ops[f.rand.Intn(len(ops))]
}

// randomValue returns a random value for comparisons
func (f *DSLFuzzer) randomValue() string {
	valueTypes := []func() string{
		// Integer
		func() string { return fmt.Sprintf("%d", f.rand.Intn(10000)) },

		// Float
		func() string { return fmt.Sprintf("%.2f", f.rand.Float64()*1000) },

		// String (quoted)
		func() string {
			words := []string{"ERROR", "OK", "PENDING", "FAILED", "SUCCESS"}
			return fmt.Sprintf(`"%s"`, words[f.rand.Intn(len(words))])
		},

		// Boolean
		func() string {
			if f.rand.Float64() < 0.5 {
				return "true"
			}
			return "false"
		},

		// Enum-like identifier (unquoted)
		func() string {
			enums := []string{"USD", "EUR", "GBP", "premium", "gold", "silver", "bronze"}
			return enums[f.rand.Intn(len(enums))]
		},
	}

	return f.choice(valueTypes)()
}

// choice picks a random element from a slice of functions
func (f *DSLFuzzer) choice(options []func() string) func() string {
	return options[f.rand.Intn(len(options))]
}
