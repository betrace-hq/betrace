package com.fluo.compliance.telemetry;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributeKey;
import com.fluo.compliance.annotations.ComplianceControl;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * OpenTelemetry-based compliance tracking using spans and metrics
 * Integrates with Grafana Tempo (traces) and Prometheus (metrics)
 */
@ApplicationScoped
public class ComplianceSpanProcessor {

    private static final Logger logger = LoggerFactory.getLogger(ComplianceSpanProcessor.class);

    // OpenTelemetry components
    private final Tracer tracer;
    private final Meter meter;

    // Span attribute keys for compliance data
    public static final AttributeKey<String> COMPLIANCE_FRAMEWORK = AttributeKey.stringKey("compliance.framework");
    public static final AttributeKey<String> COMPLIANCE_CONTROL = AttributeKey.stringKey("compliance.control");
    public static final AttributeKey<String> COMPLIANCE_CONTROL_NAME = AttributeKey.stringKey("compliance.control.name");
    public static final AttributeKey<String> COMPLIANCE_STATUS = AttributeKey.stringKey("compliance.status");
    public static final AttributeKey<String> COMPLIANCE_PRIORITY = AttributeKey.stringKey("compliance.priority");
    public static final AttributeKey<Boolean> COMPLIANCE_SENSITIVE_DATA = AttributeKey.booleanKey("compliance.sensitive_data");
    public static final AttributeKey<Long> COMPLIANCE_RETENTION_DAYS = AttributeKey.longKey("compliance.retention_days");
    public static final AttributeKey<String> COMPLIANCE_EVIDENCE_ID = AttributeKey.stringKey("compliance.evidence.id");
    public static final AttributeKey<String> COMPLIANCE_USER_ID = AttributeKey.stringKey("compliance.user.id");
    public static final AttributeKey<String> COMPLIANCE_TENANT_ID = AttributeKey.stringKey("compliance.tenant.id");
    public static final AttributeKey<String> COMPLIANCE_OPERATION = AttributeKey.stringKey("compliance.operation");
    public static final AttributeKey<String> COMPLIANCE_OUTCOME = AttributeKey.stringKey("compliance.outcome");

    // Metrics for compliance SLIs
    private final LongCounter complianceEventsCounter;
    private final LongCounter complianceViolationsCounter;
    private final LongCounter sensitiveDataAccessCounter;
    private final Map<String, LongCounter> frameworkCounters = new ConcurrentHashMap<>();

    public ComplianceSpanProcessor() {
        // Initialize OpenTelemetry
        this.tracer = GlobalOpenTelemetry.getTracer("fluo-compliance", "1.0.0");
        this.meter = GlobalOpenTelemetry.getMeter("fluo-compliance");

        // Initialize metrics
        this.complianceEventsCounter = meter.counterBuilder("compliance.events.total")
            .setDescription("Total number of compliance events tracked")
            .setUnit("events")
            .build();

        this.complianceViolationsCounter = meter.counterBuilder("compliance.violations.total")
            .setDescription("Total number of compliance violations detected")
            .setUnit("violations")
            .build();

        this.sensitiveDataAccessCounter = meter.counterBuilder("compliance.sensitive_data.access")
            .setDescription("Number of sensitive data access operations")
            .setUnit("operations")
            .build();

        logger.info("ComplianceSpanProcessor initialized with OpenTelemetry");
    }

    /**
     * Start a compliance span for a controlled operation
     */
    public ComplianceSpan startComplianceSpan(String operationName, ComplianceControl annotation) {
        // Create parent span for the compliance operation
        Span span = tracer.spanBuilder(operationName)
            .setSpanKind(SpanKind.INTERNAL)
            .setAttribute("service.name", "fluo-backend")
            .setAttribute("service.version", "1.0.0")
            .setAttribute(COMPLIANCE_OPERATION, operationName)
            .setAttribute(COMPLIANCE_EVIDENCE_ID, generateEvidenceId())
            .setAttribute(COMPLIANCE_PRIORITY, annotation.priority().toString())
            .setAttribute(COMPLIANCE_SENSITIVE_DATA, annotation.sensitiveData())
            .setAttribute(COMPLIANCE_RETENTION_DAYS, annotation.retentionDays())
            .startSpan();

        // Add framework-specific spans as children
        addFrameworkSpans(span, annotation);

        // Increment metrics
        complianceEventsCounter.add(1,
            Attributes.builder()
                .put("operation", operationName)
                .put("priority", annotation.priority().toString())
                .build());

        if (annotation.sensitiveData()) {
            sensitiveDataAccessCounter.add(1,
                Attributes.builder()
                    .put("operation", operationName)
                    .build());
        }

        return new ComplianceSpan(span, operationName);
    }

