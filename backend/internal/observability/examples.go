package observability

import (
	"context"
	"fmt"
)

// Example: SOC2 Access Control Monitoring
//
// Demonstrates how to emit SOC2 CC6.1 compliance evidence when
// performing access control checks.
func ExampleSOC2AccessControl() {
	ctx := context.Background()

	// Example: User authentication check
	userID := "user-12345"
	resource := "/api/sensitive-data"
	granted := false // Access denied

	// Emit compliance evidence
	EmitSOC2AccessControl(ctx, userID, resource, granted)

	// This creates an OpenTelemetry span with:
	// - compliance.framework = "soc2"
	// - compliance.control = "CC6.1"
	// - compliance.outcome = "denied"
	// - compliance.evidence_type = "audit_trail"
	// - compliance.tamper_evident = true
	//
	// And increments Prometheus metric:
	// betrace_soc2_access_control_checks_total{outcome="denied"}

	fmt.Println("SOC2 access control evidence emitted")
}

// Example: SOC2 Data Isolation Verification
//
// Demonstrates how to emit SOC2 CC6.3 compliance evidence when
// verifying tenant data isolation.
func ExampleSOC2DataIsolation() {
	ctx := context.Background()

	// Example: Database query with tenant isolation
	tenantID := "tenant-abc"
	operation := "query_users"
	isolated := true // Query properly scoped to tenant

	// Emit compliance evidence
	EmitSOC2DataIsolation(ctx, tenantID, operation, isolated)

	// This creates an OpenTelemetry span proving tenant isolation
	// Queryable for auditors to verify CC6.3 compliance

	fmt.Println("SOC2 data isolation evidence emitted")
}

// Example: HIPAA Access Logging
//
// Demonstrates how to emit HIPAA 164.312(b) audit control evidence
// when accessing Protected Health Information (PHI).
func ExampleHIPAAAccessLog() {
	ctx := context.Background()

	// Example: PHI access event
	userID := "doctor-smith"
	action := "view_patient_record"
	phiType := "medical_history"

	// Emit compliance evidence
	EmitHIPAAAccessLog(ctx, userID, action, phiType)

	// This creates an audit log entry required by HIPAA
	// Includes who accessed what PHI and when
	// Queryable for HIPAA compliance audits

	fmt.Println("HIPAA access log evidence emitted")
}

// Example: HIPAA Encryption Evidence
//
// Demonstrates how to emit HIPAA 164.312(a)(2)(iv) encryption evidence
// when encrypting/decrypting PHI.
func ExampleHIPAAEncryption() {
	ctx := context.Background()

	// Example: PHI encryption event
	operation := "encrypt"
	dataType := "patient_ssn"
	encrypted := true // Successfully encrypted

	// Emit compliance evidence
	EmitHIPAAEncryption(ctx, operation, dataType, encrypted)

	// This proves encryption controls are working
	// Required for HIPAA Technical Safeguards compliance

	fmt.Println("HIPAA encryption evidence emitted")
}

// Example: GDPR Data Access Request
//
// Demonstrates how to emit GDPR Art. 15 compliance evidence
// when handling data subject access requests.
func ExampleGDPRDataAccess() {
	ctx := context.Background()

	// Example: User requests their data
	dataSubjectID := "user-jane-doe"
	requestType := "full_data_export"
	granted := true // Request fulfilled

	// Emit compliance evidence
	EmitGDPRDataAccess(ctx, dataSubjectID, requestType, granted)

	// This proves GDPR Art. 15 (Right of Access) compliance
	// Shows data subject requests are being honored

	fmt.Println("GDPR data access evidence emitted")
}

// Example: GDPR Data Deletion (Right to Erasure)
//
// Demonstrates how to emit GDPR Art. 17 compliance evidence
// when deleting user data.
func ExampleGDPRDataDeletion() {
	ctx := context.Background()

	// Example: User requests data deletion
	dataSubjectID := "user-john-smith"
	status := "completed" // Data successfully deleted

	// Emit compliance evidence
	EmitGDPRDataDeletion(ctx, dataSubjectID, status)

	// This proves GDPR Art. 17 (Right to Erasure) compliance
	// Shows deletion requests are being processed

	fmt.Println("GDPR data deletion evidence emitted")
}

// Example: GDPR Consent Management
//
// Demonstrates how to emit GDPR Art. 7 compliance evidence
// when managing user consent.
func ExampleGDPRConsent() {
	ctx := context.Background()

	// Example: User grants consent
	dataSubjectID := "user-alice"
	action := "granted"
	purpose := "marketing_emails"

	// Emit compliance evidence
	EmitGDPRConsent(ctx, dataSubjectID, action, purpose)

	// This proves GDPR Art. 7 (Consent) compliance
	// Shows consent is being tracked and honored

	fmt.Println("GDPR consent evidence emitted")
}

// Example: FedRAMP Audit Event
//
// Demonstrates how to emit FedRAMP AU-2 compliance evidence
// when logging auditable events.
func ExampleFedRAMPAuditEvent() {
	ctx := context.Background()

	// Example: Admin configuration change
	eventType := "admin"
	userID := "admin-bob"
	action := "update_security_policy"

	// Emit compliance evidence
	EmitFedRAMPAuditEvent(ctx, eventType, userID, action)

	// This proves FedRAMP AU-2 (Audit Events) compliance
	// Shows security-relevant events are being logged

	fmt.Println("FedRAMP audit event evidence emitted")
}

