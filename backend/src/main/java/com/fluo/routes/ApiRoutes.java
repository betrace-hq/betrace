package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import org.apache.camel.Exchange;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolationException;
import com.fluo.dto.CreateRuleRequest;
import com.fluo.security.TenantSecurityProcessor;
import com.fluo.compliance.dto.ComplianceSummaryDTO;
import com.fluo.services.ComplianceService;
import com.fluo.exceptions.RateLimitExceededException;
import com.fluo.exceptions.InjectionAttemptException;
import com.fluo.exceptions.RequestEntityTooLargeException;

import java.util.Optional;
import java.util.UUID;

/**
 * REST API routes for signals and rules.
 * Provides the HTTP endpoints and delegates to Camel routes for processing.
 */
@ApplicationScoped
public class ApiRoutes extends RouteBuilder {

    @Inject
    ComplianceService complianceService;

    @Override
    public void configure() throws Exception {
        // Global exception handlers for validation
        onException(ConstraintViolationException.class)
            .handled(true)
            .process("complianceAuditProcessor")  // PRD-007 Unit E: Emit SOC2 CC6.1 span
            .process("validationErrorProcessor")
            .setHeader("Content-Type", constant("application/json"));

        // Global exception handler for rate limiting (PRD-007 Unit C)
        onException(RateLimitExceededException.class)
            .handled(true)
            .process("complianceAuditProcessor")  // PRD-007 Unit E: Emit SOC2 CC6.1 span
            .process("rateLimitErrorProcessor")
            .marshal().json();

        // Global exception handler for injection attempts (PRD-007 Unit D)
        onException(InjectionAttemptException.class)
            .handled(true)
            .process("complianceAuditProcessor")  // PRD-007 Unit E: Emit SOC2 CC7.1 span
            .process("injectionAttemptErrorProcessor")
            .marshal().json();

        // Global exception handler for request size limits (PRD-007 Unit D)
        onException(RequestEntityTooLargeException.class)
            .handled(true)
            .process("requestSizeLimitErrorProcessor")
            .marshal().json();

        // Configure REST DSL
        restConfiguration()
            .bindingMode(RestBindingMode.json)
            .component("platform-http")
            .contextPath("/api")
            .apiProperty("cors", "true");

        // Rule API endpoints
        rest("/rules")
            .post()
                .type(CreateRuleRequest.class)
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

        // Compliance API endpoints (PRD-004)
        rest("/v1/compliance")
            .get("/summary")
                .produces("application/json")
                .to("direct:complianceSummary");

        // Route implementations with security and validation
        from("direct:createRuleEndpoint")
            .unmarshal().json(CreateRuleRequest.class)
            .process("inputSanitizerProcessor")  // PRD-007 Unit D: Sanitize input before validation
            .to("bean-validator:validateRequest")
            .process(TenantSecurityProcessor.requireRole("rule:write"))
            .process("rateLimitProcessor")  // PRD-007: Rate limiting after auth, before business logic
            .process("tenantAccessProcessor")  // Verify tenant access (prevents enumeration)
            .to("direct:createRule");

        from("direct:getRuleEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .process("rateLimitProcessor")
            .to("direct:getRule");

        from("direct:validateRuleEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .process("rateLimitProcessor")
            .to("direct:validateRule");

        from("direct:createSignalEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:write"))
            .process("rateLimitProcessor")
            .to("direct:createSignal");

        from("direct:getSignalEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:read"))
            .process("rateLimitProcessor")
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
            .process("rateLimitProcessor")
            .to("direct:listRules");

        from("direct:updateRuleEndpoint")
            .process(TenantSecurityProcessor.requireRole("rule:write"))
            .process("rateLimitProcessor")
            .to("direct:updateRule");

        from("direct:deleteRuleEndpoint")
            .process(TenantSecurityProcessor.requireRole("rule:write"))
            .process("rateLimitProcessor")
            .to("direct:deleteRule");

        from("direct:testRuleEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .process("rateLimitProcessor")
            .to("direct:testRule");

        // Additional signal endpoints
        from("direct:listSignalsEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:read"))
            .process("rateLimitProcessor")
            .to("direct:listSignals");

        from("direct:evaluateSignalEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:read"))
            .process("rateLimitProcessor")
            .to("direct:evaluateSignal");

        from("direct:updateSignalStatusEndpoint")
            .process(TenantSecurityProcessor.requireRole("signal:write"))
            .process("rateLimitProcessor")
            .to("direct:updateSignalStatus");

        // Tenant endpoints
        from("direct:createTenantEndpoint")
            .process(TenantSecurityProcessor.requireRole("admin"))
            .process("rateLimitProcessor")
            .to("direct:tenant-create");

        from("direct:listTenantsEndpoint")
            .process(TenantSecurityProcessor.requireRole("admin"))
            .process("rateLimitProcessor")
            .to("direct:tenant-list");

        from("direct:getTenantEndpoint")
            .process(TenantSecurityProcessor.requireAuthentication())
            .process("rateLimitProcessor")
            .to("direct:tenant-get");

        from("direct:updateTenantEndpoint")
            .process(TenantSecurityProcessor.requireRole("admin"))
            .process("rateLimitProcessor")
            .to("direct:tenant-update");

        from("direct:deleteTenantEndpoint")
            .process(TenantSecurityProcessor.requireRole("admin"))
            .process("rateLimitProcessor")
            .to("direct:tenant-delete");

        // Compliance summary endpoint (PRD-004)
        from("direct:complianceSummary")
            .process(exchange -> {
                // Extract query parameters
                String tenantIdStr = exchange.getIn().getHeader("tenantId", String.class);
                String framework = exchange.getIn().getHeader("framework", String.class);
                Integer hours = exchange.getIn().getHeader("hours", Integer.class);
                Boolean includeTrends = exchange.getIn().getHeader("includeTrends", Boolean.class);

                // Validate tenantId
                if (tenantIdStr == null || tenantIdStr.isBlank()) {
                    exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
                    exchange.getIn().setBody("{\"error\":\"tenantId is required\"}");
                    return;
                }

                UUID tenantId;
                try {
                    tenantId = UUID.fromString(tenantIdStr);
                } catch (IllegalArgumentException e) {
                    exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
                    exchange.getIn().setBody("{\"error\":\"Invalid tenantId format\"}");
                    return;
                }

                // Default parameters
                int lookbackHours = hours != null ? hours : 24;
                boolean includeSparklines = includeTrends != null && includeTrends;

                // Delegate to service
                ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
                    tenantId,
                    Optional.ofNullable(framework),
                    lookbackHours,
                    includeSparklines
                );

                // Return summary
                exchange.getIn().setBody(summary);
            });
    }
}