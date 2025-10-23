package com.betrace.processors;

import com.betrace.model.Tenant;
import com.betrace.model.TenantContext;
import com.betrace.processors.TenantRouteProcessors.*;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.util.Map;
import java.util.HashMap;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TenantRouteProcessors Tests")
class TenantRouteProcessorsTest {

    private DefaultCamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("InitializeDefaultTenantProcessor should create default tenant with configuration")
    void testInitializeDefaultTenantProcessor() throws Exception {
        TenantRouteProcessors.InitializeDefaultTenantProcessor processor =
            new TenantRouteProcessors.InitializeDefaultTenantProcessor();

        processor.process(exchange);

        Tenant result = exchange.getIn().getBody(Tenant.class);
        assertNotNull(result);
        assertEquals("default", result.getId());
        assertEquals("Default Tenant", result.getName());
        assertEquals("standard", result.getConfiguration().get("tier"));
        assertEquals(100, result.getConfiguration().get("maxUsers"));
    }

    @Test
    @DisplayName("InitializeDefaultTenantProcessor should set default status")
    void testInitializeDefaultTenantProcessorStatus() throws Exception {
        TenantRouteProcessors.InitializeDefaultTenantProcessor processor =
            new TenantRouteProcessors.InitializeDefaultTenantProcessor();

        processor.process(exchange);

        Tenant result = exchange.getIn().getBody(Tenant.class);
        assertEquals(Tenant.TenantStatus.ACTIVE, result.getStatus());
    }

    @Test
    @DisplayName("GenerateTenantIdProcessor should generate ID when not provided")
    void testGenerateTenantIdProcessorGeneratesId() throws Exception {
        TenantRouteProcessors.GenerateTenantIdProcessor processor =
            new TenantRouteProcessors.GenerateTenantIdProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("name", "Test Tenant");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertNotNull(result.get("id"));
        assertEquals(36, result.get("id").toString().length()); // UUID length
        assertEquals("Test Tenant", result.get("name"));
        assertEquals(result.get("id"), exchange.getIn().getHeader("tenantId"));
    }

    @Test
    @DisplayName("GenerateTenantIdProcessor should preserve existing ID")
    void testGenerateTenantIdProcessorPreservesId() throws Exception {
        TenantRouteProcessors.GenerateTenantIdProcessor processor =
            new TenantRouteProcessors.GenerateTenantIdProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("id", "existing-tenant-id");
        body.put("name", "Test Tenant");
        exchange.getIn().setBody(body);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getIn().getBody(Map.class);
        assertEquals("existing-tenant-id", result.get("id"));
        assertEquals("existing-tenant-id", exchange.getIn().getHeader("tenantId"));
    }

    @Test
    @DisplayName("CreateTenantObjectProcessor should create tenant from body data")
    void testCreateTenantObjectProcessor() throws Exception {
        TenantRouteProcessors.CreateTenantObjectProcessor processor =
            new TenantRouteProcessors.CreateTenantObjectProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("id", "tenant-123");
        body.put("name", "Production Tenant");
        body.put("status", "ACTIVE");

        Map<String, Object> config = new HashMap<>();
        config.put("tier", "premium");
        config.put("maxUsers", 500);
        body.put("configuration", config);

        exchange.getIn().setBody(body);

        processor.process(exchange);

        Tenant result = exchange.getIn().getBody(Tenant.class);
        assertNotNull(result);
        assertEquals("tenant-123", result.getId());
        assertEquals("Production Tenant", result.getName());
        assertEquals(Tenant.TenantStatus.ACTIVE, result.getStatus());
        assertEquals("premium", result.getConfiguration().get("tier"));
        assertEquals(500, result.getConfiguration().get("maxUsers"));
    }

    @Test
    @DisplayName("CreateTenantObjectProcessor should use originalBody header if present")
    void testCreateTenantObjectProcessorOriginalBody() throws Exception {
        TenantRouteProcessors.CreateTenantObjectProcessor processor =
            new TenantRouteProcessors.CreateTenantObjectProcessor();

        Map<String, Object> originalBody = new HashMap<>();
        originalBody.put("id", "original-tenant");
        originalBody.put("name", "Original Tenant");

        exchange.getIn().setHeader("originalBody", originalBody);
        exchange.getIn().setBody(Map.of("id", "different-tenant"));

        processor.process(exchange);

        Tenant result = exchange.getIn().getBody(Tenant.class);
        assertEquals("original-tenant", result.getId());
        assertEquals("Original Tenant", result.getName());
    }

