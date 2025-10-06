package com.fluo.transformers.signal;

import com.fluo.model.Signal;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.spi.DataType;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("SignalToTigerBeetleTransformer Tests")
class SignalToTigerBeetleTransformerTest {

    private SignalToTigerBeetleTransformer transformer;
    private CamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        transformer = new SignalToTigerBeetleTransformer();
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("Should transform Signal to TigerBeetle transfer format")
    void testTransformSignalToTigerBeetle() throws Exception {
        Instant timestamp = Instant.now();
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("cpu", 95);
        attributes.put("memory", 85);

        Signal signal = new Signal(
            "sig-123",
            "rule-456",
            "2.0",
            "span-789",
            "trace-101",
            timestamp,
            Signal.SignalSeverity.HIGH,
            "Test signal message",
            attributes,
            "test-source",
            "tenant-123",
            Signal.SignalStatus.EVALUATED
        );

        exchange.getIn().setBody(signal);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> transfer = exchange.getIn().getBody(Map.class);

        assertNotNull(transfer);
        assertEquals("sig-123", transfer.get("id"));
        assertEquals(timestamp.toEpochMilli(), transfer.get("timestamp"));
        assertEquals(1, transfer.get("ledger"));
        assertEquals((long)Math.abs("rule-456".hashCode()), transfer.get("code"));
        assertEquals(0, transfer.get("flags"));

        long tenantAccount = Math.abs("tenant-123".hashCode());
        assertEquals(tenantAccount, transfer.get("debitAccountId"));
        assertEquals(tenantAccount + 1, transfer.get("creditAccountId"));
        assertEquals(Signal.SignalSeverity.HIGH.ordinal(), transfer.get("amount"));

        @SuppressWarnings("unchecked")
        Map<String, Object> userData = (Map<String, Object>) transfer.get("userData");
        assertNotNull(userData);
        assertEquals("sig-123", userData.get("signalId"));
        assertEquals("rule-456", userData.get("ruleId"));
        assertEquals("2.0", userData.get("ruleVersion"));
        assertEquals("span-789", userData.get("spanId"));
        assertEquals("trace-101", userData.get("traceId"));
        assertEquals("HIGH", userData.get("severity"));
        assertEquals("Test signal message", userData.get("message"));
        assertEquals(attributes, userData.get("attributes"));
        assertEquals("test-source", userData.get("source"));
        assertEquals("tenant-123", userData.get("tenantId"));
        assertEquals("EVALUATED", userData.get("status"));
    }

    @Test
    @DisplayName("Should handle signal with minimal data")
    void testTransformMinimalSignal() throws Exception {
        Instant timestamp = Instant.now();
        Signal signal = new Signal(
            "min-signal",
            "min-rule",
            "1.0",
            "min-span",
            "min-trace",
            timestamp,
            Signal.SignalSeverity.LOW,
            "Minimal",
            new HashMap<>(),
            "source",
            "tenant",
            Signal.SignalStatus.PENDING
        );

        exchange.getIn().setBody(signal);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> transfer = exchange.getIn().getBody(Map.class);

        assertNotNull(transfer);
        assertEquals("min-signal", transfer.get("id"));
        assertEquals(Signal.SignalSeverity.LOW.ordinal(), transfer.get("amount"));

        @SuppressWarnings("unchecked")
        Map<String, Object> userData = (Map<String, Object>) transfer.get("userData");
        assertEquals("PENDING", userData.get("status"));
        assertTrue(((Map<?, ?>) userData.get("attributes")).isEmpty());
    }

    @Test
    @DisplayName("Should throw exception for null signal")
    void testTransformNullSignal() {
        exchange.getIn().setBody(null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );

        assertEquals("Signal input cannot be null", exception.getMessage());
    }

    
    
    
    
    @Test
    @DisplayName("Should handle null tenant ID")
    void testHandleNullTenantId() throws Exception {
        Signal signal = new Signal(
            "sig-null-tenant",
            "rule-123",
            "1.0",
            "span-123",
            "trace-123",
            Instant.now(),
            Signal.SignalSeverity.MEDIUM,
            "Message",
            new HashMap<>(),
            "source",
            null, // null tenant ID
            Signal.SignalStatus.EVALUATED
        );

        exchange.getIn().setBody(signal);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> transfer = exchange.getIn().getBody(Map.class);

        assertEquals(0L, transfer.get("debitAccountId"));
        assertEquals(1L, transfer.get("creditAccountId"));
    }

