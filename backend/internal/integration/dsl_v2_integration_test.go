package integration

import (
	"context"
	"fmt"
	"testing"

	"github.com/betracehq/betrace/backend/internal/dsl"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/pkg/models"
)

// TestDSLv2PaymentFraudRule tests a real-world DSL v2.0 rule
func TestDSLv2PaymentFraudRule(t *testing.T) {
	// Create rule engine
	engine := rules.NewRuleEngine()

	// Load a DSL v2.0 rule from our examples
	rule := models.Rule{
		ID:          "payment-fraud-check-required",
		Name:        "Payment Fraud Check Required for High-Value Transactions",
		Description: "Ensures all payment charges over $1000 include fraud validation",
		Expression:  "when { payment.charge_card.where(amount > 1000) } always { payment.fraud_check }",
		Severity:    "critical",
		Enabled:     true,
	}

	// Load the rule (this will parse it with DSL v2.0)
	err := engine.LoadRule(rule)
	if err != nil {
		t.Fatalf("Failed to load DSL v2.0 rule: %v", err)
	}

	t.Run("NoViolation_FraudCheckPresent", func(t *testing.T) {
		// Create test trace with high-value payment AND fraud check
		spans := []*models.Span{
			{
				TraceID:       "trace-001",
				SpanID:        "span-001",
				OperationName: "payment.charge_card",
				Attributes: map[string]string{
					"amount":   "5000",
					"currency": "USD",
				},
			},
			{
				TraceID:       "trace-001",
				SpanID:        "span-002",
				OperationName: "payment.fraud_check",
				Attributes: map[string]string{
					"result": "passed",
				},
			},
		}

		// Evaluate the rule
		violations, err := engine.EvaluateTrace(context.Background(), "trace-001", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// Should NOT violate (fraud check is present)
		if len(violations) > 0 {
			t.Errorf("Expected no violations, got %d: %v", len(violations), violations)
		}
	})

	t.Run("Violation_NoFraudCheck", func(t *testing.T) {
		// Create test trace with high-value payment but NO fraud check
		spans := []*models.Span{
			{
				TraceID:       "trace-002",
				SpanID:        "span-003",
				OperationName: "payment.charge_card",
				Attributes: map[string]string{
					"amount":   "5000",
					"currency": "USD",
				},
			},
			// No fraud_check span!
		}

		// Evaluate the rule
		violations, err := engine.EvaluateTrace(context.Background(), "trace-002", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// SHOULD violate (fraud check missing)
		if len(violations) != 1 {
			t.Errorf("Expected 1 violation, got %d: %v", len(violations), violations)
		}

		if len(violations) > 0 && violations[0] != rule.ID {
			t.Errorf("Expected violation of rule %s, got %s", rule.ID, violations[0])
		}
	})

	t.Run("NoViolation_LowValuePayment", func(t *testing.T) {
		// Create test trace with LOW-value payment (< $1000)
		spans := []*models.Span{
			{
				TraceID:       "trace-003",
				SpanID:        "span-004",
				OperationName: "payment.charge_card",
				Attributes: map[string]string{
					"amount":   "500",
					"currency": "USD",
				},
			},
			// No fraud check, but amount is low so rule doesn't apply
		}

		// Evaluate the rule
		violations, err := engine.EvaluateTrace(context.Background(), "trace-003", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// Should NOT violate (when clause doesn't match)
		if len(violations) > 0 {
			t.Errorf("Expected no violations (low amount), got %d: %v", len(violations), violations)
		}
	})
}

// TestDSLv2AIAgentSafety tests AI agent safety rules with DSL v2.0
func TestDSLv2AIAgentSafety(t *testing.T) {
	engine := rules.NewRuleEngine()

	// Load AI agent unauthorized tool use rule
	rule := models.Rule{
		ID:          "ai-agent-unauthorized-tool-use",
		Name:        "AI Agent Unauthorized Tool Use",
		Description: "Ensures agents only use approved tools and require human approval for sensitive operations",
		Expression:  "when { agent.tool_use.where(tool_requires_approval == true) } always { human.approval_granted }",
		Severity:    "high",
		Enabled:     true,
	}

	err := engine.LoadRule(rule)
	if err != nil {
		t.Fatalf("Failed to load DSL v2.0 rule: %v", err)
	}

	t.Run("Violation_NoHumanApproval", func(t *testing.T) {
		// Agent uses sensitive tool WITHOUT approval
		spans := []*models.Span{
			{
				TraceID:       "trace-ai-001",
				SpanID:        "span-001",
				OperationName: "agent.tool_use",
				Attributes: map[string]string{
					"tool":                   "shell_exec",
					"command":                "rm -rf /data",
					"tool_requires_approval": "true",
				},
			},
			// No human approval span!
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-ai-001", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// SHOULD violate (never clause matched - approval missing)
		if len(violations) != 1 {
			t.Errorf("Expected 1 violation, got %d: %v", len(violations), violations)
		}
	})

	t.Run("NoViolation_HumanApprovalGranted", func(t *testing.T) {
		// Agent uses sensitive tool WITH approval
		spans := []*models.Span{
			{
				TraceID:       "trace-ai-002",
				SpanID:        "span-002",
				OperationName: "agent.tool_use",
				Attributes: map[string]string{
					"tool":                   "shell_exec",
					"command":                "rm -rf /data",
					"tool_requires_approval": "true",
				},
			},
			{
				TraceID:       "trace-ai-002",
				SpanID:        "span-003",
				OperationName: "human.approval_granted",
				Attributes: map[string]string{
					"approver": "admin@example.com",
				},
			},
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-ai-002", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// Should NOT violate (approval present - never clause not matched)
		if len(violations) > 0 {
			t.Errorf("Expected no violations (approval granted), got %d: %v", len(violations), violations)
		}
	})
}

// TestDSLv2CountComparisons tests count-to-count comparisons
func TestDSLv2CountComparisons(t *testing.T) {
	engine := rules.NewRuleEngine()

	// Request/Response mismatch rule
	rule := models.Rule{
		ID:          "request-response-mismatch",
		Name:        "Request/Response Count Mismatch",
		Description: "Detects when request count doesn't match response count",
		Expression:  "when { count(http.request) != count(http.response) } always { alert }",
		Severity:    "high",
		Enabled:     true,
	}

	err := engine.LoadRule(rule)
	if err != nil {
		t.Fatalf("Failed to load DSL v2.0 rule: %v", err)
	}

	t.Run("Violation_MismatchedCounts", func(t *testing.T) {
		// 3 requests but only 2 responses - no alert (violation!)
		spans := []*models.Span{
			{TraceID: "trace-001", SpanID: "req-1", OperationName: "http.request", Attributes: map[string]string{"method": "POST"}},
			{TraceID: "trace-001", SpanID: "req-2", OperationName: "http.request", Attributes: map[string]string{"method": "POST"}},
			{TraceID: "trace-001", SpanID: "req-3", OperationName: "http.request", Attributes: map[string]string{"method": "POST"}},
			{TraceID: "trace-001", SpanID: "resp-1", OperationName: "http.response", Attributes: map[string]string{"status": "200"}},
			{TraceID: "trace-001", SpanID: "resp-2", OperationName: "http.response", Attributes: map[string]string{"status": "200"}},
			// No alert span!
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-001", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// SHOULD violate (counts mismatch but no alert generated)
		if len(violations) != 1 {
			t.Errorf("Expected 1 violation, got %d: %v", len(violations), violations)
		}
	})

	t.Run("NoViolation_MatchingCounts", func(t *testing.T) {
		// 3 requests and 3 responses
		spans := []*models.Span{
			{TraceID: "trace-002", SpanID: "req-1", OperationName: "http.request", Attributes: map[string]string{"method": "POST"}},
			{TraceID: "trace-002", SpanID: "req-2", OperationName: "http.request", Attributes: map[string]string{"method": "POST"}},
			{TraceID: "trace-002", SpanID: "req-3", OperationName: "http.request", Attributes: map[string]string{"method": "POST"}},
			{TraceID: "trace-002", SpanID: "resp-1", OperationName: "http.response", Attributes: map[string]string{"status": "200"}},
			{TraceID: "trace-002", SpanID: "resp-2", OperationName: "http.response", Attributes: map[string]string{"status": "200"}},
			{TraceID: "trace-002", SpanID: "resp-3", OperationName: "http.response", Attributes: map[string]string{"status": "200"}},
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-002", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// Should NOT violate (counts match)
		if len(violations) > 0 {
			t.Errorf("Expected no violations (counts match), got %d: %v", len(violations), violations)
		}
	})
}

// TestDSLv2ComplianceRules tests compliance rules with DSL v2.0
func TestDSLv2ComplianceRules(t *testing.T) {
	engine := rules.NewRuleEngine()

	// SOC2 CC7.2: PII access must be audited
	rule := models.Rule{
		ID:          "soc2-cc7-2-pii-access-audit-log",
		Name:        "SOC2 CC7.2: PII Access Must Be Audited",
		Description: "Ensures all PII access generates audit log",
		Expression:  "when { pii.access } always { audit.log }",
		Severity:    "high",
		Enabled:     true,
	}

	err := engine.LoadRule(rule)
	if err != nil {
		t.Fatalf("Failed to load DSL v2.0 rule: %v", err)
	}

	t.Run("Violation_NoAuditLog", func(t *testing.T) {
		// PII access without audit log
		spans := []*models.Span{
			{
				TraceID:       "trace-compliance-001",
				SpanID:        "span-001",
				OperationName: "pii.access",
				Attributes: map[string]string{
					"resource": "patient_records",
					"user_id":  "user123",
				},
			},
			// No audit.log span!
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-compliance-001", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// SHOULD violate (audit log missing)
		if len(violations) != 1 {
			t.Errorf("Expected 1 violation, got %d: %v", len(violations), violations)
		}
	})

	t.Run("NoViolation_AuditLogPresent", func(t *testing.T) {
		// PII access WITH audit log
		spans := []*models.Span{
			{
				TraceID:       "trace-compliance-002",
				SpanID:        "span-002",
				OperationName: "pii.access",
				Attributes: map[string]string{
					"resource": "patient_records",
					"user_id":  "user123",
				},
			},
			{
				TraceID:       "trace-compliance-002",
				SpanID:        "span-003",
				OperationName: "audit.log",
				Attributes: map[string]string{
					"event_type": "pii_access",
					"user":       "user123",
				},
			},
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-compliance-002", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// Should NOT violate (audit log present)
		if len(violations) > 0 {
			t.Errorf("Expected no violations, got %d: %v", len(violations), violations)
		}
	})
}

// TestDSLv2ChainedWhere tests chained where clauses
func TestDSLv2ChainedWhere(t *testing.T) {
	engine := rules.NewRuleEngine()

	// Rule with chained where clauses (implicit AND)
	rule := models.Rule{
		ID:          "high-value-usd-payment",
		Name:        "High Value USD Payment Requires Extra Verification",
		Description: "Tests chained where clauses",
		Expression:  "when { payment.where(amount > 1000).where(currency == USD) } always { extra_verification }",
		Severity:    "medium",
		Enabled:     true,
	}

	err := engine.LoadRule(rule)
	if err != nil {
		t.Fatalf("Failed to load DSL v2.0 rule: %v", err)
	}

	t.Run("Violation_HighValueUSD_NoVerification", func(t *testing.T) {
		spans := []*models.Span{
			{
				TraceID:       "trace-001",
				SpanID:        "span-001",
				OperationName: "payment",
				Attributes: map[string]string{
					"amount":   "5000",
					"currency": "USD",
				},
			},
			// No extra_verification span!
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-001", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// SHOULD violate (both conditions met, but no verification)
		if len(violations) != 1 {
			t.Errorf("Expected 1 violation, got %d: %v", len(violations), violations)
		}
	})

	t.Run("NoViolation_HighValueEUR", func(t *testing.T) {
		// High value but different currency
		spans := []*models.Span{
			{
				TraceID:       "trace-002",
				SpanID:        "span-002",
				OperationName: "payment",
				Attributes: map[string]string{
					"amount":   "5000",
					"currency": "EUR",
				},
			},
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-002", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// Should NOT violate (currency doesn't match)
		if len(violations) > 0 {
			t.Errorf("Expected no violations (currency mismatch), got %d: %v", len(violations), violations)
		}
	})

	t.Run("NoViolation_LowValueUSD", func(t *testing.T) {
		// USD but low value
		spans := []*models.Span{
			{
				TraceID:       "trace-003",
				SpanID:        "span-003",
				OperationName: "payment",
				Attributes: map[string]string{
					"amount":   "500",
					"currency": "USD",
				},
			},
		}

		violations, err := engine.EvaluateTrace(context.Background(), "trace-003", spans)
		if err != nil {
			t.Fatalf("Evaluation failed: %v", err)
		}

		// Should NOT violate (amount too low)
		if len(violations) > 0 {
			t.Errorf("Expected no violations (amount too low), got %d: %v", len(violations), violations)
		}
	})
}

// TestDSLv2ParseAllExampleRules validates all 45 example rules parse correctly
func TestDSLv2ParseAllExampleRules(t *testing.T) {
	// All 45 converted example rules
	exampleRules := []string{
		// AI Agent Safety (12 rules)
		"when { agent.plan.created and agent.plan.executed } always { agent.action.where(goal_deviation_score > 0.3) }",
		"when { agent.instruction_received } always { agent.instruction_source.where(authorized == false) }",
		"when { agent.tool_use.where(tool_requires_approval == true) } never { human.approval_granted }",
		"when { agent.delegation } always { agent.delegate.where(approved == false) }",
		"when { medical.diagnosis } never { source_citation }",
		"when { factual_claim.where(confidence < 0.7) } never { uncertainty_disclosure }",
		"when { financial.advice } never { data_source_verification }",
		"when { hiring.decision } always { statistical_analysis.where(bias_detected == true) }",
		"when { unauthorized_access_attempt.where(actor_type == ai_agent) } always { security_alert }",
		"when { oversight.evasion_attempt } always { security_alert }",
		"when { network.scan.where(source == ai_agent) } always { security_alert }",
		"when { query.biological_synthesis.where(hazard_level == high) } always { security_alert }",

		// Compliance (15 rules)
		`when { database.query.where("data.contains_pii" == true) } always { auth.check }`,
		"when { pii.access } always { audit.log }",
		"when { phi.access } always { auth.user_identified.where(user_id_present == true) }",
		"when { phi.access } always { audit.log.where(log_type == hipaa_audit) }",
		"when { phi.transmission } always { encryption.applied.where(encrypted == true) }",
		`when { database.write.where("data.sensitive" == true) } always { encryption.at_rest.where(enabled == true) }`,
		"when { deployment.production } always { change.approval.where(approver_verified == true) }",
		"when { user.provision } always { approval.granted.where(approver_verified == true) }",
		"when { security.event } always { audit.log }",
		"when { cardholder_data.access } always { auth.check.where(authorized == true) }",
		"when { cardholder_data.access } always { audit.log.where(log_type == pci_audit) }",
		"when { personal_data.processing } always { security.measures.where(encryption_enabled == true) }",
		"when { automated_decision.where(legal_effect == true) } always { human_review.available }",
		"when { user.registration } always { formal_approval.where(documented == true) }",
		"when { compliance.evidence } always { signature.verified.where(valid == true) }",

		// SRE (18 rules)
		"when { payment.charge_card.where(amount > 1000) } always { payment.fraud_check }",
		"when { http.response.where(status >= 500) } always { error.logged }",
		"when { database.query.where(duration_ms > 1000) } always { performance_alert }",
		"when { count(http.retry) > 3 } always { alert }",
		"when { count(http.request) != count(http.response) } always { alert }",
		"when { circuit_breaker.opened } always { alert }",
		"when { count(cache.miss) > 10 } always { cache_warming_alert }",
		"when { trace.incomplete.where(expected_span_count > actual_span_count) } always { observability_alert }",
		"when { rate_limit.exceeded } always { alert }",
		"when { memory.usage.where(growth_rate_mb_per_sec > 10) } always { memory_alert }",
		"when { lock.acquired.where(lock_type == exclusive) } always { lock.timeout }",
		"when { queue.depth.where(depth > max_capacity) } always { capacity_alert }",
		"when { api.request } always { api.validate_key }",
		"when { api.request.where(endpoint contains admin) } always { auth.check_admin }",
		"when { database.connection_acquire.where(wait_time_ms > 1000) } always { connection_pool_alert }",
		"when { service.failure.where(failure_count > 1) } always { dependency.failure }",
		"when { operation.latency.where(duration_ms > 500) } always { sla_alert }",
		"when { cross_region.request.where(latency_ms > 200) } always { latency_alert }",
	}

	for i, expression := range exampleRules {
		t.Run(fmt.Sprintf("Rule_%d", i+1), func(t *testing.T) {
			// Attempt to parse each rule
			ast, err := dsl.Parse(expression)
			if err != nil {
				t.Errorf("Failed to parse rule %d: %s\nExpression: %s", i+1, err, expression)
				return
			}

			// Verify we got an AST
			if ast == nil {
				t.Errorf("Parse returned nil AST for rule %d", i+1)
				return
			}

			// Verify it has required clauses
			if ast.When == nil {
				t.Errorf("Rule %d missing when clause", i+1)
			}

			if ast.Always == nil && ast.Never == nil {
				t.Errorf("Rule %d missing both always and never clauses", i+1)
			}
		})
	}

	t.Logf("✅ Successfully parsed all %d example rules", len(exampleRules))
}
