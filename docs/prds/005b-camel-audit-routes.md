# PRD-005b: Camel Audit Routes and TigerBeetle Processors

**Parent PRD:** PRD-005 (Rule Engine Sandboxing)
**Unit:** B (Audit Infrastructure)
**Priority:** P0
**Dependencies:** Unit A (SafeRuleCapabilities)

## Scope

This unit implements the Camel audit pipeline and TigerBeetle persistence for sandbox events. It provides immutable audit trails for capability usage and violations, following ADR-013 (Camel-First) and ADR-014 (Named Processors).

**What this unit provides:**
- Camel routes for capability audit and violation recording
- TigerBeetle processors for immutable audit storage (code=7)
- Named processors for validation, persistence, and alerting
- Integration with SafeRuleCapabilities via ProducerTemplate

**What this unit does NOT include:**
- Compliance span generation (handled in Unit C)
- TenantSessionManager integration (handled in Unit D)
- Security tests (handled in Unit E)

## Implementation

### 1. Update SafeRuleCapabilities with Camel Integration

**`SafeRuleCapabilities.java` (modifications):**
```java
@ApplicationScoped
public class SafeRuleCapabilities implements RuleCapabilities {

    @Inject
    SignalService signalService;

    @Inject
    @EndpointInject("direct:recordCapabilityUse")
    ProducerTemplate capabilityAuditProducer;

    @Inject
    @EndpointInject("direct:recordSandboxViolation")
    ProducerTemplate violationProducer;

    // ... existing code ...

    @Override
    public void createSignal(String ruleId, String ruleName, Map<String, Object> contextData) {
        RuleExecutionContext ctx = validateContext();

        if (!ctx.ruleId().equals(ruleId)) {
            throw new SecurityException(
                "Rule ID mismatch: context=" + ctx.ruleId() + ", provided=" + ruleId
            );
        }

        try {
            // Build capability event for Camel pipeline
            Map<String, Object> capabilityEvent = Map.of(
                "tenantId", ctx.tenantId(),
                "ruleId", ruleId,
                "capability", "createSignal",
                "contextData", contextData,
                "traceId", ctx.traceId()
            );

            // Send to Camel audit pipeline (async)
            capabilityAuditProducer.sendBodyAndHeaders(
                "direct:recordCapabilityUse",
                capabilityEvent,
                Map.of(
                    "tenantId", ctx.tenantId(),
                    "ruleId", ruleId,
                    "capability", "createSignal"
                )
            );

            // Call the actual service (tenant-scoped)
            signalService.createSignalForRule(
                ctx.tenantId(),
                ruleId,
                ruleName,
                ctx.traceId(),
                contextData
            );

        } catch (Exception e) {
            // Record sandbox violation
            recordViolation(ctx, ruleId, "UNAUTHORIZED_SIGNAL_CREATION", e.getMessage());
            throw new SecurityException("Signal creation denied", e);
        }
    }

    @Override
    public void logRuleExecution(String ruleId, String message) {
        RuleExecutionContext ctx = context.get();
        if (ctx == null) return;

        if (!ctx.ruleId().equals(ruleId)) return;

        String sanitized = sanitizeLogMessage(message);

        // Send to Camel audit pipeline
        capabilityAuditProducer.sendBodyAndHeaders(
            "direct:recordCapabilityUse",
            Map.of(
                "tenantId", ctx.tenantId(),
                "ruleId", ruleId,
                "capability", "logRuleExecution",
                "message", sanitized,
                "traceId", ctx.traceId()
            ),
            Map.of("tenantId", ctx.tenantId(), "ruleId", ruleId)
        );
    }

    private void recordViolation(RuleExecutionContext ctx, String ruleId, String violationType, String details) {
        violationProducer.sendBodyAndHeaders(
            "direct:recordSandboxViolation",
            Map.of(
                "tenantId", ctx.tenantId(),
                "ruleId", ruleId,
                "violationType", violationType,
                "details", details,
                "traceId", ctx.traceId()
            ),
            Map.of("tenantId", ctx.tenantId(), "ruleId", ruleId)
        );
    }

    // ... rest of existing code ...
}
```

### 2. Camel Audit Routes (ADR-013)