    /**
     * Add framework-specific child spans with control details
     */
    private void addFrameworkSpans(Span parentSpan, ComplianceControl annotation) {
        // SOC 2 controls
        for (String control : annotation.soc2()) {
            if (!control.isEmpty()) {
                createControlSpan(parentSpan, "SOC2", control, getSOC2ControlName(control));
            }
        }

        // HIPAA safeguards
        for (String safeguard : annotation.hipaa()) {
            if (!safeguard.isEmpty()) {
                createControlSpan(parentSpan, "HIPAA", safeguard, getHIPAAControlName(safeguard));
            }
        }

        // FedRAMP controls
        for (String control : annotation.fedramp()) {
            if (!control.isEmpty()) {
                String fullControl = annotation.fedrampLevel() + "." + control;
                createControlSpan(parentSpan, "FedRAMP", fullControl, getFedRAMPControlName(control));
            }
        }

        // ISO 27001 controls
        for (String control : annotation.iso27001()) {
            if (!control.isEmpty()) {
                createControlSpan(parentSpan, "ISO27001", control, getISO27001ControlName(control));
            }
        }

        // PCI-DSS requirements
        for (String requirement : annotation.pcidss()) {
            if (!requirement.isEmpty()) {
                createControlSpan(parentSpan, "PCI-DSS", requirement, getPCIDSSControlName(requirement));
            }
        }
    }

    /**
     * Create a child span for a specific control
     */
    private void createControlSpan(Span parentSpan, String framework, String control, String controlName) {
        Span controlSpan = tracer.spanBuilder(framework + "." + control)
            .setParent(io.opentelemetry.context.Context.current().with(parentSpan))
            .setSpanKind(SpanKind.INTERNAL)
            .setAttribute(COMPLIANCE_FRAMEWORK, framework)
            .setAttribute(COMPLIANCE_CONTROL, control)
            .setAttribute(COMPLIANCE_CONTROL_NAME, controlName)
            .setAttribute(COMPLIANCE_STATUS, "TRACKING")
            .setAttribute("span.type", "compliance.control")
            .startSpan();

        // Add control-specific attributes
        addControlSpecificAttributes(controlSpan, framework, control);

        // Auto-close the control span as it's just for tracking
        controlSpan.end();

        // Increment framework-specific counter
        getFrameworkCounter(framework).add(1,
            Attributes.builder()
                .put("control", control)
                .put("control_name", controlName)
                .build());
    }

    /**
     * Add control-specific attributes based on framework and control
     */
    private void addControlSpecificAttributes(Span span, String framework, String control) {
        switch (framework) {
            case "SOC2":
                span.setAttribute("soc2.trust_service_criteria", getTrustServiceCategory(control));
                span.setAttribute("soc2.control_objective", getControlObjective(framework, control));
                break;
            case "HIPAA":
                span.setAttribute("hipaa.safeguard_type", getHIPAASafeguardType(control));
                span.setAttribute("hipaa.implementation_spec", getImplementationSpec(control));
                break;
            case "FedRAMP":
                span.setAttribute("fedramp.control_family", getControlFamily(control));
                span.setAttribute("fedramp.nist_800_53", true);
                break;
            case "ISO27001":
                span.setAttribute("iso27001.annex_a", true);
                span.setAttribute("iso27001.control_category", getISO27001Category(control));
                break;
            case "PCI-DSS":
                span.setAttribute("pcidss.requirement_category", getPCIDSSCategory(control));
                span.setAttribute("pcidss.version", "4.0");
                break;
        }
    }

