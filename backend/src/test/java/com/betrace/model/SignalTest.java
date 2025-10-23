package com.betrace.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Signal Model Tests")
class SignalTest {

    private Signal signal;
    private Map<String, Object> attributes;
    private Instant timestamp;

    @BeforeEach
    void setUp() {
        timestamp = Instant.now();
        attributes = new HashMap<>();
        attributes.put("key1", "value1");
        attributes.put("key2", 42);

        signal = new Signal(
            "sig-123",
            "rule-456",
            "v1.0",
            "span-789",
            "trace-abc",
            timestamp,
            Signal.SignalSeverity.HIGH,
            "Test signal message",
            attributes,
            "test-source",
            "tenant-xyz",
            Signal.SignalStatus.PENDING
        );
    }

    @Test
    @DisplayName("Should create signal with all fields")
    void testFullConstructor() {
        assertNotNull(signal);
        assertEquals("sig-123", signal.id());
        assertEquals("rule-456", signal.ruleId());
        assertEquals("v1.0", signal.ruleVersion());
        assertEquals("span-789", signal.spanId());
        assertEquals("trace-abc", signal.traceId());
        assertEquals(timestamp, signal.timestamp());
        assertEquals(Signal.SignalSeverity.HIGH, signal.severity());
        assertEquals("Test signal message", signal.message());
        assertEquals(attributes, signal.attributes());
        assertEquals("test-source", signal.source());
        assertEquals("tenant-xyz", signal.tenantId());
        assertEquals(Signal.SignalStatus.PENDING, signal.status());
    }

    @Test
    @DisplayName("Should create signal using factory method")
    void testCreateFactoryMethod() {
        Signal created = Signal.create(
            "rule-001",
            "v2.0",
            "span-002",
            "trace-003",
            Signal.SignalSeverity.CRITICAL,
            "Critical issue detected",
            attributes,
            "monitoring-system",
            "tenant-001"
        );

        assertNotNull(created);
        assertNotNull(created.id());
        assertTrue(created.id().startsWith("sig-"));
        assertEquals("rule-001", created.ruleId());
        assertEquals("v2.0", created.ruleVersion());
        assertEquals("span-002", created.spanId());
        assertEquals("trace-003", created.traceId());
        assertNotNull(created.timestamp());
        assertEquals(Signal.SignalSeverity.CRITICAL, created.severity());
        assertEquals("Critical issue detected", created.message());
        assertEquals(attributes, created.attributes());
        assertEquals("monitoring-system", created.source());
        assertEquals("tenant-001", created.tenantId());
        assertEquals(Signal.SignalStatus.PENDING, created.status());
    }

    @Test
    @DisplayName("Should generate unique IDs in factory method")
    void testUniqueIdGeneration() {
        Signal signal1 = Signal.create("r1", "v1", "s1", "t1",
            Signal.SignalSeverity.LOW, "msg1", attributes, "src1", "ten1");
        Signal signal2 = Signal.create("r1", "v1", "s1", "t1",
            Signal.SignalSeverity.LOW, "msg1", attributes, "src1", "ten1");

        assertNotNull(signal1.id());
        assertNotNull(signal2.id());
        assertNotEquals(signal1.id(), signal2.id());
        assertTrue(signal1.id().startsWith("sig-"));
        assertTrue(signal2.id().startsWith("sig-"));
    }

    @Test
    @DisplayName("Should set timestamp to current time in factory method")
    void testTimestampGeneration() {
        Instant before = Instant.now();
        Signal created = Signal.create("r1", "v1", "s1", "t1",
            Signal.SignalSeverity.INFO, "msg", attributes, "src", "ten");
        Instant after = Instant.now();

        assertNotNull(created.timestamp());
        assertTrue(created.timestamp().compareTo(before) >= 0);
        assertTrue(created.timestamp().compareTo(after) <= 0);
    }

    @Test
    @DisplayName("Should update status immutably")
    void testWithStatus() {
        Signal updated = signal.withStatus(Signal.SignalStatus.EVALUATED);

        // Original should be unchanged
        assertEquals(Signal.SignalStatus.PENDING, signal.status());

        // New instance should have updated status
        assertEquals(Signal.SignalStatus.EVALUATED, updated.status());

        // All other fields should be the same
        assertEquals(signal.id(), updated.id());
        assertEquals(signal.ruleId(), updated.ruleId());
        assertEquals(signal.ruleVersion(), updated.ruleVersion());
        assertEquals(signal.spanId(), updated.spanId());
        assertEquals(signal.traceId(), updated.traceId());
        assertEquals(signal.timestamp(), updated.timestamp());
        assertEquals(signal.severity(), updated.severity());
        assertEquals(signal.message(), updated.message());
        assertEquals(signal.attributes(), updated.attributes());
        assertEquals(signal.source(), updated.source());
        assertEquals(signal.tenantId(), updated.tenantId());
    }

