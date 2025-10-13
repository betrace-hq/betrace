package com.fluo.security.audit;

import com.fluo.security.agent.SandboxContext;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.testing.exporter.InMemorySpanExporter;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * PRD-006 Unit 3: AuditLogger Tests
 *
 * Tests audit logging functionality for sandbox violations:
 * - OpenTelemetry span emission
 * - Tenant isolation
 * - DDoS detection (high violation rate)
 * - Stack trace capture
 * - Compliance attributes (SOC2 CC7.2)
 */
class AuditLoggerTest {

    private AuditLogger auditLogger;
    private InMemorySpanExporter spanExporter;
    private OpenTelemetry openTelemetry;

    @BeforeEach
    void setUp() {
        // Reset SandboxContext state
        SandboxContext.clear();
        SandboxContext.setMeterRegistry(new SimpleMeterRegistry());

        // Create in-memory OpenTelemetry for testing
        spanExporter = InMemorySpanExporter.create();
        SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
                .addSpanProcessor(SimpleSpanProcessor.create(spanExporter))
                .build();

        openTelemetry = OpenTelemetrySdk.builder()
                .setTracerProvider(tracerProvider)
                .build();

        // Create AuditLogger with test OpenTelemetry
        auditLogger = new AuditLogger(openTelemetry);
        AuditLogger.setInstance(auditLogger);

        // Clear any existing spans
        spanExporter.reset();
    }

    @Test
    void testLogViolation_EmitsSpan() {
        // Given
        String operation = "Runtime.exec";
        String className = "com.example.MaliciousRule";

        // When
        auditLogger.logViolationInstance(operation, className);

        // Then
        List<SpanData> spans = spanExporter.getFinishedSpanExports();
        assertEquals(1, spans.size());

        SpanData span = spans.get(0);
        assertEquals("sandbox.violation", span.getName());
    }

