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

@DisplayName("TigerBeetleToSignalTransformer Tests")
class TigerBeetleToSignalTransformerTest {

    private TigerBeetleToSignalTransformer transformer;
    private CamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        transformer = new TigerBeetleToSignalTransformer();
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    @DisplayName("Should transform TigerBeetle result to Signal")
    void testTransformTigerBeetleToSignal() throws Exception {
        Instant timestamp = Instant.now();
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("cpu", 95);
        attributes.put("memory", 85);

        Map<String, Object> userData = new HashMap<>();
        userData.put("signalId", "sig-123");
        userData.put("ruleId", "rule-456");
        userData.put("ruleVersion", "2.0");
        userData.put("spanId", "span-789");
        userData.put("traceId", "trace-101");
        userData.put("severity", "HIGH");
        userData.put("message", "Test signal message");
        userData.put("attributes", attributes);
        userData.put("source", "test-source");
        userData.put("tenantId", "tenant-123");
        userData.put("status", "EVALUATED");

        Map<String, Object> tigerBeetleResult = new HashMap<>();
        tigerBeetleResult.put("id", "sig-123");
        tigerBeetleResult.put("timestamp", timestamp.toEpochMilli());
        tigerBeetleResult.put("userData", userData);
        tigerBeetleResult.put("ledger", 1);
        tigerBeetleResult.put("code", 12345L);
        tigerBeetleResult.put("amount", 2);

        exchange.getIn().setBody(tigerBeetleResult);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);

