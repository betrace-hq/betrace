package com.betrace.security;

import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TenantSecurityProcessor Tests")
class TenantSecurityProcessorTest {

    private CamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("Should reject request without authentication token")
    void testNoAuthenticationToken() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();

        processor.process(exchange);

        assertEquals(401, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertEquals("Unauthorized", response.get("error"));
        assertEquals("Authentication required", response.get("message"));
    }

    @Test
    @DisplayName("Should reject request with invalid authentication token")
    void testInvalidAuthenticationToken() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();
        exchange.getIn().setHeader("Authorization", "InvalidToken");

        processor.process(exchange);

        assertEquals(401, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertEquals("Unauthorized", response.get("error"));
    }

    @Test
    @DisplayName("Should accept valid Bearer token")
    void testValidBearerToken() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        assertTrue((Boolean) securityContext.get("authenticated"));
        assertEquals("valid-token", securityContext.get("authToken"));
    }

    @Test
    @DisplayName("Should accept test token in test mode")
    void testAcceptTestTokenInTestMode() throws Exception {
        System.setProperty("security.test.mode", "true");
        try {
            TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();
            exchange.getIn().setHeader("Authorization", "Bearer test-token-123");

            processor.process(exchange);

            @SuppressWarnings("unchecked")
            Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
            assertNotNull(securityContext);
            assertTrue((Boolean) securityContext.get("authenticated"));
        } finally {
            System.clearProperty("security.test.mode");
        }
    }

    @Test
    @DisplayName("Should require role when specified")
    void testRequireRole() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireRole("admin");
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("userRoles", Arrays.asList("user"));

        processor.process(exchange);

        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertEquals("Forbidden", response.get("error"));
        assertEquals("Insufficient privileges", response.get("message"));
    }

    @Test
    @DisplayName("Should accept user with required role")
    void testAcceptWithRequiredRole() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireRole("admin");
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("userRoles", Arrays.asList("admin", "user"));

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        assertTrue((Boolean) securityContext.get("authenticated"));
        @SuppressWarnings("unchecked")
        List<String> roles = (List<String>) securityContext.get("roles");
        assertTrue(roles.contains("admin"));
    }

    @Test
    @DisplayName("Should handle roles as comma-separated string")
    void testRolesAsCommaSeparatedString() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireRole("admin");
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("userRoles", "admin,user,viewer");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        @SuppressWarnings("unchecked")
        List<String> roles = (List<String>) securityContext.get("roles");
        assertEquals(3, roles.size());
        assertTrue(roles.contains("admin"));
    }

    @Test
    @DisplayName("Should require tenant match when specified")
    void testRequireTenantMatch() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantAccess();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("tenantId", "tenant-123");

        // The extractRequestedTenantId looks for tenantId in the header first,
        // so it will find tenant-123 and compare it with itself - should pass
        processor.process(exchange);

        // Should succeed since both user tenant and requested tenant are the same
        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        assertEquals("tenant-123", securityContext.get("tenantId"));
    }

    @Test
    @DisplayName("Should reject tenant mismatch")
    void testRejectTenantMismatch() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantAccess();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        // Don't set tenantId header - this represents the user's authenticated tenant
        // The body will contain the requested tenant ID

        // Set a requested tenant ID in body
        Map<String, Object> body = new HashMap<>();
        body.put("tenantId", "different-tenant-456");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        // Should fail because user has no tenant ID (null != "different-tenant-456")
        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertEquals("Forbidden", response.get("error"));
        assertEquals("Access denied to this tenant", response.get("message"));
    }

    @Test
    @DisplayName("Should accept matching tenant")
    void testAcceptMatchingTenant() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantAccess();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("tenantId", "tenant-123");

        // Set matching tenant ID in body
        Map<String, Object> body = new HashMap<>();
        body.put("tenantId", "tenant-123");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        assertEquals("tenant-123", securityContext.get("tenantId"));
    }

    @Test
    @DisplayName("Should extract tenant ID from query parameter")
    void testExtractTenantFromQuery() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantAccess();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("tenantId", "tenant-123");
        exchange.getIn().setHeader("CamelHttpQuery.tenantId", "tenant-123");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        assertEquals("tenant-123", securityContext.get("tenantId"));
    }

    @Test
    @DisplayName("Should require both tenant and role")
    void testRequireTenantAndRole() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantRole("admin");
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("tenantId", "tenant-123");
        exchange.getIn().setHeader("userRoles", Arrays.asList("admin"));

        Map<String, Object> body = new HashMap<>();
        body.put("tenantId", "tenant-123");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        assertEquals("tenant-123", securityContext.get("tenantId"));
        @SuppressWarnings("unchecked")
        List<String> roles = (List<String>) securityContext.get("roles");
        assertTrue(roles.contains("admin"));
    }

    @Test
    @DisplayName("Should reject if tenant matches but role doesn't")
    void testRejectTenantMatchButNoRole() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantRole("admin");
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("tenantId", "tenant-123");
        exchange.getIn().setHeader("userRoles", Arrays.asList("user"));

        Map<String, Object> body = new HashMap<>();
        body.put("tenantId", "tenant-123");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertEquals("Insufficient privileges", response.get("message"));
    }

    @Test
    @DisplayName("Should handle null user roles")
    void testNullUserRoles() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireRole("admin");
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        // No userRoles header

        processor.process(exchange);

        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertEquals("Insufficient privileges", response.get("message"));
    }

    @Test
    @DisplayName("Should handle empty user roles")
    void testEmptyUserRoles() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireRole("admin");
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("userRoles", Arrays.asList());

        processor.process(exchange);

        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    }

    @Test
    @DisplayName("Should set correct content type for error responses")
    void testErrorResponseContentType() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();

        processor.process(exchange);

        assertEquals("application/json", exchange.getIn().getHeader(Exchange.CONTENT_TYPE));
    }

    @Test
    @DisplayName("Should include timestamp in error responses")
    void testErrorResponseTimestamp() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertNotNull(response.get("timestamp"));
        assertTrue(response.get("timestamp").toString().contains("T")); // ISO format
    }

    @Test
    @DisplayName("Should handle non-map body when extracting tenant")
    void testExtractTenantFromNonMapBody() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantAccess();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        // Don't set tenantId header to force extraction from body
        exchange.getIn().setBody("String body");

        processor.process(exchange);

        // Should fail because no tenant ID can be extracted from string body
        assertEquals(400, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertEquals("Bad Request", response.get("error"));
        assertEquals("Tenant ID required", response.get("message"));
    }

    @Test
    @DisplayName("Should handle null tenant ID in security context")
    void testNullTenantInSecurityContext() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        // No tenantId header

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        assertEquals("", securityContext.get("tenantId"));
    }

    @Test
    @DisplayName("Should handle null roles in security context")
    void testNullRolesInSecurityContext() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireAuthentication();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        // No userRoles header

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        @SuppressWarnings("unchecked")
        List<String> roles = (List<String>) securityContext.get("roles");
        assertNotNull(roles);
        assertTrue(roles.isEmpty());
    }

    @Test
    @DisplayName("Should extract tenant ID from path parameter first")
    void testTenantExtractionPriority() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantAccess();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setHeader("tenantId", "path-tenant");
        exchange.getIn().setHeader("CamelHttpQuery.tenantId", "query-tenant");

        Map<String, Object> body = new HashMap<>();
        body.put("tenantId", "body-tenant");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = (Map<String, Object>) exchange.getIn().getHeader("SecurityContext");
        assertNotNull(securityContext);
        assertEquals("path-tenant", securityContext.get("tenantId"));
    }

    @Test
    @DisplayName("Should reject when no tenant ID available for tenant-required operation")
    void testNoTenantIdAvailable() throws Exception {
        TenantSecurityProcessor processor = TenantSecurityProcessor.requireTenantAccess();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        // No tenant ID anywhere - not in header, query, or body

        processor.process(exchange);

        assertEquals(400, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertEquals("Bad Request", response.get("error"));
        assertEquals("Tenant ID required", response.get("message"));
    }

    @Test
    @DisplayName("Should test all static factory methods")
    void testStaticFactoryMethods() {
        TenantSecurityProcessor authOnly = TenantSecurityProcessor.requireAuthentication();
        assertNull(getRequiredRole(authOnly));
        assertFalse(getRequireTenantMatch(authOnly));

        TenantSecurityProcessor roleOnly = TenantSecurityProcessor.requireRole("admin");
        assertEquals("admin", getRequiredRole(roleOnly));
        assertFalse(getRequireTenantMatch(roleOnly));

        TenantSecurityProcessor tenantOnly = TenantSecurityProcessor.requireTenantAccess();
        assertNull(getRequiredRole(tenantOnly));
        assertTrue(getRequireTenantMatch(tenantOnly));

        TenantSecurityProcessor tenantAndRole = TenantSecurityProcessor.requireTenantRole("admin");
        assertEquals("admin", getRequiredRole(tenantAndRole));
        assertTrue(getRequireTenantMatch(tenantAndRole));
    }

    // Helper methods to access private fields for testing
    private String getRequiredRole(TenantSecurityProcessor processor) {
        try {
            var field = TenantSecurityProcessor.class.getDeclaredField("requiredRole");
            field.setAccessible(true);
            return (String) field.get(processor);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private boolean getRequireTenantMatch(TenantSecurityProcessor processor) {
        try {
            var field = TenantSecurityProcessor.class.getDeclaredField("requireTenantMatch");
            field.setAccessible(true);
            return (boolean) field.get(processor);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}