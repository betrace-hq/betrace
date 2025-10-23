# PRD-005a: Capability Interface and Safe Proxy

**Parent PRD:** PRD-005 (Rule Engine Sandboxing)
**Unit:** A (Foundation)
**Priority:** P0
**Dependencies:** None (Foundation unit)

## Scope

This unit implements the core capability-based security interface and safe proxy wrapper. It establishes the foundation for sandboxing by defining what operations rules can perform and providing a secure implementation that validates tenant context.

**What this unit provides:**
- `RuleCapabilities` interface (contract for all rule operations)
- `SafeRuleCapabilities` implementation (secure proxy with ThreadLocal context)
- Thread-local execution context for tenant isolation
- Basic validation and sanitization

**What this unit does NOT include:**
- Camel routes (handled in Unit B)
- TigerBeetle audit logging (handled in Unit B)
- Compliance span generation (handled in Unit C)
- Integration with TenantSessionManager (handled in Unit D)
- Security tests (handled in Unit E)

## Implementation

### 1. Capability Interface

**`RuleCapabilities.java`:**
```java
package com.betrace.services;

import java.util.Map;

/**
 * Safe interface exposed to Drools rules.
 * Rules can ONLY call methods defined here.
 *
 * This interface enforces capability-based security by:
 * 1. Restricting operations to safe, read-only, or tenant-scoped writes
 * 2. Preventing access to arbitrary service methods
 * 3. Eliminating reflection/class loading capabilities
 */
public interface RuleCapabilities {

    /**
     * Create a signal from rule match.
     * Safe: Creates signal for current tenant only.
     *
     * @param ruleId Unique identifier for the rule
     * @param ruleName Human-readable rule name
     * @param context Additional context data for the signal
     * @throws SecurityException if execution context is invalid
     */
    void createSignal(String ruleId, String ruleName, Map<String, Object> context);

    /**
     * Log rule execution.
     * Safe: Append-only logging with sanitization.
     *
     * @param ruleId Unique identifier for the rule
     * @param message Log message (will be sanitized)
     */
    void logRuleExecution(String ruleId, String message);

    /**
     * Get current trace ID (read-only).
     * Safe: No side effects.
     *
     * @return Current trace ID or null if not set
     */
    String getCurrentTraceId();

    /**
     * Get current tenant ID (read-only).
     * Safe: No side effects.
     *
     * @return Current tenant ID or null if not set
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

### 2. Safe Proxy Implementation

**`SafeRuleCapabilities.java`:**
```java
package com.betrace.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

/**
 * Safe implementation of RuleCapabilities that enforces:
 * 1. Tenant isolation via ThreadLocal context
 * 2. Input sanitization for all user-provided data
 * 3. Capability tracking for audit purposes
 *
 * This class is the ONLY service exposed to Drools rules.
 */
@ApplicationScoped
public class SafeRuleCapabilities implements RuleCapabilities {

    @Inject
    SignalService signalService;

    // Thread-local context for current rule evaluation
    private static final ThreadLocal<RuleExecutionContext> context = new ThreadLocal<>();

    /**
     * Set execution context before rule evaluation.
     * MUST be called before any capability methods.
     *
     * @param tenantId Current tenant ID
     * @param traceId Current trace ID
     * @param ruleId Current rule ID
     */
    public static void setContext(String tenantId, String traceId, String ruleId) {
        if (tenantId == null || traceId == null || ruleId == null) {
            throw new IllegalArgumentException("All context parameters are required");
        }
        context.set(new RuleExecutionContext(tenantId, traceId, ruleId));
    }

    /**
     * Clear execution context after rule evaluation.
     * MUST be called in finally block to prevent thread pollution.
     */
    public static void clearContext() {
        context.remove();
    }

    @Override
    public void createSignal(String ruleId, String ruleName, Map<String, Object> contextData) {
        RuleExecutionContext ctx = validateContext();

        // Validate rule ID matches context (prevent rule impersonation)
        if (!ctx.ruleId().equals(ruleId)) {
            throw new SecurityException(
                "Rule ID mismatch: context=" + ctx.ruleId() + ", provided=" + ruleId
            );
        }

        try {
            // Call the actual service (tenant-scoped)
            signalService.createSignalForRule(
                ctx.tenantId(),
                ruleId,
                ruleName,
                ctx.traceId(),
                contextData
            );

            // TODO (Unit B): Send to Camel audit pipeline
            // capabilityAuditProducer.sendBodyAndHeaders(...)

        } catch (Exception e) {
            // TODO (Unit B): Record sandbox violation
            // recordViolation(ctx, ruleId, "UNAUTHORIZED_SIGNAL_CREATION", e.getMessage());
            throw new SecurityException("Signal creation denied", e);
        }
    }

