# PRD-001c: WorkOS Token Validation Processor

**Priority:** P0
**Complexity:** Simple
**Unit:** `ValidateWorkOSTokenProcessor.java`
**Dependencies:** PRD-001a (ExtractJwtTokenProcessor), PRD-001b (WorkOSAuthService)

## Problem

After extracting a JWT token from the Authorization header, BeTrace needs to validate it with WorkOS and populate the exchange with user context (userId, tenantId, userRoles). This processor stops the route if validation fails and returns 401 Unauthorized.

## Architecture Integration

**ADR-013 Compliance (Camel-First):**
- Implemented as a Camel `Processor` in authentication chain, runs after ExtractJwtTokenProcessor (PRD-001a), stops route on failure using `exchange.setRouteStop(true)`.

**ADR-014 Compliance (Named Processor):**
- Uses `@Named("validateWorkOSTokenProcessor")` for Camel route reference and is injectable CDI bean for testing.

**Uses WorkOSAuthService (PRD-001b):**
- Injects WorkOSAuthService via CDI, calls `authService.validateToken(token)` for validation.

**Exchange Header Contract:**
- **Input:** `jwtToken` header (String) - from ExtractJwtTokenProcessor
- **Output (success):**
  - `userId` (UUID), `userEmail` (String), `tenantId` (UUID), `userRoles` (List<String>), `authenticated` (Boolean)
- **Output (failure):**
  - `Exchange.HTTP_RESPONSE_CODE` = 401, Body: `{"error": "Authentication failed"}`, Route stopped

## Implementation

**`ValidateWorkOSTokenProcessor.java`:**
```java
package com.betrace.processors.auth;

import com.betrace.exceptions.AuthenticationException;
import com.betrace.model.AuthenticatedUser;
import com.betrace.services.WorkOSAuthService;
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

            log.info("User authenticated: {} (tenant: {}, roles: {})",
                user.email(), user.tenantId(), user.roles());

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
}
```

## Testing Requirements (QA Expert - 90% Coverage)

**Unit Tests:**
- `testSuccessfulValidation()` - Populate headers on successful validation
- `testInvalidToken()` - Return 401 and stop route on invalid token
- `testExpiredToken()` - Return 401 and stop route on expired token
- `testTamperedToken()` - Return 401 and stop route on tampered token
- `testMissingJwtTokenHeader()` - Handle missing jwtToken header
- `testNullJwtTokenHeader()` - Handle null jwtToken header
- `testEmptyJwtTokenHeader()` - Handle empty jwtToken header
- `testWhitespaceJwtTokenHeader()` - Handle whitespace-only jwtToken header
- `testWorkOSTimeout()` - Handle WorkOS timeout (5s)
- `testWorkOSRateLimit()` - Handle WorkOS rate limit
- `testNoErrorDetailsLeaked()` - Verify no internal error details exposed
- `testViewerRolePopulation()` - Populate headers for viewer role
- `testMultipleRolesPopulation()` - Populate headers for multiple roles
- `testSpecialCharactersInEmail()` - Handle special characters in email
- `testTokenExpirationRaceCondition()` - Handle token expiring during validation
- `testIntegrationWithExtractProcessor()` - Integration test with ExtractJwtTokenProcessor

**Edge Cases:**
| Scenario | Expected Behavior | Status Code |
|----------|-------------------|-------------|
| Valid token | Populate headers, continue route | N/A (success) |
| Invalid/expired/tampered token | Return 401, stop route | 401 |
| Missing/null/empty jwtToken | Return 401, stop route | 401 |
| WorkOS timeout/rate limit | Return 401, stop route | 401 |
| Special chars in email | Populate safely, continue | N/A (success) |

**Failure Modes:**
| Dependency | Failure | Expected Behavior |
|------------|---------|-------------------|
| WorkOSAuthService | Throws `AuthenticationException` | Return 401, stop route |
| ExtractJwtTokenProcessor | No `jwtToken` header | Return 401, stop route |
| WorkOS API | Timeout/Rate limit | Return 401, stop route |

## Security Considerations (Security Expert)

**Threat Model:**
- **Token Replay:** Attacker reuses valid token - WorkOS validates expiry on each request (no replay detection yet)
- **Expired Token Race:** Token valid at extraction but expires during validation - WorkOS checks expiry at validation time
- **Token Tampering:** Attacker modifies payload - WorkOS verifies JWT signature cryptographically
- **WorkOS Timeout (DoS):** WorkOS slow/unavailable - 5-second timeout (PRD-001b), return 503
- **Information Leakage:** Error message reveals system details - Generic error: "Authentication failed" (no details to client)
- **Header Injection:** Malicious user profile - Headers typed (UUID for IDs), validated by WorkOS

**Security Tests:**
- Validate same token twice (both succeed - no replay detection yet)
- Generate token expiring in 100ms, sleep 150ms, validate → should fail
- Modify token payload, attempt validation → should fail
- Mock WorkOS with 10s delay, verify timeout triggers
- Verify error response never contains WorkOS error details
- Mock user with special characters in email → should pass safely

## Success Criteria

**Functional:**
- [ ] Validates tokens using WorkOSAuthService (PRD-001b)
- [ ] Populates exchange headers on success (userId, userEmail, tenantId, userRoles, authenticated)
- [ ] Returns 401 and stops route on invalid/expired/tampered tokens
- [ ] Returns 401 and stops route on missing jwtToken header
- [ ] Handles WorkOS timeout and rate limit gracefully
- [ ] Never exposes internal error details to client

**Testing:**
- [ ] 90%+ instruction coverage
- [ ] 85%+ branch coverage
- [ ] All 16 unit tests pass
- [ ] Integration test passes

**Security:**
- [ ] Logs detailed errors server-side only
- [ ] Stops route immediately on failure (no downstream processing)
- [ ] Returns generic error message to client

## Files to Create

- `backend/src/main/java/com/betrace/processors/auth/ValidateWorkOSTokenProcessor.java`
- `backend/src/test/java/com/betrace/processors/auth/ValidateWorkOSTokenProcessorTest.java`

## Dependencies

**Requires:** PRD-001a (ExtractJwtTokenProcessor), PRD-001b (WorkOSAuthService)
**Blocks:** None
