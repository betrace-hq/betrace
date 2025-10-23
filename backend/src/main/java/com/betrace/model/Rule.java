package com.betrace.model;

import java.time.Instant;
import java.util.Map;
import java.util.HashMap;
import java.util.Objects;

/**
 * Rule domain model for signal evaluation.
 */
public final class Rule {
    private final String id;
    private final String name;
    private final String version;
    private final String expression;
    private final RuleType type;
    private final Map<String, Object> metadata;
    private final boolean active;
    private final Instant createdAt;
    private final Instant updatedAt;

    public Rule(
        String id,
        String name,
        String version,
        String expression,
        RuleType type,
        Map<String, Object> metadata,
        boolean active,
        Instant createdAt,
        Instant updatedAt
    ) {
        this.id = id;
        this.name = name;
        this.version = version;
        this.expression = expression;
        this.type = type;
        this.metadata = metadata;
        this.active = active;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public enum RuleType {
        OGNL,
        JAVASCRIPT,
        PYTHON,
        CEL
    }

    /**
     * Create a new rule
     */
    public static Rule create(
        String id,
        String name,
        String version,
        String expression,
        RuleType type
    ) {
        Instant now = Instant.now();
        return new Rule(
            id,
            name,
            version,
            expression,
            type,
            new HashMap<>(),
            true,
            now,
            now
        );
    }

    // Getters
    public String id() { return id; }
    public String name() { return name; }
    public String version() { return version; }
    public String expression() { return expression; }
    public RuleType type() { return type; }
    public Map<String, Object> metadata() { return metadata; }
    public boolean active() { return active; }
    public Instant createdAt() { return createdAt; }
    public Instant updatedAt() { return updatedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Rule rule = (Rule) o;
        return active == rule.active &&
            Objects.equals(id, rule.id) &&
            Objects.equals(name, rule.name) &&
            Objects.equals(version, rule.version) &&
            Objects.equals(expression, rule.expression) &&
            type == rule.type &&
            Objects.equals(metadata, rule.metadata) &&
            Objects.equals(createdAt, rule.createdAt) &&
            Objects.equals(updatedAt, rule.updatedAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, version, expression, type, metadata, active, createdAt, updatedAt);
    }

    @Override
    public String toString() {
        return "Rule{" +
            "id='" + id + '\'' +
            ", name='" + name + '\'' +
            ", version='" + version + '\'' +
            ", expression='" + expression + '\'' +
            ", type=" + type +
            ", metadata=" + metadata +
            ", active=" + active +
            ", createdAt=" + createdAt +
            ", updatedAt=" + updatedAt +
            '}';
    }
}