package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/betracehq/betrace/backend/internal/observability"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/pkg/models"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Server handles HTTP requests for BeTrace API
type Server struct {
	engine    *rules.RuleEngine
	startTime time.Time
	version   string
}

// NewServer creates a new API server
func NewServer(version string) *Server {
	return &Server{
		engine:    rules.NewRuleEngine(),
		startTime: time.Now(),
		version:   version,
	}
}

// RegisterRoutes registers all HTTP routes
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	// Health & Metrics
	mux.HandleFunc("/health", s.handleHealth)
	mux.Handle("/metrics", promhttp.Handler())

	// Rules API
	mux.HandleFunc("/api/v1/rules", s.handleRules)
	mux.HandleFunc("/api/v1/rules/", s.handleRuleByID)

	// Evaluation API
	mux.HandleFunc("/api/v1/evaluate", s.handleEvaluate)
	mux.HandleFunc("/api/v1/evaluate/batch", s.handleEvaluateBatch)

	// Compliance API
	mux.HandleFunc("/api/v1/compliance/evidence", s.handleComplianceEvidence)
	mux.HandleFunc("/api/v1/compliance/export", s.handleComplianceExport)
}

// Middleware wraps handlers with common functionality
func (s *Server) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Start trace span
		ctx, span := observability.Tracer.Start(r.Context(), fmt.Sprintf("%s %s", r.Method, r.URL.Path))
		defer span.End()

		// Add trace context to request
		r = r.WithContext(ctx)

		// CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Content type
		w.Header().Set("Content-Type", "application/json")

		next.ServeHTTP(w, r)
	})
}

