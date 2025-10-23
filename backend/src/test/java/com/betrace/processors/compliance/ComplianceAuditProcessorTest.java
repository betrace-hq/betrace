package com.betrace.processors.compliance;

import com.betrace.compliance.evidence.SecurityEventSpan;
import com.betrace.exceptions.InjectionAttemptException;
import com.betrace.exceptions.RateLimitExceededException;
import com.betrace.services.ComplianceSpanEmitter;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Comprehensive tests for ComplianceAuditProcessor (PRD-007 Unit E).
 *
 * Coverage Target: 90%+ instruction coverage
 *
 * Test Categories:
 * 1. Validation Failure Evidence (5 tests)
 * 2. Rate Limit Violation Evidence (3 tests)
 * 3. Injection Attempt Evidence (3 tests)
 * 4. Span Signature Verification (2 tests)
 * 5. Edge Cases (3 tests)
 */
@QuarkusTest
class ComplianceAuditProcessorTest {

    @Inject
    ComplianceAuditProcessor processor;

    @InjectMock
    ComplianceSpanEmitter spanEmitter;

    private CamelContext camelContext;

    @BeforeEach
    void setup() {
        camelContext = new DefaultCamelContext();
        reset(spanEmitter);
    }

    // ==================== Validation Failure Tests ====================

    @Test
    void testProcess_ValidationFailure_EmitsSOC2_CC6_1_Span() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        ConstraintViolationException exception = createValidationException();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");
        exchange.getIn().setHeader(Exchange.HTTP_URI, "/api/rules");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter, times(1)).emit(spanCaptor.capture());
        SecurityEventSpan span = spanCaptor.getValue();
        assertEquals("soc2", span.framework);
        assertEquals("CC6.1", span.control);
        assertEquals("AUDIT_TRAIL", span.evidenceType);
        assertEquals("blocked", span.getOutcome());
    }

    @Test
    void testProcess_ValidationFailure_IncludesViolations() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        ConstraintViolationException exception = createValidationException();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        SecurityEventSpan span = spanCaptor.getValue();
        assertTrue(span.attributes.containsKey("violations"));
        assertEquals("validation_failure", span.attributes.get("event_type"));
    }

    @Test
    void testProcess_ValidationFailure_IncludesTenantId() throws Exception {
        // Arrange
        UUID tenantId = UUID.randomUUID();
        Exchange exchange = createExchange();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, createValidationException());
        exchange.getIn().setHeader("tenantId", tenantId);
        exchange.getIn().setHeader("userId", "test-user");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        assertEquals(tenantId, spanCaptor.getValue().getTenantId());
    }

    @Test
    void testProcess_ValidationFailure_IncludesUserId() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, createValidationException());
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user-123");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        assertEquals("test-user-123", spanCaptor.getValue().getUserId());
    }

    @Test
    void testProcess_ValidationFailure_IncludesEndpoint() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, createValidationException());
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");
        exchange.getIn().setHeader(Exchange.HTTP_URI, "/api/rules");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        assertEquals("/api/rules", spanCaptor.getValue().attributes.get("endpoint"));
    }

    // ==================== Rate Limit Violation Tests ====================

    @Test
    void testProcess_RateLimitViolation_EmitsSOC2_CC6_1_Span() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        RateLimitExceededException exception = new RateLimitExceededException("Rate limit exceeded", 60L);
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        SecurityEventSpan span = spanCaptor.getValue();
        assertEquals("soc2", span.framework);
        assertEquals("CC6.1", span.control);
        assertEquals("rate_limit_exceeded", span.attributes.get("event_type"));
    }

    @Test
    void testProcess_RateLimitViolation_IncludesRetryAfter() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        RateLimitExceededException exception = new RateLimitExceededException("Rate limit exceeded", 120L);
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        assertEquals(120L, spanCaptor.getValue().attributes.get("retry_after_seconds"));
    }

    @Test
    void testProcess_RateLimitViolation_OutcomeIsBlocked() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, new RateLimitExceededException("Rate limit exceeded", 60L));
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        assertEquals("blocked", spanCaptor.getValue().getOutcome());
    }

    // ==================== Injection Attempt Tests ====================

    @Test
    void testProcess_InjectionAttempt_EmitsSOC2_CC7_1_Span() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        InjectionAttemptException exception = new InjectionAttemptException("SQL injection detected");
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        SecurityEventSpan span = spanCaptor.getValue();
        assertEquals("soc2", span.framework);
        assertEquals("CC7.1", span.control);
        assertEquals("SECURITY_EVENT", span.evidenceType);
    }

    @Test
    void testProcess_InjectionAttempt_IncludesInjectionType() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        InjectionAttemptException exception = new InjectionAttemptException("SQL injection pattern detected in input");
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        assertEquals("sql_injection", spanCaptor.getValue().attributes.get("injection_type"));
    }

    @Test
    void testProcess_InjectionAttempt_SeverityIsCritical() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, new InjectionAttemptException("XSS detected"));
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());
        exchange.getIn().setHeader("userId", "test-user");

        ArgumentCaptor<SecurityEventSpan> spanCaptor = ArgumentCaptor.forClass(SecurityEventSpan.class);

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter).emit(spanCaptor.capture());
        assertEquals("critical", spanCaptor.getValue().attributes.get("severity"));
    }

    // ==================== Edge Cases ====================

    @Test
    void testProcess_NoException_DoesNotEmitSpan() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter, never()).emit(any());
    }

    @Test
    void testProcess_UnknownException_DoesNotEmitSpan() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, new RuntimeException("Unknown error"));
        exchange.getIn().setHeader("tenantId", UUID.randomUUID());

        // Act
        processor.process(exchange);

        // Assert
        verify(spanEmitter, never()).emit(any());
    }

    @Test
    void testProcess_MissingHeaders_HandlesGracefully() throws Exception {
        // Arrange
        Exchange exchange = createExchange();
        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, createValidationException());
        // Intentionally no headers set

        // Act
        processor.process(exchange);

        // Assert - should not throw, but may emit span with null values
        verify(spanEmitter, times(1)).emit(any());
    }

    // ==================== Helper Methods ====================

    private Exchange createExchange() {
        return new DefaultExchange(camelContext);
    }

    private ConstraintViolationException createValidationException() {
        // Create a mock constraint violation
        ConstraintViolation<?> violation = mock(ConstraintViolation.class);
        when(violation.getMessage()).thenReturn("must not be null");
        when(violation.getPropertyPath()).thenReturn(mock(jakarta.validation.Path.class));

        return new ConstraintViolationException("Validation failed", Set.of(violation));
    }
}
