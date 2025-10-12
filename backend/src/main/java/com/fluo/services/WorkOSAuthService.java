package com.fluo.services;

import com.fluo.exceptions.AuthenticationException;
import com.fluo.exceptions.RateLimitException;
import com.fluo.model.AuthenticatedUser;
import com.fluo.models.RateLimitResult;
import com.workos.WorkOS;
import com.workos.usermanagement.UserManagementApi;
import com.workos.usermanagement.models.Authentication;
import com.workos.usermanagement.types.AuthenticationAdditionalOptions;
import com.workos.usermanagement.types.UserManagementProviderEnumType;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * WorkOS authentication service with JWT validation and OAuth flows.
 *
 * Architecture:
 * - JWT Validation: Uses JwtValidatorService for cryptographic verification
 * - OAuth Flow: Uses WorkOS SDK for authorization URL generation and code exchange
 * - Security: Full RS256 signature verification via JWKS
 *
 * Configuration:
 * - workos.api.key: WorkOS API key (from environment)
 * - workos.client.id: WorkOS client ID (from environment)
 */
@ApplicationScoped
public class WorkOSAuthService {

    private static final Logger log = Logger.getLogger(WorkOSAuthService.class);

    @ConfigProperty(name = "workos.api.key")
    String workosApiKey;

    @ConfigProperty(name = "workos.client.id")
    String workosClientId;

    @ConfigProperty(name = "workos.sso.default.organization", defaultValue = "")
    String defaultOrganization;

    @ConfigProperty(name = "workos.allowed.redirect.uris")
    String allowedRedirectUris;

    @Inject
    JwtValidatorService jwtValidator;

    @Inject
    RateLimiter rateLimiter;

    private WorkOS workos;
    private UserManagementApi userManagement;

    @PostConstruct
    public void initialize() {
        if (workosApiKey == null || workosApiKey.isBlank()) {
            throw new IllegalStateException("WorkOS API key not configured (workos.api.key)");
        }
        if (workosClientId == null || workosClientId.isBlank()) {
            throw new IllegalStateException("WorkOS client ID not configured (workos.client.id)");
        }

        this.workos = new WorkOS(workosApiKey);
        this.userManagement = workos.userManagement;

        log.info("WorkOS authentication service initialized with JWT validation");
    }

    /**
     * Validate JWT access token with cryptographic verification.
     *
     * This method:
     * 1. Verifies RS256 signature using WorkOS public keys (JWKS)
     * 2. Validates expiration, issuer, and required claims
     * 3. Extracts user profile (userId, email, tenantId, roles)
     *
     * @param token JWT access token from Authorization header (without "Bearer " prefix)
     * @return Authenticated user profile
     * @throws AuthenticationException if token is invalid, expired, or signature verification fails
     */
    public AuthenticatedUser validateToken(String token) throws AuthenticationException {
        if (token == null || token.isBlank()) {
            throw new AuthenticationException("Token is null or empty");
        }

        // Security: Rate limit JWT validation to prevent brute-force attacks
        // RSA signature verification is CPU-expensive
        RateLimitResult rateLimit = rateLimiter.checkAnonymousLimit();
        if (!rateLimit.allowed()) {
            log.warnf("Rate limit exceeded for JWT validation (retry after: %d seconds)",
                rateLimit.retryAfterSeconds());
            throw new RateLimitException("Too many authentication attempts - please try again later");
        }

        log.debugf("Validating JWT token (%d chars)", token.length());

        // Delegate to JWT validator for cryptographic verification
        return jwtValidator.validateToken(token);
    }

