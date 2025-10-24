package models

import (
	"encoding/json"
	"testing"
	"time"
)

// TestRule_JSONMarshaling verifies Rule JSON encoding/decoding
func TestRule_JSONMarshaling(t *testing.T) {
	rule := Rule{
		ID:          "rule-123",
		Name:        "Test Rule",
		Description: "A test rule",
		Severity:    "HIGH",
		Expression:  "trace.has(error)",
		LuaCode:     "-- lua code",
		Enabled:     true,
	}

	// Marshal
	data, err := json.Marshal(rule)
	if err != nil {
		t.Fatalf("Failed to marshal rule: %v", err)
	}

	// Unmarshal
	var decoded Rule
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal rule: %v", err)
	}

	// Verify
	if decoded.ID != rule.ID {
		t.Errorf("Expected ID %s, got %s", rule.ID, decoded.ID)
	}
	if decoded.Name != rule.Name {
		t.Errorf("Expected Name %s, got %s", rule.Name, decoded.Name)
	}
	if decoded.Severity != rule.Severity {
		t.Errorf("Expected Severity %s, got %s", rule.Severity, decoded.Severity)
	}
}

// TestRule_SeverityValues verifies severity enum values
func TestRule_SeverityValues(t *testing.T) {
	validSeverities := []string{"HIGH", "MEDIUM", "LOW", "CRITICAL"}

	for _, severity := range validSeverities {
		rule := Rule{Severity: severity}
		if rule.Severity != severity {
			t.Errorf("Expected severity %s, got %s", severity, rule.Severity)
		}
	}
}

// TestSpan_JSONMarshaling verifies Span JSON encoding/decoding
func TestSpan_JSONMarshaling(t *testing.T) {
	now := time.Now()
	span := Span{
		SpanID:        "span-123",
		TraceID:       "trace-456",
		ParentSpanID:  "parent-789",
		OperationName: "GET /api/users",
		ServiceName:   "user-service",
		StartTime:     now,
		EndTime:       now.Add(100 * time.Millisecond),
		Duration:      100000000, // 100ms in nanoseconds
		Attributes:    map[string]string{"http.method": "GET", "http.status_code": "200"},
		Status:        "OK",
	}

	// Marshal
	data, err := json.Marshal(span)
	if err != nil {
		t.Fatalf("Failed to marshal span: %v", err)
	}

	// Unmarshal
	var decoded Span
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal span: %v", err)
	}

	// Verify
	if decoded.SpanID != span.SpanID {
		t.Errorf("Expected SpanID %s, got %s", span.SpanID, decoded.SpanID)
	}
	if decoded.TraceID != span.TraceID {
		t.Errorf("Expected TraceID %s, got %s", span.TraceID, decoded.TraceID)
	}
	if decoded.Duration != span.Duration {
		t.Errorf("Expected Duration %d, got %d", span.Duration, decoded.Duration)
	}
}

// TestSpan_DurationCalculation verifies duration calculation from start/end times
func TestSpan_DurationCalculation(t *testing.T) {
	start := time.Now()
	end := start.Add(250 * time.Millisecond)

	span := Span{
		SpanID:        "span-123",
		TraceID:       "trace-456",
		OperationName: "test",
		StartTime:     start,
		EndTime:       end,
		Duration:      end.Sub(start).Nanoseconds(),
	}

	expectedDuration := int64(250 * time.Millisecond)
	if span.Duration != expectedDuration {
		t.Errorf("Expected duration %d, got %d", expectedDuration, span.Duration)
	}
}

// TestSpan_StatusValues verifies status enum values
func TestSpan_StatusValues(t *testing.T) {
	validStatuses := []string{"OK", "ERROR", "UNSET"}

	for _, status := range validStatuses {
		span := Span{Status: status}
		if span.Status != status {
			t.Errorf("Expected status %s, got %s", status, span.Status)
		}
	}
}

// TestViolation_JSONMarshaling verifies Violation JSON encoding/decoding
func TestViolation_JSONMarshaling(t *testing.T) {
	now := time.Now()
	violation := Violation{
		ID:        "violation-123",
		RuleID:    "rule-456",
		RuleName:  "Error Detection",
		Severity:  "HIGH",
		Message:   "Error detected in trace",
		TraceIDs:  []string{"trace-1", "trace-2"},
		SpanRefs:  []SpanRef{{TraceID: "trace-1", SpanID: "span-1", ServiceName: "svc1"}},
		CreatedAt: now,
		Signature: "abcd1234",
	}

	// Marshal
	data, err := json.Marshal(violation)
	if err != nil {
		t.Fatalf("Failed to marshal violation: %v", err)
	}

	// Unmarshal
	var decoded Violation
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal violation: %v", err)
	}

	// Verify
	if decoded.ID != violation.ID {
		t.Errorf("Expected ID %s, got %s", violation.ID, decoded.ID)
	}
	if decoded.RuleID != violation.RuleID {
		t.Errorf("Expected RuleID %s, got %s", violation.RuleID, decoded.RuleID)
	}
	if len(decoded.TraceIDs) != len(violation.TraceIDs) {
		t.Errorf("Expected %d traceIDs, got %d", len(violation.TraceIDs), len(decoded.TraceIDs))
	}
	if len(decoded.SpanRefs) != len(violation.SpanRefs) {
		t.Errorf("Expected %d spanRefs, got %d", len(violation.SpanRefs), len(decoded.SpanRefs))
	}
}

// TestViolation_SpanRefMarshaling verifies SpanRef JSON encoding/decoding
func TestViolation_SpanRefMarshaling(t *testing.T) {
	spanRef := SpanRef{
		TraceID:     "trace-123",
		SpanID:      "span-456",
		ServiceName: "user-service",
	}

	// Marshal
	data, err := json.Marshal(spanRef)
	if err != nil {
		t.Fatalf("Failed to marshal spanRef: %v", err)
	}

	// Unmarshal
	var decoded SpanRef
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal spanRef: %v", err)
	}

	// Verify
	if decoded.TraceID != spanRef.TraceID {
		t.Errorf("Expected TraceID %s, got %s", spanRef.TraceID, decoded.TraceID)
	}
	if decoded.SpanID != spanRef.SpanID {
		t.Errorf("Expected SpanID %s, got %s", spanRef.SpanID, decoded.SpanID)
	}
	if decoded.ServiceName != spanRef.ServiceName {
		t.Errorf("Expected ServiceName %s, got %s", spanRef.ServiceName, decoded.ServiceName)
	}
}

// TestViolation_EmptyTraceIDs verifies handling of empty traceIDs
func TestViolation_EmptyTraceIDs(t *testing.T) {
	violation := Violation{
		ID:       "violation-123",
		RuleID:   "rule-456",
		Severity: "MEDIUM",
		TraceIDs: []string{},
	}

	data, err := json.Marshal(violation)
	if err != nil {
		t.Fatalf("Failed to marshal violation: %v", err)
	}

	var decoded Violation
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal violation: %v", err)
	}

	// Empty slice should be preserved (not null)
	if decoded.TraceIDs == nil {
		t.Error("Expected empty slice, got nil")
	}
	if len(decoded.TraceIDs) != 0 {
		t.Errorf("Expected 0 traceIDs, got %d", len(decoded.TraceIDs))
	}
}