    @Test
    @DisplayName("CreateTenantObjectProcessor should generate default name if not provided")
    void testCreateTenantObjectProcessorDefaultName() throws Exception {
        TenantRouteProcessors.CreateTenantObjectProcessor processor =
            new TenantRouteProcessors.CreateTenantObjectProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("id", "tenant-456");
        // No name provided
        exchange.getIn().setBody(body);

        processor.process(exchange);

        Tenant result = exchange.getIn().getBody(Tenant.class);
        assertEquals("Tenant-tenant-456", result.getName());
    }

    @Test
    @DisplayName("CreateTenantObjectProcessor should handle null configuration")
    void testCreateTenantObjectProcessorNullConfig() throws Exception {
        TenantRouteProcessors.CreateTenantObjectProcessor processor =
            new TenantRouteProcessors.CreateTenantObjectProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("id", "tenant-789");
        body.put("name", "Simple Tenant");
        body.put("configuration", null);

        exchange.getIn().setBody(body);

        processor.process(exchange);

        Tenant result = exchange.getIn().getBody(Tenant.class);
        assertNotNull(result);
        assertNotNull(result.getConfiguration());
        assertTrue(result.getConfiguration().isEmpty());
    }

    @Test
    @DisplayName("CreateTenantObjectProcessor should handle invalid status gracefully")
    void testCreateTenantObjectProcessorInvalidStatus() throws Exception {
        TenantRouteProcessors.CreateTenantObjectProcessor processor =
            new TenantRouteProcessors.CreateTenantObjectProcessor();

        Map<String, Object> body = new HashMap<>();
        body.put("id", "tenant-invalid");
        body.put("name", "Invalid Status Tenant");
        body.put("status", "INVALID_STATUS");

        exchange.getIn().setBody(body);

        assertThrows(IllegalArgumentException.class, () -> processor.process(exchange));
    }

    @Test
    @DisplayName("CreateTenantContextProcessor should create context from tenant")
    void testCreateTenantContextProcessor() throws Exception {
        TenantRouteProcessors.CreateTenantContextProcessor processor =
            new TenantRouteProcessors.CreateTenantContextProcessor();

        Tenant tenant = new Tenant("tenant-ctx", "Context Tenant");
        tenant.setStatus(Tenant.TenantStatus.ACTIVE);
        tenant.getConfiguration().put("tier", "enterprise");

        exchange.getIn().setBody(tenant);
        exchange.getIn().setHeader("tenantId", "tenant-ctx");

        processor.process(exchange);

        TenantContext result = exchange.getIn().getBody(TenantContext.class);
        assertNotNull(result);
        assertEquals("tenant-ctx", result.getTenantId());
        assertNotNull(result.getTenant());
        assertEquals("tenant-ctx", result.getTenant().getId());
        assertEquals("Context Tenant", result.getTenant().getName());
        assertEquals("enterprise", result.getTenant().getConfiguration().get("tier"));
    }

    @Test
    @DisplayName("CreateTenantContextProcessor should use tenant ID from header")
    void testCreateTenantContextProcessorHeaderId() throws Exception {
        TenantRouteProcessors.CreateTenantContextProcessor processor =
            new TenantRouteProcessors.CreateTenantContextProcessor();

        Tenant tenant = new Tenant("tenant-body", "Body Tenant");
        exchange.getIn().setBody(tenant);
        exchange.getIn().setHeader("tenantId", "header-tenant-id");

        processor.process(exchange);

        TenantContext result = exchange.getIn().getBody(TenantContext.class);
        assertEquals("header-tenant-id", result.getTenantId());
        assertEquals("tenant-body", result.getTenant().getId());
    }

    @Test
    @DisplayName("CreateTenantContextProcessor should handle null tenant ID header")
    void testCreateTenantContextProcessorNullHeader() throws Exception {
        TenantRouteProcessors.CreateTenantContextProcessor processor =
            new TenantRouteProcessors.CreateTenantContextProcessor();

        Tenant tenant = new Tenant("tenant-only", "Tenant Only");
        exchange.getIn().setBody(tenant);
        // No tenantId header set

        processor.process(exchange);

        TenantContext result = exchange.getIn().getBody(TenantContext.class);
        assertNull(result.getTenantId());
        assertNotNull(result.getTenant());
        assertEquals("tenant-only", result.getTenant().getId());
    }