    /**
     * Generate OAuth authorization URL for login flow.
     *
     * This URL redirects users to WorkOS for authentication.
     * After successful auth, WorkOS redirects back with an authorization code.
     *
     * @param state CSRF protection state parameter
     * @param redirectUri OAuth callback URL (must be registered with WorkOS)
     * @return Authorization URL to redirect user to
     * @throws AuthenticationException if URL generation fails
     */
    public String getAuthorizationUrl(String state, String redirectUri)
            throws AuthenticationException {
        // Security: Rate limit authorization URL generation to prevent DoS attacks
        RateLimitResult rateLimit = rateLimiter.checkAnonymousLimit();
        if (!rateLimit.allowed()) {
            log.warnf("Rate limit exceeded for authorization URL generation (retry after: %d seconds)",
                rateLimit.retryAfterSeconds());
            throw new RateLimitException("Too many authorization requests - please try again later");
        }

        if (state == null || state.isBlank()) {
            throw new AuthenticationException("State parameter is required for CSRF protection");
        }
        if (redirectUri == null || redirectUri.isBlank()) {
            throw new AuthenticationException("Redirect URI is required");
        }

        // Security: Validate redirect URI against allowlist to prevent open redirect attacks
        if (!isAllowedRedirectUri(redirectUri)) {
            log.warnf("Rejected unauthorized redirect URI: %s", redirectUri);
            throw new AuthenticationException("Redirect URI not in allowlist");
        }

        try {
            log.debugf("Generating OAuth authorization URL for redirect: %s", redirectUri);

            // WorkOS SDK requires organization or provider to be specified
            var builder = userManagement
                .getAuthorizationUrl(workosClientId, redirectUri)
                .state(state);

            // Add organization if configured
            if (defaultOrganization != null && !defaultOrganization.isBlank()) {
                builder.organizationId(defaultOrganization);
            } else {
                // Use AuthKit provider as fallback if no organization configured
                builder.provider(UserManagementProviderEnumType.AuthKit);
            }

            String authUrl = builder.build();

            log.debugf("Generated authorization URL: %s", authUrl);
            return authUrl;

        } catch (Exception e) {
            log.error("Failed to generate authorization URL", e);
            throw new AuthenticationException("Failed to generate login URL", e);
        }
    }

    /**
     * Exchange OAuth authorization code for user session.
     *
     * This method:
     * 1. Calls WorkOS API to exchange code for access token
     * 2. Validates the returned access token using JWT verification
     * 3. Returns authenticated user profile
     *
     * @param code OAuth authorization code from callback
     * @return Authenticated user profile with validated token
     * @throws AuthenticationException if code is invalid, expired, or exchange fails
     */
    public AuthenticatedUser authenticateWithCode(String code)
            throws AuthenticationException {
        if (code == null || code.isBlank()) {
            throw new AuthenticationException("Authorization code is required");
        }

        try {
            log.debug("Exchanging OAuth code for user session");

            // Exchange code for authentication response
            // Note: WorkOS SDK uses default parameters, pass null for additionalOptions
            Authentication auth = userManagement.authenticateWithCode(
                workosClientId,
                code,
                (AuthenticationAdditionalOptions) null  // No additional options needed
            );

            if (auth == null || auth.getAccessToken() == null) {
                log.error("WorkOS returned null authentication response");
                throw new AuthenticationException("Failed to exchange authorization code");
            }

            String accessToken = auth.getAccessToken();
            log.debugf("Received access token from WorkOS (%d chars)", accessToken.length());

            // Validate the access token using JWT verification
            AuthenticatedUser user = jwtValidator.validateToken(accessToken);

            log.infof("User authenticated via OAuth: %s (tenant: %s)",
                user.email(), user.tenantId());

            return user;

        } catch (AuthenticationException e) {
            // Re-throw our own exceptions
            throw e;

        } catch (Exception e) {
            // Catch all errors (UnauthorizedException, BadRequestException, GenericServerException, etc.)
            log.errorf("Error during code exchange: %s", e.getMessage());
            throw new AuthenticationException("Authentication failed", e);
        }
    }

    /**
     * Validate redirect URI against configured allowlist.
     *
     * Security: Prevents open redirect attacks where an attacker could steal authorization codes
     * by specifying a malicious redirect URI.
     *
     * @param redirectUri The redirect URI to validate
     * @return true if allowed, false otherwise
     */
    private boolean isAllowedRedirectUri(String redirectUri) {
        if (allowedRedirectUris == null || allowedRedirectUris.isBlank()) {
            log.warn("No allowed redirect URIs configured - all URIs will be rejected");
            return false;
        }

        // Split comma-separated list and check for exact match
        String[] allowed = allowedRedirectUris.split(",");
        for (String allowedUri : allowed) {
            if (redirectUri.equals(allowedUri.trim())) {
                return true;
            }
        }

        return false;
    }
}
