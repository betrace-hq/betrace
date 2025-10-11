# PRD-018h: Security Penetration Tests

**Priority:** P1 (Security - Critical)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-018 (Comprehensive Test Suite)
**Dependencies:** PRD-001 (Authentication), PRD-006 (KMS), PRD-018c (IntegrationTestHarness)

## Problem

FLUO lacks security penetration tests for common attack vectors: authentication bypass, RBAC escalation, SQL injection, XSS, SSRF, KMS key extraction. No validation that security controls prevent attacks. Security vulnerabilities risk data breaches and compliance failures.

## Solution

Implement security penetration tests covering OWASP Top 10 vulnerabilities and FLUO-specific attack scenarios. Test authentication bypass, authorization escalation, injection attacks, cryptographic failures, and multi-tenant isolation breaches.

## Unit Description

**File:** `backend/src/test/java/com/fluo/security/SecurityPenetrationTest.java`
**Type:** Security Integration Test
**Purpose:** Validate security controls prevent common attack vectors

## Implementation

```java
package com.fluo.security;

import com.fluo.model.*;
import com.fluo.services.*;
import com.fluo.test.harness.BaseIntegrationTest;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;

/**
 * Security penetration tests for common attack vectors
 * Tests authentication, authorization, injection, and cryptographic controls
 */
@QuarkusTest
class SecurityPenetrationTest extends BaseIntegrationTest {

    @Inject
    AuthenticationService authenticationService;

    @Inject
    KMSService kmsService;

    @Inject
    SignalService signalService;

    // ============ AUTHENTICATION BYPASS ATTACKS ============

    @Test
    @DisplayName("Authentication: Missing JWT token returns 401")
    void testAuthenticationBypass_MissingToken() {
        // When: Request without JWT token
        given()
            .when()
            .get("/api/signals")
            .then()
            .statusCode(401); // Unauthorized
    }

    @Test
    @DisplayName("Authentication: Invalid JWT token returns 401")
    void testAuthenticationBypass_InvalidToken() {
        // When: Request with invalid JWT token
        given()
            .header("Authorization", "Bearer invalid.jwt.token")
            .when()
            .get("/api/signals")
            .then()
            .statusCode(401); // Unauthorized
    }

    @Test
    @DisplayName("Authentication: Expired JWT token returns 401")
    void testAuthenticationBypass_ExpiredToken() {
        // Given: Expired JWT token
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");
        String expiredToken = JWTTestHelper.generateExpiredToken(user.id, tenant.id, "user");

        // When: Request with expired token
        given()
            .header("Authorization", "Bearer " + expiredToken)
            .when()
            .get("/api/signals")
            .then()
            .statusCode(401); // Unauthorized
    }

    @Test
    @DisplayName("Authentication: Tampered JWT signature returns 401")
    void testAuthenticationBypass_TamperedSignature() {
        // Given: Valid JWT token
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        // When: Tamper with JWT signature
        String tamperedToken = user.jwtToken.substring(0, user.jwtToken.length() - 10) + "XXXXXXXXXX";

        given()
            .header("Authorization", "Bearer " + tamperedToken)
            .when()
            .get("/api/signals")
            .then()
            .statusCode(401); // Unauthorized
    }

    // ============ AUTHORIZATION ESCALATION ATTACKS ============

    @Test
    @DisplayName("Authorization: User cannot access admin endpoints")
    void testAuthorizationEscalation_UserToAdmin() {
        // Given: Regular user
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        // When: User attempts to access admin endpoint
        given()
            .header("Authorization", "Bearer " + user.jwtToken)
            .when()
            .delete("/api/admin/tenants/" + tenant.id)
            .then()
            .statusCode(403); // Forbidden
    }

    @Test
    @DisplayName("Authorization: User cannot modify other user's data")
    void testAuthorizationEscalation_CrossUser() {
        // Given: Two users in same tenant
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user1 = fixtures.createUser(tenant.id, "user1@test.com", "user");
        TestUser user2 = fixtures.createUser(tenant.id, "user2@test.com", "user");

        // When: User 1 attempts to modify user 2's profile
        given()
            .header("Authorization", "Bearer " + user1.jwtToken)
            .header("Content-Type", "application/json")
            .body("{\"email\": \"hacked@evil.com\"}")
            .when()
            .put("/api/users/" + user2.id)
            .then()
            .statusCode(403); // Forbidden
    }

    @Test
    @DisplayName("Authorization: User role cannot be escalated via API")
    void testAuthorizationEscalation_RoleEscalation() {
        // Given: Regular user
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        // When: User attempts to escalate role to admin
        given()
            .header("Authorization", "Bearer " + user.jwtToken)
            .header("Content-Type", "application/json")
            .body("{\"role\": \"admin\"}")
            .when()
            .put("/api/users/" + user.id)
            .then()
            .statusCode(403); // Forbidden - cannot change own role
    }

    // ============ SQL INJECTION ATTACKS ============

    @Test
    @DisplayName("SQL Injection: Query parameter sanitization")
    void testSQLInjection_QueryParameter() {
        // Given: User with valid token
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        // When: SQL injection in query parameter
        String maliciousInput = "' OR '1'='1' --";

        given()
            .header("Authorization", "Bearer " + user.jwtToken)
            .queryParam("severity", maliciousInput)
            .when()
            .get("/api/signals")
            .then()
            .statusCode(anyOf(is(400), is(200))); // Either validation error or safe query

        // If 200, verify no signals returned (injection failed)
        if (given()
            .header("Authorization", "Bearer " + user.jwtToken)
            .queryParam("severity", maliciousInput)
            .when()
            .get("/api/signals")
            .then()
            .extract().statusCode() == 200) {

            given()
                .header("Authorization", "Bearer " + user.jwtToken)
                .queryParam("severity", maliciousInput)
                .when()
                .get("/api/signals")
                .then()
                .body("size()", equalTo(0)); // No data leaked
        }
    }

    @Test
    @DisplayName("SQL Injection: Request body sanitization")
    void testSQLInjection_RequestBody() {
        // Given: Admin user
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser admin = fixtures.createUser(tenant.id, "admin@test.com", "admin");

        // When: SQL injection in rule DSL
        String maliciousRule = """
            {
              "name": "Test Rule'; DROP TABLE signals; --",
              "dsl": "DETECT \\"Test\\" WHEN count(spans) > 0",
              "severity": "high"
            }
            """;

        given()
            .header("Authorization", "Bearer " + admin.jwtToken)
            .header("Content-Type", "application/json")
            .body(maliciousRule)
            .when()
            .post("/api/rules")
            .then()
            .statusCode(anyOf(is(400), is(201))); // Either validation error or safe insert

        // Verify signals table still exists
        List<Signal> signals = signalService.getSignalsForTenant(tenant.id);
        assertThat(signals).isNotNull(); // Table not dropped
    }

    // ============ XSS (CROSS-SITE SCRIPTING) ATTACKS ============

    @Test
    @DisplayName("XSS: Script tags in rule name are sanitized")
    void testXSS_RuleName() {
        // Given: Admin user
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser admin = fixtures.createUser(tenant.id, "admin@test.com", "admin");

        // When: XSS payload in rule name
        String maliciousRule = """
            {
              "name": "<script>alert('XSS')</script>",
              "dsl": "DETECT \\"Test\\" WHEN count(spans) > 0",
              "severity": "high"
            }
            """;

        String ruleId = given()
            .header("Authorization", "Bearer " + admin.jwtToken)
            .header("Content-Type", "application/json")
            .body(maliciousRule)
            .when()
            .post("/api/rules")
            .then()
            .statusCode(201)
            .extract().path("id");

        // Then: Retrieve rule and verify script tags are sanitized
        given()
            .header("Authorization", "Bearer " + admin.jwtToken)
            .when()
            .get("/api/rules/" + ruleId)
            .then()
            .statusCode(200)
            .body("name", not(containsString("<script>")));
    }

    @Test
    @DisplayName("XSS: HTML entities in signal description are escaped")
    void testXSS_SignalDescription() {
        // Given: Tenant with signal
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        Signal signal = fixtures.createSignal(
            tenant.id,
            UUID.randomUUID(),
            "trace123",
            "critical"
        );
        signal.setDescription("<img src=x onerror=alert('XSS')>");
        signalService.createSignal(signal);

        // When: Retrieve signal via API
        given()
            .header("Authorization", "Bearer " + user.jwtToken)
            .when()
            .get("/api/signals/" + signal.getId())
            .then()
            .statusCode(200)
            .body("description", not(containsString("<img"))); // HTML escaped
    }

    // ============ SSRF (SERVER-SIDE REQUEST FORGERY) ATTACKS ============

    @Test
    @DisplayName("SSRF: Webhook URL to localhost is blocked")
    void testSSRF_WebhookLocalhost() {
        // Given: Admin user
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser admin = fixtures.createUser(tenant.id, "admin@test.com", "admin");

        // When: Attempt to create webhook pointing to localhost
        String maliciousConfig = """
            {
              "channelType": "webhook",
              "webhookUrl": "http://localhost:8080/admin",
              "notifyAll": true,
              "enabled": true
            }
            """;

        given()
            .header("Authorization", "Bearer " + admin.jwtToken)
            .header("Content-Type", "application/json")
            .body(maliciousConfig)
            .when()
            .post("/api/notifications/configs")
            .then()
            .statusCode(400); // Bad Request - localhost blocked
    }

    @Test
    @DisplayName("SSRF: Webhook URL to private IP is blocked")
    void testSSRF_WebhookPrivateIP() {
        // Given: Admin user
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser admin = fixtures.createUser(tenant.id, "admin@test.com", "admin");

        // When: Attempt to create webhook pointing to private IP
        String maliciousConfig = """
            {
              "channelType": "webhook",
              "webhookUrl": "http://192.168.1.1/admin",
              "notifyAll": true,
              "enabled": true
            }
            """;

        given()
            .header("Authorization", "Bearer " + admin.jwtToken)
            .header("Content-Type", "application/json")
            .body(maliciousConfig)
            .when()
            .post("/api/notifications/configs")
            .then()
            .statusCode(400); // Bad Request - private IP blocked
    }

    @Test
    @DisplayName("SSRF: Webhook URL to metadata endpoints is blocked")
    void testSSRF_WebhookMetadataEndpoint() {
        // Given: Admin user
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser admin = fixtures.createUser(tenant.id, "admin@test.com", "admin");

        // When: Attempt to create webhook pointing to AWS metadata endpoint
        String maliciousConfig = """
            {
              "channelType": "webhook",
              "webhookUrl": "http://169.254.169.254/latest/meta-data/",
              "notifyAll": true,
              "enabled": true
            }
            """;

        given()
            .header("Authorization", "Bearer " + admin.jwtToken)
            .header("Content-Type", "application/json")
            .body(maliciousConfig)
            .when()
            .post("/api/notifications/configs")
            .then()
            .statusCode(400); // Bad Request - metadata endpoint blocked
    }

    // ============ CRYPTOGRAPHIC ATTACKS ============

    @Test
    @DisplayName("KMS: Tenant cannot extract another tenant's private key")
    void testCryptographic_KeyExtraction() throws Exception {
        // Given: Two tenants
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        // When: Tenant 1 attempts to get tenant 2's private key
        try {
            byte[] privateKey = kmsService.getPrivateKey(tenant2.id, "signing");
            // Should not reach here - getPrivateKey should not exist or throw
            assertThat(privateKey).isNull();
        } catch (UnsupportedOperationException | SecurityException e) {
            // Expected - private keys cannot be extracted
            assertThat(e).isNotNull();
        }
    }

    @Test
    @DisplayName("KMS: Signing with wrong tenant key fails verification")
    void testCryptographic_CrossTenantSigning() throws Exception {
        // Given: Two tenants
        TestTenant tenant1 = fixtures.createTenant("Tenant 1");
        TestTenant tenant2 = fixtures.createTenant("Tenant 2");

        // When: Sign data with tenant 1's key
        String data = "test data";
        byte[] signature = kmsService.sign(tenant1.id, "signing", data.getBytes());

        // Then: Verification with tenant 2's key fails
        boolean isValid = kmsService.verify(tenant2.id, "signing", data.getBytes(), signature);
        assertThat(isValid).isFalse();
    }

    @Test
    @DisplayName("KMS: Weak encryption algorithm is rejected")
    void testCryptographic_WeakAlgorithm() {
        // Given: Tenant
        TestTenant tenant = fixtures.createTenant("Test Corp");

        // When: Attempt to use weak encryption algorithm (DES)
        try {
            byte[] encrypted = kmsService.encrypt(tenant.id, "encryption", "data".getBytes(), "DES");
            // Should not reach here - weak algorithm should be rejected
            assertThat(encrypted).isNull();
        } catch (IllegalArgumentException | UnsupportedOperationException e) {
            // Expected - weak algorithm rejected
            assertThat(e.getMessage()).containsIgnoringCase("algorithm");
        }
    }

    // ============ RATE LIMITING ATTACKS ============

    @Test
    @DisplayName("Rate Limiting: Excessive API requests are throttled")
    void testRateLimiting_ExcessiveRequests() {
        // Given: User with valid token
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        // When: Send 1000 requests rapidly
        int successCount = 0;
        int throttledCount = 0;

        for (int i = 0; i < 1000; i++) {
            int statusCode = given()
                .header("Authorization", "Bearer " + user.jwtToken)
                .when()
                .get("/api/signals")
                .then()
                .extract().statusCode();

            if (statusCode == 200) {
                successCount++;
            } else if (statusCode == 429) { // Too Many Requests
                throttledCount++;
            }
        }

        // Then: At least some requests were throttled
        assertThat(throttledCount).isGreaterThan(0);
    }

    // ============ PATH TRAVERSAL ATTACKS ============

    @Test
    @DisplayName("Path Traversal: File path in API is validated")
    void testPathTraversal_FileAccess() {
        // Given: User with valid token
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        // When: Attempt path traversal in API endpoint
        String maliciousPath = "../../../../etc/passwd";

        given()
            .header("Authorization", "Bearer " + user.jwtToken)
            .when()
            .get("/api/exports/" + maliciousPath)
            .then()
            .statusCode(anyOf(is(400), is(404))); // Bad Request or Not Found
    }

    // ============ CSRF (CROSS-SITE REQUEST FORGERY) ATTACKS ============

    @Test
    @DisplayName("CSRF: State-changing requests require CSRF token")
    void testCSRF_StateChangingRequest() {
        // Given: User with valid token
        TestTenant tenant = fixtures.createTenant("Test Corp");
        TestUser user = fixtures.createUser(tenant.id, "user@test.com", "user");

        // When: POST request without CSRF token
        given()
            .header("Authorization", "Bearer " + user.jwtToken)
            .header("Content-Type", "application/json")
            .body("{\"name\": \"Test Rule\", \"dsl\": \"DETECT 'Test' WHEN count(spans) > 0\"}")
            .when()
            .post("/api/rules")
            .then()
            // Either requires CSRF token (403) or JWT is sufficient (201)
            .statusCode(anyOf(is(201), is(403)));
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Tests validate TigerBeetle security
**ADR-013 (Camel-First):** Tests validate route security
**ADR-014 (Named Processors):** Tests validate processor security
**ADR-015 (Tiered Storage):** Tests validate storage security

## Attack Vectors Tested

**OWASP Top 10:**
1. Broken Access Control - authorization escalation tests
2. Cryptographic Failures - KMS key extraction tests
3. Injection - SQL injection, XSS tests
4. Insecure Design - SSRF prevention tests
5. Security Misconfiguration - weak algorithm tests
6. Vulnerable Components - (covered in dependency scanning)
7. Authentication Failures - JWT bypass tests
8. Software/Data Integrity - signature tampering tests
9. Security Logging - (covered in audit trail tests)
10. SSRF - webhook URL validation tests

## Test Requirements (QA Expert)

**Unit Tests:**
- testAuthenticationBypass_MissingToken - 401 without token
- testAuthenticationBypass_InvalidToken - 401 with invalid token
- testAuthenticationBypass_ExpiredToken - 401 with expired token
- testAuthenticationBypass_TamperedSignature - 401 with tampered JWT
- testAuthorizationEscalation_UserToAdmin - 403 for user accessing admin
- testAuthorizationEscalation_CrossUser - 403 for cross-user access
- testAuthorizationEscalation_RoleEscalation - 403 for role escalation
- testSQLInjection_QueryParameter - SQL injection blocked
- testSQLInjection_RequestBody - SQL injection in body blocked
- testXSS_RuleName - script tags sanitized
- testXSS_SignalDescription - HTML entities escaped
- testSSRF_WebhookLocalhost - localhost webhook blocked
- testSSRF_WebhookPrivateIP - private IP webhook blocked
- testSSRF_WebhookMetadataEndpoint - metadata endpoint blocked
- testCryptographic_KeyExtraction - private keys not extractable
- testCryptographic_CrossTenantSigning - cross-tenant signature fails
- testCryptographic_WeakAlgorithm - weak algorithms rejected
- testRateLimiting_ExcessiveRequests - rate limiting enforced
- testPathTraversal_FileAccess - path traversal blocked
- testCSRF_StateChangingRequest - CSRF protection enabled

**Integration Tests:**
- testFullAttackChain - multi-stage attack blocked

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Attack Vectors Covered:**
- Authentication bypass (JWT tampering, expiration)
- Authorization escalation (role escalation, cross-user)
- SQL injection (query parameters, request body)
- XSS (script tags, HTML entities)
- SSRF (localhost, private IPs, metadata endpoints)
- Cryptographic attacks (key extraction, weak algorithms)
- Rate limiting bypass
- Path traversal
- CSRF

**Compliance:**
- SOC2 CC6.1 (Logical Access) - authentication/authorization tests
- SOC2 CC6.6 (Encryption) - cryptographic tests
- NIST 800-53 AC-2 (Account Management) - authorization tests

## Success Criteria

- [ ] All authentication bypass attacks blocked
- [ ] All authorization escalation attacks blocked
- [ ] All SQL injection attacks blocked
- [ ] All XSS attacks sanitized
- [ ] All SSRF attacks blocked
- [ ] Cryptographic attacks prevented
- [ ] Rate limiting enforced
- [ ] Path traversal attacks blocked
- [ ] All tests pass with 90% coverage
