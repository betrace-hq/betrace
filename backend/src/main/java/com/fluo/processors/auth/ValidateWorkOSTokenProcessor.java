package com.fluo.processors.auth;

import com.fluo.exceptions.AuthenticationException;
import com.fluo.exceptions.RateLimitException;
import com.fluo.model.AuthenticatedUser;
import com.fluo.security.AuthSignatureService;
import com.fluo.services.WorkOSAuthService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Validates JWT token with WorkOS and populates exchange with user context.
 *
 * Per ADR-013 (Camel-First): Second processor in authentication chain.
 * Per ADR-014: Named processor for testability.
 *
 * Depends on: PRD-001b (WorkOSAuthService)
 *
 * Header Contract:
 * - Input: jwtToken (String) - from ExtractJwtTokenProcessor
 * - Output (success):
 *   - userId (UUID)
 *   - userEmail (String)
 *   - tenantId (UUID)
 *   - userRoles (List<String>)
 *   - authenticated (Boolean)
 * - Output (failure):
 *   - HTTP_RESPONSE_CODE = 401
 *   - Body: {"error": "Authentication failed"}
 *   - Route stopped
 */
@Named("validateWorkOSTokenProcessor")
@ApplicationScoped
public class ValidateWorkOSTokenProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(ValidateWorkOSTokenProcessor.class);

    @Inject
    WorkOSAuthService authService;

    @Inject
    AuthSignatureService authSignatureService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String token = exchange.getIn().getHeader("jwtToken", String.class);

        if (token == null || token.isBlank()) {
            log.error("No jwtToken header found in exchange (ExtractJwtTokenProcessor likely failed)");
            setAuthenticationFailure(exchange, "Missing token");
            return;
        }

        try {
            log.debug("Validating token with WorkOS ({} chars)", token.length());

            // Validate token with WorkOS
            AuthenticatedUser user = authService.validateToken(token);

            // Populate exchange headers with user context
            exchange.getIn().setHeader("userId", user.userId());
            exchange.getIn().setHeader("userEmail", user.email());
            exchange.getIn().setHeader("tenantId", user.tenantId());
            exchange.getIn().setHeader("userRoles", user.roles());
            exchange.getIn().setHeader("authenticated", true);

            // Generate cryptographic signature for auth chain integrity (Security P0)
            // Prevents downstream processors from being bypassed with forged headers
            String signature = authSignatureService.signAuthContext(user.tenantId(), user.roles());
            exchange.setProperty("authSignature", signature);

            log.info("User authenticated: {} (tenant: {}, roles: {})",
                user.email(), user.tenantId(), user.roles());
            log.debug("Auth signature generated for integrity verification");

        } catch (RateLimitException e) {
            log.warn("Rate limit exceeded: {}", e.getMessage());
            setRateLimitFailure(exchange, e.getMessage());

        } catch (AuthenticationException e) {
            log.warn("Authentication failed: {}", e.getMessage());
            setAuthenticationFailure(exchange, e.getMessage());
        }
    }

    /**
     * Sets authentication failure response and stops the route.
     *
     * This prevents downstream processors from executing.
     * Client receives 401 Unauthorized with error message.
     */
    private void setAuthenticationFailure(Exchange exchange, String reason) {
        exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 401);
        exchange.getIn().setBody("{\"error\": \"Authentication failed\"}");
        exchange.setRouteStop(true);

        log.debug("Route stopped due to authentication failure: {}", reason);
    }

    /**
     * Sets rate limit failure response and stops the route.
     *
     * Rate limits are temporary failures (503 Service Unavailable)
     * rather than authentication failures (401), allowing clients
     * to retry with exponential backoff.
     */
    private void setRateLimitFailure(Exchange exchange, String reason) {
        exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 503);
        exchange.getIn().setHeader("Retry-After", "60");
        exchange.getIn().setBody("{\"error\": \"Service temporarily unavailable\"}");
        exchange.setRouteStop(true);

        log.debug("Route stopped due to rate limit: {}", reason);
    }
}
