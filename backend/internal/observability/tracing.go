package observability

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// Tracer is the OpenTelemetry tracer for BeTrace rule engine
var Tracer = otel.Tracer("betrace.rule-engine")

// Internal alias for backwards compatibility
var tracer = Tracer

// ComplianceFramework represents supported compliance frameworks
type ComplianceFramework string

const (
	FrameworkSOC2    ComplianceFramework = "soc2"
	FrameworkHIPAA   ComplianceFramework = "hipaa"
	FrameworkGDPR    ComplianceFramework = "gdpr"
	FrameworkFedRAMP ComplianceFramework = "fedramp"
)

// ComplianceControl identifies a specific compliance control
type ComplianceControl struct {
	Framework ComplianceFramework
	ControlID string
	Notes     string
}

// Common compliance controls
var (
	// SOC2 Trust Service Criteria
	SOC2_CC6_1 = ComplianceControl{FrameworkSOC2, "CC6.1", "Logical Access Controls"}
	SOC2_CC6_2 = ComplianceControl{FrameworkSOC2, "CC6.2", "Access Provisioning"}
	SOC2_CC6_3 = ComplianceControl{FrameworkSOC2, "CC6.3", "Data Isolation"}
	SOC2_CC6_6 = ComplianceControl{FrameworkSOC2, "CC6.6", "Encryption at Rest"}
	SOC2_CC6_7 = ComplianceControl{FrameworkSOC2, "CC6.7", "Encryption in Transit"}
	SOC2_CC7_1 = ComplianceControl{FrameworkSOC2, "CC7.1", "System Monitoring"}
	SOC2_CC7_2 = ComplianceControl{FrameworkSOC2, "CC7.2", "System Performance"}
	SOC2_CC8_1 = ComplianceControl{FrameworkSOC2, "CC8.1", "Change Management"}

	// HIPAA Technical Safeguards
	HIPAA_164_312_a     = ComplianceControl{FrameworkHIPAA, "164.312(a)", "Access Control"}
	HIPAA_164_312_b     = ComplianceControl{FrameworkHIPAA, "164.312(b)", "Audit Controls"}
	HIPAA_164_312_a_2_i = ComplianceControl{FrameworkHIPAA, "164.312(a)(2)(i)", "Unique User Identification"}
	HIPAA_164_312_a_2_iv = ComplianceControl{FrameworkHIPAA, "164.312(a)(2)(iv)", "Encryption/Decryption"}
	HIPAA_164_312_e_2_ii = ComplianceControl{FrameworkHIPAA, "164.312(e)(2)(ii)", "Transmission Security"}

	// GDPR Articles
	GDPR_Art_15 = ComplianceControl{FrameworkGDPR, "Art. 15", "Right of Access"}
	GDPR_Art_17 = ComplianceControl{FrameworkGDPR, "Art. 17", "Right to Erasure"}
	GDPR_Art_7  = ComplianceControl{FrameworkGDPR, "Art. 7", "Consent"}
	GDPR_Art_32 = ComplianceControl{FrameworkGDPR, "Art. 32", "Security of Processing"}

	// FedRAMP Controls
	FedRAMP_AC_2 = ComplianceControl{FrameworkFedRAMP, "AC-2", "Account Management"}
	FedRAMP_AC_3 = ComplianceControl{FrameworkFedRAMP, "AC-3", "Access Enforcement"}
	FedRAMP_AU_2 = ComplianceControl{FrameworkFedRAMP, "AU-2", "Audit Events"}
	FedRAMP_AU_3 = ComplianceControl{FrameworkFedRAMP, "AU-3", "Audit Record Content"}
	FedRAMP_CM_2 = ComplianceControl{FrameworkFedRAMP, "CM-2", "Baseline Configuration"}
)

// ComplianceSpanAttributes creates standard compliance span attributes
func ComplianceSpanAttributes(control ComplianceControl, outcome string) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String("compliance.framework", string(control.Framework)),
		attribute.String("compliance.control", control.ControlID),
		attribute.String("compliance.outcome", outcome),
		attribute.String("compliance.notes", control.Notes),
		attribute.Int64("compliance.timestamp", time.Now().Unix()),
		attribute.String("compliance.evidence_type", "audit_trail"),
		attribute.Bool("compliance.tamper_evident", true),
	}
}

