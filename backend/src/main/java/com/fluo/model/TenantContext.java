package com.fluo.model;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tenant context for holding tenant-specific state during request processing.
 */
public class TenantContext {
    private String tenantId;
    private Tenant tenant;
    private String createdAt = Long.toString(System.currentTimeMillis());
    private Map<String, Object> attributes = new ConcurrentHashMap<>();

    // Constructors
    public TenantContext() {}

    public TenantContext(String tenantId, Tenant tenant) {
        this.tenantId = tenantId;
        this.tenant = tenant;
    }

    // Getters and Setters
    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public Tenant getTenant() {
        return tenant;
    }

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public Map<String, Object> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, Object> attributes) {
        this.attributes = attributes;
    }

    public void setAttribute(String key, Object value) {
        attributes.put(key, value);
    }

    public Object getAttribute(String key) {
        return attributes.get(key);
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new ConcurrentHashMap<>();
        map.put("tenantId", tenantId);
        map.put("createdAt", createdAt);
        map.put("attributes", attributes);
        if (tenant != null) {
            map.put("tenant", tenant.toMap());
        }
        return map;
    }
}