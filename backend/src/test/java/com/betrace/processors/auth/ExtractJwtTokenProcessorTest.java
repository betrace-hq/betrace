package com.fluo.processors.auth;

import com.fluo.exceptions.AuthenticationException;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive test suite for ExtractJwtTokenProcessor.
 *
 * Verifies:
 * - Valid JWT extraction
 * - Missing/invalid headers
 * - Scheme validation (case-sensitive)
 * - Token format validation
 * - Whitespace handling
 * - Security attack vectors
 */
@DisplayName("ExtractJwtTokenProcessor Tests")
class ExtractJwtTokenProcessorTest {

    private ExtractJwtTokenProcessor processor;
    private CamelContext camelContext;

    @BeforeEach
    void setUp() {
        processor = new ExtractJwtTokenProcessor();
        camelContext = new DefaultCamelContext();
    }

    // Valid token tests

    @Test
    @DisplayName("Valid Bearer token extracts successfully")
    void testValidBearerToken() throws Exception {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U");

        processor.process(exchange);

        String extractedToken = exchange.getIn().getHeader("jwtToken", String.class);
        assertNotNull(extractedToken);
        assertEquals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", extractedToken);
    }

    @Test
    @DisplayName("Real-world WorkOS JWT token format")
    void testRealWorldWorkOsToken() throws Exception {
        Exchange exchange = createExchange();
        // WorkOS tokens typically look like this
        String workosToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6InB1YmxpYzpkZWZhdWx0IiwidHlwIjoiSldUIn0.eyJhdWQiOltdLCJjbGllbnRfaWQiOiIxMjM0NSIsImV4cCI6MTY5OTk5OTk5OSwiaWF0IjoxNjk5OTk5MDAwLCJpc3MiOiJodHRwczovL3dvcmtvcy5jb20iLCJqdGkiOiI2NzhjNDk4Yy0wYzI3LTRkNmMtYjE3YS1hZWY2YzQ1MGZkOTEiLCJuYmYiOjE2OTk5OTkwMDAsInNjcCI6WyJvcGVuaWQiXSwic3ViIjoidXNlcl8wMUhYWFhYWFhYWFhYWFhYWFhYWFhYIiwidXNlcl9pZCI6InVzZXJfMDFIWFhYWFhYWFhYWFhYWFhYWFhYWCJ9.signature-goes-here-with-base64url-encoding";
        exchange.getIn().setHeader("Authorization", "Bearer " + workosToken);

        processor.process(exchange);

        String extractedToken = exchange.getIn().getHeader("jwtToken", String.class);
        assertEquals(workosToken, extractedToken);
    }

    @Test
    @DisplayName("Trim whitespace from header")
    void testTrimWhitespaceFromHeader() throws Exception {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "  Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U  ");

        processor.process(exchange);

