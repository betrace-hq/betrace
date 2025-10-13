package com.fluo.models.compliance;

import java.util.List;

/**
 * PRD-004: Compliance Summary Response
 *
 * Top-level summary of compliance posture across all frameworks.
 */
public class ComplianceSummary {

    private List<FrameworkScore> frameworkScores;
    private List<ControlStatus> controls;
    private long totalSpans;
    private String lastUpdated;

    public ComplianceSummary() {
    }

    public ComplianceSummary(List<FrameworkScore> frameworkScores, List<ControlStatus> controls, long totalSpans, String lastUpdated) {
        this.frameworkScores = frameworkScores;
        this.controls = controls;
        this.totalSpans = totalSpans;
        this.lastUpdated = lastUpdated;
    }

    public List<FrameworkScore> getFrameworkScores() {
        return frameworkScores;
    }

    public void setFrameworkScores(List<FrameworkScore> frameworkScores) {
        this.frameworkScores = frameworkScores;
    }

    public List<ControlStatus> getControls() {
        return controls;
    }

    public void setControls(List<ControlStatus> controls) {
        this.controls = controls;
    }

    public long getTotalSpans() {
        return totalSpans;
    }

    public void setTotalSpans(long totalSpans) {
        this.totalSpans = totalSpans;
    }

    public String getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(String lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
}
