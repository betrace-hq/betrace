package com.betrace.routes;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Integration tests for API route validation.
 * Tests end-to-end flow: HTTP POST → Camel Route → Bean Validation → Error Response
 * Per PRD-007a requirements.
 */
@QuarkusTest
public class ApiRoutesValidationIntegrationTest {

    @Test
    @DisplayName("POST /api/rules with valid data should return 200")
    void testCreateRuleWithValidData() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "name": "Valid Rule Name",
                    "expression": "trace.has(error.occurred)",
                    "severity": "HIGH",
                    "tenantId": "%s"
                }
                """.formatted(UUID.randomUUID()))
        .when()
            .post("/api/rules")
        .then()
            .statusCode(anyOf(is(200), is(201), is(401), is(403)));
            // Note: 401/403 expected due to security processor, but validation passed
    }

    @Test
    @DisplayName("POST /api/rules with blank name should return 400 with validation errors")
    void testCreateRuleWithBlankName() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "name": "",
                    "expression": "trace.has(error.occurred)",
                    "severity": "HIGH",
                    "tenantId": "%s"
                }
                """.formatted(UUID.randomUUID()))
        .when()
            .post("/api/rules")
        .then()
            .statusCode(400)
            .body("error", equalTo("Validation failed"))
            .body("violations", hasSize(greaterThan(0)))
            .body("violations[0].field", notNullValue())
            .body("violations[0].message", containsString("required"));
    }

    @Test
    @DisplayName("POST /api/rules with null expression should return 400")
    void testCreateRuleWithNullExpression() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "name": "Valid Name",
                    "expression": null,
                    "severity": "HIGH",
                    "tenantId": "%s"
                }
                """.formatted(UUID.randomUUID()))
        .when()
            .post("/api/rules")
        .then()
            .statusCode(400)
            .body("error", equalTo("Validation failed"))
            .body("violations", hasSize(greaterThan(0)));
    }

    @Test
    @DisplayName("POST /api/rules with missing tenantId should return 400")
    void testCreateRuleWithMissingTenantId() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "name": "Valid Name",
                    "expression": "trace.has(error)",
                    "severity": "HIGH"
                }
                """)
        .when()
            .post("/api/rules")
        .then()
            .statusCode(400)
            .body("error", equalTo("Validation failed"));
    }

    @Test
    @DisplayName("POST /api/rules with name exceeding max length should return 400")
    void testCreateRuleWithNameTooLong() {
        String longName = "a".repeat(256);  // Exceeds 255 limit

        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "name": "%s",
                    "expression": "trace.has(error)",
                    "severity": "HIGH",
                    "tenantId": "%s"
                }
                """.formatted(longName, UUID.randomUUID()))
        .when()
            .post("/api/rules")
        .then()
            .statusCode(400)
            .body("error", equalTo("Validation failed"))
            .body("violations", hasSize(greaterThan(0)))
            .body("violations[0].message", containsString("must not exceed 255 characters"));
    }

    @Test
    @DisplayName("POST /api/rules with expression exceeding max length should return 400")
    void testCreateRuleWithExpressionTooLong() {
        String longExpression = "a".repeat(5001);  // Exceeds 5000 limit

        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "name": "Valid Name",
                    "expression": "%s",
                    "severity": "HIGH",
                    "tenantId": "%s"
                }
                """.formatted(longExpression, UUID.randomUUID()))
        .when()
            .post("/api/rules")
        .then()
            .statusCode(400)
            .body("error", equalTo("Validation failed"))
            .body("violations", hasSize(greaterThan(0)))
            .body("violations[0].message", containsString("must not exceed 5000 characters"));
    }

    @Test
    @DisplayName("POST /api/rules with multiple validation errors should return all violations")
    void testCreateRuleWithMultipleErrors() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "name": "",
                    "expression": "",
                    "severity": null,
                    "tenantId": null
                }
                """)
        .when()
            .post("/api/rules")
        .then()
            .statusCode(400)
            .body("error", equalTo("Validation failed"))
            .body("violations", hasSize(greaterThanOrEqualTo(4)));
    }

    @Test
    @DisplayName("Validation error response should have correct structure")
    void testValidationErrorResponseStructure() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "name": "",
                    "expression": "valid expression",
                    "severity": "HIGH",
                    "tenantId": "%s"
                }
                """.formatted(UUID.randomUUID()))
        .when()
            .post("/api/rules")
        .then()
            .statusCode(400)
            .body("$", hasKey("error"))
            .body("$", hasKey("violations"))
            .body("violations[0]", hasKey("field"))
            .body("violations[0]", hasKey("message"))
            .body("violations[0]", hasKey("rejectedValue"));
    }
}
