# PRD-005c: Sandbox Compliance Span Generation

**Parent PRD:** PRD-005 (Rule Engine Sandboxing)
**Unit:** C (Compliance Evidence)
**Priority:** P0
**Dependencies:** Unit A (SafeRuleCapabilities), Unit B (Camel Audit Routes)

## Scope

This unit implements compliance span generation for sandbox audit events. It produces SOC2 CC6.6 evidence for capability usage and dual SOC2 CC6.6 + CC7.1 evidence for violations, fulfilling PRD-003 compliance requirements.

**What this unit provides:**
- Named processors for compliance span generation
- SOC2 CC6.6 spans for capability usage (Least Privilege)
- SOC2 CC6.6 + CC7.1 spans for violations (Access Control + Monitoring)
- Integration with Camel audit routes from Unit B

**What this unit does NOT include:**
- TenantSessionManager integration (handled in Unit D)
- Security tests (handled in Unit E)

## Implementation

### 1. Update Camel Audit Routes

**`SandboxAuditRoutes.java` (modifications):**
```java
@ApplicationScoped
public class SandboxAuditRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Capability use audit pipeline
        from("direct:recordCapabilityUse")
            .routeId("recordCapabilityUse")
            .description("Records capability usage to immutable audit trail")
            .process("validateCapabilityEventProcessor")
            .process("recordCapabilityEventToTigerBeetleProcessor")
            .process("generateSandboxComplianceSpanProcessor")  // ← Added in this unit
            .process("appendAuditToSpanLogProcessor");

        // Sandbox violation pipeline
        from("direct:recordSandboxViolation")
            .routeId("recordSandboxViolation")
            .description("Records and alerts on sandbox violations")
            .process("classifyViolationProcessor")
            .process("recordViolationToTigerBeetleProcessor")
            .process("generateViolationComplianceSpanProcessor")  // ← Added in this unit
            .process("appendAuditToSpanLogProcessor")
            .process("alertTenantAdminProcessor");
    }
}
```

### 2. Compliance Span Processors

**`GenerateSandboxComplianceSpanProcessor.java`:**
```java
package com.betrace.processors.sandbox;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.betrace.compliance.evidence.ComplianceSpan;
import com.betrace.compliance.demo.ComplianceEvidenceGenerator;
import java.util.Map;
import java.util.UUID;

/**
 * Generates SOC2 CC6.6 compliance span for capability usage.
 *
 * CC6.6 - Logical and Physical Access Controls: Least Privilege
 * Evidence: Rule capability use recorded in immutable audit log with enforcement.
 */
@Named("generateSandboxComplianceSpanProcessor")
@ApplicationScoped
public class GenerateSandboxComplianceSpanProcessor implements Processor {

    @Inject
    ComplianceEvidenceGenerator complianceGen;

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> event = exchange.getIn().getBody(Map.class);

        String tenantId = (String) event.get("tenantId");
        String ruleId = (String) event.get("ruleId");
        String capability = (String) event.get("capability");
        UUID tbTransferId = (UUID) exchange.getProperty("tbTransferId");

        // Generate SOC2 CC6.6 compliance span (Least Privilege)
        ComplianceSpan complianceSpan = complianceGen.generateSpan(
            tenantId,
            "SOC2",
            "CC6.6",  // Logical and Physical Access Controls - Least Privilege
            Map.of(
                "control", "Least privilege access enforcement in rule sandbox",
                "ruleId", ruleId,
                "capability", capability,
                "tigerBeetleTransferId", tbTransferId.toString(),
                "enforcement", "capability_whitelist",
                "evidence", "Rule capability use recorded in immutable audit log",
                "auditTrail", "TigerBeetle transfer code=7"
            )
        );

        exchange.setProperty("complianceSpan", complianceSpan);

        // Emit compliance span to OpenTelemetry
        complianceGen.emitSpan(complianceSpan);
    }
}
```