// Health check handler
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	uptime := int64(time.Since(s.startTime).Seconds())

	response := map[string]interface{}{
		"status":  "healthy",
		"version": s.version,
		"uptime":  uptime,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// Rules handlers
func (s *Server) handleRules(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListRules(w, r)
	case http.MethodPost:
		s.handleCreateRule(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleListRules(w http.ResponseWriter, r *http.Request) {
	allRules := s.engine.ListRules()

	response := map[string]interface{}{
		"rules": allRules,
		"total": len(allRules),
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleCreateRule(w http.ResponseWriter, r *http.Request) {
	var rule models.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if rule.ID == "" || rule.Expression == "" {
		respondError(w, "Missing required fields: id, expression", http.StatusBadRequest)
		return
	}

	// Load rule with observability
	if err := s.engine.LoadRuleWithObservability(r.Context(), rule); err != nil {
		respondError(w, fmt.Sprintf("Failed to load rule: %v", err), http.StatusBadRequest)
		return
	}

	// Emit SOC2 CC8.1 evidence (Change Management)
	observability.EmitComplianceEvidence(r.Context(), observability.SOC2_CC8_1, "rule_created", map[string]interface{}{
		"rule_id":    rule.ID,
		"expression": rule.Expression,
		"enabled":    rule.Enabled,
	})

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rule)
}

func (s *Server) handleRuleByID(w http.ResponseWriter, r *http.Request) {
	// Extract rule ID from path
	ruleID := r.URL.Path[len("/api/v1/rules/"):]
	if ruleID == "" {
		respondError(w, "Missing rule ID", http.StatusBadRequest)
		return
	}

	// Handle special endpoints
	if len(ruleID) > 7 && ruleID[len(ruleID)-7:] == "/enable" {
		s.handleEnableRule(w, r, ruleID[:len(ruleID)-7])
		return
	}
	if len(ruleID) > 8 && ruleID[len(ruleID)-8:] == "/disable" {
		s.handleDisableRule(w, r, ruleID[:len(ruleID)-8])
		return
	}
	if len(ruleID) > 8 && ruleID[len(ruleID)-8:] == "/matches" {
		s.handleRuleMatches(w, r, ruleID[:len(ruleID)-8])
		return
	}

	switch r.Method {
	case http.MethodGet:
		s.handleGetRule(w, r, ruleID)
	case http.MethodPut:
		s.handleUpdateRule(w, r, ruleID)
	case http.MethodDelete:
		s.handleDeleteRule(w, r, ruleID)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleGetRule(w http.ResponseWriter, r *http.Request, ruleID string) {
	rule, exists := s.engine.GetRule(ruleID)
	if !exists {
		respondError(w, "Rule not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(rule.Rule)
}

func (s *Server) handleUpdateRule(w http.ResponseWriter, r *http.Request, ruleID string) {
	var rule models.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	rule.ID = ruleID // Ensure ID matches path

	if err := s.engine.LoadRuleWithObservability(r.Context(), rule); err != nil {
		respondError(w, fmt.Sprintf("Failed to update rule: %v", err), http.StatusBadRequest)
		return
	}

	// Emit SOC2 CC8.1 evidence (Change Management)
	observability.EmitComplianceEvidence(r.Context(), observability.SOC2_CC8_1, "rule_updated", map[string]interface{}{
		"rule_id":    rule.ID,
		"expression": rule.Expression,
	})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(rule)
}

func (s *Server) handleDeleteRule(w http.ResponseWriter, r *http.Request, ruleID string) {
	s.engine.DeleteRule(ruleID)

	// Emit SOC2 CC8.1 evidence (Change Management)
	observability.EmitComplianceEvidence(r.Context(), observability.SOC2_CC8_1, "rule_deleted", map[string]interface{}{
		"rule_id": ruleID,
	})

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleEnableRule(w http.ResponseWriter, r *http.Request, ruleID string) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rule, exists := s.engine.GetRule(ruleID)
	if !exists {
		respondError(w, "Rule not found", http.StatusNotFound)
		return
	}

	rule.Rule.Enabled = true
	s.engine.LoadRuleWithObservability(r.Context(), rule.Rule)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(rule.Rule)
}

func (s *Server) handleDisableRule(w http.ResponseWriter, r *http.Request, ruleID string) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rule, exists := s.engine.GetRule(ruleID)
	if !exists {
		respondError(w, "Rule not found", http.StatusNotFound)
		return
	}

	rule.Rule.Enabled = false
	s.engine.LoadRuleWithObservability(r.Context(), rule.Rule)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(rule.Rule)
}

func (s *Server) handleRuleMatches(w http.ResponseWriter, r *http.Request, ruleID string) {
	// TODO: Implement rule matches query (requires storing match history)
	respondError(w, "Not implemented yet", http.StatusNotImplemented)
}

// Evaluation handlers
func (s *Server) handleEvaluate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var span models.Span
	if err := json.NewDecoder(r.Body).Decode(&span); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	startTime := time.Now()

	// Evaluate with observability
	matches, err := s.engine.EvaluateAllWithObservability(r.Context(), &span)
	if err != nil {
		respondError(w, fmt.Sprintf("Evaluation failed: %v", err), http.StatusInternalServerError)
		return
	}

	duration := time.Since(startTime)

	response := map[string]interface{}{
		"spanId":      span.SpanID,
		"matches":     matches,
		"evaluatedAt": time.Now().Format(time.RFC3339),
		"duration":    duration.Seconds() * 1000, // milliseconds
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleEvaluateBatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Spans []models.Span `json:"spans"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	results := make([]map[string]interface{}, 0, len(request.Spans))

	for _, span := range request.Spans {
		startTime := time.Now()
		matches, err := s.engine.EvaluateAllWithObservability(r.Context(), &span)
		duration := time.Since(startTime)

		result := map[string]interface{}{
			"spanId":      span.SpanID,
			"evaluatedAt": time.Now().Format(time.RFC3339),
			"duration":    duration.Seconds() * 1000,
		}

		if err != nil {
			result["error"] = err.Error()
		} else {
			result["matches"] = matches
		}

		results = append(results, result)
	}

	response := map[string]interface{}{
		"results": results,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// Compliance handlers
func (s *Server) handleComplianceEvidence(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// TODO: Implement compliance evidence query (requires Tempo integration)
	respondError(w, "Not implemented yet - query Tempo directly via Grafana", http.StatusNotImplemented)
}

func (s *Server) handleComplianceExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// TODO: Implement compliance export (requires Tempo integration)
	respondError(w, "Not implemented yet - use Grafana export or Tempo API", http.StatusNotImplemented)
}

// Helper functions
func respondJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, message string, status int) {
	respondJSON(w, status, map[string]interface{}{
		"error": message,
		"code":  http.StatusText(status),
	})
}

// Run starts the HTTP server
func (s *Server) Run(ctx context.Context, addr string) error {
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)

	handler := s.Middleware(mux)

	server := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(shutdownCtx)
	}()

	fmt.Printf("🚀 BeTrace API server listening on %s\n", addr)
	fmt.Printf("📖 API documentation: http://%s/api/docs\n", addr)
	fmt.Printf("📊 Metrics: http://%s/metrics\n", addr)
	fmt.Printf("💚 Health: http://%s/health\n", addr)

	return server.ListenAndServe()
}
