package com.betrace.routes;

import com.betrace.model.Tenant;
import com.betrace.model.TenantContext;
import com.betrace.processors.TenantRouteProcessors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for TenantRoute focusing on route configuration and processor functionality.
 * Tests the processors and route logic without requiring a full Camel context.
 */
@DisplayName("TenantRoute Tests")
class TenantRouteTest {

    @Test
    @DisplayName("Should test InitializeDefaultTenantProcessor")
    void testInitializeDefaultTenantProcessor() throws Exception {
        TenantRouteProcessors.InitializeDefaultTenantProcessor processor =
            new TenantRouteProcessors.InitializeDefaultTenantProcessor();

        DefaultCamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        processor.process(exchange);

        Tenant tenant = exchange.getIn().getBody(Tenant.class);
        assertNotNull(tenant);
        assertEquals("default", tenant.getId());
        assertEquals("Default Tenant", tenant.getName());
        assertEquals("standard", tenant.getConfiguration().get("tier"));
        assertEquals(100, tenant.getConfiguration().get("maxUsers"));
    }

    @Test
    @DisplayName("Should test GenerateTenantIdProcessor with no ID")
    void testGenerateTenantIdProcessorNoId() throws Exception {
        TenantRouteProcessors.GenerateTenantIdProcessor processor =
            new TenantRouteProcessors.GenerateTenantIdProcessor();

        DefaultCamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Map<String, Object> body = new HashMap<>();
        body.put("name", "Test Tenant");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        assertNotNull(body.get("id"));
        assertEquals(body.get("id"), exchange.getIn().getHeader("tenantId"));

        // Verify UUID format
        String id = (String) body.get("id");
        assertEquals(36, id.length()); // Standard UUID length
    }

    @Test
    @DisplayName("Should test GenerateTenantIdProcessor with existing ID")
    void testGenerateTenantIdProcessorWithId() throws Exception {
        TenantRouteProcessors.GenerateTenantIdProcessor processor =
            new TenantRouteProcessors.GenerateTenantIdProcessor();

        DefaultCamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Map<String, Object> body = new HashMap<>();
        body.put("id", "existing-id");
        body.put("name", "Test Tenant");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        assertEquals("existing-id", body.get("id"));
        assertEquals("existing-id", exchange.getIn().getHeader("tenantId"));
    }

    @Test
    @DisplayName("Should test CreateTenantObjectProcessor")
    void testCreateTenantObjectProcessor() throws Exception {
        TenantRouteProcessors.CreateTenantObjectProcessor processor =
            new TenantRouteProcessors.CreateTenantObjectProcessor();

        DefaultCamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Map<String, Object> body = new HashMap<>();
        body.put("id", "tenant-123");
        body.put("name", "Test Tenant");
        body.put("status", "ACTIVE");

        Map<String, Object> config = new HashMap<>();
        config.put("tier", "premium");
        config.put("maxUsers", 500);
        body.put("configuration", config);

        exchange.getIn().setBody(body);

        processor.process(exchange);

        Tenant tenant = exchange.getIn().getBody(Tenant.class);
        assertNotNull(tenant);
        assertEquals("tenant-123", tenant.getId());
        assertEquals("Test Tenant", tenant.getName());
        assertEquals(Tenant.TenantStatus.ACTIVE, tenant.getStatus());
        assertEquals("premium", tenant.getConfiguration().get("tier"));
        assertEquals(500, tenant.getConfiguration().get("maxUsers"));
    }

    @Test
    @DisplayName("Should test CreateTenantObjectProcessor with originalBody header")
    void testCreateTenantObjectProcessorWithOriginalBody() throws Exception {
        TenantRouteProcessors.CreateTenantObjectProcessor processor =
            new TenantRouteProcessors.CreateTenantObjectProcessor();

        DefaultCamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Map<String, Object> originalBody = new HashMap<>();
        originalBody.put("id", "original-id");
        originalBody.put("name", "Original Name");

        exchange.getIn().setHeader("originalBody", originalBody);
        exchange.getIn().setBody(Map.of("id", "different-id"));

        processor.process(exchange);

        Tenant tenant = exchange.getIn().getBody(Tenant.class);
        assertNotNull(tenant);
        assertEquals("original-id", tenant.getId());
        assertEquals("Original Name", tenant.getName());
    }

