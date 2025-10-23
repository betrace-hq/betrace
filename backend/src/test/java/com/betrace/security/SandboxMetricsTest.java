package com.betrace.security;

import com.betrace.security.agent.SandboxContext;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for PRD-006 Unit 1: Sandbox Performance Monitoring
 *
 * Validates Micrometer metrics integration with SandboxContext:
 * - Invocation counting (enter/exit operations)
 * - Execution duration timing
 * - Violation tracking by type and tenant
 * - Thread-local tenant isolation
 *
 * Test Categories:
 * 1. Invocation Metrics (3 tests)
 * 2. Duration Metrics (3 tests)
 * 3. Violation Metrics (4 tests)
 * 4. Tenant Isolation (2 tests)
 * 5. Edge Cases (3 tests)
 */
@DisplayName("PRD-006 Sandbox Metrics Tests")
class SandboxMetricsTest {

    private MeterRegistry meterRegistry;

    @BeforeEach
    void setUp() {
        // Use SimpleMeterRegistry for testing (no external dependencies)
        meterRegistry = new SimpleMeterRegistry();
        SandboxContext.setMeterRegistry(meterRegistry);
        SandboxContext.clear(); // Clear any previous thread-local state
    }

    @AfterEach
    void tearDown() {
        SandboxContext.clear();
    }

    // ========== Invocation Metrics Tests ==========

    @Test
    @DisplayName("enterRuleExecution increments invocation counter")
    void testEnterRuleExecution_IncrementsCounter() {
        // Act
        SandboxContext.enterRuleExecution();

        // Assert
        Counter counter = meterRegistry.find("sandbox.invocations.total")
                .tag("operation", "enter")
                .tag("tenant", "unknown")
                .counter();

        assertNotNull(counter, "Invocation counter should exist");
        assertEquals(1.0, counter.count(), "Counter should be incremented once");
    }

    @Test
    @DisplayName("exitRuleExecution increments exit counter")
    void testExitRuleExecution_IncrementsCounter() {
        // Arrange
        SandboxContext.enterRuleExecution();

        // Act
        SandboxContext.exitRuleExecution();

        // Assert
        Counter exitCounter = meterRegistry.find("sandbox.invocations.total")
                .tag("operation", "exit")
                .tag("tenant", "unknown")
                .counter();

        assertNotNull(exitCounter, "Exit counter should exist");
        assertEquals(1.0, exitCounter.count(), "Exit counter should be incremented once");
    }

    @Test
    @DisplayName("Multiple invocations accumulate counter correctly")
    void testMultipleInvocations_AccumulateCounter() {
        // Act: Enter and exit 5 times
        for (int i = 0; i < 5; i++) {
            SandboxContext.enterRuleExecution();
            SandboxContext.exitRuleExecution();
        }

        // Assert
        Counter enterCounter = meterRegistry.find("sandbox.invocations.total")
                .tag("operation", "enter")
                .counter();
        Counter exitCounter = meterRegistry.find("sandbox.invocations.total")
                .tag("operation", "exit")
                .counter();

        assertEquals(5.0, enterCounter.count(), "Enter counter should be 5");
        assertEquals(5.0, exitCounter.count(), "Exit counter should be 5");
    }

    // ========== Duration Metrics Tests ==========

    @Test
    @DisplayName("exitRuleExecution records execution duration")
    void testExitRuleExecution_RecordsDuration() throws InterruptedException {
        // Arrange
        SandboxContext.enterRuleExecution();

        // Act: Simulate some work
        Thread.sleep(10); // 10ms
        SandboxContext.exitRuleExecution();

        // Assert
        Timer timer = meterRegistry.find("sandbox.execution.duration")
                .tag("tenant", "unknown")
                .timer();

        assertNotNull(timer, "Duration timer should exist");
        assertEquals(1, timer.count(), "Timer should record one execution");
        assertTrue(timer.totalTime(TimeUnit.MILLISECONDS) >= 10,
                "Duration should be at least 10ms");
    }