    @Test
    @DisplayName("All processors should be annotated correctly")
    void testProcessorAnnotations() {
        // Verify InitializeDefaultTenantProcessor annotations
        assertTrue(TenantRouteProcessors.InitializeDefaultTenantProcessor.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.InitializeDefaultTenantProcessor.class
            .isAnnotationPresent(Named.class));
        assertEquals("initializeDefaultTenantProcessor",
            TenantRouteProcessors.InitializeDefaultTenantProcessor.class
                .getAnnotation(Named.class).value());

        // Verify GenerateTenantIdProcessor annotations
        assertTrue(TenantRouteProcessors.GenerateTenantIdProcessor.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.GenerateTenantIdProcessor.class
            .isAnnotationPresent(Named.class));
        assertEquals("generateTenantIdProcessor",
            TenantRouteProcessors.GenerateTenantIdProcessor.class
                .getAnnotation(Named.class).value());

        // Verify CreateTenantObjectProcessor annotations
        assertTrue(TenantRouteProcessors.CreateTenantObjectProcessor.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.CreateTenantObjectProcessor.class
            .isAnnotationPresent(Named.class));
        assertEquals("createTenantObjectProcessor",
            TenantRouteProcessors.CreateTenantObjectProcessor.class
                .getAnnotation(Named.class).value());

        // Verify CreateTenantContextProcessor annotations
        assertTrue(TenantRouteProcessors.CreateTenantContextProcessor.class
            .isAnnotationPresent(ApplicationScoped.class));
        assertTrue(TenantRouteProcessors.CreateTenantContextProcessor.class
            .isAnnotationPresent(Named.class));
        assertEquals("createTenantContextProcessor",
            TenantRouteProcessors.CreateTenantContextProcessor.class
                .getAnnotation(Named.class).value());
    }

    @Test
    @DisplayName("TenantUpdateEnricher should apply name update")
    void testTenantUpdateEnricherApplyNameUpdate() throws Exception {
        TenantUpdateEnricher enricher = new TenantUpdateEnricher();

        // Create existing tenant
        Tenant existing = new Tenant("tenant-123", "Old Name");
        existing.setStatus(Tenant.TenantStatus.ACTIVE);

        // Create exchanges
        Exchange oldExchange = new DefaultExchange(context);
        Map<String, Object> updates = new HashMap<>();
        updates.put("name", "New Name");
        oldExchange.getIn().setBody(updates);

        Exchange newExchange = new DefaultExchange(context);
        newExchange.getIn().setBody(existing);

        // Apply enrichment
        Exchange result = enricher.aggregate(oldExchange, newExchange);

        // Verify
        assertNotNull(result);
        Tenant updated = result.getIn().getBody(Tenant.class);
        assertNotNull(updated);
        assertEquals("New Name", updated.getName());
        assertEquals("tenant-123", updated.getId());
        assertNotNull(updated.getUpdatedAt());
    }

    @Test
    @DisplayName("TenantUpdateEnricher should apply status update")
    void testTenantUpdateEnricherApplyStatusUpdate() throws Exception {
        TenantUpdateEnricher enricher = new TenantUpdateEnricher();

        // Create existing tenant
        Tenant existing = new Tenant("tenant-456", "Test Tenant");
        existing.setStatus(Tenant.TenantStatus.PENDING);

        // Create exchanges
        Exchange oldExchange = new DefaultExchange(context);
        Map<String, Object> updates = new HashMap<>();
        updates.put("status", "ACTIVE");
        oldExchange.getIn().setBody(updates);

        Exchange newExchange = new DefaultExchange(context);
        newExchange.getIn().setBody(existing);

        // Apply enrichment
        Exchange result = enricher.aggregate(oldExchange, newExchange);

        // Verify
        assertNotNull(result);
        Tenant updated = result.getIn().getBody(Tenant.class);
        assertEquals(Tenant.TenantStatus.ACTIVE, updated.getStatus());
        assertEquals("Test Tenant", updated.getName());
    }

    @Test
    @DisplayName("TenantUpdateEnricher should apply configuration update")
    void testTenantUpdateEnricherApplyConfigUpdate() throws Exception {
        TenantUpdateEnricher enricher = new TenantUpdateEnricher();

        // Create existing tenant with config
        Tenant existing = new Tenant("tenant-789", "Config Tenant");
        existing.getConfiguration().put("existingKey", "existingValue");

        // Create exchanges
        Exchange oldExchange = new DefaultExchange(context);
        Map<String, Object> updates = new HashMap<>();
        Map<String, Object> newConfig = new HashMap<>();
        newConfig.put("newKey", "newValue");
        newConfig.put("existingKey", "updatedValue");
        updates.put("configuration", newConfig);
        oldExchange.getIn().setBody(updates);

        Exchange newExchange = new DefaultExchange(context);
        newExchange.getIn().setBody(existing);

        // Apply enrichment
        Exchange result = enricher.aggregate(oldExchange, newExchange);

        // Verify
        assertNotNull(result);
        Tenant updated = result.getIn().getBody(Tenant.class);
        assertEquals("updatedValue", updated.getConfiguration().get("existingKey"));
        assertEquals("newValue", updated.getConfiguration().get("newKey"));
    }

