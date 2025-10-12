package com.fluo.processors.auth;

import com.fluo.security.AuthSignatureService;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import jakarta.inject.Inject;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@QuarkusTest
@DisplayName("ExtractTenantAndRolesProcessor")
class ExtractTenantAndRolesProcessorTest {

    @Inject
    ExtractTenantAndRolesProcessor processor;

    @InjectMock
    AuthSignatureService authSignatureService;

    private CamelContext camelContext;

    @BeforeEach
    void setUp() {
        camelContext = new DefaultCamelContext();

        // Default: Allow all signatures to pass (tests can override)
        when(authSignatureService.verifyAuthContext(any(UUID.class), anyList(), anyString()))
            .thenReturn(true);
    }

    private Exchange createExchange() {
        return new DefaultExchange(camelContext);
    }

    private Exchange createAuthenticatedExchange(UUID tenantId, List<String> roles) {
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");
        return exchange;
    }

    @Test
    @DisplayName("Extract valid tenant ID and roles - happy path")
    void testExtractValidTenantAndRoles() throws Exception {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = Arrays.asList("admin", "developer");

        Exchange exchange = createAuthenticatedExchange(tenantId, roles);

        processor.process(exchange);

        assertEquals(tenantId, exchange.getProperty("authenticatedTenantId"));
        assertEquals(roles, exchange.getProperty("authenticatedUserRoles"));
    }

    @Test
    @DisplayName("Extract tenant ID as String and convert to UUID")
    void testExtractTenantIdAsString() throws Exception {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = List.of("user");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId.toString());
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        processor.process(exchange);

