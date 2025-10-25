package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/betracehq/betrace/backend/internal/observability"
	"github.com/betracehq/betrace/backend/internal/rules"
	"github.com/betracehq/betrace/backend/pkg/models"
)

func main() {
	fmt.Println("🔍 BeTrace Observability Stack Test")
	fmt.Println("====================================")
	fmt.Println()

	ctx := context.Background()

	// Initialize OpenTelemetry
	fmt.Println("1. Initializing OpenTelemetry...")
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "localhost:4317"
	}
	fmt.Printf("   OTLP Endpoint: %s\n", endpoint)

	shutdown := observability.InitOpenTelemetryOrNoop(ctx, "betrace-test", "1.0.0")
	defer func() {
		fmt.Println("\n6. Shutting down OpenTelemetry...")
		if err := shutdown(ctx); err != nil {
			fmt.Printf("   ❌ Shutdown error: %v\n", err)
		} else {
			fmt.Println("   ✅ Shutdown complete")
		}
	}()

	// Give OTEL time to initialize
	time.Sleep(1 * time.Second)

	// Test Rule Engine with Observability
	fmt.Println("\n2. Testing Rule Engine with Observability...")
	testRuleEngine(ctx)

	// Test SOC2 Compliance Evidence
	fmt.Println("\n3. Testing SOC2 Compliance Evidence...")
	testSOC2Compliance(ctx)

	// Test HIPAA Compliance Evidence
	fmt.Println("\n4. Testing HIPAA Compliance Evidence...")
	testHIPAACompliance(ctx)

	// Test GDPR Compliance Evidence
	fmt.Println("\n5. Testing GDPR Compliance Evidence...")
	testGDPRCompliance(ctx)

	// Test FedRAMP Compliance Evidence
	fmt.Println("\n6. Testing FedRAMP Compliance Evidence...")
	testFedRAMPCompliance(ctx)

	// Give spans time to export
	fmt.Println("\n7. Flushing spans...")
	time.Sleep(3 * time.Second)

	fmt.Println("\n✅ Observability test complete!")
	fmt.Println("\nNext steps:")
	fmt.Println("1. Open Grafana: http://localhost:12015")
	fmt.Println("2. Go to Explore → Select 'Tempo' data source")
	fmt.Println("3. Run TraceQL query: {span.betrace.operation = \"rule_evaluation\"}")
	fmt.Println("4. Or query compliance: {span.compliance.framework = \"soc2\"}")
	fmt.Println()
	fmt.Println("Prometheus metrics: http://localhost:9090")
	fmt.Println("- betrace_rule_evaluation_total")
	fmt.Println("- betrace_compliance_spans_emitted_total")
	fmt.Println()
}

func testRuleEngine(ctx context.Context) {
	engine := rules.NewRuleEngine()

	// Load test rules
	rules := []models.Rule{
		{
			ID:         "detect-errors",
			Expression: `span.status == "ERROR"`,
			Enabled:    true,
		},
		{
			ID:         "detect-slow",
			Expression: `span.duration > 1000000000`,
			Enabled:    true,
		},
		{
			ID:         "detect-post",
			Expression: `span.attributes["http.method"] == "POST"`,
			Enabled:    true,
		},
	}

	for _, rule := range rules {
		if err := engine.LoadRuleWithObservability(ctx, rule); err != nil {
			fmt.Printf("   ❌ Failed to load rule %s: %v\n", rule.ID, err)
		} else {
			fmt.Printf("   ✅ Loaded rule: %s\n", rule.ID)
		}
	}

	// Create test spans
	testSpans := []*models.Span{
		{
			SpanID:        "span-001",
			ServiceName:   "payment-service",
			OperationName: "charge_card",
			Status:        "ERROR",
			Duration:      2000000000,
			Attributes: map[string]string{
				"http.method": "POST",
				"http.status": "500",
				"user.id":     "user-123",
			},
		},
		{
			SpanID:        "span-002",
			ServiceName:   "api-service",
			OperationName: "get_user",
			Status:        "OK",
			Duration:      500000000,
			Attributes: map[string]string{
				"http.method": "GET",
				"http.status": "200",
			},
		},
	}

	// Evaluate spans
	for _, span := range testSpans {
		matches, err := engine.EvaluateAllWithObservability(ctx, span)
		if err != nil {
			fmt.Printf("   ❌ Evaluation failed for %s: %v\n", span.SpanID, err)
		} else {
			fmt.Printf("   ✅ Evaluated %s: %d rules matched\n", span.SpanID, len(matches))
			if len(matches) > 0 {
				fmt.Printf("      Matches: %v\n", matches)
			}
		}
	}
}

