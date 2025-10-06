package com.fluo.routes;

import com.fluo.model.Tenant;
import com.fluo.model.TenantContext;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.dataformat.JsonLibrary;
import com.fluo.processors.TenantRouteProcessors;
import com.fluo.compliance.processors.ComplianceTrackingProcessor;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.UUID;

/**
 * Tenant management using Camel's built-in components and patterns with compliance tracking.
 *
 * This route leverages:
 * - Camel Cache component for storage
 * - Bean validation for input validation
 * - Route Policies for automatic context management
 * - Content enricher pattern for updates
 * - Claim Check pattern for context preservation
 */
@ApplicationScoped
public class TenantRoute extends RouteBuilder {

    @Inject
    TenantRouteProcessors.InitializeDefaultTenantProcessor initializeDefaultTenantProcessor;

    @Inject
    TenantRouteProcessors.GenerateTenantIdProcessor generateTenantIdProcessor;

    @Inject
    TenantRouteProcessors.CreateTenantObjectProcessor createTenantObjectProcessor;

    @Inject
    TenantRouteProcessors.CreateTenantContextProcessor createTenantContextProcessor;

    @Inject
    TenantRouteProcessors.TenantUpdateEnricher tenantUpdateEnricher;

    @Inject
    TenantRouteProcessors.TenantBatchAggregator tenantBatchAggregator;

    @Override
    public void configure() throws Exception {

        // ============= ERROR HANDLING (Once, applies to all) =============
        onException(Exception.class)
            .handled(true)
            .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(500))
            .transform().simple("Error: ${exception.message}");

