package observability

import (
	"context"
	"testing"
)

func TestComplianceSpanAttributes(t *testing.T) {
	control := SOC2_CC6_1
	outcome := "granted"

	attrs := ComplianceSpanAttributes(control, outcome)

	if len(attrs) == 0 {
		t.Fatal("Expected compliance attributes, got empty")
	}

	// Verify key attributes are present
	foundFramework := false
	foundControl := false
	foundOutcome := false

	for _, attr := range attrs {
		switch attr.Key {
		case "compliance.framework":
			foundFramework = true
			if attr.Value.AsString() != "soc2" {
				t.Errorf("Expected framework 'soc2', got '%s'", attr.Value.AsString())
			}
		case "compliance.control":
			foundControl = true
			if attr.Value.AsString() != "CC6.1" {
				t.Errorf("Expected control 'CC6.1', got '%s'", attr.Value.AsString())
			}
		case "compliance.outcome":
			foundOutcome = true
			if attr.Value.AsString() != "granted" {
				t.Errorf("Expected outcome 'granted', got '%s'", attr.Value.AsString())
			}
		}
	}

	if !foundFramework {
		t.Error("Missing compliance.framework attribute")
	}
	if !foundControl {
		t.Error("Missing compliance.control attribute")
	}
	if !foundOutcome {
		t.Error("Missing compliance.outcome attribute")
	}
}

func TestEmitSOC2AccessControl(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitSOC2AccessControl(ctx, "user-123", "/api/data", true)
	EmitSOC2AccessControl(ctx, "user-456", "/api/secrets", false)
}

func TestEmitSOC2DataIsolation(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitSOC2DataIsolation(ctx, "tenant-abc", "query", true)
	EmitSOC2DataIsolation(ctx, "tenant-xyz", "update", false)
}

func TestEmitHIPAAAccessLog(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitHIPAAAccessLog(ctx, "doctor-smith", "view_patient", "medical_record")
}

func TestEmitHIPAAEncryption(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitHIPAAEncryption(ctx, "encrypt", "patient_ssn", true)
	EmitHIPAAEncryption(ctx, "decrypt", "patient_data", true)
}

func TestEmitGDPRDataAccess(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitGDPRDataAccess(ctx, "user-jane", "data_export", true)
	EmitGDPRDataAccess(ctx, "user-john", "profile_view", false)
}

func TestEmitGDPRDataDeletion(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitGDPRDataDeletion(ctx, "user-alice", "completed")
	EmitGDPRDataDeletion(ctx, "user-bob", "pending")
}

func TestEmitGDPRConsent(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitGDPRConsent(ctx, "user-charlie", "granted", "marketing")
	EmitGDPRConsent(ctx, "user-dave", "revoked", "analytics")
}

func TestEmitFedRAMPAuditEvent(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitFedRAMPAuditEvent(ctx, "admin", "admin-bob", "update_policy")
	EmitFedRAMPAuditEvent(ctx, "access", "user-eve", "login")
}

func TestEmitFedRAMPAccessControl(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	EmitFedRAMPAccessControl(ctx, "contractor-charlie", "/classified", false)
	EmitFedRAMPAccessControl(ctx, "employee-frank", "/public", true)
}

func TestDetectComplianceViolation(t *testing.T) {
	ctx := context.Background()

	// Should not panic
	DetectComplianceViolation(ctx, SOC2_CC7_2, "high", "Missing audit log")
}

func TestEmitComplianceEvidence(t *testing.T) {
	ctx := context.Background()

	control := SOC2_CC6_1
	outcome := "granted"
	details := map[string]interface{}{
		"user_id":  "test-user",
		"resource": "/api/test",
		"granted":  true,
		"count":    42,
		"duration": 123.45,
	}

	// Should not panic
	EmitComplianceEvidence(ctx, control, outcome, details)
}

func TestEstimateSpanSize(t *testing.T) {
	details := map[string]interface{}{
		"key1": "value1",
		"key2": 123,
		"key3": true,
	}

	size := estimateSpanSize(details)

	if size <= 0 {
		t.Error("Expected positive span size")
	}

	// Should include base overhead
	if size < 200 {
		t.Errorf("Expected size >= 200 bytes, got %d", size)
	}
}

func TestComplianceControls(t *testing.T) {
	// Verify all compliance controls are properly initialized
	controls := []ComplianceControl{
		SOC2_CC6_1, SOC2_CC6_2, SOC2_CC6_3, SOC2_CC6_6, SOC2_CC6_7,
		SOC2_CC7_1, SOC2_CC7_2, SOC2_CC8_1,
		HIPAA_164_312_a, HIPAA_164_312_b, HIPAA_164_312_a_2_i,
		HIPAA_164_312_a_2_iv, HIPAA_164_312_e_2_ii,
		GDPR_Art_15, GDPR_Art_17, GDPR_Art_7, GDPR_Art_32,
		FedRAMP_AC_2, FedRAMP_AC_3, FedRAMP_AU_2, FedRAMP_AU_3, FedRAMP_CM_2,
	}

	for _, control := range controls {
		if control.Framework == "" {
			t.Errorf("Control has empty framework: %+v", control)
		}
		if control.ControlID == "" {
			t.Errorf("Control has empty ID: %+v", control)
		}
	}
}

func BenchmarkEmitComplianceEvidence(b *testing.B) {
	ctx := context.Background()
	control := SOC2_CC6_1
	outcome := "granted"
	details := map[string]interface{}{
		"user_id":  "bench-user",
		"resource": "/api/bench",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		EmitComplianceEvidence(ctx, control, outcome, details)
	}
}

func BenchmarkEmitSOC2AccessControl(b *testing.B) {
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		EmitSOC2AccessControl(ctx, "user-123", "/api/data", true)
	}
}

func BenchmarkComplianceSpanAttributes(b *testing.B) {
	control := SOC2_CC6_1
	outcome := "granted"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ComplianceSpanAttributes(control, outcome)
	}
}
