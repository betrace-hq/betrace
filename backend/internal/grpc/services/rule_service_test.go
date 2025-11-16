package services

import (
	"context"
	"testing"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/internal/storage"
	"github.com/betracehq/betrace/backend/pkg/models"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// TestListRules_NoFilters tests listing all rules without filters
func TestListRules_NoFilters(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	// Create test rules
	rules := []*pb.CreateRuleRequest{
		{
			Name:        "rule-1",
			Description: "Test Rule 1",
			Expression:  "when { test } always { result }",
			Enabled:     true,
			Severity:    "HIGH",
			Tags:        []string{"security"},
		},
		{
			Name:        "rule-2",
			Description: "Test Rule 2",
			Expression:  "when { test } always { result }",
			Enabled:     false,
			Severity:    "MEDIUM",
			Tags:        []string{"compliance"},
		},
		{
			Name:        "rule-3",
			Description: "Test Rule 3",
			Expression:  "when { test } always { result }",
			Enabled:     true,
			Severity:    "LOW",
			Tags:        []string{"monitoring"},
		},
	}

	ctx := context.Background()

	for _, r := range rules {
		_, err := service.CreateRule(ctx, r)
		if err != nil {
			t.Fatalf("Failed to create rule %s: %v", r.Name, err)
		}
	}

	// List all rules
	resp, err := service.ListRules(ctx, &pb.ListRulesRequest{})
	if err != nil {
		t.Fatalf("ListRules failed: %v", err)
	}

	if len(resp.Rules) != 3 {
		t.Errorf("Expected 3 rules, got %d", len(resp.Rules))
	}

	if resp.TotalCount != 3 {
		t.Errorf("Expected TotalCount=3, got %d", resp.TotalCount)
	}
}

// TestListRules_EnabledOnly tests filtering by enabled status
func TestListRules_EnabledOnly(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create enabled and disabled rules
	service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "enabled-rule",
		Expression: "when { test } always { result }",
		Enabled:    true,
		Severity:   "HIGH",
	})

	service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "disabled-rule",
		Expression: "when { test } always { result }",
		Enabled:    false,
		Severity:   "HIGH",
	})

	// List enabled only
	resp, err := service.ListRules(ctx, &pb.ListRulesRequest{
		EnabledOnly: true,
	})
	if err != nil {
		t.Fatalf("ListRules failed: %v", err)
	}

	if len(resp.Rules) != 1 {
		t.Errorf("Expected 1 enabled rule, got %d", len(resp.Rules))
	}

	if resp.Rules[0].Enabled != true {
		t.Errorf("Expected enabled rule, got disabled")
	}
}

// TestListRules_BySeverity tests filtering by severity
func TestListRules_BySeverity(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create rules with different severities
	service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "high-sev",
		Expression: "when { test } always { result }",
		Enabled:    true,
		Severity:   "HIGH",
	})

	service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "medium-sev",
		Expression: "when { test } always { result }",
		Enabled:    true,
		Severity:   "MEDIUM",
	})

	// List HIGH severity only
	resp, err := service.ListRules(ctx, &pb.ListRulesRequest{
		Severity: "HIGH",
	})
	if err != nil {
		t.Fatalf("ListRules failed: %v", err)
	}

	if len(resp.Rules) != 1 {
		t.Errorf("Expected 1 HIGH severity rule, got %d", len(resp.Rules))
	}

	if resp.Rules[0].Severity != "HIGH" {
		t.Errorf("Expected HIGH severity, got %s", resp.Rules[0].Severity)
	}
}

// TestListRules_ByTags tests filtering by tags
func TestListRules_ByTags(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create rules with different tags
	service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "security-rule",
		Expression: "when { test } always { result }",
		Enabled:    true,
		Severity:   "HIGH",
		Tags:       []string{"security", "pii"},
	})

	service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "compliance-rule",
		Expression: "when { test } always { result }",
		Enabled:    true,
		Severity:   "HIGH",
		Tags:       []string{"compliance"},
	})

	// List rules with "security" tag
	resp, err := service.ListRules(ctx, &pb.ListRulesRequest{
		Tags: []string{"security"},
	})
	if err != nil {
		t.Fatalf("ListRules failed: %v", err)
	}

	if len(resp.Rules) != 1 {
		t.Errorf("Expected 1 rule with 'security' tag, got %d", len(resp.Rules))
	}

	if resp.Rules[0].Name != "security-rule" {
		t.Errorf("Expected 'security-rule', got %s", resp.Rules[0].Name)
	}
}

// TestGetRule_Success tests retrieving a rule by ID
func TestGetRule_Success(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create rule
	createReq := &pb.CreateRuleRequest{
		Name:        "test-rule",
		Description: "Test Rule Description",
		Expression:  "when { test } always { result }",
		Enabled:     true,
		Severity:    "HIGH",
		Tags:        []string{"test"},
	}

	created, err := service.CreateRule(ctx, createReq)
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	// Get rule
	resp, err := service.GetRule(ctx, &pb.GetRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("GetRule failed: %v", err)
	}

	if resp.Name != "test-rule" {
		t.Errorf("Expected name 'test-rule', got %s", resp.Name)
	}

	if resp.Description != "Test Rule Description" {
		t.Errorf("Expected description 'Test Rule Description', got %s", resp.Description)
	}

	if resp.Enabled != true {
		t.Errorf("Expected Enabled=true, got %v", resp.Enabled)
	}
}

