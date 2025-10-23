package storage

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// P0-4: MemoryStore Tests

func TestMemoryStore_StoreAndRetrieve(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	violation := models.Violation{
		ID:       "test-id-1",
		RuleID:   "rule-1",
		RuleName: "Test Rule",
		Severity: "HIGH",
		Message:  "Test message",
		TraceIDs: []string{"trace-1", "trace-2"},
		CreatedAt: time.Now(),
	}

	// Store violation
	err := store.StoreViolation(ctx, violation)
	if err != nil {
		t.Fatalf("Failed to store violation: %v", err)
	}

	// Retrieve violation
	retrieved, err := store.GetViolation(ctx, "test-id-1")
	if err != nil {
		t.Fatalf("Failed to retrieve violation: %v", err)
	}

	// Assert data matches
	if retrieved.ID != violation.ID {
		t.Errorf("Expected ID=%s, got %s", violation.ID, retrieved.ID)
	}
	if retrieved.RuleID != violation.RuleID {
		t.Errorf("Expected RuleID=%s, got %s", violation.RuleID, retrieved.RuleID)
	}
	if retrieved.Severity != violation.Severity {
		t.Errorf("Expected Severity=%s, got %s", violation.Severity, retrieved.Severity)
	}
	if len(retrieved.TraceIDs) != 2 {
		t.Errorf("Expected 2 trace IDs, got %d", len(retrieved.TraceIDs))
	}
}

func TestMemoryStore_GetViolation_NotFound(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	_, err := store.GetViolation(ctx, "nonexistent-id")
	if err == nil {
		t.Error("Expected error for nonexistent violation, got nil")
	}

	expectedMsg := "violation not found: nonexistent-id"
	if err.Error() != expectedMsg {
		t.Errorf("Expected error message '%s', got '%s'", expectedMsg, err.Error())
	}
}

func TestMemoryStore_QueryViolations_NoFilters(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Store 5 violations
	for i := 1; i <= 5; i++ {
		v := models.Violation{
			ID:       string(rune(i)),
			RuleID:   "rule-1",
			RuleName: "Test Rule",
			Severity: "HIGH",
			Message:  "Test message",
		}
		if err := store.StoreViolation(ctx, v); err != nil {
			t.Fatalf("Failed to store violation %d: %v", i, err)
		}
	}

	// Query with empty filters
	violations, err := store.QueryViolations(ctx, "", "", 0)
	if err != nil {
		t.Fatalf("Failed to query violations: %v", err)
	}

	if len(violations) != 5 {
		t.Errorf("Expected 5 violations, got %d", len(violations))
	}
}

func TestMemoryStore_QueryViolations_FilterByRuleID(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Store violations with different rule IDs
	violations := []models.Violation{
		{ID: "v1", RuleID: "rule-A", RuleName: "Rule A", Severity: "HIGH", Message: "Test 1"},
		{ID: "v2", RuleID: "rule-A", RuleName: "Rule A", Severity: "MEDIUM", Message: "Test 2"},
		{ID: "v3", RuleID: "rule-B", RuleName: "Rule B", Severity: "HIGH", Message: "Test 3"},
		{ID: "v4", RuleID: "rule-B", RuleName: "Rule B", Severity: "LOW", Message: "Test 4"},
	}

	for _, v := range violations {
		if err := store.StoreViolation(ctx, v); err != nil {
			t.Fatalf("Failed to store violation: %v", err)
		}
	}

	// Query by rule-A
	results, err := store.QueryViolations(ctx, "rule-A", "", 0)
	if err != nil {
		t.Fatalf("Failed to query by ruleID: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 violations for rule-A, got %d", len(results))
	}

	for _, v := range results {
		if v.RuleID != "rule-A" {
			t.Errorf("Expected ruleID=rule-A, got %s", v.RuleID)
		}
	}
}