        onException(IllegalArgumentException.class)
            .handled(true)
            .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(400))
            .transform().simple("Bad Request: ${exception.message}");

        // ============= INITIALIZE DEFAULT TENANT =============
        from("timer:init?repeatCount=1")
            .routeId("init-default-tenant")
            .process(initializeDefaultTenantProcessor)
            .setHeader("CamelCacheKey", constant("default"))
            .to("cache://tenants?action=PUT")
            .log("Initialized default tenant");

        // ============= TENANT CRUD WITH CACHE COMPONENT =============

        // CREATE - Using cache component with validation and compliance tracking
        from("direct:tenant-create")
            .routeId("tenant-create")
            // Add compliance tracking for tenant creation
            // SOC 2: CC6.3 (Data Isolation), CC8.1 (Change Management)
            // HIPAA: 164.312(a)(2)(i) (Unique User Identification), 164.308(a)(4) (Information Access Management)
            // ISO 27001: A.5.15 (Access Control), A.5.18 (Access Rights)
            .process(ComplianceTrackingProcessor.builder()
                .withSOC2("CC6.3", "CC8.1", "CC6.1")
                .withHIPAA("164.312(a)(2)(i)", "164.308(a)(4)", "164.312(b)")
                .withISO27001("A.5.15", "A.5.18", "A.8.2")
                .withMetadata("operation", "tenant_creation")
                .withMetadata("critical", true)
                .withMetadata("data_isolation", true)
                .build())
            // Validate input
            .filter(body().isNotNull())
                .throwException(new IllegalArgumentException("Request body is required"))
            .filter(simple("${body[name]} != null"))
                .throwException(new IllegalArgumentException("Tenant name is required"))
            // Generate ID if not provided
            .process(generateTenantIdProcessor)
            // Check if already exists using cache
            .setHeader("CamelCacheKey", header("tenantId"))
            .setHeader("CamelCacheOperation", constant("GET"))
            .to("cache://tenants")
            .choice()
                .when(body().isNotNull())
                    .throwException(new IllegalArgumentException("Tenant already exists"))
            .end()
            // Create tenant object
            .process(createTenantObjectProcessor)
            // Store in cache
            .setHeader("CamelCacheOperation", constant("PUT"))
            .to("cache://tenants")
            .log("Created tenant: ${header.tenantId} with compliance tracking");

        // GET - Simple cache retrieval
        from("direct:tenant-get")
            .routeId("tenant-get")
            .setHeader("CamelCacheKey", header("tenantId"))
            .setHeader("CamelCacheOperation", constant("GET"))
            .to("cache://tenants")
            .choice()
                .when(body().isNull())
                    .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(404))
                    .transform(simple("Tenant not found: ${header.tenantId}"))
            .end();

        // UPDATE - Using content enricher pattern
        from("direct:tenant-update")
            .routeId("tenant-update")
            // First get existing tenant
            .enrich("direct:tenant-get-for-update", tenantUpdateEnricher)
            // Store updated tenant
            .setHeader("CamelCacheOperation", constant("PUT"))
            .to("cache://tenants")
            .log("Updated tenant: ${header.tenantId}");

        // Helper route for enrichment
        from("direct:tenant-get-for-update")
            .setHeader("CamelCacheKey", header("tenantId"))
            .setHeader("CamelCacheOperation", constant("GET"))
            .to("cache://tenants");

        // DELETE - With validation
        from("direct:tenant-delete")
            .routeId("tenant-delete")
            .filter(simple("${header.tenantId} == 'default'"))
                .throwException(new IllegalArgumentException("Cannot delete default tenant"))
            .end()
            .setHeader("CamelCacheKey", header("tenantId"))
            .setHeader("CamelCacheOperation", constant("REMOVE"))
            .to("cache://tenants")
            .transform(constant(true))
            .log("Deleted tenant: ${header.tenantId}");

        // LIST - Get all from cache
        from("direct:tenant-list")
            .routeId("tenant-list")
            .setHeader("CamelCacheOperation", constant("GETALL"))
            .to("cache://tenants")
            .transform(simple("${body.values()}"));

        // ============= TENANT CONTEXT WITH CLAIM CHECK PATTERN =============

        // Store tenant context using claim check
        from("direct:establish-context")
            .routeId("establish-tenant-context")
            // Get tenant from cache
            .setHeader("tenantId", simple("${header.tenantId} ?: 'default'"))
            .to("direct:tenant-get")
            .choice()
                .when(body().isNull())
                    .throwException(new IllegalArgumentException("Tenant not found"))
                .when(simple("${body.status} != 'ACTIVE'"))
                    .throwException(new IllegalStateException("Tenant is not active"))
            .end()
            // Create context and store in claim check
            .process(createTenantContextProcessor)
            .to("cache://context?operation=PUT")
            .log("Established context for tenant: ${header.tenantId}");

        // Retrieve tenant context
        from("direct:get-context")
            .routeId("get-tenant-context")
            .setHeader("CamelCacheKey", simple("context-${header.tenantId}"))
            .to("cache://context?operation=GET")
            .choice()
                .when(body().isNull())
                    .to("direct:establish-context")
            .end();

        // ============= TENANT ISOLATION WITH POLICY =============

        // Policy-based tenant validation with compliance tracking
        from("direct:validate-tenant-isolation")
            .routeId("tenant-isolation-check")
            // Add compliance for tenant isolation
            // SOC 2: CC6.3 (Data Isolation), CC6.1 (Logical Access)
            // HIPAA: 164.312(a)(2)(i) (Unique User Identification), 164.308(a)(4) (Information Access Management)
            // FedRAMP: AC-3 (Access Enforcement), AC-4 (Information Flow Enforcement)
            // ISO 27001: A.5.15 (Access Control), A.5.18 (Access Rights)
            .process(ComplianceTrackingProcessor.builder()
                .withSOC2("CC6.3", "CC6.1", "CC6.4")
                .withHIPAA("164.312(a)(2)(i)", "164.308(a)(4)", "164.312(a)(2)(ii)")
                .withFedRAMP("moderate", "AC-3", "AC-4", "AC-6")
                .withISO27001("A.5.15", "A.5.18", "A.8.3")
                .withMetadata("operation", "tenant_isolation_validation")
                .withMetadata("critical", true)
                .withMetadata("data_boundary_enforcement", true)
                .build())
            .choice()
                // Skip if isolation disabled
                .when(simple("{{tenant.isolation.enabled:true}} == false"))
                    .setBody(constant(true))
                // Check cross-tenant access
                .when(simple("${header.currentTenantId} != null && " +
                            "${header.currentTenantId} != ${header.requestedTenantId}"))
                    .log("Cross-tenant access denied: ${header.currentTenantId} -> ${header.requestedTenantId}")
                    .setBody(constant(false))
                    .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(403))
                    .throwException(new SecurityException("Cross-tenant access denied"))
                // Validate tenant is active
                .otherwise()
                    .to("direct:tenant-get")
                    .choice()
                        .when(simple("${body?.status} != 'ACTIVE'"))
                            .throwException(new IllegalStateException("Tenant is not active"))
                    .end()
                    .setBody(constant(true))
            .end();

        // ============= AGGREGATION FOR BATCH OPERATIONS =============

        // Batch create tenants using aggregator
        from("direct:tenant-batch-create")
            .routeId("tenant-batch-create")
            .split(body())
                .to("direct:tenant-create")
            .end()
            .aggregate(constant(true))
                .completionSize(header("batchSize"))
                .completionTimeout(5000)
                .aggregationStrategy(tenantBatchAggregator)
            .log("Batch created ${header.CamelAggregatedSize} tenants");

        // ============= MULTICAST FOR TENANT EVENTS =============

        // Broadcast tenant changes to multiple endpoints
        from("direct:tenant-event")
            .routeId("tenant-event-broadcast")
            .multicast()
                .parallelProcessing()
                .to("direct:audit-log", "direct:metrics-update", "direct:cache-invalidate")
            .end();

        from("direct:audit-log")
            .log("AUDIT: Tenant ${header.operation}: ${header.tenantId}");

        from("direct:metrics-update")
            .log("METRICS: Update for tenant ${header.tenantId}");

        from("direct:cache-invalidate")
            .log("CACHE: Invalidate for tenant ${header.tenantId}");

        // ============= REST API WITH AUTOMATIC CONTEXT =============

        rest("/api/v2/tenants")
            .produces("application/json")
            .consumes("application/json")

            // Create with automatic validation
            .post()
                .type(Map.class)
                .outType(Tenant.class)
                .to("direct:tenant-create")

            // List with caching
            .get()
                .outType(Tenant[].class)
                .to("direct:tenant-list")

            // Get with context establishment
            .get("/{id}")
                .outType(Tenant.class)
                .to("direct:tenant-get")

            // Update with validation
            .put("/{id}")
                .type(Map.class)
                .outType(Tenant.class)
                .to("direct:tenant-update")

            // Delete with protection
            .delete("/{id}")
                .outType(Boolean.class)
                .to("direct:tenant-delete")

            // Batch operations
            .post("/batch")
                .type(Map[].class)
                .to("direct:tenant-batch-create");

        // ============= WIRE TAP FOR ASYNC PROCESSING =============

        from("direct:tenant-async-process")
            .routeId("tenant-async-processing")
            .wireTap("direct:tenant-background-task")
            .transform(simple("Processing initiated for tenant ${header.tenantId}"));

        from("direct:tenant-background-task")
            .delay(1000)
            .log("Background processing completed for ${header.tenantId}");
    }
}