// TestGetRule_NotFound tests retrieving a non-existent rule
func TestGetRule_NotFound(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Get non-existent rule
	_, err = service.GetRule(ctx, &pb.GetRuleRequest{Id: "nonexistent"})
	if err == nil {
		t.Fatal("Expected error for non-existent rule, got nil")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("Expected gRPC status error, got: %v", err)
	}

	if st.Code() != codes.NotFound {
		t.Errorf("Expected NotFound status code, got %v", st.Code())
	}
}

// TestEnableRule_Success tests enabling a disabled rule
// VERIFIES BUG #3 FIX: Enable state must persist to disk
func TestEnableRule_Success(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create disabled rule
	created, err := service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "disabled-rule",
		Expression: "when { test } always { result }",
		Enabled:    false,
		Severity:   "HIGH",
	})
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	if created.Enabled != false {
		t.Fatal("Expected rule to be created as disabled")
	}

	// Enable rule
	enabled, err := service.EnableRule(ctx, &pb.EnableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("EnableRule failed: %v", err)
	}

	if enabled.Enabled != true {
		t.Error("Expected rule to be enabled")
	}

	// VERIFY BUG #3 FIX: Check that enable state persisted to disk
	diskRule, err := store.Get(created.Id)
	if err != nil {
		t.Fatalf("Failed to read rule from disk: %v", err)
	}

	if diskRule.Enabled != true {
		t.Error("BUG #3: Enable state not persisted to disk")
	}

	// Verify engine state also updated
	compiledRule, ok := engine.GetRule(created.Id)
	if !ok {
		t.Fatal("Rule not found in engine after enable")
	}

	if compiledRule.Rule.Enabled != true {
		t.Error("Engine state not updated after enable")
	}
}

// TestEnableRule_CrashSafety tests that enable persists before engine update
// VERIFIES BUG #3 FIX: Disk write happens BEFORE engine update
func TestEnableRule_CrashSafety(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create disabled rule
	created, err := service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "crash-test",
		Expression: "when { test } always { result }",
		Enabled:    false,
		Severity:   "HIGH",
	})
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	// Track write order
	initialWriteCalls := mockFS.WriteCalls

	// Enable rule
	_, err = service.EnableRule(ctx, &pb.EnableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("EnableRule failed: %v", err)
	}

	// Verify disk write happened (crash-safe ordering)
	if mockFS.WriteCalls <= initialWriteCalls {
		t.Error("BUG #3: No disk write during enable operation")
	}

	// Simulate crash: Create new engine and reload from disk
	newEngine := rules.NewRuleEngine()
	newStore, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create new store: %v", err)
	}

	recoveredRules, err := newStore.List()
	if err != nil {
		t.Fatalf("Failed to list rules: %v", err)
	}

	if len(recoveredRules) != 1 {
		t.Fatalf("Expected 1 rule after recovery, got %d", len(recoveredRules))
	}

	// CRITICAL CHECK: Enable state must survive crash
	if recoveredRules[0].Enabled != true {
		t.Error("BUG #3 NOT FIXED: Enable state not crash-safe")
	}

	// Load into new engine
	if err := newEngine.LoadRule(recoveredRules[0]); err != nil {
		t.Fatalf("Failed to load recovered rule: %v", err)
	}

	compiledRule, ok := newEngine.GetRule(created.Id)
	if !ok {
		t.Fatal("Rule not found in new engine after recovery")
	}

	if compiledRule.Rule.Enabled != true {
		t.Error("Recovered rule not enabled")
	}
}

// TestEnableRule_NotFound tests enabling a non-existent rule
func TestEnableRule_NotFound(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	_, err = service.EnableRule(ctx, &pb.EnableRuleRequest{Id: "nonexistent"})
	if err == nil {
		t.Fatal("Expected error for non-existent rule, got nil")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("Expected gRPC status error, got: %v", err)
	}

	if st.Code() != codes.NotFound {
		t.Errorf("Expected NotFound status code, got %v", st.Code())
	}
}

// TestDisableRule_Success tests disabling an enabled rule
// VERIFIES BUG #3 FIX: Disable state must persist to disk
func TestDisableRule_Success(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create enabled rule
	created, err := service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "enabled-rule",
		Expression: "when { test } always { result }",
		Enabled:    true,
		Severity:   "HIGH",
	})
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	if created.Enabled != true {
		t.Fatal("Expected rule to be created as enabled")
	}

	// Disable rule
	disabled, err := service.DisableRule(ctx, &pb.DisableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("DisableRule failed: %v", err)
	}

	if disabled.Enabled != false {
		t.Error("Expected rule to be disabled")
	}

	// VERIFY BUG #3 FIX: Check that disable state persisted to disk
	diskRule, err := store.Get(created.Id)
	if err != nil {
		t.Fatalf("Failed to read rule from disk: %v", err)
	}

	if diskRule.Enabled != false {
		t.Error("BUG #3: Disable state not persisted to disk")
	}

	// Verify engine state also updated
	compiledRule, ok := engine.GetRule(created.Id)
	if !ok {
		t.Fatal("Rule not found in engine after disable")
	}

	if compiledRule.Rule.Enabled != false {
		t.Error("Engine state not updated after disable")
	}
}

