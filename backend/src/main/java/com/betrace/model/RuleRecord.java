package com.betrace.model;

import java.util.Map;

/**
 * Record for storing rule information.
 */
public class RuleRecord {
    public final String id;
    public final String name;
    public final String expression;
    public final int version;
    public final boolean active;
    public final String tenantId;

    public RuleRecord(String id, String name, String expression, int version, boolean active, String tenantId) {
        this.id = id;
        this.name = name;
        this.expression = expression;
        this.version = version;
        this.active = active;
        this.tenantId = tenantId != null ? tenantId : "default";
    }

    public Map<String, Object> toMap() {
        return Map.of(
            "id", id,
            "name", name,
            "expression", expression,
            "version", version,
            "active", active,
            "tenantId", tenantId
        );
    }
}