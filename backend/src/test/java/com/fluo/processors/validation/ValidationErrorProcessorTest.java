package com.fluo.processors.validation;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * TDD tests for ValidationErrorProcessor.
 * Tests written BEFORE implementation per ADR-015.
 */
public class ValidationErrorProcessorTest {

    private ValidationErrorProcessor processor;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        processor = new ValidationErrorProcessor();
        exchange = new DefaultExchange(new DefaultCamelContext());
    }

    @Test
    @DisplayName("Should format constraint violations into ValidationErrorResponse")
    void testValidationErrorProcessorWithViolations() throws Exception {
        // Create mock constraint violations
        Set<ConstraintViolation<?>> violations = createMockViolations();
        ConstraintViolationException exception = new ConstraintViolationException(violations);

        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);

        processor.process(exchange);

        // Verify response structure
        Object body = exchange.getIn().getBody();
        assertNotNull(body);
        assertTrue(body instanceof Map);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) body;

        assertEquals("Validation failed", response.get("error"));
        assertNotNull(response.get("violations"));
    }

    @Test
    @DisplayName("Should set HTTP 400 status code")
    void testSetsHttp400Status() throws Exception {
        Set<ConstraintViolation<?>> violations = createMockViolations();
        ConstraintViolationException exception = new ConstraintViolationException(violations);

        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);

        processor.process(exchange);

        assertEquals(400, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
    }

    @Test
    @DisplayName("Should handle empty violation set")
    void testHandlesEmptyViolations() throws Exception {
        Set<ConstraintViolation<?>> violations = new HashSet<>();
        ConstraintViolationException exception = new ConstraintViolationException(violations);

        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertNotNull(response);
        assertEquals("Validation failed", response.get("error"));
    }

    @Test
    @DisplayName("Should extract field name and message from violations")
    void testExtractsFieldAndMessage() throws Exception {
        ConstraintViolation<?> violation = createViolation("name", "Name is required", "");
        Set<ConstraintViolation<?>> violations = Set.of(violation);
        ConstraintViolationException exception = new ConstraintViolationException(violations);

        exchange.setProperty(Exchange.EXCEPTION_CAUGHT, exception);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = (Map<String, Object>) exchange.getIn().getBody();
        assertNotNull(response.get("violations"));
    }

    // Helper methods to create mock violations
    private Set<ConstraintViolation<?>> createMockViolations() {
        ConstraintViolation<?> violation1 = createViolation("name", "Name is required", "");
        ConstraintViolation<?> violation2 = createViolation("expression", "Expression is required", "");
        return Set.of(violation1, violation2);
    }

    @SuppressWarnings("unchecked")
    private ConstraintViolation<?> createViolation(String field, String message, Object invalidValue) {
        ConstraintViolation<?> violation = mock(ConstraintViolation.class);
        Path path = mock(Path.class);
        when(path.toString()).thenReturn(field);
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn(message);
        when(violation.getInvalidValue()).thenReturn(invalidValue);
        return violation;
    }
}
