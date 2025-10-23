package com.fluo.model;

/**
 * Rule evaluation result.
 */
public class RuleResult {
    private boolean matched;
    private String reason;
    private String ruleId;
    private long timestamp;

    public RuleResult() {
        this.timestamp = System.currentTimeMillis();
    }

    public RuleResult(boolean matched, String reason) {
        this();
        this.matched = matched;
        this.reason = reason;
    }

    // Getters and Setters
    public boolean isMatched() {
        return matched;
    }

    public void setMatched(boolean matched) {
        this.matched = matched;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getRuleId() {
        return ruleId;
    }

    public void setRuleId(String ruleId) {
        this.ruleId = ruleId;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    @Override
    public String toString() {
        return "RuleResult{" +
            "matched=" + matched +
            ", reason='" + reason + '\'' +
            ", ruleId='" + ruleId + '\'' +
            ", timestamp=" + timestamp +
            '}';
    }
}