package com.fluo.processors.redaction;

import com.fluo.model.Span;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class RecordRedactionEventProcessorTest {

    @Inject
    RecordRedactionEventProcessor processor;

    private CamelContext camelContext;

    @BeforeEach
    void setUp() {
        camelContext = new DefaultCamelContext();
    }

    @Test
    void testRecordEvent_RedactionOccurred() throws Exception {
        // Given: Exchange with redacted fields
        Span span = new Span(
            "trace-123",
            "span-456",
            "tenant-789",
            "test-service",
            "POST /api/users",
            Instant.now(),
            Instant.now().plusMillis(100),
            Map.of(),
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 3);

        // When
        processor.process(exchange);

        // Then: Audit event recorded
        assertThat(exchange.getIn().getHeader("auditEventRecorded", Boolean.class)).isTrue();
    }

    @Test
    void testRecordEvent_NoRedaction() throws Exception {
        // Given: Exchange with no redaction
        Span span = new Span(
            "trace-123",
            "span-456",
            "tenant-789",
            "test-service",
            "GET /api",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 0);

        // When
        processor.process(exchange);

        // Then: No audit event recorded
        assertThat(exchange.getIn().getHeader("auditEventRecorded", Boolean.class)).isNull();
    }

    @Test
    void testRecordEvent_NullRedactedCount() throws Exception {
        // Given: Exchange with null redactedFieldCount
        Span span = new Span(
            "trace-123",
            "span-456",
            "tenant-789",
            "test-service",
            "GET /api",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        // redactedFieldCount header not set

        // When
        processor.process(exchange);

        // Then: No audit event recorded
        assertThat(exchange.getIn().getHeader("auditEventRecorded", Boolean.class)).isNull();
    }

    @Test
    void testRecordEvent_NullSpan() throws Exception {
        // Given: Exchange with null span but positive redactedFieldCount
        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(null);
        exchange.getIn().setHeader("redactedFieldCount", 2);

        // When
        processor.process(exchange);

        // Then: No audit event recorded (defensive)
        assertThat(exchange.getIn().getHeader("auditEventRecorded", Boolean.class)).isNull();
    }

    @Test
    void testRecordEvent_SingleFieldRedacted() throws Exception {
        // Given: Exchange with 1 redacted field
        Span span = new Span(
            "trace-abc",
            "span-def",
            "tenant-ghi",
            "user-service",
            "POST /api/users",
            Instant.now(),
            Instant.now().plusMillis(120),
            Map.of(),
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 1);

        // When
        processor.process(exchange);

        // Then: Audit event recorded
        assertThat(exchange.getIn().getHeader("auditEventRecorded", Boolean.class)).isTrue();
    }

    @Test
    void testRecordEvent_MultipleFieldsRedacted() throws Exception {
        // Given: Exchange with multiple redacted fields
        Span span = new Span(
            "trace-xyz",
            "span-uvw",
            "tenant-rst",
            "payment-service",
            "POST /api/payments",
            Instant.now(),
            Instant.now().plusMillis(200),
            Map.of(),
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 5);

        // When
        processor.process(exchange);

        // Then: Audit event recorded
        assertThat(exchange.getIn().getHeader("auditEventRecorded", Boolean.class)).isTrue();
    }

    @Test
    void testRecordEvent_PreservesSpanInBody() throws Exception {
        // Given: Exchange with span and redaction
        Span originalSpan = new Span(
            "trace-123",
            "span-456",
            "tenant-789",
            "test-service",
            "POST /api/users",
            Instant.now(),
            Instant.now().plusMillis(100),
            Map.of("key", "value"),
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(originalSpan);
        exchange.getIn().setHeader("redactedFieldCount", 2);

        // When
        processor.process(exchange);

        // Then: Span unchanged in body
        Span resultSpan = exchange.getIn().getBody(Span.class);
        assertThat(resultSpan).isEqualTo(originalSpan);
        assertThat(resultSpan.getTraceId()).isEqualTo("trace-123");
        assertThat(resultSpan.getSpanId()).isEqualTo("span-456");
        assertThat(resultSpan.getTenantId()).isEqualTo("tenant-789");
    }
}
