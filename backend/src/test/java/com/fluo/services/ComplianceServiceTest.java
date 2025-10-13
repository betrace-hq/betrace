package com.fluo.services;

import com.fluo.compliance.dto.*;
import com.fluo.model.Span;
import com.fluo.model.Trace;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Unit tests for PRD-004 Compliance Dashboard Service.
 *
 * <p>ADR-013 Compliance: Testing business logic layer.
 *
 * <p>Test Coverage:
 * - Control status determination (ACTIVE ≥10 spans/hr, PARTIAL 1-9, NO_EVIDENCE 0)
 * - Framework aggregation (SOC2: 8 controls, HIPAA: 5 controls)
 * - Sparkline generation (24 hourly buckets)
 * - Edge cases (no data, partial data, invalid lookback periods)
 * - Framework filtering (all, SOC2-only, HIPAA-only)
 */
@QuarkusTest
class ComplianceServiceTest {

    @Inject
    ComplianceService complianceService;

    @InjectMock
    DuckDBService duckDBService;

    private UUID tenantId;
    private Instant now;

    @BeforeEach
    void setUp() {
        tenantId = UUID.randomUUID();
        now = Instant.now();
    }

    @Test
    void testControlStatus_Active() {
        // 300 spans over 24h = 12.5 spans/hour → ACTIVE (≥10 spans/hr)
        List<Trace> traces = createTracesWithSpans("cc6_1", "soc2", 300, 24);
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, false
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertNotNull(cc61, "cc6_1 control should exist");
        assertEquals(ControlStatus.ACTIVE, cc61.status(), "Should be ACTIVE (≥10 spans/hr)");
        assertEquals(300L, cc61.spanCount(), "Should have 300 spans");
        assertNotNull(cc61.lastEvidence(), "Should have lastEvidence timestamp");
    }

    @Test
    void testControlStatus_Partial() {
        // 50 spans over 24h = 2.08 spans/hour → PARTIAL (1-9 spans/hr)
        List<Trace> traces = createTracesWithSpans("cc6_1", "soc2", 50, 24);
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, false
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertEquals(ControlStatus.PARTIAL, cc61.status(), "Should be PARTIAL (1-9 spans/hr)");
        assertEquals(50L, cc61.spanCount(), "Should have 50 spans");
    }

    @Test
    void testControlStatus_NoEvidence() {
        // 0 spans → NO_EVIDENCE
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(List.of());

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, false
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertEquals(ControlStatus.NO_EVIDENCE, cc61.status(), "Should be NO_EVIDENCE (0 spans)");
        assertEquals(0L, cc61.spanCount(), "Should have 0 spans");
        assertNull(cc61.lastEvidence(), "Should have no lastEvidence");
    }

    @Test
    void testControlStatus_ThresholdBoundary_ExactlyTen() {
        // 240 spans over 24h = exactly 10 spans/hour → ACTIVE
        List<Trace> traces = createTracesWithSpans("cc6_1", "soc2", 240, 24);
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, false
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertEquals(ControlStatus.ACTIVE, cc61.status(), "Should be ACTIVE at exactly 10 spans/hr");
    }

    @Test
    void testControlStatus_ThresholdBoundary_JustBelowTen() {
        // 239 spans over 24h = 9.96 spans/hour → PARTIAL
        List<Trace> traces = createTracesWithSpans("cc6_1", "soc2", 239, 24);
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, false
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertEquals(ControlStatus.PARTIAL, cc61.status(), "Should be PARTIAL just below 10 spans/hr");
    }

    @Test
    void testFrameworkSummary_AllFrameworks() {
        List<Trace> traces = createMixedFrameworkTraces();
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.empty(), 24, false
        );

        // SOC2: 8 total controls, 2 with evidence (cc6_1, cc6_2)
        assertEquals(8, summary.soc2().total(), "SOC2 should have 8 total controls");
        assertEquals(2, summary.soc2().covered(), "SOC2 should have 2 covered controls");
        assertEquals(25.0, summary.soc2().score(), 0.1, "SOC2 coverage: 2/8 = 25%");

        // HIPAA: 5 total controls, 1 with evidence (164.312(a))
        assertEquals(5, summary.hipaa().total(), "HIPAA should have 5 total controls");
        assertEquals(1, summary.hipaa().covered(), "HIPAA should have 1 covered control");
        assertEquals(20.0, summary.hipaa().score(), 0.1, "HIPAA coverage: 1/5 = 20%");

