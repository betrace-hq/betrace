package com.fluo.models.compliance;

/**
 * PRD-004 Phase 2: Evidence Span
 *
 * Individual compliance span record for drill-down view.
 */
public class EvidenceSpan {

    private String timestamp;
    private String framework;
    private String control;
    private String evidenceType; // "audit_trail", "access_control", etc.
    private String outcome; // "success", "failure"
    private String traceId;
    private String spanId;
    private String tenantId;
    private String operation; // Optional: operation that generated span

    public EvidenceSpan() {
    }

    public EvidenceSpan(String timestamp, String framework, String control, String evidenceType,
                       String outcome, String traceId, String spanId, String tenantId, String operation) {
        this.timestamp = timestamp;
        this.framework = framework;
        this.control = control;
        this.evidenceType = evidenceType;
        this.outcome = outcome;
        this.traceId = traceId;
        this.spanId = spanId;
        this.tenantId = tenantId;
        this.operation = operation;
    }

    // Getters and setters
    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getFramework() {
        return framework;
    }

    public void setFramework(String framework) {
        this.framework = framework;
    }

    public String getControl() {
        return control;
    }

    public void setControl(String control) {
        this.control = control;
    }

    public String getEvidenceType() {
        return evidenceType;
    }

    public void setEvidenceType(String evidenceType) {
        this.evidenceType = evidenceType;
    }

    public String getOutcome() {
        return outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getSpanId() {
        return spanId;
    }

    public void setSpanId(String spanId) {
        this.spanId = spanId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getOperation() {
        return operation;
    }

    public void setOperation(String operation) {
        this.operation = operation;
    }
}
