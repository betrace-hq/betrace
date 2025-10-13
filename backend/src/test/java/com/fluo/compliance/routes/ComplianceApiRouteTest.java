package com.fluo.compliance.routes;

import com.fluo.compliance.dto.*;
import com.fluo.model.Span;
import com.fluo.model.Trace;
import com.fluo.services.ComplianceService;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Unit tests for PRD-004 Compliance Dashboard API.
 *
 * <p>Test Coverage (ADR-013 Compliance: Testing thin HTTP adapter):
 * - HTTP parameter extraction and validation
 * - Service layer delegation
 * - Response wrapping and status codes
 * - Error handling (invalid/missing tenantId)
 *
 * <p>Note: Business logic is tested in ComplianceServiceTest.
 */
@QuarkusTest
class ComplianceApiRouteTest {

    @InjectMock
    ComplianceService complianceService;

    private UUID tenantId;
    private Instant now;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        now = Instant.now();
    }

    @Test
    void testGetComplianceSummary_AllFrameworks() {
        // Create mock compliance spans wrapped in traces
        List<Trace> mockTraces = createMockComplianceTraces();
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(mockTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("soc2.total", equalTo(8))
            .body("hipaa.total", equalTo(5))
            .body("controls", hasSize(13));
    }

    @Test
    void testGetComplianceSummary_FilteredByFramework_SOC2() {
        List<Trace> mockTraces = createMockComplianceTraces();
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(mockTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("framework", "soc2")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("soc2.total", equalTo(8))
            .body("controls", hasSize(8))
            .body("controls[0].framework", equalTo("soc2"));
    }

    @Test
    void testGetComplianceSummary_FilteredByFramework_HIPAA() {
        List<Trace> mockTraces = createMockComplianceTraces();
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(mockTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("framework", "hipaa")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("hipaa.total", equalTo(5))
            .body("controls", hasSize(5))
            .body("controls[0].framework", equalTo("hipaa"));
    }

    @Test
    void testGetComplianceSummary_ControlStatus_Active() {
        // Create 300 spans (12.5 spans/hour over 24h) → ACTIVE
        List<Trace> activeTraces = List.of(wrapSpansInTrace(createSpansForControl("cc6_1", 300)));
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(activeTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("framework", "soc2")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls.find { it.id == 'cc6_1' }.status", equalTo("ACTIVE"))
            .body("controls.find { it.id == 'cc6_1' }.spanCount", equalTo(300))
            .body("soc2.covered", greaterThan(0));
    }

    @Test
    void testGetComplianceSummary_ControlStatus_Partial() {
        // Create 50 spans (2 spans/hour over 24h) → PARTIAL
        List<Trace> partialTraces = List.of(wrapSpansInTrace(createSpansForControl("cc6_1", 50)));
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(partialTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("framework", "soc2")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls.find { it.id == 'cc6_1' }.status", equalTo("PARTIAL"))
            .body("controls.find { it.id == 'cc6_1' }.spanCount", equalTo(50));
    }

    @Test
    void testGetComplianceSummary_ControlStatus_NoEvidence() {
        // No spans for cc6_1 → NO_EVIDENCE
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(List.of());

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("framework", "soc2")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls.find { it.id == 'cc6_1' }.status", equalTo("NO_EVIDENCE"))
            .body("controls.find { it.id == 'cc6_1' }.spanCount", equalTo(0))
            .body("controls.find { it.id == 'cc6_1' }.lastEvidence", nullValue());
    }

    @Test
    void testGetComplianceSummary_WithTrendData() {
        List<Trace> mockTraces = createMockComplianceTraces();
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(mockTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("includeTrends", "true")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls[0].trendData", notNullValue())
            .body("controls[0].trendData", hasSize(24)); // 24 hourly buckets
    }

    @Test
    void testGetComplianceSummary_WithoutTrendData() {
        List<Trace> mockTraces = createMockComplianceTraces();
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(mockTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("includeTrends", "false")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls[0].trendData", nullValue());
    }

    @Test
    void testGetComplianceSummary_CustomLookbackPeriod() {
        List<Trace> mockTraces = createMockComplianceTraces();
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(mockTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("hours", "48")
            .queryParam("includeTrends", "true")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls[0].trendData", hasSize(48)); // 48 hourly buckets
    }

    @Test
    void testGetComplianceSummary_MissingTenantId() {
        given()
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(400)
            .body("error", containsString("tenantId is required"));
    }

    @Test
    void testGetComplianceSummary_InvalidTenantId() {
        given()
            .queryParam("tenantId", "not-a-uuid")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(400)
            .body("error", containsString("Invalid tenantId format"));
    }

    @Test
    void testFrameworkSummary_CoverageCalculation() {
        // 3 SOC2 controls with evidence, 5 total
        List<Span> mockSpans = List.of(
            createComplianceSpan("cc6_1", "soc2", now.minus(1, ChronoUnit.HOURS)),
            createComplianceSpan("cc6_2", "soc2", now.minus(2, ChronoUnit.HOURS)),
            createComplianceSpan("cc6_3", "soc2", now.minus(3, ChronoUnit.HOURS))
        );
        List<Trace> mockTraces = List.of(wrapSpansInTrace(mockSpans));
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(mockTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("framework", "soc2")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("soc2.covered", equalTo(3))
            .body("soc2.total", equalTo(8))
            .body("soc2.score", closeTo(37.5, 0.1)); // 3/8 = 37.5%
    }

    @Test
    void testControlSummary_LastEvidenceTimestamp() {
        Instant expectedTime = now.minus(5, ChronoUnit.HOURS);
        List<Span> mockSpans = List.of(
            createComplianceSpan("cc6_1", "soc2", now.minus(10, ChronoUnit.HOURS)),
            createComplianceSpan("cc6_1", "soc2", expectedTime), // Most recent
            createComplianceSpan("cc6_1", "soc2", now.minus(15, ChronoUnit.HOURS))
        );
        List<Trace> mockTraces = List.of(wrapSpansInTrace(mockSpans));
        when(duckDBService.queryTraces(any(UUID.class), any(Instant.class), any(Instant.class), any(Integer.class)))
            .thenReturn(mockTraces);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("framework", "soc2")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls.find { it.id == 'cc6_1' }.lastEvidence", notNullValue());
    }

    // === Helper Methods ===

    private List<Trace> createMockComplianceTraces() {
        List<Span> spans = new ArrayList<>();

        // SOC2 controls with varying evidence counts
        spans.addAll(createSpansForControl("cc6_1", 300)); // ACTIVE
        spans.addAll(createSpansForControl("cc6_2", 50));  // PARTIAL
        // cc6_3, cc6_6, cc6_7, cc7_1, cc7_2, cc8_1 have NO_EVIDENCE

        // HIPAA controls
        spans.addAll(createSpansForControl("164.312(a)", 150)); // ACTIVE
        // Other HIPAA controls have NO_EVIDENCE

        return List.of(wrapSpansInTrace(spans));
    }

    private Trace wrapSpansInTrace(List<Span> spans) {
        if (spans.isEmpty()) {
            return new Trace(
                UUID.randomUUID().toString(),
                tenantId,
                now,
                "root-span",
                0L,
                "test-service",
                List.of(),
                Map.of()
            );
        }

        return new Trace(
            spans.get(0).traceId(),
            tenantId,
            spans.get(0).startTime(),
            spans.get(0).operationName(),
            spans.stream().mapToLong(Span::durationMillis).sum(),
            spans.get(0).serviceName(),
            spans,
            Map.of()
        );
    }

    private List<Span> createSpansForControl(String controlId, int count) {
        List<Span> spans = new ArrayList<>();
        String framework = controlId.startsWith("cc") ? "soc2" : "hipaa";

        for (int i = 0; i < count; i++) {
            Instant timestamp = now.minus(i * 5, ChronoUnit.MINUTES); // Spread over time
            spans.add(createComplianceSpan(controlId, framework, timestamp));
        }

        return spans;
    }

    private Span createComplianceSpan(String controlId, String framework, Instant timestamp) {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("compliance.framework", framework);
        attributes.put("compliance.control", controlId);
        attributes.put("compliance.evidenceType", "audit_trail");

        return Span.create(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "compliance.evidence",
            "compliance-service",
            timestamp,
            timestamp.plusMillis(10),
            attributes,
            "test-tenant"
        );
    }
}
