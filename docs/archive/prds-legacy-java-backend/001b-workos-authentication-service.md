# PRD-001b: WorkOS Authentication Service

**Priority:** P0
**Complexity:** Medium
**Unit:** `WorkOSAuthService.java`
**Dependencies:** None (external dependency: WorkOS SDK)

## Problem

BeTrace needs to validate JWT tokens with WorkOS and manage OAuth authentication flows. This service validates tokens, extracts user profiles (userId, email, tenantId, roles), generates OAuth URLs, and exchanges authorization codes.

## Architecture Integration

**CDI ApplicationScoped Pattern:**
- Single instance per application managed by Quarkus CDI, initialized once with WorkOS credentials from configuration.

**WorkOS SDK Integration:**
- Uses official WorkOS Java SDK (`com.workos:workos`) configured with API key and client ID from environment variables.

**Service Methods:**
- `validateToken(String token)` - Verify JWT and return authenticated user
- `getAuthorizationUrl(String state, String redirectUri)` - Generate OAuth login URL
- `authenticateWithCode(String code)` - Exchange OAuth code for session

## Implementation

**`WorkOSAuthService.java`:**
```java
package com.betrace.services;

import com.betrace.exceptions.AuthenticationException;
import com.betrace.model.AuthenticatedUser;
import com.workos.WorkOS;
import com.workos.common.exceptions.WorkOSException;
import com.workos.common.exceptions.UnauthorizedException;
import com.workos.usermanagement.models.User;
import com.workos.sso.models.AuthenticationResponse;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeoutException;

/**
 * WorkOS authentication service for JWT validation and OAuth flows.
 *
 * CDI ApplicationScoped: Single instance per application.
 *
 * Methods:
 * - validateToken(): Verify JWT with WorkOS, extract user profile
 * - getAuthorizationUrl(): Generate OAuth login URL
 * - authenticateWithCode(): Exchange OAuth code for user session
 *
 * Configuration:
 * - workos.api.key: WorkOS API key (from environment)
 * - workos.client.id: WorkOS client ID (from environment)
 * - workos.timeout.seconds: API timeout (default: 5s)
 */
@ApplicationScoped
public class WorkOSAuthService {

    private static final Logger log = LoggerFactory.getLogger(WorkOSAuthService.class);

    @ConfigProperty(name = "workos.api.key")
    String workosApiKey;

    @ConfigProperty(name = "workos.client.id")
    String workosClientId;

    @ConfigProperty(name = "workos.timeout.seconds", defaultValue = "5")
    int timeoutSeconds;

    private WorkOS workos;

    @PostConstruct
    public void initialize() {
        if (workosApiKey == null || workosApiKey.isBlank()) {
            throw new IllegalStateException("WorkOS API key not configured (workos.api.key)");
        }
        if (workosClientId == null || workosClientId.isBlank()) {
            throw new IllegalStateException("WorkOS client ID not configured (workos.client.id)");
        }

        this.workos = new WorkOS(workosApiKey);
        log.info("WorkOS authentication service initialized (timeout: {}s)", timeoutSeconds);
    }

    /**
     * Validate JWT token with WorkOS.
     *
     * @param token JWT token from Authorization header (without "Bearer " prefix)
     * @return Authenticated user profile with tenant and roles
     * @throws AuthenticationException if token is invalid, expired, or WorkOS API fails
     */
    public AuthenticatedUser validateToken(String token) throws AuthenticationException {
        if (token == null || token.isBlank()) {
            throw new AuthenticationException("Token is null or empty");
        }

        try {
            log.debug("Validating token with WorkOS ({} chars)", token.length());

            User user = workos.userManagement().verifySession(token);

            if (user == null) {
                log.warn("WorkOS returned null user for valid token structure");
                throw new AuthenticationException("User profile not found");
            }

            String orgId = user.getOrganizationId();
            if (orgId == null || orgId.isBlank()) {
                log.warn("User {} has no organization ID", user.getId());
                throw new AuthenticationException("No tenant associated with user");
            }

            UUID tenantId;
            try {
                tenantId = UUID.fromString(orgId);
            } catch (IllegalArgumentException e) {
                log.error("Invalid organization ID format: {}", orgId);
                throw new AuthenticationException("Invalid tenant ID format");
            }

            UUID userId;
            try {
                userId = UUID.fromString(user.getId());
            } catch (IllegalArgumentException e) {
                log.error("Invalid user ID format: {}", user.getId());
                throw new AuthenticationException("Invalid user ID format");
            }

            List<String> roles = extractRoles(user);

            log.info("User authenticated: {} (tenant: {}, roles: {})",
                user.getEmail(), tenantId, roles);

            return new AuthenticatedUser(
                userId,
                user.getEmail(),
                tenantId,
                roles
            );

        } catch (UnauthorizedException e) {
            log.debug("Token validation failed: {}", e.getMessage());
            throw new AuthenticationException("Invalid or expired token", e);

        } catch (WorkOSException e) {
            if (isTimeoutException(e)) {
                log.error("WorkOS API timeout after {}s", timeoutSeconds);
                throw new AuthenticationException("Authentication service timeout", e);
            }
            if (isRateLimitException(e)) {
                log.error("WorkOS rate limit exceeded");
                throw new AuthenticationException("Rate limit exceeded, try again later", e);
            }
            log.error("WorkOS API error during token validation", e);
            throw new AuthenticationException("Authentication service unavailable", e);

        } catch (Exception e) {
            log.error("Unexpected error during token validation", e);
            throw new AuthenticationException("Authentication failed", e);
        }
    }

    /**
     * Get OAuth authorization URL for login flow.
     *
     * @param state CSRF protection state parameter
     * @param redirectUri OAuth callback URL
     * @return Authorization URL to redirect user to
     * @throws AuthenticationException if URL generation fails
     */
    public String getAuthorizationUrl(String state, String redirectUri)
            throws AuthenticationException {
        if (state == null || state.isBlank()) {
            throw new AuthenticationException("State parameter is required for CSRF protection");
        }
        if (redirectUri == null || redirectUri.isBlank()) {
            throw new AuthenticationException("Redirect URI is required");
        }

        try {
            String authUrl = workos.sso().getAuthorizationUrl(
                workosClientId,
                redirectUri,
                state
            );

            log.debug("Generated OAuth authorization URL for redirect: {}", redirectUri);
            return authUrl;

        } catch (Exception e) {
            log.error("Failed to generate authorization URL", e);
            throw new AuthenticationException("Failed to generate login URL", e);
        }
    }

    /**
     * Exchange OAuth code for user session.
     *
     * @param code OAuth authorization code from callback
     * @return Authenticated user profile
     * @throws AuthenticationException if code is invalid or exchange fails
     */
    public AuthenticatedUser authenticateWithCode(String code)
            throws AuthenticationException {
        if (code == null || code.isBlank()) {
            throw new AuthenticationException("Authorization code is required");
        }

        try {
            log.debug("Exchanging OAuth code for user session");

            AuthenticationResponse response = workos.userManagement()
                .authenticateWithCode(code);

            if (response == null || response.getAccessToken() == null) {
                log.error("WorkOS returned null authentication response");
                throw new AuthenticationException("Failed to exchange authorization code");
            }

            String accessToken = response.getAccessToken();

            return validateToken(accessToken);

        } catch (UnauthorizedException e) {
            log.debug("Invalid authorization code: {}", e.getMessage());
            throw new AuthenticationException("Invalid or expired authorization code", e);

        } catch (WorkOSException e) {
            if (isTimeoutException(e)) {
                log.error("WorkOS API timeout during code exchange after {}s", timeoutSeconds);
                throw new AuthenticationException("Authentication service timeout", e);
            }
            if (isRateLimitException(e)) {
                log.error("WorkOS rate limit exceeded during code exchange");
                throw new AuthenticationException("Rate limit exceeded, try again later", e);
            }
            log.error("WorkOS API error during code exchange", e);
            throw new AuthenticationException("Authentication failed", e);

        } catch (AuthenticationException e) {
            throw e;

        } catch (Exception e) {
            log.error("Unexpected error during code exchange", e);
            throw new AuthenticationException("Authentication failed", e);
        }
    }

    /**
     * Extract user roles from WorkOS user metadata.
     *
     * WorkOS stores roles in user.rawAttributes.roles as a list.
     * Default role is "viewer" if no roles are specified.
     */
    private List<String> extractRoles(User user) {
        Map<String, Object> metadata = user.getRawAttributes();

        if (metadata == null) {
            log.debug("User {} has no metadata, defaulting to viewer role", user.getId());
            return List.of("viewer");
        }

        Object rolesObj = metadata.get("roles");

        if (rolesObj instanceof List<?> rolesList) {
            boolean allStrings = rolesList.stream().allMatch(obj -> obj instanceof String);
            if (allStrings) {
                @SuppressWarnings("unchecked")
                List<String> roles = (List<String>) rolesList;

                if (roles.isEmpty()) {
                    log.debug("User {} has empty roles list, defaulting to viewer", user.getId());
                    return List.of("viewer");
                }

                log.debug("Extracted roles for user {}: {}", user.getId(), roles);
                return roles;
            }
        }

        log.debug("User {} has invalid roles format, defaulting to viewer", user.getId());
        return List.of("viewer");
    }

    /**
     * Check if WorkOSException is a timeout error.
     */
    private boolean isTimeoutException(WorkOSException e) {
        return e.getCause() instanceof TimeoutException ||
               e.getMessage().toLowerCase().contains("timeout") ||
               e.getMessage().toLowerCase().contains("timed out");
    }

    /**
     * Check if WorkOSException is a rate limit error.
     */
    private boolean isRateLimitException(WorkOSException e) {
        return e.getMessage().contains("429") ||
               e.getMessage().toLowerCase().contains("rate limit") ||
               e.getMessage().toLowerCase().contains("too many requests");
    }
}
```