    @Test
    @DisplayName("Duration timer tracks multiple executions")
    void testDurationTimer_TracksMultipleExecutions() throws InterruptedException {
        // Act: Execute 3 times with different durations
        for (int i = 0; i < 3; i++) {
            SandboxContext.enterRuleExecution();
            Thread.sleep(5); // 5ms each
            SandboxContext.exitRuleExecution();
        }

        // Assert
        Timer timer = meterRegistry.find("sandbox.execution.duration")
                .tag("tenant", "unknown")
                .timer();

        assertEquals(3, timer.count(), "Timer should record 3 executions");
        assertTrue(timer.totalTime(TimeUnit.MILLISECONDS) >= 15,
                "Total duration should be at least 15ms");
    }

    @Test
    @DisplayName("Duration timer handles instant execution (zero duration)")
    void testDurationTimer_HandlesZeroDuration() {
        // Act: Enter and immediately exit (near-zero duration)
        SandboxContext.enterRuleExecution();
        SandboxContext.exitRuleExecution();

        // Assert
        Timer timer = meterRegistry.find("sandbox.execution.duration")
                .tag("tenant", "unknown")
                .timer();

        assertNotNull(timer, "Timer should exist even for instant execution");
        assertEquals(1, timer.count(), "Timer should record the execution");
        assertTrue(timer.totalTime(TimeUnit.NANOSECONDS) >= 0,
                "Duration should be non-negative");
    }

    // ========== Violation Metrics Tests ==========

    @Test
    @DisplayName("recordViolation increments violation counter")
    void testRecordViolation_IncrementsCounter() {
        // Act
        SandboxContext.recordViolation("java/lang/Runtime.exec");

        // Assert
        Counter counter = meterRegistry.find("sandbox.violations.total")
                .tag("violation_type", "java/lang/Runtime.exec")
                .tag("tenant", "unknown")
                .counter();

        assertNotNull(counter, "Violation counter should exist");
        assertEquals(1.0, counter.count(), "Violation counter should be incremented");
    }

    @Test
    @DisplayName("recordViolation tracks different violation types separately")
    void testRecordViolation_TracksSeparateTypes() {
        // Act: Record different violation types
        SandboxContext.recordViolation("java/lang/Runtime.exec");
        SandboxContext.recordViolation("java/lang/Runtime.exec");
        SandboxContext.recordViolation("java/lang/reflect/Method.setAccessible");

        // Assert
        Counter runtimeCounter = meterRegistry.find("sandbox.violations.total")
                .tag("violation_type", "java/lang/Runtime.exec")
                .counter();
        Counter reflectionCounter = meterRegistry.find("sandbox.violations.total")
                .tag("violation_type", "java/lang/reflect/Method.setAccessible")
                .counter();

        assertEquals(2.0, runtimeCounter.count(), "Runtime.exec violations should be 2");
        assertEquals(1.0, reflectionCounter.count(), "setAccessible violations should be 1");
    }

    @Test
    @DisplayName("recordViolation handles null violation type gracefully")
    void testRecordViolation_HandlesNullType() {
        // Act & Assert: Should not throw exception
        assertDoesNotThrow(() -> {
            SandboxContext.recordViolation(null);
        });
    }

    @Test
    @DisplayName("recordViolation handles empty violation type")
    void testRecordViolation_HandlesEmptyType() {
        // Act
        SandboxContext.recordViolation("");

        // Assert: Metric should still be recorded
        Counter counter = meterRegistry.find("sandbox.violations.total")
                .tag("violation_type", "")
                .counter();

        assertNotNull(counter, "Counter should exist for empty violation type");
        assertEquals(1.0, counter.count());
    }

    // ========== Tenant Isolation Tests ==========

    @Test
    @DisplayName("Metrics are tagged with correct tenant ID")
    void testMetrics_TenantTagging() {
        // Arrange
        SandboxContext.setTenant("tenant-123");

        // Act
        SandboxContext.enterRuleExecution();
        SandboxContext.recordViolation("java/lang/System.exit");

        // Assert
        Counter invocationCounter = meterRegistry.find("sandbox.invocations.total")
                .tag("tenant", "tenant-123")
                .counter();
        Counter violationCounter = meterRegistry.find("sandbox.violations.total")
                .tag("tenant", "tenant-123")
                .counter();

        assertNotNull(invocationCounter, "Invocation counter should have tenant tag");
        assertNotNull(violationCounter, "Violation counter should have tenant tag");
        assertEquals(1.0, invocationCounter.count());
        assertEquals(1.0, violationCounter.count());
    }

