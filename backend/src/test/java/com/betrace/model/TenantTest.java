package com.fluo.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Tenant model.
 */
@DisplayName("Tenant Model Test")
class TenantTest {

    @Test
    @DisplayName("Should create tenant with default constructor")
    void testDefaultConstructor() {
        // When: Creating tenant with default constructor
        Tenant tenant = new Tenant();

        // Then: Should have default values
        assertNull(tenant.getId());
        assertNull(tenant.getName());
        assertEquals(Tenant.TenantStatus.ACTIVE, tenant.getStatus());
        assertNotNull(tenant.getCreatedAt());
        assertNull(tenant.getUpdatedAt());
        assertNotNull(tenant.getConfiguration());
        assertTrue(tenant.getConfiguration().isEmpty());
    }

    @Test
    @DisplayName("Should create tenant with ID and name")
    void testConstructorWithIdAndName() {
        // When: Creating tenant with ID and name
        Tenant tenant = new Tenant("tenant-123", "Test Tenant");

        // Then: Should set ID and name
        assertEquals("tenant-123", tenant.getId());
        assertEquals("Test Tenant", tenant.getName());
        assertEquals(Tenant.TenantStatus.ACTIVE, tenant.getStatus());
        assertNotNull(tenant.getCreatedAt());
    }

    @Test
    @DisplayName("Should set and get all properties")
    void testSettersAndGetters() {
        // Given: A tenant
        Tenant tenant = new Tenant();

        // When: Setting all properties
        tenant.setId("test-id");
        tenant.setName("Test Name");
        tenant.setStatus(Tenant.TenantStatus.SUSPENDED);
        tenant.setCreatedAt("1234567890");
        tenant.setUpdatedAt("1234567899");

        Map<String, Object> config = new ConcurrentHashMap<>();
        config.put("tier", "premium");
        tenant.setConfiguration(config);

        // Then: Should get correct values
        assertEquals("test-id", tenant.getId());
        assertEquals("Test Name", tenant.getName());
        assertEquals(Tenant.TenantStatus.SUSPENDED, tenant.getStatus());
        assertEquals("1234567890", tenant.getCreatedAt());
        assertEquals("1234567899", tenant.getUpdatedAt());
        assertEquals(1, tenant.getConfiguration().size());
        assertEquals("premium", tenant.getConfiguration().get("tier"));
    }

    @Test
    @DisplayName("Should handle configuration map")
    void testConfiguration() {
        // Given: A tenant
        Tenant tenant = new Tenant();

        // When: Adding configuration
        tenant.getConfiguration().put("tier", "enterprise");
        tenant.getConfiguration().put("maxUsers", 1000);
        tenant.getConfiguration().put("features", "advanced");

        // Then: Should store configuration
        assertEquals("enterprise", tenant.getConfiguration().get("tier"));
        assertEquals(1000, tenant.getConfiguration().get("maxUsers"));
        assertEquals("advanced", tenant.getConfiguration().get("features"));
        assertEquals(3, tenant.getConfiguration().size());
    }

    @Test
    @DisplayName("Should convert tenant to map")
    void testToMap() {
        // Given: A tenant with all properties
        Tenant tenant = new Tenant("map-test", "Map Test Tenant");
        tenant.setStatus(Tenant.TenantStatus.PENDING);
        tenant.setUpdatedAt("9999999999");
        tenant.getConfiguration().put("key", "value");

        // When: Converting to map
        Map<String, Object> map = tenant.toMap();

        // Then: Map should contain all properties
        assertNotNull(map);
        assertEquals("map-test", map.get("id"));
        assertEquals("Map Test Tenant", map.get("name"));
        assertEquals("PENDING", map.get("status"));
        assertNotNull(map.get("createdAt"));
        assertEquals("9999999999", map.get("updatedAt"));

        @SuppressWarnings("unchecked")
        Map<String, Object> config = (Map<String, Object>) map.get("configuration");
        assertNotNull(config);
        assertEquals("value", config.get("key"));
    }

    @Test
    @DisplayName("Should handle toMap without updatedAt")
    void testToMapWithoutUpdatedAt() {
        // Given: A tenant without updatedAt
        Tenant tenant = new Tenant("test", "Test");

        // When: Converting to map
        Map<String, Object> map = tenant.toMap();

        // Then: Map should not have updatedAt
        assertNotNull(map);
        assertEquals("test", map.get("id"));
        assertFalse(map.containsKey("updatedAt"));
    }

    @Test
    @DisplayName("Should test all tenant status values")
    void testTenantStatuses() {
        // Then: All status values should exist
        assertNotNull(Tenant.TenantStatus.ACTIVE);
        assertNotNull(Tenant.TenantStatus.SUSPENDED);
        assertNotNull(Tenant.TenantStatus.PENDING);
        assertNotNull(Tenant.TenantStatus.DISABLED);

        // Verify enum values
        Tenant.TenantStatus[] statuses = Tenant.TenantStatus.values();
        assertEquals(4, statuses.length);
    }

    @Test
    @DisplayName("Should handle status changes")
    void testStatusChanges() {
        // Given: A tenant
        Tenant tenant = new Tenant();

        // When/Then: Changing status
        assertEquals(Tenant.TenantStatus.ACTIVE, tenant.getStatus());

        tenant.setStatus(Tenant.TenantStatus.SUSPENDED);
        assertEquals(Tenant.TenantStatus.SUSPENDED, tenant.getStatus());

        tenant.setStatus(Tenant.TenantStatus.PENDING);
        assertEquals(Tenant.TenantStatus.PENDING, tenant.getStatus());

        tenant.setStatus(Tenant.TenantStatus.DISABLED);
        assertEquals(Tenant.TenantStatus.DISABLED, tenant.getStatus());

        tenant.setStatus(Tenant.TenantStatus.ACTIVE);
        assertEquals(Tenant.TenantStatus.ACTIVE, tenant.getStatus());
    }

    @Test
    @DisplayName("Should replace configuration map")
    void testReplaceConfiguration() {
        // Given: A tenant with configuration
        Tenant tenant = new Tenant();
        tenant.getConfiguration().put("old", "value");

        // When: Replacing configuration
        Map<String, Object> newConfig = new ConcurrentHashMap<>();
        newConfig.put("new", "config");
        tenant.setConfiguration(newConfig);

        // Then: Should have new configuration
        assertFalse(tenant.getConfiguration().containsKey("old"));
        assertTrue(tenant.getConfiguration().containsKey("new"));
        assertEquals("config", tenant.getConfiguration().get("new"));
    }
}