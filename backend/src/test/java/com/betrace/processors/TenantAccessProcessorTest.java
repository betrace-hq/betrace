package com.betrace.processors;

import com.betrace.dto.CreateRuleRequest;
import com.betrace.model.Tenant;
import com.betrace.services.TenantService;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Security tests for TenantAccessProcessor
 *
 * Tests verify:
 * - Authorization is enforced at route layer
 * - Tenant enumeration prevention (generic error messages)
 * - Both existence and access are validated together
 * - Security context extraction from headers
 */
@QuarkusTest
public class TenantAccessProcessorTest {

    @Inject
    TenantAccessProcessor processor;

    @Inject
    TenantService tenantService;

    private CamelContext camelContext;
    private static final UUID TEST_TENANT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID UNAUTHORIZED_TENANT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID NON_EXISTENT_TENANT_ID = UUID.fromString("99999999-9999-9999-9999-999999999999");

    @BeforeEach
    void setUp() {
        camelContext = new DefaultCamelContext();

        // Create authorized test tenant
        Tenant authorizedTenant = new Tenant();
        authorizedTenant.setId(TEST_TENANT_ID.toString());
        authorizedTenant.setName("Authorized Tenant");
        authorizedTenant.setStatus(Tenant.TenantStatus.ACTIVE);
        authorizedTenant.setConfiguration(new HashMap<>());

        try {
            tenantService.createTenant(authorizedTenant, "test-admin");
        } catch (IllegalArgumentException e) {
            // Tenant already exists - that's OK
        }
        // Always grant access (idempotent operation)
        tenantService.grantAccess("authenticated-user", TEST_TENANT_ID.toString(), "USER");

        // Create unauthorized test tenant
        Tenant unauthorizedTenant = new Tenant();
        unauthorizedTenant.setId(UNAUTHORIZED_TENANT_ID.toString());
        unauthorizedTenant.setName("Unauthorized Tenant");
        unauthorizedTenant.setStatus(Tenant.TenantStatus.ACTIVE);
        unauthorizedTenant.setConfiguration(new HashMap<>());

        try {
            tenantService.createTenant(unauthorizedTenant, "other-admin");
            // Do NOT grant access to authenticated-user
        } catch (IllegalArgumentException e) {
            // Tenant already exists - that's OK, don't grant access
        }
    }

    @Test
    @DisplayName("Should allow access when user has authorization")
    void testAuthorizedAccess() throws Exception {
        Exchange exchange = createExchange(TEST_TENANT_ID, "authenticated-user");

        processor.process(exchange);

        // Should NOT set error response
        assertNull(exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertNull(exchange.getProperty(Exchange.ROUTE_STOP));
    }

    @Test
    @DisplayName("Should deny access with generic error when tenant does not exist")
    void testNonExistentTenant() throws Exception {
        Exchange exchange = createExchange(NON_EXISTENT_TENANT_ID, "authenticated-user");

        processor.process(exchange);

        // Security: Generic error prevents tenant enumeration
        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertTrue(exchange.getIn().getBody(String.class).contains("Invalid tenant identifier"));
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
    }

    @Test
    @DisplayName("Should deny access with generic error when user unauthorized")
    void testUnauthorizedAccess() throws Exception {
        Exchange exchange = createExchange(UNAUTHORIZED_TENANT_ID, "authenticated-user");

        processor.process(exchange);

        // Security: Same error as non-existent tenant (prevents enumeration)
        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertTrue(exchange.getIn().getBody(String.class).contains("Invalid tenant identifier"));
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
    }

    @Test
    @DisplayName("Should extract userId from Authorization header when userId header missing")
    void testAuthorizationHeaderExtraction() throws Exception {
        Exchange exchange = createExchangeWithAuthHeader(TEST_TENANT_ID);

        processor.process(exchange);

        // Should allow access via Authorization header
        assertNull(exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertNull(exchange.getProperty(Exchange.ROUTE_STOP));
    }

    @Test
    @DisplayName("Should deny access when no user identification available")
    void testMissingUserIdentification() throws Exception {
        Exchange exchange = createExchange(TEST_TENANT_ID, null);
        // Remove Authorization header too
        exchange.getIn().removeHeader("Authorization");

        processor.process(exchange);

        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertTrue(exchange.getIn().getBody(String.class).contains("Invalid tenant identifier"));
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
    }

    @Test
    @DisplayName("Should deny access when request is null")
    void testNullRequest() throws Exception {
        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(null);
        exchange.getIn().setHeader("userId", "authenticated-user");

        processor.process(exchange);

        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
    }

    @Test
    @DisplayName("Should deny access when tenantId is null in request")
    void testNullTenantId() throws Exception {
        Exchange exchange = new DefaultExchange(camelContext);
        CreateRuleRequest request = new CreateRuleRequest(
            "Test Rule",
            "trace.has(error)",
            "HIGH",
            null  // null tenant ID
        );
        exchange.getIn().setBody(request);
        exchange.getIn().setHeader("userId", "authenticated-user");

        processor.process(exchange);

        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
    }

    @Test
    @DisplayName("Error message should NOT contain tenant ID (prevent enumeration)")
    void testErrorMessageDoesNotLeakTenantId() throws Exception {
        Exchange exchange = createExchange(NON_EXISTENT_TENANT_ID, "authenticated-user");

        processor.process(exchange);

        String errorBody = exchange.getIn().getBody(String.class);
        // Security: Generic error should NOT contain tenant ID
        assertFalse(errorBody.contains(NON_EXISTENT_TENANT_ID.toString()),
            "Error message should not contain tenant ID to prevent enumeration");
        assertEquals("{\"error\":\"Invalid tenant identifier\"}", errorBody);
    }

    @Test
    @DisplayName("Should handle blank userId gracefully")
    void testBlankUserId() throws Exception {
        Exchange exchange = createExchange(TEST_TENANT_ID, "");

        processor.process(exchange);

        assertEquals(403, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
    }

    // Helper methods

    private Exchange createExchange(UUID tenantId, String userId) {
        Exchange exchange = new DefaultExchange(camelContext);
        CreateRuleRequest request = new CreateRuleRequest(
            "Test Rule",
            "trace.has(error)",
            "HIGH",
            tenantId
        );
        exchange.getIn().setBody(request);
        if (userId != null) {
            exchange.getIn().setHeader("userId", userId);
        }
        return exchange;
    }

    private Exchange createExchangeWithAuthHeader(UUID tenantId) {
        Exchange exchange = new DefaultExchange(camelContext);
        CreateRuleRequest request = new CreateRuleRequest(
            "Test Rule",
            "trace.has(error)",
            "HIGH",
            tenantId
        );
        exchange.getIn().setBody(request);
        exchange.getIn().setHeader("Authorization", "Bearer fake-jwt-token");
        return exchange;
    }
}