func testSOC2Compliance(ctx context.Context) {
	// CC6.1 - Access Control
	observability.EmitSOC2AccessControl(ctx, "user-test-123", "/api/sensitive", true)
	fmt.Println("   ✅ Emitted CC6.1 access control evidence (granted)")

	observability.EmitSOC2AccessControl(ctx, "user-test-456", "/api/admin", false)
	fmt.Println("   ✅ Emitted CC6.1 access control evidence (denied)")

	// CC6.3 - Data Isolation
	observability.EmitSOC2DataIsolation(ctx, "tenant-test-abc", "query_users", true)
	fmt.Println("   ✅ Emitted CC6.3 data isolation evidence (isolated)")

	// CC7.2 - System Performance (via compliance evidence)
	observability.EmitComplianceEvidence(ctx, observability.SOC2_CC7_2, "monitored", map[string]interface{}{
		"operation":     "rule_evaluation",
		"latency_p99":   0.000153,
		"spans_per_sec": 10000,
	})
	fmt.Println("   ✅ Emitted CC7.2 performance monitoring evidence")
}

func testHIPAACompliance(ctx context.Context) {
	// 164.312(b) - Audit Controls
	observability.EmitHIPAAAccessLog(ctx, "doctor-test", "view_patient_record", "medical_history")
	fmt.Println("   ✅ Emitted HIPAA 164.312(b) access log")

	// 164.312(a)(2)(iv) - Encryption
	observability.EmitHIPAAEncryption(ctx, "encrypt", "patient_ssn", true)
	fmt.Println("   ✅ Emitted HIPAA 164.312(a)(2)(iv) encryption evidence")

	observability.EmitHIPAAEncryption(ctx, "decrypt", "patient_data", true)
	fmt.Println("   ✅ Emitted HIPAA 164.312(a)(2)(iv) decryption evidence")
}

func testGDPRCompliance(ctx context.Context) {
	// Art. 15 - Right of Access
	observability.EmitGDPRDataAccess(ctx, "user-test-jane", "full_export", true)
	fmt.Println("   ✅ Emitted GDPR Art. 15 data access evidence (granted)")

	// Art. 17 - Right to Erasure
	observability.EmitGDPRDataDeletion(ctx, "user-test-john", "completed")
	fmt.Println("   ✅ Emitted GDPR Art. 17 deletion evidence (completed)")

	// Art. 7 - Consent
	observability.EmitGDPRConsent(ctx, "user-test-alice", "granted", "marketing_emails")
	fmt.Println("   ✅ Emitted GDPR Art. 7 consent evidence (granted)")

	observability.EmitGDPRConsent(ctx, "user-test-bob", "revoked", "analytics")
	fmt.Println("   ✅ Emitted GDPR Art. 7 consent evidence (revoked)")
}

func testFedRAMPCompliance(ctx context.Context) {
	// AU-2 - Audit Events
	observability.EmitFedRAMPAuditEvent(ctx, "admin", "admin-test", "update_security_policy")
	fmt.Println("   ✅ Emitted FedRAMP AU-2 audit event (admin)")

	observability.EmitFedRAMPAuditEvent(ctx, "access", "user-test", "login")
	fmt.Println("   ✅ Emitted FedRAMP AU-2 audit event (access)")

	// AC-3 - Access Enforcement
	observability.EmitFedRAMPAccessControl(ctx, "contractor-test", "/classified/documents", false)
	fmt.Println("   ✅ Emitted FedRAMP AC-3 access control evidence (denied)")

	observability.EmitFedRAMPAccessControl(ctx, "employee-test", "/public/docs", true)
	fmt.Println("   ✅ Emitted FedRAMP AC-3 access control evidence (granted)")
}
