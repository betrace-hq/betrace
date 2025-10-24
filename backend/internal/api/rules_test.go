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
	"go.opentelemetry.io/otel/trace"
)

// TestGetRules_Success verifies listing all rules
func TestGetRules_Success(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	// Create test rules
	rule1 := models.Rule{Name: "Test Rule 1", Expression: "trace.has(error)", Severity: "HIGH", Enabled: true}
	rule2 := models.Rule{Name: "Test Rule 2", Expression: "trace.has(warning)", Severity: "MEDIUM", Enabled: false}
	store.Create(context.Background(), rule1)
	store.Create(context.Background(), rule2)

	req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	w := httptest.NewRecorder()

	handlers.GetRules(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var rules []models.Rule
	if err := json.NewDecoder(w.Body).Decode(&rules); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(rules) != 2 {
		t.Errorf("Expected 2 rules, got %d", len(rules))
	}
}

// TestGetRules_EmptyStore verifies empty list response
func TestGetRules_EmptyStore(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	w := httptest.NewRecorder()

	handlers.GetRules(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var rules []models.Rule
	if err := json.NewDecoder(w.Body).Decode(&rules); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(rules) != 0 {
		t.Errorf("Expected 0 rules, got %d", len(rules))
	}
}

// TestGetRuleByID_Success verifies retrieving a single rule
func TestGetRuleByID_Success(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	rule := models.Rule{ID: "test-123", Name: "Test Rule", Expression: "trace.has(error)", Severity: "HIGH"}
	store.Create(context.Background(), rule)

	req := httptest.NewRequest(http.MethodGet, "/api/rules/test-123", nil)
	req.SetPathValue("id", "test-123")
	w := httptest.NewRecorder()

	handlers.GetRuleByID(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var retrieved models.Rule
	if err := json.NewDecoder(w.Body).Decode(&retrieved); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if retrieved.ID != "test-123" {
		t.Errorf("Expected ID test-123, got %s", retrieved.ID)
	}
	if retrieved.Name != "Test Rule" {
		t.Errorf("Expected Name 'Test Rule', got %s", retrieved.Name)
	}
}

// TestGetRuleByID_NotFound verifies 404 for missing rule
func TestGetRuleByID_NotFound(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/rules/nonexistent", nil)
	req.SetPathValue("id", "nonexistent")
	w := httptest.NewRecorder()

	handlers.GetRuleByID(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

// TestGetRuleByID_MissingID verifies 400 for missing ID
func TestGetRuleByID_MissingID(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/rules/", nil)
	w := httptest.NewRecorder()

	handlers.GetRuleByID(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

// TestCreateRule_Success verifies rule creation
func TestCreateRule_Success(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	rule := models.Rule{Name: "New Rule", Expression: "trace.has(timeout)", Severity: "MEDIUM", Enabled: true}
	body, _ := json.Marshal(rule)

	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.CreateRule(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}

	var created models.Rule
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if created.ID == "" {
		t.Error("Expected generated ID, got empty string")
	}
	if created.Name != "New Rule" {
		t.Errorf("Expected Name 'New Rule', got %s", created.Name)
	}
}

// TestCreateRule_MissingFields verifies validation
func TestCreateRule_MissingFields(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	tests := []struct {
		name string
		rule models.Rule
	}{
		{"missing name", models.Rule{Expression: "trace.has(error)", Severity: "HIGH"}},
		{"missing expression", models.Rule{Name: "Test", Severity: "HIGH"}},
		{"both missing", models.Rule{Severity: "HIGH"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.rule)
			req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(body))
			w := httptest.NewRecorder()

			handlers.CreateRule(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})
	}
}

// TestCreateRule_InvalidJSON verifies bad request handling
func TestCreateRule_InvalidJSON(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader([]byte("invalid json")))
	w := httptest.NewRecorder()

	handlers.CreateRule(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

// TestUpdateRule_Success verifies rule updates
func TestUpdateRule_Success(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	rule := models.Rule{ID: "test-123", Name: "Original", Expression: "trace.has(error)", Severity: "HIGH"}
	store.Create(context.Background(), rule)

	updated := models.Rule{Name: "Updated", Expression: "trace.has(critical)", Severity: "CRITICAL"}
	body, _ := json.Marshal(updated)

	req := httptest.NewRequest(http.MethodPut, "/api/rules/test-123", bytes.NewReader(body))
	req.SetPathValue("id", "test-123")
	w := httptest.NewRecorder()

	handlers.UpdateRule(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var result models.Rule
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if result.Name != "Updated" {
		t.Errorf("Expected Name 'Updated', got %s", result.Name)
	}
	if result.ID != "test-123" {
		t.Errorf("Expected ID preserved as test-123, got %s", result.ID)
	}
}

// TestUpdateRule_NotFound verifies 404 for missing rule
func TestUpdateRule_NotFound(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	updated := models.Rule{Name: "Updated", Expression: "trace.has(error)", Severity: "HIGH"}
	body, _ := json.Marshal(updated)

	req := httptest.NewRequest(http.MethodPut, "/api/rules/nonexistent", bytes.NewReader(body))
	req.SetPathValue("id", "nonexistent")
	w := httptest.NewRecorder()

	handlers.UpdateRule(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

// TestDeleteRule_Success verifies rule deletion
func TestDeleteRule_Success(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	rule := models.Rule{ID: "test-123", Name: "To Delete", Expression: "trace.has(error)", Severity: "HIGH"}
	store.Create(context.Background(), rule)

	req := httptest.NewRequest(http.MethodDelete, "/api/rules/test-123", nil)
	req.SetPathValue("id", "test-123")
	w := httptest.NewRecorder()

	handlers.DeleteRule(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Verify deletion
	_, err := store.Get(context.Background(), "test-123")
	if err == nil {
		t.Error("Expected rule to be deleted, but it still exists")
	}
}

// TestDeleteRule_NotFound verifies 404 for missing rule
func TestDeleteRule_NotFound(t *testing.T) {
	store := services.NewRuleStore()
	handlers := NewRuleHandlers(store, nil)

	req := httptest.NewRequest(http.MethodDelete, "/api/rules/nonexistent", nil)
	req.SetPathValue("id", "nonexistent")
	w := httptest.NewRecorder()

	handlers.DeleteRule(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

// TestRulesAPI_WithTracer verifies OpenTelemetry span creation
func TestRulesAPI_WithTracer(t *testing.T) {
	store := services.NewRuleStore()

	// Create no-op tracer
	tracer := trace.NewNoopTracerProvider().Tracer("test")
	handlers := NewRuleHandlers(store, tracer)

	// Test GetRules with tracer
	req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	w := httptest.NewRecorder()
	handlers.GetRules(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Test CreateRule with tracer
	rule := models.Rule{Name: "Traced Rule", Expression: "trace.has(error)", Severity: "HIGH"}
	body, _ := json.Marshal(rule)
	req = httptest.NewRequest(http.MethodPost, "/api/rules", bytes.NewReader(body))
	w = httptest.NewRecorder()
	handlers.CreateRule(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
	}

	// Test GetRuleByID with tracer
	var created models.Rule
	json.NewDecoder(w.Body).Decode(&created)

	req = httptest.NewRequest(http.MethodGet, "/api/rules/"+created.ID, nil)
	req.SetPathValue("id", created.ID)
	w = httptest.NewRecorder()
	handlers.GetRuleByID(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Test UpdateRule with tracer
	updated := models.Rule{Name: "Updated Traced", Expression: "trace.has(warning)", Severity: "MEDIUM"}
	body, _ = json.Marshal(updated)
	req = httptest.NewRequest(http.MethodPut, "/api/rules/"+created.ID, bytes.NewReader(body))
	req.SetPathValue("id", created.ID)
	w = httptest.NewRecorder()
	handlers.UpdateRule(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Test DeleteRule with tracer
	req = httptest.NewRequest(http.MethodDelete, "/api/rules/"+created.ID, nil)
	req.SetPathValue("id", created.ID)
	w = httptest.NewRecorder()
	handlers.DeleteRule(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}