    @Test
    void testLogViolation_IncludesOperationAttribute() {
        // Given
        String operation = "System.exit";
        String className = "com.example.BadRule";

        // When
        auditLogger.logViolationInstance(operation, className);

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        assertEquals(operation,
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.operation")));
    }

    @Test
    void testLogViolation_IncludesClassNameAttribute() {
        // Given
        String operation = "Runtime.exec";
        String className = "com.example.rules.tenant123.rule456";

        // When
        auditLogger.logViolationInstance(operation, className);

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        assertEquals(className,
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.className")));
    }

    @Test
    void testLogViolation_ExtractsRuleId() {
        // Given
        String operation = "Runtime.exec";
        String className = "com.example.rules.tenant123.rule456";

        // When
        auditLogger.logViolationInstance(operation, className);

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        assertEquals("rule456",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.ruleId")));
    }

    @Test
    void testLogViolation_ExtractsRuleIdFromSimpleClassName() {
        // Given
        String className = "rule789";

        // When
        auditLogger.logViolationInstance("Runtime.exec", className);

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        assertEquals("rule789",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.ruleId")));
    }

    @Test
    void testLogViolation_HandlesUnknownRuleId() {
        // Given
        String className = "com.example.SomeOtherClass";

        // When
        auditLogger.logViolationInstance("Runtime.exec", className);

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        assertEquals("unknown",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.ruleId")));
    }

    @Test
    void testLogViolation_IncludesTenantId() {
        // Given
        SandboxContext.setTenant("tenant-123");
        String operation = "Runtime.exec";
        String className = "com.example.MaliciousRule";

        // When
        auditLogger.logViolationInstance(operation, className);

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        assertEquals("tenant-123",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("tenant.id")));
    }

    @Test
    void testLogViolation_DefaultTenantWhenNotSet() {
        // Given - no tenant set
        String operation = "Runtime.exec";
        String className = "com.example.MaliciousRule";

        // When
        auditLogger.logViolationInstance(operation, className);

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        assertEquals("unknown",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("tenant.id")));
    }

    @Test
    void testLogViolation_IncludesComplianceAttributes() {
        // When
        auditLogger.logViolationInstance("Runtime.exec", "com.example.MaliciousRule");

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);

        assertEquals("soc2",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("compliance.framework")));
        assertEquals("CC7.2",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("compliance.control")));
        assertEquals("audit_trail",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("compliance.evidenceType")));
    }

    @Test
    void testLogViolation_IncludesStackTrace() {
        // When
        auditLogger.logViolationInstance("Runtime.exec", "com.example.MaliciousRule");

        // Then
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        String stackTrace = span.getAttributes()
                .get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.stackTrace"));

        assertNotNull(stackTrace);
        assertTrue(stackTrace.contains("AuditLoggerTest"),
                "Stack trace should include test class name");
    }

    @Test
    void testLogViolation_IncludesTimestamp() {
        // Given
        long beforeTimestamp = System.currentTimeMillis();

        // When
        auditLogger.logViolationInstance("Runtime.exec", "com.example.MaliciousRule");

        // Then
        long afterTimestamp = System.currentTimeMillis();
        SpanData span = spanExporter.getFinishedSpanExports().get(0);
        Long timestamp = span.getAttributes()
                .get(io.opentelemetry.api.common.AttributeKey.longKey("violation.timestamp"));

        assertNotNull(timestamp);
        assertTrue(timestamp >= beforeTimestamp && timestamp <= afterTimestamp,
                "Timestamp should be within test execution window");
    }

    @Test
    void testLogViolation_IncrementsViolationCounter() {
        // Given
        SandboxContext.setTenant("tenant-123");

        // When
        auditLogger.logViolationInstance("Runtime.exec", "com.example.Rule1");
        auditLogger.logViolationInstance("System.exit", "com.example.Rule2");
        auditLogger.logViolationInstance("Runtime.exec", "com.example.Rule1");

        // Then
        assertEquals(3, auditLogger.getViolationCount("tenant-123"));
    }

    @Test
    void testLogViolation_TenantIsolation() {
        // Given
        SandboxContext.setTenant("tenant-123");
        auditLogger.logViolationInstance("Runtime.exec", "com.example.Rule1");

        SandboxContext.setTenant("tenant-456");
        auditLogger.logViolationInstance("System.exit", "com.example.Rule2");

        // Then
        assertEquals(1, auditLogger.getViolationCount("tenant-123"));
        assertEquals(1, auditLogger.getViolationCount("tenant-456"));
        assertEquals(0, auditLogger.getViolationCount("tenant-999"));
    }

    @Test
    void testLogViolation_HighViolationRateDetection() {
        // Given
        SandboxContext.setTenant("tenant-123");

        // When - simulate 11 violations (exceeds threshold of 10)
        for (int i = 0; i < 11; i++) {
            auditLogger.logViolationInstance("Runtime.exec", "com.example.AttackRule");
        }

        // Then
        assertEquals(11, auditLogger.getViolationCount("tenant-123"));

        // Check that last span has "possibleAttack" flag
        List<SpanData> spans = spanExporter.getFinishedSpanExports();
        SpanData lastSpan = spans.get(spans.size() - 1);

        assertEquals(true,
                lastSpan.getAttributes().get(io.opentelemetry.api.common.AttributeKey.booleanKey("violation.possibleAttack")));
        assertEquals(11L,
                lastSpan.getAttributes().get(io.opentelemetry.api.common.AttributeKey.longKey("violation.count")));
    }

    @Test
    void testLogViolation_NoAttackFlagBelowThreshold() {
        // Given
        SandboxContext.setTenant("tenant-123");

        // When - only 5 violations (below threshold of 10)
        for (int i = 0; i < 5; i++) {
            auditLogger.logViolationInstance("Runtime.exec", "com.example.Rule");
        }

        // Then
        SpanData lastSpan = spanExporter.getFinishedSpanExports().get(4);

        // possibleAttack should not be set (or be false)
        assertNull(lastSpan.getAttributes()
                .get(io.opentelemetry.api.common.AttributeKey.booleanKey("violation.possibleAttack")));
    }

    @Test
    void testGetViolationStatistics() {
        // Given
        SandboxContext.setTenant("tenant-123");
        auditLogger.logViolationInstance("Runtime.exec", "com.example.Rule1");
        auditLogger.logViolationInstance("Runtime.exec", "com.example.Rule1");

        SandboxContext.setTenant("tenant-456");
        auditLogger.logViolationInstance("System.exit", "com.example.Rule2");

        // When
        Map<String, Long> stats = auditLogger.getViolationStatistics();

        // Then
        assertEquals(2, stats.size());
        assertEquals(2L, stats.get("tenant-123"));
        assertEquals(1L, stats.get("tenant-456"));
    }

    @Test
    void testResetViolationCounters() {
        // Given
        SandboxContext.setTenant("tenant-123");
        auditLogger.logViolationInstance("Runtime.exec", "com.example.Rule");
        assertEquals(1, auditLogger.getViolationCount("tenant-123"));

        // When
        auditLogger.resetViolationCounters();

        // Then
        assertEquals(0, auditLogger.getViolationCount("tenant-123"));
    }

    @Test
    void testStaticLogViolation_DelegatesToInstance() {
        // Given
        SandboxContext.setTenant("tenant-123");

        // When
        AuditLogger.logViolation("Runtime.exec", "com.example.MaliciousRule");

        // Then
        List<SpanData> spans = spanExporter.getFinishedSpanExports();
        assertEquals(1, spans.size());

        SpanData span = spans.get(0);
        assertEquals("sandbox.violation", span.getName());
        assertEquals("Runtime.exec",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.operation")));
    }

    @Test
    void testMultipleViolations_EmitsSeparateSpans() {
        // Given
        SandboxContext.setTenant("tenant-123");

        // When
        auditLogger.logViolationInstance("Runtime.exec", "com.example.Rule1");
        auditLogger.logViolationInstance("System.exit", "com.example.Rule2");
        auditLogger.logViolationInstance("Method.setAccessible", "com.example.Rule3");

        // Then
        List<SpanData> spans = spanExporter.getFinishedSpanExports();
        assertEquals(3, spans.size());

        // Verify each span has different operation
        String op1 = spans.get(0).getAttributes()
                .get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.operation"));
        String op2 = spans.get(1).getAttributes()
                .get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.operation"));
        String op3 = spans.get(2).getAttributes()
                .get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.operation"));

        assertEquals("Runtime.exec", op1);
        assertEquals("System.exit", op2);
        assertEquals("Method.setAccessible", op3);
    }

    @Test
    void testLogViolation_HandlesNullOperation() {
        // When
        auditLogger.logViolationInstance(null, "com.example.Rule");

        // Then - should not crash, span should be emitted
        List<SpanData> spans = spanExporter.getFinishedSpanExports();
        assertEquals(1, spans.size());
    }

    @Test
    void testLogViolation_HandlesNullClassName() {
        // When
        auditLogger.logViolationInstance("Runtime.exec", null);

        // Then - should not crash, span should be emitted
        List<SpanData> spans = spanExporter.getFinishedSpanExports();
        assertEquals(1, spans.size());

        // Rule ID should be "unknown"
        SpanData span = spans.get(0);
        assertEquals("unknown",
                span.getAttributes().get(io.opentelemetry.api.common.AttributeKey.stringKey("violation.ruleId")));
    }
}
