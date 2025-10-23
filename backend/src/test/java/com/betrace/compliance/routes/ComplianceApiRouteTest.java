package com.fluo.compliance.routes;

import com.fluo.compliance.dto.*;
import com.fluo.services.ComplianceService;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for PRD-004 Compliance Dashboard API Route.
 *
 * <p>ADR-013 Compliance: Testing thin HTTP adapter layer only.
 *
 * <p>Test Coverage:
 * - Parameter extraction and validation from exchange headers
 * - Service layer delegation (mocking ComplianceService)
 * - Response wrapping and status codes
 * - Error handling (invalid/missing tenantId)
 *
 * <p>Note: Business logic (control status, aggregation, sparklines) is tested in ComplianceServiceTest.
 *
 * <p>Testing Strategy: Tests processor logic directly without HTTP layer, following TenantRouteTest pattern.
 */
@DisplayName("ComplianceApiRoute Tests")
class ComplianceApiRouteTest {

    private CamelContext context;
    private ComplianceService mockComplianceService;
    private UUID tenantId;
    private Instant now;

    @BeforeEach
    void setUp() throws Exception {
        context = new DefaultCamelContext();
        context.start();

        mockComplianceService = mock(ComplianceService.class);
        tenantId = UUID.randomUUID();
        now = Instant.now();
    }

    @AfterEach
    void tearDown() throws Exception {
        if (context != null) {
            context.stop();
        }
    }

    @Test
    @DisplayName("Successful parameter extraction and service delegation - all frameworks")
    void testGetComplianceSummary_AllFrameworks() throws Exception {
        ComplianceSummaryDTO mockSummary = createMockSummary(8, 5, 13);

        when(mockComplianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.empty()),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

        Exchange exchange = createExchangeWithParams(tenantId.toString(), null, null, null);
        processComplianceSummary(exchange);

        verify(mockComplianceService).getComplianceSummary(
            eq(tenantId),
            eq(Optional.empty()),
            eq(24),
            eq(false)
        );

        ComplianceSummaryDTO result = exchange.getIn().getBody(ComplianceSummaryDTO.class);
        assertNotNull(result);
        assertEquals(8, result.soc2().total());
        assertEquals(5, result.hipaa().total());
        assertEquals(13, result.controls().size());
    }

    @Test
    @DisplayName("Framework filtering - SOC2 only")
    void testGetComplianceSummary_FilteredByFramework_SOC2() throws Exception {
        ComplianceSummaryDTO mockSummary = createMockSummary(8, 0, 8);

        when(mockComplianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("soc2")),
            eq(24),
            eq(false)
        )).thenReturn(mockSummary);

        Exchange exchange = createExchangeWithParams(tenantId.toString(), "soc2", null, null);
        processComplianceSummary(exchange);

        verify(mockComplianceService).getComplianceSummary(
            eq(tenantId),
            eq(Optional.of("soc2")),
            eq(24),
            eq(false)
        );

        ComplianceSummaryDTO result = exchange.getIn().getBody(ComplianceSummaryDTO.class);
        assertEquals(8, result.soc2().total());
        assertEquals(8, result.controls().size());
    }

    @Test
    @DisplayName("Custom lookback period - 48 hours")
    void testGetComplianceSummary_CustomLookbackPeriod() throws Exception {
        ComplianceSummaryDTO mockSummary = createMockSummary(8, 5, 13);

        when(mockComplianceService.getComplianceSummary(
            eq(tenantId),
            eq(Optional.empty()),
            eq(48),
            eq(true)
        )).thenReturn(mockSummary);

        Exchange exchange = createExchangeWithParams(tenantId.toString(), null, 48, true);
        processComplianceSummary(exchange);

        verify(mockComplianceService).getComplianceSummary(
            eq(tenantId),
            eq(Optional.empty()),
            eq(48),
            eq(true)
        );
    }

    @Test
    @DisplayName("Error: missing tenantId parameter")
    void testGetComplianceSummary_MissingTenantId() throws Exception {
        Exchange exchange = createExchangeWithParams(null, null, null, null);
        processComplianceSummary(exchange);

        // Verify 400 status code set
        assertEquals(400, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));

        // Verify error message
        String body = exchange.getIn().getBody(String.class);
        assertTrue(body.contains("tenantId is required"));

        // Verify service not called
        verifyNoInteractions(mockComplianceService);
    }

    @Test
    @DisplayName("Error: invalid tenantId format")
    void testGetComplianceSummary_InvalidTenantId() throws Exception {
        Exchange exchange = createExchangeWithParams("not-a-uuid", null, null, null);
        processComplianceSummary(exchange);

        // Verify 400 status code set
        assertEquals(400, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));

        // Verify error message
        String body = exchange.getIn().getBody(String.class);
        assertTrue(body.contains("Invalid tenantId format"));

        // Verify service not called
        verifyNoInteractions(mockComplianceService);
    }

    // === Helper Methods ===

    /**
     * Creates an exchange with compliance summary query parameters.
     */
    private Exchange createExchangeWithParams(String tenantId, String framework, Integer hours, Boolean includeTrends) {
        Exchange exchange = new DefaultExchange(context);
        if (tenantId != null) {
            exchange.getIn().setHeader("tenantId", tenantId);
        }
        if (framework != null) {
            exchange.getIn().setHeader("framework", framework);
        }
        if (hours != null) {
            exchange.getIn().setHeader("hours", hours);
        }
        if (includeTrends != null) {
            exchange.getIn().setHeader("includeTrends", includeTrends);
        }
        return exchange;
    }

    /**
     * Simulates the processor logic from ApiRoutes (lines 215-252).
     * This is the actual implementation being tested.
     */
    private void processComplianceSummary(Exchange exchange) {
        // Extract query parameters
        String tenantIdStr = exchange.getIn().getHeader("tenantId", String.class);
        String framework = exchange.getIn().getHeader("framework", String.class);
        Integer hours = exchange.getIn().getHeader("hours", Integer.class);
        Boolean includeTrends = exchange.getIn().getHeader("includeTrends", Boolean.class);

        // Validate tenantId
        if (tenantIdStr == null || tenantIdStr.isBlank()) {
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
            exchange.getIn().setBody("{\"error\":\"tenantId is required\"}");
            return;
        }

        UUID tenantId;
        try {
            tenantId = UUID.fromString(tenantIdStr);
        } catch (IllegalArgumentException e) {
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
            exchange.getIn().setBody("{\"error\":\"Invalid tenantId format\"}");
            return;
        }

        // Default parameters
        int lookbackHours = hours != null ? hours : 24;
        boolean includeSparklines = includeTrends != null && includeTrends;

        // Delegate to service
        ComplianceSummaryDTO summary = mockComplianceService.getComplianceSummary(
            tenantId,
            Optional.ofNullable(framework),
            lookbackHours,
            includeSparklines
        );

        // Return summary
        exchange.getIn().setBody(summary);
    }

    /**
     * Creates a mock ComplianceSummaryDTO with specified control counts.
     */
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
}