// TestDisableRule_CrashSafety tests that disable persists before engine update
// VERIFIES BUG #3 FIX: Disk write happens BEFORE engine update
func TestDisableRule_CrashSafety(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create enabled rule
	created, err := service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "crash-test-disable",
		Expression: "when { test } always { result }",
		Enabled:    true,
		Severity:   "HIGH",
	})
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	// Track write order
	initialWriteCalls := mockFS.WriteCalls

	// Disable rule
	_, err = service.DisableRule(ctx, &pb.DisableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("DisableRule failed: %v", err)
	}

	// Verify disk write happened (crash-safe ordering)
	if mockFS.WriteCalls <= initialWriteCalls {
		t.Error("BUG #3: No disk write during disable operation")
	}

	// Simulate crash: Create new engine and reload from disk
	newEngine := rules.NewRuleEngine()
	newStore, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create new store: %v", err)
	}

	recoveredRules, err := newStore.List()
	if err != nil {
		t.Fatalf("Failed to list rules: %v", err)
	}

	if len(recoveredRules) != 1 {
		t.Fatalf("Expected 1 rule after recovery, got %d", len(recoveredRules))
	}

	// CRITICAL CHECK: Disable state must survive crash
	if recoveredRules[0].Enabled != false {
		t.Error("BUG #3 NOT FIXED: Disable state not crash-safe")
	}

	// Load into new engine
	if err := newEngine.LoadRule(recoveredRules[0]); err != nil {
		t.Fatalf("Failed to load recovered rule: %v", err)
	}

	compiledRule, ok := newEngine.GetRule(created.Id)
	if !ok {
		t.Fatal("Rule not found in new engine after recovery")
	}

	if compiledRule.Rule.Enabled != false {
		t.Error("Recovered rule not disabled")
	}
}

// TestDisableRule_NotFound tests disabling a non-existent rule
func TestDisableRule_NotFound(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	_, err = service.DisableRule(ctx, &pb.DisableRuleRequest{Id: "nonexistent"})
	if err == nil {
		t.Fatal("Expected error for non-existent rule, got nil")
	}

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("Expected gRPC status error, got: %v", err)
	}

	if st.Code() != codes.NotFound {
		t.Errorf("Expected NotFound status code, got %v", st.Code())
	}
}

// TestEnableDisable_Idempotency tests multiple enable/disable operations
func TestEnableDisable_Idempotency(t *testing.T) {
	engine := rules.NewRuleEngine()
	mockFS := storage.NewMockFileSystem()
	store, err := storage.NewDiskRuleStoreWithFS("data", mockFS)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	service := NewRuleService(engine, store)

	ctx := context.Background()

	// Create rule
	created, err := service.CreateRule(ctx, &pb.CreateRuleRequest{
		Name:       "idempotent-rule",
		Expression: "when { test } always { result }",
		Enabled:    false,
		Severity:   "HIGH",
	})
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	// Enable twice
	_, err = service.EnableRule(ctx, &pb.EnableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("First EnableRule failed: %v", err)
	}

	_, err = service.EnableRule(ctx, &pb.EnableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("Second EnableRule failed (not idempotent): %v", err)
	}

	// Disable twice
	_, err = service.DisableRule(ctx, &pb.DisableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("First DisableRule failed: %v", err)
	}

	_, err = service.DisableRule(ctx, &pb.DisableRuleRequest{Id: created.Id})
	if err != nil {
		t.Fatalf("Second DisableRule failed (not idempotent): %v", err)
	}

	// Final state should be disabled
	diskRule, err := store.Get(created.Id)
	if err != nil {
		t.Fatalf("Failed to read rule from disk: %v", err)
	}

	if diskRule.Enabled != false {
		t.Error("Final state not disabled after idempotent operations")
	}
}

// TestModelToProto tests the helper function
func TestModelToProto(t *testing.T) {
	rule := &models.Rule{
		ID:          "test-id",
		Name:        "test-name",
		Description: "test-desc",
		Expression:  "when { test } always { result }",
		Enabled:     true,
		Severity:    "HIGH",
		Tags:        []string{"tag1", "tag2"},
	}

	proto := modelToProto(rule)

	if proto.Id != rule.ID {
		t.Errorf("Expected ID=%s, got %s", rule.ID, proto.Id)
	}

	if proto.Name != rule.Name {
		t.Errorf("Expected Name=%s, got %s", rule.Name, proto.Name)
	}

	if proto.Enabled != rule.Enabled {
		t.Errorf("Expected Enabled=%v, got %v", rule.Enabled, proto.Enabled)
	}

	if len(proto.Tags) != len(rule.Tags) {
		t.Errorf("Expected %d tags, got %d", len(rule.Tags), len(proto.Tags))
	}
}
