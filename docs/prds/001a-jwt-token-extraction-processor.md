# PRD-001a: JWT Token Extraction Processor

**Priority:** P0
**Complexity:** Simple
**Unit:** `ExtractJwtTokenProcessor.java`
**Dependencies:** None

## Problem

BeTrace needs to extract JWT tokens from HTTP Authorization headers before validating them with WorkOS. This processor parses Bearer tokens, validates header format, and protects against header injection attacks.

## Architecture Integration

**ADR-013 Compliance (Camel-First):**
- Implemented as a Camel `Processor` that runs first in the authentication interceptor chain.

**ADR-014 Compliance (Named Processor):**
- Uses `@Named("extractJwtTokenProcessor")` for Camel route reference and is injectable as a CDI bean for testing.

**Exchange Header Contract:**
- **Input:** `Authorization` header (String) - format: "Bearer {token}"
- **Output:** `jwtToken` header (String) - extracted token value
- **On Failure:** Throws `AuthenticationException` with descriptive message

## Implementation

**`ExtractJwtTokenProcessor.java`:**
```java
package com.fluo.processors.auth;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Extracts JWT token from Authorization header.
 *
 * Per ADR-013 (Camel-First): First processor in authentication chain.
 * Per ADR-014: Named processor for testability.
 *
 * Header Contract:
 * - Input: Authorization: "Bearer {token}"
 * - Output: jwtToken: "{token}"
 * - Failure: AuthenticationException with reason
 */
@Named("extractJwtTokenProcessor")
@ApplicationScoped
public class ExtractJwtTokenProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(ExtractJwtTokenProcessor.class);
    private static final String BEARER_PREFIX = "Bearer ";
    private static final int BEARER_PREFIX_LENGTH = BEARER_PREFIX.length();
    private static final int MIN_TOKEN_LENGTH = 10; // Minimum realistic JWT length

    @Override
    public void process(Exchange exchange) throws Exception {
        String authHeader = exchange.getIn().getHeader("Authorization", String.class);

        // Validate header exists
        if (authHeader == null) {
            log.debug("Missing Authorization header");
            throw new AuthenticationException("Missing Authorization header");
        }

        // Trim whitespace to handle malformed requests
        authHeader = authHeader.trim();

        // Validate Bearer scheme (case-sensitive per RFC 6750)
        if (!authHeader.startsWith(BEARER_PREFIX)) {
            log.debug("Invalid Authorization scheme: expected 'Bearer', got: {}",
                authHeader.substring(0, Math.min(authHeader.length(), 10)));
            throw new AuthenticationException("Invalid Authorization scheme: expected 'Bearer'");
        }

        // Extract token
        if (authHeader.length() <= BEARER_PREFIX_LENGTH) {
            log.debug("Empty token in Authorization header");
            throw new AuthenticationException("Empty token in Authorization header");
        }

        String token = authHeader.substring(BEARER_PREFIX_LENGTH).trim();

        // Validate token is not empty after trimming
        if (token.isEmpty()) {
            log.debug("Token is empty after trimming whitespace");
            throw new AuthenticationException("Empty token in Authorization header");
        }

        // Validate minimum token length (basic sanity check)
        if (token.length() < MIN_TOKEN_LENGTH) {
            log.debug("Token too short: {} characters (minimum: {})",
                token.length(), MIN_TOKEN_LENGTH);
            throw new AuthenticationException("Invalid token format: token too short");
        }

        // Validate token contains only valid characters (JWT base64url + dots)
        // JWT format: header.payload.signature (base64url encoded)
        if (!isValidJwtFormat(token)) {
            log.debug("Token contains invalid characters for JWT format");
            throw new AuthenticationException("Invalid token format: not a valid JWT");
        }

        // Store extracted token in exchange header
        exchange.getIn().setHeader("jwtToken", token);

        log.debug("Successfully extracted JWT token ({} chars)", token.length());
    }

    /**
     * Validates JWT token format: alphanumeric + '-' + '_' + '.' only.
     * JWT tokens are base64url encoded (A-Za-z0-9_-) with dots separating sections.
     */
    private boolean isValidJwtFormat(String token) {
        // JWT must have at least 2 dots (header.payload.signature)
        int dotCount = 0;
        for (char c : token.toCharArray()) {
            if (c == '.') {
                dotCount++;
            } else if (!isBase64UrlChar(c)) {
                return false;
            }
        }
        return dotCount >= 2; // Valid JWT has header.payload.signature
    }

    /**
     * Check if character is valid base64url character.
     */
    private boolean isBase64UrlChar(char c) {
        return (c >= 'A' && c <= 'Z') ||
               (c >= 'a' && c <= 'z') ||
               (c >= '0' && c <= '9') ||
               c == '-' || c == '_' || c == '='; // Include '=' for padding
    }
}
```