**`GenerateViolationComplianceSpanProcessor.java`:**
```java
package com.betrace.processors.sandbox;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import com.betrace.compliance.evidence.ComplianceSpan;
import com.betrace.compliance.demo.ComplianceEvidenceGenerator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Generates dual compliance spans for sandbox violations:
 * 1. SOC2 CC6.6 - Access control violation detected and blocked
 * 2. SOC2 CC7.1 - System monitoring detected violation in real-time
 */
@Named("generateViolationComplianceSpanProcessor")
@ApplicationScoped
public class GenerateViolationComplianceSpanProcessor implements Processor {

    @Inject
    ComplianceEvidenceGenerator complianceGen;

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> event = exchange.getIn().getBody(Map.class);

        String tenantId = (String) event.get("tenantId");
        String ruleId = (String) event.get("ruleId");
        String violationType = (String) event.get("violationType");
        String violationDetails = (String) event.get("details");
        UUID tbTransferId = (UUID) exchange.getProperty("tbTransferId");
        String severity = (String) exchange.getProperty("violationSeverity");

        // Generate SOC2 CC6.6 compliance span (Access Control Violation)
        ComplianceSpan cc66Span = complianceGen.generateSpan(
            tenantId,
            "SOC2",
            "CC6.6",  // Logical and Physical Access Controls
            Map.of(
                "control", "Sandbox violation blocked",
                "ruleId", ruleId,
                "violationType", violationType,
                "violationDetails", violationDetails,
                "severity", severity,
                "tigerBeetleTransferId", tbTransferId.toString(),
                "action", "BLOCKED",
                "evidence", "Sandbox violation recorded and blocked immediately",
                "auditTrail", "TigerBeetle transfer code=7"
            )
        );

        // Generate SOC2 CC7.1 compliance span (System Monitoring)
        ComplianceSpan cc71Span = complianceGen.generateSpan(
            tenantId,
            "SOC2",
            "CC7.1",  // System Operations - Monitoring
            Map.of(
                "control", "Security violation detected by monitoring",
                "ruleId", ruleId,
                "violationType", violationType,
                "violationDetails", violationDetails,
                "severity", severity,
                "detectionMethod", "real_time_capability_enforcement",
                "evidence", "Real-time sandbox violation detection and alerting",
                "alertGenerated", severity.equals("CRITICAL") || severity.equals("HIGH")
            )
        );

        exchange.setProperty("complianceSpans", List.of(cc66Span, cc71Span));

        // Emit both compliance spans to OpenTelemetry
        complianceGen.emitSpan(cc66Span);
        complianceGen.emitSpan(cc71Span);
    }
}
```

### 3. ComplianceEvidenceGenerator Extension

**`ComplianceEvidenceGenerator.java` (add method):**
```java
package com.betrace.compliance.demo;

import com.betrace.compliance.evidence.ComplianceSpan;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

@ApplicationScoped
public class ComplianceEvidenceGenerator {

    @Inject
    Tracer tracer;

    /**
     * Generate a compliance span with metadata.
     *
     * @param tenantId Tenant identifier
     * @param framework Compliance framework (e.g., "SOC2")
     * @param control Control identifier (e.g., "CC6.6")
     * @param metadata Additional evidence attributes
     * @return ComplianceSpan ready for emission
     */
    public ComplianceSpan generateSpan(
        String tenantId,
        String framework,
        String control,
        Map<String, Object> metadata
    ) {
        ComplianceSpan span = new ComplianceSpan();
        span.setTenantId(tenantId);
        span.setFramework(framework);
        span.setControl(control);
        span.setMetadata(metadata);
        span.setTimestamp(System.currentTimeMillis());

        return span;
    }

    /**
     * Emit a compliance span to OpenTelemetry.
     *
     * @param complianceSpan The compliance span to emit
     */
    public void emitSpan(ComplianceSpan complianceSpan) {
        Span otelSpan = tracer.spanBuilder("compliance.evidence")
            .setAttribute("compliance.framework", complianceSpan.getFramework())
            .setAttribute("compliance.control", complianceSpan.getControl())
            .setAttribute("compliance.tenantId", complianceSpan.getTenantId())
            .startSpan();

        // Add all metadata as span attributes
        complianceSpan.getMetadata().forEach((key, value) -> {
            otelSpan.setAttribute("compliance." + key, value.toString());
        });

        otelSpan.end();
    }
}
```

