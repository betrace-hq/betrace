package com.fluo.services;

import com.fluo.exceptions.AuthenticationException;
import com.fluo.model.AuthenticatedUser;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jose.proc.JWSKeySelector;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * JWT validator with cryptographic signature verification.
 *
 * Security features:
 * - RS256 signature verification using WorkOS public keys
 * - Expiration time validation
 * - Issuer validation (must be api.workos.com)
 * - Algorithm whitelisting (only RS256 allowed)
 * - Claim validation (userId, email, orgId required)
 *
 * This follows OAuth 2.0 / OpenID Connect standards for JWT validation.
 */
@ApplicationScoped
public class JwtValidatorService {

    private static final Logger log = Logger.getLogger(JwtValidatorService.class);

    private static final String EXPECTED_ISSUER = "https://api.workos.com";
    private static final JWSAlgorithm ALLOWED_ALGORITHM = JWSAlgorithm.RS256;

    @Inject
    JwksService jwksService;

    /**
     * Validate JWT token and extract user information.
     *
     * Performs:
     * 1. Cryptographic signature verification using JWKS public keys
     * 2. Expiration time check
     * 3. Issuer validation
     * 4. Required claims validation
     *
     * @param token JWT access token (without "Bearer " prefix)
     * @return Authenticated user with extracted claims
     * @throws AuthenticationException if token is invalid, expired, or malformed
     */
    public AuthenticatedUser validateToken(String token) throws AuthenticationException {
        if (token == null || token.isBlank()) {
            throw new AuthenticationException("Token is null or empty");
        }

        try {
            log.debugf("Validating JWT token (%d chars)", token.length());

            // Create JWT processor with RS256 signature verification
            ConfigurableJWTProcessor<SecurityContext> jwtProcessor = new DefaultJWTProcessor<>();

            // Set up key selector to fetch public keys from JWKS
            JWSKeySelector<SecurityContext> keySelector = new JWSVerificationKeySelector<>(
                ALLOWED_ALGORITHM,
                jwksService.getJwkSource()
            );
            jwtProcessor.setJWSKeySelector(keySelector);

            // Process and verify the JWT
            JWTClaimsSet claims = jwtProcessor.process(token, null);

            // Validate issuer
            String issuer = claims.getIssuer();
            if (!EXPECTED_ISSUER.equals(issuer)) {
                log.warnf("Invalid issuer: %s (expected: %s)", issuer, EXPECTED_ISSUER);
                throw new AuthenticationException("Invalid token issuer");
            }

            // Validate expiration
            Date expiration = claims.getExpirationTime();
            if (expiration == null || expiration.before(new Date())) {
                log.debug("Token has expired");
                throw new AuthenticationException("Token has expired");
            }

            // Extract required claims
            String userId = claims.getStringClaim("sid");  // WorkOS uses 'sid' for user ID
            String email = claims.getStringClaim("email");
            String orgId = claims.getStringClaim("org_id");

            if (userId == null || userId.isBlank()) {
                log.warn("Token missing 'sid' (user ID) claim");
                throw new AuthenticationException("Invalid token: missing user ID");
            }

            if (email == null || email.isBlank()) {
                log.warn("Token missing 'email' claim");
                throw new AuthenticationException("Invalid token: missing email");
            }

            if (orgId == null || orgId.isBlank()) {
                log.warn("Token missing 'org_id' claim");
                throw new AuthenticationException("Invalid token: missing organization");
            }

            // Parse UUIDs
            UUID userUuid;
            UUID tenantUuid;
            try {
                userUuid = UUID.fromString(userId);
                tenantUuid = UUID.fromString(orgId);
            } catch (IllegalArgumentException e) {
                log.errorf("Invalid UUID format in token: userId=%s, orgId=%s", userId, orgId);
                throw new AuthenticationException("Invalid token: malformed IDs");
            }

            // Extract roles from claims (WorkOS may store roles in custom claim)
            List<String> roles = extractRoles(claims);

            log.infof("Token validated successfully: user=%s, org=%s, roles=%s", email, orgId, roles);

            return new AuthenticatedUser(userUuid, email, tenantUuid, roles);

        } catch (ParseException e) {
            log.debugf("Token parsing failed: %s", e.getMessage());
            throw new AuthenticationException("Invalid token format", e);

        } catch (BadJOSEException e) {
            log.debugf("Token signature verification failed: %s", e.getMessage());
            throw new AuthenticationException("Invalid token signature", e);

        } catch (JOSEException e) {
            log.errorf("JWT processing error: %s", e.getMessage());
            throw new AuthenticationException("Token validation failed", e);

        } catch (IllegalStateException e) {
            log.error("JWKS not available", e);
            throw new AuthenticationException("Authentication service unavailable", e);

        } catch (AuthenticationException e) {
            // Re-throw our own exceptions
            throw e;

        } catch (Exception e) {
            log.error("Unexpected error during token validation", e);
            throw new AuthenticationException("Authentication failed", e);
        }
    }

    /**
     * Extract roles from JWT claims.
     *
     * WorkOS may store roles in:
     * - "roles" claim (array of strings)
     * - "role" claim (single string)
     * - Organization membership data
     *
     * Default to "viewer" if no roles found.
     */
    private List<String> extractRoles(JWTClaimsSet claims) {
        try {
            // Try to get roles array
            List<String> roles = claims.getStringListClaim("roles");
            if (roles != null && !roles.isEmpty()) {
                return roles;
            }

            // Try single role claim
            String role = claims.getStringClaim("role");
            if (role != null && !role.isBlank()) {
                return List.of(role);
            }

        } catch (ParseException e) {
            log.debugf("Could not parse roles from claims: %s", e.getMessage());
        }

        // Default role
        log.debug("No roles found in token, defaulting to viewer");
        return List.of("viewer");
    }
}
