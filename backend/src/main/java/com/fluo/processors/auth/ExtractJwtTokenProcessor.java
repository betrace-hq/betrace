package com.fluo.processors.auth;

import com.fluo.exceptions.AuthenticationException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.jboss.logging.Logger;

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

    private static final Logger log = Logger.getLogger(ExtractJwtTokenProcessor.class);
    private static final String BEARER_SCHEME = "Bearer";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final int BEARER_PREFIX_LENGTH = BEARER_PREFIX.length();
    private static final int MIN_TOKEN_LENGTH = 10; // Minimum realistic JWT length
    private static final int MAX_HEADER_LENGTH = 8192; // 8KB max to prevent DoS attacks

    @Override
    public void process(Exchange exchange) throws Exception {
        String authHeader = exchange.getIn().getHeader("Authorization", String.class);

        // Validate header exists
        if (authHeader == null) {
            log.debug("Missing Authorization header");
            throw new AuthenticationException("Missing Authorization header");
        }

        // Validate header length to prevent DoS attacks via large headers
        if (authHeader.length() > MAX_HEADER_LENGTH) {
            log.debugf("Authorization header exceeds maximum length: %d bytes (max: %d)",
                authHeader.length(), MAX_HEADER_LENGTH);
            throw new AuthenticationException("Authorization header exceeds maximum length");
        }

        // Trim leading/trailing whitespace from header
        String trimmedHeader = authHeader.trim();

        // Validate Bearer scheme (case-sensitive per RFC 6750)
        // Check for "Bearer" first, then check if there's a space and token
        if (!trimmedHeader.startsWith(BEARER_SCHEME)) {
            log.debugf("Invalid Authorization scheme: expected 'Bearer', got: %s",
                trimmedHeader.substring(0, Math.min(trimmedHeader.length(), 10)));
            throw new AuthenticationException("Invalid Authorization scheme: expected 'Bearer'");
        }

        // Check if header is exactly "Bearer" (no space, no token)
        if (trimmedHeader.length() == BEARER_SCHEME.length()) {
            log.debug("Empty token in Authorization header");
            throw new AuthenticationException("Empty token in Authorization header");
        }

        // Check if space after Bearer
        if (trimmedHeader.charAt(BEARER_SCHEME.length()) != ' ') {
            log.debugf("Invalid Authorization format: missing space after 'Bearer'");
            throw new AuthenticationException("Invalid Authorization scheme: expected 'Bearer'");
        }

        // Extract token (everything after "Bearer ")
        String token = trimmedHeader.substring(BEARER_PREFIX_LENGTH).trim();

        // Validate token is not empty after trimming
        if (token.isEmpty()) {
            log.debug("Token is empty after trimming whitespace");
            throw new AuthenticationException("Empty token in Authorization header");
        }

        // Validate minimum token length (basic sanity check)
        if (token.length() < MIN_TOKEN_LENGTH) {
            log.debugf("Token too short: %d characters (minimum: %d)",
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

        log.debugf("Successfully extracted JWT token (%d chars)", token.length());
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
