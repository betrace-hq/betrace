# PRD-005d: Integration with Rule Engine

**Parent PRD:** PRD-005 (Rule Engine Sandboxing)
**Unit:** D (Rule Engine Integration)
**Priority:** P0
**Dependencies:** Unit A (SafeRuleCapabilities), Unit B (Camel Audit Routes), Unit C (Compliance Spans)

## Scope

This unit integrates the sandboxed capabilities with FLUO's rule engine. It modifies TenantSessionManager, DroolsGenerator, and RuleEvaluationService to use the safe capabilities interface instead of direct service access.

**What this unit provides:**
- TenantSessionManager uses SafeRuleCapabilities instead of SignalService
- DroolsGenerator emits DRL with `capabilities` global instead of `signalService`
- RuleEvaluationService sets/clears execution context around rule evaluation
- Seamless migration path (existing rules must be regenerated)

**What this unit does NOT include:**
- Security tests (handled in Unit E)

## Implementation

### 1. Update TenantSessionManager

**`TenantSessionManager.java` (modifications):**
```java
package com.fluo.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class TenantSessionManager {

    @Inject
    KieContainer container;

    @Inject
    SafeRuleCapabilities safeCapabilities;  // ← Changed from SignalService

    // ❌ REMOVED: @Inject SignalService signalService;

    private final Map<String, KieSession> tenantSessions = new ConcurrentHashMap<>();

    /**
     * Get or create KieSession for tenant with sandbox isolation.
     *
     * @param tenantId Tenant identifier
     * @return KieSession with safe capabilities only
     */
    public KieSession getSession(String tenantId) {
        return tenantSessions.computeIfAbsent(tenantId, tid -> {
            KieSession session = container.newKieSession();

            // ❌ BEFORE (UNSAFE):
            // session.setGlobal("signalService", signalService);

            // ✅ AFTER (SAFE):
            session.setGlobal("capabilities", safeCapabilities);

            return session;
        });
    }

    /**
     * Close session for tenant (cleanup).
     *
     * @param tenantId Tenant identifier
     */
    public void closeSession(String tenantId) {
        KieSession session = tenantSessions.remove(tenantId);
        if (session != null) {
            session.dispose();
        }
    }

    /**
     * Close all sessions (shutdown hook).
     */
    public void closeAllSessions() {
        tenantSessions.values().forEach(KieSession::dispose);
        tenantSessions.clear();
    }
}
```

### 2. Update DroolsGenerator

**`DroolsGenerator.java` (modifications):**
```java
package com.fluo.rules.dsl;

import com.fluo.rules.dsl.RuleExpression;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class DroolsGenerator {

    /**
     * Generate Drools DRL from FLUO DSL AST.
     * Uses safe capabilities interface instead of direct service access.
     *
     * @param ast Parsed rule AST
     * @param ruleId Unique rule identifier
     * @param ruleName Human-readable rule name
     * @return Generated DRL code with sandbox constraints
     */
    public String generate(RuleExpression ast, String ruleId, String ruleName) {
        StringBuilder drl = new StringBuilder();

        // Package declaration
        drl.append("package com.fluo.rules;\n\n");

        // Imports
        drl.append("import com.fluo.model.Span;\n");
        drl.append("import com.fluo.services.RuleCapabilities;\n");  // ← Import capabilities interface
        drl.append("import java.util.HashMap;\n");
        drl.append("import java.util.Map;\n\n");

        // ❌ BEFORE (UNSAFE):
        // drl.append("global com.fluo.services.SignalService signalService;\n\n");

        // ✅ AFTER (SAFE):
        drl.append("global RuleCapabilities capabilities;\n\n");  // ← Changed from signalService

        // Rule definition
        drl.append("rule \"").append(ruleId).append("\"\n");
        drl.append("when\n");

        // Generate condition from AST
        String condition = generateCondition(ast);
        drl.append("    ").append(condition).append("\n");

        drl.append("then\n");

        // ❌ BEFORE (UNSAFE):
        // drl.append("    signalService.createSignal(...)\n");

        // ✅ AFTER (SAFE):
        drl.append("    Map<String, Object> context = new HashMap<>();\n");
        drl.append("    context.put(\"traceId\", capabilities.getCurrentTraceId());\n");
        drl.append("    context.put(\"ruleMatched\", \"").append(ruleId).append("\");\n");
        drl.append("    capabilities.createSignal(\n");
        drl.append("        \"").append(ruleId).append("\",\n");
        drl.append("        \"").append(ruleName).append("\",\n");
        drl.append("        context\n");
        drl.append("    );\n");

        drl.append("end\n");

        return drl.toString();
    }

    /**
     * Generate Drools condition from FLUO DSL AST.
     *
     * @param ast Rule expression AST
     * @return Drools LHS condition
     */
    private String generateCondition(RuleExpression ast) {
        // Existing condition generation logic
        // No changes needed - conditions don't use capabilities
        return ast.toDrools();
    }
}
```