        // All controls from both frameworks
        assertEquals(13, summary.controls().size(), "Should have 13 total controls");
    }

    @Test
    void testFrameworkSummary_FilteredSOC2() {
        List<Trace> traces = createMixedFrameworkTraces();
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, false
        );

        assertEquals(8, summary.controls().size(), "Should have only 8 SOC2 controls");
        assertTrue(summary.controls().stream().allMatch(c -> "soc2".equals(c.framework())),
            "All controls should be SOC2");
    }

    @Test
    void testFrameworkSummary_FilteredHIPAA() {
        List<Trace> traces = createMixedFrameworkTraces();
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("hipaa"), 24, false
        );

        assertEquals(5, summary.controls().size(), "Should have only 5 HIPAA controls");
        assertTrue(summary.controls().stream().allMatch(c -> "hipaa".equals(c.framework())),
            "All controls should be HIPAA");
    }

    @Test
    void testSparklineGeneration_24Hours() {
        // Create spans distributed across 24 hours
        List<Trace> traces = createTracesWithSpans("cc6_1", "soc2", 240, 24);
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, true
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertNotNull(cc61.trendData(), "Should have trend data when includeTrends=true");
        assertEquals(24, cc61.trendData().size(), "Should have 24 hourly buckets");
        assertTrue(cc61.trendData().stream().allMatch(count -> count >= 0),
            "All bucket counts should be non-negative");
    }

    @Test
    void testSparklineGeneration_48Hours() {
        List<Trace> traces = createTracesWithSpans("cc6_1", "soc2", 480, 48);
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 48, true
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertEquals(48, cc61.trendData().size(), "Should have 48 hourly buckets");
    }

    @Test
    void testSparklineGeneration_Disabled() {
        List<Trace> traces = createTracesWithSpans("cc6_1", "soc2", 240, 24);
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, false
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertNull(cc61.trendData(), "Should not have trend data when includeTrends=false");
    }

    @Test
    void testLastEvidenceTimestamp() {
        Instant oldest = now.minus(10, ChronoUnit.HOURS);
        Instant middle = now.minus(5, ChronoUnit.HOURS);
        Instant newest = now.minus(1, ChronoUnit.HOURS);

        List<Span> spans = List.of(
            createComplianceSpan("cc6_1", "soc2", oldest),
            createComplianceSpan("cc6_1", "soc2", middle),
            createComplianceSpan("cc6_1", "soc2", newest)
        );
        List<Trace> traces = List.of(wrapSpansInTrace(spans));
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.of("soc2"), 24, false
        );

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertEquals(newest, cc61.lastEvidence(), "lastEvidence should be the most recent timestamp");
    }

    @Test
    void testMultipleControlsAggregation() {
        List<Span> spans = new ArrayList<>();
        spans.addAll(createSpansForControl("cc6_1", "soc2", 300, 24)); // ACTIVE
        spans.addAll(createSpansForControl("cc6_2", "soc2", 50, 24));  // PARTIAL
        spans.addAll(createSpansForControl("164.312(a)", "hipaa", 150, 24)); // ACTIVE

        List<Trace> traces = List.of(wrapSpansInTrace(spans));
        when(duckDBService.queryTraces(any(), any(), any(), anyInt())).thenReturn(traces);

        ComplianceSummaryDTO summary = complianceService.getComplianceSummary(
            tenantId, Optional.empty(), 24, false
        );

        assertEquals(13, summary.controls().size(), "Should have all 13 controls");

        ControlSummaryDTO cc61 = findControl(summary, "cc6_1");
        assertEquals(ControlStatus.ACTIVE, cc61.status());
        assertEquals(300L, cc61.spanCount());

        ControlSummaryDTO cc62 = findControl(summary, "cc6_2");
        assertEquals(ControlStatus.PARTIAL, cc62.status());
        assertEquals(50L, cc62.spanCount());

        ControlSummaryDTO hipaa = findControl(summary, "164.312(a)");
        assertEquals(ControlStatus.ACTIVE, hipaa.status());
        assertEquals(150L, hipaa.spanCount());
    }

    // === Helper Methods ===

    private ControlSummaryDTO findControl(ComplianceSummaryDTO summary, String controlId) {
        return summary.controls().stream()
            .filter(c -> c.id().equals(controlId))
            .findFirst()
            .orElse(null);
    }

    private List<Trace> createTracesWithSpans(String controlId, String framework, int spanCount, int hours) {
        List<Span> spans = createSpansForControl(controlId, framework, spanCount, hours);
        return List.of(wrapSpansInTrace(spans));
    }

    private List<Trace> createMixedFrameworkTraces() {
        List<Span> spans = new ArrayList<>();
        // SOC2 controls with evidence
        spans.addAll(createSpansForControl("cc6_1", "soc2", 300, 24)); // ACTIVE
        spans.addAll(createSpansForControl("cc6_2", "soc2", 50, 24));  // PARTIAL
        // HIPAA control with evidence
        spans.addAll(createSpansForControl("164.312(a)", "hipaa", 150, 24)); // ACTIVE

        return List.of(wrapSpansInTrace(spans));
    }

    private List<Span> createSpansForControl(String controlId, String framework, int count, int hours) {
        List<Span> spans = new ArrayList<>();
        long intervalMinutes = (hours * 60) / count; // Distribute spans evenly

        for (int i = 0; i < count; i++) {
            Instant timestamp = now.minus(i * intervalMinutes, ChronoUnit.MINUTES);
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
            tenantId.toString()
        );
    }

    private Trace wrapSpansInTrace(List<Span> spans) {
        if (spans.isEmpty()) {
            return new Trace(
                UUID.randomUUID().toString(),
                tenantId,
                now,
                "empty-trace",
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
}
