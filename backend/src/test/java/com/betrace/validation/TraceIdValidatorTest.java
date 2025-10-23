package com.betrace.validation;

import jakarta.validation.ConstraintValidatorContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatcher;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * TDD tests for TraceIdValidator.
 * Tests written BEFORE implementation per ADR-015.
 */
public class TraceIdValidatorTest {

    private TraceIdValidator validator;
    private ConstraintValidatorContext mockContext;
    private ConstraintValidatorContext.ConstraintViolationBuilder mockBuilder;

    @BeforeEach
    void setUp() {
        validator = new TraceIdValidator();
        mockContext = mock(ConstraintValidatorContext.class);
        mockBuilder = mock(ConstraintValidatorContext.ConstraintViolationBuilder.class);

        when(mockContext.buildConstraintViolationWithTemplate(anyString()))
            .thenReturn(mockBuilder);
        when(mockBuilder.addConstraintViolation()).thenReturn(mockContext);
    }

    @Test
    @DisplayName("Should accept valid 32-character lowercase hex Trace ID")
    void testValidTraceIdLowercase() {
        String validTraceId = "a1b2c3d4e5f6789012345678901234ab";

        boolean valid = validator.isValid(validTraceId, mockContext);

        assertTrue(valid);
        verify(mockContext, never()).disableDefaultConstraintViolation();
        verify(mockContext, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    @DisplayName("Should accept valid 32-character uppercase hex Trace ID")
    void testValidTraceIdUppercase() {
        String validTraceId = "A1B2C3D4E5F6789012345678901234AB";

        boolean valid = validator.isValid(validTraceId, mockContext);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Should accept valid 32-character mixed case hex Trace ID")
    void testValidTraceIdMixedCase() {
        String validTraceId = "A1b2C3d4E5f6789012345678901234Ab";

        boolean valid = validator.isValid(validTraceId, mockContext);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Should reject Trace ID with invalid length (too short)")
    void testInvalidTraceIdTooShort() {
        String invalidTraceId = "abc123";

        boolean valid = validator.isValid(invalidTraceId, mockContext);

        assertFalse(valid);
        verify(mockContext).disableDefaultConstraintViolation();
        verify(mockContext).buildConstraintViolationWithTemplate(
            argThat(msg -> msg.contains("32-character hexadecimal"))
        );
    }

    @Test
    @DisplayName("Should reject Trace ID with invalid length (too long)")
    void testInvalidTraceIdTooLong() {
        String invalidTraceId = "a1b2c3d4e5f6789012345678901234abcd";

        boolean valid = validator.isValid(invalidTraceId, mockContext);

        assertFalse(valid);
    }

    @Test
    @DisplayName("Should reject Trace ID with non-hex characters")
    void testInvalidTraceIdNonHexCharacters() {
        String invalidTraceId = "g1b2c3d4e5f6789012345678901234ab";

        boolean valid = validator.isValid(invalidTraceId, mockContext);

        assertFalse(valid);
        verify(mockContext).buildConstraintViolationWithTemplate(
            argThat(msg -> msg.contains("32-character hexadecimal"))
        );
    }

    @Test
    @DisplayName("Should reject Trace ID with special characters")
    void testInvalidTraceIdSpecialCharacters() {
        String invalidTraceId = "a1b2-c3d4-e5f6-7890-1234-5678-9012";

        boolean valid = validator.isValid(invalidTraceId, mockContext);

        assertFalse(valid);
    }

    @Test
    @DisplayName("Should handle null Trace ID gracefully")
    void testNullTraceId() {
        boolean valid = validator.isValid(null, mockContext);

        assertTrue(valid);  // @NotBlank handles null check
        verify(mockContext, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    @DisplayName("Should handle blank Trace ID gracefully")
    void testBlankTraceId() {
        boolean valid = validator.isValid("", mockContext);

        assertTrue(valid);  // @NotBlank handles blank check
        verify(mockContext, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    @DisplayName("Should handle whitespace-only Trace ID gracefully")
    void testWhitespaceTraceId() {
        boolean valid = validator.isValid("   ", mockContext);

        assertTrue(valid);  // @NotBlank handles whitespace
    }

    @Test
    @DisplayName("Should accept all valid hex characters")
    void testAllValidHexCharacters() {
        String validTraceId = "0123456789abcdef0123456789abcdef";

        boolean valid = validator.isValid(validTraceId, mockContext);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Should reject Trace ID with exactly 31 characters")
    void testTraceIdBoundary31Characters() {
        String invalidTraceId = "a1b2c3d4e5f6789012345678901234a";

        boolean valid = validator.isValid(invalidTraceId, mockContext);

        assertFalse(valid);
    }

    @Test
    @DisplayName("Should reject Trace ID with exactly 33 characters")
    void testTraceIdBoundary33Characters() {
        String invalidTraceId = "a1b2c3d4e5f6789012345678901234abc";

        boolean valid = validator.isValid(invalidTraceId, mockContext);

        assertFalse(valid);
    }
}