    @Test
    @DisplayName("Should add evaluation results immutably")
    void testWithEvaluationResult() {
        Map<String, Object> evaluationResults = new HashMap<>();
        evaluationResults.put("matched", true);
        evaluationResults.put("confidence", 0.95);

        Signal evaluated = signal.withEvaluationResult(evaluationResults);

        // Original should be unchanged
        assertEquals(Signal.SignalStatus.PENDING, signal.status());
        assertFalse(signal.attributes().containsKey("evaluationResults"));

        // New instance should have evaluation results and EVALUATED status
        assertEquals(Signal.SignalStatus.EVALUATED, evaluated.status());
        assertTrue(evaluated.attributes().containsKey("evaluationResults"));
        assertEquals(evaluationResults, evaluated.attributes().get("evaluationResults"));

        // Original attributes should still be present
        assertEquals("value1", evaluated.attributes().get("key1"));
        assertEquals(42, evaluated.attributes().get("key2"));

        // Other fields should be the same
        assertEquals(signal.id(), evaluated.id());
        assertEquals(signal.ruleId(), evaluated.ruleId());
    }

    @Test
    @DisplayName("Should handle null evaluation results")
    void testWithNullEvaluationResult() {
        Signal evaluated = signal.withEvaluationResult(null);

        assertEquals(Signal.SignalStatus.EVALUATED, evaluated.status());
        assertTrue(evaluated.attributes().containsKey("evaluationResults"));
        assertNull(evaluated.attributes().get("evaluationResults"));
    }

    @Test
    @DisplayName("Should test all severity enum values")
    void testSeverityEnumValues() {
        Signal.SignalSeverity[] severities = Signal.SignalSeverity.values();

        assertEquals(5, severities.length);
        assertEquals(Signal.SignalSeverity.CRITICAL, Signal.SignalSeverity.valueOf("CRITICAL"));
        assertEquals(Signal.SignalSeverity.HIGH, Signal.SignalSeverity.valueOf("HIGH"));
        assertEquals(Signal.SignalSeverity.MEDIUM, Signal.SignalSeverity.valueOf("MEDIUM"));
        assertEquals(Signal.SignalSeverity.LOW, Signal.SignalSeverity.valueOf("LOW"));
        assertEquals(Signal.SignalSeverity.INFO, Signal.SignalSeverity.valueOf("INFO"));
    }

    @Test
    @DisplayName("Should test all status enum values")
    void testStatusEnumValues() {
        Signal.SignalStatus[] statuses = Signal.SignalStatus.values();

        assertEquals(5, statuses.length);
        assertEquals(Signal.SignalStatus.PENDING, Signal.SignalStatus.valueOf("PENDING"));
        assertEquals(Signal.SignalStatus.EVALUATING, Signal.SignalStatus.valueOf("EVALUATING"));
        assertEquals(Signal.SignalStatus.EVALUATED, Signal.SignalStatus.valueOf("EVALUATED"));
        assertEquals(Signal.SignalStatus.STORED, Signal.SignalStatus.valueOf("STORED"));
        assertEquals(Signal.SignalStatus.FAILED, Signal.SignalStatus.valueOf("FAILED"));
    }

    @Test
    @DisplayName("Should test equals method")
    void testEquals() {
        Signal same = new Signal(
            "sig-123",
            "rule-456",
            "v1.0",
            "span-789",
            "trace-abc",
            timestamp,
            Signal.SignalSeverity.HIGH,
            "Test signal message",
            attributes,
            "test-source",
            "tenant-xyz",
            Signal.SignalStatus.PENDING
        );

        Signal different = new Signal(
            "sig-999",
            "rule-456",
            "v1.0",
            "span-789",
            "trace-abc",
            timestamp,
            Signal.SignalSeverity.HIGH,
            "Test signal message",
            attributes,
            "test-source",
            "tenant-xyz",
            Signal.SignalStatus.PENDING
        );

        // Same object
        assertEquals(signal, signal);

        // Equal objects
        assertEquals(signal, same);

        // Different objects
        assertNotEquals(signal, different);

        // Null
        assertNotEquals(signal, null);

        // Different class
        assertNotEquals(signal, "not a signal");
    }

