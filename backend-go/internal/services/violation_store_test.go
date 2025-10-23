package services

import (
	"context"
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
)

func TestViolationStoreMemory_RecordAndRetrieve(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("test-signature-key")
	ctx := context.Background()

	violation := models.Violation{
		RuleID:   "rule-123",
		RuleName: "High Error Rate",
		Severity: "HIGH",
		Message:  "Error rate exceeds threshold",
	}

	spanRefs := []models.SpanRef{
		{TraceID: "trace-1", SpanID: "span-1", ServiceName: "api-service"},
		{TraceID: "trace-2", SpanID: "span-2", ServiceName: "db-service"},
	}

	// Act
	_, err := store.Record(ctx, violation, spanRefs)

	// Assert
	if err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	// Verify violation was stored with generated ID
	violations, err := store.Query(ctx, QueryFilters{Limit: 10})
	if err != nil {
		t.Fatalf("Failed to query violations: %v", err)
	}

	if len(violations) != 1 {
		t.Fatalf("Expected 1 violation, got %d", len(violations))
	}

	stored := violations[0]
	if stored.RuleID != "rule-123" {
		t.Errorf("Expected RuleID 'rule-123', got '%s'", stored.RuleID)
	}

	if stored.RuleName != "High Error Rate" {
		t.Errorf("Expected RuleName 'High Error Rate', got '%s'", stored.RuleName)
	}

	if stored.Severity != "HIGH" {
		t.Errorf("Expected Severity 'HIGH', got '%s'", stored.Severity)
	}

	if len(stored.TraceIDs) != 2 {
		t.Errorf("Expected 2 trace IDs, got %d", len(stored.TraceIDs))
	}

	if len(stored.SpanRefs) != 2 {
		t.Errorf("Expected 2 span references, got %d", len(stored.SpanRefs))
	}
}

func TestViolationStoreMemory_Signature(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("test-signature-key")
	ctx := context.Background()

	violation := models.Violation{
		RuleID:   "rule-456",
		RuleName: "Security Violation",
		Severity: "CRITICAL",
		Message:  "Unauthorized access detected",
	}

	// Act
	_, err := store.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	// Assert - signature should be generated
	violations, _ := store.Query(ctx, QueryFilters{Limit: 10})
	stored := violations[0]

	if stored.Signature == "" {
		t.Error("Expected signature to be generated, got empty string")
	}

	// Verify signature is HMAC-SHA256 (64 hex chars)
	if len(stored.Signature) != 64 {
		t.Errorf("Expected signature length 64, got %d", len(stored.Signature))
	}
}

func TestViolationStoreMemory_GetByID(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	violation := models.Violation{
		ID:       "violation-123",
		RuleID:   "rule-789",
		RuleName: "Test Rule",
		Severity: "MEDIUM",
		Message:  "Test message",
	}

	store.Record(ctx, violation, nil)

	// Act
	retrieved, err := store.GetByID(ctx, "violation-123")

	// Assert
	if err != nil {
		t.Fatalf("Failed to get violation by ID: %v", err)
	}

	if retrieved.ID != "violation-123" {
		t.Errorf("Expected ID 'violation-123', got '%s'", retrieved.ID)
	}

	if retrieved.RuleID != "rule-789" {
		t.Errorf("Expected RuleID 'rule-789', got '%s'", retrieved.RuleID)
	}
}

func TestViolationStoreMemory_GetByID_NotFound(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Act
	_, err := store.GetByID(ctx, "nonexistent-id")

	// Assert
	if err == nil {
		t.Error("Expected error for nonexistent ID, got nil")
	}
}

