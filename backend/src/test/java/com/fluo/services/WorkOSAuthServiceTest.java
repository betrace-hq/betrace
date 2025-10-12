package com.fluo.services;

import com.fluo.exceptions.AuthenticationException;
import com.fluo.exceptions.RateLimitException;
import com.fluo.model.AuthenticatedUser;
import com.fluo.models.RateLimitResult;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for WorkOSAuthService.
 *
 * Note: WorkOS SDK uses Kotlin final classes that cannot be mocked by Mockito.
 * These tests mock the JwtValidatorService layer instead of WorkOS SDK directly.
 * Full integration tests with real WorkOS are in WorkOSAuthServiceIntegrationTest.
 *
 * Coverage:
 * - Token validation input validation (null, empty, blank)
 * - Token validation delegation to JwtValidatorService
 * - OAuth URL generation (real WorkOS SDK calls)
 * - OAuth URL parameter validation
 */
@QuarkusTest
class WorkOSAuthServiceTest {

    @Inject
    WorkOSAuthService authService;

    @InjectMock
    JwtValidatorService jwtValidator;

    @InjectMock
    RateLimiter rateLimiter;

    // ============================================================
    // validateToken() tests
    // ============================================================

    @Test
    @DisplayName("Null token throws AuthenticationException")
    void testValidateNullToken() {
        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken(null);
        });

        assertEquals("Token is null or empty", ex.getMessage());
        verifyNoInteractions(jwtValidator);
        verifyNoInteractions(rateLimiter); // Rate limit not checked for null input
    }

    @Test
    @DisplayName("Empty token throws AuthenticationException")
    void testValidateEmptyToken() {
        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken("");
        });

        assertEquals("Token is null or empty", ex.getMessage());
        verifyNoInteractions(jwtValidator);
        verifyNoInteractions(rateLimiter); // Rate limit not checked for empty input
    }

    @Test
    @DisplayName("Blank token throws AuthenticationException")
    void testValidateBlankToken() {
        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken("   ");
        });

        assertEquals("Token is null or empty", ex.getMessage());
        verifyNoInteractions(jwtValidator);
        verifyNoInteractions(rateLimiter); // Rate limit not checked for blank input
    }

    @Test
    @DisplayName("Valid token delegates to JwtValidatorService")
    void testValidateValidToken() throws Exception {
        String token = "valid.jwt.token";
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AuthenticatedUser expectedUser = new AuthenticatedUser(
            userId,
            "user@example.com",
            tenantId,
            List.of("admin")
        );

        // Mock rate limiter to allow request
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));
        when(jwtValidator.validateToken(token)).thenReturn(expectedUser);

        AuthenticatedUser result = authService.validateToken(token);

        assertNotNull(result);
        assertEquals(expectedUser, result);
        verify(rateLimiter).checkAnonymousLimit();
        verify(jwtValidator).validateToken(token);
    }

    @Test
    @DisplayName("JWT validation error propagates AuthenticationException")
    void testValidateTokenJwtError() throws Exception {
        String token = "invalid.jwt.token";

        // Mock rate limiter to allow request (but JWT validation will fail)
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));
        when(jwtValidator.validateToken(token))
            .thenThrow(new AuthenticationException("Invalid token signature"));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken(token);
        });

        assertEquals("Invalid token signature", ex.getMessage());
        verify(rateLimiter).checkAnonymousLimit();
        verify(jwtValidator).validateToken(token);
    }

    @Test
    @DisplayName("Rate limit exceeded throws RateLimitException")
    void testValidateTokenRateLimitExceeded() {
        String token = "valid.jwt.token";

        // Mock rate limiter to reject request
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(false, 60));

        RateLimitException ex = assertThrows(RateLimitException.class, () -> {
            authService.validateToken(token);
        });

        assertTrue(ex.getMessage().contains("Too many authentication attempts"));
        verify(rateLimiter).checkAnonymousLimit();
        verifyNoInteractions(jwtValidator); // Should not validate if rate limited
    }

    @Test
    @DisplayName("Rate limit allows request when under limit")
    void testValidateTokenRateLimitAllowed() throws Exception {
        String token = "valid.jwt.token";
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AuthenticatedUser expectedUser = new AuthenticatedUser(
            userId,
            "user@example.com",
            tenantId,
            List.of("admin")
        );

        // Mock rate limiter to allow request
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));
        when(jwtValidator.validateToken(token)).thenReturn(expectedUser);

        AuthenticatedUser result = authService.validateToken(token);

        assertNotNull(result);
        assertEquals(expectedUser, result);
        verify(rateLimiter).checkAnonymousLimit();
        verify(jwtValidator).validateToken(token);
    }

    @Test
    @DisplayName("Token with invalid signature throws AuthenticationException")
    void testValidateTokenInvalidSignature() throws Exception {
        String token = "valid.format.but.invalid.signature";

        // Mock rate limiter to allow request
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));
        // JWT validator rejects due to signature verification failure
        when(jwtValidator.validateToken(token))
            .thenThrow(new AuthenticationException("Invalid JWT signature"));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken(token);
        });

        assertEquals("Invalid JWT signature", ex.getMessage());
        verify(rateLimiter).checkAnonymousLimit();
        verify(jwtValidator).validateToken(token);
    }

    @Test
    @DisplayName("Expired token throws AuthenticationException")
    void testValidateTokenExpired() throws Exception {
        String token = "valid.signature.but.expired";

        // Mock rate limiter to allow request
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));
        // JWT validator rejects due to expiration
        when(jwtValidator.validateToken(token))
            .thenThrow(new AuthenticationException("Token expired"));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken(token);
        });

        assertEquals("Token expired", ex.getMessage());
        verify(rateLimiter).checkAnonymousLimit();
        verify(jwtValidator).validateToken(token);
    }

    @Test
    @DisplayName("Token missing required claims throws AuthenticationException")
    void testValidateTokenMissingRequiredClaims() throws Exception {
        String token = "valid.signature.missing.claims";

        // Mock rate limiter to allow request
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));
        // JWT validator rejects due to missing required claims
        when(jwtValidator.validateToken(token))
            .thenThrow(new AuthenticationException("Missing required claim: org_id"));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.validateToken(token);
        });

        assertEquals("Missing required claim: org_id", ex.getMessage());
        verify(rateLimiter).checkAnonymousLimit();
        verify(jwtValidator).validateToken(token);
    }

    // ============================================================
    // getAuthorizationUrl() tests
    // ============================================================

    @Test
    @DisplayName("Null state throws AuthenticationException")
    void testGetAuthorizationUrlNullState() {
        String redirectUri = "http://localhost:8080/api/auth/callback";

        // Mock rate limiter to allow request
        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.getAuthorizationUrl(null, redirectUri);
        });

        assertEquals("State parameter is required for CSRF protection", ex.getMessage());
    }

    @Test
    @DisplayName("Empty state throws AuthenticationException")
    void testGetAuthorizationUrlEmptyState() {
        String redirectUri = "http://localhost:8080/api/auth/callback";

        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.getAuthorizationUrl("", redirectUri);
        });

        assertEquals("State parameter is required for CSRF protection", ex.getMessage());
    }

    @Test
    @DisplayName("Blank state throws AuthenticationException")
    void testGetAuthorizationUrlBlankState() {
        String redirectUri = "http://localhost:8080/api/auth/callback";

        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.getAuthorizationUrl("   ", redirectUri);
        });

        assertEquals("State parameter is required for CSRF protection", ex.getMessage());
    }

    @Test
    @DisplayName("Null redirect URI throws AuthenticationException")
    void testGetAuthorizationUrlNullRedirectUri() {
        String state = "csrf-state-123";

        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.getAuthorizationUrl(state, null);
        });

        assertEquals("Redirect URI is required", ex.getMessage());
    }

    @Test
    @DisplayName("Empty redirect URI throws AuthenticationException")
    void testGetAuthorizationUrlEmptyRedirectUri() {
        String state = "csrf-state-123";

        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.getAuthorizationUrl(state, "");
        });

        assertEquals("Redirect URI is required", ex.getMessage());
    }

    @Test
    @DisplayName("Unauthorized redirect URI throws AuthenticationException")
    void testGetAuthorizationUrlUnauthorizedRedirectUri() {
        String state = "csrf-state-123";
        String evilRedirectUri = "https://attacker.com/callback";

        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.getAuthorizationUrl(state, evilRedirectUri);
        });

        assertEquals("Redirect URI not in allowlist", ex.getMessage());
    }

    @Test
    @DisplayName("Whitelisted redirect URI is accepted")
    void testGetAuthorizationUrlWhitelistedRedirectUri() throws Exception {
        String state = "csrf-state-123";
        // This URI is in the default whitelist
        String allowedRedirectUri = "http://localhost:8080/api/auth/callback";

        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        String authUrl = authService.getAuthorizationUrl(state, allowedRedirectUri);

        assertNotNull(authUrl);
        assertTrue(authUrl.contains("api.workos.com"));
    }

    @Test
    @DisplayName("Malicious redirect URI with path traversal rejected")
    void testGetAuthorizationUrlPathTraversal() {
        String state = "csrf-state-123";
        String maliciousUri = "http://localhost:8080/../../../etc/passwd";

        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.getAuthorizationUrl(state, maliciousUri);
        });

        assertEquals("Redirect URI not in allowlist", ex.getMessage());
    }

    @Test
    @DisplayName("Malicious redirect URI with javascript protocol rejected")
    void testGetAuthorizationUrlJavascriptProtocol() {
        String state = "csrf-state-123";
        String maliciousUri = "javascript:alert(1)";

        when(rateLimiter.checkAnonymousLimit())
            .thenReturn(new RateLimitResult(true, 0, 9));

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.getAuthorizationUrl(state, maliciousUri);
        });

        assertEquals("Redirect URI not in allowlist", ex.getMessage());
    }

    // ============================================================
    // authenticateWithCode() tests
    // ============================================================

    @Test
    @DisplayName("Null code throws AuthenticationException")
    void testAuthenticateWithNullCode() {
        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.authenticateWithCode(null);
        });

        assertEquals("Authorization code is required", ex.getMessage());
    }

    @Test
    @DisplayName("Empty code throws AuthenticationException")
    void testAuthenticateWithEmptyCode() {
        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            authService.authenticateWithCode("");
        });

        assertEquals("Authorization code is required", ex.getMessage());
    }

    // Note: Testing authenticateWithCode() with a real code requires
    // integration testing with WorkOS sandbox. See WorkOSAuthServiceIntegrationTest.
}