**`SandboxAuditRoutes.java`:**
```java
package com.fluo.routes;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Camel routes for sandbox audit logging.
 * Complies with ADR-013 (Camel-First) and ADR-014 (Named Processors).
 */
@ApplicationScoped
public class SandboxAuditRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Capability use audit pipeline
        from("direct:recordCapabilityUse")
            .routeId("recordCapabilityUse")
            .description("Records capability usage to immutable audit trail")
            .process("validateCapabilityEventProcessor")
            .process("recordCapabilityEventToTigerBeetleProcessor")  // TigerBeetle transfer code=7
            .process("appendAuditToSpanLogProcessor");               // Append-only log
            // Note: Compliance span generation added in Unit C

        // Sandbox violation pipeline
        from("direct:recordSandboxViolation")
            .routeId("recordSandboxViolation")
            .description("Records and alerts on sandbox violations")
            .process("classifyViolationProcessor")
            .process("recordViolationToTigerBeetleProcessor")        // TigerBeetle transfer code=7
            .process("appendAuditToSpanLogProcessor")
            .process("alertTenantAdminProcessor");                   // Critical violations alert
            // Note: Compliance span generation added in Unit C
    }
}
```

### 3. Named Processors (ADR-014)

**`ValidateCapabilityEventProcessor.java`:**
```java
package com.fluo.processors.sandbox;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.util.Map;
import java.util.Set;

@Named("validateCapabilityEventProcessor")
@ApplicationScoped
public class ValidateCapabilityEventProcessor implements Processor {

    private static final Set<String> ALLOWED_CAPABILITIES = Set.of(
        "createSignal",
        "logRuleExecution",
        "getCurrentTraceId",
        "getCurrentTenantId"
    );

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> event = exchange.getIn().getBody(Map.class);

        // Validate required fields
        String tenantId = (String) event.get("tenantId");
        String ruleId = (String) event.get("ruleId");
        String capability = (String) event.get("capability");

        if (tenantId == null || ruleId == null || capability == null) {
            throw new IllegalArgumentException("Missing required capability event fields");
        }

        // Validate capability is whitelisted
        if (!ALLOWED_CAPABILITIES.contains(capability)) {
            throw new SecurityException("Unknown capability: " + capability);
        }

        exchange.setProperty("capabilityValidated", true);
    }
}
```

**`RecordCapabilityEventToTigerBeetleProcessor.java`:**
```java
package com.fluo.processors.sandbox;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Named("recordCapabilityEventToTigerBeetleProcessor")
@ApplicationScoped
public class RecordCapabilityEventToTigerBeetleProcessor implements Processor {

    @Inject
    TigerBeetleClient tbClient;

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> event = exchange.getIn().getBody(Map.class);

        String tenantId = (String) event.get("tenantId");
        String ruleId = (String) event.get("ruleId");
        String capability = (String) event.get("capability");

        // Create TigerBeetle transfer for capability audit
        UUID transferId = UUID.randomUUID();
        UUID ruleAccountId = tenantRuleToAccountId(tenantId, ruleId);
        UUID tenantAccountId = tenantIdToAccountId(tenantId);

        TBTransfer capabilityEvent = new TBTransfer(
            id: toUInt128(transferId),
            debitAccountId: toUInt128(ruleAccountId),      // Rule that used capability
            creditAccountId: toUInt128(tenantAccountId),   // Tenant owner
            amount: 1,                                      // Event count
            userData128: packCapabilityMetadata(capability),
            userData64: packTimestamp(Instant.now()),
            code: 7,  // Sandbox audit event type
            ledger: tenantToLedgerId(tenantId),
            timestamp: Instant.now().toEpochMilli() * 1_000_000
        );

        // Write to TigerBeetle (immutable audit trail)
        tbClient.createTransfers(List.of(capabilityEvent));

        exchange.setProperty("tbTransferId", transferId);
    }

    private long packCapabilityMetadata(String capability) {
        // Pack capability enum into 128-bit field
        return switch(capability) {
            case "createSignal" -> 1L;
            case "logRuleExecution" -> 2L;
            case "getCurrentTraceId" -> 3L;
            case "getCurrentTenantId" -> 4L;
            default -> 0L;
        };
    }

    private long packTimestamp(Instant timestamp) {
        return timestamp.toEpochMilli();
    }

    private UUID tenantRuleToAccountId(String tenantId, String ruleId) {
        // Deterministic UUID from tenant+rule (namespace UUID)
        return UUID.nameUUIDFromBytes((tenantId + ":" + ruleId).getBytes());
    }

    private UUID tenantIdToAccountId(String tenantId) {
        // Deterministic UUID from tenant ID
        return UUID.nameUUIDFromBytes(tenantId.getBytes());
    }

    private int tenantToLedgerId(String tenantId) {
        // Simple hash to ledger ID (TigerBeetle ledger range)
        return Math.abs(tenantId.hashCode() % 1000);
    }

    private byte[] toUInt128(UUID uuid) {
        // Convert UUID to 128-bit byte array for TigerBeetle
        long msb = uuid.getMostSignificantBits();
        long lsb = uuid.getLeastSignificantBits();
        byte[] bytes = new byte[16];

        for (int i = 0; i < 8; i++) {
            bytes[i] = (byte) (msb >>> (56 - i * 8));
            bytes[8 + i] = (byte) (lsb >>> (56 - i * 8));
        }

        return bytes;
    }
}
```