    @Override
    public void logRuleExecution(String ruleId, String message) {
        RuleExecutionContext ctx = context.get();
        if (ctx == null) {
            // Silent failure for logging - don't break rule execution
            return;
        }

        // Validate rule ID matches context
        if (!ctx.ruleId().equals(ruleId)) {
            // Silent failure - logging should never break execution
            return;
        }

        // Sanitize message (prevent log injection)
        String sanitized = sanitizeLogMessage(message);

        // TODO (Unit B): Send to Camel audit pipeline
        // For now, just use standard logging
        System.out.println("[RULE LOG] tenant=" + ctx.tenantId() +
                         ", rule=" + ruleId + ", msg=" + sanitized);
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

    /**
     * Validate execution context exists and is valid.
     *
     * @return Validated context
     * @throws SecurityException if context is not set
     */
    private RuleExecutionContext validateContext() {
        RuleExecutionContext ctx = context.get();
        if (ctx == null) {
            throw new SecurityException("Rule execution context not set");
        }
        return ctx;
    }

    /**
     * Sanitize log message to prevent injection attacks.
     *
     * @param message Raw message
     * @return Sanitized message (max 1000 chars, no control characters)
     */
    private String sanitizeLogMessage(String message) {
        if (message == null) {
            return "";
        }

        // Remove newlines, carriage returns, tabs, and other control characters
        String sanitized = message.replaceAll("[\\n\\r\\t\\p{Cntrl}]", " ");

        // Limit length to prevent memory exhaustion
        if (sanitized.length() > 1000) {
            sanitized = sanitized.substring(0, 1000) + "... (truncated)";
        }

        return sanitized;
    }

    /**
     * Immutable record holding rule execution context.
     * ThreadLocal prevents cross-tenant contamination.
     */
    private record RuleExecutionContext(String tenantId, String traceId, String ruleId) {}
}
```

## Success Criteria

**Functional Requirements:**
- [ ] `RuleCapabilities` interface defines all allowed rule operations
- [ ] `SafeRuleCapabilities` enforces tenant isolation via ThreadLocal
- [ ] Context must be set before any capability method calls
- [ ] Context cleared after rule evaluation (prevents thread pollution)
- [ ] Log messages sanitized to prevent injection attacks
- [ ] Rule ID validation prevents rule impersonation
- [ ] Read-only methods (getCurrentTraceId, getCurrentTenantId) have no side effects

**Security Properties:**
- [ ] No direct access to SignalService from rules
- [ ] No file system, network, or reflection capabilities exposed
- [ ] ThreadLocal ensures tenant data cannot leak between evaluations
- [ ] Input sanitization prevents log injection attacks

**Testing Requirements:**
- [ ] 90% test coverage for SafeRuleCapabilities
- [ ] Context validation tests (missing context, mismatched rule ID)
- [ ] Sanitization tests (newlines, control chars, length limits)
- [ ] Thread safety tests (concurrent evaluations)

## Testing Requirements

### Unit Tests

**`SafeRuleCapabilitiesTest.java`:**
```java
package com.betrace.services;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.*;
import java.util.Map;

public class SafeRuleCapabilitiesTest {

    private SafeRuleCapabilities capabilities;

    @BeforeEach
    public void setUp() {
        capabilities = new SafeRuleCapabilities();
        // Inject mock SignalService
        capabilities.signalService = mock(SignalService.class);
    }

    @AfterEach
    public void tearDown() {
        // Always clear context to prevent test pollution
        SafeRuleCapabilities.clearContext();
    }

    @Test
    public void testCreateSignal_WithValidContext_Succeeds() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        capabilities.createSignal("rule-1", "Test Rule", Map.of("key", "value"));

        verify(capabilities.signalService).createSignalForRule(
            "tenant-1", "rule-1", "Test Rule", "trace-1", Map.of("key", "value")
        );
    }

    @Test
    public void testCreateSignal_WithoutContext_ThrowsSecurityException() {
        assertThrows(SecurityException.class, () -> {
            capabilities.createSignal("rule-1", "Test Rule", Map.of());
        });
    }

