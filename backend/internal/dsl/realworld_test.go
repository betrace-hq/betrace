package dsl

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestRealWorldPatterns validates parser against actual production patterns
// from BeTrace's example rule library
func TestRealWorldPatterns(t *testing.T) {
	patterns := []struct {
		category    string
		name        string
		dsl         string
		severity    string
		frameworks  []string
		description string
	}{
		// ========================================
		// SRE / Reliability Patterns
		// ========================================
		{
			category:    "SRE",
			name:        "Payment Fraud Check Required",
			severity:    "critical",
			frameworks:  []string{"PCI-DSS"},
			description: "High-value payments must include fraud validation",
			dsl: `when { payment.where(amount > 1000) }
always { fraud_check }`,
		},
		{
			category:    "SRE",
			name:        "HTTP 5xx Error Logging",
			severity:    "high",
			description: "All server errors must generate error logs",
			dsl: `when { http_response.where(status >= 500) }
always { error_logged }`,
		},
		{
			category:    "SRE",
			name:        "Database Query Timeout",
			severity:    "medium",
			description: "Detect slow database queries",
			dsl:         `when { db_query.where(duration > 1000) }`,
		},
		{
			category:    "SRE",
			name:        "Excessive API Retries",
			severity:    "high",
			description: "Detect retry storms",
			dsl:         `when { count(http_retry) > 3 }`,
		},
		{
			category:    "SRE",
			name:        "Request/Response Mismatch",
			severity:    "high",
			description: "Detect orphaned requests (count mismatch)",
			dsl:         `when { count(http_request) != count(http_response) }`,
		},
		{
			category:    "SRE",
			name:        "Circuit Breaker Tripped",
			severity:    "high",
			description: "Detect downstream service failures",
			dsl:         `when { circuit_breaker_opened }`,
		},
		{
			category:    "SRE",
			name:        "Cache Stampede",
			severity:    "medium",
			description: "Thundering herd detection",
			dsl:         `when { count(cache_miss) > 10 }`,
		},
		{
			category:    "SRE",
			name:        "Rate Limit Exceeded",
			severity:    "medium",
			description: "Detect misbehaving clients",
			dsl:         `when { rate_limit_exceeded }`,
		},
		{
			category:    "SRE",
			name:        "Memory Leak Detection",
			severity:    "high",
			description: "Detect continuously increasing memory",
			dsl:         `when { memory_usage.where(growth_rate > 10) }`,
		},
		{
			category:    "SRE",
			name:        "Deadlock Detection",
			severity:    "critical",
			description: "Detect resource deadlocks",
			dsl: `when { lock_acquired.where(lock_type == "exclusive") and lock_timeout }
always { deadlock_alert }`,
		},
		{
			category:    "SRE",
			name:        "Queue Overflow",
			severity:    "high",
			description: "Message queue capacity exceeded",
			dsl:         `when { queue_depth.where(depth > max_capacity) }`,
		},
		{
			category:    "SRE",
			name:        "Connection Pool Exhaustion",
			severity:    "high",
			description: "Database connection pool depleted",
			dsl:         `when { db_connection_acquire.where(wait_time > 1000) }`,
		},
		{
			category:    "SRE",
			name:        "Cascading Failure",
			severity:    "critical",
			description: "Multi-service failure detection",
			dsl: `when { service_failure and dependency_failure }
always { incident_alert }`,
		},
		{
			category:    "SRE",
			name:        "Latency SLA Violation",
			severity:    "medium",
			description: "p99 latency exceeds SLA",
			dsl:         `when { operation_latency.where(duration > 500 and percentile == "p99") }`,
		},
		{
			category:    "SRE",
			name:        "Cross-Region Latency",
			severity:    "medium",
			description: "High multi-region request latency",
			dsl:         `when { cross_region_request.where(latency > 200) }`,
		},

		// ========================================
		// Security / API Patterns
		// ========================================
		{
			category:    "Security",
			name:        "API Key Validation",
			severity:    "critical",
			frameworks:  []string{"API Security"},
			description: "All API requests must validate keys",
			dsl: `when { api_request }
always { api_validate_key }`,
		},
		{
			category:    "Security",
			name:        "Admin Endpoint Authorization",
			severity:    "critical",
			frameworks:  []string{"API Security"},
			description: "Admin endpoints require admin check",
			dsl: `when { api_request.where(endpoint matches "/api/v1/admin/.*") }
always { auth_check_admin }`,
		},

		// ========================================
		// Compliance Patterns (SOC2, HIPAA)
		// ========================================
		{
			category:    "Compliance",
			name:        "SOC2 CC6.1: PII Access Authorization",
			severity:    "critical",
			frameworks:  []string{"SOC2", "HIPAA"},
			description: "PII access requires authorization",
			dsl: `when { db_query.where(contains_pii == true) }
always { auth_check }`,
		},
		{
			category:    "Compliance",
			name:        "SOC2 CC7.2: PII Access Audit",
			severity:    "high",
			frameworks:  []string{"SOC2", "HIPAA"},
			description: "PII access must be audited",
			dsl: `when { pii_access }
always { audit_log }`,
		},
		{
			category:    "Compliance",
			name:        "HIPAA 164.312(a): Unique User ID for PHI",
			severity:    "critical",
			frameworks:  []string{"HIPAA"},
			description: "PHI access requires user identification",
			dsl: `when { phi_access }
always { auth_user_identified.where(user_id_present == true) }`,
		},
		{
			category:    "Compliance",
			name:        "HIPAA 164.312(b): Audit Controls",
			severity:    "critical",
			frameworks:  []string{"HIPAA"},
			description: "PHI access requires audit trail",
			dsl: `when { phi_access }
always { audit_log.where(log_type == "hipaa_audit") }`,
		},
		{
			category:    "Compliance",
			name:        "HIPAA 164.312(e): Encryption in Transit",
			severity:    "critical",
			frameworks:  []string{"HIPAA"},
			description: "PHI must be encrypted during transmission",
			dsl: `when { phi_transmission }
always { encryption_applied.where(algorithm in ["AES256", "TLS1_3"]) }`,
		},
		{
			category:    "Compliance",
			name:        "SOC2 CC6.6: Encryption at Rest",
			severity:    "high",
			frameworks:  []string{"SOC2"},
			description: "Sensitive data encrypted when stored",
			dsl: `when { db_write.where(sensitive == true) }
always { encryption_at_rest.where(algorithm == "AES256") }`,
		},
		{
			category:    "Compliance",
			name:        "SOC2 CC8.1: Change Management",
			severity:    "high",
			frameworks:  []string{"SOC2"},
			description: "Production changes require approval",
			dsl: `when { deployment_production }
always { change_approval.where(approver_role in ["admin", "manager"]) }`,
		},

		// ========================================
		// Complex Multi-Condition Patterns
		// ========================================
		{
			category:    "Complex",
			name:        "High-Value Unverified Payment",
			severity:    "critical",
			frameworks:  []string{"PCI-DSS"},
			description: "Large payments from unverified customers require multiple checks",
			dsl: `when { payment.where(amount > 10000 and customer_verified == false) }
always { fraud_check and manual_review and risk_assessment }
never { auto_approve or skip_verification }`,
		},
		{
			category:    "Complex",
			name:        "Production Deployment Safety",
			severity:    "critical",
			frameworks:  []string{"SOC2"},
			description: "Production deployments require full safety checks",
			dsl: `when { deployment.where(environment == "production") }
always { approval and smoke_test and backup_complete and rollback_plan }
never { skip_validation or force_push or bypass_approval }`,
		},
		{
			category:    "Complex",
			name:        "PII Export Controls",
			severity:    "critical",
			frameworks:  []string{"GDPR", "SOC2"},
			description: "PII exports require approval and encryption",
			dsl: `when { db_query.where(contains_pii == true and operation == "export") }
always { audit_log and auth_validate and encryption_verify }
never { export_external or processing_unencrypted }`,
		},
		{
			category:    "Complex",
			name:        "Free Tier Restrictions",
			severity:    "medium",
			description: "Free tier cannot access premium features",
			dsl: `when { api_request.where(customer_type == "free_tier") }
never { premium_access }`,
		},
		{
			category:    "Complex",
			name:        "Test Environment Safety",
			severity:    "high",
			description: "Test environments never process real payments",
			dsl: `when { payment.where(environment == "test") }
never { real_charge }`,
		},
	}

	// Track statistics
	stats := map[string]int{
		"total":      len(patterns),
		"parsed":     0,
		"failed":     0,
		"SRE":        0,
		"Security":   0,
		"Compliance": 0,
		"Complex":    0,
	}

	var failures []string

	for _, p := range patterns {
		t.Run(p.name, func(t *testing.T) {
			rule, err := Parse(p.dsl)

			if err != nil {
				stats["failed"]++
				errMsg := p.category + " / " + p.name + ": " + err.Error()
				failures = append(failures, errMsg)
				t.Errorf("Failed to parse real-world pattern:\nCategory: %s\nPattern: %s\nDSL:\n%s\nError: %v",
					p.category, p.name, p.dsl, err)
				return
			}

			require.NotNil(t, rule, "Rule should not be nil")
			stats["parsed"]++
			stats[p.category]++

			t.Logf("✅ %s: %s (severity: %s)", p.category, p.name, p.severity)
		})
	}

	// Final summary
	t.Logf("\n" +
		"========================================\n" +
		"Real-World Pattern Test Summary\n" +
		"========================================\n" +
		"Total patterns:     %d\n"+
		"Successfully parsed: %d (%.1f%%)\n"+
		"Failed:             %d\n"+
		"\n"+
		"By Category:\n"+
		"  SRE:        %d patterns\n"+
		"  Security:   %d patterns\n"+
		"  Compliance: %d patterns\n"+
		"  Complex:    %d patterns\n",
		stats["total"],
		stats["parsed"],
		float64(stats["parsed"])/float64(stats["total"])*100,
		stats["failed"],
		stats["SRE"],
		stats["Security"],
		stats["Compliance"],
		stats["Complex"])

	if len(failures) > 0 {
		t.Errorf("\n❌ Failed patterns:\n")
		for _, f := range failures {
			t.Errorf("  - %s\n", f)
		}
	}

	// All patterns must parse
	require.Equal(t, 0, stats["failed"], "All real-world patterns must parse successfully")
}