**`RecordViolationToTigerBeetleProcessor.java`:**
```java
package com.fluo.processors.sandbox;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Named("recordViolationToTigerBeetleProcessor")
@ApplicationScoped
public class RecordViolationToTigerBeetleProcessor implements Processor {

    @Inject
    TigerBeetleClient tbClient;

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> event = exchange.getIn().getBody(Map.class);

        String tenantId = (String) event.get("tenantId");
        String ruleId = (String) event.get("ruleId");
        String violationType = (String) event.get("violationType");

        UUID transferId = UUID.randomUUID();
        UUID ruleAccountId = tenantRuleToAccountId(tenantId, ruleId);
        UUID tenantAccountId = tenantIdToAccountId(tenantId);

        TBTransfer violationEvent = new TBTransfer(
            id: toUInt128(transferId),
            debitAccountId: toUInt128(ruleAccountId),      // Rule that violated sandbox
            creditAccountId: toUInt128(tenantAccountId),   // Tenant owner
            amount: 1,                                      // Violation count
            userData128: packViolationMetadata(violationType),
            userData64: packSeverity(violationType),
            code: 7,  // Sandbox audit event type
            flags: TB_FLAGS_LINKED,  // Link to compliance span (added in Unit C)
            ledger: tenantToLedgerId(tenantId),
            timestamp: Instant.now().toEpochMilli() * 1_000_000
        );

        tbClient.createTransfers(List.of(violationEvent));

        exchange.setProperty("tbTransferId", transferId);
        exchange.setProperty("violationSeverity", getSeverityString(violationType));
    }

    private long packViolationMetadata(String violationType) {
        return switch(violationType) {
            case "UNAUTHORIZED_SIGNAL_CREATION" -> 1L;
            case "CROSS_TENANT_ACCESS" -> 2L;
            case "FILE_SYSTEM_ACCESS" -> 3L;
            case "NETWORK_ACCESS" -> 4L;
            case "REFLECTION_ABUSE" -> 5L;
            case "CLASS_LOADING_VIOLATION" -> 6L;
            default -> 0L;
        };
    }

    private long packSeverity(String violationType) {
        return switch(getSeverityString(violationType)) {
            case "CRITICAL" -> 3L;
            case "HIGH" -> 2L;
            case "MEDIUM" -> 1L;
            default -> 0L;
        };
    }

    private String getSeverityString(String violationType) {
        return switch(violationType) {
            case "CROSS_TENANT_ACCESS", "FILE_SYSTEM_ACCESS" -> "CRITICAL";
            case "NETWORK_ACCESS", "REFLECTION_ABUSE" -> "HIGH";
            default -> "MEDIUM";
        };
    }

    // Helper methods same as RecordCapabilityEventToTigerBeetleProcessor
    private UUID tenantRuleToAccountId(String tenantId, String ruleId) {
        return UUID.nameUUIDFromBytes((tenantId + ":" + ruleId).getBytes());
    }

    private UUID tenantIdToAccountId(String tenantId) {
        return UUID.nameUUIDFromBytes(tenantId.getBytes());
    }

    private int tenantToLedgerId(String tenantId) {
        return Math.abs(tenantId.hashCode() % 1000);
    }

    private byte[] toUInt128(UUID uuid) {
        long msb = uuid.getMostSignificantBits();
        long lsb = uuid.getLeastSignificantBits();
        byte[] bytes = new byte[16];

        for (int i = 0; i < 8; i++) {
            bytes[i] = (byte) (msb >>> (56 - i * 8));
            bytes[8 + i] = (byte) (lsb >>> (56 - i * 8));
        }

        return bytes;
    }
}
```

