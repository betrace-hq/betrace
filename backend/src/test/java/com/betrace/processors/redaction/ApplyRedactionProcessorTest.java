package com.betrace.processors.redaction;

import com.betrace.model.Span;
import com.betrace.model.PIIType;
import com.betrace.compliance.evidence.RedactionStrategy;
import com.betrace.services.RedactionService;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
class ApplyRedactionProcessorTest {

    @Inject
    ApplyRedactionProcessor processor;

    @Inject
    RedactionService redactionService;

    private CamelContext camelContext;

    @BeforeEach
    void setUp() {
        camelContext = new DefaultCamelContext();
    }

    @Test
    void testApplyRedaction_NoPII() throws Exception {
        // Given: Exchange with hasPII=false
        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            Map.of("http.method", "GET"),
            "tenant-123"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("hasPII", false);

        // When
        processor.process(exchange);

        // Then: No redaction applied
        assertThat(exchange.getIn().getHeader("redactedFieldCount", Integer.class)).isEqualTo(0);
        assertThat(exchange.getIn().getHeader("redactedFields", Map.class)).isNull();
    }

    @Test
    void testApplyRedaction_NullHasPII() throws Exception {
        // Given: Exchange with null hasPII
        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            Map.of(),
            "tenant-123"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        // hasPII header not set

        // When
        processor.process(exchange);

        // Then: No redaction applied
        assertThat(exchange.getIn().getHeader("redactedFieldCount", Integer.class)).isEqualTo(0);
    }

    @Test
    void testApplyRedaction_EmailWithHashStrategy() throws Exception {
        // Given: Span with email PII and HASH strategy
        Map<String, Object> attributes = Map.of(
            "user.email", "test@example.com",
            "http.method", "POST"
        );

        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "POST /api/users",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            attributes,
            "tenant-123"
        );

        Map<String, PIIType> piiFields = Map.of("user.email", PIIType.EMAIL);
        Map<PIIType, RedactionStrategy> rules = Map.of(PIIType.EMAIL, RedactionStrategy.HASH);

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("hasPII", true);
        exchange.getIn().setHeader("piiFields", piiFields);
        exchange.getIn().setHeader("redactionRules", rules);

        // When
        processor.process(exchange);