// StartRuleEvaluationSpan creates a traced rule evaluation with compliance evidence
func StartRuleEvaluationSpan(ctx context.Context, ruleID string, spanID string) (context.Context, trace.Span) {
	ctx, span := tracer.Start(ctx, "rule.evaluate",
		trace.WithAttributes(
			attribute.String("rule.id", ruleID),
			attribute.String("span.id", spanID),
			attribute.String("betrace.operation", "rule_evaluation"),
		),
	)

	// Emit compliance evidence for monitoring (SOC2 CC7.1)
	ComplianceSpansEmitted.WithLabelValues(string(FrameworkSOC2), "CC7.1", "monitoring").Inc()

	return ctx, span
}

// RecordRuleMatch records a rule match with compliance evidence
func RecordRuleMatch(ctx context.Context, span trace.Span, ruleID string, matched bool, duration time.Duration) {
	result := "no_match"
	if matched {
		result = "match"
	}

	span.SetAttributes(
		attribute.Bool("rule.matched", matched),
		attribute.Float64("rule.evaluation_duration_ms", float64(duration.Microseconds())/1000.0),
	)

	// Update Prometheus metrics
	RuleEvaluationDuration.WithLabelValues(ruleID, result).Observe(duration.Seconds())
	RuleEvaluationTotal.WithLabelValues(ruleID, result).Inc()

	if matched {
		span.AddEvent("rule.matched",
			trace.WithAttributes(
				attribute.String("rule.id", ruleID),
				attribute.String("match.reason", "pattern_satisfied"),
			),
		)
	}
}

// StartRuleLoadSpan creates a traced rule load operation
func StartRuleLoadSpan(ctx context.Context, ruleID string) (context.Context, trace.Span) {
	return tracer.Start(ctx, "rule.load",
		trace.WithAttributes(
			attribute.String("rule.id", ruleID),
			attribute.String("betrace.operation", "rule_load"),
		),
	)
}

// RecordRuleLoadResult records rule load success or failure
func RecordRuleLoadResult(ctx context.Context, span trace.Span, ruleID string, err error, duration time.Duration) {
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		span.RecordError(err)
		RuleLoadTotal.WithLabelValues("error").Inc()
	} else {
		span.SetStatus(codes.Ok, "rule loaded successfully")
		RuleLoadTotal.WithLabelValues("success").Inc()
	}

	RuleLoadDuration.Observe(duration.Seconds())
}

// EmitComplianceEvidence emits a compliance evidence span
func EmitComplianceEvidence(ctx context.Context, control ComplianceControl, outcome string, details map[string]interface{}) {
	_, span := tracer.Start(ctx, "compliance.evidence",
		trace.WithAttributes(ComplianceSpanAttributes(control, outcome)...),
	)
	defer span.End()

	// Add detailed attributes
	for key, value := range details {
		switch v := value.(type) {
		case string:
			span.SetAttributes(attribute.String(key, v))
		case int:
			span.SetAttributes(attribute.Int(key, v))
		case int64:
			span.SetAttributes(attribute.Int64(key, v))
		case bool:
			span.SetAttributes(attribute.Bool(key, v))
		case float64:
			span.SetAttributes(attribute.Float64(key, v))
		default:
			span.SetAttributes(attribute.String(key, fmt.Sprintf("%v", v)))
		}
	}

	// Update compliance metrics
	ComplianceSpansEmitted.WithLabelValues(string(control.Framework), control.ControlID, outcome).Inc()

	// Estimate span size for metrics
	estimatedSize := estimateSpanSize(details)
	ComplianceEvidenceSize.WithLabelValues(string(control.Framework)).Observe(float64(estimatedSize))
}

// EmitSOC2AccessControl emits SOC2 CC6.1 access control evidence
func EmitSOC2AccessControl(ctx context.Context, userID, resource string, granted bool) {
	outcome := "denied"
	if granted {
		outcome = "granted"
	}

	details := map[string]interface{}{
		"user_id":   userID,
		"resource":  resource,
		"granted":   granted,
		"timestamp": time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, SOC2_CC6_1, outcome, details)
	SOC2AccessControlChecks.WithLabelValues(outcome).Inc()
}

// EmitSOC2DataIsolation emits SOC2 CC6.3 data isolation evidence
func EmitSOC2DataIsolation(ctx context.Context, tenantID, operation string, isolated bool) {
	outcome := "violation"
	if isolated {
		outcome = "isolated"
	}

	details := map[string]interface{}{
		"tenant_id": tenantID,
		"operation": operation,
		"isolated":  isolated,
		"timestamp": time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, SOC2_CC6_3, outcome, details)
	SOC2DataIsolationChecks.WithLabelValues(tenantID, outcome).Inc()
}