### 3. Update RuleEvaluationService

**`RuleEvaluationService.java` (modifications):**
```java
package com.fluo.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.kie.api.runtime.KieSession;
import com.fluo.model.Span;

@ApplicationScoped
public class RuleEvaluationService {

    @Inject
    TenantSessionManager sessionManager;

    /**
     * Evaluate span against tenant rules with sandbox isolation.
     * Sets execution context before evaluation and clears after.
     *
     * @param tenantId Tenant identifier
     * @param ruleId Rule identifier (for context tracking)
     * @param span OpenTelemetry span to evaluate
     */
    public void evaluateSpan(String tenantId, String ruleId, Span span) {
        // ✅ Set execution context (thread-local for sandbox isolation)
        SafeRuleCapabilities.setContext(tenantId, span.getTraceId(), ruleId);

        try {
            KieSession session = sessionManager.getSession(tenantId);

            // Insert span and fire rules
            session.insert(span);
            session.fireAllRules();

        } finally {
            // ✅ Always clear context (prevent thread pollution)
            SafeRuleCapabilities.clearContext();
        }
    }

    /**
     * Evaluate span against all rules for tenant.
     * Used when rule ID is not known in advance.
     *
     * @param tenantId Tenant identifier
     * @param span OpenTelemetry span to evaluate
     */
    public void evaluateSpan(String tenantId, Span span) {
        // Use generic rule ID for context (actual rule ID determined at runtime)
        evaluateSpan(tenantId, "all-rules", span);
    }
}
```

### 4. Migration Guide for Existing Rules

**`SANDBOX_MIGRATION.md`:**
```markdown
# Sandbox Migration Guide

## Breaking Change

All Drools rules must be regenerated to use the new `capabilities` interface.

### Before (Unsafe)
```drools
global com.fluo.services.SignalService signalService;

rule "Slow Request"
when
    $span: Span(duration > 5000)
then
    signalService.createSignal("rule-1", "Slow Request", Map.of());
end
```

### After (Safe)
```drools
global RuleCapabilities capabilities;

rule "Slow Request"
when
    $span: Span(duration > 5000)
then
    capabilities.createSignal("rule-1", "Slow Request", Map.of());
end
```

## Migration Steps

1. **Regenerate all rules via DroolsGenerator**
   - Existing rules in DRL format must be recompiled
   - Rules stored as FLUO DSL will be regenerated automatically

2. **Test rule behavior**
   - Verify signals still created correctly
   - Check audit logs in TigerBeetle (code=7)
   - Query compliance spans in Grafana

3. **Update custom DRL (if any)**
   - Search codebase for `global SignalService`
   - Replace with `global RuleCapabilities capabilities`
   - Replace all `signalService.*` calls with `capabilities.*`

## Backward Compatibility

⚠️ **No backward compatibility** - old rules will fail compilation.

Rules referencing `signalService` will throw:
```
DroolsCompilationException: Unable to resolve method 'signalService'
```

**Solution:** Regenerate rules from source (FLUO DSL or templates).
```

## Success Criteria

**Functional Requirements:**
- [ ] TenantSessionManager injects SafeRuleCapabilities instead of SignalService
- [ ] Drools sessions have `capabilities` global, not `signalService`
- [ ] DroolsGenerator emits DRL with `capabilities.createSignal()`
- [ ] RuleEvaluationService sets context before evaluation
- [ ] RuleEvaluationService clears context in finally block
- [ ] Existing rules fail compilation (no silent breakage)

**Security Requirements:**
- [ ] No rules can access SignalService directly
- [ ] All rule actions go through SafeRuleCapabilities
- [ ] ThreadLocal context enforces tenant isolation
- [ ] Context cleared after every evaluation (no thread pollution)