    @Test
    @DisplayName("Should handle null rule ID")
    void testHandleNullRuleId() throws Exception {
        Signal signal = new Signal(
            "sig-null-rule",
            null, // null rule ID
            "1.0",
            "span-123",
            "trace-123",
            Instant.now(),
            Signal.SignalSeverity.MEDIUM,
            "Message",
            new HashMap<>(),
            "source",
            "tenant-123",
            Signal.SignalStatus.EVALUATED
        );

        exchange.getIn().setBody(signal);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> transfer = exchange.getIn().getBody(Map.class);

        assertEquals(0L, transfer.get("code"));
    }

    @Test
    @DisplayName("Should handle all severity levels")
    void testAllSeverityLevels() throws Exception {
        for (Signal.SignalSeverity severity : Signal.SignalSeverity.values()) {
            Signal signal = new Signal(
                "sig-" + severity,
                "rule-123",
                "1.0",
                "span-123",
                "trace-123",
                Instant.now(),
                severity,
                "Message for " + severity,
                new HashMap<>(),
                "source",
                "tenant-123",
                Signal.SignalStatus.EVALUATED
            );

            Exchange testExchange = new DefaultExchange(context);
            testExchange.getIn().setBody(signal);
            transformer.transform(testExchange.getIn(), null, null);

            @SuppressWarnings("unchecked")
            Map<String, Object> transfer = testExchange.getIn().getBody(Map.class);

            assertEquals(severity.ordinal(), transfer.get("amount"),
                "Failed for severity: " + severity);

            @SuppressWarnings("unchecked")
            Map<String, Object> userData = (Map<String, Object>) transfer.get("userData");
            assertEquals(severity.name(), userData.get("severity"));
        }
    }

    @Test
    @DisplayName("Should handle all status values")
    void testAllStatusValues() throws Exception {
        for (Signal.SignalStatus status : Signal.SignalStatus.values()) {
            Signal signal = new Signal(
                "sig-" + status,
                "rule-123",
                "1.0",
                "span-123",
                "trace-123",
                Instant.now(),
                Signal.SignalSeverity.MEDIUM,
                "Message for " + status,
                new HashMap<>(),
                "source",
                "tenant-123",
                status
            );

            Exchange testExchange = new DefaultExchange(context);
            testExchange.getIn().setBody(signal);
            transformer.transform(testExchange.getIn(), null, null);

            @SuppressWarnings("unchecked")
            Map<String, Object> transfer = testExchange.getIn().getBody(Map.class);

            @SuppressWarnings("unchecked")
            Map<String, Object> userData = (Map<String, Object>) transfer.get("userData");
            assertEquals(status.name(), userData.get("status"),
                "Failed for status: " + status);
        }
    }

    @Test
    @DisplayName("Should preserve complex attributes structure")
    void testComplexAttributes() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        Map<String, Object> nested = new HashMap<>();
        nested.put("cpu", 45.5);
        nested.put("memory", 67.8);
        attributes.put("metrics", nested);
        attributes.put("tags", new String[]{"production", "critical"});
        attributes.put("enabled", true);

        Signal signal = new Signal(
            "sig-complex",
            "rule-complex",
            "3.0",
            "span-complex",
            "trace-complex",
            Instant.now(),
            Signal.SignalSeverity.CRITICAL,
            "Complex attributes",
            attributes,
            "complex-source",
            "tenant-complex",
            Signal.SignalStatus.EVALUATED
        );

        exchange.getIn().setBody(signal);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> transfer = exchange.getIn().getBody(Map.class);

        @SuppressWarnings("unchecked")
        Map<String, Object> userData = (Map<String, Object>) transfer.get("userData");

        @SuppressWarnings("unchecked")
        Map<String, Object> savedAttributes = (Map<String, Object>) userData.get("attributes");
        assertEquals(attributes, savedAttributes);