        assertEquals(tenantId, exchange.getProperty("authenticatedTenantId"));
        assertEquals(roles, exchange.getProperty("authenticatedUserRoles"));
    }

    @Test
    @DisplayName("Missing tenantId header throws exception")
    void testMissingTenantId() {
        List<String> roles = List.of("admin");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Missing tenantId header", ex.getMessage());
    }

    @Test
    @DisplayName("Missing userRoles header throws exception")
    void testMissingUserRoles() {
        UUID tenantId = UUID.randomUUID();

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Missing userRoles header", ex.getMessage());
    }

    @Test
    @DisplayName("Invalid tenant ID format throws exception")
    void testInvalidTenantIdFormat() {
        List<String> roles = List.of("admin");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", "not-a-uuid");
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().startsWith("Invalid tenant ID format"));
    }

    @Test
    @DisplayName("Invalid tenant ID type throws exception")
    void testInvalidTenantIdType() {
        List<String> roles = List.of("admin");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", 12345);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("Invalid tenant ID type"));
        assertTrue(ex.getMessage().contains("Integer"));
    }

    @Test
    @DisplayName("Empty roles list throws exception")
    void testEmptyRolesList() {
        UUID tenantId = UUID.randomUUID();
        List<String> emptyRoles = Collections.emptyList();

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", emptyRoles);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("User roles list cannot be empty", ex.getMessage());
    }

    @Test
    @DisplayName("Invalid role type throws exception")
    void testInvalidRoleType() {
        UUID tenantId = UUID.randomUUID();
        List<Object> mixedRoles = Arrays.asList("admin", 123);

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", mixedRoles);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("Invalid role type"));
    }

    @Test
    @DisplayName("Multiple roles extracted correctly")
    void testMultipleRoles() throws Exception {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = Arrays.asList("admin", "developer", "sre", "compliance_officer");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        processor.process(exchange);

        assertEquals(tenantId, exchange.getProperty("authenticatedTenantId"));

        @SuppressWarnings("unchecked")
        List<String> extractedRoles = (List<String>) exchange.getProperty("authenticatedUserRoles");

        assertEquals(4, extractedRoles.size());
        assertEquals(roles, extractedRoles);
    }

    @Test
    @DisplayName("Exchange properties are set (not headers)")
    void testExchangePropertiesSet() throws Exception {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = List.of("admin");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        processor.process(exchange);

        // Verify properties are set
        assertNotNull(exchange.getProperty("authenticatedTenantId"));
        assertNotNull(exchange.getProperty("authenticatedUserRoles"));

        // Properties should be UUID and List<String>, not the original header objects
        assertTrue(exchange.getProperty("authenticatedTenantId") instanceof UUID);
        assertTrue(exchange.getProperty("authenticatedUserRoles") instanceof List);
    }

    @Test
    @DisplayName("Null tenant ID header throws exception")
    void testNullTenantId() {
        List<String> roles = List.of("admin");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", null);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Missing tenantId header", ex.getMessage());
    }

    @Test
    @DisplayName("Null roles header throws exception")
    void testNullRoles() {
        UUID tenantId = UUID.randomUUID();

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("Missing userRoles header", ex.getMessage());
    }

    @Test
    @DisplayName("Single role extracted correctly")
    void testSingleRole() throws Exception {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = List.of("user");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        processor.process(exchange);

        assertEquals(tenantId, exchange.getProperty("authenticatedTenantId"));

        @SuppressWarnings("unchecked")
        List<String> extractedRoles = (List<String>) exchange.getProperty("authenticatedUserRoles");

        assertEquals(1, extractedRoles.size());
        assertEquals("user", extractedRoles.get(0));
    }

    @Test
    @DisplayName("Malformed UUID string throws clear exception")
    void testMalformedUuidString() {
        List<String> roles = List.of("admin");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", "12345-67890-abcde");
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().startsWith("Invalid tenant ID format"));
        assertTrue(ex.getMessage().contains("12345-67890-abcde"));
    }

    @Test
    @DisplayName("Non-String type in roles list throws exception")
    void testNonStringRoleType() {
        UUID tenantId = UUID.randomUUID();
        List<Object> rolesWithObject = Arrays.asList("admin", new Object());

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", rolesWithObject);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("Invalid role type"));
    }

    @Test
    @DisplayName("Role with SQL injection attempt rejected")
    void testRoleWithSqlInjection() {
        UUID tenantId = UUID.randomUUID();
        List<String> maliciousRoles = List.of("admin; DROP TABLE users;--");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", maliciousRoles);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("Invalid role format"));
        assertTrue(ex.getMessage().contains("admin; DROP TABLE users;--"));
    }

    @Test
    @DisplayName("Role with special characters rejected")
    void testRoleWithSpecialCharacters() {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = List.of("admin@example.com");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("Invalid role format"));
    }

    @Test
    @DisplayName("Role exceeding max length rejected")
    void testRoleExceedingMaxLength() {
        UUID tenantId = UUID.randomUUID();
        String longRole = "a".repeat(51);  // Max is 50 chars
        List<String> roles = List.of(longRole);

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("Invalid role format"));
    }

    @Test
    @DisplayName("Valid role with underscores and dashes accepted")
    void testValidRoleWithUnderscoresAndDashes() throws Exception {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = Arrays.asList("admin_user", "compliance-officer", "sre_on-call");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "valid-signature");

        processor.process(exchange);

        assertEquals(tenantId, exchange.getProperty("authenticatedTenantId"));

        @SuppressWarnings("unchecked")
        List<String> extractedRoles = (List<String>) exchange.getProperty("authenticatedUserRoles");

        assertEquals(3, extractedRoles.size());
        assertEquals(roles, extractedRoles);
    }

    // Security P0: Authentication chain integrity tests

    @Test
    @DisplayName("Missing authSignature throws SecurityException")
    void testMissingAuthSignature() {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = List.of("admin");

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        // Intentionally omit authSignature to simulate bypass attempt

        SecurityException ex = assertThrows(SecurityException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("Authentication chain integrity violation"));
        assertTrue(ex.getMessage().contains("missing signature"));
    }

    @Test
    @DisplayName("Invalid authSignature throws SecurityException")
    void testInvalidAuthSignature() {
        UUID tenantId = UUID.randomUUID();
        List<String> roles = List.of("admin");

        // Mock verification to return false (invalid signature)
        when(authSignatureService.verifyAuthContext(any(UUID.class), anyList(), anyString()))
            .thenReturn(false);

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "forged-signature");

        SecurityException ex = assertThrows(SecurityException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("Authentication chain integrity violation"));
        assertTrue(ex.getMessage().contains("invalid signature"));
    }

    @Test
    @DisplayName("Forged tenant ID detected via signature verification")
    void testForgedTenantId() {
        UUID realTenantId = UUID.randomUUID();
        UUID forgedTenantId = UUID.randomUUID();
        List<String> roles = List.of("admin");

        // Signature was created for realTenantId, but attacker changed header to forgedTenantId
        when(authSignatureService.verifyAuthContext(forgedTenantId, roles, "real-signature"))
            .thenReturn(false);  // Signature mismatch!

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", forgedTenantId);  // Forged!
        exchange.getIn().setHeader("userRoles", roles);
        exchange.setProperty("authSignature", "real-signature");

        SecurityException ex = assertThrows(SecurityException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("invalid signature"));
    }

    @Test
    @DisplayName("Forged roles detected via signature verification")
    void testForgedRoles() {
        UUID tenantId = UUID.randomUUID();
        List<String> realRoles = List.of("user");
        List<String> forgedRoles = List.of("admin", "superuser");  // Privilege escalation!

        // Signature was created for realRoles, but attacker changed header to forgedRoles
        when(authSignatureService.verifyAuthContext(tenantId, forgedRoles, "real-signature"))
            .thenReturn(false);  // Signature mismatch!

        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userRoles", forgedRoles);  // Forged!
        exchange.setProperty("authSignature", "real-signature");

        SecurityException ex = assertThrows(SecurityException.class, () -> {
            processor.process(exchange);
        });

        assertTrue(ex.getMessage().contains("invalid signature"));
    }
}