// Example: FedRAMP Access Control Decision
//
// Demonstrates how to emit FedRAMP AC-3 compliance evidence
// when enforcing access control.
func ExampleFedRAMPAccessControl() {
	ctx := context.Background()

	// Example: Access control decision
	userID := "contractor-charlie"
	resource := "/classified/docs"
	granted := false // Access denied - insufficient clearance

	// Emit compliance evidence
	EmitFedRAMPAccessControl(ctx, userID, resource, granted)

	// This proves FedRAMP AC-3 (Access Enforcement) compliance
	// Shows access control decisions are being enforced

	fmt.Println("FedRAMP access control evidence emitted")
}

// Example: Detecting Compliance Violations
//
// Demonstrates how to detect and record compliance violations
// when invariants are broken.
func ExampleDetectComplianceViolation() {
	ctx := context.Background()

	// Example: Detect PII access without audit log
	control := SOC2_CC7_2
	severity := "high"
	reason := "PII access detected without corresponding audit log entry"

	// Detect and record violation
	DetectComplianceViolation(ctx, control, severity, reason)

	// This creates a violation span that alerts on broken compliance
	// Triggers Prometheus metric:
	// betrace_compliance_violations_detected_total{framework="soc2",control="CC7.2",severity="high"}

	fmt.Println("Compliance violation detected and recorded")
}

// Example: Full Compliance Workflow
//
// Demonstrates a complete workflow with multiple compliance frameworks.
func ExampleFullComplianceWorkflow() {
	ctx := context.Background()

	// Step 1: User authentication (SOC2 CC6.1)
	userID := "user-123"
	EmitSOC2AccessControl(ctx, userID, "/api/patients", true)

	// Step 2: PHI access logging (HIPAA 164.312(b))
	EmitHIPAAAccessLog(ctx, userID, "view_patient", "medical_record")

	// Step 3: Data isolation check (SOC2 CC6.3)
	EmitSOC2DataIsolation(ctx, "tenant-hospital-a", "query_patients", true)

	// Step 4: Encryption verification (HIPAA 164.312(a)(2)(iv))
	EmitHIPAAEncryption(ctx, "encrypt", "patient_data", true)

	// Step 5: GDPR consent check (GDPR Art. 7)
	EmitGDPRConsent(ctx, userID, "verified", "data_processing")

	// Step 6: FedRAMP audit logging (FedRAMP AU-2)
	EmitFedRAMPAuditEvent(ctx, "access", userID, "access_phi")

	// All compliance evidence now queryable in Tempo
	// All metrics available in Prometheus
	// Auditors can verify controls via traces

	fmt.Println("Full compliance workflow executed")
}

// Example: Querying Compliance Evidence
//
// Shows how auditors query compliance evidence from Tempo.
func ExampleQueryComplianceEvidence() {
	// TraceQL queries for auditors:

	// Query 1: All SOC2 CC6.1 access control decisions
	traceQL1 := `{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}`

	// Query 2: HIPAA access logs for specific user
	traceQL2 := `{span.compliance.framework = "hipaa" && span.user_id = "doctor-smith"}`

	// Query 3: GDPR deletion requests (Art. 17)
	traceQL3 := `{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 17"}`

	// Query 4: Compliance violations (all frameworks)
	traceQL4 := `{span.name = "compliance.violation"}`

	// Query 5: FedRAMP audit events by event type
	traceQL5 := `{span.compliance.framework = "fedramp" && span.event_type = "admin"}`

	fmt.Println("Example TraceQL queries for auditors:")
	fmt.Println("1. SOC2 access control:", traceQL1)
	fmt.Println("2. HIPAA access logs:", traceQL2)
	fmt.Println("3. GDPR deletions:", traceQL3)
	fmt.Println("4. Violations:", traceQL4)
	fmt.Println("5. FedRAMP admin events:", traceQL5)
}

// Example: Prometheus Queries for Compliance Dashboards
//
// Shows how to build compliance dashboards with Prometheus.
func ExamplePrometheusComplianceQueries() {
	// Prometheus queries for compliance dashboards:

	// Query 1: SOC2 access control success rate
	promQL1 := `
	sum(rate(betrace_soc2_access_control_checks_total{outcome="granted"}[5m])) /
	sum(rate(betrace_soc2_access_control_checks_total[5m]))
	`

	// Query 2: HIPAA access log volume
	promQL2 := `rate(betrace_hipaa_access_log_entries_total[5m])`

	// Query 3: GDPR deletion request completion rate
	promQL3 := `
	sum(rate(betrace_gdpr_data_deletion_requests_total{status="completed"}[1h])) /
	sum(rate(betrace_gdpr_data_deletion_requests_total[1h]))
	`

	// Query 4: Compliance violation rate (all frameworks)
	promQL4 := `sum(rate(betrace_compliance_violations_detected_total[5m])) by (framework, severity)`

	// Query 5: FedRAMP audit event volume by type
	promQL5 := `sum(rate(betrace_fedramp_audit_events_total[5m])) by (event_type)`

	fmt.Println("Example Prometheus queries for compliance dashboards:")
	fmt.Println("1. SOC2 access success rate:", promQL1)
	fmt.Println("2. HIPAA access volume:", promQL2)
	fmt.Println("3. GDPR deletion rate:", promQL3)
	fmt.Println("4. Violation rate:", promQL4)
	fmt.Println("5. FedRAMP event volume:", promQL5)
}