    @Test
    @DisplayName("Different tenants have separate metric tags")
    void testMetrics_TenantIsolation() {
        // Act: Simulate two different tenants
        SandboxContext.setTenant("tenant-a");
        SandboxContext.enterRuleExecution();
        SandboxContext.exitRuleExecution();

        SandboxContext.setTenant("tenant-b");
        SandboxContext.enterRuleExecution();
        SandboxContext.exitRuleExecution();

        // Assert: Metrics should be separate by tenant
        Counter counterTenantA = meterRegistry.find("sandbox.invocations.total")
                .tag("operation", "enter")
                .tag("tenant", "tenant-a")
                .counter();
        Counter counterTenantB = meterRegistry.find("sandbox.invocations.total")
                .tag("operation", "enter")
                .tag("tenant", "tenant-b")
                .counter();

        assertNotNull(counterTenantA, "Tenant A counter should exist");
        assertNotNull(counterTenantB, "Tenant B counter should exist");
        assertEquals(1.0, counterTenantA.count(), "Tenant A should have 1 invocation");
        assertEquals(1.0, counterTenantB.count(), "Tenant B should have 1 invocation");
    }

    // ========== Edge Cases Tests ==========

    @Test
    @DisplayName("exitRuleExecution without enterRuleExecution does not crash")
    void testExitWithoutEnter_DoesNotCrash() {
        // Act & Assert: Should not throw exception
        assertDoesNotThrow(() -> {
            SandboxContext.exitRuleExecution();
        });

        // Timer should not be recorded (no start time)
        Timer timer = meterRegistry.find("sandbox.execution.duration").timer();
        // Timer might exist but count should be 0 or timer might not exist
        if (timer != null) {
            assertEquals(0, timer.count(), "Timer count should be 0 if no valid execution");
        }
    }

    @Test
    @DisplayName("clear() removes thread-local state correctly")
    void testClear_RemovesThreadLocalState() {
        // Arrange
        SandboxContext.setTenant("tenant-123");
        SandboxContext.enterRuleExecution();

        // Act
        SandboxContext.clear();

        // Assert: Subsequent operations should use default tenant
        SandboxContext.enterRuleExecution();

        Counter defaultCounter = meterRegistry.find("sandbox.invocations.total")
                .tag("tenant", "unknown")
                .counter();

        assertNotNull(defaultCounter, "Should use 'unknown' tenant after clear");
    }

    @Test
    @DisplayName("setMeterRegistry with null does not crash")
    void testSetMeterRegistry_HandlesNull() {
        // Act & Assert: Should not throw exception
        assertDoesNotThrow(() -> {
            SandboxContext.setMeterRegistry(null);
        });
    }

    // ========== Integration Test ==========

    @Test
    @DisplayName("Complete workflow: enter -> violate -> exit records all metrics")
    void testCompleteWorkflow_RecordsAllMetrics() throws InterruptedException {
        // Arrange
        SandboxContext.setTenant("integration-test");

        // Act: Simulate complete rule execution with violation
        SandboxContext.enterRuleExecution();
        Thread.sleep(5); // Simulate work
        SandboxContext.recordViolation("java/lang/Runtime.exec");
        SandboxContext.exitRuleExecution();

        // Assert: All three metric types should be recorded
        Counter enterCounter = meterRegistry.find("sandbox.invocations.total")
                .tag("operation", "enter")
                .tag("tenant", "integration-test")
                .counter();
        Counter exitCounter = meterRegistry.find("sandbox.invocations.total")
                .tag("operation", "exit")
                .tag("tenant", "integration-test")
                .counter();
        Counter violationCounter = meterRegistry.find("sandbox.violations.total")
                .tag("violation_type", "java/lang/Runtime.exec")
                .tag("tenant", "integration-test")
                .counter();
        Timer durationTimer = meterRegistry.find("sandbox.execution.duration")
                .tag("tenant", "integration-test")
                .timer();

        assertNotNull(enterCounter, "Enter counter should exist");
        assertNotNull(exitCounter, "Exit counter should exist");
        assertNotNull(violationCounter, "Violation counter should exist");
        assertNotNull(durationTimer, "Duration timer should exist");

        assertEquals(1.0, enterCounter.count());
        assertEquals(1.0, exitCounter.count());
        assertEquals(1.0, violationCounter.count());
        assertEquals(1, durationTimer.count());
        assertTrue(durationTimer.totalTime(TimeUnit.MILLISECONDS) >= 5);
    }
}
