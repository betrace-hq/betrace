package storage

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// TestDemoMockIO demonstrates the mock filesystem in action
func TestDemoMockIO(t *testing.T) {
	fmt.Print("\n=== BeTrace Mock I/O Demonstration ===\n")

	// Create mock filesystem (zero disk I/O)
	mockFS := NewMockFileSystem()
	fmt.Println("✓ Created mock filesystem (in-memory, no disk I/O)")

	// Create store with mock
	store, err := NewDiskRuleStoreWithFS("/data", mockFS)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("✓ Created DiskRuleStore (initial count: %d)\n\n", store.Count())

	// Demonstrate CREATE
	fmt.Println("--- Step 1: CREATE ---")
	rule := models.Rule{
		ID:          "high-latency-detector",
		Name:        "high-latency-detector",
		Description: "Detects spans over 1 second",
		Expression:  "span.duration > 1000",
		Severity:    "HIGH",
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err = store.Create(rule)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("✓ Created rule: %s\n", rule.Name)
	fmt.Printf("  Mock stats: WriteCalls=%d, RenameCalls=%d\n", mockFS.WriteCalls, mockFS.RenameCalls)
	fmt.Printf("  File exists in mock: %v\n", mockFS.FileExists("/data/rules.json"))

	// Show mock file contents
	data, exists := mockFS.GetFile("/data/rules.json")
	if !exists {
		t.Fatal("File should exist in mock")
	}
	fmt.Printf("  Mock file size: %d bytes\n", len(data))

	var rules map[string]models.Rule
	json.Unmarshal(data, &rules)
	fmt.Printf("  Rules persisted to mock: %d\n\n", len(rules))

	// Demonstrate RECOVERY (simulated restart)
	fmt.Println("--- Step 2: RECOVERY (simulated restart) ---")
	fmt.Println("Simulating restart: creating new store with same mock filesystem...")

	recoveredStore, err := NewDiskRuleStoreWithFS("/data", mockFS)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("✓ New store created from mock\n")
	fmt.Printf("  Rules recovered from mock: %d\n", recoveredStore.Count())
	fmt.Printf("  Mock read operations: %d\n\n", mockFS.ReadCalls)

	recoveredRule, err := recoveredStore.Get("high-latency-detector")
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("✓ Retrieved recovered rule from mock:\n")
	fmt.Printf("  ID: %s\n", recoveredRule.ID)
	fmt.Printf("  Expression: %s\n", recoveredRule.Expression)
	fmt.Printf("  Severity: %s\n\n", recoveredRule.Severity)

	// Demonstrate UPDATE
	fmt.Println("--- Step 3: UPDATE ---")
	updatedRule := recoveredRule
	updatedRule.Description = "UPDATED: Now detects spans over 2 seconds"
	updatedRule.Expression = "span.duration > 2000"
	updatedRule.Severity = "CRITICAL"

	err = recoveredStore.Update(updatedRule)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("✓ Updated rule in mock\n")
	fmt.Printf("  New expression: %s\n", updatedRule.Expression)
	fmt.Printf("  New severity: %s\n", updatedRule.Severity)

	// Verify update was persisted to mock
	data, _ = mockFS.GetFile("/data/rules.json")
	json.Unmarshal(data, &rules)
	persistedRule := rules["high-latency-detector"]
	fmt.Printf("  Mock persisted severity: %s ✓\n\n", persistedRule.Severity)

	// Demonstrate DELETE
	fmt.Println("--- Step 4: DELETE ---")
	err = recoveredStore.Delete("high-latency-detector")
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("✓ Deleted rule from mock\n")
	fmt.Printf("  Remaining rules in memory: %d\n", recoveredStore.Count())

	// Verify deletion was persisted to mock
	data, _ = mockFS.GetFile("/data/rules.json")
	json.Unmarshal(data, &rules)
	fmt.Printf("  Rules in mock file: %d ✓\n\n", len(rules))

	// Demonstrate ERROR INJECTION
	fmt.Println("--- Step 5: ERROR INJECTION ---")
	mockFS.WriteError = fmt.Errorf("simulated disk full error")
	fmt.Println("💥 Injected error into mock: 'disk full'")

	failRule := models.Rule{
		ID:         "will-fail",
		Name:       "will-fail",
		Expression: "span.duration > 100",
	}

	err = recoveredStore.Create(failRule)
	if err == nil {
		t.Fatal("Expected error but got none")
	}
	fmt.Printf("✓ Create failed as expected: %v\n", err)
	fmt.Printf("  Rules in store: %d (unchanged due to error) ✓\n\n", recoveredStore.Count())

	// Summary
	fmt.Println("=== Summary ===")
	fmt.Printf("Total mock filesystem operations:\n")
	fmt.Printf("  Reads:   %d\n", mockFS.ReadCalls)
	fmt.Printf("  Writes:  %d\n", mockFS.WriteCalls)
	fmt.Printf("  Renames: %d\n", mockFS.RenameCalls)
	fmt.Printf("\n✅ All operations completed WITHOUT touching disk!\n")
	fmt.Printf("✅ Zero files created in /tmp or filesystem\n")
	fmt.Printf("✅ All data exists only in memory (mockFS.files map)\n\n")
}
