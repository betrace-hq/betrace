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
class GenerateRedactionComplianceSpanProcessorTest {

    @Inject
    GenerateRedactionComplianceSpanProcessor processor;

    private CamelContext camelContext;

    @BeforeEach
    void setUp() {
        camelContext = new DefaultCamelContext();
    }

    @Test
    void testGenerateComplianceSpan_RedactionOccurred() throws Exception {
        // Given: Exchange with redacted fields
        Span span = Span.create(
            "span-456",
            "trace-123",
            "POST /api/users",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            Map.of(),
            "tenant-789"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 3);

        // When
        processor.process(exchange);

        // Then: Compliance span generated
        assertThat(exchange.getIn().getHeader("complianceSpanGenerated", Boolean.class)).isTrue();
    }

    @Test
    void testGenerateComplianceSpan_NoRedaction() throws Exception {
        // Given: Exchange with no redaction
        Span span = Span.create(
            "span-456",
            "trace-123",
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            "tenant-789"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 0);

        // When
        processor.process(exchange);

        // Then: No compliance span generated
        assertThat(exchange.getIn().getHeader("complianceSpanGenerated", Boolean.class)).isNull();
    }

    @Test
    void testGenerateComplianceSpan_NullRedactedCount() throws Exception {
        // Given: Exchange with null redactedFieldCount
        Span span = Span.create(
            "span-456",
            "trace-123",
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            "tenant-789"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        // redactedFieldCount header not set

        // When
        processor.process(exchange);

        // Then: No compliance span generated
        assertThat(exchange.getIn().getHeader("complianceSpanGenerated", Boolean.class)).isNull();
    }

    @Test
    void testGenerateComplianceSpan_NullSpan() throws Exception {
        // Given: Exchange with null span but positive redactedFieldCount
        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(null);
        exchange.getIn().setHeader("redactedFieldCount", 2);

        // When
        processor.process(exchange);

        // Then: No compliance span generated (defensive)
        assertThat(exchange.getIn().getHeader("complianceSpanGenerated", Boolean.class)).isNull();
    }

    @Test
    void testGenerateComplianceSpan_SingleFieldRedacted() throws Exception {
        // Given: Exchange with 1 redacted field
        Span span = Span.create(
            "span-def",
            "trace-abc",
            "POST /api/users",
            "user-service",
            Instant.now(),
            Instant.now().plusMillis(120),
            Map.of(),
            "tenant-ghi"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 1);

        // When
        processor.process(exchange);

        // Then: Compliance span generated for SOC2 CC6.7
        assertThat(exchange.getIn().getHeader("complianceSpanGenerated", Boolean.class)).isTrue();
    }

    @Test
    void testGenerateComplianceSpan_MultipleFieldsRedacted() throws Exception {
        // Given: Exchange with multiple redacted fields
        Span span = Span.create(
            "span-uvw",
            "trace-xyz",
            "POST /api/payments",
            "payment-service",
            Instant.now(),
            Instant.now().plusMillis(200),
            Map.of(),
            "tenant-rst"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 5);

        // When
        processor.process(exchange);

        // Then: Compliance span generated
        assertThat(exchange.getIn().getHeader("complianceSpanGenerated", Boolean.class)).isTrue();
    }

    @Test
    void testGenerateComplianceSpan_PreservesSpanInBody() throws Exception {
        // Given: Exchange with span and redaction
        Span originalSpan = Span.create(
            "span-456",
            "trace-123",
            "POST /api/users",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            Map.of("key", "value"),
            "tenant-789"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(originalSpan);
        exchange.getIn().setHeader("redactedFieldCount", 2);

        // When
        processor.process(exchange);

        // Then: Span unchanged in body
        Span resultSpan = exchange.getIn().getBody(Span.class);
        assertThat(resultSpan).isEqualTo(originalSpan);
        assertThat(resultSpan.traceId()).isEqualTo("trace-123");
        assertThat(resultSpan.spanId()).isEqualTo("span-456");
        assertThat(resultSpan.tenantId()).isEqualTo("tenant-789");
    }

    @Test
    void testGenerateComplianceSpan_SOC2_CC6_7_Evidence() throws Exception {
        // Given: Redaction event for SOC2 CC6.7 (Data Classification)
        Span span = Span.create(
            "span-compliance",
            "trace-compliance",
            "POST /api/sensitive-data",
            "compliance-service",
            Instant.now(),
            Instant.now().plusMillis(250),
            Map.of(),
            "tenant-soc2"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("redactedFieldCount", 4);

        // When
        processor.process(exchange);

        // Then: SOC2 CC6.7 compliance evidence generated
        // NOTE: Full ComplianceSpan integration pending PRD-003
        // Currently logs: framework=soc2 control=CC6.7
        assertThat(exchange.getIn().getHeader("complianceSpanGenerated", Boolean.class)).isTrue();
    }
}
