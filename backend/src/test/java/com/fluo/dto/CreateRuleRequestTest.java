package com.fluo.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TDD tests for CreateRuleRequest validation.
 * Tests written BEFORE implementation per ADR-015.
 */
public class CreateRuleRequestTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @Test
    @DisplayName("Should accept valid rule creation request")
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
    void testValidRuleRequest() {
        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Rule Name",
            "trace.has(error.occurred)",
            "HIGH",
            UUID.randomUUID()
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertEquals(0, violations.size(), "Valid request should have no violations");
    }

    @Test
    @DisplayName("Should reject rule creation with blank name")
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
    void testBlankRuleName() {
        CreateRuleRequest request = new CreateRuleRequest(
            "",  // blank name
            "trace.has(error)",
            "HIGH",
            UUID.randomUUID()
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertEquals(1, violations.size());
        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("Rule name is required")));
    }

    @Test
    @DisplayName("Should reject rule creation with null name")
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
    void testNullRuleName() {
        CreateRuleRequest request = new CreateRuleRequest(
            null,  // null name
            "trace.has(error)",
            "HIGH",
            UUID.randomUUID()
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.size() > 0);
        assertTrue(violations.stream()
            .anyMatch(v -> v.getPropertyPath().toString().equals("name")));
    }

    @Test
    @DisplayName("Should reject rule with name exceeding max length")
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
    void testRuleNameTooLong() {
        String longName = "a".repeat(256);  // Exceeds 255 limit

        CreateRuleRequest request = new CreateRuleRequest(
            longName,
            "trace.has(error)",
            "HIGH",
            UUID.randomUUID()
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("must not exceed 255 characters")));
    }

    @Test
    @DisplayName("Should reject rule creation with blank expression")
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
    void testBlankExpression() {
        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Name",
            "",  // blank expression
            "HIGH",
            UUID.randomUUID()
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("Rule expression is required")));
    }

    @Test
    @DisplayName("Should reject rule with expression exceeding max length")
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
    void testExpressionTooLong() {
        String longExpression = "a".repeat(5001);  // Exceeds 5000 limit

        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Name",
            longExpression,
            "HIGH",
            UUID.randomUUID()
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("must not exceed 5000 characters")));
    }

    @Test
    @DisplayName("Should reject rule creation with null severity")
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
    void testNullSeverity() {
        CreateRuleRequest request = new CreateRuleRequest(
            "Valid Name",
            "trace.has(error)",
            null,  // null severity
            UUID.randomUUID()
        );

        Set<ConstraintViolation<CreateRuleRequest>> violations = validator.validate(request);

        assertTrue(violations.stream()
            .anyMatch(v -> v.getMessage().contains("Severity is required")));
    }

    @Test
    @DisplayName("Should reject rule creation with null tenant ID")
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
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
    @org.junit.jupiter.api.Disabled("Custom validators require CDI context - tested in ApiRoutesValidationIntegrationTest")
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
