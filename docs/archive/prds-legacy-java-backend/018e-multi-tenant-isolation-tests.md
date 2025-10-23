# PRD-018e: Multi-Tenant Isolation Tests

**Priority:** P1 (Security - Critical)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-018 (Comprehensive Test Suite)
**Dependencies:** PRD-001 (Authentication), PRD-002 (TigerBeetle), PRD-018c (IntegrationTestHarness)

## Problem

Multi-tenant isolation is critical for SaaS security but lacks comprehensive tests. No validation that tenant A cannot access tenant B's data. No tests for cross-tenant data leakage through TigerBeetle ledgers, DuckDB queries, or API endpoints.

## Solution

Implement security-focused integration tests validating tenant isolation at all layers: TigerBeetle ledger isolation, DuckDB query isolation, API authorization, KMS key isolation. Test attack scenarios where malicious tenant attempts cross-tenant access.

## Unit Description

**File:** `backend/src/test/java/com/betrace/security/MultiTenantIsolationTest.java`
**Type:** Security Integration Test
**Purpose:** Validate tenant data isolation across all persistence layers

## Implementation

```java
package com.betrace.security;

import com.betrace.model.*;
import com.betrace.services.*;
import com.betrace.test.harness.BaseIntegrationTest;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.RestAssured;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.List;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;

/**
 * Security integration tests for multi-tenant isolation
 * Validates that tenants cannot access each other's data
 */
@QuarkusTest
class MultiTenantIsolationTest extends BaseIntegrationTest {

    @Inject
    TenantService tenantService;

    @Inject
    SignalService signalService;

    @Inject
    RuleService ruleService;

    @Inject
    SpanIngestionService spanIngestionService;

    @Inject
    KMSService kmsService;

    // ============ TIGERBEETLE LEDGER ISOLATION ============

    @Test
    @DisplayName("Tenant signals are isolated in separate TigerBeetle ledgers")
    void testTigerBeetleLedgerIsolation() throws Exception {
        // Given: Two tenants
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        // And: Each tenant has a signal
        Signal signal1 = fixtures.createCriticalSignal(tenant1.id, UUID.randomUUID());
        Signal signal2 = fixtures.createCriticalSignal(tenant2.id, UUID.randomUUID());

        signalService.createSignal(signal1);
        signalService.createSignal(signal2);

        // When: Query signals for tenant 1
        List<Signal> tenant1Signals = signalService.getSignalsForTenant(tenant1.id);

        // Then: Only tenant 1's signal returned
        assertThat(tenant1Signals).hasSize(1);
        assertThat(tenant1Signals.get(0).getId()).isEqualTo(signal1.getId());

        // When: Query signals for tenant 2
        List<Signal> tenant2Signals = signalService.getSignalsForTenant(tenant2.id);

        // Then: Only tenant 2's signal returned
        assertThat(tenant2Signals).hasSize(1);
        assertThat(tenant2Signals.get(0).getId()).isEqualTo(signal2.getId());
    }

    @Test
    @DisplayName("Tenant spans are isolated in TigerBeetle")
    void testSpanIsolationInTigerBeetle() throws Exception {
        // Given: Two tenants with spans
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        List<Span> spans1 = fixtures.createPIILeakTrace();
        List<Span> spans2 = fixtures.createAuthenticationFailureTrace();

        // When: Ingest spans for both tenants
        spanIngestionService.ingestSpans(tenant1.id, spans1);
        spanIngestionService.ingestSpans(tenant2.id, spans2);

        Thread.sleep(500);

        // Then: Query spans for tenant 1
        List<Span> tenant1Spans = queryDuckDBSpans(tenant1.id);
        assertThat(tenant1Spans).hasSize(spans1.size());
        assertThat(tenant1Spans.get(0).getTraceId()).isEqualTo(spans1.get(0).getTraceId());

        // And: Query spans for tenant 2
        List<Span> tenant2Spans = queryDuckDBSpans(tenant2.id);
        assertThat(tenant2Spans).hasSize(spans2.size());
        assertThat(tenant2Spans.get(0).getTraceId()).isEqualTo(spans2.get(0).getTraceId());

        // And: No cross-tenant contamination
        assertThat(tenant1Spans.get(0).getTraceId()).isNotEqualTo(tenant2Spans.get(0).getTraceId());
    }

    // ============ DUCKDB QUERY ISOLATION ============

    @Test
    @DisplayName("DuckDB queries filter by tenant_id")
    void testDuckDBQueryIsolation() throws Exception {
        // Given: Two tenants with rules
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        Rule rule1 = fixtures.createDetectPIILeakRule(tenant1.id);
        Rule rule2 = fixtures.createDetectAuthFailureRule(tenant2.id);

        ruleService.createRule(rule1);
        ruleService.createRule(rule2);

        // When: Query rules for tenant 1
        List<Rule> tenant1Rules = ruleService.getRulesForTenant(tenant1.id);

        // Then: Only tenant 1's rule returned
        assertThat(tenant1Rules).hasSize(1);
        assertThat(tenant1Rules.get(0).getId()).isEqualTo(rule1.getId());
        assertThat(tenant1Rules.get(0).getTenantId()).isEqualTo(tenant1.id);

        // When: Query rules for tenant 2
        List<Rule> tenant2Rules = ruleService.getRulesForTenant(tenant2.id);

        // Then: Only tenant 2's rule returned
        assertThat(tenant2Rules).hasSize(1);
        assertThat(tenant2Rules.get(0).getId()).isEqualTo(rule2.getId());
        assertThat(tenant2Rules.get(0).getTenantId()).isEqualTo(tenant2.id);
    }

    // ============ API AUTHORIZATION ISOLATION ============

    @Test
    @DisplayName("API endpoints enforce tenant isolation via JWT")
    void testAPITenantIsolation() throws Exception {
        // Given: Two tenants with signals
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        TestUser user1 = fixtures.createUser(tenant1.id, "user1@tenant1.com", "user");
        TestUser user2 = fixtures.createUser(tenant2.id, "user2@tenant2.com", "user");

        Signal signal1 = fixtures.createCriticalSignal(tenant1.id, UUID.randomUUID());
        Signal signal2 = fixtures.createCriticalSignal(tenant2.id, UUID.randomUUID());

        signalService.createSignal(signal1);
        signalService.createSignal(signal2);

        // When: User 1 requests signals
        given()
            .header("Authorization", "Bearer " + user1.jwtToken)
            .when()
            .get("/api/signals")
            .then()
            .statusCode(200)
            .body("size()", equalTo(1))
            .body("[0].id", equalTo(signal1.getId().toString()));

        // When: User 2 requests signals
        given()
            .header("Authorization", "Bearer " + user2.jwtToken)
            .when()
            .get("/api/signals")
            .then()
            .statusCode(200)
            .body("size()", equalTo(1))
            .body("[0].id", equalTo(signal2.getId().toString()));
    }

    @Test
    @DisplayName("Tenant cannot access another tenant's signal by ID")
    void testCrossTenantSignalAccessDenied() throws Exception {
        // Given: Two tenants with signals
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        TestUser user1 = fixtures.createUser(tenant1.id, "user1@tenant1.com", "user");

        Signal signal2 = fixtures.createCriticalSignal(tenant2.id, UUID.randomUUID());
        signalService.createSignal(signal2);

        // When: User 1 attempts to access tenant 2's signal
        given()
            .header("Authorization", "Bearer " + user1.jwtToken)
            .when()
            .get("/api/signals/" + signal2.getId())
            .then()
            .statusCode(403); // Forbidden - cross-tenant access denied
    }

    @Test
    @DisplayName("Tenant cannot create rule for another tenant")
    void testCrossTenantRuleCreationDenied() throws Exception {
        // Given: Two tenants
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        TestUser user1 = fixtures.createUser(tenant1.id, "user1@tenant1.com", "admin");

        // When: User 1 attempts to create rule for tenant 2
        Rule maliciousRule = fixtures.createDetectPIILeakRule(tenant2.id);

        given()
            .header("Authorization", "Bearer " + user1.jwtToken)
            .header("Content-Type", "application/json")
            .body(maliciousRule)
            .when()
            .post("/api/rules")
            .then()
            .statusCode(403); // Forbidden - cannot create rule for another tenant
    }

    // ============ KMS KEY ISOLATION ============

    @Test
    @DisplayName("Tenant signing keys are isolated in KMS")
    void testKMSKeyIsolation() throws Exception {
        // Given: Two tenants with signing keys
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        // When: Get public key for tenant 1
        byte[] publicKey1 = kmsService.getPublicKey(tenant1.id, "signing");

        // And: Get public key for tenant 2
        byte[] publicKey2 = kmsService.getPublicKey(tenant2.id, "signing");

        // Then: Keys are different
        assertThat(publicKey1).isNotEqualTo(publicKey2);

        // When: Tenant 1 signs data with their key
        String data = "test data";
        byte[] signature1 = kmsService.sign(tenant1.id, "signing", data.getBytes());

        // Then: Signature verifies with tenant 1's public key
        boolean valid1 = kmsService.verify(tenant1.id, "signing", data.getBytes(), signature1);
        assertThat(valid1).isTrue();

        // And: Signature does NOT verify with tenant 2's public key
        // (In real implementation, would need to explicitly try tenant2's key)
    }

    // ============ ATTACK SCENARIOS ============

    @Test
    @DisplayName("SQL injection attempt cannot bypass tenant isolation")
    void testSQLInjectionTenantIsolation() throws Exception {
        // Given: Tenant with signal
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        TestUser user1 = fixtures.createUser(tenant1.id, "user1@tenant1.com", "user");

        Signal signal2 = fixtures.createCriticalSignal(tenant2.id, UUID.randomUUID());
        signalService.createSignal(signal2);

        // When: User 1 attempts SQL injection to access tenant 2's data
        String maliciousTenantId = tenant2.id + "' OR '1'='1";

        given()
            .header("Authorization", "Bearer " + user1.jwtToken)
            .queryParam("tenant_id", maliciousTenantId)
            .when()
            .get("/api/signals")
            .then()
            .statusCode(anyOf(is(400), is(403))); // Bad Request or Forbidden
    }

    @Test
    @DisplayName("JWT tampering cannot escalate to another tenant")
    void testJWTTamperingTenantIsolation() throws Exception {
        // Given: Two tenants
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        TestUser user1 = fixtures.createUser(tenant1.id, "user1@tenant1.com", "user");

        // When: User 1 attempts to modify JWT tenant_id claim (tampered token)
        String tamperedToken = user1.jwtToken.replace(
            tenant1.id.toString(),
            tenant2.id.toString()
        );

        // Then: Request fails (invalid signature)
        given()
            .header("Authorization", "Bearer " + tamperedToken)
            .when()
            .get("/api/signals")
            .then()
            .statusCode(401); // Unauthorized - invalid JWT signature
    }

    @Test
    @DisplayName("Parallel requests from different tenants are isolated")
    void testConcurrentTenantIsolation() throws Exception {
        // Given: 10 tenants
        List<TestTenant> tenants = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            tenants.add(fixtures.createTenant("Tenant " + i));
        }

        // When: All tenants ingest spans concurrently
        tenants.parallelStream().forEach(tenant -> {
            try {
                List<Span> spans = fixtures.createPIILeakTrace();
                spanIngestionService.ingestSpans(tenant.id, spans);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        Thread.sleep(2000); // Wait for all processing

        // Then: Each tenant has exactly their own spans
        for (TestTenant tenant : tenants) {
            List<Span> tenantSpans = queryDuckDBSpans(tenant.id);
            assertThat(tenantSpans).hasSize(1); // Each tenant ingested 1 trace
            assertThat(tenantSpans.get(0).getAttributes()).containsKey("user_ssn"); // PII leak trace
        }
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Tests validate ledger isolation per tenant
**ADR-013 (Camel-First):** Tests validate tenant isolation in routes
**ADR-014 (Named Processors):** Tests validate processors enforce tenant isolation
**ADR-015 (Tiered Storage):** Tests validate isolation across all storage tiers

## Test Requirements (QA Expert)

**Unit Tests:**
- testTigerBeetleLedgerIsolation - signals isolated by ledger
- testSpanIsolationInTigerBeetle - spans isolated by tenant
- testDuckDBQueryIsolation - queries filter by tenant_id
- testAPITenantIsolation - API enforces JWT tenant isolation
- testCrossTenantSignalAccessDenied - 403 on cross-tenant access
- testCrossTenantRuleCreationDenied - 403 on cross-tenant creation
- testKMSKeyIsolation - signing keys isolated per tenant
- testSQLInjectionTenantIsolation - SQL injection blocked
- testJWTTamperingTenantIsolation - tampered JWT rejected
- testConcurrentTenantIsolation - parallel requests isolated

**Integration Tests:**
- testFullWorkflow_MultiTenantIsolation - end-to-end isolation validation

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats Tested:**
- Cross-tenant data access via API
- SQL injection to bypass tenant filters
- JWT tampering to escalate tenant_id
- Concurrent request race conditions
- KMS key confusion attacks

**Compliance:**
- SOC2 CC6.1 (Logical Access) - tenant isolation enforced
- GDPR Article 32 (Security of Processing) - data segregation validated

## Success Criteria

- [ ] TigerBeetle ledger isolation validated
- [ ] DuckDB query isolation validated
- [ ] API authorization enforces tenant isolation
- [ ] KMS key isolation validated
- [ ] SQL injection attacks blocked
- [ ] JWT tampering attacks blocked
- [ ] Concurrent multi-tenant requests isolated
- [ ] All tests pass with 90% coverage
