# PRD-018a: Test Fixture Generator

**Priority:** P1 (Infrastructure - Test Foundation)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-018 (Comprehensive Test Suite)
**Dependencies:** PRD-002 (TigerBeetle), PRD-006 (KMS), PRD-008 (Signal Management)

## Problem

Test code duplicates fixture generation logic across test files. No standardized way to create realistic test data for tenants, users, spans, traces, rules, and signals. Manual fixture creation is error-prone and inconsistent.

## Solution

Implement centralized test fixture generators for all BeTrace domain models. Provide realistic default data with customization options. Support multi-tenant scenarios, compliance spans, and complex trace topologies.

## Unit Description

**File:** `backend/src/test/java/com/fluo/test/fixtures/TestFixtureGenerator.java`
**Type:** Test Utility Class
**Purpose:** Generate realistic test data for all BeTrace tests

## Implementation

```java
package com.fluo.test.fixtures;

import com.fluo.model.*;
import com.fluo.services.*;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class TestFixtureGenerator {

    @Inject
    TenantService tenantService;

    @Inject
    KMSService kmsService;

    @Inject
    RuleService ruleService;

    @Inject
    SignalService signalService;

    // ============ TENANT FIXTURES ============

    public TestTenant createTenant(String name) {
        UUID tenantId = UUID.randomUUID();
        Tenant tenant = new Tenant();
        tenant.setId(tenantId);
        tenant.setName(name);
        tenant.setCreatedAt(Instant.now());

        // Generate Ed25519 keypair via KMS
        byte[] privateKey = kmsService.generateSigningKey(tenantId, "signing");
        byte[] publicKey = kmsService.getPublicKey(tenantId, "signing");

        return new TestTenant(tenantId, name, privateKey, publicKey);
    }

    public TestUser createUser(UUID tenantId, String email, String role) {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setTenantId(tenantId);
        user.setEmail(email);
        user.setRole(role);
        user.setCreatedAt(Instant.now());

        // Generate JWT token for authentication
        String jwtToken = generateJWTToken(userId, tenantId, role);

        return new TestUser(userId, tenantId, email, role, jwtToken);
    }

    // ============ SPAN FIXTURES ============

    public Span createSpan(String traceId, String spanId, String serviceName, String operationName) {
        Span span = new Span();
        span.setTraceId(traceId);
        span.setSpanId(spanId);
        span.setServiceName(serviceName);
        span.setOperationName(operationName);
        span.setStartTime(Instant.now().minusSeconds(10));
        span.setEndTime(Instant.now());
        span.setAttributes(new HashMap<>());
        return span;
    }

    public List<Span> createAuthenticationFailureTrace() {
        String traceId = UUID.randomUUID().toString().replace("-", "");

        // Client span
        Span clientSpan = createSpan(traceId, randomSpanId(), "client", "http.request");
        clientSpan.getAttributes().put("http.method", "POST");
        clientSpan.getAttributes().put("http.url", "/api/login");

        // Gateway span
        Span gatewaySpan = createSpan(traceId, randomSpanId(), "gateway", "http.server");
        gatewaySpan.setParentSpanId(clientSpan.getSpanId());
        gatewaySpan.getAttributes().put("http.status_code", 401);
        gatewaySpan.getAttributes().put("http.route", "/api/login");

        // Auth service span
        Span authSpan = createSpan(traceId, randomSpanId(), "auth-service", "authenticate");
        authSpan.setParentSpanId(gatewaySpan.getSpanId());
        authSpan.getAttributes().put("auth.failure_reason", "invalid_jwt");
        authSpan.getAttributes().put("auth.user_id", "user_123");

        return List.of(clientSpan, gatewaySpan, authSpan);
    }

    public List<Span> createPIILeakTrace() {
        String traceId = UUID.randomUUID().toString().replace("-", "");

        Span userServiceSpan = createSpan(traceId, randomSpanId(), "user-service", "get_user");
        userServiceSpan.getAttributes().put("user_id", "12345");
        userServiceSpan.getAttributes().put("user_ssn", "123-45-6789"); // PII leak!
        userServiceSpan.getAttributes().put("user_email", "john@example.com");

        return List.of(userServiceSpan);
    }

    public List<Span> createCompliantEncryptionTrace() {
        String traceId = UUID.randomUUID().toString().replace("-", "");

        // Data access span
        Span dataSpan = createSpan(traceId, randomSpanId(), "data-service", "fetch_sensitive_data");
        dataSpan.getAttributes().put("data.type", "ssn");
        dataSpan.getAttributes().put("data.encrypted", "true");

        // Compliance span proving encryption
        Span complianceSpan = createSpan(traceId, randomSpanId(), "compliance-service", "compliance_check");
        complianceSpan.setParentSpanId(dataSpan.getSpanId());
        complianceSpan.getAttributes().put("compliance.framework", "SOC2");
        complianceSpan.getAttributes().put("compliance.control", "CC6.1");
        complianceSpan.getAttributes().put("compliance.status", "PASS");
        complianceSpan.getAttributes().put("compliance.evidence.type", "encryption");

        return List.of(dataSpan, complianceSpan);
    }

    public List<Span> createPaymentProcessingTrace() {
        String traceId = UUID.randomUUID().toString().replace("-", "");

        Span apiSpan = createSpan(traceId, randomSpanId(), "api-gateway", "POST /payments");
        Span fraudSpan = createSpan(traceId, randomSpanId(), "fraud-service", "check_fraud");
        fraudSpan.setParentSpanId(apiSpan.getSpanId());
        fraudSpan.getAttributes().put("fraud.score", 0.1);
        fraudSpan.getAttributes().put("fraud.decision", "allow");

        Span paymentSpan = createSpan(traceId, randomSpanId(), "payment-service", "charge_card");
        paymentSpan.setParentSpanId(apiSpan.getSpanId());
        paymentSpan.getAttributes().put("payment.amount", "99.99");
        paymentSpan.getAttributes().put("payment.currency", "USD");
        paymentSpan.getAttributes().put("payment.status", "success");

        return List.of(apiSpan, fraudSpan, paymentSpan);
    }

    public List<Span> createAccessControlViolationTrace() {
        String traceId = UUID.randomUUID().toString().replace("-", "");

        Span requestSpan = createSpan(traceId, randomSpanId(), "api-gateway", "GET /admin/users");
        requestSpan.getAttributes().put("http.method", "GET");
        requestSpan.getAttributes().put("http.status_code", 403);

        Span authzSpan = createSpan(traceId, randomSpanId(), "authz-service", "check_permissions");
        authzSpan.setParentSpanId(requestSpan.getSpanId());
        authzSpan.getAttributes().put("authz.user_id", "user_123");
        authzSpan.getAttributes().put("authz.required_role", "admin");
        authzSpan.getAttributes().put("authz.user_role", "user");
        authzSpan.getAttributes().put("authz.decision", "deny");

        return List.of(requestSpan, authzSpan);
    }

    public List<Span> createDatabaseSlowQueryTrace() {
        String traceId = UUID.randomUUID().toString().replace("-", "");

        Span apiSpan = createSpan(traceId, randomSpanId(), "api-service", "GET /users");

        Span dbSpan = createSpan(traceId, randomSpanId(), "postgres", "SELECT * FROM users");
        dbSpan.setParentSpanId(apiSpan.getSpanId());
        dbSpan.setStartTime(Instant.now().minusSeconds(30));
        dbSpan.setEndTime(Instant.now()); // 30 second query!
        dbSpan.getAttributes().put("db.system", "postgresql");
        dbSpan.getAttributes().put("db.statement", "SELECT * FROM users WHERE created_at > ?");
        dbSpan.getAttributes().put("db.rows_returned", 1000000);

        return List.of(apiSpan, dbSpan);
    }

    // ============ RULE FIXTURES ============

    public Rule createDetectPIILeakRule(UUID tenantId) {
        String dsl = """
            DETECT "PII Leak"
            WHEN count(spans) > 0
            WHERE has(user_ssn) OR has(credit_card)
            """;

        Rule rule = new Rule();
        rule.setId(UUID.randomUUID());
        rule.setTenantId(tenantId);
        rule.setName("Detect PII Leak");
        rule.setDsl(dsl);
        rule.setSeverity("critical");
        rule.setCategory("pii");
        rule.setEnabled(true);
        rule.setCreatedAt(Instant.now());

        return rule;
    }

    public Rule createDetectAuthFailureRule(UUID tenantId) {
        String dsl = """
            DETECT "Authentication Failure Pattern"
            WHEN count(spans) > 5
            WHERE http.status_code = 401
            """;

        Rule rule = new Rule();
        rule.setId(UUID.randomUUID());
        rule.setTenantId(tenantId);
        rule.setName("Auth Failure Pattern");
        rule.setDsl(dsl);
        rule.setSeverity("high");
        rule.setCategory("authentication");
        rule.setEnabled(true);
        rule.setCreatedAt(Instant.now());

        return rule;
    }

    public Rule createDetectMissingFraudCheckRule(UUID tenantId) {
        String dsl = """
            DETECT "Payment Without Fraud Check"
            WHEN count(spans WHERE service_name = 'payment-service') > 0
              AND count(spans WHERE service_name = 'fraud-service') = 0
            """;

        Rule rule = new Rule();
        rule.setId(UUID.randomUUID());
        rule.setTenantId(tenantId);
        rule.setName("Missing Fraud Check");
        rule.setDsl(dsl);
        rule.setSeverity("critical");
        rule.setCategory("compliance");
        rule.setEnabled(true);
        rule.setCreatedAt(Instant.now());

        return rule;
    }

    // ============ SIGNAL FIXTURES ============

    public Signal createSignal(UUID tenantId, UUID ruleId, String traceId, String severity) {
        Signal signal = new Signal();
        signal.setId(UUID.randomUUID());
        signal.setTenantId(tenantId);
        signal.setRuleId(ruleId);
        signal.setRuleName("Test Rule");
        signal.setTraceId(traceId);
        signal.setSeverity(severity);
        signal.setStatus("open");
        signal.setDescription("Test signal description");
        signal.setCreatedAt(Instant.now());
        signal.setMatchedSpanCount(3);

        return signal;
    }

    public Signal createCriticalSignal(UUID tenantId, UUID ruleId) {
        String traceId = UUID.randomUUID().toString().replace("-", "");
        return createSignal(tenantId, ruleId, traceId, "critical");
    }

    public Signal createHighSignal(UUID tenantId, UUID ruleId) {
        String traceId = UUID.randomUUID().toString().replace("-", "");
        return createSignal(tenantId, ruleId, traceId, "high");
    }

    // ============ COMPLIANCE SPAN FIXTURES ============

    public Span createSOC2ComplianceSpan(String traceId, String control, String status) {
        Span span = createSpan(traceId, randomSpanId(), "compliance-service", "compliance_check");
        span.getAttributes().put("compliance.framework", "SOC2");
        span.getAttributes().put("compliance.control", control);
        span.getAttributes().put("compliance.status", status);
        span.getAttributes().put("compliance.evidence.type", "automated_check");

        return span;
    }

    public Span createHIPAAComplianceSpan(String traceId, String control, String status) {
        Span span = createSpan(traceId, randomSpanId(), "compliance-service", "hipaa_check");
        span.getAttributes().put("compliance.framework", "HIPAA");
        span.getAttributes().put("compliance.control", control);
        span.getAttributes().put("compliance.status", status);
        span.getAttributes().put("compliance.evidence.type", "phi_access_audit");

        return span;
    }

    // ============ HELPER METHODS ============

    private String randomSpanId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    private String generateJWTToken(UUID userId, UUID tenantId, String role) {
        // Simplified JWT generation for tests
        return "test.jwt." + userId.toString();
    }
}

// ============ TEST DATA CLASSES ============

class TestTenant {
    public final UUID id;
    public final String name;
    public final byte[] privateKey;
    public final byte[] publicKey;

    public TestTenant(UUID id, String name, byte[] privateKey, byte[] publicKey) {
        this.id = id;
        this.name = name;
        this.privateKey = privateKey;
        this.publicKey = publicKey;
    }
}

class TestUser {
    public final UUID id;
    public final UUID tenantId;
    public final String email;
    public final String role;
    public final String jwtToken;

    public TestUser(UUID id, UUID tenantId, String email, String role, String jwtToken) {
        this.id = id;
        this.tenantId = tenantId;
        this.email = email;
        this.role = role;
        this.jwtToken = jwtToken;
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Fixtures create TigerBeetle accounts/transfers for tenants
**ADR-013 (Camel-First):** Not applicable (test utility)
**ADR-014 (Named Processors):** Supports testing all processors
**ADR-015 (Tiered Storage):** Fixtures work with TigerBeetle, DuckDB, Parquet tests

## Fixture Scenarios

**Authentication Scenarios:**
- `createAuthenticationFailureTrace()` - 401 with invalid JWT
- `createAccessControlViolationTrace()` - 403 with insufficient permissions

**PII/Compliance Scenarios:**
- `createPIILeakTrace()` - SSN in span attributes (should trigger signal)
- `createCompliantEncryptionTrace()` - Encrypted data with compliance span (should NOT trigger signal)

**Payment/Fraud Scenarios:**
- `createPaymentProcessingTrace()` - Normal payment with fraud check
- Missing fraud check trace (for testing "Payment Without Fraud Check" rule)

**Performance Scenarios:**
- `createDatabaseSlowQueryTrace()` - 30-second query span

**Compliance Scenarios:**
- `createSOC2ComplianceSpan()` - SOC2 compliance evidence
- `createHIPAAComplianceSpan()` - HIPAA compliance evidence

## Test Requirements (QA Expert)

**Unit Tests:**
- testCreateTenant_GeneratesKeypair - tenant has Ed25519 keys
- testCreateUser_GeneratesJWT - user has valid JWT token
- testCreateAuthFailureTrace_Has401 - spans contain 401 status
- testCreatePIILeakTrace_HasSSN - spans contain user_ssn attribute
- testCreateCompliantTrace_HasComplianceSpan - trace includes compliance span
- testCreatePaymentTrace_HasFraudCheck - trace includes fraud-service span
- testCreateRule_ValidDSL - rule DSL is parseable
- testCreateSignal_HasRequiredFields - signal has all required attributes

**Integration Tests:**
- testFixtures_WorkWithRealServices - fixtures integrate with TenantService, KMSService

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Test data leakage - mitigate with ephemeral test keys (not real KMS keys)
- Test tenant pollution - mitigate with test isolation (separate test profile)
- Fixture injection - mitigate with input validation in fixture methods

**Compliance:**
- SOC2 CC8.1 (Change Management) - test fixtures enable comprehensive testing

## Success Criteria

- [ ] Generate realistic test tenants with Ed25519 keypairs
- [ ] Generate realistic test users with JWT tokens
- [ ] Generate 6+ trace scenarios (auth failure, PII leak, payment, etc.)
- [ ] Generate 3+ rule scenarios (PII detection, auth failure, fraud check)
- [ ] Generate signal fixtures with various severities
- [ ] Generate compliance spans (SOC2, HIPAA, GDPR)
- [ ] All fixtures reusable across unit/integration tests
- [ ] All tests pass with 90% coverage