## Success Criteria

**Functional Requirements:**
- [ ] Every capability use generates SOC2 CC6.6 compliance span
- [ ] Every violation generates dual SOC2 CC6.6 + CC7.1 compliance spans
- [ ] Compliance spans include TigerBeetle transfer ID for audit trail linkage
- [ ] Compliance spans emitted to OpenTelemetry with correct attributes
- [ ] Spans queryable via Grafana/TraceQL

**Compliance Requirements:**
- [ ] SOC2 CC6.6 evidence: Least privilege enforcement documented
- [ ] SOC2 CC7.1 evidence: Real-time monitoring of violations documented
- [ ] Immutable audit trail linkage (TigerBeetle transfer ID in span metadata)
- [ ] Evidence includes enforcement action (BLOCKED) and severity

**Testing:**
- [ ] 90% test coverage for compliance processors
- [ ] Unit tests verify correct span attributes
- [ ] Integration tests verify spans emitted to OpenTelemetry

## Testing Requirements

### Unit Tests

**`GenerateSandboxComplianceSpanProcessorTest.java`:**
```java
package com.betrace.processors.sandbox;

import org.junit.jupiter.api.Test;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.Map;
import java.util.UUID;

public class GenerateSandboxComplianceSpanProcessorTest {

    @Test
    public void testGenerateComplianceSpan_SOC2_CC66() throws Exception {
        GenerateSandboxComplianceSpanProcessor processor = new GenerateSandboxComplianceSpanProcessor();
        processor.complianceGen = mock(ComplianceEvidenceGenerator.class);

        UUID transferId = UUID.randomUUID();

        Exchange exchange = new DefaultExchange(new DefaultCamelContext());
        exchange.getIn().setBody(Map.of(
            "tenantId", "tenant-1",
            "ruleId", "rule-1",
            "capability", "createSignal"
        ));
        exchange.setProperty("tbTransferId", transferId);

        processor.process(exchange);

        verify(processor.complianceGen).generateSpan(
            eq("tenant-1"),
            eq("SOC2"),
            eq("CC6.6"),
            argThat(metadata ->
                metadata.get("ruleId").equals("rule-1") &&
                metadata.get("capability").equals("createSignal") &&
                metadata.get("tigerBeetleTransferId").equals(transferId.toString())
            )
        );

        verify(processor.complianceGen).emitSpan(any());
    }
}
```

**`GenerateViolationComplianceSpanProcessorTest.java`:**
```java
@Test
public void testGenerateViolationSpans_DualSpans() throws Exception {
    GenerateViolationComplianceSpanProcessor processor = new GenerateViolationComplianceSpanProcessor();
    processor.complianceGen = mock(ComplianceEvidenceGenerator.class);

    Exchange exchange = new DefaultExchange(new DefaultCamelContext());
    exchange.getIn().setBody(Map.of(
        "tenantId", "tenant-1",
        "ruleId", "rule-1",
        "violationType", "CROSS_TENANT_ACCESS",
        "details", "Attempted access to tenant-2"
    ));
    exchange.setProperty("tbTransferId", UUID.randomUUID());
    exchange.setProperty("violationSeverity", "CRITICAL");

    processor.process(exchange);

    // Verify CC6.6 span generated
    verify(processor.complianceGen).generateSpan(
        eq("tenant-1"),
        eq("SOC2"),
        eq("CC6.6"),
        any()
    );

    // Verify CC7.1 span generated
    verify(processor.complianceGen).generateSpan(
        eq("tenant-1"),
        eq("SOC2"),
        eq("CC7.1"),
        any()
    );

    // Verify both spans emitted
    verify(processor.complianceGen, times(2)).emitSpan(any());
}
```

### Integration Tests