**Testing Requirements:**
- [ ] 90% test coverage for modified services
- [ ] Unit tests verify capabilities injection
- [ ] Integration tests verify end-to-end rule evaluation
- [ ] Migration tests verify old rules fail compilation

## Testing Requirements

### Unit Tests

**`TenantSessionManagerTest.java`:**
```java
package com.fluo.services;

import org.junit.jupiter.api.Test;
import org.kie.api.runtime.KieSession;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class TenantSessionManagerTest {

    @Test
    public void testGetSession_InjectsCapabilities() {
        TenantSessionManager manager = new TenantSessionManager();
        manager.container = mock(KieContainer.class);
        manager.safeCapabilities = mock(SafeRuleCapabilities.class);

        KieSession session = mock(KieSession.class);
        when(manager.container.newKieSession()).thenReturn(session);

        KieSession result = manager.getSession("tenant-1");

        // Verify capabilities set as global
        verify(session).setGlobal("capabilities", manager.safeCapabilities);

        // Verify signalService NOT set
        verify(session, never()).setGlobal(eq("signalService"), any());
    }

    @Test
    public void testCloseSession_DisposesSession() {
        TenantSessionManager manager = new TenantSessionManager();
        KieSession session = mock(KieSession.class);
        manager.tenantSessions.put("tenant-1", session);

        manager.closeSession("tenant-1");

        verify(session).dispose();
        assertFalse(manager.tenantSessions.containsKey("tenant-1"));
    }
}
```

**`DroolsGeneratorTest.java` (additions):**
```java
@Test
public void testGenerate_UsesCapabilitiesGlobal() {
    RuleExpression ast = new HasExpression("span.duration", ">", 5000);
    String drl = generator.generate(ast, "rule-1", "Slow Request");

    // Verify capabilities global declared
    assertTrue(drl.contains("global RuleCapabilities capabilities"));

    // Verify signalService NOT present
    assertFalse(drl.contains("SignalService"));
    assertFalse(drl.contains("signalService"));

    // Verify capabilities.createSignal() called
    assertTrue(drl.contains("capabilities.createSignal("));
}

@Test
public void testGenerate_IncludesRuleIdAndName() {
    RuleExpression ast = new HasExpression("span.duration", ">", 5000);
    String drl = generator.generate(ast, "rule-123", "Test Rule");

    assertTrue(drl.contains("\"rule-123\""));
    assertTrue(drl.contains("\"Test Rule\""));
}
```

**`RuleEvaluationServiceTest.java`:**
```java
@Test
public void testEvaluateSpan_SetsAndClearsContext() {
    RuleEvaluationService service = new RuleEvaluationService();
    service.sessionManager = mock(TenantSessionManager.class);

    KieSession session = mock(KieSession.class);
    when(service.sessionManager.getSession("tenant-1")).thenReturn(session);

    Span span = new Span("trace-1", "span-1", 1000);

    // Spy on SafeRuleCapabilities static methods
    try (MockedStatic<SafeRuleCapabilities> mockedStatic = mockStatic(SafeRuleCapabilities.class)) {
        service.evaluateSpan("tenant-1", "rule-1", span);

        // Verify context set
        mockedStatic.verify(() ->
            SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1")
        );

        // Verify context cleared
        mockedStatic.verify(() -> SafeRuleCapabilities.clearContext());
    }
}

@Test
public void testEvaluateSpan_ClearsContextOnException() {
    RuleEvaluationService service = new RuleEvaluationService();
    service.sessionManager = mock(TenantSessionManager.class);

    when(service.sessionManager.getSession("tenant-1")).thenThrow(new RuntimeException("Test exception"));

    Span span = new Span("trace-1", "span-1", 1000);

    try (MockedStatic<SafeRuleCapabilities> mockedStatic = mockStatic(SafeRuleCapabilities.class)) {
        assertThrows(RuntimeException.class, () ->
            service.evaluateSpan("tenant-1", "rule-1", span)
        );

        // Verify context still cleared despite exception
        mockedStatic.verify(() -> SafeRuleCapabilities.clearContext());
    }
}
```

### Integration Tests