func TestViolationStoreMemory_QueryByRuleID(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Create violations for different rules
	store.Record(ctx, models.Violation{
		RuleID:   "rule-A",
		RuleName: "Rule A",
		Severity: "HIGH",
		Message:  "Violation A1",
	}, nil)

	store.Record(ctx, models.Violation{
		RuleID:   "rule-A",
		RuleName: "Rule A",
		Severity: "HIGH",
		Message:  "Violation A2",
	}, nil)

	store.Record(ctx, models.Violation{
		RuleID:   "rule-B",
		RuleName: "Rule B",
		Severity: "MEDIUM",
		Message:  "Violation B1",
	}, nil)

	// Act
	results, err := store.Query(ctx, QueryFilters{
		RuleID: "rule-A",
		Limit:  10,
	})

	// Assert
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 violations for rule-A, got %d", len(results))
	}

	for _, v := range results {
		if v.RuleID != "rule-A" {
			t.Errorf("Expected RuleID 'rule-A', got '%s'", v.RuleID)
		}
	}
}

func TestViolationStoreMemory_QueryBySeverity(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	store.Record(ctx, models.Violation{
		RuleID:   "rule-1",
		RuleName: "Rule 1",
		Severity: "HIGH",
		Message:  "High severity violation",
	}, nil)

	store.Record(ctx, models.Violation{
		RuleID:   "rule-2",
		RuleName: "Rule 2",
		Severity: "LOW",
		Message:  "Low severity violation",
	}, nil)

	store.Record(ctx, models.Violation{
		RuleID:   "rule-3",
		RuleName: "Rule 3",
		Severity: "HIGH",
		Message:  "Another high severity",
	}, nil)

	// Act
	results, err := store.Query(ctx, QueryFilters{
		Severity: "HIGH",
		Limit:    10,
	})

	// Assert
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 HIGH severity violations, got %d", len(results))
	}

	for _, v := range results {
		if v.Severity != "HIGH" {
			t.Errorf("Expected Severity 'HIGH', got '%s'", v.Severity)
		}
	}
}

func TestViolationStoreMemory_QueryWithLimit(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Create 5 violations
	for i := 0; i < 5; i++ {
		store.Record(ctx, models.Violation{
			RuleID:   "rule-test",
			RuleName: "Test Rule",
			Severity: "MEDIUM",
			Message:  "Test violation",
		}, nil)
	}

	// Act
	results, err := store.Query(ctx, QueryFilters{
		Limit: 3,
	})

	// Assert
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(results) != 3 {
		t.Errorf("Expected 3 violations (limit), got %d", len(results))
	}
}

func TestViolationStoreMemory_SignatureVerification(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("secure-key")
	ctx := context.Background()

	violation := models.Violation{
		ID:       "test-violation",
		RuleID:   "rule-security",
		RuleName: "Security Rule",
		Severity: "CRITICAL",
		Message:  "Security violation detected",
	}

	// Act - Record with signature
	_, err := store.Record(ctx, violation, nil)
	if err != nil {
		t.Fatalf("Failed to record: %v", err)
	}

	// Retrieve and verify signature is valid
	retrieved, err := store.GetByID(ctx, "test-violation")
	if err != nil {
		t.Fatalf("Failed to retrieve: %v", err)
	}

	// Assert - signature should be present and valid
	if retrieved.Signature == "" {
		t.Error("Expected signature to be present")
	}

	// Verify signature is correct by checking it matches expected HMAC
	if !store.verifySignature(*retrieved) {
		t.Error("Signature verification failed")
	}
}

func TestViolationStoreMemory_ConcurrentAccess(t *testing.T) {
	// Arrange
	store := NewViolationStoreMemory("test-key")
	ctx := context.Background()

	// Act - Concurrent writes
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(idx int) {
			store.Record(ctx, models.Violation{
				RuleID:   "rule-concurrent",
				RuleName: "Concurrent Rule",
				Severity: "MEDIUM",
				Message:  "Concurrent test",
			}, nil)
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	// Assert - All violations should be stored
	results, err := store.Query(ctx, QueryFilters{Limit: 100})
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(results) != 10 {
		t.Errorf("Expected 10 violations, got %d", len(results))
	}
}