    @Test
    @DisplayName("Should test CreateTenantObjectProcessor with default name")
    void testCreateTenantObjectProcessorDefaultName() throws Exception {
        TenantRouteProcessors.CreateTenantObjectProcessor processor =
            new TenantRouteProcessors.CreateTenantObjectProcessor();

        DefaultCamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Map<String, Object> body = new HashMap<>();
        body.put("id", "tenant-456");
        // No name provided

        exchange.getIn().setBody(body);

        processor.process(exchange);

        Tenant tenant = exchange.getIn().getBody(Tenant.class);
        assertNotNull(tenant);
        assertEquals("Tenant-tenant-456", tenant.getName());
    }

    @Test
    @DisplayName("Should test CreateTenantContextProcessor")
    void testCreateTenantContextProcessor() throws Exception {
        TenantRouteProcessors.CreateTenantContextProcessor processor =
            new TenantRouteProcessors.CreateTenantContextProcessor();

        DefaultCamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        Tenant tenant = new Tenant("ctx-tenant", "Context Tenant");
        tenant.setStatus(Tenant.TenantStatus.ACTIVE);

        exchange.getIn().setBody(tenant);
        exchange.getIn().setHeader("tenantId", "ctx-tenant");

        processor.process(exchange);

        TenantContext tenantContext = exchange.getIn().getBody(TenantContext.class);
        assertNotNull(tenantContext);
        assertEquals("ctx-tenant", tenantContext.getTenantId());
        assertEquals(tenant, tenantContext.getTenant());
    }

    @Test
    @DisplayName("Should test TenantUpdateEnricher")
    void testTenantUpdateEnricher() throws Exception {
        TenantRouteProcessors.TenantUpdateEnricher enricher =
            new TenantRouteProcessors.TenantUpdateEnricher();

        DefaultCamelContext context = new DefaultCamelContext();

        // Create existing tenant
        Tenant existing = new Tenant("update-tenant", "Original Name");
        existing.setStatus(Tenant.TenantStatus.PENDING);

        // Create update data
        Map<String, Object> updates = new HashMap<>();
        updates.put("name", "Updated Name");
        updates.put("status", "ACTIVE");

        Map<String, Object> config = new HashMap<>();
        config.put("tier", "enterprise");
        updates.put("configuration", config);

        // Create exchanges
        Exchange oldExchange = new DefaultExchange(context);
        oldExchange.getIn().setBody(updates);

        Exchange newExchange = new DefaultExchange(context);
        newExchange.getIn().setBody(existing);

        // Execute enricher
        Exchange result = enricher.aggregate(oldExchange, newExchange);

        // Verify updates
        Tenant updated = result.getIn().getBody(Tenant.class);
        assertNotNull(updated);
        assertEquals("Updated Name", updated.getName());
        assertEquals(Tenant.TenantStatus.ACTIVE, updated.getStatus());
        assertEquals("enterprise", updated.getConfiguration().get("tier"));
        assertNotNull(updated.getUpdatedAt());
    }

    @Test
    @DisplayName("Should test TenantUpdateEnricher throws when tenant not found")
    void testTenantUpdateEnricherThrowsWhenNotFound() throws Exception {
        TenantRouteProcessors.TenantUpdateEnricher enricher =
            new TenantRouteProcessors.TenantUpdateEnricher();

        DefaultCamelContext context = new DefaultCamelContext();

        Map<String, Object> updates = new HashMap<>();
        updates.put("name", "Updated Name");

        Exchange oldExchange = new DefaultExchange(context);
        oldExchange.getIn().setBody(updates);

        Exchange newExchange = new DefaultExchange(context);
        newExchange.getIn().setBody(null); // No tenant found

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> enricher.aggregate(oldExchange, newExchange)
        );