**`ComplianceSpanIntegrationTest.java`:**
```java
package com.betrace.security;

import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class ComplianceSpanIntegrationTest {

    @Test
    public void testCapabilityUse_EmitsCC66Span() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        capabilities.createSignal("rule-1", "Test Rule", Map.of());

        // Query OpenTelemetry for compliance spans
        List<Span> complianceSpans = otelCollector.querySpans(
            "span.name = 'compliance.evidence' && " +
            "span.compliance.framework = 'SOC2' && " +
            "span.compliance.control = 'CC6.6'"
        );

        assertEquals(1, complianceSpans.size());
        assertEquals("tenant-1", complianceSpans.get(0).getAttribute("compliance.tenantId"));
        assertEquals("rule-1", complianceSpans.get(0).getAttribute("compliance.ruleId"));
        assertEquals("createSignal", complianceSpans.get(0).getAttribute("compliance.capability"));
    }

    @Test
    public void testViolation_EmitsDualSpans() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        // Trigger violation
        assertThrows(SecurityException.class, () -> {
            // Malicious capability call
        });

        // Query OpenTelemetry for CC6.6 span
        List<Span> cc66Spans = otelCollector.querySpans(
            "span.compliance.framework = 'SOC2' && span.compliance.control = 'CC6.6'"
        );
        assertEquals(1, cc66Spans.size());

        // Query OpenTelemetry for CC7.1 span
        List<Span> cc71Spans = otelCollector.querySpans(
            "span.compliance.framework = 'SOC2' && span.compliance.control = 'CC7.1'"
        );
        assertEquals(1, cc71Spans.size());
    }
}
```

## Files to Create

**Backend - Named Processors:**
- `backend/src/main/java/com/betrace/processors/sandbox/GenerateSandboxComplianceSpanProcessor.java`
- `backend/src/main/java/com/betrace/processors/sandbox/GenerateViolationComplianceSpanProcessor.java`

**Tests - Unit Tests:**
- `backend/src/test/java/com/betrace/processors/sandbox/GenerateSandboxComplianceSpanProcessorTest.java`
- `backend/src/test/java/com/betrace/processors/sandbox/GenerateViolationComplianceSpanProcessorTest.java`

**Tests - Integration Tests:**
- `backend/src/test/java/com/betrace/security/ComplianceSpanIntegrationTest.java`

## Files to Modify

**Backend - Camel Routes:**
- `backend/src/main/java/com/betrace/routes/SandboxAuditRoutes.java`
  - Add `.process("generateSandboxComplianceSpanProcessor")` to capability route
  - Add `.process("generateViolationComplianceSpanProcessor")` to violation route

**Backend - Compliance Services:**
- `backend/src/main/java/com/betrace/compliance/demo/ComplianceEvidenceGenerator.java`
  - Add `generateSpan()` method for programmatic span creation
  - Add `emitSpan()` method for OpenTelemetry emission

## Dependencies

**Requires:**
- Unit A: SafeRuleCapabilities (execution context)
- Unit B: Camel audit routes (audit pipeline)
- PRD-003: ComplianceSpan model and signing (cryptographic evidence)

**Blocks:**
- Unit E: Security tests need compliance span verification

## Compliance Benefits

**SOC2 CC6.6 (Least Privilege):**
- Evidence: Capability whitelist enforces minimal access for rules
- Audit Trail: Every capability use recorded with TigerBeetle link
- Enforcement: Violations blocked immediately and recorded

**SOC2 CC7.1 (System Monitoring):**
- Evidence: Real-time violation detection with cryptographic evidence
- Alerting: Critical violations trigger tenant admin alerts
- Forensics: Complete audit trail for incident investigation

**Query Examples for Auditors:**

**Grafana TraceQL:**
```
# All sandbox capability usage
{span.compliance.framework = "SOC2" && span.compliance.control = "CC6.6"}

# Critical violations only
{span.compliance.control = "CC7.1" && span.compliance.severity = "CRITICAL"}

# Specific rule audit trail
{span.compliance.ruleId = "rule-1"}
```

**Prometheus Span Metrics:**
```
# Capability usage rate by tenant
sum by (compliance_tenantId) (
  rate(traces_spanmetrics_calls_total{compliance_control="CC6.6"}[5m])
)

# Violation count by severity
sum by (compliance_severity) (
  traces_spanmetrics_calls_total{compliance_control="CC7.1"}
)
```