    /**
     * Complete a compliance span with outcome
     */
    public void completeComplianceSpan(ComplianceSpan complianceSpan, boolean success, String outcome, Map<String, Object> additionalData) {
        Span span = complianceSpan.getSpan();

        // Set completion attributes
        span.setAttribute(COMPLIANCE_STATUS, success ? "SUCCESS" : "FAILED");
        span.setAttribute(COMPLIANCE_OUTCOME, outcome);

        // Add any additional data as span attributes
        if (additionalData != null) {
            for (Map.Entry<String, Object> entry : additionalData.entrySet()) {
                String key = "compliance.data." + entry.getKey();
                Object value = entry.getValue();
                if (value instanceof String) {
                    span.setAttribute(key, (String) value);
                } else if (value instanceof Boolean) {
                    span.setAttribute(key, (Boolean) value);
                } else if (value instanceof Long) {
                    span.setAttribute(key, (Long) value);
                } else if (value instanceof Double) {
                    span.setAttribute(key, (Double) value);
                } else {
                    span.setAttribute(key, String.valueOf(value));
                }
            }
        }

        // Set span status
        if (success) {
            span.setStatus(StatusCode.OK, outcome);
        } else {
            span.setStatus(StatusCode.ERROR, outcome);
            // Increment violation counter
            complianceViolationsCounter.add(1,
                Attributes.builder()
                    .put("operation", complianceSpan.getOperationName())
                    .put("outcome", outcome)
                    .build());
        }

        // End the span
        span.end();
    }

    /**
     * Create a span for tenant isolation verification
     */
    public Span createTenantIsolationSpan(String userId, String tenantId, boolean accessGranted) {
        Span span = tracer.spanBuilder("compliance.tenant.isolation")
            .setSpanKind(SpanKind.INTERNAL)
            .setAttribute(COMPLIANCE_FRAMEWORK, "SOC2")
            .setAttribute(COMPLIANCE_CONTROL, "CC6.3")
            .setAttribute(COMPLIANCE_CONTROL_NAME, "Data Isolation")
            .setAttribute(COMPLIANCE_USER_ID, userId)
            .setAttribute(COMPLIANCE_TENANT_ID, tenantId)
            .setAttribute("tenant.access.granted", accessGranted)
            .setAttribute("tenant.isolation.enforced", !accessGranted)
            .startSpan();

        if (!accessGranted) {
            span.addEvent("Cross-tenant access denied",
                Attributes.builder()
                    .put("security.event", "access_denied")
                    .put("security.severity", "medium")
                    .build());
        }

        return span;
    }

    /**
     * Create a span for encryption operations
     */
    public Span createEncryptionSpan(String algorithm, int keySize, boolean fipsValidated) {
        return tracer.spanBuilder("compliance.encryption")
            .setSpanKind(SpanKind.INTERNAL)
            .setAttribute(COMPLIANCE_FRAMEWORK, "Multi")
            .setAttribute(COMPLIANCE_CONTROL, "Encryption")
            .setAttribute("encryption.algorithm", algorithm)
            .setAttribute("encryption.key_size", (long) keySize)
            .setAttribute("encryption.fips_validated", fipsValidated)
            .setAttribute("encryption.operation", "encrypt")
            .startSpan();
    }

    /**
     * Create a span for audit logging
     */
    public Span createAuditSpan(String eventType, String userId, Map<String, String> auditData) {
        Span span = tracer.spanBuilder("compliance.audit")
            .setSpanKind(SpanKind.INTERNAL)
            .setAttribute(COMPLIANCE_FRAMEWORK, "HIPAA")
            .setAttribute(COMPLIANCE_CONTROL, "164.312(b)")
            .setAttribute(COMPLIANCE_CONTROL_NAME, "Audit Controls")
            .setAttribute("audit.event_type", eventType)
            .setAttribute(COMPLIANCE_USER_ID, userId != null ? userId : "system")
            .setAttribute("audit.timestamp", Instant.now().toString())
            .startSpan();

        // Add audit data as span events
        if (auditData != null && !auditData.isEmpty()) {
            Attributes.Builder eventAttrs = Attributes.builder();
            auditData.forEach(eventAttrs::put);
            span.addEvent("Audit data captured", eventAttrs.build());
        }

        return span;
    }

    // Helper methods for control names and categories

    private LongCounter getFrameworkCounter(String framework) {
        return frameworkCounters.computeIfAbsent(framework, f ->
            meter.counterBuilder("compliance.framework." + f.toLowerCase())
                .setDescription("Compliance events for " + f)
                .setUnit("events")
                .build()
        );
    }