// TestRealWorldComplexity validates complexity distribution
func TestRealWorldComplexity(t *testing.T) {
	simple := []string{
		`when { payment }`,
		`when { circuit_breaker_opened }`,
		`when { rate_limit_exceeded }`,
	}

	medium := []string{
		`when { payment.where(amount > 1000) }
always { fraud_check }`,
		`when { db_query.where(duration > 1000) }`,
		`when { count(http_retry) > 3 }`,
	}

	complex := []string{
		`when { payment.where(amount > 10000 and customer_verified == false) }
always { fraud_check and manual_review and risk_assessment }
never { auto_approve or skip_verification }`,
		`when { deployment.where(environment == "production") }
always { approval and smoke_test and backup_complete }
never { skip_validation or force_push }`,
	}

	for _, dsl := range simple {
		rule, err := Parse(dsl)
		require.NoError(t, err, "Simple pattern should parse")
		require.NotNil(t, rule)
	}

	for _, dsl := range medium {
		rule, err := Parse(dsl)
		require.NoError(t, err, "Medium pattern should parse")
		require.NotNil(t, rule)
	}

	for _, dsl := range complex {
		rule, err := Parse(dsl)
		require.NoError(t, err, "Complex pattern should parse")
		require.NotNil(t, rule)
	}

	t.Logf("✅ All complexity levels validated: %d simple, %d medium, %d complex",
		len(simple), len(medium), len(complex))
}