**`RuleEngineIntegrationTest.java`:**
```java
package com.fluo.security;

import org.junit.jupiter.api.Test;
import io.quarkus.test.junit.QuarkusTest;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
public class RuleEngineIntegrationTest {

    @Test
    public void testEndToEnd_RuleCreatesSignal() {
        // Generate rule from DSL
        RuleExpression ast = new HasExpression("span.duration", ">", 5000);
        String drl = droolsGenerator.generate(ast, "rule-1", "Slow Request");

        // Deploy rule for tenant
        ruleEngine.compileAndDeployRules("tenant-1", List.of(drl));

        // Create slow span
        Span slowSpan = new Span("trace-1", "span-1", 6000);

        // Evaluate span
        ruleEvaluationService.evaluateSpan("tenant-1", "rule-1", slowSpan);

        // Verify signal created
        List<Signal> signals = signalService.getSignalsForTenant("tenant-1");
        assertEquals(1, signals.size());
        assertEquals("rule-1", signals.get(0).getRuleId());

        // Verify audit event in TigerBeetle
        List<TBTransfer> auditLog = tbClient.getAccountTransfers(
            ruleAccountId("tenant-1", "rule-1"),
            filterByCode: 7
        );
        assertEquals(1, auditLog.size());

        // Verify compliance span
        List<ComplianceSpan> complianceSpans = complianceService.getSpans("tenant-1", "SOC2", "CC6.6");
        assertEquals(1, complianceSpans.size());
    }

    @Test
    public void testOldRules_FailCompilation() {
        // Old DRL with unsafe signalService global
        String oldDrl = """
            package com.fluo.rules;
            global com.fluo.services.SignalService signalService;

            rule "Old Rule"
            when
                $span: Span()
            then
                signalService.createSignal("rule-1", "Test", Map.of());
            end
            """;

        // Should fail compilation
        assertThrows(DroolsCompilationException.class, () -> {
            ruleEngine.compileAndDeployRules("tenant-1", List.of(oldDrl));
        });
    }
}
```

## Files to Create

**Documentation:**
- `backend/SANDBOX_MIGRATION.md` - Migration guide for existing rules

**Tests - Unit Tests:**
- `backend/src/test/java/com/fluo/services/TenantSessionManagerTest.java` (additions)
- `backend/src/test/java/com/fluo/rules/dsl/DroolsGeneratorTest.java` (additions)
- `backend/src/test/java/com/fluo/services/RuleEvaluationServiceTest.java` (new)

**Tests - Integration Tests:**
- `backend/src/test/java/com/fluo/security/RuleEngineIntegrationTest.java`

## Files to Modify

**Backend - Core Services:**
- `backend/src/main/java/com/fluo/services/TenantSessionManager.java`
  - Replace `@Inject SignalService signalService` with `@Inject SafeRuleCapabilities safeCapabilities`
  - Change `session.setGlobal("signalService", signalService)` to `session.setGlobal("capabilities", safeCapabilities)`

**Backend - Rule Engine:**
- `backend/src/main/java/com/fluo/rules/dsl/DroolsGenerator.java`
  - Change `global SignalService signalService` to `global RuleCapabilities capabilities`
  - Change all `signalService.*` calls to `capabilities.*` calls
  - Add import for RuleCapabilities interface

**Backend - Rule Evaluation:**
- `backend/src/main/java/com/fluo/services/RuleEvaluationService.java`
  - Add `SafeRuleCapabilities.setContext()` before evaluation
  - Add `SafeRuleCapabilities.clearContext()` in finally block

## Dependencies

**Requires:**
- Unit A: SafeRuleCapabilities (foundation)
- Unit B: Camel audit routes (audit logging)
- Unit C: Compliance spans (evidence generation)

**Blocks:**
- Unit E: Security tests need integrated rule engine

## Migration Impact

**Breaking Changes:**
- All existing DRL rules must be regenerated
- No backward compatibility with old `signalService` global

**Migration Path:**
1. Regenerate rules from FLUO DSL (automated)
2. Update custom DRL files (manual search/replace)
3. Test rule behavior with sandbox constraints
4. Verify audit trails and compliance spans

**Rollout Strategy:**
1. Deploy sandbox changes to staging
2. Regenerate all production rules
3. Test signal creation and audit logging
4. Deploy to production with monitoring
5. Alert on any rule compilation failures
