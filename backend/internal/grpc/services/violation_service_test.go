package services

import (
	"context"
	"testing"

	pb "github.com/betracehq/betrace/backend/generated/betrace/v1"
	internalServices "github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/pkg/models"
)

// TestViolationService_ListViolations_Empty tests listing with no violations
func TestViolationService_ListViolations_Empty(t *testing.T) {
	store := internalServices.NewViolationStoreMemory("test-key")
	service := NewViolationService(store)

	ctx := context.Background()
	resp, err := service.ListViolations(ctx, &pb.ListViolationsRequest{})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(resp.Violations) != 0 {
		t.Errorf("Expected 0 violations, got %d", len(resp.Violations))
	}

	if resp.TotalCount != 0 {
		t.Errorf("Expected TotalCount=0, got %d", resp.TotalCount)
	}
}

// TestViolationService_ListViolations_WithViolations tests listing violations
func TestViolationService_ListViolations_WithViolations(t *testing.T) {
	store := internalServices.NewViolationStoreMemory("test-key")
	service := NewViolationService(store)

	ctx := context.Background()

	// Record test violations
	violations := []models.Violation{
		{
			RuleID:   "rule-1",
			RuleName: "Test Rule 1",
			Severity: "HIGH",
			Message:  "Test violation 1",
		},
		{
			RuleID:   "rule-2",
			RuleName: "Test Rule 2",
			Severity: "MEDIUM",
			Message:  "Test violation 2",
		},
		{
			RuleID:   "rule-1",
			RuleName: "Test Rule 1",
			Severity: "HIGH",
			Message:  "Test violation 3",
		},
	}

	spanRefs := []models.SpanRef{
		{
			TraceID:     "trace-1",
			SpanID:      "span-1",
			ServiceName: "test-service",
		},
	}

	for _, v := range violations {
		_, err := store.Record(ctx, v, spanRefs)
		if err != nil {
			t.Fatalf("Failed to record violation: %v", err)
		}
	}

	// List all violations
	resp, err := service.ListViolations(ctx, &pb.ListViolationsRequest{})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(resp.Violations) != 3 {
		t.Errorf("Expected 3 violations, got %d", len(resp.Violations))
	}

	if resp.TotalCount != 3 {
		t.Errorf("Expected TotalCount=3, got %d", resp.TotalCount)
	}
}

// TestViolationService_ListViolations_FilterByRuleID tests filtering by rule ID
func TestViolationService_ListViolations_FilterByRuleID(t *testing.T) {
	store := internalServices.NewViolationStoreMemory("test-key")
	service := NewViolationService(store)

	ctx := context.Background()

	// Record violations for different rules
	store.Record(ctx, models.Violation{
		RuleID:   "rule-1",
		RuleName: "Test Rule 1",
		Severity: "HIGH",
		Message:  "Violation for rule-1",
	}, []models.SpanRef{{TraceID: "trace-1", SpanID: "span-1"}})

	store.Record(ctx, models.Violation{
		RuleID:   "rule-2",
		RuleName: "Test Rule 2",
		Severity: "MEDIUM",
		Message:  "Violation for rule-2",
	}, []models.SpanRef{{TraceID: "trace-2", SpanID: "span-2"}})

	store.Record(ctx, models.Violation{
		RuleID:   "rule-1",
		RuleName: "Test Rule 1",
		Severity: "HIGH",
		Message:  "Another violation for rule-1",
	}, []models.SpanRef{{TraceID: "trace-3", SpanID: "span-3"}})

	// List violations for rule-1 only
	resp, err := service.ListViolations(ctx, &pb.ListViolationsRequest{
		RuleId: "rule-1",
	})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(resp.Violations) != 2 {
		t.Errorf("Expected 2 violations for rule-1, got %d", len(resp.Violations))
	}

	// Verify all returned violations are for rule-1
	for _, v := range resp.Violations {
		if v.RuleId != "rule-1" {
			t.Errorf("Expected RuleId='rule-1', got %s", v.RuleId)
		}
	}
}

// TestViolationService_ListViolations_WithLimit tests pagination limit
func TestViolationService_ListViolations_WithLimit(t *testing.T) {
	store := internalServices.NewViolationStoreMemory("test-key")
	service := NewViolationService(store)

	ctx := context.Background()

	// Record 5 violations
	for i := 0; i < 5; i++ {
		store.Record(ctx, models.Violation{
			RuleID:   "rule-1",
			RuleName: "Test Rule",
			Severity: "HIGH",
			Message:  "Test violation",
		}, []models.SpanRef{{TraceID: "trace-1", SpanID: "span-1"}})
	}

	// Request only 3 violations
	resp, err := service.ListViolations(ctx, &pb.ListViolationsRequest{
		Limit: 3,
	})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(resp.Violations) != 3 {
		t.Errorf("Expected 3 violations (limit), got %d", len(resp.Violations))
	}
}

