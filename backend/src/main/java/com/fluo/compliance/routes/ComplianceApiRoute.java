package com.fluo.compliance.routes;

import com.fluo.compliance.dto.*;
import com.fluo.services.ComplianceService;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import org.apache.camel.model.rest.RestParamType;

import java.util.*;

/**
 * PRD-004: Compliance Dashboard API Route (Thin HTTP Adapter)
 *
 * <p>ADR-013 Compliance: Routes are thin adapters, business logic in services.
 * <p>ADR-014 Compliance: ApplicationScoped CDI bean for route discovery.
 *
 * <p>Provides compliance posture summary endpoint for visual dashboard:
 * - Framework coverage (SOC2, HIPAA)
 * - Control status (ACTIVE, PARTIAL, NO_EVIDENCE)
 * - Evidence counts per control
 * - Trend data (optional sparklines)
 *
 * <p>Query Parameters:
 * - tenantId (required): Tenant UUID
 * - framework (optional): Filter by "soc2" or "hipaa" (default: all)
 * - hours (optional): Lookback period in hours (default: 24)
 * - includeTrends (optional): Include sparkline data (default: false)
 *
 * <p>Business Value:
 * - 80% demo "wow moment" target via visual dashboard
 * - <5 minutes to identify compliance gaps
 * - Real-time evidence visibility for auditors
 *
 * <p>Compliance:
 * - SOC2 CC7.2 (System Performance) - Monitoring compliance posture
 * - SOC2 CC8.1 (Change Management) - Tracking control effectiveness
 */
@ApplicationScoped
public class ComplianceApiRoute extends RouteBuilder {

    @Inject
    ComplianceService complianceService;

    @Override
    public void configure() throws Exception {
        // Configure REST endpoint
        restConfiguration()
            .component("platform-http")
            .bindingMode(RestBindingMode.json)
            .dataFormatProperty("prettyPrint", "true")
            .contextPath("/api/v1");

        // GET /api/v1/compliance/summary
        rest("/compliance")
            .get("/summary")
            .description("Get compliance posture summary")
            .produces(MediaType.APPLICATION_JSON)
            .param().name("tenantId").type(RestParamType.query).required(true).description("Tenant UUID").endParam()
            .param().name("framework").type(RestParamType.query).required(false).description("Filter by framework (soc2, hipaa)").endParam()
            .param().name("hours").type(RestParamType.query).required(false).description("Lookback period in hours (default: 24)").endParam()
            .param().name("includeTrends").type(RestParamType.query).required(false).description("Include sparkline trend data (default: false)").endParam()
            .to("direct:complianceSummary");

        // Route implementation - thin adapter
        from("direct:complianceSummary")
            .routeId("compliance-summary-route")
            .log("Fetching compliance summary for tenant: ${header.tenantId}")
            .process(exchange -> {
                // Extract query parameters
                String tenantIdStr = exchange.getIn().getHeader("tenantId", String.class);
                String framework = exchange.getIn().getHeader("framework", String.class);
                Integer hours = exchange.getIn().getHeader("hours", Integer.class);
                Boolean includeTrends = exchange.getIn().getHeader("includeTrends", Boolean.class);

                // Validate tenantId
                if (tenantIdStr == null || tenantIdStr.isBlank()) {
                    exchange.getIn().setBody(Response.status(400).entity(Map.of("error", "tenantId is required")).build());
                    return;
                }

                UUID tenantId;
                try {
                    tenantId = UUID.fromString(tenantIdStr);
                } catch (IllegalArgumentException e) {
                    exchange.getIn().setBody(Response.status(400).entity(Map.of("error", "Invalid tenantId format")).build());
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

                exchange.getIn().setBody(Response.ok(summary).build());
            })
            .end();
    }
}