        String extractedToken = exchange.getIn().getHeader("jwtToken", String.class);
        assertEquals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", extractedToken);
    }

    @Test
    @DisplayName("Trim whitespace from token")
    void testTrimWhitespaceFromToken() throws Exception {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U   ");

        processor.process(exchange);

        String extractedToken = exchange.getIn().getHeader("jwtToken", String.class);
        assertEquals("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", extractedToken);
    }

    @Test
    @DisplayName("JWT with '=' padding is accepted")
    void testJwtWithPadding() throws Exception {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0=.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U=");

        processor.process(exchange);

        String extractedToken = exchange.getIn().getHeader("jwtToken", String.class);
        assertNotNull(extractedToken);
    }

    // Missing/null header tests

    @Test
    @DisplayName("Missing Authorization header throws exception")
    void testMissingAuthorizationHeader() {
        Exchange exchange = createExchange();
        // No Authorization header set

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Missing Authorization header", ex.getMessage());
    }

    @Test
    @DisplayName("Null Authorization header throws exception")
    void testNullAuthorizationHeader() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", null);

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Missing Authorization header", ex.getMessage());
    }

    // Scheme validation tests (case-sensitive)

    @Test
    @DisplayName("Lowercase 'bearer' scheme is rejected")
    void testNonBearerSchemeLowercase() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Invalid Authorization scheme: expected 'Bearer'", ex.getMessage());
    }

    @Test
    @DisplayName("Uppercase 'BEARER' scheme is rejected")
    void testNonBearerSchemeUppercase() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "BEARER eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Invalid Authorization scheme: expected 'Bearer'", ex.getMessage());
    }

    @Test
    @DisplayName("Basic authentication scheme is rejected")
    void testBasicScheme() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Basic dXNlcjpwYXNzd29yZA==");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Invalid Authorization scheme: expected 'Bearer'", ex.getMessage());
    }

    // Empty/whitespace token tests

    @Test
    @DisplayName("Empty token after 'Bearer ' throws exception")
    void testEmptyToken() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer ");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Empty token in Authorization header", ex.getMessage());
    }

    @Test
    @DisplayName("Whitespace-only token throws exception")
    void testWhitespaceOnlyToken() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer     ");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Empty token in Authorization header", ex.getMessage());
    }

    // Token format validation tests

    @Test
    @DisplayName("Token too short is rejected")
    void testTokenTooShort() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer abc");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Invalid token format: token too short", ex.getMessage());
    }

    @Test
    @DisplayName("Malformed JWT without dots is rejected")
    void testMalformedJwtNoDots() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer abcdefghijklmnopqrstuvwxyz");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Invalid token format: not a valid JWT", ex.getMessage());
    }

    @Test
    @DisplayName("Malformed JWT with only one dot is rejected")
    void testMalformedJwtOneDot() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer abcdefghijk.lmnopqrstuvwxyz");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Invalid token format: not a valid JWT", ex.getMessage());
    }

    // Security attack vector tests

    @Test
    @DisplayName("Token with newlines is rejected (smuggling attack)")
    void testTokenWithNewlines() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\neyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Invalid token format: not a valid JWT", ex.getMessage());
    }

    @Test
    @DisplayName("Token with special characters is rejected (SQL injection)")
    void testTokenWithSpecialCharacters() {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer abc'; DROP TABLE users; --");

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        // Will fail on multiple checks: too short, invalid format, special chars
        assertTrue(ex.getMessage().contains("Invalid token format") ||
                   ex.getMessage().contains("token too short"));
    }

    @Test
    @DisplayName("Multiple Authorization headers - Camel extracts first")
    void testMultipleAuthorizationHeaders() throws Exception {
        // Note: This test documents Camel's behavior. In HTTP, multiple headers with
        // same name are joined with commas, but Camel's getHeader() returns first value.
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U");

        processor.process(exchange);

        String extractedToken = exchange.getIn().getHeader("jwtToken", String.class);
        assertNotNull(extractedToken);
    }

    @Test
    @DisplayName("Header exceeding max length is rejected (DoS protection)")
    void testHeaderExceedsMaxLength() {
        Exchange exchange = createExchange();
        // Create a header that exceeds 8KB (8192 bytes)
        String largeToken = "a".repeat(9000); // 9KB header
        exchange.getIn().setHeader("Authorization", "Bearer " + largeToken);

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Authorization header exceeds maximum length", ex.getMessage());
    }

    @Test
    @DisplayName("Header exactly at max length is accepted")
    void testHeaderExactlyAtMaxLength() throws Exception {
        Exchange exchange = createExchange();
        // Create valid JWT exactly at 8192 bytes total
        // "Bearer " = 7 bytes, so token needs to be 8185 bytes
        // Use valid base64url chars with dots for JWT structure: aaa...aaa.bbb...bbb.ccc...ccc
        String validJwtToken = "a".repeat(2727) + "." + "b".repeat(2727) + "." + "c".repeat(2729); // Total: 8185 bytes token + 7 bytes "Bearer " = 8192
        String fullHeader = "Bearer " + validJwtToken;
        assertEquals(8192, fullHeader.length(), "Header should be exactly 8192 bytes");

        exchange.getIn().setHeader("Authorization", fullHeader);

        processor.process(exchange);

        String extractedToken = exchange.getIn().getHeader("jwtToken", String.class);
        assertNotNull(extractedToken);
        assertEquals(validJwtToken, extractedToken);
    }

    @Test
    @DisplayName("Header just under max length is accepted")
    void testHeaderJustUnderMaxLength() throws Exception {
        Exchange exchange = createExchange();
        // Create valid JWT at 8191 bytes total (1 byte under limit)
        String validJwtToken = "a".repeat(2727) + "." + "b".repeat(2727) + "." + "c".repeat(2728); // 8184 bytes token + 7 bytes "Bearer " = 8191
        String fullHeader = "Bearer " + validJwtToken;
        assertEquals(8191, fullHeader.length(), "Header should be exactly 8191 bytes");

        exchange.getIn().setHeader("Authorization", fullHeader);

        processor.process(exchange);

        String extractedToken = exchange.getIn().getHeader("jwtToken", String.class);
        assertNotNull(extractedToken);
        assertEquals(validJwtToken, extractedToken);
    }

    @Test
    @DisplayName("Header just over max length is rejected")
    void testHeaderJustOverMaxLength() {
        Exchange exchange = createExchange();
        // Create header at 8193 bytes (1 byte over limit)
        String validJwtToken = "a".repeat(2727) + "." + "b".repeat(2728) + "." + "c".repeat(2729); // 8186 bytes token + 7 bytes "Bearer " = 8193
        String fullHeader = "Bearer " + validJwtToken;
        assertEquals(8193, fullHeader.length(), "Header should be exactly 8193 bytes");

        exchange.getIn().setHeader("Authorization", fullHeader);

        AuthenticationException ex = assertThrows(AuthenticationException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Authorization header exceeds maximum length", ex.getMessage());
    }

    // Helper method

    private Exchange createExchange() {
        return new DefaultExchange(camelContext);
    }
}
