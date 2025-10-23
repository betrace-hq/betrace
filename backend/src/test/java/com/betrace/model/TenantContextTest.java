package com.betrace.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TenantContext Model Tests")
class TenantContextTest {

    private TenantContext context;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        context = new TenantContext();
        tenant = new Tenant("test-tenant", "Test Tenant");
    }

    @Test
    @DisplayName("Should create empty context with default constructor")
    void testDefaultConstructor() {
        TenantContext ctx = new TenantContext();

        assertNull(ctx.getTenantId());
        assertNull(ctx.getTenant());
        assertNotNull(ctx.getCreatedAt());
        assertNotNull(ctx.getAttributes());
        assertTrue(ctx.getAttributes().isEmpty());
    }

    @Test
    @DisplayName("Should create context with tenant ID and tenant object")
    void testParameterizedConstructor() {
        TenantContext ctx = new TenantContext("tenant-123", tenant);

        assertEquals("tenant-123", ctx.getTenantId());
        assertEquals(tenant, ctx.getTenant());
        assertNotNull(ctx.getCreatedAt());
        assertNotNull(ctx.getAttributes());
        assertTrue(ctx.getAttributes().isEmpty());
    }

    @Test
    @DisplayName("Should set and get tenant ID")
    void testSetAndGetTenantId() {
        context.setTenantId("new-tenant-id");
        assertEquals("new-tenant-id", context.getTenantId());

        context.setTenantId(null);
        assertNull(context.getTenantId());
    }

    @Test
    @DisplayName("Should set and get tenant object")
    void testSetAndGetTenant() {
        context.setTenant(tenant);
        assertEquals(tenant, context.getTenant());

        context.setTenant(null);
        assertNull(context.getTenant());
    }

    @Test
    @DisplayName("Should set and get createdAt timestamp")
    void testSetAndGetCreatedAt() {
        String timestamp = "1234567890";
        context.setCreatedAt(timestamp);
        assertEquals(timestamp, context.getCreatedAt());

        context.setCreatedAt(null);
        assertNull(context.getCreatedAt());
    }

    @Test
    @DisplayName("Should have default createdAt timestamp on creation")
    void testDefaultCreatedAtTimestamp() {
        TenantContext ctx = new TenantContext();
        assertNotNull(ctx.getCreatedAt());

        // Should be a valid timestamp string
        long timestamp = Long.parseLong(ctx.getCreatedAt());
        assertTrue(timestamp > 0);

        // Should be recent (within last minute)
        long now = System.currentTimeMillis();
        assertTrue(Math.abs(now - timestamp) < 60000);
    }

    @Test
    @DisplayName("Should set and get attributes map")
    void testSetAndGetAttributes() {
        Map<String, Object> attrs = new ConcurrentHashMap<>();
        attrs.put("key1", "value1");
        attrs.put("key2", 42);

        context.setAttributes(attrs);
        assertEquals(attrs, context.getAttributes());
        assertEquals(2, context.getAttributes().size());
        assertEquals("value1", context.getAttributes().get("key1"));
        assertEquals(42, context.getAttributes().get("key2"));
    }

    @Test
    @DisplayName("Should set individual attribute")
    void testSetAttribute() {
        context.setAttribute("testKey", "testValue");
        context.setAttribute("numKey", 123);
        context.setAttribute("boolKey", true);

        assertEquals("testValue", context.getAttribute("testKey"));
        assertEquals(123, context.getAttribute("numKey"));
        assertEquals(true, context.getAttribute("boolKey"));
        assertEquals(3, context.getAttributes().size());
    }

    @Test
    @DisplayName("Should get individual attribute")
    void testGetAttribute() {
        context.setAttribute("existingKey", "existingValue");

        assertEquals("existingValue", context.getAttribute("existingKey"));
        assertNull(context.getAttribute("nonExistingKey"));
    }

    @Test
    @DisplayName("Should handle null attribute key and value")
    void testNullAttributeHandling() {
        // ConcurrentHashMap doesn't allow null values, so this should throw
        assertThrows(NullPointerException.class, () -> {
            context.setAttribute("nullKey", null);
        });

        // ConcurrentHashMap doesn't allow null keys, so this should throw
        assertThrows(NullPointerException.class, () -> {
            context.setAttribute(null, "value");
        });

        // Getting null key also throws with ConcurrentHashMap
        assertThrows(NullPointerException.class, () -> {
            context.getAttribute(null);
        });
    }

    @Test
    @DisplayName("Should override existing attribute")
    void testAttributeOverride() {
        context.setAttribute("key", "original");
        assertEquals("original", context.getAttribute("key"));

        context.setAttribute("key", "updated");
        assertEquals("updated", context.getAttribute("key"));

        // ConcurrentHashMap doesn't allow null values, so this should throw
        assertThrows(NullPointerException.class, () -> {
            context.setAttribute("key", null);
        });
    }

    @Test
    @DisplayName("Should convert to map without tenant")
    void testToMapWithoutTenant() {
        context.setTenantId("ctx-123");
        context.setCreatedAt("1234567890");
        context.setAttribute("attr1", "value1");
        context.setAttribute("attr2", 42);

        Map<String, Object> map = context.toMap();

        assertNotNull(map);
        assertEquals("ctx-123", map.get("tenantId"));
        assertEquals("1234567890", map.get("createdAt"));
        assertNotNull(map.get("attributes"));
        assertFalse(map.containsKey("tenant"));

        @SuppressWarnings("unchecked")
        Map<String, Object> attrs = (Map<String, Object>) map.get("attributes");
        assertEquals("value1", attrs.get("attr1"));
        assertEquals(42, attrs.get("attr2"));
    }

    @Test
    @DisplayName("Should convert to map with tenant")
    void testToMapWithTenant() {
        context.setTenantId("ctx-456");
        context.setCreatedAt("9876543210");
        context.setTenant(tenant);
        context.setAttribute("key", "value");

        Map<String, Object> map = context.toMap();

        assertNotNull(map);
        assertEquals("ctx-456", map.get("tenantId"));
        assertEquals("9876543210", map.get("createdAt"));
        assertNotNull(map.get("tenant"));
        assertNotNull(map.get("attributes"));

        @SuppressWarnings("unchecked")
        Map<String, Object> tenantMap = (Map<String, Object>) map.get("tenant");
        assertNotNull(tenantMap);
        assertEquals("test-tenant", tenantMap.get("id"));
        assertEquals("Test Tenant", tenantMap.get("name"));

        @SuppressWarnings("unchecked")
        Map<String, Object> attrs = (Map<String, Object>) map.get("attributes");
        assertEquals("value", attrs.get("key"));
    }

    @Test
    @DisplayName("Should handle null values in toMap")
    void testToMapWithNullValues() {
        // ConcurrentHashMap doesn't allow null values, so toMap() will fail if tenantId is null
        context.setTenantId(null);

        assertThrows(NullPointerException.class, () -> {
            context.toMap();
        });

        // Test with valid tenantId but null tenant
        context.setTenantId("valid-tenant");
        Map<String, Object> map = context.toMap();

        assertNotNull(map);
        assertEquals("valid-tenant", map.get("tenantId"));
        assertNotNull(map.get("createdAt")); // Has default value
        assertNotNull(map.get("attributes")); // Empty map
        assertFalse(map.containsKey("tenant")); // null tenant not included
    }

    @Test
    @DisplayName("Should create independent map copies")
    void testToMapCreatesIndependentCopy() {
        context.setTenantId("original");
        context.setAttribute("key", "value");

        Map<String, Object> map1 = context.toMap();
        Map<String, Object> map2 = context.toMap();

        // Maps should be equal but not the same instance
        assertNotSame(map1, map2);
        assertEquals(map1, map2);

        // Modifying one shouldn't affect the other
        map1.put("tenantId", "modified");
        assertEquals("original", map2.get("tenantId"));
    }

    @Test
    @DisplayName("Should use ConcurrentHashMap for thread safety")
    void testThreadSafeAttributes() {
        // Verify attributes is ConcurrentHashMap
        assertTrue(context.getAttributes() instanceof ConcurrentHashMap);

        // Verify toMap creates ConcurrentHashMap (need valid tenantId to avoid NPE)
        context.setTenantId("test-tenant");
        Map<String, Object> map = context.toMap();
        assertTrue(map instanceof ConcurrentHashMap);
    }
}