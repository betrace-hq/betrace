package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/pkg/models"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// ViolationHandlers provides HTTP handlers for violation API
type ViolationHandlers struct {
	store  *services.ViolationStoreMemory
	tracer trace.Tracer
}

// NewViolationHandlers creates violation API handlers
func NewViolationHandlers(store *services.ViolationStoreMemory, tracer trace.Tracer) *ViolationHandlers {
	return &ViolationHandlers{
		store:  store,
		tracer: tracer,
	}
}

// GetViolations handles GET /api/violations
func (h *ViolationHandlers) GetViolations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span if tracer available
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "GetViolations")
		defer span.End()
	}

	// Parse query parameters
	filters := services.QueryFilters{
		RuleID:   r.URL.Query().Get("ruleId"),
		Severity: r.URL.Query().Get("severity"),
		Limit:    100,
	}

	// Parse 'since' parameter
	if sinceStr := r.URL.Query().Get("since"); sinceStr != "" {
		if since, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			filters.Since = since
		}
	}

	// Query violations
	violations, err := h.store.Query(ctx, filters)
	if err != nil {
		respondError(w, "Failed to query violations: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(
			attribute.Int("violations.count", len(violations)),
			attribute.String("violations.rule_id", filters.RuleID),
			attribute.String("violations.severity", filters.Severity),
		)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"violations": violations,
		"total":      len(violations),
	})
}

// GetViolationByID handles GET /api/violations/{id}
func (h *ViolationHandlers) GetViolationByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "GetViolationByID")
		defer span.End()
	}

	// Extract ID from URL path
	id := r.PathValue("id")
	if id == "" {
		respondError(w, "Missing violation ID", http.StatusBadRequest)
		return
	}

	// Query violation
	violation, err := h.store.GetByID(ctx, id)
	if err != nil {
		respondError(w, "Violation not found: "+id, http.StatusNotFound)
		return
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(
			attribute.String("violation.id", violation.ID),
			attribute.String("violation.rule_id", violation.RuleID),
			attribute.String("violation.severity", violation.Severity),
		)
	}

	respondJSON(w, http.StatusOK, violation)
}

// CreateViolation handles POST /api/violations
func (h *ViolationHandlers) CreateViolation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "CreateViolation")
		defer span.End()
	}

	// Parse request body
	var req struct {
		RuleID   string           `json:"ruleId"`
		RuleName string           `json:"ruleName"`
		Severity string           `json:"severity"`
		Message  string           `json:"message"`
		SpanRefs []models.SpanRef `json:"spanReferences"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.RuleID == "" || req.RuleName == "" {
		respondError(w, "Missing required fields: ruleId, ruleName", http.StatusBadRequest)
		return
	}

	// Create violation
	violation := models.Violation{
		RuleID:   req.RuleID,
		RuleName: req.RuleName,
		Severity: req.Severity,
		Message:  req.Message,
	}

	// Record violation and get back the stored version with generated ID
	violation, err := h.store.Record(ctx, violation, req.SpanRefs)
	if err != nil {
		respondError(w, "Failed to record violation: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(
			attribute.String("violation.id", violation.ID),
			attribute.String("violation.rule_id", violation.RuleID),
		)
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      violation.ID,
		"message": "Violation recorded successfully",
	})
}

// Helper functions moved to server.go to avoid duplication