**`AuthenticatedUser.java`:**
```java
package com.betrace.model;

import java.util.List;
import java.util.UUID;

/**
 * Authenticated user profile returned from WorkOS validation.
 *
 * @param userId Unique user identifier (WorkOS user ID)
 * @param email User email address
 * @param tenantId Tenant/organization ID (WorkOS organization ID)
 * @param roles User roles (admin, developer, sre, compliance-viewer, viewer)
 */
public record AuthenticatedUser(
    UUID userId,
    String email,
    UUID tenantId,
    List<String> roles
) {
    public AuthenticatedUser {
        if (userId == null) {
            throw new IllegalArgumentException("userId cannot be null");
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email cannot be null or blank");
        }
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId cannot be null");
        }
        if (roles == null || roles.isEmpty()) {
            throw new IllegalArgumentException("roles cannot be null or empty");
        }
    }

    public boolean isAdmin() {
        return roles.contains("admin");
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
```

## Testing Requirements (QA Expert - 90% Coverage)

**Unit Tests:**
- `testValidateValidToken()` - Validate valid token successfully
- `testValidateNullToken()` - Reject null token
- `testValidateEmptyToken()` - Reject empty token
- `testValidateTokenWorkOS401()` - Handle WorkOS 401 Unauthorized
- `testValidateTokenWorkOSTimeout()` - Handle WorkOS timeout (5s)
- `testValidateTokenWorkOSRateLimit()` - Handle WorkOS 429 rate limit
- `testValidateTokenNoOrganization()` - Handle user with no organization
- `testValidateTokenNoRoles()` - Default to viewer role when roles missing
- `testValidateTokenEmptyRolesList()` - Default to viewer when roles empty
- `testValidateTokenMalformedRoles()` - Handle malformed roles metadata
- `testValidateTokenMultipleRoles()` - Extract multiple roles correctly
- `testGetAuthorizationUrl()` - Generate OAuth authorization URL
- `testGetAuthorizationUrlMissingState()` - Reject missing state parameter
- `testGetAuthorizationUrlMissingRedirectUri()` - Reject missing redirect URI
- `testAuthenticateWithCode()` - Exchange OAuth code successfully
- `testAuthenticateWithNullCode()` - Reject null code
- `testAuthenticateWithInvalidCode()` - Handle invalid OAuth code
- `testAuthenticateWithCodeTimeout()` - Handle timeout during code exchange
- `testAuthenticateWithCodeRateLimit()` - Handle rate limit during code exchange

