package com.betrace.security.capabilities;

import com.betrace.model.Signal;
import com.betrace.model.Span;
import com.betrace.services.SignalService;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Comprehensive security tests for PRD-005 Phase 1 capability infrastructure.
 *
 * Test Coverage (95% instruction coverage target):
 * - P0: Tenant isolation enforcement
 * - P0: Defensive copying of mutable data
 * - P0: Input validation
 * - Read-only interface guarantees
 */
@DisplayName("PRD-005 Capability Security Tests")
class CapabilitySecurityTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";

    // ========== ImmutableSpanWrapper Security Tests ==========

    @Test
    @DisplayName("P0: ImmutableSpanWrapper.forTenant() rejects cross-tenant spans")
    void testSpanWrapper_TenantIsolation() {
        // Arrange
        Span span = createTestSpan(TENANT_A);

        // Act & Assert
        SecurityException exception = assertThrows(SecurityException.class, () -> {
            ImmutableSpanWrapper.forTenant(span, TENANT_B);
        });
        assertTrue(exception.getMessage().contains("Tenant isolation violation"));
    }

    @Test
    @DisplayName("P0: ImmutableSpanWrapper.forTenant() accepts matching tenant")
    void testSpanWrapper_TenantMatch() {
        // Arrange
        Span span = createTestSpan(TENANT_A);

        // Act
        ImmutableSpanWrapper wrapper = ImmutableSpanWrapper.forTenant(span, TENANT_A);

        // Assert
        assertNotNull(wrapper);
        assertEquals(TENANT_A, wrapper.getTenantId());
    }

    @Test
    @DisplayName("P0: ImmutableSpanWrapper getAttributes() returns defensive copy")
    void testSpanWrapper_DefensiveCopy() {
        // Arrange
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("key1", "value1");
        Span span = createTestSpanWithAttributes(TENANT_A, attributes);
        ImmutableSpanWrapper wrapper = new ImmutableSpanWrapper(span);

        // Act & Assert - Attempt to modify returned map should throw
        Map<String, Object> attrs = wrapper.getAttributes();
        assertThrows(UnsupportedOperationException.class, () -> {
            attrs.put("malicious", "injection");
        });
        assertThrows(UnsupportedOperationException.class, () -> {
            attrs.remove("key1");
        });

        // Assert - Map is unmodifiable
        assertTrue(attrs.containsKey("key1"));
        assertFalse(attrs.containsKey("malicious"));
    }

    @Test
    @DisplayName("ImmutableSpanWrapper null span rejected")
    void testSpanWrapper_NullSpan() {
        // Act & Assert
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            new ImmutableSpanWrapper(null);
        });
        assertTrue(exception.getMessage().contains("Span cannot be null"));
    }

    // ========== SandboxedGlobals Security Tests ==========

    @Test
    @DisplayName("P0: SandboxedGlobals rejects tenant mismatch")
    void testSandboxedGlobals_TenantMismatch() {
        // Arrange
        SignalCapability capability = mock(SignalCapability.class);
        when(capability.getTenantId()).thenReturn(TENANT_A);

        // Act & Assert
        SecurityException exception = assertThrows(SecurityException.class, () -> {
            new SandboxedGlobals(capability, TENANT_B);
        });
        assertTrue(exception.getMessage().contains("SignalCapability tenant mismatch"));
    }

    @Test
    @DisplayName("P0: SandboxedGlobals accepts matching tenant")
    void testSandboxedGlobals_TenantMatch() {
        // Arrange
        SignalCapability capability = mock(SignalCapability.class);
        when(capability.getTenantId()).thenReturn(TENANT_A);

        // Act
        SandboxedGlobals globals = new SandboxedGlobals(capability, TENANT_A);

        // Assert
        assertNotNull(globals);
        assertEquals(TENANT_A, globals.getTenantId());
    }

    @Test
    @DisplayName("SandboxedGlobals delegates createSignal to capability")
    void testSandboxedGlobals_Delegation() {
        // Arrange
        SignalCapability capability = mock(SignalCapability.class);
        when(capability.getTenantId()).thenReturn(TENANT_A);
        SandboxedGlobals globals = new SandboxedGlobals(capability, TENANT_A);

        // Act
        globals.createSignal("rule-001", "Test message");

        // Assert
        verify(capability, times(1)).createSignal("rule-001", "Test message");
    }

    // ========== ImmutableSignalCapability Security Tests ==========

    @Test
    @DisplayName("P0: ImmutableSignalCapability enforces tenant context")
    void testSignalCapability_TenantEnforcement() {
        // Arrange
        SignalService mockService = mock(SignalService.class);
        ImmutableSignalCapability capability = new ImmutableSignalCapability(TENANT_A, mockService);

        // Act
        capability.createSignal("rule-001", "Test message");

        // Assert - Verify signal created with correct tenant
        verify(mockService, times(1)).emit(argThat(signal ->
            TENANT_A.equals(signal.tenantId())
        ));
    }

    @Test
    @DisplayName("P0: ImmutableSignalCapability validates ruleId")
    void testSignalCapability_RuleIdValidation() {
        // Arrange
        SignalService mockService = mock(SignalService.class);
        ImmutableSignalCapability capability = new ImmutableSignalCapability(TENANT_A, mockService);

        // Act & Assert
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            capability.createSignal(null, "Test message");
        });
        assertTrue(exception.getMessage().contains("RuleId cannot be null or blank"));
    }

    @Test
    @DisplayName("P0: ImmutableSignalCapability validates message")
    void testSignalCapability_MessageValidation() {
        // Arrange
        SignalService mockService = mock(SignalService.class);
        ImmutableSignalCapability capability = new ImmutableSignalCapability(TENANT_A, mockService);

        // Act & Assert
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            capability.createSignal("rule-001", null);
        });
        assertTrue(exception.getMessage().contains("Message cannot be null or blank"));
    }

    @Test
    @DisplayName("ImmutableSignalCapability handles invalid severity gracefully")
    void testSignalCapability_InvalidSeverity() {
        // Arrange
        SignalService mockService = mock(SignalService.class);
        ImmutableSignalCapability capability = new ImmutableSignalCapability(TENANT_A, mockService);

        // Act - Should not throw, but default to MEDIUM
        capability.createSignal("rule-001", "Test message", "INVALID");

        // Assert - Verify signal created with MEDIUM severity
        verify(mockService, times(1)).emit(argThat(signal ->
            Signal.SignalSeverity.MEDIUM.equals(signal.severity())
        ));
    }

    @Test
    @DisplayName("ImmutableSignalCapability null tenantId rejected")
    void testSignalCapability_NullTenantId() {
        // Arrange
        SignalService mockService = mock(SignalService.class);

        // Act & Assert
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            new ImmutableSignalCapability(null, mockService);
        });
        assertTrue(exception.getMessage().contains("TenantId cannot be null or blank"));
    }

    // ========== P0-2: Reflection Attack Tests ==========

    /**
     * P0-2 Bytecode Enforcement Test.
     *
     * Validates SandboxAgent bytecode transformation blocks reflection attacks.
     *
     * Requires:
     * - SandboxAgent loaded via -javaagent flag
     * - security.tests.enabled=true system property
     *
     * Maven configuration:
     * - Surefire plugin loads agent via argLine
     * - System property set in systemPropertyVariables
     */
    @Test
    @DisplayName("P0-2: Bytecode enforcement blocks setAccessible() during rule execution")
    void testBytecodeEnforcement_BlocksReflection() {
        // Arrange
        SignalService mockService = mock(SignalService.class);
        ImmutableSignalCapability capability = new ImmutableSignalCapability(TENANT_A, mockService);
        SandboxedGlobals globals = new SandboxedGlobals(capability, TENANT_A);

        // Import SandboxContext
        com.betrace.security.agent.SandboxContext.enterRuleExecution();

        try {
            // Act & Assert - Attempt reflection attack
            SecurityException exception = assertThrows(SecurityException.class, () -> {
                try {
                    java.lang.reflect.Field field = globals.getClass().getDeclaredField("signalCapability");
                    field.setAccessible(true);  // Should throw SecurityException (bytecode-level)
                } catch (NoSuchFieldException e) {
                    fail("Test setup error: signalCapability field not found");
                }
            });
            assertTrue(exception.getMessage().contains("Sandbox violation") ||
                       exception.getMessage().contains("setAccessible"));

        } finally {
            // Cleanup rule execution context
            com.betrace.security.agent.SandboxContext.exitRuleExecution();
        }
    }

    @Test
    @DisplayName("P0-3: Deep defensive copying prevents nested collection mutation")
    void testSpanWrapper_DeepDefensiveCopy() {
        // Arrange - Create span with nested List in attributes
        Map<String, Object> attributes = new HashMap<>();
        java.util.List<String> tags = new java.util.ArrayList<>();
        tags.add("tag1");
        tags.add("tag2");
        attributes.put("tags", tags);

        Span span = createTestSpanWithAttributes(TENANT_A, attributes);
        ImmutableSpanWrapper wrapper = new ImmutableSpanWrapper(span);

        // Act - Attempt to modify nested list
        Map<String, Object> attrs = wrapper.getAttributes();
        Object tagsObj = attrs.get("tags");

        // Assert - Nested list should be immutable
        assertThrows(UnsupportedOperationException.class, () -> {
            @SuppressWarnings("unchecked")
            java.util.List<String> tagsList = (java.util.List<String>) tagsObj;
            tagsList.add("malicious");  // Should throw UnsupportedOperationException
        });
    }

    // ========== Helper Methods ==========

    private Span createTestSpan(String tenantId) {
        return Span.create(
            "span-123",
            "trace-456",
            "GET /api/test",
            "test-service",
            Instant.now().minusSeconds(5),
            Instant.now(),
            new HashMap<>()
        );
    }

    private Span createTestSpanWithAttributes(String tenantId, Map<String, Object> attributes) {
        return Span.create(
            "span-123",
            "trace-456",
            "GET /api/test",
            "test-service",
            Instant.now().minusSeconds(5),
            Instant.now(),
            attributes
        );
    }
}
