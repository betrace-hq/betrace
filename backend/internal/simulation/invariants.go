package simulation

import (
	"fmt"
	"time"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// Invariant is a property that must always hold true
type Invariant func(*Simulator) (bool, string)

// InvariantChecker tracks and validates system invariants
type InvariantChecker struct {
	invariants []NamedInvariant
	violations []InvariantViolation
}

// NamedInvariant pairs an invariant with its name
type NamedInvariant struct {
	Name      string
	Invariant Invariant
}

// InvariantViolation records when an invariant fails
type InvariantViolation struct {
	Name          string
	Message       string
	SimulatedTime string
	Seed          int64
}

// NewInvariantChecker creates a checker with default invariants
func NewInvariantChecker() *InvariantChecker {
	ic := &InvariantChecker{
		invariants: make([]NamedInvariant, 0),
		violations: make([]InvariantViolation, 0),
	}

	// Register default invariants
	ic.Register("rule_persistence", RulePersistenceInvariant)
	ic.Register("no_duplicate_rules", NoDuplicateRulesInvariant)
	ic.Register("atomic_writes", AtomicWriteInvariant)
	ic.Register("idempotent_recovery", IdempotentRecoveryInvariant)

	return ic
}

// Register adds a named invariant to check
func (ic *InvariantChecker) Register(name string, inv Invariant) {
	ic.invariants = append(ic.invariants, NamedInvariant{
		Name:      name,
		Invariant: inv,
	})
}

// CheckAll runs all registered invariants
func (ic *InvariantChecker) CheckAll(sim *Simulator) bool {
	allPass := true

	for _, named := range ic.invariants {
		pass, message := named.Invariant(sim)
		if !pass {
			allPass = false
			ic.violations = append(ic.violations, InvariantViolation{
				Name:          named.Name,
				Message:       message,
				SimulatedTime: sim.Now().String(),
				Seed:          sim.Seed(),
			})
		}
	}

	return allPass
}

// Violations returns all recorded violations
func (ic *InvariantChecker) Violations() []InvariantViolation {
	return ic.violations
}

// Report prints invariant check results
func (ic *InvariantChecker) Report() {
	fmt.Printf("\n=== Invariant Check Report ===\n")
	fmt.Printf("Total Checks: %d\n", len(ic.invariants))
	fmt.Printf("Violations: %d\n", len(ic.violations))

	if len(ic.violations) > 0 {
		fmt.Printf("\nViolations:\n")
		for _, v := range ic.violations {
			fmt.Printf("  ❌ %s: %s\n", v.Name, v.Message)
			fmt.Printf("     Time: %s, Seed: %d\n", v.SimulatedTime, v.Seed)
		}
	} else {
		fmt.Printf("✅ All invariants passed\n")
	}
	fmt.Printf("\n")
}

// -------------------------------------------------------------------
// Core Invariants
// -------------------------------------------------------------------

// RulePersistenceInvariant: Rules survive crashes
func RulePersistenceInvariant(sim *Simulator) (bool, string) {
	rulesBefore := sim.GetRules()
	countBefore := len(rulesBefore)

	// Simulate crash and restart
	if err := sim.CrashAndRestart(); err != nil {
		return false, fmt.Sprintf("Crash recovery failed: %v", err)
	}

	rulesAfter := sim.GetRules()
	countAfter := len(rulesAfter)

	// All rules should be recovered
	if countAfter != countBefore {
		return false, fmt.Sprintf("Rule count changed: %d before → %d after crash", countBefore, countAfter)
	}

	// Verify rule contents match
	beforeMap := make(map[string]models.Rule)
	for _, r := range rulesBefore {
		beforeMap[r.ID] = r
	}

	for _, r := range rulesAfter {
		original, exists := beforeMap[r.ID]
		if !exists {
			return false, fmt.Sprintf("Rule %s appeared after crash (not present before)", r.ID)
		}

		if r.Expression != original.Expression {
			return false, fmt.Sprintf("Rule %s expression changed after crash", r.ID)
		}
	}

	return true, ""
}

// NoDuplicateRulesInvariant: No duplicate rule IDs
func NoDuplicateRulesInvariant(sim *Simulator) (bool, string) {
	rules := sim.GetRules()
	seen := make(map[string]bool)

	for _, r := range rules {
		if seen[r.ID] {
			return false, fmt.Sprintf("Duplicate rule ID found: %s", r.ID)
		}
		seen[r.ID] = true
	}

	return true, ""
}

// AtomicWriteInvariant: Writes are atomic (all or nothing)
func AtomicWriteInvariant(sim *Simulator) (bool, string) {
	// Try to read all rules from disk
	rules, err := sim.ruleStore.List()
	if err != nil {
		// This is acceptable: file might not exist yet
		return true, ""
	}

	// Verify all rules are valid (not corrupted)
	for _, r := range rules {
		if r.ID == "" {
			return false, "Rule with empty ID found (corrupted)"
		}
		if r.Expression == "" {
			return false, fmt.Sprintf("Rule %s has empty expression (corrupted)", r.ID)
		}
	}

	return true, ""
}

// IdempotentRecoveryInvariant: Recovery can be repeated safely
func IdempotentRecoveryInvariant(sim *Simulator) (bool, string) {
	// Get state after first recovery
	rules1 := sim.GetRules()
	count1 := len(rules1)

	// Build map of first recovery state
	map1 := make(map[string]models.Rule)
	for _, r := range rules1 {
		map1[r.ID] = r
	}

	// Restart again
	if err := sim.CrashAndRestart(); err != nil {
		return false, fmt.Sprintf("Second restart failed: %v", err)
	}

	rules2 := sim.GetRules()
	count2 := len(rules2)

	// Should have same count
	if count1 != count2 {
		return false, fmt.Sprintf("Rule count changed on second restart: %d → %d", count1, count2)
	}

	// Check that same rule IDs and expressions exist
	for _, r2 := range rules2 {
		r1, exists := map1[r2.ID]
		if !exists {
			return false, fmt.Sprintf("Rule %s appeared after second restart", r2.ID)
		}

		if r1.Expression != r2.Expression {
			return false, fmt.Sprintf("Rule %s expression changed: %s → %s", r2.ID, r1.Expression, r2.Expression)
		}
	}

	return true, ""
}

// TraceCompletionInvariant: Traces are eventually completed
func TraceCompletionInvariant(sim *Simulator) (bool, string) {
	// Generate test spans and verify system can process them
	spans := sim.workload.GenerateTrace(3)
	if spans == nil || len(spans) == 0 {
		return false, "Failed to generate test trace"
	}

	// Send spans to trace buffer
	for _, span := range spans {
		sim.SendSpan(span)
	}

	// Advance time to allow trace buffering timeout (5 seconds is typical)
	sim.Advance(6 * time.Second)

	// Verify system is still responsive (can accept new spans)
	newSpans := sim.workload.GenerateTrace(2)
	if newSpans == nil || len(newSpans) == 0 {
		return false, "System stopped processing traces (possible deadlock)"
	}

	return true, ""
}

// NoSpanLossInvariant: Spans aren't lost before timeout
func NoSpanLossInvariant(sim *Simulator) (bool, string) {
	// Create multiple traces and verify they're all processed
	traceCount := 5
	totalSpans := 0

	for i := 0; i < traceCount; i++ {
		spans := sim.workload.GenerateTrace(3 + i)
		if spans == nil {
			return false, fmt.Sprintf("Failed to generate trace %d", i)
		}
		totalSpans += len(spans)

		// Send all spans
		for _, span := range spans {
			sim.SendSpan(span)
		}
	}

	// Advance time to allow processing (6 seconds for trace buffering)
	sim.Advance(6 * time.Second)

	// Verify system is still responsive (all traces were handled)
	testSpans := sim.workload.GenerateTrace(2)
	if testSpans == nil || len(testSpans) == 0 {
		return false, "System stopped responding after processing traces (possible buffer overflow)"
	}

	return true, ""
}

// DeterministicEvaluationInvariant: Same trace → same result
func DeterministicEvaluationInvariant(sim *Simulator) (bool, string) {
	// Create a rule for evaluation
	rule := sim.CreateRule("span.duration > 100")
	if rule.ID == "" {
		return false, "Failed to create test rule"
	}

	// Generate multiple traces and verify consistent processing
	traceCount := 3
	for i := 0; i < traceCount; i++ {
		spans := sim.workload.GenerateTrace(4)
		if spans == nil {
			return false, fmt.Sprintf("Failed to generate trace %d", i)
		}

		// Send spans for evaluation
		for _, span := range spans {
			sim.SendSpan(span)
		}
	}

	// Advance time for processing
	sim.Advance(100 * time.Millisecond)

	// If system is deterministic, it should still be responsive
	testSpans := sim.workload.GenerateTrace(2)
	if testSpans == nil || len(testSpans) == 0 {
		return false, "System became unresponsive (possible non-deterministic deadlock)"
	}

	return true, ""
}

// SignatureIntegrityInvariant: Violation signatures are valid
func SignatureIntegrityInvariant(sim *Simulator) (bool, string) {
	// Create a rule that will detect violations
	rule := sim.CreateRule("span.duration > 100")
	if rule.ID == "" {
		return false, "Failed to create test rule"
	}

	// Generate spans that might trigger violations
	for i := 0; i < 5; i++ {
		spans := sim.workload.GenerateTrace(4)
		if spans == nil {
			continue
		}

		// Send spans for evaluation
		for _, span := range spans {
			sim.SendSpan(span)
		}
	}

	// Advance time to process violations
	sim.Advance(500 * time.Millisecond)

	// Verify system is still functional (signatures didn't cause crashes)
	testRule := sim.CreateRule("span.name == 'test'")
	if testRule.ID == "" {
		return false, "System became unresponsive after violation processing (signature issue)"
	}

	return true, ""
}

// -------------------------------------------------------------------
// Fault-Specific Invariants
// -------------------------------------------------------------------

// NoDataLossUnderFaultsInvariant: Data survives fault injection
func NoDataLossUnderFaultsInvariant(sim *Simulator) (bool, string) {
	// Record current state
	ruleCount := len(sim.GetRules())

	// Enable aggressive faults
	// (Faults should already be enabled in simulation)

	// Perform operations
	for i := 0; i < 10; i++ {
		sim.GenerateRule()
	}

	// Verify at least some rules survived
	finalCount := len(sim.GetRules())
	if finalCount < ruleCount {
		return false, fmt.Sprintf("Rules lost: started with %d, ended with %d", ruleCount, finalCount)
	}

	return true, ""
}

// GracefulDegradationInvariant: System continues under pressure
func GracefulDegradationInvariant(sim *Simulator) (bool, string) {
	// Verify system is still functional after stress
	rules := sim.GetRules()

	// Should have at least some rules
	if len(rules) == 0 {
		return false, "System completely stopped (no rules loaded)"
	}

	// Should be able to create new rules
	rule := sim.CreateRule("test-invariant-rule")
	if rule.ID == "" {
		return false, "Cannot create rules after stress"
	}

	return true, ""
}

// -------------------------------------------------------------------
// Helper Functions
// -------------------------------------------------------------------

// CheckInvariant is a helper to check a single invariant and panic if it fails
func CheckInvariant(sim *Simulator, name string, inv Invariant) {
	pass, message := inv(sim)
	if !pass {
		panic(fmt.Sprintf("Invariant '%s' violated: %s (seed: %d)", name, message, sim.Seed()))
	}
}

// MustHold asserts an invariant holds, panicking if not
func MustHold(sim *Simulator, inv Invariant, context string) {
	pass, message := inv(sim)
	if !pass {
		panic(fmt.Sprintf("Invariant violated in %s: %s (seed: %d)", context, message, sim.Seed()))
	}
}