        assertNotNull(signal);
        assertEquals("sig-123", signal.id());
        assertEquals("rule-456", signal.ruleId());
        assertEquals("2.0", signal.ruleVersion());
        assertEquals("span-789", signal.spanId());
        assertEquals("trace-101", signal.traceId());
        assertEquals(timestamp.toEpochMilli(), signal.timestamp().toEpochMilli());
        assertEquals(Signal.SignalSeverity.HIGH, signal.severity());
        assertEquals("Test signal message", signal.message());
        assertNotNull(signal.attributes());
        assertEquals(95, signal.attributes().get("cpu"));
        assertEquals(85, signal.attributes().get("memory"));
        assertEquals("test-source", signal.source());
        assertEquals("tenant-123", signal.tenantId());
        assertEquals(Signal.SignalStatus.EVALUATED, signal.status());
    }

    @Test
    @DisplayName("Should handle empty attributes")
    void testTransformWithEmptyAttributes() throws Exception {
        Map<String, Object> userData = new HashMap<>();
        userData.put("signalId", "sig-empty");
        userData.put("ruleId", "rule-empty");
        userData.put("ruleVersion", "1.0");
        userData.put("spanId", "span-empty");
        userData.put("traceId", "trace-empty");
        userData.put("severity", "LOW");
        userData.put("message", "Empty attributes");
        // No attributes field
        userData.put("source", "source");
        userData.put("tenantId", "tenant");
        userData.put("status", "PENDING");

        Map<String, Object> tigerBeetleResult = new HashMap<>();
        tigerBeetleResult.put("timestamp", System.currentTimeMillis());
        tigerBeetleResult.put("userData", userData);

        exchange.getIn().setBody(tigerBeetleResult);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);

        assertNotNull(signal);
        assertNotNull(signal.attributes());
        assertTrue(signal.attributes().isEmpty());
    }

    @Test
    @DisplayName("Should throw exception for null result")
    void testTransformNullResult() {
        exchange.getIn().setBody(null);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );

        assertEquals("TigerBeetle result cannot be null", exception.getMessage());
    }

    @Test
    @DisplayName("Should throw exception for missing userData")
    void testTransformMissingUserData() {
        Map<String, Object> tigerBeetleResult = new HashMap<>();
        tigerBeetleResult.put("timestamp", System.currentTimeMillis());
        // No userData field

        exchange.getIn().setBody(tigerBeetleResult);

        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );

        assertEquals("No userData in TigerBeetle result", exception.getMessage());
    }

    
    
    
    
    @Test
    @DisplayName("Should handle all severity levels")
    void testAllSeverityLevels() throws Exception {
        for (Signal.SignalSeverity severity : Signal.SignalSeverity.values()) {
            Map<String, Object> userData = createUserData();
            userData.put("severity", severity.name());

            Map<String, Object> result = new HashMap<>();
            result.put("timestamp", System.currentTimeMillis());
            result.put("userData", userData);

            Exchange testExchange = new DefaultExchange(context);
            testExchange.getIn().setBody(result);
            transformer.transform(testExchange.getIn(), null, null);

            Signal signal = testExchange.getIn().getBody(Signal.class);
            assertEquals(severity, signal.severity(),
                "Failed for severity: " + severity);
        }
    }

    @Test
    @DisplayName("Should handle all status values")
    void testAllStatusValues() throws Exception {
        for (Signal.SignalStatus status : Signal.SignalStatus.values()) {
            Map<String, Object> userData = createUserData();
            userData.put("status", status.name());

            Map<String, Object> result = new HashMap<>();
            result.put("timestamp", System.currentTimeMillis());
            result.put("userData", userData);

            Exchange testExchange = new DefaultExchange(context);
            testExchange.getIn().setBody(result);
            transformer.transform(testExchange.getIn(), null, null);

            Signal signal = testExchange.getIn().getBody(Signal.class);
            assertEquals(status, signal.status(),
                "Failed for status: " + status);
        }
    }

    @Test
    @DisplayName("Should handle complex nested attributes")
    void testComplexNestedAttributes() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        Map<String, Object> nested = new HashMap<>();
        nested.put("cpu", 45.5);
        nested.put("memory", 67.8);
        attributes.put("metrics", nested);
        attributes.put("tags", new String[]{"production", "critical"});
        attributes.put("enabled", true);
        attributes.put("count", 42);

        Map<String, Object> userData = createUserData();
        userData.put("attributes", attributes);

        Map<String, Object> result = new HashMap<>();
        result.put("timestamp", System.currentTimeMillis());
        result.put("userData", userData);

        exchange.getIn().setBody(result);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertNotNull(signal.attributes());
        assertEquals(attributes, signal.attributes());

        @SuppressWarnings("unchecked")
        Map<String, Object> metrics = (Map<String, Object>) signal.attributes().get("metrics");
        assertEquals(45.5, metrics.get("cpu"));
        assertEquals(67.8, metrics.get("memory"));
    }

    @Test
    @DisplayName("Should throw exception for invalid severity")
    void testInvalidSeverity() {
        Map<String, Object> userData = createUserData();
        userData.put("severity", "INVALID_SEVERITY");

        Map<String, Object> result = new HashMap<>();
        result.put("timestamp", System.currentTimeMillis());
        result.put("userData", userData);

        exchange.getIn().setBody(result);

        assertThrows(
            IllegalArgumentException.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );
    }

    @Test
    @DisplayName("Should throw exception for invalid status")
    void testInvalidStatus() {
        Map<String, Object> userData = createUserData();
        userData.put("status", "INVALID_STATUS");

        Map<String, Object> result = new HashMap<>();
        result.put("timestamp", System.currentTimeMillis());
        result.put("userData", userData);

        exchange.getIn().setBody(result);

        assertThrows(
            IllegalArgumentException.class,
            () -> transformer.transform(exchange.getIn(), null, null)
        );
    }

    @Test
    @DisplayName("Should handle null attributes in userData")
    void testNullAttributesInUserData() throws Exception {
        Map<String, Object> userData = createUserData();
        userData.put("attributes", null);

        Map<String, Object> result = new HashMap<>();
        result.put("timestamp", System.currentTimeMillis());
        result.put("userData", userData);

        exchange.getIn().setBody(result);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertNotNull(signal.attributes());
    }

    @Test
    @DisplayName("Should preserve exact timestamp")
    void testPreserveExactTimestamp() throws Exception {
        long exactTimestamp = 1704067200000L; // 2024-01-01 00:00:00 UTC

        Map<String, Object> userData = createUserData();
        Map<String, Object> result = new HashMap<>();
        result.put("timestamp", exactTimestamp);
        result.put("userData", userData);

        exchange.getIn().setBody(result);
        transformer.transform(exchange.getIn(), null, null);

        Signal signal = exchange.getIn().getBody(Signal.class);
        assertEquals(exactTimestamp, signal.timestamp().toEpochMilli());
    }

    // Helper methods
    private Map<String, Object> createTestTigerBeetleResult() {
        Map<String, Object> userData = createUserData();
        Map<String, Object> result = new HashMap<>();
        result.put("timestamp", System.currentTimeMillis());
        result.put("userData", userData);
        return result;
    }

    private Map<String, Object> createUserData() {
        Map<String, Object> userData = new HashMap<>();
        userData.put("signalId", "test-signal");
        userData.put("ruleId", "test-rule");
        userData.put("ruleVersion", "1.0");
        userData.put("spanId", "test-span");
        userData.put("traceId", "test-trace");
        userData.put("severity", "MEDIUM");
        userData.put("message", "Test message");
        userData.put("attributes", new HashMap<>());
        userData.put("source", "test-source");
        userData.put("tenantId", "test-tenant");
        userData.put("status", "EVALUATED");
        return userData;
    }
}