package com.fluo.routes;

import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for ApiRoutes using @QuarkusTest.
 * ApiRoutes uses REST DSL with platform-http component which requires full Quarkus context.
 *
 * Converted from DefaultCamelContext to @QuarkusTest to eliminate technical debt.
 */
@QuarkusTest
@DisplayName("ApiRoutes Tests")
class ApiRoutesTest {

    @Inject
    CamelContext context;

    @Inject
    ProducerTemplate producerTemplate;

    @Test
    @DisplayName("Should have CamelContext injected")
    void testCamelContextInjection() {
        assertNotNull(context);
        assertNotNull(producerTemplate);
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
        String response = producerTemplate
            .requestBody("direct:healthCheck", null, String.class);

        assertNotNull(response);
        assertTrue(response.contains("\"status\":\"UP\""));
        assertTrue(response.contains("\"service\":\"fluo-backend\""));
    }

    @Test
    @DisplayName("Should test liveness route")
    void testLivenessRoute() throws Exception {
        String response = producerTemplate
            .requestBody("direct:healthLiveness", null, String.class);

        assertNotNull(response);
        assertTrue(response.contains("\"alive\":true"));
    }

    @Test
    @DisplayName("Should test readiness route")
    void testReadinessRoute() throws Exception {
        String response = producerTemplate
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
    @DisplayName("Should verify context is started")
    void testContextStarted() throws Exception {
        // In @QuarkusTest, context lifecycle is managed by Quarkus
        // We can only verify it's started, not stop/start it
        assertTrue(context.getStatus().isStarted());
    }
}