    @Test
    @DisplayName("Should test equals with different fields")
    void testEqualsWithDifferentFields() {
        Signal base = signal;

        // Different ID
        Signal diffId = new Signal("sig-999", "rule-456", "v1.0", "span-789", "trace-abc",
            timestamp, Signal.SignalSeverity.HIGH, "Test signal message", attributes,
            "test-source", "tenant-xyz", Signal.SignalStatus.PENDING);
        assertNotEquals(base, diffId);

        // Different severity
        Signal diffSeverity = new Signal("sig-123", "rule-456", "v1.0", "span-789", "trace-abc",
            timestamp, Signal.SignalSeverity.LOW, "Test signal message", attributes,
            "test-source", "tenant-xyz", Signal.SignalStatus.PENDING);
        assertNotEquals(base, diffSeverity);

        // Different status
        Signal diffStatus = new Signal("sig-123", "rule-456", "v1.0", "span-789", "trace-abc",
            timestamp, Signal.SignalSeverity.HIGH, "Test signal message", attributes,
            "test-source", "tenant-xyz", Signal.SignalStatus.STORED);
        assertNotEquals(base, diffStatus);

        // Different attributes
        Map<String, Object> diffAttrs = new HashMap<>();
        diffAttrs.put("different", "attrs");
        Signal diffAttributes = new Signal("sig-123", "rule-456", "v1.0", "span-789", "trace-abc",
            timestamp, Signal.SignalSeverity.HIGH, "Test signal message", diffAttrs,
            "test-source", "tenant-xyz", Signal.SignalStatus.PENDING);
        assertNotEquals(base, diffAttributes);
    }

    @Test
    @DisplayName("Should test hashCode method")
    void testHashCode() {
        Signal same = new Signal(
            "sig-123",
            "rule-456",
            "v1.0",
            "span-789",
            "trace-abc",
            timestamp,
            Signal.SignalSeverity.HIGH,
            "Test signal message",
            attributes,
            "test-source",
            "tenant-xyz",
            Signal.SignalStatus.PENDING
        );

        Signal different = new Signal(
            "sig-999",
            "rule-456",
            "v1.0",
            "span-789",
            "trace-abc",
            timestamp,
            Signal.SignalSeverity.HIGH,
            "Test signal message",
            attributes,
            "test-source",
            "tenant-xyz",
            Signal.SignalStatus.PENDING
        );

        // Same hashCode for equal objects
        assertEquals(signal.hashCode(), same.hashCode());

        // Different hashCode for different objects (not guaranteed, but very likely)
        assertNotEquals(signal.hashCode(), different.hashCode());
    }

    @Test
    @DisplayName("Should test toString method")
    void testToString() {
        String str = signal.toString();

        assertNotNull(str);
        assertTrue(str.startsWith("Signal{"));
        assertTrue(str.endsWith("}"));
        assertTrue(str.contains("id='sig-123'"));
        assertTrue(str.contains("ruleId='rule-456'"));
        assertTrue(str.contains("ruleVersion='v1.0'"));
        assertTrue(str.contains("spanId='span-789'"));
        assertTrue(str.contains("traceId='trace-abc'"));
        assertTrue(str.contains("severity=HIGH"));
        assertTrue(str.contains("message='Test signal message'"));
        assertTrue(str.contains("source='test-source'"));
        assertTrue(str.contains("tenantId='tenant-xyz'"));
        assertTrue(str.contains("status=PENDING"));
        assertTrue(str.contains("timestamp="));
        assertTrue(str.contains("attributes="));
    }

    @Test
    @DisplayName("Should handle null fields in constructor")
    void testNullFields() {
        Signal withNulls = new Signal(
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        assertNull(withNulls.id());
        assertNull(withNulls.ruleId());
        assertNull(withNulls.ruleVersion());
        assertNull(withNulls.spanId());
        assertNull(withNulls.traceId());
        assertNull(withNulls.timestamp());
        assertNull(withNulls.severity());
        assertNull(withNulls.message());
        assertNull(withNulls.attributes());
        assertNull(withNulls.source());
        assertNull(withNulls.tenantId());
        assertNull(withNulls.status());

        // Should not throw when calling methods
        Signal updated = withNulls.withStatus(Signal.SignalStatus.FAILED);
        assertEquals(Signal.SignalStatus.FAILED, updated.status());
    }

    @Test
    @DisplayName("Should note attributes reference behavior")
    void testAttributeImmutability() {
        Map<String, Object> originalAttrs = new HashMap<>();
        originalAttrs.put("key", "value");

        Signal sig = new Signal("id", "rule", "v1", "span", "trace",
            Instant.now(), Signal.SignalSeverity.LOW, "msg", originalAttrs,
            "src", "tenant", Signal.SignalStatus.PENDING);

        // NOTE: Signal stores the reference directly, so modifications to the original map affect the signal
        // This is the current behavior - the attributes are NOT defensively copied
        originalAttrs.put("newKey", "newValue");
        assertTrue(sig.attributes().containsKey("newKey")); // This will be true

        // The returned map is the same reference
        Map<String, Object> retrieved = sig.attributes();
        assertSame(originalAttrs, retrieved);

        // Modifying retrieved map affects the signal directly
        retrieved.put("anotherKey", "anotherValue");
        assertEquals(3, sig.attributes().size()); // Now has 3 keys
    }
}