        // Then: Email redacted with HASH
        assertThat(exchange.getIn().getHeader("redactedFieldCount", Integer.class)).isEqualTo(1);
        Map<String, String> redactedFields = exchange.getIn().getHeader("redactedFields", Map.class);
        assertThat(redactedFields).containsKey("user.email");
        assertThat(redactedFields.get("user.email")).startsWith("hash:");
        assertThat(redactedFields.get("user.email")).isNotEqualTo("test@example.com");
    }

    @Test
    void testApplyRedaction_SSNWithRedactStrategy() throws Exception {
        // Given: Span with SSN PII and REDACT strategy
        Map<String, Object> attributes = Map.of(
            "user.ssn", "123-45-6789"
        );

        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "POST /api/users",
            "user-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            attributes,
            "tenant-456"
        );

        Map<String, PIIType> piiFields = Map.of("user.ssn", PIIType.SSN);
        Map<PIIType, RedactionStrategy> rules = Map.of(PIIType.SSN, RedactionStrategy.REDACT);

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("hasPII", true);
        exchange.getIn().setHeader("piiFields", piiFields);
        exchange.getIn().setHeader("redactionRules", rules);

        // When
        processor.process(exchange);

        // Then: SSN redacted completely
        assertThat(exchange.getIn().getHeader("redactedFieldCount", Integer.class)).isEqualTo(1);
        Map<String, String> redactedFields = exchange.getIn().getHeader("redactedFields", Map.class);
        assertThat(redactedFields).containsKey("user.ssn");
        assertThat(redactedFields.get("user.ssn")).isEqualTo("[REDACTED]");
    }

    @Test
    void testApplyRedaction_CreditCardWithMaskStrategy() throws Exception {
        // Given: Span with credit card PII and MASK strategy
        Map<String, Object> attributes = Map.of(
            "payment.card_number", "4532-1234-5678-9010"
        );

        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "POST /api/payments",
            "payment-service",
            Instant.now(),
            Instant.now().plusMillis(200),
            attributes,
            "tenant-789"
        );

        Map<String, PIIType> piiFields = Map.of("payment.card_number", PIIType.CREDIT_CARD);
        Map<PIIType, RedactionStrategy> rules = Map.of(PIIType.CREDIT_CARD, RedactionStrategy.MASK);

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("hasPII", true);
        exchange.getIn().setHeader("piiFields", piiFields);
        exchange.getIn().setHeader("redactionRules", rules);

        // When
        processor.process(exchange);

        // Then: Credit card masked (last 4 digits visible)
        assertThat(exchange.getIn().getHeader("redactedFieldCount", Integer.class)).isEqualTo(1);
        Map<String, String> redactedFields = exchange.getIn().getHeader("redactedFields", Map.class);
        assertThat(redactedFields).containsKey("payment.card_number");
        assertThat(redactedFields.get("payment.card_number")).endsWith("9010");
        assertThat(redactedFields.get("payment.card_number")).contains("****");
    }

    @Test
    void testApplyRedaction_MultiplePIIFields() throws Exception {
        // Given: Span with multiple PII fields
        Map<String, Object> attributes = Map.of(
            "user.email", "test@example.com",
            "user.phone", "555-123-4567",
            "user.ssn", "123-45-6789"
        );

        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "POST /api/users",
            "user-service",
            Instant.now(),
            Instant.now().plusMillis(150),
            attributes,
            "tenant-123"
        );

        Map<String, PIIType> piiFields = Map.of(
            "user.email", PIIType.EMAIL,
            "user.phone", PIIType.PHONE,
            "user.ssn", PIIType.SSN
        );

        Map<PIIType, RedactionStrategy> rules = Map.of(
            PIIType.EMAIL, RedactionStrategy.HASH,
            PIIType.PHONE, RedactionStrategy.MASK,
            PIIType.SSN, RedactionStrategy.REDACT
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("hasPII", true);
        exchange.getIn().setHeader("piiFields", piiFields);
        exchange.getIn().setHeader("redactionRules", rules);

        // When
        processor.process(exchange);

        // Then: All PII fields redacted
        assertThat(exchange.getIn().getHeader("redactedFieldCount", Integer.class)).isEqualTo(3);
        Map<String, String> redactedFields = exchange.getIn().getHeader("redactedFields", Map.class);
        assertThat(redactedFields).hasSize(3);
        assertThat(redactedFields).containsKey("user.email");
        assertThat(redactedFields).containsKey("user.phone");
        assertThat(redactedFields).containsKey("user.ssn");
    }

    @Test
    void testApplyRedaction_DefaultRulesUsedWhenNotProvided() throws Exception {
        // Given: Span with PII but no redactionRules header
        Map<String, Object> attributes = Map.of(
            "user.email", "test@example.com"
        );

        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "POST /api/users",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            attributes,
            "tenant-123"
        );

        Map<String, PIIType> piiFields = Map.of("user.email", PIIType.EMAIL);

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("hasPII", true);
        exchange.getIn().setHeader("piiFields", piiFields);
        // redactionRules header not set

        // When
        processor.process(exchange);

        // Then: Default rules applied (EMAIL → HASH)
        assertThat(exchange.getIn().getHeader("redactedFieldCount", Integer.class)).isEqualTo(1);
        Map<String, String> redactedFields = exchange.getIn().getHeader("redactedFields", Map.class);
        assertThat(redactedFields).containsKey("user.email");
        assertThat(redactedFields.get("user.email")).startsWith("hash:");
    }

    @Test
    void testApplyRedaction_UnknownPIITypeUsesHashDefault() throws Exception {
        // Given: Span with PII type not in rules
        Map<String, Object> attributes = Map.of(
            "user.address", "123 Main St"
        );

        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "POST /api/users",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            attributes,
            "tenant-123"
        );

        Map<String, PIIType> piiFields = Map.of("user.address", PIIType.ADDRESS);
        Map<PIIType, RedactionStrategy> rules = new HashMap<>();
        // ADDRESS not in rules

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);
        exchange.getIn().setHeader("hasPII", true);
        exchange.getIn().setHeader("piiFields", piiFields);
        exchange.getIn().setHeader("redactionRules", rules);

        // When
        processor.process(exchange);

        // Then: HASH used as default
        assertThat(exchange.getIn().getHeader("redactedFieldCount", Integer.class)).isEqualTo(1);
        Map<String, String> redactedFields = exchange.getIn().getHeader("redactedFields", Map.class);
        assertThat(redactedFields).containsKey("user.address");
        assertThat(redactedFields.get("user.address")).startsWith("hash:");
    }
}
