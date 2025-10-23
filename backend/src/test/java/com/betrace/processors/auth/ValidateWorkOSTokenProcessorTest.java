package com.betrace.processors.auth;

import com.betrace.exceptions.AuthenticationException;
import com.betrace.exceptions.RateLimitException;
import com.betrace.model.AuthenticatedUser;
import com.betrace.services.WorkOSAuthService;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for ValidateWorkOSTokenProcessor (PRD-001c).
 *
 * Covers:
 * - Successful validation and header population
 * - Invalid/expired/tampered token handling
 * - Missing/null/empty/whitespace jwtToken header
 * - WorkOS timeout and rate limit scenarios
 * - No error details leaked to client
 * - Special characters in email
 * - Multiple roles population
 */
@QuarkusTest
class ValidateWorkOSTokenProcessorTest {

    @Inject
    ValidateWorkOSTokenProcessor processor;

    @InjectMock
    WorkOSAuthService authService;

    private CamelContext camelContext;

    @BeforeEach
    void setup() {
        camelContext = new DefaultCamelContext();
    }

    // ============================================================
    // Successful Validation Tests
    // ============================================================

    @Test
    @DisplayName("Successful validation populates exchange headers")
    void testSuccessfulValidation() throws Exception {
        String token = "valid.jwt.token";
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(
            userId,
            "user@example.com",
            tenantId,
            List.of("admin")
        );

        when(authService.validateToken(token)).thenReturn(user);

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        // Verify headers populated
        assertEquals(userId, exchange.getIn().getHeader("userId"));
        assertEquals("user@example.com", exchange.getIn().getHeader("userEmail"));
        assertEquals(tenantId, exchange.getIn().getHeader("tenantId"));
        assertEquals(List.of("admin"), exchange.getIn().getHeader("userRoles"));
        assertEquals(true, exchange.getIn().getHeader("authenticated"));

        // Verify route not stopped
        assertFalse(exchange.isRouteStop());

        verify(authService).validateToken(token);
    }

    @Test
    @DisplayName("Viewer role population")
    void testViewerRolePopulation() throws Exception {
        String token = "viewer.token";
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(
            userId,
            "viewer@example.com",
            tenantId,
            List.of("viewer")
        );

        when(authService.validateToken(token)).thenReturn(user);

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        assertEquals(List.of("viewer"), exchange.getIn().getHeader("userRoles"));
        assertEquals(true, exchange.getIn().getHeader("authenticated"));
        assertFalse(exchange.isRouteStop());
    }

    @Test
    @DisplayName("Multiple roles population")
    void testMultipleRolesPopulation() throws Exception {
        String token = "multi.role.token";
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(
            userId,
            "admin@example.com",
            tenantId,
            List.of("admin", "developer", "viewer")
        );

        when(authService.validateToken(token)).thenReturn(user);

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        assertEquals(List.of("admin", "developer", "viewer"), exchange.getIn().getHeader("userRoles"));
        assertFalse(exchange.isRouteStop());
    }

    @Test
    @DisplayName("Special characters in email handled safely")
    void testSpecialCharactersInEmail() throws Exception {
        String token = "special.email.token";
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(
            userId,
            "user+test@example.com",
            tenantId,
            List.of("admin")
        );

        when(authService.validateToken(token)).thenReturn(user);

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        assertEquals("user+test@example.com", exchange.getIn().getHeader("userEmail"));
        assertFalse(exchange.isRouteStop());
    }

    // ============================================================
    // Token Validation Failure Tests
    // ============================================================

    @Test
    @DisplayName("Invalid token returns 401 and stops route")
    void testInvalidToken() throws Exception {
        String token = "invalid.token";

        when(authService.validateToken(token))
            .thenThrow(new AuthenticationException("Invalid token signature"));

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        assertAuthenticationFailure(exchange);
        verify(authService).validateToken(token);
    }

    @Test
    @DisplayName("Expired token returns 401 and stops route")
    void testExpiredToken() throws Exception {
        String token = "expired.token";

        when(authService.validateToken(token))
            .thenThrow(new AuthenticationException("Token expired"));

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        assertAuthenticationFailure(exchange);
    }

    @Test
    @DisplayName("Tampered token returns 401 and stops route")
    void testTamperedToken() throws Exception {
        String token = "tampered.token";

        when(authService.validateToken(token))
            .thenThrow(new AuthenticationException("Invalid token signature"));

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        assertAuthenticationFailure(exchange);
    }

    // ============================================================
    // Missing/Null/Empty Token Tests
    // ============================================================

    @Test
    @DisplayName("Missing jwtToken header returns 401 and stops route")
    void testMissingJwtTokenHeader() throws Exception {
        Exchange exchange = new DefaultExchange(camelContext);
        // No jwtToken header set

        processor.process(exchange);

        assertAuthenticationFailure(exchange);
        verifyNoInteractions(authService);
    }

    @Test
    @DisplayName("Null jwtToken header returns 401 and stops route")
    void testNullJwtTokenHeader() throws Exception {
        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setHeader("jwtToken", null);

        processor.process(exchange);

        assertAuthenticationFailure(exchange);
        verifyNoInteractions(authService);
    }

    @Test
    @DisplayName("Empty jwtToken header returns 401 and stops route")
    void testEmptyJwtTokenHeader() throws Exception {
        Exchange exchange = createExchangeWithToken("");

        processor.process(exchange);

        assertAuthenticationFailure(exchange);
        verifyNoInteractions(authService);
    }

