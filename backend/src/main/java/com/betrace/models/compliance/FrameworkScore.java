package com.betrace.models.compliance;

/**
 * PRD-004: Framework Compliance Score
 *
 * Aggregate coverage score for a compliance framework (SOC2, HIPAA, etc.)
 */
public class FrameworkScore {

    private String framework; // "soc2", "hipaa"
    private int coveragePercent; // 0-100
    private int coveredControls; // Number of controls with evidence
    private int totalControls; // Total controls in framework

    public FrameworkScore() {
    }

    public FrameworkScore(String framework, int coveragePercent, int coveredControls, int totalControls) {
        this.framework = framework;
        this.coveragePercent = coveragePercent;
        this.coveredControls = coveredControls;
        this.totalControls = totalControls;
    }

    public String getFramework() {
        return framework;
    }

    public void setFramework(String framework) {
        this.framework = framework;
    }

    public int getCoveragePercent() {
        return coveragePercent;
    }

    public void setCoveragePercent(int coveragePercent) {
        this.coveragePercent = coveragePercent;
    }

    public int getCoveredControls() {
        return coveredControls;
    }

    public void setCoveredControls(int coveredControls) {
        this.coveredControls = coveredControls;
    }

    public int getTotalControls() {
        return totalControls;
    }

    public void setTotalControls(int totalControls) {
        this.totalControls = totalControls;
    }
}
