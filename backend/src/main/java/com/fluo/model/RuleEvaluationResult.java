package com.fluo.model;

import java.time.Instant;
import java.util.Map;
import java.util.HashMap;
import java.util.Objects;

/**
 * Result of rule evaluation on a signal.
 */
public final class RuleEvaluationResult {
    private final String signalId;
    private final String ruleId;
    private final boolean matched;
    private final Object result;
    private final Map<String, Object> metadata;
    private final Instant evaluatedAt;
    private final long evaluationTimeMs;

    public RuleEvaluationResult(
        String signalId,
        String ruleId,
        boolean matched,
        Object result,
        Map<String, Object> metadata,
        Instant evaluatedAt,
        long evaluationTimeMs
    ) {
        this.signalId = signalId;
        this.ruleId = ruleId;
        this.matched = matched;
        this.result = result;
        this.metadata = metadata;
        this.evaluatedAt = evaluatedAt;
        this.evaluationTimeMs = evaluationTimeMs;
    }

    /**
     * Create a successful evaluation result
     */
    public static RuleEvaluationResult success(
        String signalId,
        String ruleId,
        boolean matched,
        Object result,
        long evaluationTimeMs
    ) {
        Map<String, Object> meta = new HashMap<>();
        meta.put("status", "success");

        return new RuleEvaluationResult(
            signalId,
            ruleId,
            matched,
            result,
            meta,
            Instant.now(),
            evaluationTimeMs
        );
    }

    /**
     * Create a failed evaluation result
     */
    public static RuleEvaluationResult failure(
        String signalId,
        String ruleId,
        String error,
        long evaluationTimeMs
    ) {
        Map<String, Object> meta = new HashMap<>();
        meta.put("status", "failed");
        meta.put("error", error);

        return new RuleEvaluationResult(
            signalId,
            ruleId,
            false,
            null,
            meta,
            Instant.now(),
            evaluationTimeMs
        );
    }

    // Getters
    public String signalId() { return signalId; }
    public String ruleId() { return ruleId; }
    public boolean matched() { return matched; }
    public Object result() { return result; }
    public Map<String, Object> metadata() { return metadata; }
    public Instant evaluatedAt() { return evaluatedAt; }
    public long evaluationTimeMs() { return evaluationTimeMs; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RuleEvaluationResult that = (RuleEvaluationResult) o;
        return matched == that.matched &&
            evaluationTimeMs == that.evaluationTimeMs &&
            Objects.equals(signalId, that.signalId) &&
            Objects.equals(ruleId, that.ruleId) &&
            Objects.equals(result, that.result) &&
            Objects.equals(metadata, that.metadata) &&
            Objects.equals(evaluatedAt, that.evaluatedAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(signalId, ruleId, matched, result, metadata, evaluatedAt, evaluationTimeMs);
    }

    @Override
    public String toString() {
        return "RuleEvaluationResult{" +
            "signalId='" + signalId + '\'' +
            ", ruleId='" + ruleId + '\'' +
            ", matched=" + matched +
            ", result=" + result +
            ", metadata=" + metadata +
            ", evaluatedAt=" + evaluatedAt +
            ", evaluationTimeMs=" + evaluationTimeMs +
            '}';
    }
}