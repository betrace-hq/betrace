package com.fluo.dto;

import com.fluo.model.Tenant;
import com.fluo.services.TenantService;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TDD tests for CreateRuleRequest validation.
 * Tests written BEFORE implementation per ADR-015.
 *
 * Note: Uses @QuarkusTest to provide CDI context for custom validators
 * (FluoDslValidator and TenantExistsValidator require injection).
 */
@QuarkusTest
public class CreateRuleRequestTest {

    @Inject
    Validator validator;

    @Inject
    TenantService tenantService;

    private static final UUID TEST_TENANT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @BeforeEach
    void setUp() {
        // Create test tenant for validation
        Tenant testTenant = new Tenant();
        testTenant.setId(TEST_TENANT_ID.toString());
        testTenant.setName("Test Tenant");
        testTenant.setStatus(Tenant.TenantStatus.ACTIVE);
        testTenant.setConfiguration(new HashMap<>());

        try {
            tenantService.createTenant(testTenant, "test-admin");
        } catch (IllegalArgumentException e) {
            // Tenant already exists - that's fine
        }
    }

    @Test
    @DisplayName("Should accept valid rule creation request")
    void testValidRuleRequest() {
        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Rule Name",
            "trace.has(error.occurred)",
            "HIGH",
            TEST_TENANT_ID
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertEquals(0, violations.size(), "Valid request should have no violations");
    }

    @Test
    @DisplayName("Should reject rule creation with blank name")
    void testBlankRuleName() {
        CreateRuleRequest request = new CreateRuleRequest(
            "",  // blank name
            "trace.has(error)",
            "HIGH",
            TEST_TENANT_ID
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertEquals(1, violations.size());
        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("Rule name is required")));
    }

    @Test
    @DisplayName("Should reject rule creation with null name")
    void testNullRuleName() {
        CreateRuleRequest request = new CreateRuleRequest(
            null,  // null name
            "trace.has(error)",
            "HIGH",
            TEST_TENANT_ID
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.size() > 0);
        assertTrue(violations.stream()
            .anyMatch(v -> v.getPropertyPath().toString().equals("name")));
    }

    @Test
    @DisplayName("Should reject rule with name exceeding max length")
    void testRuleNameTooLong() {
        String longName = "a".repeat(256);  // Exceeds 255 limit

        CreateRuleRequest request = new CreateRuleRequest(
            longName,
            "trace.has(error)",
            "HIGH",
            TEST_TENANT_ID
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("must not exceed 255 characters")));
    }

    @Test
    @DisplayName("Should reject rule creation with blank expression")
    void testBlankExpression() {
        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Name",
            "",  // blank expression
            "HIGH",
            TEST_TENANT_ID
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("Rule expression is required")));
    }

    @Test
    @DisplayName("Should reject rule with expression exceeding max length")
    void testExpressionTooLong() {
        String longExpression = "a".repeat(5001);  // Exceeds 5000 limit

        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Name",
            longExpression,
            "HIGH",
            TEST_TENANT_ID
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("must not exceed 5000 characters")));
    }

    @Test
    @DisplayName("Should reject rule creation with null severity")
    void testNullSeverity() {
        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Name",
            "trace.has(error)",
            null,  // null severity
            TEST_TENANT_ID
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("Severity is required")));
    }

    @Test
    @DisplayName("Should reject rule creation with null tenant ID")
    void testNullTenantId() {
        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Name",
            "trace.has(error)",
            "HIGH",
            null  // null tenantId
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("Tenant ID is required")));
    }

    @Test
    @DisplayName("Should validate all fields with multiple violations")
    void testMultipleViolations() {
        CreateRuleRequest request = new CreateRuleRequest(
            "",  // blank name
            "",  // blank expression
            null,  // null severity
            null  // null tenantId
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.size() >= 4,
            "Should have at least 4 violations: " + violations.size());
    }
}
