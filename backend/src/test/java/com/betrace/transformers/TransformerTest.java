package com.fluo.transformers;

import com.fluo.model.Signal;
import com.fluo.model.Span;
import com.fluo.model.Rule;
import com.fluo.transformers.signal.JsonToSignalTransformer;
import com.fluo.transformers.signal.SignalToTigerBeetleTransformer;
import com.fluo.transformers.span.JsonToSpanTransformer;
import com.fluo.transformers.span.SpanToRuleContextTransformer;
import com.fluo.transformers.rule.JsonToRuleTransformer;

import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test that all transformers properly extend Transformer and implement the transform method.
 */
public class TransformerTest {

    private CamelContext context;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        context = new DefaultCamelContext();
        exchange = new DefaultExchange(context);
    }

    @Test
    void testJsonToSignalTransformer() throws Exception {
        JsonToSignalTransformer transformer = new JsonToSignalTransformer();

        String json = """
            {
                "ruleId": "rule-123",
                "ruleVersion": "1.0",
                "spanId": "span-456",
                "traceId": "trace-789",
                "severity": "HIGH",
                "message": "Test signal",
                "attributes": {"key": "value"},
                "source": "test-source",
                "tenantId": "tenant-001"
            }
            """;

        exchange.getMessage().setBody(json);
        transformer.transform(exchange.getMessage(), null, null);

        Signal signal = exchange.getMessage().getBody(Signal.class);
        assertNotNull(signal);
        assertEquals("rule-123", signal.ruleId());
        assertEquals("span-456", signal.spanId());
        assertEquals(Signal.SignalSeverity.HIGH, signal.severity());
    }

    @Test
    void testSignalToTigerBeetleTransformer() throws Exception {
        SignalToTigerBeetleTransformer transformer = new SignalToTigerBeetleTransformer();

        Signal signal = Signal.create(
            "rule-123",
            "1.0",
            "span-456",
            "trace-789",
            Signal.SignalSeverity.MEDIUM,
            "Test message",
            Map.of("key", "value"),
            "test-source",
            "tenant-001"
        );

        exchange.getMessage().setBody(signal);
        transformer.transform(exchange.getMessage(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = exchange.getMessage().getBody(Map.class);
        assertNotNull(result);
        assertEquals(signal.id(), result.get("id"));
        assertNotNull(result.get("userData"));
    }

    @Test
    void testJsonToSpanTransformer() throws Exception {
        JsonToSpanTransformer transformer = new JsonToSpanTransformer();

        String json = """
            {
                "spanId": "span-123",
                "traceId": "trace-456",
                "operationName": "test-op",
                "serviceName": "test-service",
                "startTime": 1000,
                "endTime": 2000,
                "attributes": {"key": "value"},
                "tenantId": "tenant-001"
            }
            """;

        exchange.getMessage().setBody(json);
        transformer.transform(exchange.getMessage(), null, null);

        Span span = exchange.getMessage().getBody(Span.class);
        assertNotNull(span);
        assertEquals("span-123", span.spanId());
        assertEquals("test-op", span.operationName());
    }

    @Test
    void testSpanToRuleContextTransformer() throws Exception {
        SpanToRuleContextTransformer transformer = new SpanToRuleContextTransformer();

        Span span = Span.create(
            "span-123",
            "trace-456",
            "test-op",
            "test-service",
            Instant.now(),
            Instant.now().plusSeconds(1),
            Map.of("key", "value")
        );

        exchange.getMessage().setBody(span);
        transformer.transform(exchange.getMessage(), null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> context = exchange.getMessage().getBody(Map.class);
        assertNotNull(context);
        assertEquals("span-123", context.get("spanId"));
        assertEquals("test-service", context.get("serviceName"));
    }

    @Test
    void testJsonToRuleTransformer() throws Exception {
        JsonToRuleTransformer transformer = new JsonToRuleTransformer();

        String json = """
            {
                "id": "rule-123",
                "name": "Test Rule",
                "version": "2.0",
                "expression": "severity == 'HIGH'",
                "type": "OGNL"
            }
            """;

        exchange.getMessage().setBody(json);
        transformer.transform(exchange.getMessage(), null, null);

        Rule rule = exchange.getMessage().getBody(Rule.class);
        assertNotNull(rule);
        assertEquals("rule-123", rule.id());
        assertEquals("Test Rule", rule.name());
        assertEquals("2.0", rule.version());
        assertEquals(Rule.RuleType.OGNL, rule.type());
    }
}