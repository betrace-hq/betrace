package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/pkg/models"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/sdk/trace"
)

// Test helpers

func setupTestHandlers() (*ViolationHandlers, *services.ViolationStoreMemory) {
	store := services.NewViolationStoreMemory("test-signature-key")
	handlers := NewViolationHandlers(store, nil) // No tracer for basic tests
	return handlers, store
}

func setupTestHandlersWithTracer() (*ViolationHandlers, *services.ViolationStoreMemory, *trace.TracerProvider) {
	store := services.NewViolationStoreMemory("test-signature-key")
	tp := trace.NewTracerProvider()
	otel.SetTracerProvider(tp)
	tracer := tp.Tracer("test-tracer")
	handlers := NewViolationHandlers(store, tracer)
	return handlers, store, tp
}

// P0-1: GetViolations Handler Tests

func TestGetViolations_Success(t *testing.T) {
	handlers, store := setupTestHandlers()

	// Create test violations
	violations := []models.Violation{
		{RuleID: "rule-1", RuleName: "Test Rule 1", Severity: "HIGH", Message: "Test message 1"},
		{RuleID: "rule-2", RuleName: "Test Rule 2", Severity: "MEDIUM", Message: "Test message 2"},
		{RuleID: "rule-3", RuleName: "Test Rule 3", Severity: "LOW", Message: "Test message 3"},
	}

	for _, v := range violations {
		if _, err := store.Record(context.Background(), v, nil); err != nil {
			t.Fatalf("Failed to record violation: %v", err)
		}
	}

	// Make request
	req := httptest.NewRequest("GET", "/api/violations", nil)
	w := httptest.NewRecorder()

	handlers.GetViolations(w, req)

	// Assert response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if total, ok := response["total"].(float64); !ok || int(total) != 3 {
		t.Errorf("Expected total=3, got %v", response["total"])
	}

	violationsResp, ok := response["violations"].([]interface{})
	if !ok || len(violationsResp) != 3 {
		t.Errorf("Expected 3 violations, got %v", violationsResp)
	}
}

func TestGetViolations_FilterByRuleID(t *testing.T) {
	handlers, store := setupTestHandlers()

	// Create violations with different ruleIDs
	violations := []models.Violation{
		{RuleID: "rule-A", RuleName: "Rule A", Severity: "HIGH", Message: "Message A1"},
		{RuleID: "rule-A", RuleName: "Rule A", Severity: "MEDIUM", Message: "Message A2"},
		{RuleID: "rule-B", RuleName: "Rule B", Severity: "HIGH", Message: "Message B1"},
	}

	for _, v := range violations {
		if _, err := store.Record(context.Background(), v, nil); err != nil {
			t.Fatalf("Failed to record violation: %v", err)
		}
	}

	// Filter by rule-A
	req := httptest.NewRequest("GET", "/api/violations?ruleId=rule-A", nil)
	w := httptest.NewRecorder()

	handlers.GetViolations(w, req)

	var response map[string]interface{}
	json.NewDecoder(w.Body).Decode(&response)

	violationsResp := response["violations"].([]interface{})
	if len(violationsResp) != 2 {
		t.Errorf("Expected 2 violations for rule-A, got %d", len(violationsResp))
	}

	// Verify all returned violations have ruleId=rule-A
	for _, v := range violationsResp {
		vMap := v.(map[string]interface{})
		if vMap["ruleId"] != "rule-A" {
			t.Errorf("Expected ruleId=rule-A, got %v", vMap["ruleId"])
		}
	}
}