    private String generateEvidenceId() {
        return "EVD-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String getSOC2ControlName(String control) {
        Map<String, String> names = Map.of(
            "CC6.1", "Logical Access Controls",
            "CC6.3", "Data Isolation",
            "CC6.7", "Data Transmission and Encryption",
            "CC7.1", "System Operations Monitoring",
            "CC8.1", "Change Management Process"
        );
        return names.getOrDefault(control, control);
    }

    private String getHIPAAControlName(String safeguard) {
        Map<String, String> names = Map.of(
            "164.312(a)", "Access Control",
            "164.312(b)", "Audit Controls",
            "164.312(a)(2)(iv)", "Encryption and Decryption",
            "164.312(e)(2)(ii)", "Transmission Security"
        );
        return names.getOrDefault(safeguard, safeguard);
    }

    private String getFedRAMPControlName(String control) {
        Map<String, String> names = Map.of(
            "AC-2", "Account Management",
            "AU-2", "Event Logging",
            "SC-13", "Cryptographic Protection",
            "SI-4", "System Monitoring"
        );
        return names.getOrDefault(control, control);
    }

    private String getISO27001ControlName(String control) {
        Map<String, String> names = Map.of(
            "A.5.15", "Access Control",
            "A.8.24", "Use of Cryptography",
            "A.8.32", "Change Management"
        );
        return names.getOrDefault(control, control);
    }

    private String getPCIDSSControlName(String requirement) {
        Map<String, String> names = Map.of(
            "3.4", "Render PAN Unreadable",
            "3.6", "Key Management Processes",
            "10.1", "Audit Trail Implementation"
        );
        return names.getOrDefault(requirement, requirement);
    }

    private String getTrustServiceCategory(String control) {
        if (control.startsWith("CC6")) return "Logical and Physical Access";
        if (control.startsWith("CC7")) return "System Operations";
        if (control.startsWith("CC8")) return "Change Management";
        return "Common Criteria";
    }

    private String getControlObjective(String framework, String control) {
        return framework + " Control Objective: " + control;
    }

    private String getHIPAASafeguardType(String safeguard) {
        if (safeguard.contains("164.312")) return "Technical";
        if (safeguard.contains("164.310")) return "Physical";
        if (safeguard.contains("164.308")) return "Administrative";
        return "Security Rule";
    }

    private String getImplementationSpec(String safeguard) {
        if (safeguard.contains("(R)")) return "Required";
        if (safeguard.contains("(A)")) return "Addressable";
        return "Standard";
    }

    private String getControlFamily(String control) {
        String prefix = control.substring(0, Math.min(control.indexOf('-'), control.length()));
        Map<String, String> families = Map.of(
            "AC", "Access Control",
            "AU", "Audit and Accountability",
            "SC", "System and Communications Protection",
            "SI", "System and Information Integrity",
            "CM", "Configuration Management"
        );
        return families.getOrDefault(prefix, "Security Control");
    }

    private String getISO27001Category(String control) {
        if (control.startsWith("A.5")) return "Organizational Controls";
        if (control.startsWith("A.6")) return "People Controls";
        if (control.startsWith("A.7")) return "Physical Controls";
        if (control.startsWith("A.8")) return "Technological Controls";
        return "Information Security Controls";
    }

    private String getPCIDSSCategory(String requirement) {
        String major = requirement.substring(0, requirement.indexOf('.'));
        Map<String, String> categories = Map.of(
            "3", "Protect Stored Account Data",
            "4", "Encrypt Transmission",
            "7", "Restrict Access",
            "10", "Track and Monitor"
        );
        return categories.getOrDefault(major, "Security Requirement");
    }

    /**
     * Wrapper for compliance span with context
     */
    public static class ComplianceSpan implements AutoCloseable {
        private final Span span;
        private final String operationName;
        private final Scope scope;

        public ComplianceSpan(Span span, String operationName) {
            this.span = span;
            this.operationName = operationName;
            this.scope = span.makeCurrent();
        }

        public Span getSpan() {
            return span;
        }

        public String getOperationName() {
            return operationName;
        }

        @Override
        public void close() {
            scope.close();
            span.end();
        }
    }
}