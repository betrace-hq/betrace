package services

import (
	"context"
	"sync"
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// TestRuleStore_CreateAndGet verifies basic CRUD operations
func TestRuleStore_CreateAndGet(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	rule := models.Rule{
		Name:       "Test Rule",
		Expression: "trace.has(error)",
		Severity:   "HIGH",
		Enabled:    true,
	}

	created, err := store.Create(ctx, rule)
	if err != nil {
		t.Fatalf("Failed to create rule: %v", err)
	}

	if created.ID == "" {
		t.Error("Expected generated ID, got empty string")
	}

	retrieved, err := store.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Failed to get rule: %v", err)
	}

	if retrieved.Name != rule.Name {
		t.Errorf("Expected name %s, got %s", rule.Name, retrieved.Name)
	}
}

// TestRuleStore_CreateWithID verifies custom ID handling
func TestRuleStore_CreateWithID(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	rule := models.Rule{
		ID:         "custom-id-123",
		Name:       "Custom ID Rule",
		Expression: "trace.has(warning)",
		Severity:   "MEDIUM",
	}

	created, err := store.Create(ctx, rule)
	if err != nil {
		t.Fatalf("Failed to create rule: %v", err)
	}

	if created.ID != "custom-id-123" {
		t.Errorf("Expected ID custom-id-123, got %s", created.ID)
	}
}

// TestRuleStore_CreateDuplicateID verifies duplicate prevention
func TestRuleStore_CreateDuplicateID(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	rule1 := models.Rule{ID: "duplicate-id", Name: "First", Expression: "trace.has(error)", Severity: "HIGH"}
	rule2 := models.Rule{ID: "duplicate-id", Name: "Second", Expression: "trace.has(warning)", Severity: "MEDIUM"}

	_, err := store.Create(ctx, rule1)
	if err != nil {
		t.Fatalf("Failed to create first rule: %v", err)
	}

	_, err = store.Create(ctx, rule2)
	if err == nil {
		t.Error("Expected error for duplicate ID, got nil")
	}
}

// TestRuleStore_GetNotFound verifies error for missing rule
func TestRuleStore_GetNotFound(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	_, err := store.Get(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent rule, got nil")
	}
}

// TestRuleStore_List verifies listing all rules
func TestRuleStore_List(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	// Empty store
	rules, err := store.List(ctx)
	if err != nil {
		t.Fatalf("Failed to list rules: %v", err)
	}
	if len(rules) != 0 {
		t.Errorf("Expected 0 rules, got %d", len(rules))
	}

	// Add rules
	rule1 := models.Rule{Name: "Rule 1", Expression: "trace.has(error)", Severity: "HIGH"}
	rule2 := models.Rule{Name: "Rule 2", Expression: "trace.has(warning)", Severity: "MEDIUM"}
	store.Create(ctx, rule1)
	store.Create(ctx, rule2)

	rules, err = store.List(ctx)
	if err != nil {
		t.Fatalf("Failed to list rules: %v", err)
	}
	if len(rules) != 2 {
		t.Errorf("Expected 2 rules, got %d", len(rules))
	}
}

// TestRuleStore_Update verifies rule updates
func TestRuleStore_Update(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	rule := models.Rule{ID: "test-123", Name: "Original", Expression: "trace.has(error)", Severity: "HIGH"}
	store.Create(ctx, rule)

	updated := models.Rule{Name: "Updated", Expression: "trace.has(critical)", Severity: "CRITICAL", Enabled: true}
	result, err := store.Update(ctx, "test-123", updated)
	if err != nil {
		t.Fatalf("Failed to update rule: %v", err)
	}

	if result.Name != "Updated" {
		t.Errorf("Expected name Updated, got %s", result.Name)
	}
	if result.ID != "test-123" {
		t.Errorf("Expected ID preserved, got %s", result.ID)
	}
}

// TestRuleStore_UpdateNotFound verifies error for missing rule
func TestRuleStore_UpdateNotFound(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	updated := models.Rule{Name: "Updated", Expression: "trace.has(error)", Severity: "HIGH"}
	_, err := store.Update(ctx, "nonexistent", updated)
	if err == nil {
		t.Error("Expected error for nonexistent rule, got nil")
	}
}

// TestRuleStore_Delete verifies rule deletion
func TestRuleStore_Delete(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	rule := models.Rule{ID: "test-123", Name: "To Delete", Expression: "trace.has(error)", Severity: "HIGH"}
	store.Create(ctx, rule)

	err := store.Delete(ctx, "test-123")
	if err != nil {
		t.Fatalf("Failed to delete rule: %v", err)
	}

	_, err = store.Get(ctx, "test-123")
	if err == nil {
		t.Error("Expected error for deleted rule, got nil")
	}
}

// TestRuleStore_DeleteNotFound verifies error for missing rule
func TestRuleStore_DeleteNotFound(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	err := store.Delete(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent rule, got nil")
	}
}

// TestRuleStore_ConcurrentAccess verifies thread safety
func TestRuleStore_ConcurrentAccess(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	var wg sync.WaitGroup
	numGoroutines := 100

	// Concurrent creates
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			rule := models.Rule{
				Name:       "Concurrent Rule",
				Expression: "trace.has(error)",
				Severity:   "HIGH",
			}
			_, _ = store.Create(ctx, rule)
		}(i)
	}

	wg.Wait()

	// Verify all rules created
	rules, err := store.List(ctx)
	if err != nil {
		t.Fatalf("Failed to list rules: %v", err)
	}
	if len(rules) != numGoroutines {
		t.Errorf("Expected %d rules, got %d", numGoroutines, len(rules))
	}
}

// TestRuleStore_ConcurrentReadWrite verifies concurrent read/write safety
func TestRuleStore_ConcurrentReadWrite(t *testing.T) {
	store := NewRuleStore()
	ctx := context.Background()

	// Pre-populate
	rule := models.Rule{ID: "shared-rule", Name: "Shared", Expression: "trace.has(error)", Severity: "HIGH"}
	store.Create(ctx, rule)

	var wg sync.WaitGroup
	numGoroutines := 50

	// Concurrent reads
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = store.Get(ctx, "shared-rule")
		}()
	}

	// Concurrent writes
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			updated := models.Rule{Name: "Updated", Expression: "trace.has(warning)", Severity: "MEDIUM"}
			_, _ = store.Update(ctx, "shared-rule", updated)
		}()
	}

	wg.Wait()

	// Verify store is still functional
	_, err := store.Get(ctx, "shared-rule")
	if err != nil {
		t.Errorf("Store corrupted after concurrent access: %v", err)
	}
}
