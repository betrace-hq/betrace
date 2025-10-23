package com.betrace.processors.redaction;

import com.betrace.model.Span;
import com.betrace.model.PIIType;
import com.betrace.compliance.evidence.RedactionStrategy;
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
class LoadRedactionRulesProcessorTest {

    @Inject
    LoadRedactionRulesProcessor processor;

    private CamelContext camelContext;

    @BeforeEach
    void setUp() {
        camelContext = new DefaultCamelContext();
    }

    @Test
    void testLoadDefaultRules() throws Exception {
        // Given: Span with valid tenant ID
        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "POST /api/users",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(100),
            Map.of(),
            "tenant-123"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then: Default rules loaded
        Map<PIIType, RedactionStrategy> rules = exchange.getIn().getHeader("redactionRules", Map.class);
        assertThat(rules).isNotNull();
        assertThat(rules).hasSize(6);

        // Verify default redaction strategies
        assertThat(rules.get(PIIType.SSN)).isEqualTo(RedactionStrategy.REDACT);
        assertThat(rules.get(PIIType.CREDIT_CARD)).isEqualTo(RedactionStrategy.MASK);
        assertThat(rules.get(PIIType.EMAIL)).isEqualTo(RedactionStrategy.HASH);
        assertThat(rules.get(PIIType.PHONE)).isEqualTo(RedactionStrategy.MASK);
        assertThat(rules.get(PIIType.NAME)).isEqualTo(RedactionStrategy.HASH);
        assertThat(rules.get(PIIType.ADDRESS)).isEqualTo(RedactionStrategy.HASH);
    }

    @Test
    void testLoadRules_NullSpan() throws Exception {
        // Given: Exchange with null span
        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(null);

        // When
        processor.process(exchange);

        // Then: Default rules still loaded
        Map<PIIType, RedactionStrategy> rules = exchange.getIn().getHeader("redactionRules", Map.class);
        assertThat(rules).isNotNull();
        assertThat(rules).hasSize(6);
        assertThat(rules.get(PIIType.SSN)).isEqualTo(RedactionStrategy.REDACT);
    }

    @Test
    void testDefaultRules_HighSensitivityPII() throws Exception {
        // Given
        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            "tenant-456"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then: High-sensitivity PII uses most secure strategies
        Map<PIIType, RedactionStrategy> rules = exchange.getIn().getHeader("redactionRules", Map.class);

        // SSN: Most sensitive, cannot be reconstructed
        assertThat(rules.get(PIIType.SSN)).isEqualTo(RedactionStrategy.REDACT);

        // Credit Card: Last 4 digits visible for verification
        assertThat(rules.get(PIIType.CREDIT_CARD)).isEqualTo(RedactionStrategy.MASK);
    }

    @Test
    void testDefaultRules_MediumSensitivityPII() throws Exception {
        // Given
        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            "tenant-789"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then: Medium-sensitivity PII uses HASH to preserve analytics
        Map<PIIType, RedactionStrategy> rules = exchange.getIn().getHeader("redactionRules", Map.class);

        // Email: Hashed to preserve uniqueness for analytics
        assertThat(rules.get(PIIType.EMAIL)).isEqualTo(RedactionStrategy.HASH);

        // Name: Hashed to preserve uniqueness
        assertThat(rules.get(PIIType.NAME)).isEqualTo(RedactionStrategy.HASH);

        // Address: Hashed to preserve uniqueness
        assertThat(rules.get(PIIType.ADDRESS)).isEqualTo(RedactionStrategy.HASH);

        // Phone: Masked (last 4 digits visible)
        assertThat(rules.get(PIIType.PHONE)).isEqualTo(RedactionStrategy.MASK);
    }

    @Test
    void testLoadRules_DifferentTenants() throws Exception {
        // Given: Two different tenants
        Span span1 = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            "tenant-aaa"
        );

        Span span2 = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            "tenant-bbb"
        );

        Exchange exchange1 = new DefaultExchange(camelContext);
        exchange1.getIn().setBody(span1);

        Exchange exchange2 = new DefaultExchange(camelContext);
        exchange2.getIn().setBody(span2);

        // When
        processor.process(exchange1);
        processor.process(exchange2);

        // Then: Both get same default rules (tenant-specific rules pending PRD-006)
        Map<PIIType, RedactionStrategy> rules1 = exchange1.getIn().getHeader("redactionRules", Map.class);
        Map<PIIType, RedactionStrategy> rules2 = exchange2.getIn().getHeader("redactionRules", Map.class);

        assertThat(rules1).isEqualTo(rules2);
    }

    @Test
    void testLoadRules_AllPIITypesCovered() throws Exception {
        // Given
        Span span = Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "GET /api",
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(50),
            Map.of(),
            "tenant-123"
        );

        Exchange exchange = new DefaultExchange(camelContext);
        exchange.getIn().setBody(span);

        // When
        processor.process(exchange);

        // Then: All PII types have a default redaction strategy
        Map<PIIType, RedactionStrategy> rules = exchange.getIn().getHeader("redactionRules", Map.class);

        for (PIIType piiType : PIIType.values()) {
            assertThat(rules).containsKey(piiType);
            assertThat(rules.get(piiType)).isNotNull();
        }
    }
}