func TestGetViolations_FilterBySeverity(t *testing.T) {
	handlers, store := setupTestHandlers()

	// Create violations with different severities
	violations := []models.Violation{
		{RuleID: "rule-1", RuleName: "Rule 1", Severity: "HIGH", Message: "High severity 1"},
		{RuleID: "rule-2", RuleName: "Rule 2", Severity: "HIGH", Message: "High severity 2"},
		{RuleID: "rule-3", RuleName: "Rule 3", Severity: "MEDIUM", Message: "Medium severity"},
	}

	for _, v := range violations {
		if _, err := store.Record(context.Background(), v, nil); err != nil {
			t.Fatalf("Failed to record violation: %v", err)
		}
	}

	// Filter by HIGH severity
	req := httptest.NewRequest("GET", "/api/violations?severity=HIGH", nil)
	w := httptest.NewRecorder()

	handlers.GetViolations(w, req)

	var response map[string]interface{}
	json.NewDecoder(w.Body).Decode(&response)

	violationsResp := response["violations"].([]interface{})
	if len(violationsResp) != 2 {
		t.Errorf("Expected 2 HIGH violations, got %d", len(violationsResp))
	}
}

func TestGetViolations_FilterBySince(t *testing.T) {
	t.Skip("TODO: 'since' filtering not yet implemented in memory storage")
	// TODO: Add this test once memory.QueryViolations supports 'since' parameter
	// Currently QueryViolations(ruleID, severity, limit) doesn't have 'since'
}

func TestGetViolations_InvalidSinceParameter(t *testing.T) {
	handlers, store := setupTestHandlers()

	// Create a violation
	v := models.Violation{RuleID: "rule-1", RuleName: "Rule 1", Severity: "HIGH", Message: "Test"}
	if _, err := store.Record(context.Background(), v, nil); err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	// Request with invalid since parameter (should be ignored)
	req := httptest.NewRequest("GET", "/api/violations?since=invalid-date", nil)
	w := httptest.NewRecorder()

	handlers.GetViolations(w, req)

	// Should still return 200 with all violations (invalid since ignored)
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	json.NewDecoder(w.Body).Decode(&response)

	if total, ok := response["total"].(float64); !ok || int(total) != 1 {
		t.Errorf("Expected total=1, got %v", response["total"])
	}
}

func TestGetViolations_EmptyStore(t *testing.T) {
	handlers, _ := setupTestHandlers()

	req := httptest.NewRequest("GET", "/api/violations", nil)
	w := httptest.NewRecorder()

	handlers.GetViolations(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	json.NewDecoder(w.Body).Decode(&response)

	if total, ok := response["total"].(float64); !ok || int(total) != 0 {
		t.Errorf("Expected total=0, got %v", response["total"])
	}

	violationsResp := response["violations"].([]interface{})
	if len(violationsResp) != 0 {
		t.Errorf("Expected empty violations array, got %d", len(violationsResp))
	}
}

func TestGetViolations_OpenTelemetrySpanEmission(t *testing.T) {
	handlers, store, tp := setupTestHandlersWithTracer()
	defer tp.Shutdown(context.Background())

	// Create test violation
	v := models.Violation{RuleID: "rule-1", RuleName: "Rule 1", Severity: "HIGH", Message: "Test"}
	if _, err := store.Record(context.Background(), v, nil); err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	// Make request
	req := httptest.NewRequest("GET", "/api/violations?ruleId=rule-1&severity=HIGH", nil)
	w := httptest.NewRecorder()

	handlers.GetViolations(w, req)

	// Verify span was created (basic check - full validation would use span exporter)
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200 with tracing enabled, got %d", w.Code)
	}

	// Note: Full span attribute validation requires a test exporter
	// This test verifies the handler doesn't panic with tracer enabled
}

// P0-2: GetViolationByID Handler Tests

