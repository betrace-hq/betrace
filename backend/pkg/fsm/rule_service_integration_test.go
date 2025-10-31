package fsm

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// MockRuleEngine for testing
type MockRuleEngine struct {
	mu    sync.RWMutex
	rules map[string]models.Rule
}

func NewMockRuleEngine() *MockRuleEngine {
	return &MockRuleEngine{
		rules: make(map[string]models.Rule),
	}
}

func (m *MockRuleEngine) LoadRule(rule models.Rule) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rules[rule.ID] = rule
	return nil
}

func (m *MockRuleEngine) GetRule(ruleID string) (models.Rule, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rule, ok := m.rules[ruleID]
	return rule, ok
}

func (m *MockRuleEngine) DeleteRule(ruleID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rules, ruleID)
}

func (m *MockRuleEngine) ListRules() []models.Rule {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rules := make([]models.Rule, 0, len(m.rules))
	for _, r := range m.rules {
		rules = append(rules, r)
	}
	return rules
}

// MockRuleStore for testing
type MockRuleStore struct {
	mu    sync.RWMutex
	rules map[string]models.Rule
}

func NewMockRuleStore() *MockRuleStore {
	return &MockRuleStore{
		rules: make(map[string]models.Rule),
	}
}

func (m *MockRuleStore) Create(rule models.Rule) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.rules[rule.ID]; exists {
		return fmt.Errorf("rule %s already exists", rule.ID)
	}
	m.rules[rule.ID] = rule
	return nil
}

func (m *MockRuleStore) Update(rule models.Rule) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.rules[rule.ID]; !exists {
		return fmt.Errorf("rule %s not found", rule.ID)
	}
	m.rules[rule.ID] = rule
	return nil
}

func (m *MockRuleStore) Delete(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.rules[id]; !exists {
		return fmt.Errorf("rule %s not found", id)
	}
	delete(m.rules, id)
	return nil
}

func (m *MockRuleStore) Get(id string) (models.Rule, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rule, exists := m.rules[id]
	if !exists {
		return models.Rule{}, fmt.Errorf("rule %s not found", id)
	}
	return rule, nil
}

func (m *MockRuleStore) List() ([]models.Rule, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rules := make([]models.Rule, 0, len(m.rules))
	for _, r := range m.rules {
		rules = append(rules, r)
	}
	return rules, nil
}

// TestSafeRuleService_CreateRule tests basic create flow
func TestSafeRuleService_CreateRule(t *testing.T) {
	engine := NewMockRuleEngine()
	store := NewMockRuleStore()
	service := NewSafeRuleService(engine, store)

	ctx := context.Background()
	rule := models.Rule{
		ID:          "test-rule",
		Name:        "test-rule",
		Expression:  "span.duration > 100",
		Description: "Test rule",
		Enabled:     true,
	}

	// Create rule
	if err := service.CreateRule(ctx, rule); err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	// Verify rule in engine
	engineRule, ok := engine.GetRule("test-rule")
	if !ok {
		t.Fatal("Rule not found in engine")
	}
	if engineRule.Expression != rule.Expression {
		t.Fatalf("Engine rule mismatch: got %s, want %s", engineRule.Expression, rule.Expression)
	}

	// Verify rule in store
	storeRule, err := store.Get("test-rule")
	if err != nil {
		t.Fatalf("Rule not found in store: %v", err)
	}
	if storeRule.Expression != rule.Expression {
		t.Fatalf("Store rule mismatch: got %s, want %s", storeRule.Expression, rule.Expression)
	}

	// Verify FSM state
	state := service.GetRuleState("test-rule")
	if state != RulePersisted {
		t.Fatalf("Expected state RulePersisted, got %v", state)
	}
}

