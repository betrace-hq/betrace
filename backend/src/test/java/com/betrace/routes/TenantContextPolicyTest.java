package com.betrace.routes;

import com.betrace.model.Tenant;
import com.betrace.model.TenantContext;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.Route;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("TenantContextPolicy Tests")
class TenantContextPolicyTest {

    private TenantContextPolicy policy;
    private CamelContext context;
    private Exchange exchange;
    private Route route;

    @Mock
    private ProducerTemplate mockProducerTemplate;

    @Mock
    private Route mockRoute;

    @BeforeEach
    void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);
        policy = new TenantContextPolicy();

        // Create real CamelContext and spy on it
        context = spy(new DefaultCamelContext());

        // Mock createProducerTemplate to return our mock
        when(context.createProducerTemplate()).thenReturn(mockProducerTemplate);

        context.start();

        // Create exchange with the spied context
        exchange = new DefaultExchange(context);
        route = mockRoute;
    }

    @AfterEach
    void tearDown() throws Exception {
        if (context != null) {
            context.stop();
        }
    }

    @Test
    @DisplayName("Should extract tenant ID from explicit header")
    void testExtractTenantIdFromHeader() {
        // Setup tenant for cache lookup
        Tenant tenant123 = new Tenant("tenant-123", "Tenant 123");
        tenant123.setStatus(Tenant.TenantStatus.ACTIVE);
        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("tenant-123")
        )).thenReturn(tenant123);

        exchange.getIn().setHeader("tenantId", "tenant-123");

        policy.onExchangeBegin(route, exchange);

        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        assertNotNull(context);
        assertEquals("tenant-123", context.getTenantId());
        assertEquals("tenant-123", exchange.getIn().getHeader("tenantId"));
    }

    @Test
    @DisplayName("Should extract tenant ID from 'id' header as fallback")
    void testExtractTenantIdFromIdHeader() {
        // Setup tenant for cache lookup
        Tenant tenant456 = new Tenant("tenant-456", "Tenant 456");
        tenant456.setStatus(Tenant.TenantStatus.ACTIVE);
        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("tenant-456")
        )).thenReturn(tenant456);

        exchange.getIn().setHeader("id", "tenant-456");

        policy.onExchangeBegin(route, exchange);

        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        assertNotNull(context);
        assertEquals("tenant-456", context.getTenantId());
    }

    @Test
    @DisplayName("Should extract tenant ID from query parameter")
    void testExtractTenantIdFromQueryParam() {
        // Setup tenant for cache lookup
        Tenant tenant789 = new Tenant("tenant-789", "Tenant 789");
        tenant789.setStatus(Tenant.TenantStatus.ACTIVE);
        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("tenant-789")
        )).thenReturn(tenant789);

        exchange.getIn().setHeader("tenant", "tenant-789");

        policy.onExchangeBegin(route, exchange);

        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        assertNotNull(context);
        assertEquals("tenant-789", context.getTenantId());
    }

    @Test
    @DisplayName("Should stop route when no tenant ID found")
    void testStopRouteWhenNoTenantFound() {
        // No headers set

        policy.onExchangeBegin(route, exchange);

        // Should stop the route
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
        assertNotNull(exchange.getProperty("tenantContextError"));
        assertTrue(exchange.getProperty("tenantContextError").toString().contains("No tenant ID found"));

        // Should set error response
        assertEquals(400, exchange.getIn().getHeader("CamelHttpResponseCode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("MISSING_TENANT", body.get("error"));

        // Should NOT set tenant context
        assertNull(exchange.getProperty("tenantContext"));
    }

    @Test
    @DisplayName("Should skip if context already exists with same tenant ID")
    void testSkipExistingContext() {
        Tenant existingTenant = new Tenant("tenant-123", "Existing Tenant");
        TenantContext existingContext = new TenantContext("tenant-123", existingTenant);

        exchange.setProperty("tenantContext", existingContext);
        exchange.getIn().setHeader("tenantId", "tenant-123");

        policy.onExchangeBegin(route, exchange);

        // Should still be the same context object
        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        assertSame(existingContext, context);
    }

    @Test
    @DisplayName("Should establish new context when tenant ID changes")
    void testEstablishNewContextOnTenantChange() {
        Tenant oldTenant = new Tenant("old-tenant", "Old Tenant");
        TenantContext oldContext = new TenantContext("old-tenant", oldTenant);

        // Setup new tenant for cache lookup
        Tenant newTenant = new Tenant("new-tenant", "New Tenant");
        newTenant.setStatus(Tenant.TenantStatus.ACTIVE);
        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("new-tenant")
        )).thenReturn(newTenant);

        exchange.setProperty("tenantContext", oldContext);
        exchange.getIn().setHeader("tenantId", "new-tenant");

        policy.onExchangeBegin(route, exchange);

        TenantContext newContext = exchange.getProperty("tenantContext", TenantContext.class);
        assertNotNull(newContext);
        assertNotSame(oldContext, newContext);
        assertEquals("new-tenant", newContext.getTenantId());
    }

    @Test
    @DisplayName("Should use cached tenant when available")
    void testUseCachedTenant() {
        Tenant cachedTenant = new Tenant("cached-tenant", "Cached Tenant");
        cachedTenant.setStatus(Tenant.TenantStatus.ACTIVE);

        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("cached-tenant")
        )).thenReturn(cachedTenant);

        exchange.getIn().setHeader("tenantId", "cached-tenant");

        policy.onExchangeBegin(route, exchange);

        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        assertNotNull(context);
        assertEquals("cached-tenant", context.getTenantId());
        assertEquals("Cached Tenant", context.getTenant().getName());
    }

    @Test
    @DisplayName("Should stop route for inactive cached tenant")
    void testRejectInactiveCachedTenant() {
        Tenant inactiveTenant = new Tenant("inactive-tenant", "Inactive Tenant");
        inactiveTenant.setStatus(Tenant.TenantStatus.SUSPENDED);

        when(mockProducerTemplate.requestBodyAndHeader(
            anyString(),
            isNull(),
            anyString(),
            anyString()
        )).thenReturn(inactiveTenant);

        exchange.getIn().setHeader("tenantId", "inactive-tenant");

        policy.onExchangeBegin(route, exchange);

        // Should stop the route
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
        assertNotNull(exchange.getProperty("tenantContextError"));
        assertTrue(exchange.getProperty("tenantContextError").toString().contains("not active"));

        // Should set 403 response
        assertEquals(403, exchange.getIn().getHeader("CamelHttpResponseCode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("INVALID_TENANT", body.get("error"));

        assertNull(exchange.getProperty("tenantContext"));
    }

    @Test
    @DisplayName("Should handle tenant not found in cache")
    void testHandleTenantNotFound() {
        when(mockProducerTemplate.requestBodyAndHeader(
            anyString(),
            isNull(),
            anyString(),
            anyString()
        )).thenReturn(null);

        exchange.getIn().setHeader("tenantId", "unknown-tenant");

        policy.onExchangeBegin(route, exchange);

        // Should stop the route
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
        assertNotNull(exchange.getProperty("tenantContextError"));
        assertTrue(exchange.getProperty("tenantContextError").toString().contains("not found"));

        // Should set 403 response
        assertEquals(403, exchange.getIn().getHeader("CamelHttpResponseCode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("INVALID_TENANT", body.get("error"));

        assertNull(exchange.getProperty("tenantContext"));
    }

    @Test
    @DisplayName("Should set tenant context in headers and properties")
    void testSetContextInHeadersAndProperties() {
        // Setup tenant for cache lookup
        Tenant testTenant = new Tenant("test-tenant", "Test Tenant");
        testTenant.setStatus(Tenant.TenantStatus.ACTIVE);
        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("test-tenant")
        )).thenReturn(testTenant);

        exchange.getIn().setHeader("tenantId", "test-tenant");

        policy.onExchangeBegin(route, exchange);

        // Check property
        TenantContext contextProp = exchange.getProperty("tenantContext", TenantContext.class);
        assertNotNull(contextProp);

        // Check headers
        assertEquals("test-tenant", exchange.getIn().getHeader("tenantId"));
        assertNotNull(exchange.getIn().getHeader("tenantContext"));

        TenantContext contextHeader = exchange.getIn().getHeader("tenantContext", TenantContext.class);
        assertEquals(contextProp, contextHeader);
    }

    @Test
    @DisplayName("Should handle Authorization header but return null from token extraction")
    void testAuthorizationHeaderWithNullExtraction() {
        exchange.getIn().setHeader("Authorization", "Bearer dummy-token");

        policy.onExchangeBegin(route, exchange);

        // Should stop the route since extractTenantFromToken returns null
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
        assertNotNull(exchange.getProperty("tenantContextError"));
        assertTrue(exchange.getProperty("tenantContextError").toString().contains("No tenant ID found"));
        assertNull(exchange.getProperty("tenantContext"));
    }

    @Test
    @DisplayName("Should extract tenant ID from JWT token when available")
    void testExtractTenantIdFromJWT() throws Exception {
        // Setup tenant for cache lookup
        Tenant jwtTenant = new Tenant("jwt-tenant", "JWT Tenant");
        jwtTenant.setStatus(Tenant.TenantStatus.ACTIVE);
        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("jwt-tenant")
        )).thenReturn(jwtTenant);

        // Create a spy of the policy to mock the package-protected method
        TenantContextPolicy spyPolicy = spy(policy);

        // Mock the extractTenantFromToken method to return a tenant ID
        doReturn("jwt-tenant").when(spyPolicy).extractTenantFromToken("Bearer valid-jwt-token");

        exchange.getIn().setHeader("Authorization", "Bearer valid-jwt-token");

        spyPolicy.onExchangeBegin(route, exchange);

        // Should use tenant ID extracted from JWT
        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        assertNotNull(context);
        assertEquals("jwt-tenant", context.getTenantId());

        // Verify the extractTenantFromToken method was called
        verify(spyPolicy).extractTenantFromToken("Bearer valid-jwt-token");
    }

    @Test
    @DisplayName("Should prioritize headers in correct order")
    void testHeaderPriority() {
        // Setup tenant for cache lookup (will use highest priority - tenantId)
        Tenant priorityTenant = new Tenant("from-tenantId", "Priority Tenant");
        priorityTenant.setStatus(Tenant.TenantStatus.ACTIVE);
        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("from-tenantId")
        )).thenReturn(priorityTenant);

        // Set all possible headers
        exchange.getIn().setHeader("tenant", "from-query");
        exchange.getIn().setHeader("id", "from-id");
        exchange.getIn().setHeader("tenantId", "from-tenantId");

        policy.onExchangeBegin(route, exchange);

        // Should use tenantId as it has highest priority
        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        assertEquals("from-tenantId", context.getTenantId());
    }

    @Test
    @DisplayName("Should clear context on exchange done")
    void testOnExchangeDone() {
        Tenant tenant = new Tenant("test-tenant", "Test Tenant");
        TenantContext context = new TenantContext("test-tenant", tenant);

        exchange.setProperty("tenantContext", context);

        policy.onExchangeDone(route, exchange);

        assertNull(exchange.getProperty("tenantContext"));
    }

    @Test
    @DisplayName("Should handle null context on exchange done")
    void testOnExchangeDoneNullContext() {
        // No context set

        assertDoesNotThrow(() -> policy.onExchangeDone(route, exchange));

        assertNull(exchange.getProperty("tenantContext"));
    }

    @Test
    @DisplayName("Should handle exception during context establishment")
    void testHandleExceptionDuringEstablishment() {
        when(context.createProducerTemplate()).thenThrow(new RuntimeException("Template creation failed"));

        exchange.getIn().setHeader("tenantId", "error-tenant");

        policy.onExchangeBegin(route, exchange);

        // Should stop the route
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
        assertNotNull(exchange.getProperty("tenantContextError"));
        assertTrue(exchange.getProperty("tenantContextError").toString().contains("Template creation failed"));

        // Should set 403 response
        assertEquals(403, exchange.getIn().getHeader("CamelHttpResponseCode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("INVALID_TENANT", body.get("error"));

        assertNull(exchange.getProperty("tenantContext"));
    }

    @Test
    @DisplayName("Should handle non-Tenant object from cache")
    void testHandleNonTenantFromCache() {
        when(mockProducerTemplate.requestBodyAndHeader(
            anyString(),
            isNull(),
            anyString(),
            anyString()
        )).thenReturn("Not a Tenant object");

        exchange.getIn().setHeader("tenantId", "invalid-cache");

        policy.onExchangeBegin(route, exchange);

        // Should stop the route since it's not a Tenant object
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
        assertNotNull(exchange.getProperty("tenantContextError"));
        assertTrue(exchange.getProperty("tenantContextError").toString().contains("not found"));

        // Should set 403 response
        assertEquals(403, exchange.getIn().getHeader("CamelHttpResponseCode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("INVALID_TENANT", body.get("error"));

        assertNull(exchange.getProperty("tenantContext"));
    }

    @Test
    @DisplayName("Should test priority fallback from id to tenant header")
    void testFallbackFromIdToTenant() {
        // Setup tenant for cache lookup
        Tenant tenantFromHeader = new Tenant("from-tenant-header", "Tenant From Header");
        tenantFromHeader.setStatus(Tenant.TenantStatus.ACTIVE);
        when(mockProducerTemplate.requestBodyAndHeader(
            eq("cache://tenants?operation=GET"),
            isNull(),
            eq("CamelCacheKey"),
            eq("from-tenant-header")
        )).thenReturn(tenantFromHeader);

        // Only set tenant header (lower priority)
        exchange.getIn().setHeader("tenant", "from-tenant-header");

        policy.onExchangeBegin(route, exchange);

        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        assertEquals("from-tenant-header", context.getTenantId());
    }

    @Test
    @DisplayName("Should test authorization header without Bearer prefix")
    void testAuthorizationHeaderWithoutBearer() {
        exchange.getIn().setHeader("Authorization", "Basic some-credentials");

        policy.onExchangeBegin(route, exchange);

        // Should stop the route since no tenant ID found
        assertEquals(Boolean.TRUE, exchange.getProperty(Exchange.ROUTE_STOP));
        assertNotNull(exchange.getProperty("tenantContextError"));
        assertNull(exchange.getProperty("tenantContext"));
    }

}