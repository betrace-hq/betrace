package com.fluo.model;

import jakarta.enterprise.context.RequestScoped;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tenant context for holding tenant-specific state during request processing.
 */
@RequestScoped
public class TenantContext {
    private String tenantId;
    private Tenant tenant;
    private String createdAt = Long.toString(System.currentTimeMillis());
    private Map<String, Object> attributes = new ConcurrentHashMap<>();

    // Authentication state (PRD-007c)
    private boolean authenticated = false;
    private String userId;

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

    // === Authentication Methods (PRD-007c) ===

    /**
     * Check if the request is authenticated.
     *
     * @return true if authenticated, false for anonymous requests
     */
    public boolean isAuthenticated() {
        return authenticated;
    }

    /**
     * Mark context as authenticated with user information.
     *
     * @param tenantId Tenant UUID
     * @param userId User identifier (email or ID)
     */
    public void setAuthenticated(String tenantId, String userId) {
        this.authenticated = true;
        this.tenantId = tenantId;
        this.userId = userId;
    }

    /**
     * Mark context as unauthenticated (anonymous request).
     * Sets special anonymous tenant ID.
     */
    public void setUnauthenticated() {
        this.authenticated = false;
        this.tenantId = "00000000-0000-0000-0000-000000000000";  // Anonymous tenant
        this.userId = null;
    }

    /**
     * Get user ID (email or identifier).
     *
     * @return user ID or null for anonymous requests
     */
    public String getUserId() {
        return userId;
    }

    /**
     * Set user ID.
     *
     * @param userId User identifier
     */
    public void setUserId(String userId) {
        this.userId = userId;
    }
}