func TestMemoryStore_QueryViolations_FilterBySeverity(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Store violations with different severities
	violations := []models.Violation{
		{ID: "v1", RuleID: "rule-1", RuleName: "Rule", Severity: "HIGH", Message: "High 1"},
		{ID: "v2", RuleID: "rule-2", RuleName: "Rule", Severity: "HIGH", Message: "High 2"},
		{ID: "v3", RuleID: "rule-3", RuleName: "Rule", Severity: "MEDIUM", Message: "Medium"},
		{ID: "v4", RuleID: "rule-4", RuleName: "Rule", Severity: "LOW", Message: "Low"},
	}

	for _, v := range violations {
		if err := store.StoreViolation(ctx, v); err != nil {
			t.Fatalf("Failed to store violation: %v", err)
		}
	}

	// Query by HIGH severity
	results, err := store.QueryViolations(ctx, "", "HIGH", 0)
	if err != nil {
		t.Fatalf("Failed to query by severity: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 HIGH violations, got %d", len(results))
	}

	for _, v := range results {
		if v.Severity != "HIGH" {
			t.Errorf("Expected severity=HIGH, got %s", v.Severity)
		}
	}
}

func TestMemoryStore_QueryViolations_WithLimit(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Store 10 violations
	for i := 1; i <= 10; i++ {
		v := models.Violation{
			ID:       string(rune(i)),
			RuleID:   "rule-1",
			RuleName: "Test Rule",
			Severity: "HIGH",
			Message:  "Test message",
		}
		if err := store.StoreViolation(ctx, v); err != nil {
			t.Fatalf("Failed to store violation: %v", err)
		}
	}

	// Query with limit=3
	results, err := store.QueryViolations(ctx, "", "", 3)
	if err != nil {
		t.Fatalf("Failed to query with limit: %v", err)
	}

	if len(results) != 3 {
		t.Errorf("Expected 3 violations (limit), got %d", len(results))
	}
}

func TestMemoryStore_QueryViolations_CombinedFilters(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Store violations with various attributes
	violations := []models.Violation{
		{ID: "v1", RuleID: "rule-A", RuleName: "Rule A", Severity: "HIGH", Message: "Match"},
		{ID: "v2", RuleID: "rule-A", RuleName: "Rule A", Severity: "HIGH", Message: "Match"},
		{ID: "v3", RuleID: "rule-A", RuleName: "Rule A", Severity: "HIGH", Message: "Match"},
		{ID: "v4", RuleID: "rule-A", RuleName: "Rule A", Severity: "MEDIUM", Message: "No match (wrong severity)"},
		{ID: "v5", RuleID: "rule-B", RuleName: "Rule B", Severity: "HIGH", Message: "No match (wrong rule)"},
	}

	for _, v := range violations {
		if err := store.StoreViolation(ctx, v); err != nil {
			t.Fatalf("Failed to store violation: %v", err)
		}
	}

	// Query: ruleID=rule-A AND severity=HIGH AND limit=2
	results, err := store.QueryViolations(ctx, "rule-A", "HIGH", 2)
	if err != nil {
		t.Fatalf("Failed to query with combined filters: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 violations (limit), got %d", len(results))
	}

	for _, v := range results {
		if v.RuleID != "rule-A" {
			t.Errorf("Expected ruleID=rule-A, got %s", v.RuleID)
		}
		if v.Severity != "HIGH" {
			t.Errorf("Expected severity=HIGH, got %s", v.Severity)
		}
	}
}

func TestMemoryStore_ConcurrentWrites(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// 100 goroutines writing simultaneously
	numGoroutines := 100
	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(idx int) {
			defer wg.Done()

			v := models.Violation{
				ID:       string(rune(idx)),
				RuleID:   "rule-1",
				RuleName: "Concurrent Test",
				Severity: "HIGH",
				Message:  "Concurrent write",
			}

			if err := store.StoreViolation(ctx, v); err != nil {
				t.Errorf("Concurrent write %d failed: %v", idx, err)
			}
		}(i)
	}

	wg.Wait()

	// Verify all violations were stored
	violations, err := store.QueryViolations(ctx, "", "", 0)
	if err != nil {
		t.Fatalf("Failed to query after concurrent writes: %v", err)
	}

	if len(violations) != numGoroutines {
		t.Errorf("Expected %d violations after concurrent writes, got %d", numGoroutines, len(violations))
	}
}