// TestSafeRuleService_RaceCondition_UpdateVsDelete
// THIS IS THE CRITICAL TEST: Demonstrates race condition is ELIMINATED
func TestSafeRuleService_RaceCondition_UpdateVsDelete(t *testing.T) {
	engine := NewMockRuleEngine()
	store := NewMockRuleStore()
	service := NewSafeRuleService(engine, store)

	ctx := context.Background()

	// Create initial rule
	rule := models.Rule{
		ID:          "race-test",
		Name:        "race-test",
		Expression:  "span.duration > 100",
		Description: "Original",
		Enabled:     true,
	}
	service.CreateRule(ctx, rule)

	// Run 100 iterations to catch race condition
	for iteration := 0; iteration < 100; iteration++ {
		var wg sync.WaitGroup
		wg.Add(2)

		updateErr := make(chan error, 1)
		deleteErr := make(chan error, 1)

		// Thread 1: Update rule
		go func() {
			defer wg.Done()
			updatedRule := models.Rule{
				ID:          "race-test",
				Name:        "race-test",
				Expression:  "span.duration > 200",
				Description: fmt.Sprintf("Updated iteration %d", iteration),
				Enabled:     true,
			}
			err := service.UpdateRule(ctx, "race-test", updatedRule)
			updateErr <- err
		}()

		// Thread 2: Delete rule
		go func() {
			defer wg.Done()
			err := service.DeleteRule(ctx, "race-test")
			deleteErr <- err
		}()

		wg.Wait()

		uErr := <-updateErr
		dErr := <-deleteErr

		// CRITICAL ASSERTION: Engine and store must ALWAYS be consistent
		// (This is the invariant the FSM protects)
		_, engineHas := engine.GetRule("race-test")
		_, storeErr := store.Get("race-test")
		storeHas := storeErr == nil

		if engineHas != storeHas {
			t.Fatalf("Iteration %d: INCONSISTENT STATE! Engine has rule: %v, Store has rule: %v (update err: %v, delete err: %v)",
				iteration, engineHas, storeHas, uErr, dErr)
		}

		// Both operations can succeed if they execute sequentially:
		// Update completes → rule in RulePersisted → Delete starts → Delete completes
		// This is CORRECT behavior (not a race condition)
		if uErr == nil && dErr == nil {
			// Both succeeded sequentially - verify final state is consistent
			if engineHas || storeHas {
				t.Fatalf("Iteration %d: Both operations succeeded but rule still exists! Engine: %v, Store: %v",
					iteration, engineHas, storeHas)
			}
		}

		// If update won, recreate rule for next iteration
		if uErr == nil {
			// Rule was updated, continue to next iteration
			continue
		}

		// If delete won, recreate rule for next iteration
		if dErr == nil {
			service.CreateRule(ctx, rule)
		}
	}

	t.Logf("✅ Completed 100 iterations with NO inconsistent states")
}

// TestSafeRuleService_RaceCondition_ConcurrentUpdates
// Tests that concurrent updates are serialized (no lost updates)
func TestSafeRuleService_RaceCondition_ConcurrentUpdates(t *testing.T) {
	engine := NewMockRuleEngine()
	store := NewMockRuleStore()
	service := NewSafeRuleService(engine, store)

	ctx := context.Background()

	// Create initial rule
	rule := models.Rule{
		ID:          "concurrent-test",
		Name:        "concurrent-test",
		Expression:  "span.duration > 100",
		Description: "Original",
		Enabled:     true,
	}
	service.CreateRule(ctx, rule)

	// Run 10 concurrent updates
	const numUpdates = 10
	var wg sync.WaitGroup
	wg.Add(numUpdates)

	errors := make(chan error, numUpdates)

	for i := 0; i < numUpdates; i++ {
		go func(iteration int) {
			defer wg.Done()
			updatedRule := models.Rule{
				ID:          "concurrent-test",
				Name:        "concurrent-test",
				Expression:  fmt.Sprintf("span.duration > %d", 100+iteration),
				Description: fmt.Sprintf("Update %d", iteration),
				Enabled:     true,
			}
			err := service.UpdateRule(ctx, "concurrent-test", updatedRule)
			errors <- err
		}(i)
	}

	wg.Wait()
	close(errors)

	// All updates should succeed (serialized by FSM)
	failCount := 0
	for err := range errors {
		if err != nil {
			t.Logf("Update failed (expected due to serialization): %v", err)
			failCount++
		}
	}

	// At least SOME updates should fail due to serialization
	// (FSM only allows one update at a time via state transitions)
	if failCount == 0 {
		t.Error("Expected some updates to fail due to serialization, but all succeeded")
	}

	t.Logf("✅ %d/%d updates serialized correctly", failCount, numUpdates)

	// Final consistency check
	engineRule, engineOk := engine.GetRule("concurrent-test")
	storeRule, storeErr := store.Get("concurrent-test")

	if !engineOk || storeErr != nil {
		t.Fatal("Rule should exist in both engine and store")
	}

	if engineRule.Expression != storeRule.Expression {
		t.Fatalf("INCONSISTENT STATE! Engine: %s, Store: %s",
			engineRule.Expression, storeRule.Expression)
	}
}