**Failure Mode Matrix:**
| Dependency | Failure | Timeout | Expected Behavior |
|------------|---------|---------|-------------------|
| WorkOS API | Network timeout | 5s | Throw `AuthenticationException("timeout")`, return 503 |
| WorkOS API | 401 Unauthorized | N/A | Throw `AuthenticationException("Invalid or expired token")` |
| WorkOS API | 429 Rate limit | N/A | Throw `AuthenticationException("Rate limit exceeded")` |
| User metadata | Missing roles | N/A | Default to `["viewer"]` role |
| Configuration | Missing API key | Startup | Throw `IllegalStateException`, fail to start |

## Security Considerations (Security Expert)

**Threat Model:**
- **Compromised Credentials:** Store in environment variables only, never hardcode, validate at startup
- **Token Caching Attack:** No token caching - always validate with WorkOS on each request
- **API Timeout DoS:** 5-second timeout prevents request queue buildup
- **Rate Limit Exhaustion:** Detect rate limit errors (429), return clear error
- **Role Manipulation:** Roles extracted from WorkOS only, default to "viewer" if invalid

**Security Tests:**
- Verify application fails to start without credentials
- Revoke token in WorkOS, verify next request fails
- Mock WorkOS with 10s delay, verify 5s timeout
- Mock WorkOS 429 response, verify proper error handling
- Send malformed roles metadata, verify fallback to viewer

## Success Criteria

**Functional:**
- [ ] Validates JWT tokens with WorkOS successfully
- [ ] Extracts user profile (userId, email, tenantId, roles)
- [ ] Defaults to "viewer" role when roles missing/invalid
- [ ] Generates OAuth authorization URLs with CSRF state
- [ ] Exchanges OAuth codes for user sessions
- [ ] Handles WorkOS 401, 429, and timeout errors

**Testing:**
- [ ] 90%+ instruction coverage
- [ ] 85%+ branch coverage
- [ ] All 19 unit tests pass

**Security:**
- [ ] Fails fast on startup if credentials missing
- [ ] Never logs API key or tokens

## Files to Create

- `backend/src/main/java/com/betrace/services/WorkOSAuthService.java`
- `backend/src/main/java/com/betrace/model/AuthenticatedUser.java`
- `backend/src/test/java/com/betrace/services/WorkOSAuthServiceTest.java`

## Files to Modify

**`backend/pom.xml`** - Add WorkOS SDK dependency:
```xml
<dependency>
    <groupId>com.workos</groupId>
    <artifactId>workos</artifactId>
    <version>4.5.0</version>
</dependency>
```

**`backend/src/main/resources/application.properties`** - Add WorkOS config:
```properties
# WorkOS Authentication
workos.api.key=${WORKOS_API_KEY}
workos.client.id=${WORKOS_CLIENT_ID}
workos.timeout.seconds=5
```

## Dependencies

**Requires:** None (external WorkOS SDK)
**Blocks:** PRD-001c (ValidateWorkOSTokenProcessor)
