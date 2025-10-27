package storage

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/betracehq/betrace/backend/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDiskRuleStore_CreateAndRecover(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	// Create a rule
	rule := models.Rule{
		ID:          "test-rule",
		Name:        "test-rule",
		Description: "Test rule for recovery",
		Expression:  "span.duration > 1000",
		Severity:    "HIGH",
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err = store.Create(rule)
	require.NoError(t, err)

	// Verify file was written
	assert.Equal(t, 1, mockFS.WriteCalls, "Should have written to temp file")
	assert.Equal(t, 1, mockFS.RenameCalls, "Should have renamed temp file")
	assert.True(t, mockFS.FileExists("/data/rules.json"), "Rules file should exist")

	// Simulate restart: create new store with same filesystem
	recoveredStore, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	// Verify rule was recovered
	assert.Equal(t, 1, recoveredStore.Count(), "Should have recovered 1 rule")

	recoveredRule, err := recoveredStore.Get("test-rule")
	require.NoError(t, err)
	assert.Equal(t, rule.ID, recoveredRule.ID)
	assert.Equal(t, rule.Expression, recoveredRule.Expression)
	assert.Equal(t, rule.Severity, recoveredRule.Severity)
}

func TestDiskRuleStore_Update(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	// Create initial rule
	rule := models.Rule{
		ID:          "test-rule",
		Name:        "test-rule",
		Description: "Original description",
		Expression:  "span.duration > 1000",
		Severity:    "HIGH",
		Enabled:     true,
	}

	err = store.Create(rule)
	require.NoError(t, err)

	// Update the rule
	updatedRule := rule
	updatedRule.Description = "UPDATED description"
	updatedRule.Severity = "CRITICAL"

	err = store.Update(updatedRule)
	require.NoError(t, err)

	// Verify update was persisted
	data, exists := mockFS.GetFile("/data/rules.json")
	require.True(t, exists)

	var persistedRules map[string]models.Rule
	err = json.Unmarshal(data, &persistedRules)
	require.NoError(t, err)

	persistedRule := persistedRules["test-rule"]
	assert.Equal(t, "UPDATED description", persistedRule.Description)
	assert.Equal(t, "CRITICAL", persistedRule.Severity)
}

func TestDiskRuleStore_Delete(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	// Create two rules
	rule1 := models.Rule{ID: "rule1", Name: "rule1", Expression: "span.duration > 100"}
	rule2 := models.Rule{ID: "rule2", Name: "rule2", Expression: "span.duration > 200"}

	require.NoError(t, store.Create(rule1))
	require.NoError(t, store.Create(rule2))
	assert.Equal(t, 2, store.Count())

	// Delete one rule
	err = store.Delete("rule1")
	require.NoError(t, err)
	assert.Equal(t, 1, store.Count())

	// Verify deletion was persisted
	data, exists := mockFS.GetFile("/data/rules.json")
	require.True(t, exists)

	var persistedRules map[string]models.Rule
	err = json.Unmarshal(data, &persistedRules)
	require.NoError(t, err)

	assert.Len(t, persistedRules, 1)
	assert.Contains(t, persistedRules, "rule2")
	assert.NotContains(t, persistedRules, "rule1")
}

func TestDiskRuleStore_AtomicWrite(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	rule := models.Rule{ID: "test", Name: "test", Expression: "span.duration > 100"}
	err = store.Create(rule)
	require.NoError(t, err)

	// Verify atomic write pattern: write temp file then rename
	assert.False(t, mockFS.FileExists("/data/rules.json.tmp"), "Temp file should not exist after rename")
	assert.True(t, mockFS.FileExists("/data/rules.json"), "Final file should exist")
}

func TestDiskRuleStore_WriteFailure(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	// Inject write error
	mockFS.WriteError = fmt.Errorf("disk full")

	rule := models.Rule{ID: "test", Name: "test", Expression: "span.duration > 100"}
	err = store.Create(rule)

	// Should propagate error
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "disk full")
}

func TestDiskRuleStore_RenameFailure(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	// Inject rename error (simulates crash during rename)
	mockFS.RenameError = fmt.Errorf("rename failed")

	rule := models.Rule{ID: "test", Name: "test", Expression: "span.duration > 100"}
	err = store.Create(rule)

	// Should propagate error
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rename failed")
}

func TestDiskRuleStore_CorruptedFile(t *testing.T) {
	mockFS := NewMockFileSystem()

	// Pre-populate with corrupted JSON
	mockFS.WriteFile("/data/rules.json", []byte("this is not json"), 0644)

	// Should fail to load
	_, err := NewDiskRuleStoreWithFS("/data", mockFS)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to load rules")
}

func TestDiskRuleStore_EmptyFile(t *testing.T) {
	mockFS := NewMockFileSystem()

	// Pre-populate with empty JSON object
	mockFS.WriteFile("/data/rules.json", []byte("{}"), 0644)

	// Should load successfully with zero rules
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)
	assert.Equal(t, 0, store.Count())
}

func TestDiskRuleStore_FreshStart(t *testing.T) {
	mockFS := NewMockFileSystem()

	// No existing file
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)
	assert.Equal(t, 0, store.Count())
}

func TestDiskRuleStore_DuplicateCreate(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	rule := models.Rule{ID: "test", Name: "test", Expression: "span.duration > 100"}

	err = store.Create(rule)
	require.NoError(t, err)

	// Attempt duplicate create
	err = store.Create(rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestDiskRuleStore_UpdateNonExistent(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	rule := models.Rule{ID: "nonexistent", Name: "test", Expression: "span.duration > 100"}

	err = store.Update(rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestDiskRuleStore_DeleteNonExistent(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	err = store.Delete("nonexistent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestDiskRuleStore_List(t *testing.T) {
	mockFS := NewMockFileSystem()
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	require.NoError(t, err)

	// Create multiple rules
	for i := 0; i < 5; i++ {
		rule := models.Rule{
			ID:         fmt.Sprintf("rule%d", i),
			Name:       fmt.Sprintf("rule%d", i),
			Expression: "span.duration > 100",
		}
		require.NoError(t, store.Create(rule))
	}

	// List all rules
	rules, err := store.List()
	require.NoError(t, err)
	assert.Len(t, rules, 5)
}

// Benchmark tests to verify performance
func BenchmarkDiskRuleStore_Create(b *testing.B) {
	mockFS := NewMockFileSystem()
	store, _ := NewDiskRuleStoreWithFS("/data", mockFS)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rule := models.Rule{
			ID:         fmt.Sprintf("rule%d", i),
			Name:       fmt.Sprintf("rule%d", i),
			Expression: "span.duration > 100",
		}
		store.Create(rule)
	}
}

func BenchmarkDiskRuleStore_Recovery(b *testing.B) {
	// Setup: create store with 100 rules
	mockFS := NewMockFileSystem()
	store, _ := NewDiskRuleStoreWithFS("/data", mockFS)

	for i := 0; i < 100; i++ {
		rule := models.Rule{
			ID:         fmt.Sprintf("rule%d", i),
			Name:       fmt.Sprintf("rule%d", i),
			Expression: "span.duration > 100",
		}
		store.Create(rule)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Simulate restart: create new store from same filesystem
		NewDiskRuleStoreWithFS("/data", mockFS)
	}
}
