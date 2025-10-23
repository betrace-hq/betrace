package api

import (
	"encoding/json"
	"net/http"

	"github.com/betracehq/betrace/backend/internal/services"
	"github.com/betracehq/betrace/backend/pkg/models"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// RuleHandlers provides HTTP handlers for rule API
type RuleHandlers struct {
	store  *services.RuleStore
	tracer trace.Tracer
}

// NewRuleHandlers creates rule API handlers
func NewRuleHandlers(store *services.RuleStore, tracer trace.Tracer) *RuleHandlers {
	return &RuleHandlers{
		store:  store,
		tracer: tracer,
	}
}

// GetRules handles GET /api/rules
func (h *RuleHandlers) GetRules(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span if tracer available
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "GetRules")
		defer span.End()
	}

	// List all rules
	rules, err := h.store.List(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list rules: "+err.Error())
		return
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(attribute.Int("rules.count", len(rules)))
	}

	respondJSON(w, http.StatusOK, rules)
}

// GetRuleByID handles GET /api/rules/{id}
func (h *RuleHandlers) GetRuleByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "GetRuleByID")
		defer span.End()
	}

	// Extract ID from URL path
	id := r.PathValue("id")
	if id == "" {
		respondError(w, http.StatusBadRequest, "Missing rule ID")
		return
	}

	// Get rule
	rule, err := h.store.Get(ctx, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Rule not found: "+id)
		return
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(
			attribute.String("rule.id", rule.ID),
			attribute.String("rule.name", rule.Name),
		)
	}

	respondJSON(w, http.StatusOK, rule)
}

// CreateRule handles POST /api/rules
func (h *RuleHandlers) CreateRule(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "CreateRule")
		defer span.End()
	}

	// Parse request body
	var rule models.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// Validate required fields
	if rule.Name == "" || rule.Expression == "" {
		respondError(w, http.StatusBadRequest, "Missing required fields: name, expression")
		return
	}

	// Create rule
	created, err := h.store.Create(ctx, rule)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create rule: "+err.Error())
		return
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(
			attribute.String("rule.id", created.ID),
			attribute.String("rule.name", created.Name),
		)
	}

	respondJSON(w, http.StatusCreated, created)
}

// UpdateRule handles PUT /api/rules/{id}
func (h *RuleHandlers) UpdateRule(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "UpdateRule")
		defer span.End()
	}

	// Extract ID from URL path
	id := r.PathValue("id")
	if id == "" {
		respondError(w, http.StatusBadRequest, "Missing rule ID")
		return
	}

	// Parse request body
	var rule models.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// Update rule
	updated, err := h.store.Update(ctx, id, rule)
	if err != nil {
		respondError(w, http.StatusNotFound, "Rule not found: "+id)
		return
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(
			attribute.String("rule.id", updated.ID),
			attribute.String("rule.name", updated.Name),
		)
	}

	respondJSON(w, http.StatusOK, updated)
}

// DeleteRule handles DELETE /api/rules/{id}
func (h *RuleHandlers) DeleteRule(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Create span
	if h.tracer != nil {
		var span trace.Span
		ctx, span = h.tracer.Start(ctx, "DeleteRule")
		defer span.End()
	}

	// Extract ID from URL path
	id := r.PathValue("id")
	if id == "" {
		respondError(w, http.StatusBadRequest, "Missing rule ID")
		return
	}

	// Delete rule
	if err := h.store.Delete(ctx, id); err != nil {
		respondError(w, http.StatusNotFound, "Rule not found: "+id)
		return
	}

	// Add span attributes
	if h.tracer != nil {
		span := trace.SpanFromContext(ctx)
		span.SetAttributes(attribute.String("rule.id", id))
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Rule deleted successfully",
		"id":      id,
	})
}