    @Test
    @DisplayName("TenantUpdateEnricher should throw exception when tenant not found")
    void testTenantUpdateEnricherThrowsWhenTenantNotFound() {
        TenantUpdateEnricher enricher = new TenantUpdateEnricher();

        // Create exchanges
        Exchange oldExchange = new DefaultExchange(context);
        Map<String, Object> updates = new HashMap<>();
        updates.put("name", "New Name");
        oldExchange.getIn().setBody(updates);

        Exchange newExchange = new DefaultExchange(context);
        newExchange.getIn().setBody(null); // No tenant found

        // Verify exception
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> enricher.aggregate(oldExchange, newExchange)
        );
        assertEquals("Tenant not found", exception.getMessage());
    }

    @Test
    @DisplayName("TenantUpdateEnricher should apply all updates together")
    void testTenantUpdateEnricherApplyAllUpdates() throws Exception {
        TenantUpdateEnricher enricher = new TenantUpdateEnricher();

        // Create existing tenant
        Tenant existing = new Tenant("tenant-all", "Original Name");
        existing.setStatus(Tenant.TenantStatus.PENDING);

        // Create exchanges with all update types
        Exchange oldExchange = new DefaultExchange(context);
        Map<String, Object> updates = new HashMap<>();
        updates.put("name", "Updated Name");
        updates.put("status", "SUSPENDED");
        Map<String, Object> config = new HashMap<>();
        config.put("tier", "premium");
        updates.put("configuration", config);
        oldExchange.getIn().setBody(updates);

        Exchange newExchange = new DefaultExchange(context);
        newExchange.getIn().setBody(existing);

        // Apply enrichment
        Exchange result = enricher.aggregate(oldExchange, newExchange);

        // Verify all updates
        Tenant updated = result.getIn().getBody(Tenant.class);
        assertEquals("Updated Name", updated.getName());
        assertEquals(Tenant.TenantStatus.SUSPENDED, updated.getStatus());
        assertEquals("premium", updated.getConfiguration().get("tier"));
        assertNotNull(updated.getUpdatedAt());
    }

    @Test
    @DisplayName("TenantUpdateEnricher should verify CDI annotations")
    void testTenantUpdateEnricherCDIAnnotations() {
        assertTrue(TenantUpdateEnricher.class.isAnnotationPresent(Named.class));
        assertTrue(TenantUpdateEnricher.class.isAnnotationPresent(ApplicationScoped.class));
        assertEquals("tenantUpdateEnricher",
            TenantUpdateEnricher.class.getAnnotation(Named.class).value());
    }

    @Test
    @DisplayName("TenantBatchAggregator should return new exchange when old is null")
    void testTenantBatchAggregatorFirstExchange() throws Exception {
        TenantBatchAggregator aggregator = new TenantBatchAggregator();

        Exchange newExchange = new DefaultExchange(context);
        Tenant tenant = new Tenant("batch-1", "Batch Tenant 1");
        newExchange.getIn().setBody(tenant);

        // First aggregation - oldExchange is null
        Exchange result = aggregator.aggregate(null, newExchange);

        assertNotNull(result);
        assertEquals(newExchange, result);
        assertEquals(tenant, result.getIn().getBody());
    }

    @Test
    @DisplayName("TenantBatchAggregator should return old exchange when aggregating")
    void testTenantBatchAggregatorSubsequentExchange() throws Exception {
        TenantBatchAggregator aggregator = new TenantBatchAggregator();

        Exchange oldExchange = new DefaultExchange(context);
        Tenant tenant1 = new Tenant("batch-1", "Batch Tenant 1");
        oldExchange.getIn().setBody(tenant1);

        Exchange newExchange = new DefaultExchange(context);
        Tenant tenant2 = new Tenant("batch-2", "Batch Tenant 2");
        newExchange.getIn().setBody(tenant2);

        // Subsequent aggregation
        Exchange result = aggregator.aggregate(oldExchange, newExchange);

        assertNotNull(result);
        assertEquals(oldExchange, result);
        // Current implementation returns the old exchange
        assertEquals(tenant1, result.getIn().getBody());
    }

    @Test
    @DisplayName("TenantBatchAggregator should verify CDI annotations")
    void testTenantBatchAggregatorCDIAnnotations() {
        assertTrue(TenantBatchAggregator.class.isAnnotationPresent(Named.class));
        assertTrue(TenantBatchAggregator.class.isAnnotationPresent(ApplicationScoped.class));
        assertEquals("tenantBatchAggregator",
            TenantBatchAggregator.class.getAnnotation(Named.class).value());
    }
}