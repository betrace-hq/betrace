package com.fluo.model;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple tenant model for multi-tenant operations.
 */
public class Tenant {
    private String id;
    private String name;
    private TenantStatus status = TenantStatus.ACTIVE;
    private String createdAt = Long.toString(System.currentTimeMillis());
    private String updatedAt;
    private Map<String, Object> configuration = new ConcurrentHashMap<>();

    public enum TenantStatus {
        ACTIVE,
        SUSPENDED,
        PENDING,
        DISABLED
    }

    // Constructors
    public Tenant() {}

    public Tenant(String id, String name) {
        this.id = id;
        this.name = name;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public TenantStatus getStatus() {
        return status;
    }

    public void setStatus(TenantStatus status) {
        this.status = status;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Map<String, Object> getConfiguration() {
        return configuration;
    }

    public void setConfiguration(Map<String, Object> configuration) {
        this.configuration = configuration;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> map = new ConcurrentHashMap<>();
        map.put("id", id);
        map.put("name", name);
        map.put("status", status.toString());
        map.put("createdAt", createdAt);
        if (updatedAt != null) {
            map.put("updatedAt", updatedAt);
        }
        map.put("configuration", configuration);
        return map;
    }
}