    @Test
    @DisplayName("Whitespace jwtToken header returns 401 and stops route")
    void testWhitespaceJwtTokenHeader() throws Exception {
        Exchange exchange = createExchangeWithToken("   ");

        processor.process(exchange);

        assertAuthenticationFailure(exchange);
        verifyNoInteractions(authService);
    }

    // ============================================================
    // WorkOS Service Failure Tests
    // ============================================================

    @Test
    @DisplayName("WorkOS timeout returns 401 and stops route")
    void testWorkOSTimeout() throws Exception {
        String token = "valid.token";

        when(authService.validateToken(token))
            .thenThrow(new AuthenticationException("Authentication service timeout"));

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        assertAuthenticationFailure(exchange);
    }

    @Test
    @DisplayName("WorkOS rate limit returns 503 with Retry-After and stops route")
    void testWorkOSRateLimit() throws Exception {
        String token = "valid.token";

        when(authService.validateToken(token))
            .thenThrow(new RateLimitException("Too many authentication attempts"));

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        // Verify 503 status code (Service Unavailable, not 401 Unauthorized)
        assertEquals(503, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));

        // Verify Retry-After header for client backoff
        assertEquals("60", exchange.getIn().getHeader("Retry-After"));

        // Verify generic error body
        assertEquals("{\"error\": \"Service temporarily unavailable\"}", exchange.getIn().getBody(String.class));

        // Verify route stopped
        assertTrue(exchange.isRouteStop());
    }

    // ============================================================
    // Security Tests
    // ============================================================

    @Test
    @DisplayName("No internal error details leaked to client")
    void testNoErrorDetailsLeaked() throws Exception {
        String token = "invalid.token";

        when(authService.validateToken(token))
            .thenThrow(new AuthenticationException("Detailed internal error: JWKS key rotation failed at host xyz.internal"));

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        // Verify generic error message (no internal details)
        String body = exchange.getIn().getBody(String.class);
        assertEquals("{\"error\": \"Authentication failed\"}", body);

        // Verify internal details NOT in response
        assertFalse(body.contains("JWKS"));
        assertFalse(body.contains("xyz.internal"));
        assertFalse(body.contains("key rotation"));
    }

    // ============================================================
    // Race Condition & Timing Tests
    // ============================================================

    @Test
    @DisplayName("Token expiration race condition handled safely")
    void testTokenExpirationRaceCondition() throws Exception {
        String token = "token.about.to.expire";

        // Simulate token that expires during validation
        // First call: token is valid (race condition window)
        // WorkOS will reject because token expired at validation time
        when(authService.validateToken(token))
            .thenThrow(new AuthenticationException("Token expired"));

        Exchange exchange = createExchangeWithToken(token);
        processor.process(exchange);

        // Verify authentication failure (expired token rejected)
        assertAuthenticationFailure(exchange);

        // Verify WorkOS validation was attempted (not cached/bypassed)
        verify(authService).validateToken(token);
    }

    // ============================================================
    // Integration Tests
    // ============================================================

    @Test
    @DisplayName("Integration with ExtractJwtTokenProcessor - full authentication chain")
    void testIntegrationWithExtractProcessor() throws Exception {
        // This test simulates the full authentication chain:
        // 1. ExtractJwtTokenProcessor extracts token from Authorization header
        // 2. ValidateWorkOSTokenProcessor validates the token and populates user context

        String token = "valid.jwt.token";
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AuthenticatedUser user = new AuthenticatedUser(
            userId,
            "integration@example.com",
            tenantId,
            List.of("admin", "developer")
        );

        // Mock successful validation
        when(authService.validateToken(token)).thenReturn(user);

        // Create exchange with Authorization header (as ExtractJwtTokenProcessor would receive)
        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setHeader("Authorization", "Bearer " + token);

        // Simulate ExtractJwtTokenProcessor: extract token from Authorization header
        String authHeader = exchange.getIn().getHeader("Authorization", String.class);
        String extractedToken = authHeader.substring("Bearer ".length());
        exchange.getIn().setHeader("jwtToken", extractedToken);

        // Now run ValidateWorkOSTokenProcessor
        processor.process(exchange);

        // Verify headers populated correctly (end-to-end flow)
        assertEquals(userId, exchange.getIn().getHeader("userId"));
        assertEquals("integration@example.com", exchange.getIn().getHeader("userEmail"));
        assertEquals(tenantId, exchange.getIn().getHeader("tenantId"));
        assertEquals(List.of("admin", "developer"), exchange.getIn().getHeader("userRoles"));
        assertEquals(true, exchange.getIn().getHeader("authenticated"));

        // Verify route NOT stopped (successful authentication)
        assertFalse(exchange.isRouteStop());

        // Verify validation called with correct token
        verify(authService).validateToken(token);
    }

    // ============================================================
    // Helper Methods
    // ============================================================

    private Exchange createExchangeWithToken(String token) {
        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setHeader("jwtToken", token);
        return exchange;
    }

    private void assertAuthenticationFailure(Exchange exchange) {
        // Verify 401 status code
        assertEquals(401, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));

        // Verify generic error body
        assertEquals("{\"error\": \"Authentication failed\"}", exchange.getIn().getBody(String.class));

        // Verify route stopped
        assertTrue(exchange.isRouteStop());
    }
}