**`ClassifyViolationProcessor.java`:**
```java
package com.fluo.processors.sandbox;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.util.Map;

@Named("classifyViolationProcessor")
@ApplicationScoped
public class ClassifyViolationProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> event = exchange.getIn().getBody(Map.class);
        String violationType = (String) event.get("violationType");

        // Classify violation severity
        String severity = switch(violationType) {
            case "CROSS_TENANT_ACCESS", "FILE_SYSTEM_ACCESS" -> "CRITICAL";
            case "NETWORK_ACCESS", "REFLECTION_ABUSE" -> "HIGH";
            case "UNAUTHORIZED_SIGNAL_CREATION", "CLASS_LOADING_VIOLATION" -> "MEDIUM";
            default -> "UNKNOWN";
        };

        exchange.setProperty("violationSeverity", severity);
        exchange.setProperty("requiresAlert", severity.equals("CRITICAL") || severity.equals("HIGH"));
    }
}
```

**`AppendAuditToSpanLogProcessor.java`:**
```java
package com.fluo.processors.sandbox;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.Map;

@Named("appendAuditToSpanLogProcessor")
@ApplicationScoped
public class AppendAuditToSpanLogProcessor implements Processor {

    private static final Path AUDIT_LOG_DIR = Path.of("data/audit");

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> event = exchange.getIn().getBody(Map.class);

        String tenantId = (String) event.get("tenantId");
        String ruleId = (String) event.get("ruleId");
        String traceId = (String) event.get("traceId");

        // Create JSON log entry
        String logEntry = String.format(
            "{\"timestamp\":\"%s\",\"tenantId\":\"%s\",\"ruleId\":\"%s\",\"traceId\":\"%s\",\"event\":%s}\n",
            Instant.now().toString(),
            tenantId,
            ruleId,
            traceId,
            toJson(event)
        );

        // Append to span log (JSON lines format)
        Path logFile = AUDIT_LOG_DIR.resolve(tenantId + ".jsonl");
        Files.createDirectories(AUDIT_LOG_DIR);
        Files.writeString(logFile, logEntry, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    private String toJson(Map<String, Object> event) {
        // Simple JSON serialization (use Jackson in real implementation)
        return event.toString();
    }
}
```

**`AlertTenantAdminProcessor.java`:**
```java
package com.fluo.processors.sandbox;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.util.Map;

@Named("alertTenantAdminProcessor")
@ApplicationScoped
public class AlertTenantAdminProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Boolean requiresAlert = (Boolean) exchange.getProperty("requiresAlert");
        if (requiresAlert == null || !requiresAlert) {
            return; // Skip non-critical violations
        }

        Map<String, Object> event = exchange.getIn().getBody(Map.class);
        String tenantId = (String) event.get("tenantId");
        String ruleId = (String) event.get("ruleId");
        String violationType = (String) event.get("violationType");
        String severity = (String) exchange.getProperty("violationSeverity");

        // TODO: Implement actual alerting mechanism (email, webhook, etc.)
        System.err.println(String.format(
            "[SECURITY ALERT] Tenant=%s, Rule=%s, Violation=%s, Severity=%s",
            tenantId, ruleId, violationType, severity
        ));
    }
}
```

## Success Criteria

**Functional Requirements:**
- [ ] Capability events recorded to TigerBeetle (code=7)
- [ ] Violation events recorded to TigerBeetle (code=7)
- [ ] Audit events flow through Camel routes (ADR-013)
- [ ] All logic in named CDI processors (ADR-014)
- [ ] Violations classified by severity (CRITICAL, HIGH, MEDIUM)
- [ ] Critical violations trigger alerts
- [ ] Audit events appended to JSON lines log