// TestViolationService_ListViolations_DefaultLimit tests default limit
func TestViolationService_ListViolations_DefaultLimit(t *testing.T) {
	store := internalServices.NewViolationStoreMemory("test-key")
	service := NewViolationService(store)

	ctx := context.Background()

	// Record 150 violations (more than default limit of 100)
	for i := 0; i < 150; i++ {
		store.Record(ctx, models.Violation{
			RuleID:   "rule-1",
			RuleName: "Test Rule",
			Severity: "HIGH",
			Message:  "Test violation",
		}, []models.SpanRef{{TraceID: "trace-1", SpanID: "span-1"}})
	}

	// Request without explicit limit (should default to 100)
	resp, err := service.ListViolations(ctx, &pb.ListViolationsRequest{})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(resp.Violations) != 100 {
		t.Errorf("Expected 100 violations (default limit), got %d", len(resp.Violations))
	}
}

// TestViolationService_ListViolations_SpanReferences tests span reference mapping
func TestViolationService_ListViolations_SpanReferences(t *testing.T) {
	store := internalServices.NewViolationStoreMemory("test-key")
	service := NewViolationService(store)

	ctx := context.Background()

	// Record violation with span references
	spanRefs := []models.SpanRef{
		{
			TraceID:     "test-trace-123",
			SpanID:      "test-span-456",
			ServiceName: "test-service",
		},
		{
			TraceID:     "test-trace-123",
			SpanID:      "test-span-789",
			ServiceName: "test-service",
		},
	}

	store.Record(ctx, models.Violation{
		RuleID:   "rule-1",
		RuleName: "Test Rule",
		Severity: "HIGH",
		Message:  "Test violation with spans",
	}, spanRefs)

	// List violations
	resp, err := service.ListViolations(ctx, &pb.ListViolationsRequest{})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(resp.Violations) != 1 {
		t.Fatalf("Expected 1 violation, got %d", len(resp.Violations))
	}

	v := resp.Violations[0]

	// Verify first span reference is mapped
	if v.TraceId != "test-trace-123" {
		t.Errorf("Expected TraceId='test-trace-123', got %s", v.TraceId)
	}

	if v.SpanId != "test-span-456" {
		t.Errorf("Expected SpanId='test-span-456', got %s", v.SpanId)
	}
}

// TestViolationService_ListViolations_NoSpanReferences tests violation without spans
func TestViolationService_ListViolations_NoSpanReferences(t *testing.T) {
	store := internalServices.NewViolationStoreMemory("test-key")
	service := NewViolationService(store)

	ctx := context.Background()

	// Record violation with no span references
	store.Record(ctx, models.Violation{
		RuleID:   "rule-1",
		RuleName: "Test Rule",
		Severity: "HIGH",
		Message:  "Test violation without spans",
	}, []models.SpanRef{})

	// List violations
	resp, err := service.ListViolations(ctx, &pb.ListViolationsRequest{})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(resp.Violations) != 1 {
		t.Fatalf("Expected 1 violation, got %d", len(resp.Violations))
	}

	v := resp.Violations[0]

	// Verify empty span references
	if v.TraceId != "" {
		t.Errorf("Expected empty TraceId, got %s", v.TraceId)
	}

	if v.SpanId != "" {
		t.Errorf("Expected empty SpanId, got %s", v.SpanId)
	}
}

// TestViolationService_ListViolations_Metadata tests violation metadata
func TestViolationService_ListViolations_Metadata(t *testing.T) {
	store := internalServices.NewViolationStoreMemory("test-key")
	service := NewViolationService(store)

	ctx := context.Background()

	// Record violation
	store.Record(ctx, models.Violation{
		RuleID:   "rule-1",
		RuleName: "Security Rule",
		Severity: "CRITICAL",
		Message:  "Security violation detected",
	}, []models.SpanRef{{TraceID: "trace-1", SpanID: "span-1"}})

	// List violations
	resp, err := service.ListViolations(ctx, &pb.ListViolationsRequest{})
	if err != nil {
		t.Fatalf("ListViolations failed: %v", err)
	}

	if len(resp.Violations) != 1 {
		t.Fatalf("Expected 1 violation, got %d", len(resp.Violations))
	}

	v := resp.Violations[0]

	if v.RuleId != "rule-1" {
		t.Errorf("Expected RuleId='rule-1', got %s", v.RuleId)
	}

	if v.RuleName != "Security Rule" {
		t.Errorf("Expected RuleName='Security Rule', got %s", v.RuleName)
	}

	if v.Severity != "CRITICAL" {
		t.Errorf("Expected Severity='CRITICAL', got %s", v.Severity)
	}

	if v.Message != "Security violation detected" {
		t.Errorf("Expected Message='Security violation detected', got %s", v.Message)
	}

	if v.Timestamp == nil {
		t.Error("Expected Timestamp to be set, got nil")
	}

	if v.Context == nil {
		t.Error("Expected Context map to be initialized, got nil")
	}
}
