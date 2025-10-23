package com.betrace.validation;

import jakarta.validation.ConstraintValidatorContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * TDD tests for SpanIdValidator.
 * Tests written BEFORE implementation per ADR-015.
 */
public class SpanIdValidatorTest {

    private SpanIdValidator validator;
    private ConstraintValidatorContext mockContext;
    private ConstraintValidatorContext.ConstraintViolationBuilder mockBuilder;

    @BeforeEach
    void setUp() {
        validator = new SpanIdValidator();
        mockContext = mock(ConstraintValidatorContext.class);
        mockBuilder = mock(ConstraintValidatorContext.ConstraintViolationBuilder.class);

        when(mockContext.buildConstraintViolationWithTemplate(anyString()))
            .thenReturn(mockBuilder);
        when(mockBuilder.addConstraintViolation()).thenReturn(mockContext);
    }

    @Test
    @DisplayName("Should accept valid 16-character lowercase hex Span ID")
    void testValidSpanIdLowercase() {
        String validSpanId = "a1b2c3d4e5f67890";

        boolean valid = validator.isValid(validSpanId, mockContext);

        assertTrue(valid);
        verify(mockContext, never()).disableDefaultConstraintViolation();
        verify(mockContext, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    @DisplayName("Should accept valid 16-character uppercase hex Span ID")
    void testValidSpanIdUppercase() {
        String validSpanId = "A1B2C3D4E5F67890";

        boolean valid = validator.isValid(validSpanId, mockContext);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Should accept valid 16-character mixed case hex Span ID")
    void testValidSpanIdMixedCase() {
        String validSpanId = "A1b2C3d4E5f67890";

        boolean valid = validator.isValid(validSpanId, mockContext);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Should reject Span ID with invalid length (too short)")
    void testInvalidSpanIdTooShort() {
        String invalidSpanId = "abc123";

        boolean valid = validator.isValid(invalidSpanId, mockContext);

        assertFalse(valid);
        verify(mockContext).disableDefaultConstraintViolation();
        verify(mockContext).buildConstraintViolationWithTemplate(
            argThat(msg -> msg.contains("16-character hexadecimal"))
        );
    }

    @Test
    @DisplayName("Should reject Span ID with invalid length (too long)")
    void testInvalidSpanIdTooLong() {
        String invalidSpanId = "a1b2c3d4e5f67890abc";

        boolean valid = validator.isValid(invalidSpanId, mockContext);

        assertFalse(valid);
    }

    @Test
    @DisplayName("Should reject Span ID with non-hex characters")
    void testInvalidSpanIdNonHexCharacters() {
        String invalidSpanId = "g1b2c3d4e5f67890";

        boolean valid = validator.isValid(invalidSpanId, mockContext);

        assertFalse(valid);
        verify(mockContext).buildConstraintViolationWithTemplate(
            argThat(msg -> msg.contains("16-character hexadecimal"))
        );
    }

    @Test
    @DisplayName("Should reject Span ID with special characters")
    void testInvalidSpanIdSpecialCharacters() {
        String invalidSpanId = "a1b2-c3d4-e5f6-78";

        boolean valid = validator.isValid(invalidSpanId, mockContext);

        assertFalse(valid);
    }

    @Test
    @DisplayName("Should handle null Span ID gracefully")
    void testNullSpanId() {
        boolean valid = validator.isValid(null, mockContext);

        assertTrue(valid);  // @NotBlank handles null check
        verify(mockContext, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    @DisplayName("Should handle blank Span ID gracefully")
    void testBlankSpanId() {
        boolean valid = validator.isValid("", mockContext);

        assertTrue(valid);  // @NotBlank handles blank check
        verify(mockContext, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    @DisplayName("Should handle whitespace-only Span ID gracefully")
    void testWhitespaceSpanId() {
        boolean valid = validator.isValid("   ", mockContext);

        assertTrue(valid);  // @NotBlank handles whitespace
    }

    @Test
    @DisplayName("Should accept all valid hex characters")
    void testAllValidHexCharacters() {
        String validSpanId = "0123456789abcdef";

        boolean valid = validator.isValid(validSpanId, mockContext);

        assertTrue(valid);
    }

    @Test
    @DisplayName("Should reject Span ID with exactly 15 characters")
    void testSpanIdBoundary15Characters() {
        String invalidSpanId = "a1b2c3d4e5f6789";

        boolean valid = validator.isValid(invalidSpanId, mockContext);

        assertFalse(valid);
    }

    @Test
    @DisplayName("Should reject Span ID with exactly 17 characters")
    void testSpanIdBoundary17Characters() {
        String invalidSpanId = "a1b2c3d4e5f678901";

        boolean valid = validator.isValid(invalidSpanId, mockContext);

        assertFalse(valid);
    }
}
