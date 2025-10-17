package com.fluo.processors.redaction;

import com.fluo.model.Span;
import com.fluo.model.PIIType;
import com.fluo.services.PIIDetectionService;
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
class DetectPIIProcessorTest {

    @Inject
    DetectPIIProcessor processor;

    @Inject
    PIIDetectionService piiDetector;

    private CamelContext camelContext;

    @BeforeEach
    void setUp() {
        camelContext = new DefaultCamelContext();
    }

    @Test
    void testDetectPII_NoPIIPresent() throws Exception {
        // Given: Span with no PII
        Map<String, Object> attributes = Map.of(
            "http.method", "GET",
            "http.status_code", 200,
            "service.name", "test-service"
        );

        Span span = new Span(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "tenant-123",
            "test-service",
            "GET /api",
            Instant.now(),
            Instant.now().plusMillis(100),
            attributes,
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then
        assertThat(exchange.getIn().getHeader("hasPII", Boolean.class)).isFalse();
        assertThat(exchange.getIn().getHeader("piiFields", Map.class)).isEmpty();
    }

    @Test
    void testDetectPII_EmailPresent() throws Exception {
        // Given: Span with email PII
        Map<String, Object> attributes = Map.of(
            "user.email", "test@example.com",
            "http.method", "POST"
        );

        Span span = new Span(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "tenant-123",
            "test-service",
            "POST /api/users",
            Instant.now(),
            Instant.now().plusMillis(100),
            attributes,
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then
        assertThat(exchange.getIn().getHeader("hasPII", Boolean.class)).isTrue();
        Map<String, PIIType> piiFields = exchange.getIn().getHeader("piiFields", Map.class);
        assertThat(piiFields).containsEntry("user.email", PIIType.EMAIL);
    }

    @Test
    void testDetectPII_MultiplePIITypes() throws Exception {
        // Given: Span with multiple PII types
        Map<String, Object> attributes = Map.of(
            "user.email", "test@example.com",
            "user.phone", "555-123-4567",
            "user.ssn", "123-45-6789",
            "request.id", "req-123"
        );

        Span span = new Span(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "tenant-123",
            "test-service",
            "POST /api/users",
            Instant.now(),
            Instant.now().plusMillis(100),
            attributes,
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then
        assertThat(exchange.getIn().getHeader("hasPII", Boolean.class)).isTrue();
        Map<String, PIIType> piiFields = exchange.getIn().getHeader("piiFields", Map.class);
        assertThat(piiFields).hasSize(3);
        assertThat(piiFields).containsEntry("user.email", PIIType.EMAIL);
        assertThat(piiFields).containsEntry("user.phone", PIIType.PHONE);
        assertThat(piiFields).containsEntry("user.ssn", PIIType.SSN);
        assertThat(piiFields).doesNotContainKey("request.id");
    }

    @Test
    void testDetectPII_NullSpan() throws Exception {
        // Given: Exchange with null span
        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(null);

        // When
        processor.process(exchange);

        // Then: Headers set to safe defaults
        assertThat(exchange.getIn().getHeader("hasPII", Boolean.class)).isFalse();
        assertThat(exchange.getIn().getHeader("piiFields", Map.class)).isEmpty();
    }

    @Test
    void testDetectPII_EmptyAttributes() throws Exception {
        // Given: Span with empty attributes
        Span span = new Span(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "tenant-123",
            "test-service",
            "GET /health",
            Instant.now(),
            Instant.now().plusMillis(10),
            Map.of(),
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then
        assertThat(exchange.getIn().getHeader("hasPII", Boolean.class)).isFalse();
        assertThat(exchange.getIn().getHeader("piiFields", Map.class)).isEmpty();
    }

    @Test
    void testDetectPII_CreditCardPresent() throws Exception {
        // Given: Span with credit card PII
        Map<String, Object> attributes = Map.of(
            "payment.card_number", "4532-1234-5678-9010",
            "payment.amount", 99.99
        );

        Span span = new Span(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "tenant-123",
            "payment-service",
            "POST /api/payments",
            Instant.now(),
            Instant.now().plusMillis(200),
            attributes,
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then
        assertThat(exchange.getIn().getHeader("hasPII", Boolean.class)).isTrue();
        Map<String, PIIType> piiFields = exchange.getIn().getHeader("piiFields", Map.class);
        assertThat(piiFields).containsEntry("payment.card_number", PIIType.CREDIT_CARD);
        assertThat(piiFields).doesNotContainKey("payment.amount");
    }

    @Test
    void testDetectPII_NameAndAddressPresent() throws Exception {
        // Given: Span with name and address PII
        Map<String, Object> attributes = Map.of(
            "user.full_name", "John Doe",
            "user.address", "123 Main St, City, State 12345"
        );

        Span span = new Span(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "tenant-123",
            "user-service",
            "POST /api/users",
            Instant.now(),
            Instant.now().plusMillis(150),
            attributes,
            null
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then
        assertThat(exchange.getIn().getHeader("hasPII", Boolean.class)).isTrue();
        Map<String, PIIType> piiFields = exchange.getIn().getHeader("piiFields", Map.class);
        assertThat(piiFields).hasSize(2);
        assertThat(piiFields).containsEntry("user.full_name", PIIType.NAME);
        assertThat(piiFields).containsEntry("user.address", PIIType.ADDRESS);
    }
}