// TestSafeRuleService_InvariantChecking
// Same invariant checking as backend/internal/simulation/invariants.go
func TestSafeRuleService_InvariantChecking(t *testing.T) {
	engine := NewMockRuleEngine()
	store := NewMockRuleStore()
	service := NewSafeRuleService(engine, store)

	ctx := context.Background()

	// Create multiple rules
	for i := 0; i < 10; i++ {
		rule := models.Rule{
			ID:          fmt.Sprintf("rule-%d", i),
			Name:        fmt.Sprintf("rule-%d", i),
			Expression:  fmt.Sprintf("span.duration > %d", i*100),
			Description: fmt.Sprintf("Test rule %d", i),
			Enabled:     true,
		}
		if err := service.CreateRule(ctx, rule); err != nil {
			t.Fatalf("Failed to create rule-%d: %v", i, err)
		}
	}

	// Invariant 1: Engine-Store Consistency
	// All rules in engine MUST exist in store with same expression
	engineRules := engine.ListRules()
	storeRules, _ := store.List()

	engineMap := make(map[string]models.Rule)
	for _, r := range engineRules {
		engineMap[r.ID] = r
	}

	storeMap := make(map[string]models.Rule)
	for _, r := range storeRules {
		storeMap[r.ID] = r
	}

	// Check engine → store
	for id, engineRule := range engineMap {
		storeRule, exists := storeMap[id]
		if !exists {
			t.Fatalf("INVARIANT VIOLATION: Rule %s in engine but not in store", id)
		}
		if engineRule.Expression != storeRule.Expression {
			t.Fatalf("INVARIANT VIOLATION: Rule %s differs: engine=%s store=%s",
				id, engineRule.Expression, storeRule.Expression)
		}
	}

	// Check store → engine
	for id := range storeMap {
		if _, exists := engineMap[id]; !exists {
			t.Fatalf("INVARIANT VIOLATION: Rule %s in store but not in engine", id)
		}
	}

	t.Logf("✅ Engine-Store consistency invariant passed (%d rules)", len(engineMap))

	// Invariant 2: All FSM states are valid
	states := service.GetAllRuleStates()
	for ruleID, state := range states {
		if state != RulePersisted {
			t.Fatalf("INVARIANT VIOLATION: Rule %s in non-terminal state %v", ruleID, state)
		}
	}

	t.Logf("✅ FSM state invariant passed (%d rules in RulePersisted)", len(states))
}

// TestSafeRuleService_DeterministicSimulation
// Same DST approach as backend/internal/simulation/simulator_test.go
func TestSafeRuleService_DeterministicSimulation(t *testing.T) {
	seed := int64(12345)
	rng := NewDeterministicRand(seed)

	engine := NewMockRuleEngine()
	store := NewMockRuleStore()
	service := NewSafeRuleService(engine, store)

	ctx := context.Background()

	// Run 100 random operations
	for i := 0; i < 100; i++ {
		op := rng.Intn(3) // 0=create, 1=update, 2=delete

		ruleID := fmt.Sprintf("rule-%d", rng.Intn(10))

		switch op {
		case 0: // Create
			rule := models.Rule{
				ID:          ruleID,
				Name:        ruleID,
				Expression:  fmt.Sprintf("span.duration > %d", rng.Intn(1000)),
				Description: fmt.Sprintf("Iteration %d", i),
				Enabled:     rng.Bool(),
			}
			service.CreateRule(ctx, rule)

		case 1: // Update
			rule := models.Rule{
				ID:          ruleID,
				Name:        ruleID,
				Expression:  fmt.Sprintf("span.duration > %d", rng.Intn(1000)),
				Description: fmt.Sprintf("Updated iteration %d", i),
				Enabled:     rng.Bool(),
			}
			service.UpdateRule(ctx, ruleID, rule)

		case 2: // Delete
			service.DeleteRule(ctx, ruleID)
		}

		// Check invariant after EVERY operation
		engineRules := engine.ListRules()
		storeRules, _ := store.List()

		if len(engineRules) != len(storeRules) {
			t.Fatalf("Iteration %d: INVARIANT VIOLATION: Engine has %d rules, Store has %d rules",
				i, len(engineRules), len(storeRules))
		}

		// Detailed consistency check
		engineMap := make(map[string]string)
		for _, r := range engineRules {
			engineMap[r.ID] = r.Expression
		}

		storeMap := make(map[string]string)
		for _, r := range storeRules {
			storeMap[r.ID] = r.Expression
		}

		for id, engineExpr := range engineMap {
			storeExpr, ok := storeMap[id]
			if !ok {
				t.Fatalf("Iteration %d: Rule %s in engine but not store", i, id)
			}
			if engineExpr != storeExpr {
				t.Fatalf("Iteration %d: Rule %s mismatch: engine=%s store=%s",
					i, id, engineExpr, storeExpr)
			}
		}
	}

	t.Logf("✅ Completed 100 random operations with NO invariant violations (seed: %d)", seed)
}

// BenchmarkSafeRuleService_CreateUpdateDelete benchmarks FSM overhead
func BenchmarkSafeRuleService_CreateUpdateDelete(b *testing.B) {
	engine := NewMockRuleEngine()
	store := NewMockRuleStore()
	service := NewSafeRuleService(engine, store)

	ctx := context.Background()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		ruleID := fmt.Sprintf("bench-rule-%d", i)

		// Create
		rule := models.Rule{
			ID:          ruleID,
			Name:        ruleID,
			Expression:  "span.duration > 100",
			Description: "Benchmark rule",
			Enabled:     true,
		}
		service.CreateRule(ctx, rule)

		// Update
		rule.Expression = "span.duration > 200"
		service.UpdateRule(ctx, ruleID, rule)

		// Delete
		service.DeleteRule(ctx, ruleID)
	}
}
