package com.fluo.routes;

import com.fluo.processors.validation.ValidationErrorProcessor;
import org.apache.camel.CamelContext;
import org.apache.camel.impl.DefaultCamelContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("ApiRoutes Tests")
class ApiRoutesTest {

    private CamelContext context;
    private ApiRoutes apiRoutes;

    @BeforeEach
    void setUp() throws Exception {
        context = new DefaultCamelContext();

        // Register ValidationErrorProcessor bean for validation error handling
        context.getRegistry().bind("validationErrorProcessor", new ValidationErrorProcessor());

        apiRoutes = new ApiRoutes();
        context.addRoutes(apiRoutes);
        context.start();
    }

    @AfterEach
    void tearDown() throws Exception {
        if (context != null) {
            context.stop();
        }
    }

    @Test
    @DisplayName("Should create ApiRoutes instance")
    void testApiRoutesCreation() {
        assertNotNull(apiRoutes);
    }

    @Test
    @DisplayName("Should configure routes successfully")
    void testRouteConfiguration() throws Exception {
        // Verify that routes were configured without exceptions
        assertTrue(context.getRoutes().size() > 0);
        assertEquals("Started", context.getStatus().name());
    }

    @Test
    @DisplayName("Should have all expected rule endpoints")
    void testRuleEndpoints() throws Exception {
        assertTrue(context.hasEndpoint("direct:createRuleEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:getRuleEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:validateRuleEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:listRulesEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:updateRuleEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:deleteRuleEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:testRuleEndpoint") != null);
    }

    @Test
    @DisplayName("Should have all expected signal endpoints")
    void testSignalEndpoints() throws Exception {
        assertTrue(context.hasEndpoint("direct:createSignalEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:getSignalEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:listSignalsEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:evaluateSignalEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:updateSignalStatusEndpoint") != null);
    }

    @Test
    @DisplayName("Should have all expected health endpoints")
    void testHealthEndpoints() throws Exception {
        assertTrue(context.hasEndpoint("direct:healthCheck") != null);
        assertTrue(context.hasEndpoint("direct:healthLiveness") != null);
        assertTrue(context.hasEndpoint("direct:healthReadiness") != null);
    }

    @Test
    @DisplayName("Should have all expected tenant endpoints")
    void testTenantEndpoints() throws Exception {
        assertTrue(context.hasEndpoint("direct:createTenantEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:listTenantsEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:getTenantEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:updateTenantEndpoint") != null);
        assertTrue(context.hasEndpoint("direct:deleteTenantEndpoint") != null);
    }

    @Test
    @DisplayName("Should have REST configuration")
    void testRestConfiguration() throws Exception {
        assertNotNull(context.getRestConfiguration());
    }

    @Test
    @DisplayName("Should test health check route")
    void testHealthCheckRoute() throws Exception {
        String response = context.createProducerTemplate()
            .requestBody("direct:healthCheck", null, String.class);

        assertNotNull(response);
        assertTrue(response.contains("\"status\":\"UP\""));
        assertTrue(response.contains("\"service\":\"fluo-backend\""));
    }

    @Test
    @DisplayName("Should test liveness route")
    void testLivenessRoute() throws Exception {
        String response = context.createProducerTemplate()
            .requestBody("direct:healthLiveness", null, String.class);

        assertNotNull(response);
        assertTrue(response.contains("\"alive\":true"));
    }

    @Test
    @DisplayName("Should test readiness route")
    void testReadinessRoute() throws Exception {
        String response = context.createProducerTemplate()
            .requestBody("direct:healthReadiness", null, String.class);

        assertNotNull(response);
        assertTrue(response.contains("\"ready\":true"));
    }

    @Test
    @DisplayName("Should have consistent route count")
    void testRouteCount() throws Exception {
        // API routes creates many direct routes
        int routeCount = context.getRoutes().size();
        assertTrue(routeCount >= 20); // Should have at least 20 routes
    }

    @Test
    @DisplayName("Should handle route lifecycle")
    void testRouteLifecycle() throws Exception {
        assertTrue(context.getStatus().isStarted());

        // Test stopping and starting
        context.stop();
        assertEquals("Stopped", context.getStatus().name());

        context.start();
        assertEquals("Started", context.getStatus().name());
    }
}