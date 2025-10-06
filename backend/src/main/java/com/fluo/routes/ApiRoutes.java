package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import jakarta.enterprise.context.ApplicationScoped;
import com.fluo.security.TenantSecurityProcessor;

/**
 * REST API routes for signals and rules.
 * Provides the HTTP endpoints and delegates to Camel routes for processing.
 */
@ApplicationScoped
public class ApiRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        // Configure REST DSL
        restConfiguration()
            .bindingMode(RestBindingMode.json)
            .component("platform-http")
            .contextPath("/api")
            .apiProperty("cors", "true");

        // Rule API endpoints
        rest("/rules")
            .post()
                .consumes("application/json")
                .produces("application/json")
                .to("direct:createRuleEndpoint")
            .get()
                .produces("application/json")
                .to("direct:listRulesEndpoint")
            .get("/{id}")
                .produces("application/json")
                .to("direct:getRuleEndpoint")
            .put("/{id}")
                .consumes("application/json")
                .produces("application/json")
                .to("direct:updateRuleEndpoint")
            .delete("/{id}")
                .to("direct:deleteRuleEndpoint")
            .post("/validate")
                .consumes("application/json")
                .produces("application/json")
                .to("direct:validateRuleEndpoint")
            .post("/{id}/test")
                .consumes("application/json")
                .produces("application/json")
                .to("direct:testRuleEndpoint");

        // Signal API endpoints
        rest("/signals")
            .post()
                .consumes("application/json")
                .produces("application/json")
                .to("direct:createSignalEndpoint")
            .get()
                .produces("application/json")
                .to("direct:listSignalsEndpoint")
            .get("/{id}")
                .produces("application/json")
                .to("direct:getSignalEndpoint")
            .post("/{id}/evaluate")
                .consumes("application/json")
                .produces("application/json")
                .to("direct:evaluateSignalEndpoint")
            .patch("/{id}/status")
                .consumes("application/json")
                .produces("application/json")
                .to("direct:updateSignalStatusEndpoint");

        // Health API endpoints
        rest("/health")
            .get()
                .produces("application/json")
                .to("direct:healthCheck")
            .get("/live")
                .produces("application/json")
                .to("direct:healthLiveness")
            .get("/ready")
                .produces("application/json")
                .to("direct:healthReadiness");

        // Tenant API endpoints
        rest("/tenants")
            .post()
                .consumes("application/json")
                .produces("application/json")
                .to("direct:createTenantEndpoint")
            .get()
                .produces("application/json")
                .to("direct:listTenantsEndpoint")
            .get("/{id}")
                .produces("application/json")
                .to("direct:getTenantEndpoint")
            .put("/{id}")
                .consumes("application/json")
                .produces("application/json")
                .to("direct:updateTenantEndpoint")
            .delete("/{id}")
                .to("direct:deleteTenantEndpoint");

        // Route implementations with security
        from("direct:createRuleEndpoint")
            .process(TenantSecurityProcessor.requireRole("rule:write"))
            .to("direct:createRule");

        from("direct:getRuleEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .to("direct:getRule");

        from("direct:validateRuleEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .to("direct:validateRule");

        from("direct:createSignalEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:write"))
            .to("direct:createSignal");

        from("direct:getSignalEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:read"))
            .to("direct:getSignal");

        // Health check implementations
        from("direct:healthCheck")
            .setBody(constant("{\"status\":\"UP\",\"service\":\"fluo-backend\"}\n"));

        from("direct:healthLiveness")
            .setBody(constant("{\"alive\":true}\n"));

        from("direct:healthReadiness")
            .setBody(constant("{\"ready\":true}\n"));

        // Additional rule endpoints
        from("direct:listRulesEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .to("direct:listRules");

        from("direct:updateRuleEndpoint")
            .process(TenantSecurityProcessor.requireRole("rule:write"))
            .to("direct:updateRule");

        from("direct:deleteRuleEndpoint")
            .process(TenantSecurityProcessor.requireRole("rule:write"))
            .to("direct:deleteRule");

        from("direct:testRuleEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .to("direct:testRule");

        // Additional signal endpoints
        from("direct:listSignalsEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:read"))
            .to("direct:listSignals");

        from("direct:evaluateSignalEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:read"))
            .to("direct:evaluateSignal");

        from("direct:updateSignalStatusEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:write"))
            .to("direct:updateSignalStatus");

        // Tenant endpoints
        from("direct:createTenantEndpoint")
            .process(TenantSecurityProcessor.requireRole("admin"))
            .to("direct:tenant-create");

        from("direct:listTenantsEndpoint")
            .process(TenantSecurityProcessor.requireRole("admin"))
            .to("direct:tenant-list");

        from("direct:getTenantEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .to("direct:tenant-get");

        from("direct:updateTenantEndpoint")
            .process(TenantSecurityProcessor.requireRole("admin"))
            .to("direct:tenant-update");

        from("direct:deleteTenantEndpoint")
            .process(TenantSecurityProcessor.requireRole("admin"))
            .to("direct:tenant-delete");
    }
}