// EmitHIPAAAccessLog emits HIPAA 164.312(b) audit control evidence
func EmitHIPAAAccessLog(ctx context.Context, userID, action, phi string) {
	details := map[string]interface{}{
		"user_id":   userID,
		"action":    action,
		"phi_type":  phi,
		"timestamp": time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, HIPAA_164_312_b, "logged", details)
	HIPAAAccessLogEntries.Inc()
}

// EmitHIPAAEncryption emits HIPAA 164.312(a)(2)(iv) encryption evidence
func EmitHIPAAEncryption(ctx context.Context, operation, dataType string, encrypted bool) {
	outcome := "failure"
	if encrypted {
		outcome = "success"
	}

	details := map[string]interface{}{
		"operation": operation,
		"data_type": dataType,
		"encrypted": encrypted,
		"timestamp": time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, HIPAA_164_312_a_2_iv, outcome, details)
	HIPAAEncryptionEvents.WithLabelValues(operation).Inc()
}

// EmitGDPRDataAccess emits GDPR Art. 15 data access evidence
func EmitGDPRDataAccess(ctx context.Context, dataSubjectID, requestType string, granted bool) {
	outcome := "denied"
	if granted {
		outcome = "granted"
	}

	details := map[string]interface{}{
		"data_subject_id": dataSubjectID,
		"request_type":    requestType,
		"granted":         granted,
		"timestamp":       time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, GDPR_Art_15, outcome, details)
	GDPRDataAccessRequests.WithLabelValues(outcome).Inc()
}

// EmitGDPRDataDeletion emits GDPR Art. 17 right to erasure evidence
func EmitGDPRDataDeletion(ctx context.Context, dataSubjectID string, status string) {
	details := map[string]interface{}{
		"data_subject_id": dataSubjectID,
		"status":          status,
		"timestamp":       time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, GDPR_Art_17, status, details)
	GDPRDataDeletionRequests.WithLabelValues(status).Inc()
}

// EmitGDPRConsent emits GDPR Art. 7 consent evidence
func EmitGDPRConsent(ctx context.Context, dataSubjectID, action, purpose string) {
	details := map[string]interface{}{
		"data_subject_id": dataSubjectID,
		"action":          action,
		"purpose":         purpose,
		"timestamp":       time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, GDPR_Art_7, action, details)
	GDPRConsentEvents.WithLabelValues(action).Inc()
}

// EmitFedRAMPAuditEvent emits FedRAMP AU-2 audit event evidence
func EmitFedRAMPAuditEvent(ctx context.Context, eventType, userID, action string) {
	details := map[string]interface{}{
		"event_type": eventType,
		"user_id":    userID,
		"action":     action,
		"timestamp":  time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, FedRAMP_AU_2, "recorded", details)
	FedRAMPAuditEvents.WithLabelValues(eventType).Inc()
}

// EmitFedRAMPAccessControl emits FedRAMP AC-3 access enforcement evidence
func EmitFedRAMPAccessControl(ctx context.Context, userID, resource string, granted bool) {
	outcome := "denied"
	if granted {
		outcome = "granted"
	}

	details := map[string]interface{}{
		"user_id":   userID,
		"resource":  resource,
		"granted":   granted,
		"timestamp": time.Now().Unix(),
	}

	EmitComplianceEvidence(ctx, FedRAMP_AC_3, outcome, details)
	FedRAMPAccessControlDecisions.WithLabelValues(outcome).Inc()
}

// DetectComplianceViolation detects and records a compliance violation
func DetectComplianceViolation(ctx context.Context, control ComplianceControl, severity, reason string) {
	_, span := tracer.Start(ctx, "compliance.violation",
		trace.WithAttributes(
			attribute.String("compliance.framework", string(control.Framework)),
			attribute.String("compliance.control", control.ControlID),
			attribute.String("compliance.severity", severity),
			attribute.String("compliance.reason", reason),
			attribute.Int64("compliance.timestamp", time.Now().Unix()),
		),
	)
	defer span.End()

	span.SetStatus(codes.Error, fmt.Sprintf("Compliance violation: %s", reason))
	ComplianceViolationsDetected.WithLabelValues(string(control.Framework), control.ControlID, severity).Inc()
}

// estimateSpanSize estimates the size of a span in bytes (approximate)
func estimateSpanSize(details map[string]interface{}) int {
	size := 200 // Base span overhead
	for key, value := range details {
		size += len(key)
		switch v := value.(type) {
		case string:
			size += len(v)
		case int, int64, bool, float64:
			size += 8
		default:
			size += len(fmt.Sprintf("%v", v))
		}
	}
	return size
}