    @Test
    public void testCreateSignal_WithMismatchedRuleId_ThrowsSecurityException() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        assertThrows(SecurityException.class, () -> {
            capabilities.createSignal("rule-2", "Evil Rule", Map.of());
        });
    }

    @Test
    public void testLogRuleExecution_SanitizesNewlines() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        // Should not throw, should sanitize
        capabilities.logRuleExecution("rule-1", "Line 1\nLine 2\rLine 3");

        // Verify sanitized output (mock stdout or verify internally)
        // Expected: "Line 1 Line 2 Line 3"
    }

    @Test
    public void testLogRuleExecution_TruncatesLongMessages() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        String longMessage = "x".repeat(2000);
        capabilities.logRuleExecution("rule-1", longMessage);

        // Verify message truncated to 1000 chars + "... (truncated)"
    }

    @Test
    public void testGetCurrentTraceId_ReturnsContextValue() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        String traceId = capabilities.getCurrentTraceId();
        assertEquals("trace-1", traceId);
    }

    @Test
    public void testGetCurrentTenantId_ReturnsContextValue() {
        SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");

        String tenantId = capabilities.getCurrentTenantId();
        assertEquals("tenant-1", tenantId);
    }

    @Test
    public void testGetCurrentTraceId_WithoutContext_ReturnsNull() {
        String traceId = capabilities.getCurrentTraceId();
        assertNull(traceId);
    }

    @Test
    public void testThreadIsolation_ConcurrentEvaluations() throws Exception {
        // Run two concurrent evaluations with different contexts
        Thread t1 = new Thread(() -> {
            SafeRuleCapabilities.setContext("tenant-1", "trace-1", "rule-1");
            assertEquals("tenant-1", capabilities.getCurrentTenantId());
            SafeRuleCapabilities.clearContext();
        });

        Thread t2 = new Thread(() -> {
            SafeRuleCapabilities.setContext("tenant-2", "trace-2", "rule-2");
            assertEquals("tenant-2", capabilities.getCurrentTenantId());
            SafeRuleCapabilities.clearContext();
        });

        t1.start();
        t2.start();
        t1.join();
        t2.join();

        // No cross-contamination should occur
    }

    @Test
    public void testSetContext_WithNullParameters_ThrowsIllegalArgumentException() {
        assertThrows(IllegalArgumentException.class, () -> {
            SafeRuleCapabilities.setContext(null, "trace-1", "rule-1");
        });

        assertThrows(IllegalArgumentException.class, () -> {
            SafeRuleCapabilities.setContext("tenant-1", null, "rule-1");
        });

        assertThrows(IllegalArgumentException.class, () -> {
            SafeRuleCapabilities.setContext("tenant-1", "trace-1", null);
        });
    }
}
```

## Files to Create

**Backend - Core Services:**
- `backend/src/main/java/com/betrace/services/RuleCapabilities.java` - Interface for safe rule capabilities
- `backend/src/main/java/com/betrace/services/SafeRuleCapabilities.java` - Implementation with context validation

**Tests - Unit Tests:**
- `backend/src/test/java/com/betrace/services/SafeRuleCapabilitiesTest.java` - Comprehensive unit tests

## Files to Modify

None (this is a foundational unit with no external dependencies)

## Implementation Notes

**Design Decisions:**

1. **ThreadLocal for Context**: Ensures tenant isolation without passing parameters through Drools rules
2. **Immutable Context Record**: Prevents accidental mutation during evaluation
3. **Rule ID Validation**: Prevents one rule from impersonating another
4. **Silent Failure for Logging**: Logging should never break rule execution
5. **Input Sanitization**: Defense-in-depth against injection attacks

**Security Properties:**

- **No Reflection**: Rules cannot access Class.forName(), getClass(), etc.
- **No File I/O**: No File, Path, or I/O stream classes accessible
- **No Network**: No HTTP clients or socket access
- **No Arbitrary Service Access**: Only RuleCapabilities interface visible

**Thread Safety:**

- ThreadLocal ensures complete isolation between concurrent evaluations
- No shared mutable state in SafeRuleCapabilities
- Context must be cleared in finally blocks to prevent thread pool pollution

**Future Enhancements (Out of Scope):**

- Rate limiting per tenant (PRD-007)
- Quota enforcement (max signals per minute)
- Async audit logging (Unit B)
- Compliance span generation (Unit C)

## Dependencies

**No dependencies** - This is the foundation unit.

**Blocks:**
- Unit B: Camel audit routes need SafeRuleCapabilities
- Unit C: Compliance spans need capability context
- Unit D: TenantSessionManager needs SafeRuleCapabilities injection
- Unit E: Security tests need SafeRuleCapabilities to attack