func TestMemoryStore_ConcurrentReads(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Pre-populate store
	for i := 1; i <= 50; i++ {
		v := models.Violation{
			ID:       string(rune(i)),
			RuleID:   "rule-1",
			RuleName: "Concurrent Read Test",
			Severity: "HIGH",
			Message:  "Test message",
		}
		if err := store.StoreViolation(ctx, v); err != nil {
			t.Fatalf("Failed to store violation: %v", err)
		}
	}

	// 50 goroutines reading while writes occur
	numReaders := 50
	var wg sync.WaitGroup
	wg.Add(numReaders)

	for i := 0; i < numReaders; i++ {
		go func(idx int) {
			defer wg.Done()

			// Read existing violation
			_, err := store.GetViolation(ctx, string(rune(idx%50+1)))
			if err != nil {
				t.Errorf("Concurrent read %d failed: %v", idx, err)
			}

			// Query violations
			_, err = store.QueryViolations(ctx, "", "", 10)
			if err != nil {
				t.Errorf("Concurrent query %d failed: %v", idx, err)
			}
		}(i)
	}

	// Simultaneously write while reads happen
	for i := 100; i < 110; i++ {
		go func(idx int) {
			v := models.Violation{
				ID:       string(rune(idx)),
				RuleID:   "rule-concurrent",
				RuleName: "Concurrent Write During Read",
				Severity: "MEDIUM",
				Message:  "Test",
			}
			store.StoreViolation(ctx, v)
		}(i)
	}

	wg.Wait()

	// No panics or race conditions = success
}

func TestMemoryStore_HealthCheck(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	// In-memory store always healthy
	err := store.HealthCheck(ctx)
	if err != nil {
		t.Errorf("Expected HealthCheck to return nil, got %v", err)
	}
}

func TestMemoryStore_Close(t *testing.T) {
	store := NewMemoryStore()

	// In-memory store Close is no-op
	err := store.Close()
	if err != nil {
		t.Errorf("Expected Close to return nil, got %v", err)
	}
}

// Benchmark tests (P2 priority)

func BenchmarkMemoryStore_StoreViolation(b *testing.B) {
	store := NewMemoryStore()
	ctx := context.Background()

	violation := models.Violation{
		ID:       "bench-id",
		RuleID:   "rule-bench",
		RuleName: "Benchmark Rule",
		Severity: "HIGH",
		Message:  "Benchmark message",
		TraceIDs: []string{"trace-1", "trace-2"},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		violation.ID = string(rune(i))
		store.StoreViolation(ctx, violation)
	}
}

func BenchmarkMemoryStore_GetViolation(b *testing.B) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Pre-populate
	for i := 0; i < 1000; i++ {
		v := models.Violation{
			ID:       string(rune(i)),
			RuleID:   "rule-1",
			RuleName: "Test",
			Severity: "HIGH",
			Message:  "Test",
		}
		store.StoreViolation(ctx, v)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		store.GetViolation(ctx, string(rune(i%1000)))
	}
}

func BenchmarkMemoryStore_QueryViolations(b *testing.B) {
	store := NewMemoryStore()
	ctx := context.Background()

	// Pre-populate with 1000 violations
	for i := 0; i < 1000; i++ {
		v := models.Violation{
			ID:       string(rune(i)),
			RuleID:   "rule-1",
			RuleName: "Test",
			Severity: "HIGH",
			Message:  "Test",
		}
		store.StoreViolation(ctx, v)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		store.QueryViolations(ctx, "rule-1", "", 100)
	}
}