        @SuppressWarnings("unchecked")
        Map<String, Object> savedMetrics = (Map<String, Object>) savedAttributes.get("metrics");
        assertEquals(45.5, savedMetrics.get("cpu"));
        assertEquals(67.8, savedMetrics.get("memory"));
    }

    @Test
    @DisplayName("Should calculate consistent hash codes")
    void testConsistentHashCodes() throws Exception {
        String tenantId = "consistent-tenant";
        String ruleId = "consistent-rule";

        Signal signal1 = createSignalWithIds(ruleId, tenantId);
        Signal signal2 = createSignalWithIds(ruleId, tenantId);

        exchange.getIn().setBody(signal1);
        transformer.transform(exchange.getIn(), null, null);
        @SuppressWarnings("unchecked")
        Map<String, Object> transfer1 = exchange.getIn().getBody(Map.class);

        exchange.getIn().setBody(signal2);
        transformer.transform(exchange.getIn(), null, null);
        @SuppressWarnings("unchecked")
        Map<String, Object> transfer2 = exchange.getIn().getBody(Map.class);

        // Hash codes should be consistent
        assertEquals(transfer1.get("code"), transfer2.get("code"));
        assertEquals(transfer1.get("debitAccountId"), transfer2.get("debitAccountId"));
        assertEquals(transfer1.get("creditAccountId"), transfer2.get("creditAccountId"));
    }

    @Test
    @DisplayName("Should handle very long message strings")
    void testLongMessageString() throws Exception {
        StringBuilder longMessage = new StringBuilder();
        for (int i = 0; i < 1000; i++) {
            longMessage.append("This is a very long message. ");
        }

        Signal signal = new Signal(
            "sig-long",
            "rule-long",
            "1.0",
            "span-long",
            "trace-long",
            Instant.now(),
            Signal.SignalSeverity.HIGH,
            longMessage.toString(),
            new HashMap<>(),
            "source",
            "tenant-long",
            Signal.SignalStatus.EVALUATED
        );

        exchange.getIn().setBody(signal);
        transformer.transform(exchange.getIn(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> transfer = exchange.getIn().getBody(Map.class);

        @SuppressWarnings("unchecked")
        Map<String, Object> userData = (Map<String, Object>) transfer.get("userData");
        assertEquals(longMessage.toString(), userData.get("message"));
    }

    @Test
    @DisplayName("Should use absolute value for hash codes")
    void testAbsoluteHashCodes() throws Exception {
        // Test with strings that might produce negative hash codes
        String[] testStrings = {"test1", "test2", "negative-hash", "another-test"};

        for (String testString : testStrings) {
            Signal signal = createSignalWithIds(testString, testString);
            exchange.getIn().setBody(signal);
            transformer.transform(exchange.getIn(), null, null);

            @SuppressWarnings("unchecked")
            Map<String, Object> transfer = exchange.getIn().getBody(Map.class);

            // All hash-based values should be non-negative
            assertTrue((Long) transfer.get("code") >= 0,
                "Code should be non-negative for: " + testString);
            assertTrue((Long) transfer.get("debitAccountId") >= 0,
                "Debit account should be non-negative for: " + testString);
            assertTrue((Long) transfer.get("creditAccountId") >= 0,
                "Credit account should be non-negative for: " + testString);
        }
    }

    // Helper methods
    private Signal createTestSignal() {
        return new Signal(
            "test-signal",
            "test-rule",
            "1.0",
            "test-span",
            "test-trace",
            Instant.now(),
            Signal.SignalSeverity.MEDIUM,
            "Test message",
            new HashMap<>(),
            "test-source",
            "test-tenant",
            Signal.SignalStatus.EVALUATED
        );
    }

    private Signal createSignalWithIds(String ruleId, String tenantId) {
        return new Signal(
            "signal-" + System.nanoTime(),
            ruleId,
            "1.0",
            "span-123",
            "trace-123",
            Instant.now(),
            Signal.SignalSeverity.MEDIUM,
            "Test message",
            new HashMap<>(),
            "source",
            tenantId,
            Signal.SignalStatus.EVALUATED
        );
    }
}