**`AuthenticationException.java`:**
```java
package com.fluo.exceptions;

/**
 * Thrown when authentication fails due to invalid credentials or token.
 */
public class AuthenticationException extends Exception {

    public AuthenticationException(String message) {
        super(message);
    }

    public AuthenticationException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

## Testing Requirements (QA Expert - 90% Coverage)

**Unit Tests:**
- `testValidBearerToken()` - Extract valid JWT token successfully
- `testMissingAuthorizationHeader()` - Reject missing header
- `testNullAuthorizationHeader()` - Reject null header
- `testNonBearerSchemeLowercase()` - Reject "bearer" (lowercase)
- `testNonBearerSchemeUppercase()` - Reject "BEARER" (uppercase)
- `testBasicScheme()` - Reject "Basic" scheme
- `testEmptyToken()` - Reject "Bearer " with no token
- `testWhitespaceOnlyToken()` - Reject "Bearer     " (whitespace)
- `testTrimWhitespaceFromToken()` - Trim leading/trailing whitespace from token
- `testTrimWhitespaceFromHeader()` - Trim whitespace from entire header
- `testTokenWithNewlines()` - Reject tokens with newlines (smuggling)
- `testTokenTooShort()` - Reject tokens < 10 characters
- `testMalformedJwtNoDots()` - Reject tokens without dots
- `testMalformedJwtOneDot()` - Reject tokens with only one dot
- `testJwtWithPadding()` - Accept JWT with '=' padding
- `testTokenWithSpecialCharacters()` - Reject SQL injection attempts
- `testMultipleAuthorizationHeaders()` - Handle multiple headers (Camel extracts first)
- `testRealWorldWorkOsToken()` - Extract real WorkOS JWT format

**Edge Cases:**
- Empty string token, whitespace-only token
- Leading/trailing whitespace in header or token
- Case sensitivity ("bearer", "BEARER")
- Special characters, Unicode, null bytes
- Very long tokens (8KB+ handled by Quarkus)

**Failure Modes:**
| Input | Expected Behavior | HTTP Status |
|-------|-------------------|-------------|
| Missing Authorization header | `AuthenticationException` | 401 |
| "bearer token" (lowercase) | `AuthenticationException` | 401 |
| "Basic dXNlcjpwYXNz" | `AuthenticationException` | 401 |
| "Bearer " (empty) | `AuthenticationException` | 401 |
| "Bearer abc" (too short) | `AuthenticationException` | 401 |
| "Bearer no-dots" | `AuthenticationException` | 401 |
| Valid JWT format | Extract token, continue | N/A |

## Security Considerations (Security Expert)

**Threat Model:**
- **Header Injection:** Multiple Authorization headers - Camel extracts first only
- **Token Smuggling:** Whitespace/newlines in token - Trim and validate character set
- **Scheme Confusion:** Non-Bearer schemes - Case-sensitive "Bearer" check per RFC 6750
- **Empty Token Bypass:** "Bearer " with no token - Validate token exists and meets minimum length
- **DoS via Large Headers:** Extremely long headers - Quarkus HTTP limits header size (default 8KB)

**Security Tests:**
- Send multiple Authorization headers → Extract first only
- Send tokens with whitespace/newlines → Reject
- Send "bearer", "BEARER", "Basic" schemes → Reject
- Send "Bearer " with no/empty token → Reject
- Send Authorization header > 8KB → Handled by Quarkus

## Success Criteria

**Functional:**
- [ ] Extracts valid Bearer tokens from Authorization header
- [ ] Stores extracted token in `jwtToken` exchange header
- [ ] Rejects missing, null, or empty Authorization headers
- [ ] Rejects non-Bearer schemes (case-sensitive)
- [ ] Rejects tokens < 10 characters
- [ ] Rejects tokens without at least 2 dots (invalid JWT structure)
- [ ] Trims whitespace from header and token

**Testing:**
- [ ] 90%+ instruction coverage
- [ ] 85%+ branch coverage
- [ ] All 18 unit tests pass

**Security:**
- [ ] Never logs token value
- [ ] Processes in < 1ms
- [ ] All security threats have corresponding tests

## Files to Create

- `backend/src/main/java/com/fluo/processors/auth/ExtractJwtTokenProcessor.java`
- `backend/src/main/java/com/fluo/exceptions/AuthenticationException.java`
- `backend/src/test/java/com/fluo/processors/auth/ExtractJwtTokenProcessorTest.java`

## Dependencies

**Requires:** None
**Blocks:** PRD-001c (ValidateWorkOSTokenProcessor)
