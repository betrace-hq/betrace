package com.betrace.model;

/**
 * Simple rule model for the route-based approach.
 * No complex dependencies - just a POJO.
 */
public class RuleDefinition {
    private String id;
    private String name;
    private String expression;
    private boolean active = true;
    private int version = 1;
    private long lastAccessed;
    private String tenantId = "default";

    // Constructors
    public RuleDefinition() {}

    public RuleDefinition(String id, String name, String expression) {
        this.id = id;
        this.name = name;
        this.expression = expression;
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

    public String getExpression() {
        return expression;
    }

    public void setExpression(String expression) {
        this.expression = expression;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public long getLastAccessed() {
        return lastAccessed;
    }

    public void setLastAccessed(long lastAccessed) {
        this.lastAccessed = lastAccessed;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    @Override
    public String toString() {
        return "RuleDefinition{" +
            "id='" + id + '\'' +
            ", name='" + name + '\'' +
            ", expression='" + expression + '\'' +
            ", active=" + active +
            ", version=" + version +
            ", tenantId='" + tenantId + '\'' +
            '}';
    }
}