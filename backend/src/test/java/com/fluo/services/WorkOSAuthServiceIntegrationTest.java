package com.fluo.services;

import com.fluo.exceptions.AuthenticationException;
import com.fluo.model.AuthenticatedUser;
import com.fluo.models.RateLimitResult;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Integration tests for WorkOSAuthService with real WorkOS sandbox.
 *
 * These tests are split into two categories:
 * 1. Tests that run with test credentials (service initialization, error handling)
 * 2. Tests that require live WorkOS credentials (OAuth flows, real token validation)
 *
 * To run tests with live credentials:
 * 1. Set WORKOS_CLIENT_ID and WORKOS_API_KEY environment variables
 * 2. For real token validation: set WORKOS_TEST_TOKEN
 * 3. For OAuth code exchange: set WORKOS_TEST_CODE
 * 4. Run: mvn test -Dtest=WorkOSAuthServiceIntegrationTest
 *
 * Note: Tests requiring live credentials are gated behind @EnabledIfEnvironmentVariable
 */
@QuarkusTest
class WorkOSAuthServiceIntegrationTest {

    @Inject
    WorkOSAuthService authService;

    @Inject
    JwksService jwksService;

    @InjectMock
    RateLimiter rateLimiter;

    @BeforeEach
    void setup() {
        // Mock rate limiter to allow all requests in integration tests
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 10));
    }

    // ============================================================
    // Tests that run with test credentials (no live WorkOS required)
    // ============================================================

    @Test
    @DisplayName("Service initializes with test credentials")
    void testServiceInitializes() {
        assertNotNull(authService);
        assertNotNull(jwksService);
    }

    @Test
    @DisplayName("Generate OAuth authorization URL with test credentials")
    void testGenerateAuthorizationUrl() throws Exception {
        String state = "test-state-" + System.currentTimeMillis();
        String redirectUri = "http://localhost:8080/api/auth/callback";

        String authUrl = authService.getAuthorizationUrl(state, redirectUri);

        assertNotNull(authUrl);
        assertTrue(authUrl.contains("api.workos.com"));
        assertTrue(authUrl.contains("client_id"));
        assertTrue(authUrl.contains("redirect_uri"));
        assertTrue(authUrl.contains("state=" + state));
    }

    @Test
    @DisplayName("Invalid token throws AuthenticationException")
    void testInvalidTokenFails() {
        String invalidToken = "invalid.jwt.token";

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken(invalidToken);
        });

        assertNotNull(ex.getMessage());
    }

    @Test
    @DisplayName("Expired or malformed token throws AuthenticationException")
    void testExpiredTokenFails() {
        // This is a malformed JWT (not properly formatted)
        String malformedToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken(malformedToken);
        });

        assertNotNull(ex.getMessage());
    }

    // ============================================================
    // Tests that require live WorkOS credentials
    // ============================================================

    @Test
    @DisplayName("JWKS fetches successfully from live WorkOS")
    @EnabledIfEnvironmentVariable(named = "WORKOS_CLIENT_ID", matches = "^client_.*")
    void testJwksFetchWithLiveCredentials() throws Exception {
        // Wait for JWKS to load from real WorkOS
        Thread.sleep(2000);

        // Should have valid JWK source
        assertNotNull(jwksService.getJwkSource());
        assertDoesNotThrow(() -> jwksService.getJwkSource());

        System.out.println("✅ JWKS fetched successfully from live WorkOS");
    }

    @Test
    @DisplayName("Validate real JWT token from live WorkOS")
    @EnabledIfEnvironmentVariable(named = "WORKOS_TEST_TOKEN", matches = ".*")
    void testValidateRealToken() throws Exception {
        // Get token from environment (set this after OAuth flow)
        String token = System.getenv("WORKOS_TEST_TOKEN");

        AuthenticatedUser user = authService.validateToken(token);

        assertNotNull(user);
        assertNotNull(user.userId());
        assertNotNull(user.email());
        assertNotNull(user.tenantId());
        assertNotNull(user.roles());
        assertFalse(user.roles().isEmpty());

        System.out.println("✅ Token validated successfully:");
        System.out.println("   User ID: " + user.userId());
        System.out.println("   Email: " + user.email());
        System.out.println("   Tenant: " + user.tenantId());
        System.out.println("   Roles: " + user.roles());
    }

    @Test
    @DisplayName("Exchange OAuth code for user session with live WorkOS")
    @EnabledIfEnvironmentVariable(named = "WORKOS_TEST_CODE", matches = ".*")
    void testAuthenticateWithRealCode() throws Exception {
        // Get code from environment (set this after OAuth flow)
        String code = System.getenv("WORKOS_TEST_CODE");

        AuthenticatedUser user = authService.authenticateWithCode(code);

        assertNotNull(user);
        assertNotNull(user.userId());
        assertNotNull(user.email());
        assertNotNull(user.tenantId());
        assertNotNull(user.roles());

        System.out.println("✅ OAuth code exchanged successfully:");
        System.out.println("   User ID: " + user.userId());
        System.out.println("   Email: " + user.email());
        System.out.println("   Tenant: " + user.tenantId());
        System.out.println("   Roles: " + user.roles());
    }
}