func TestGetViolationByID_Success(t *testing.T) {
	handlers, store := setupTestHandlers()

	// Create violation
	v := models.Violation{
		ID:       "abc-123",
		RuleID:   "rule-1",
		RuleName: "Test Rule",
		Severity: "HIGH",
		Message:  "Test message",
	}
	if _, err := store.Record(context.Background(), v, nil); err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	// Make request
	req := httptest.NewRequest("GET", "/api/violations/abc-123", nil)
	req.SetPathValue("id", "abc-123")
	w := httptest.NewRecorder()

	handlers.GetViolationByID(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response models.Violation
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response.ID != "abc-123" {
		t.Errorf("Expected ID=abc-123, got %s", response.ID)
	}
	if response.RuleID != "rule-1" {
		t.Errorf("Expected RuleID=rule-1, got %s", response.RuleID)
	}
}

func TestGetViolationByID_NotFound(t *testing.T) {
	handlers, _ := setupTestHandlers()

	req := httptest.NewRequest("GET", "/api/violations/nonexistent", nil)
	req.SetPathValue("id", "nonexistent")
	w := httptest.NewRecorder()

	handlers.GetViolationByID(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}

	var response map[string]string
	json.NewDecoder(w.Body).Decode(&response)

	if response["error"] == "" {
		t.Error("Expected error message in response")
	}
}

func TestGetViolationByID_MissingID(t *testing.T) {
	handlers, _ := setupTestHandlers()

	req := httptest.NewRequest("GET", "/api/violations/", nil)
	// Don't set PathValue - simulates empty ID
	w := httptest.NewRecorder()

	handlers.GetViolationByID(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestGetViolationByID_OpenTelemetrySpan(t *testing.T) {
	handlers, store, tp := setupTestHandlersWithTracer()
	defer tp.Shutdown(context.Background())

	// Create violation
	v := models.Violation{ID: "test-id", RuleID: "rule-1", RuleName: "Test", Severity: "HIGH", Message: "Test"}
	if _, err := store.Record(context.Background(), v, nil); err != nil {
		t.Fatalf("Failed to record violation: %v", err)
	}

	req := httptest.NewRequest("GET", "/api/violations/test-id", nil)
	req.SetPathValue("id", "test-id")
	w := httptest.NewRecorder()

	handlers.GetViolationByID(w, req)

	// Verify handler succeeds with tracing enabled
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200 with tracing, got %d", w.Code)
	}
}

// P0-3: CreateViolation Handler Tests

func TestCreateViolation_Success(t *testing.T) {
	handlers, store := setupTestHandlers()

	reqBody := map[string]interface{}{
		"ruleId":   "rule-123",
		"ruleName": "Test Rule",
		"severity": "HIGH",
		"message":  "Test violation message",
		"spanReferences": []map[string]string{
			{"traceId": "trace-1", "spanId": "span-1", "serviceName": "api-service"},
		},
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}

	var response map[string]interface{}
	json.NewDecoder(w.Body).Decode(&response)

	if response["id"] == "" {
		t.Error("Expected generated ID in response")
	}

	// Verify violation was stored
	violations, _ := store.Query(context.Background(), services.QueryFilters{RuleID: "rule-123"})
	if len(violations) != 1 {
		t.Errorf("Expected 1 stored violation, got %d", len(violations))
	}
}

func TestCreateViolation_MissingRuleID(t *testing.T) {
	handlers, _ := setupTestHandlers()

	reqBody := map[string]interface{}{
		"ruleName": "Test Rule",
		"severity": "HIGH",
		"message":  "Missing ruleId",
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}

	var response map[string]string
	json.NewDecoder(w.Body).Decode(&response)

	if response["error"] == "" {
		t.Error("Expected error message about missing fields")
	}
}

func TestCreateViolation_MissingRuleName(t *testing.T) {
	handlers, _ := setupTestHandlers()

	reqBody := map[string]interface{}{
		"ruleId":   "rule-123",
		"severity": "HIGH",
		"message":  "Missing ruleName",
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestCreateViolation_InvalidJSON(t *testing.T) {
	handlers, _ := setupTestHandlers()

	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader([]byte("invalid json")))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid JSON, got %d", w.Code)
	}

	var response map[string]string
	json.NewDecoder(w.Body).Decode(&response)

	if response["error"] == "" {
		t.Error("Expected error message about invalid JSON")
	}
}

func TestCreateViolation_WithSpanReferences(t *testing.T) {
	handlers, store := setupTestHandlers()

	spanRefs := []map[string]string{
		{"traceId": "trace-1", "spanId": "span-1", "serviceName": "service-1"},
		{"traceId": "trace-2", "spanId": "span-2", "serviceName": "service-2"},
		{"traceId": "trace-3", "spanId": "span-3", "serviceName": "service-3"},
	}

	reqBody := map[string]interface{}{
		"ruleId":          "rule-123",
		"ruleName":        "Test Rule",
		"severity":        "HIGH",
		"message":         "Test with spans",
		"spanReferences":  spanRefs,
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}

	// Verify span references were stored
	violations, _ := store.Query(context.Background(), services.QueryFilters{RuleID: "rule-123"})
	if len(violations) != 1 {
		t.Fatal("Expected 1 violation stored")
	}

	if len(violations[0].SpanRefs) != 3 {
		t.Errorf("Expected 3 span references, got %d", len(violations[0].SpanRefs))
	}

	if len(violations[0].TraceIDs) != 3 {
		t.Errorf("Expected 3 trace IDs, got %d", len(violations[0].TraceIDs))
	}
}

func TestCreateViolation_OpenTelemetrySpan(t *testing.T) {
	handlers, _, tp := setupTestHandlersWithTracer()
	defer tp.Shutdown(context.Background())

	reqBody := map[string]interface{}{
		"ruleId":   "rule-123",
		"ruleName": "Test Rule",
		"severity": "HIGH",
		"message":  "Test",
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	// Verify handler succeeds with tracing enabled
	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201 with tracing, got %d", w.Code)
	}
}

// P1-2: Input Validation Tests (Security)

func TestCreateViolation_SQLInjectionAttempt(t *testing.T) {
	handlers, store := setupTestHandlers()

	reqBody := map[string]interface{}{
		"ruleId":   "'; DROP TABLE violations; --",
		"ruleName": "SQL Injection Attempt",
		"severity": "HIGH",
		"message":  "Test SQL injection",
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	// Should succeed - SQL injection payload stored as regular string
	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d (SQL injection should be stored safely)", w.Code)
	}

	// Verify stored safely
	violations, _ := store.Query(context.Background(), services.QueryFilters{})
	if len(violations) != 1 {
		t.Errorf("Expected 1 violation (SQL injection stored as string), got %d", len(violations))
	}

	if violations[0].RuleID != "'; DROP TABLE violations; --" {
		t.Error("SQL injection payload should be stored as-is")
	}
}

func TestCreateViolation_XSSAttempt(t *testing.T) {
	handlers, store := setupTestHandlers()

	reqBody := map[string]interface{}{
		"ruleId":   "rule-xss",
		"ruleName": "XSS Test",
		"severity": "HIGH",
		"message":  "<script>alert('XSS')</script>",
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	// Should succeed - backend stores as-is, frontend responsible for escaping
	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}

	violations, _ := store.Query(context.Background(), services.QueryFilters{RuleID: "rule-xss"})
	if violations[0].Message != "<script>alert('XSS')</script>" {
		t.Error("XSS payload should be stored as-is (frontend escapes)")
	}
}

func TestCreateViolation_ExtremelyLargePayload(t *testing.T) {
	handlers, _ := setupTestHandlers()

	// Create 10KB message (extreme but not unreasonable for stack traces)
	largeMessage := string(make([]byte, 10*1024))
	for i := range largeMessage {
		largeMessage = string(append([]byte(largeMessage)[:i], 'A'))
	}

	reqBody := map[string]interface{}{
		"ruleId":   "rule-large",
		"ruleName": "Large Payload Test",
		"severity": "HIGH",
		"message":  largeMessage[:10240], // 10KB
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/api/violations", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateViolation(w, req)

	// Should handle gracefully (accept or reject, but no crash)
	if w.Code != http.StatusCreated && w.Code != http.StatusBadRequest {
		t.Errorf("Expected 201 or 400 for large payload, got %d", w.Code)
	}
}
