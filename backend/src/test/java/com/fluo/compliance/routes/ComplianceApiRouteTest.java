package com.fluo.compliance.routes;

import com.fluo.compliance.dto.*;
import com.fluo.services.ComplianceService;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Unit tests for PRD-004 Compliance Dashboard API Route.
 *
 * <p>ADR-013 Compliance: Testing thin HTTP adapter layer only.
 *
 * <p>Test Coverage:
 * - HTTP parameter extraction and validation
 * - Service layer delegation (mocking ComplianceService)
 * - Response wrapping and status codes
 * - Error handling (invalid/missing tenantId)
 *
 * <p>Note: Business logic (control status, aggregation, sparklines) is tested in ComplianceServiceTest.
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
        ComplianceSummaryDTO mockSummary = createMockSummary(8, 5, 13);

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.empty()),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

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
        ComplianceSummaryDTO mockSummary = createMockSummary(8, 0, 8);

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("soc2")),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

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
        ComplianceSummaryDTO mockSummary = createMockSummary(0, 5, 5);

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("hipaa")),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

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
        ControlSummaryDTO activeControl = new ControlSummaryDTO(
            "cc6_1",
            "Logical Access Controls",
            "soc2",
            300L,
            now,
            ControlStatus.ACTIVE
        );
        ComplianceSummaryDTO mockSummary = createMockSummaryWithControls(List.of(activeControl));

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("soc2")),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

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
        ControlSummaryDTO partialControl = new ControlSummaryDTO(
            "cc6_1",
            "Logical Access Controls",
            "soc2",
            50L,
            now,
            ControlStatus.PARTIAL
        );
        ComplianceSummaryDTO mockSummary = createMockSummaryWithControls(List.of(partialControl));

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("soc2")),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

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
        ControlSummaryDTO noEvidenceControl = new ControlSummaryDTO(
            "cc6_1",
            "Logical Access Controls",
            "soc2",
            0L,
            null,
            ControlStatus.NO_EVIDENCE
        );
        ComplianceSummaryDTO mockSummary = createMockSummaryWithControls(List.of(noEvidenceControl));

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("soc2")),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

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
        List<Integer> trendData = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24);
        ControlSummaryDTO controlWithTrend = new ControlSummaryDTO(
            "cc6_1",
            "Logical Access Controls",
            "soc2",
            100L,
            now,
            ControlStatus.ACTIVE,
            trendData
        );
        ComplianceSummaryDTO mockSummary = createMockSummaryWithControls(List.of(controlWithTrend));

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.empty()),
            eq(24),
            eq(true)
        )).thenReturn(mockSummary);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("includeTrends", "true")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls[0].trendData", notNullValue())
            .body("controls[0].trendData", hasSize(24));
    }

    @Test
    void testGetComplianceSummary_WithoutTrendData() {
        ControlSummaryDTO controlWithoutTrend = new ControlSummaryDTO(
            "cc6_1",
            "Logical Access Controls",
            "soc2",
            100L,
            now,
            ControlStatus.ACTIVE,
            null  // No trend data
        );
        ComplianceSummaryDTO mockSummary = createMockSummaryWithControls(List.of(controlWithoutTrend));

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.empty()),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

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
        List<Integer> trend48h = new ArrayList<>();
        for (int i = 0; i < 48; i++) {
            trend48h.add(i);
        }
        ControlSummaryDTO control48h = new ControlSummaryDTO(
            "cc6_1",
            "Logical Access Controls",
            "soc2",
            200L,
            now,
            ControlStatus.ACTIVE,
            trend48h
        );
        ComplianceSummaryDTO mockSummary = createMockSummaryWithControls(List.of(control48h));

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.empty()),
            eq(48),
            eq(true)
        )).thenReturn(mockSummary);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("hours", "48")
            .queryParam("includeTrends", "true")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("controls[0].trendData", hasSize(48));
    }

    @Test
    void testGetComplianceSummary_MissingTenantId() {
        given()
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(400);
    }

    @Test
    void testGetComplianceSummary_InvalidTenantId() {
        given()
            .queryParam("tenantId", "not-a-uuid")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(500);  // IllegalArgumentException from UUID.fromString
    }

    @Test
    void testFrameworkSummary_CoverageCalculation() {
        ComplianceSummaryDTO mockSummary = new ComplianceSummaryDTO(
            new FrameworkSummaryDTO(3, 8),  // 3/8 SOC2 controls = 37.5%
            new FrameworkSummaryDTO(0, 5),
            List.of()
        );

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("soc2")),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

        given()
            .queryParam("tenantId", tenantId.toString())
            .queryParam("framework", "soc2")
            .when()
            .get("/api/v1/compliance/summary")
            .then()
            .statusCode(200)
            .body("soc2.covered", equalTo(3))
            .body("soc2.total", equalTo(8))
            .body("soc2.score", closeTo(37.5, 0.1));
    }

    @Test
    void testControlSummary_LastEvidenceTimestamp() {
        Instant expectedTime = now.minusSeconds(3600 * 5);
        ControlSummaryDTO control = new ControlSummaryDTO(
            "cc6_1",
            "Logical Access Controls",
            "soc2",
            3L,
            expectedTime,
            ControlStatus.PARTIAL
        );
        ComplianceSummaryDTO mockSummary = createMockSummaryWithControls(List.of(control));

        when(complianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("soc2")),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

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

    private ComplianceSummaryDTO createMockSummary(int soc2Total, int hipaaTotal, int controlCount) {
        List<ControlSummaryDTO> controls = new ArrayList<>();

        // Add SOC2 controls
        for (int i = 0; i < soc2Total && controls.size() < controlCount; i++) {
            controls.add(new ControlSummaryDTO(
                "cc6_" + (i + 1),
                "Control " + (i + 1),
                "soc2",
                10L,
                now,
                ControlStatus.ACTIVE
            ));
        }

        // Add HIPAA controls
        for (int i = 0; i < hipaaTotal && controls.size() < controlCount; i++) {
            controls.add(new ControlSummaryDTO(
                "164.312(a)." + i,
                "HIPAA Control " + i,
                "hipaa",
                5L,
                now,
                ControlStatus.PARTIAL
            ));
        }

        return new ComplianceSummaryDTO(
            new FrameworkSummaryDTO(soc2Total, soc2Total),
            new FrameworkSummaryDTO(hipaaTotal, hipaaTotal),
            controls
        );
    }

    private ComplianceSummaryDTO createMockSummaryWithControls(List<ControlSummaryDTO> controls) {
        long soc2Count = controls.stream().filter(c -> "soc2".equals(c.framework())).count();
        long hipaaCount = controls.stream().filter(c -> "hipaa".equals(c.framework())).count();

        return new ComplianceSummaryDTO(
            new FrameworkSummaryDTO((int)soc2Count, 8),
            new FrameworkSummaryDTO((int)hipaaCount, 5),
            controls
        );
    }
}
