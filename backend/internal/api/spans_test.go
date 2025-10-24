package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/betracehq/betrace/backend/pkg/models"
	"go.opentelemetry.io/otel/trace"
)

// TestIngestSpans_ValidPayload verifies successful span ingestion
func TestIngestSpans_ValidPayload(t *testing.T) {
	handlers := NewSpanHandlers(nil)

	span := models.Span{
		SpanID:        "span-123",
		TraceID:       "trace-456",
		OperationName: "GET /api/users",
		ServiceName:   "user-service",
		Status:        "OK",
		Attributes:    map[string]string{"http.method": "GET"},
	}

	body, _ := json.Marshal(span)
	req := httptest.NewRequest(http.MethodPost, "/api/spans", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.IngestSpan(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("Expected status 202, got %d", w.Code)
	}
}

// TestIngestSpans_InvalidJSON verifies bad request handling
func TestIngestSpans_InvalidJSON(t *testing.T) {
	handlers := NewSpanHandlers(nil)

	req := httptest.NewRequest(http.MethodPost, "/api/spans", bytes.NewReader([]byte("invalid json")))
	w := httptest.NewRecorder()

	handlers.IngestSpan(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

// TestIngestSpans_MissingRequiredFields verifies validation
func TestIngestSpans_MissingRequiredFields(t *testing.T) {
	handlers := NewSpanHandlers(nil)

	tests := []struct {
		name string
		span models.Span
	}{
		{"missing spanID", models.Span{TraceID: "trace-123", OperationName: "test"}},
		{"missing traceID", models.Span{SpanID: "span-123", OperationName: "test"}},
		{"missing operationName", models.Span{SpanID: "span-123", TraceID: "trace-123"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.span)
			req := httptest.NewRequest(http.MethodPost, "/api/spans", bytes.NewReader(body))
			w := httptest.NewRecorder()

			handlers.IngestSpan(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("Expected status 400, got %d", w.Code)
			}
		})
	}
}

// TestIngestSpans_EmptyPayload verifies empty body handling
func TestIngestSpans_EmptyPayload(t *testing.T) {
	handlers := NewSpanHandlers(nil)

	req := httptest.NewRequest(http.MethodPost, "/api/spans", bytes.NewReader([]byte{}))
	w := httptest.NewRecorder()

	handlers.IngestSpan(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

// TestIngestSpansBatch_MultipleSpans verifies batch ingestion
func TestIngestSpansBatch_MultipleSpans(t *testing.T) {
	handlers := NewSpanHandlers(nil)

	spans := []models.Span{
		{SpanID: "span-1", TraceID: "trace-1", OperationName: "op1", ServiceName: "svc1", Status: "OK"},
		{SpanID: "span-2", TraceID: "trace-1", OperationName: "op2", ServiceName: "svc1", Status: "OK"},
		{SpanID: "span-3", TraceID: "trace-2", OperationName: "op3", ServiceName: "svc2", Status: "ERROR"},
	}

	body, _ := json.Marshal(spans)
	req := httptest.NewRequest(http.MethodPost, "/api/spans/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.IngestSpansBatch(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("Expected status 202, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response["ingested"] != float64(3) {
		t.Errorf("Expected 3 spans ingested, got %v", response["ingested"])
	}
}

// TestIngestSpansBatch_EmptyArray verifies empty batch handling
func TestIngestSpansBatch_EmptyArray(t *testing.T) {
	handlers := NewSpanHandlers(nil)

	body, _ := json.Marshal([]models.Span{})
	req := httptest.NewRequest(http.MethodPost, "/api/spans/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.IngestSpansBatch(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("Expected status 202, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response["ingested"] != float64(0) {
		t.Errorf("Expected 0 spans ingested, got %v", response["ingested"])
	}
}

// TestIngestSpansBatch_PartialValidation verifies partial validation
func TestIngestSpansBatch_PartialValidation(t *testing.T) {
	handlers := NewSpanHandlers(nil)

	spans := []models.Span{
		{SpanID: "span-1", TraceID: "trace-1", OperationName: "valid", ServiceName: "svc1", Status: "OK"},
		{SpanID: "", TraceID: "trace-2", OperationName: "invalid", ServiceName: "svc2", Status: "OK"}, // missing spanID
		{SpanID: "span-3", TraceID: "trace-3", OperationName: "valid", ServiceName: "svc3", Status: "OK"},
	}

	body, _ := json.Marshal(spans)
	req := httptest.NewRequest(http.MethodPost, "/api/spans/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.IngestSpansBatch(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("Expected status 202, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Should ingest 2 valid spans and skip 1 invalid
	if response["ingested"] != float64(2) {
		t.Errorf("Expected 2 valid spans ingested, got %v", response["ingested"])
	}
	if response["failed"] != float64(1) {
		t.Errorf("Expected 1 failed span, got %v", response["failed"])
	}
}

// TestSpansAPI_WithTracer verifies OpenTelemetry span creation
func TestSpansAPI_WithTracer(t *testing.T) {
	// Create no-op tracer
	tracer := trace.NewNoopTracerProvider().Tracer("test")
	handlers := NewSpanHandlers(tracer)

	// Test IngestSpan with tracer
	span := models.Span{
		SpanID:        "span-123",
		TraceID:       "trace-456",
		OperationName: "GET /api/users",
		ServiceName:   "user-service",
		Status:        "OK",
		Attributes:    map[string]string{"http.method": "GET"},
	}

	body, _ := json.Marshal(span)
	req := httptest.NewRequest(http.MethodPost, "/api/spans", bytes.NewReader(body))
	w := httptest.NewRecorder()

	handlers.IngestSpan(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("Expected status 202, got %d", w.Code)
	}

	// Test IngestSpansBatch with tracer
	spans := []models.Span{
		{SpanID: "span-1", TraceID: "trace-1", OperationName: "op1", ServiceName: "svc1", Status: "OK"},
		{SpanID: "span-2", TraceID: "trace-1", OperationName: "op2", ServiceName: "svc1", Status: "OK"},
	}

	body, _ = json.Marshal(spans)
	req = httptest.NewRequest(http.MethodPost, "/api/spans/batch", bytes.NewReader(body))
	w = httptest.NewRecorder()

	handlers.IngestSpansBatch(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("Expected status 202, got %d", w.Code)
	}
}