**Performance:**
- [ ] Async audit logging doesn't block rule execution
- [ ] TigerBeetle audit writes complete in <500μs
- [ ] No performance degradation for capability calls

**Testing:**
- [ ] 90% test coverage for all processors
- [ ] Unit tests verify TigerBeetle transfers created with correct metadata
- [ ] Integration tests verify end-to-end audit flow

## Testing Requirements

### Unit Tests

**`ValidateCapabilityEventProcessorTest.java`:**
```java
@Test
public void testValidEvent_PassesValidation() {
    Map<String, Object> event = Map.of(
        "tenantId", "tenant-1",
        "ruleId", "rule-1",
        "capability", "createSignal"
    );

    Exchange exchange = new DefaultExchange(context);
    exchange.getIn().setBody(event);

    processor.process(exchange);

    assertTrue((Boolean) exchange.getProperty("capabilityValidated"));
}

@Test
public void testUnknownCapability_ThrowsSecurityException() {
    Map<String, Object> event = Map.of(
        "tenantId", "tenant-1",
        "ruleId", "rule-1",
        "capability", "deleteAllData"  // Not allowed
    );

    Exchange exchange = new DefaultExchange(context);
    exchange.getIn().setBody(event);

    assertThrows(SecurityException.class, () -> processor.process(exchange));
}
```

**`RecordCapabilityEventToTigerBeetleProcessorTest.java`:**
```java
@Test
public void testCapabilityEvent_CreatesTransfer() {
    Map<String, Object> event = Map.of(
        "tenantId", "tenant-1",
        "ruleId", "rule-1",
        "capability", "createSignal"
    );

    Exchange exchange = new DefaultExchange(context);
    exchange.getIn().setBody(event);

    processor.process(exchange);

    verify(tbClient).createTransfers(transfersCaptor.capture());
    TBTransfer transfer = transfersCaptor.getValue().get(0);

    assertEquals(7, transfer.getCode()); // Sandbox audit code
    assertEquals(1L, transfer.getUserData128()); // createSignal = 1
}
```

### Integration Tests

**`SandboxAuditIntegrationTest.java`:**
```java
@Test
public void testEndToEnd_CapabilityUse_RecordedInTigerBeetle() {
    // Setup context
    SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

    // Use capability
    capabilities.createSignal("rule-1", "Test Rule", Map.of());

    // Verify TigerBeetle transfer created
    List<TBTransfer> events = tbClient.getAccountTransfers(
        ruleAccountId("tenant-1", "rule-1"),
        filterByCode: 7
    );

    assertEquals(1, events.size());
    assertEquals(1L, events.get(0).getUserData128()); // createSignal
}
```

## Files to Create

**Backend - Camel Routes:**
- `backend/src/main/java/com/fluo/routes/SandboxAuditRoutes.java`

**Backend - Named Processors:**
- `backend/src/main/java/com/fluo/processors/sandbox/ValidateCapabilityEventProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/RecordCapabilityEventToTigerBeetleProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/RecordViolationToTigerBeetleProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/ClassifyViolationProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/AppendAuditToSpanLogProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/AlertTenantAdminProcessor.java`

**Tests - Unit Tests:**
- `backend/src/test/java/com/fluo/processors/sandbox/ValidateCapabilityEventProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/sandbox/RecordCapabilityEventToTigerBeetleProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/sandbox/RecordViolationToTigerBeetleProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/sandbox/ClassifyViolationProcessorTest.java`

**Tests - Integration Tests:**
- `backend/src/test/java/com/fluo/security/SandboxAuditIntegrationTest.java`

## Files to Modify

**Backend - Core Services:**
- `backend/src/main/java/com/fluo/services/SafeRuleCapabilities.java`
  - Add `@Inject ProducerTemplate` fields for Camel integration
  - Implement `recordViolation()` method
  - Send audit events to Camel routes

## Dependencies

**Requires:**
- Unit A: SafeRuleCapabilities (foundation)
- PRD-002: TigerBeetle client for audit persistence

**Blocks:**
- Unit C: Compliance span generation needs audit context
- Unit E: Security tests need audit trail verification
