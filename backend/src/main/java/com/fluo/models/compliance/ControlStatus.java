package com.fluo.models.compliance;

/**
 * PRD-004: Control Status
 *
 * Status of a single compliance control (e.g., CC6.1, CC7.2)
 */
public class ControlStatus {

    private String controlId; // "CC6_1", "164.312(a)"
    private String framework; // "soc2", "hipaa"
    private String name; // "Logical Access Controls"
    private String status; // "covered", "partial", "no_evidence"
    private long spanCount; // Number of evidence spans
    private String lastEvidence; // ISO timestamp of last span
    private String description; // Control description

    public ControlStatus() {
    }

    public ControlStatus(String controlId, String framework, String name, String status, long spanCount, String lastEvidence, String description) {
        this.controlId = controlId;
        this.framework = framework;
        this.name = name;
        this.status = status;
        this.spanCount = spanCount;
        this.lastEvidence = lastEvidence;
        this.description = description;
    }

    public String getControlId() {
        return controlId;
    }

    public void setControlId(String controlId) {
        this.controlId = controlId;
    }

    public String getFramework() {
        return framework;
    }

    public void setFramework(String framework) {
        this.framework = framework;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public long getSpanCount() {
        return spanCount;
    }

    public void setSpanCount(long spanCount) {
        this.spanCount = spanCount;
    }

    public String getLastEvidence() {
        return lastEvidence;
    }

    public void setLastEvidence(String lastEvidence) {
        this.lastEvidence = lastEvidence;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
