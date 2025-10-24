package api

import (
	"encoding/json"
	"net/http"

	"github.com/betracehq/betrace/backend/pkg/models"
	"go.opentelemetry.io/otel/trace"
)

// SpanHandlers provides HTTP handlers for span ingestion
type SpanHandlers struct {
	tracer trace.Tracer
}

// NewSpanHandlers creates span ingestion handlers
func NewSpanHandlers(tracer trace.Tracer) *SpanHandlers {
	return &SpanHandlers{
		tracer: tracer,
	}
}

// IngestSpan handles POST /api/spans
func (h *SpanHandlers) IngestSpan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span if tracer available
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "IngestSpan")
		defer span.End()
	}

	// Parse request body
	var span models.Span
	if err := json.NewDecoder(r.Body).Decode(&span); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// Validate required fields
	if span.SpanID == "" || span.TraceID == "" || span.OperationName == "" {
		respondError(w, http.StatusBadRequest, "Missing required fields: spanId, traceId, operationName")
		return
	}

	// TODO: Process span through rule engine
	// For now, just accept it

	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"message": "Span ingested successfully",
		"spanId":  span.SpanID,
		"traceId": span.TraceID,
	})
}

// IngestSpansBatch handles POST /api/spans/batch
func (h *SpanHandlers) IngestSpansBatch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span if tracer available
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "IngestSpansBatch")
		defer span.End()
	}

	// Parse request body
	var spans []models.Span
	if err := json.NewDecoder(r.Body).Decode(&spans); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// Process each span
	ingested := 0
	failed := 0
	for _, span := range spans {
		// Validate required fields
		if span.SpanID == "" || span.TraceID == "" || span.OperationName == "" {
			failed++
			continue
		}

		// TODO: Process span through rule engine
		ingested++
	}

	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"message":  "Batch ingestion completed",
		"ingested": ingested,
		"failed":   failed,
		"total":    len(spans),
	})
}
