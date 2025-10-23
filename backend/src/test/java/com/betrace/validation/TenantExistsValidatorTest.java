package com.fluo.validation;

import com.fluo.services.TenantService;
import jakarta.validation.ConstraintValidatorContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * TDD tests for TenantExistsValidator.
 * Tests written BEFORE implementation per ADR-015.
 */
public class TenantExistsValidatorTest {

    private TenantExistsValidator validator;
    private TenantService mockTenantService;
    private ConstraintValidatorContext mockContext;
    private ConstraintValidatorContext.ConstraintViolationBuilder mockBuilder;

    @BeforeEach
    void setUp() {
        validator = new TenantExistsValidator();
        mockTenantService = mock(TenantService.class);
        validator.tenantService = mockTenantService;

        mockContext = mock(ConstraintValidatorContext.class);
        mockBuilder = mock(ConstraintValidatorContext.ConstraintViolationBuilder.class);

        when(mockContext.buildConstraintViolationWithTemplate(anyString()))
            .thenReturn(mockBuilder);
        when(mockBuilder.addConstraintViolation()).thenReturn(mockContext);
    }

    @Test
    @DisplayName("Should accept valid existing tenant ID")
    void testExistingTenant() {
        UUID tenantId = UUID.randomUUID();
        when(mockTenantService.exists(tenantId)).thenReturn(true);

        boolean valid = validator.isValid(tenantId, mockContext);

        assertTrue(valid);
        verify(mockTenantService).exists(tenantId);
        verify(mockContext, never()).disableDefaultConstraintViolation();
        verify(mockContext, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    @DisplayName("Should reject non-existent tenant ID with generic error")
    void testNonExistentTenant() {
        UUID tenantId = UUID.randomUUID();
        when(mockTenantService.exists(tenantId)).thenReturn(false);

        boolean valid = validator.isValid(tenantId, mockContext);

        assertFalse(valid);
        verify(mockTenantService).exists(tenantId);
        verify(mockContext).disableDefaultConstraintViolation();
        // Verify generic error message (security: prevent enumeration)
        verify(mockContext).buildConstraintViolationWithTemplate("Invalid tenant identifier");
    }

    @Test
    @DisplayName("Should handle null tenant ID gracefully")
    void testNullTenantId() {
        boolean valid = validator.isValid(null, mockContext);

        assertTrue(valid);  // @NotNull handles null check
        verify(mockTenantService, never()).exists(any());
        verify(mockContext, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    @DisplayName("Should call TenantService.exists exactly once")
    void testServiceCallCount() {
        UUID tenantId = UUID.randomUUID();
        when(mockTenantService.exists(tenantId)).thenReturn(true);

        validator.isValid(tenantId, mockContext);

        verify(mockTenantService, times(1)).exists(tenantId);
    }

    @Test
    @DisplayName("Should NOT include tenant ID in error message (security)")
    void testErrorMessageDoesNotContainTenantId() {
        UUID tenantId = UUID.fromString("12345678-1234-1234-1234-123456789012");
        when(mockTenantService.exists(tenantId)).thenReturn(false);

        validator.isValid(tenantId, mockContext);

        // Security: Generic message should NOT contain tenant ID to prevent enumeration
        verify(mockContext).buildConstraintViolationWithTemplate("Invalid tenant identifier");
        verify(mockContext).buildConstraintViolationWithTemplate(
            argThat(msg -> !msg.contains(tenantId.toString()))
        );
    }
}
