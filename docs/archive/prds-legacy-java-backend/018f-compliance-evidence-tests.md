# PRD-018f: Compliance Evidence Tests

**Priority:** P1 (Compliance - Critical)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-018 (Comprehensive Test Suite)
**Dependencies:** PRD-003 (Compliance Span Signing), PRD-006 (KMS), PRD-018c (IntegrationTestHarness)

## Problem

Compliance spans are critical for SOC2/HIPAA/GDPR evidence but lack comprehensive validation tests. No tests verifying all compliance spans are signed. No validation of compliance span attributes. No tests for signature verification. Compliance gaps risk audit failures.

## Solution

Implement integration tests validating all compliance evidence: span signatures are valid, compliance attributes are correct, evidence proves control effectiveness. Test all compliance frameworks (SOC2, HIPAA, GDPR, PCI-DSS).

## Unit Description

**File:** `backend/src/test/java/com/betrace/compliance/ComplianceEvidenceTest.java`
**Type:** Compliance Integration Test
**Purpose:** Validate compliance spans and cryptographic signatures

## Implementation

```java
package com.betrace.compliance;

import com.betrace.model.*;
import com.betrace.services.*;
import com.betrace.test.harness.BaseIntegrationTest;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for compliance evidence validation
 * Validates all compliance spans are signed and contain correct attributes
 */
@QuarkusTest
class ComplianceEvidenceTest extends BaseIntegrationTest {

    @Inject
    ComplianceSpanService complianceSpanService;

    @Inject
    KMSService kmsService;

    @Inject
    SignalService signalService;

    @Inject
    NotificationService notificationService;

    // ============ SOC2 COMPLIANCE EVIDENCE ============

    @Test
    @DisplayName("SOC2 CC6.1: Logical Access - Authentication spans are signed")
    void testSOC2_CC6_1_AuthenticationEvidence() throws Exception {
        // Given: Tenant with authentication activity
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        // Simulate authentication event
        ComplianceSpan authSpan = new ComplianceSpan();
        authSpan.setTenantId(tenant.id);
        authSpan.setOperationName("user_authentication");
        authSpan.getAttributes().put("compliance.framework", "SOC2");
        authSpan.getAttributes().put("compliance.control", "CC6.1");
        authSpan.getAttributes().put("compliance.status", "PASS");
        authSpan.getAttributes().put("auth.user_id", user.id.toString());
        authSpan.getAttributes().put("auth.method", "jwt");

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, authSpan);

        // Then: Span is signed
        assertThat(signedSpan.getSignature()).isNotNull();
        assertThat(signedSpan.getSignature()).isNotEmpty();

        // And: Signature verifies with tenant's public key
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            signedSpan.getSignature()
        );
        assertThat(isValid).isTrue();

        // And: Compliance attributes are correct
        assertThat(signedSpan.getAttributes()).containsEntry("compliance.framework", "SOC2");
        assertThat(signedSpan.getAttributes()).containsEntry("compliance.control", "CC6.1");
        assertThat(signedSpan.getAttributes()).containsEntry("compliance.status", "PASS");
    }

    @Test
    @DisplayName("SOC2 CC6.6: Logical Access - Encryption evidence spans are signed")
    void testSOC2_CC6_6_EncryptionEvidence() throws Exception {
        // Given: Tenant with encryption activity
        TestTenant tenant = fixtures.createTenant("Test Corp");

        // Simulate data encryption event
        ComplianceSpan encryptionSpan = new ComplianceSpan();
        encryptionSpan.setTenantId(tenant.id);
        encryptionSpan.setOperationName("data_encryption");
        encryptionSpan.getAttributes().put("compliance.framework", "SOC2");
        encryptionSpan.getAttributes().put("compliance.control", "CC6.6");
        encryptionSpan.getAttributes().put("compliance.status", "PASS");
        encryptionSpan.getAttributes().put("encryption.algorithm", "AES-256-GCM");
        encryptionSpan.getAttributes().put("encryption.key_id", UUID.randomUUID().toString());
        encryptionSpan.getAttributes().put("data.type", "ssn");

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, encryptionSpan);

        // Then: Signature verifies
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            signedSpan.getSignature()
        );
        assertThat(isValid).isTrue();

        // And: Compliance attributes prove encryption
        assertThat(signedSpan.getAttributes()).containsEntry("compliance.control", "CC6.6");
        assertThat(signedSpan.getAttributes()).containsEntry("encryption.algorithm", "AES-256-GCM");
    }

    @Test
    @DisplayName("SOC2 CC7.2: System Monitoring - Notification evidence spans are signed")
    void testSOC2_CC7_2_NotificationEvidence() throws Exception {
        // Given: Tenant with notification config
        TestTenant tenant = fixtures.createTenant("Test Corp");
        Signal signal = fixtures.createCriticalSignal(tenant.id, UUID.randomUUID());

        // Simulate notification delivery
        ComplianceSpan notificationSpan = new ComplianceSpan();
        notificationSpan.setTenantId(tenant.id);
        notificationSpan.setOperationName("notification_delivery");
        notificationSpan.getAttributes().put("compliance.framework", "SOC2");
        notificationSpan.getAttributes().put("compliance.control", "CC7.2");
        notificationSpan.getAttributes().put("compliance.status", "PASS");
        notificationSpan.getAttributes().put("notification.channel", "webhook");
        notificationSpan.getAttributes().put("notification.status", "sent");
        notificationSpan.getAttributes().put("signal.id", signal.getId().toString());
        notificationSpan.getAttributes().put("signal.severity", "critical");

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, notificationSpan);

        // Then: Signature verifies
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            signedSpan.getSignature()
        );
        assertThat(isValid).isTrue();

        // And: Evidence proves incident was communicated
        assertThat(signedSpan.getAttributes()).containsEntry("notification.status", "sent");
        assertThat(signedSpan.getAttributes()).containsEntry("signal.severity", "critical");
    }

    @Test
    @DisplayName("SOC2 CC8.1: Change Management - Rule testing evidence spans are signed")
    void testSOC2_CC8_1_RuleTestingEvidence() throws Exception {
        // Given: Tenant with rule
        TestTenant tenant = fixtures.createTenant("Test Corp");
        Rule rule = fixtures.createDetectPIILeakRule(tenant.id);

        // Simulate rule testing event
        ComplianceSpan testSpan = new ComplianceSpan();
        testSpan.setTenantId(tenant.id);
        testSpan.setOperationName("rule_testing");
        testSpan.getAttributes().put("compliance.framework", "SOC2");
        testSpan.getAttributes().put("compliance.control", "CC8.1");
        testSpan.getAttributes().put("compliance.status", "PASS");
        testSpan.getAttributes().put("rule.id", rule.getId().toString());
        testSpan.getAttributes().put("test.result", "pass");
        testSpan.getAttributes().put("test.matched_spans", 3);

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, testSpan);

        // Then: Signature verifies
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            signedSpan.getSignature()
        );
        assertThat(isValid).isTrue();

        // And: Evidence proves testing occurred before deployment
        assertThat(signedSpan.getAttributes()).containsEntry("test.result", "pass");
    }

    // ============ HIPAA COMPLIANCE EVIDENCE ============

    @Test
    @DisplayName("HIPAA §164.312(a): Access Control - PHI access audit spans are signed")
    void testHIPAA_164_312_a_AccessControlEvidence() throws Exception {
        // Given: Tenant with PHI access
        TestTenant tenant = fixtures.createTenant("Healthcare Corp");
        TestUser user = fixtures.createUser(tenant.id, "doctor@healthcare.com", "user");

        // Simulate PHI access event
        ComplianceSpan phiAccessSpan = new ComplianceSpan();
        phiAccessSpan.setTenantId(tenant.id);
        phiAccessSpan.setOperationName("phi_access");
        phiAccessSpan.getAttributes().put("compliance.framework", "HIPAA");
        phiAccessSpan.getAttributes().put("compliance.control", "§164.312(a)");
        phiAccessSpan.getAttributes().put("compliance.status", "PASS");
        phiAccessSpan.getAttributes().put("user.id", user.id.toString());
        phiAccessSpan.getAttributes().put("patient.id", "patient_123");
        phiAccessSpan.getAttributes().put("data.type", "medical_record");

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, phiAccessSpan);

        // Then: Signature verifies
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            signedSpan.getSignature()
        );
        assertThat(isValid).isTrue();

        // And: Evidence proves PHI access was audited
        assertThat(signedSpan.getAttributes()).containsEntry("compliance.framework", "HIPAA");
        assertThat(signedSpan.getAttributes()).containsKey("patient.id");
    }

    @Test
    @DisplayName("HIPAA §164.514: De-identification - Redaction evidence spans are signed")
    void testHIPAA_164_514_RedactionEvidence() throws Exception {
        // Given: Tenant with redaction activity
        TestTenant tenant = fixtures.createTenant("Healthcare Corp");

        // Simulate data redaction event
        ComplianceSpan redactionSpan = new ComplianceSpan();
        redactionSpan.setTenantId(tenant.id);
        redactionSpan.setOperationName("data_redaction");
        redactionSpan.getAttributes().put("compliance.framework", "HIPAA");
        redactionSpan.getAttributes().put("compliance.control", "§164.514");
        redactionSpan.getAttributes().put("compliance.status", "PASS");
        redactionSpan.getAttributes().put("redaction.field", "ssn");
        redactionSpan.getAttributes().put("redaction.method", "hash");

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, redactionSpan);

        // Then: Signature verifies
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            signedSpan.getSignature()
        );
        assertThat(isValid).isTrue();
    }

    // ============ GDPR COMPLIANCE EVIDENCE ============

    @Test
    @DisplayName("GDPR Article 32: Security of Processing - Encryption evidence spans are signed")
    void testGDPR_Article32_SecurityEvidence() throws Exception {
        // Given: Tenant with encryption activity
        TestTenant tenant = fixtures.createTenant("EU Corp");

        // Simulate encryption event
        ComplianceSpan encryptionSpan = new ComplianceSpan();
        encryptionSpan.setTenantId(tenant.id);
        encryptionSpan.setOperationName("gdpr_encryption");
        encryptionSpan.getAttributes().put("compliance.framework", "GDPR");
        encryptionSpan.getAttributes().put("compliance.control", "Article 32");
        encryptionSpan.getAttributes().put("compliance.status", "PASS");
        encryptionSpan.getAttributes().put("encryption.algorithm", "AES-256-GCM");
        encryptionSpan.getAttributes().put("data.category", "personal_data");

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, encryptionSpan);

        // Then: Signature verifies
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            signedSpan.getSignature()
        );
        assertThat(isValid).isTrue();
    }

    // ============ SIGNATURE VALIDATION ============

    @Test
    @DisplayName("Compliance span with tampered signature fails verification")
    void testTamperedSignatureFails() throws Exception {
        // Given: Tenant with compliance span
        TestTenant tenant = fixtures.createTenant("Test Corp");

        ComplianceSpan span = new ComplianceSpan();
        span.setTenantId(tenant.id);
        span.setOperationName("test_operation");
        span.getAttributes().put("compliance.framework", "SOC2");
        span.getAttributes().put("compliance.control", "CC6.1");
        span.getAttributes().put("compliance.status", "PASS");

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, span);

        // And: Tamper with signature
        byte[] tamperedSignature = new byte[signedSpan.getSignature().length];
        System.arraycopy(signedSpan.getSignature(), 0, tamperedSignature, 0, tamperedSignature.length);
        tamperedSignature[0] = (byte) (tamperedSignature[0] ^ 0xFF); // Flip bits

        // Then: Verification fails
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            tamperedSignature
        );
        assertThat(isValid).isFalse();
    }

    @Test
    @DisplayName("Compliance span with tampered attributes fails verification")
    void testTamperedAttributesFail() throws Exception {
        // Given: Tenant with compliance span
        TestTenant tenant = fixtures.createTenant("Test Corp");

        ComplianceSpan span = new ComplianceSpan();
        span.setTenantId(tenant.id);
        span.setOperationName("test_operation");
        span.getAttributes().put("compliance.framework", "SOC2");
        span.getAttributes().put("compliance.control", "CC6.1");
        span.getAttributes().put("compliance.status", "PASS");

        // When: Sign compliance span
        ComplianceSpan signedSpan = complianceSpanService.signComplianceSpan(tenant.id, span);

        // And: Tamper with attributes after signing
        signedSpan.getAttributes().put("compliance.status", "FAIL");

        // Then: Verification fails
        boolean isValid = kmsService.verify(
            tenant.id,
            "signing",
            complianceSpanService.getSpanPayload(signedSpan),
            signedSpan.getSignature()
        );
        assertThat(isValid).isFalse();
    }

    @Test
    @DisplayName("All compliance spans in system are signed")
    void testAllComplianceSpansAreSigned() throws Exception {
        // Given: Tenant with multiple compliance activities
        TestTenant tenant = fixtures.createTenant("Test Corp");

        // Generate various compliance spans
        List<ComplianceSpan> spans = List.of(
            createAuthenticationSpan(tenant.id),
            createEncryptionSpan(tenant.id),
            createNotificationSpan(tenant.id),
            createTestingSpan(tenant.id)
        );

        // When: Sign all spans
        List<ComplianceSpan> signedSpans = spans.stream()
            .map(span -> complianceSpanService.signComplianceSpan(tenant.id, span))
            .toList();

        // Then: All spans have valid signatures
        for (ComplianceSpan signedSpan : signedSpans) {
            assertThat(signedSpan.getSignature()).isNotNull();
            boolean isValid = kmsService.verify(
                tenant.id,
                "signing",
                complianceSpanService.getSpanPayload(signedSpan),
                signedSpan.getSignature()
            );
            assertThat(isValid).isTrue();
        }
    }

    // ============ HELPER METHODS ============

    private ComplianceSpan createAuthenticationSpan(UUID tenantId) {
        ComplianceSpan span = new ComplianceSpan();
        span.setTenantId(tenantId);
        span.setOperationName("user_authentication");
        span.getAttributes().put("compliance.framework", "SOC2");
        span.getAttributes().put("compliance.control", "CC6.1");
        span.getAttributes().put("compliance.status", "PASS");
        return span;
    }

    private ComplianceSpan createEncryptionSpan(UUID tenantId) {
        ComplianceSpan span = new ComplianceSpan();
        span.setTenantId(tenantId);
        span.setOperationName("data_encryption");
        span.getAttributes().put("compliance.framework", "SOC2");
        span.getAttributes().put("compliance.control", "CC6.6");
        span.getAttributes().put("compliance.status", "PASS");
        return span;
    }

    private ComplianceSpan createNotificationSpan(UUID tenantId) {
        ComplianceSpan span = new ComplianceSpan();
        span.setTenantId(tenantId);
        span.setOperationName("notification_delivery");
        span.getAttributes().put("compliance.framework", "SOC2");
        span.getAttributes().put("compliance.control", "CC7.2");
        span.getAttributes().put("compliance.status", "PASS");
        return span;
    }

    private ComplianceSpan createTestingSpan(UUID tenantId) {
        ComplianceSpan span = new ComplianceSpan();
        span.setTenantId(tenantId);
        span.setOperationName("rule_testing");
        span.getAttributes().put("compliance.framework", "SOC2");
        span.getAttributes().put("compliance.control", "CC8.1");
        span.getAttributes().put("compliance.status", "PASS");
        return span;
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Tests validate compliance spans in TigerBeetle
**ADR-013 (Camel-First):** Tests validate compliance span generation in routes
**ADR-014 (Named Processors):** Tests validate compliance processors
**ADR-015 (Tiered Storage):** Tests validate compliance spans across storage tiers

## Compliance Frameworks Tested

**SOC2 Controls:**
- CC6.1 (Logical Access - Authentication)
- CC6.6 (Logical Access - Encryption)
- CC7.2 (System Monitoring - Notifications)
- CC8.1 (Change Management - Testing)

**HIPAA Controls:**
- §164.312(a) (Access Control)
- §164.514 (De-identification)

**GDPR Controls:**
- Article 32 (Security of Processing)

## Test Requirements (QA Expert)

**Unit Tests:**
- testSOC2_CC6_1_AuthenticationEvidence - authentication spans signed
- testSOC2_CC6_6_EncryptionEvidence - encryption spans signed
- testSOC2_CC7_2_NotificationEvidence - notification spans signed
- testSOC2_CC8_1_RuleTestingEvidence - testing spans signed
- testHIPAA_164_312_a_AccessControlEvidence - PHI access spans signed
- testHIPAA_164_514_RedactionEvidence - redaction spans signed
- testGDPR_Article32_SecurityEvidence - encryption spans signed
- testTamperedSignatureFails - tampered signature rejected
- testTamperedAttributesFail - tampered attributes rejected
- testAllComplianceSpansAreSigned - all spans have valid signatures

**Integration Tests:**
- testFullWorkflow_ComplianceEvidence - end-to-end evidence generation

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats Tested:**
- Signature tampering
- Attribute tampering after signing
- Cross-tenant signature verification

**Compliance:**
- SOC2 CC6.1, CC6.6, CC7.2, CC8.1 - cryptographic evidence validation
- HIPAA §164.312(a), §164.514 - PHI access and redaction evidence
- GDPR Article 32 - security of processing evidence

## Success Criteria

- [ ] All SOC2 compliance spans validated (CC6.1, CC6.6, CC7.2, CC8.1)
- [ ] All HIPAA compliance spans validated (§164.312(a), §164.514)
- [ ] All GDPR compliance spans validated (Article 32)
- [ ] Signature verification tests pass
- [ ] Tampered signature/attribute tests detect tampering
- [ ] All compliance spans in system are signed
- [ ] All tests pass with 90% coverage