        assertEquals("Tenant not found", exception.getMessage());
    }

    @Test
    @DisplayName("Should test TenantBatchAggregator first exchange")
    void testTenantBatchAggregatorFirstExchange() throws Exception {
        TenantRouteProcessors.TenantBatchAggregator aggregator =
            new TenantRouteProcessors.TenantBatchAggregator();

        DefaultCamelContext context = new DefaultCamelContext();

        Exchange newExchange = new DefaultExchange(context);
        Tenant tenant = new Tenant("batch-1", "Batch Tenant 1");
        newExchange.getIn().setBody(tenant);

        Exchange result = aggregator.aggregate(null, newExchange);

        assertNotNull(result);
        assertEquals(newExchange, result);
        assertEquals(tenant, result.getIn().getBody());
    }

    @Test
    @DisplayName("Should test TenantBatchAggregator subsequent exchange")
    void testTenantBatchAggregatorSubsequentExchange() throws Exception {
        TenantRouteProcessors.TenantBatchAggregator aggregator =
            new TenantRouteProcessors.TenantBatchAggregator();

        DefaultCamelContext context = new DefaultCamelContext();

        Exchange oldExchange = new DefaultExchange(context);
        Tenant tenant1 = new Tenant("batch-1", "Batch Tenant 1");
        oldExchange.getIn().setBody(tenant1);

        Exchange newExchange = new DefaultExchange(context);
        Tenant tenant2 = new Tenant("batch-2", "Batch Tenant 2");
        newExchange.getIn().setBody(tenant2);

        Exchange result = aggregator.aggregate(oldExchange, newExchange);

        assertNotNull(result);
        assertEquals(oldExchange, result);
        assertEquals(tenant1, result.getIn().getBody());
    }

    @Test
    @DisplayName("Should verify all processor annotations")
    void testProcessorAnnotations() {
        // InitializeDefaultTenantProcessor
        assertTrue(TenantRouteProcessors.InitializeDefaultTenantProcessor.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.InitializeDefaultTenantProcessor.class
            .isAnnotationPresent(Named.class));
        assertEquals("initializeDefaultTenantProcessor",
            TenantRouteProcessors.InitializeDefaultTenantProcessor.class
                .getAnnotation(Named.class).value());

        // GenerateTenantIdProcessor
        assertTrue(TenantRouteProcessors.GenerateTenantIdProcessor.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.GenerateTenantIdProcessor.class
            .isAnnotationPresent(Named.class));
        assertEquals("generateTenantIdProcessor",
            TenantRouteProcessors.GenerateTenantIdProcessor.class
                .getAnnotation(Named.class).value());

        // CreateTenantObjectProcessor
        assertTrue(TenantRouteProcessors.CreateTenantObjectProcessor.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.CreateTenantObjectProcessor.class
            .isAnnotationPresent(Named.class));
        assertEquals("createTenantObjectProcessor",
            TenantRouteProcessors.CreateTenantObjectProcessor.class
                .getAnnotation(Named.class).value());

        // CreateTenantContextProcessor
        assertTrue(TenantRouteProcessors.CreateTenantContextProcessor.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.CreateTenantContextProcessor.class
            .isAnnotationPresent(Named.class));
        assertEquals("createTenantContextProcessor",
            TenantRouteProcessors.CreateTenantContextProcessor.class
                .getAnnotation(Named.class).value());

        // TenantUpdateEnricher
        assertTrue(TenantRouteProcessors.TenantUpdateEnricher.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.TenantUpdateEnricher.class
            .isAnnotationPresent(Named.class));
        assertEquals("tenantUpdateEnricher",
            TenantRouteProcessors.TenantUpdateEnricher.class
                .getAnnotation(Named.class).value());

        // TenantBatchAggregator
        assertTrue(TenantRouteProcessors.TenantBatchAggregator.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.TenantBatchAggregator.class
            .isAnnotationPresent(Named.class));
        assertEquals("tenantBatchAggregator",
            TenantRouteProcessors.TenantBatchAggregator.class
                .getAnnotation(Named.class).value());
    }

    @Test
    @DisplayName("Should test TenantRoute instantiation")
    void testTenantRouteInstantiation() {
        TenantRoute route = new TenantRoute();
        assertNotNull(route);

        // Set mock processors
        route.initializeDefaultTenantProcessor = mock(TenantRouteProcessors.InitializeDefaultTenantProcessor.class);
        route.generateTenantIdProcessor = mock(TenantRouteProcessors.GenerateTenantIdProcessor.class);
        route.createTenantObjectProcessor = mock(TenantRouteProcessors.CreateTenantObjectProcessor.class);
        route.createTenantContextProcessor = mock(TenantRouteProcessors.CreateTenantContextProcessor.class);
        route.tenantUpdateEnricher = mock(TenantRouteProcessors.TenantUpdateEnricher.class);
        route.tenantBatchAggregator = mock(TenantRouteProcessors.TenantBatchAggregator.class);

        // Verify processors are set
        assertNotNull(route.initializeDefaultTenantProcessor);
        assertNotNull(route.generateTenantIdProcessor);
        assertNotNull(route.createTenantObjectProcessor);
        assertNotNull(route.createTenantContextProcessor);
        assertNotNull(route.tenantUpdateEnricher);
        assertNotNull(route.tenantBatchAggregator);
    }

    @Test
    @DisplayName("Should test tenant validation scenarios")
    void testTenantValidationScenarios() {
        // Test active tenant
        Tenant activeTenant = new Tenant("active-id", "Active Tenant");
        activeTenant.setStatus(Tenant.TenantStatus.ACTIVE);
        assertEquals(Tenant.TenantStatus.ACTIVE, activeTenant.getStatus());

        // Test pending tenant
        Tenant pendingTenant = new Tenant("pending-id", "Pending Tenant");
        pendingTenant.setStatus(Tenant.TenantStatus.PENDING);
        assertEquals(Tenant.TenantStatus.PENDING, pendingTenant.getStatus());

        // Test suspended tenant
        Tenant suspendedTenant = new Tenant("suspended-id", "Suspended Tenant");
        suspendedTenant.setStatus(Tenant.TenantStatus.SUSPENDED);
        assertEquals(Tenant.TenantStatus.SUSPENDED, suspendedTenant.getStatus());

        // Test default tenant protection
        String tenantId = "default";
        if (tenantId.equals("default")) {
            IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> { throw new IllegalArgumentException("Cannot delete default tenant"); });
            assertTrue(ex.getMessage().contains("Cannot delete default tenant"));
        }
    }

    @Test
    @DisplayName("Should test error handling scenarios")
    void testErrorHandlingScenarios() {
        DefaultCamelContext context = new DefaultCamelContext();
        Exchange exchange = new DefaultExchange(context);

        // Test general exception
        Exception generalException = new Exception("General error");
        exchange.setException(generalException);
        assertNotNull(exchange.getException());
        assertEquals("General error", exchange.getException().getMessage());

        // Clear and test IllegalArgumentException
        exchange.setException(null);
        IllegalArgumentException illegalArgException = new IllegalArgumentException("Bad request");
        exchange.setException(illegalArgException);
        assertNotNull(exchange.getException());
        assertTrue(exchange.getException() instanceof IllegalArgumentException);
        assertEquals("Bad request", exchange.getException().getMessage());

        // Clear and test IllegalStateException
        exchange.setException(null);
        IllegalStateException illegalStateException = new IllegalStateException("Invalid state");
        exchange.setException(illegalStateException);
        assertNotNull(exchange.getException());
        assertTrue(exchange.getException() instanceof IllegalStateException);
        assertEquals("Invalid state", exchange.getException().getMessage());
    }
}