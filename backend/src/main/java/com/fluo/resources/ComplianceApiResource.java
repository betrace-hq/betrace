package com.fluo.resources;

import com.fluo.models.compliance.ComplianceSummary;
import com.fluo.models.compliance.ControlDetail;
import com.fluo.services.ComplianceSummaryService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

/**
 * PRD-004: Compliance Dashboard API
 *
 * REST endpoints for compliance dashboard frontend.
 *
 * Endpoints:
 * - GET /api/compliance/summary - Aggregate compliance posture
 * - GET /api/compliance/controls/{controlId} - Drill-down to control details
 * - GET /api/compliance/export - Export evidence (CSV/JSON)
 *
 * Security:
 * - Phase 1: No authentication (demo mode)
 * - Phase 2: Add @RolesAllowed("USER") for production
 */
@Path("/api/compliance")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ComplianceApiResource {

    private static final Logger LOG = Logger.getLogger(ComplianceApiResource.class);

    @Inject
    ComplianceSummaryService summaryService;

    /**
     * GET /api/compliance/summary
     *
     * Returns aggregate compliance posture across all frameworks.
     *
     * Query Parameters:
     * - framework: Optional filter ("soc2", "hipaa")
     * - hoursAgo: Lookback period in hours (default 24)
     *
     * Response:
     * {
     *   "frameworkScores": [
     *     {"framework": "soc2", "coveragePercent": 87, "coveredControls": 7, "totalControls": 8}
     *   ],
     *   "controls": [
     *     {
     *       "controlId": "CC6_1",
     *       "framework": "soc2",
     *       "name": "Logical Access Controls",
     *       "status": "covered",
     *       "spanCount": 1247,
     *       "lastEvidence": "2025-10-13T00:30:00Z"
     *     }
     *   ],
     *   "totalSpans": 8432,
     *   "lastUpdated": "2025-10-13T00:33:15Z"
     * }
     *
     * Status Values:
     * - "covered": ≥10 spans/hour in last 24h
     * - "partial": 1-9 spans/hour in last 24h
     * - "no_evidence": 0 spans in last 24h
     */
    @GET
    @Path("/summary")
    public ComplianceSummary getSummary(
            @QueryParam("framework") String framework,
            @QueryParam("hoursAgo") Integer hoursAgo
    ) {
        LOG.infof("GET /api/compliance/summary: framework=%s, hoursAgo=%s", framework, hoursAgo);

        return summaryService.getSummary(framework, hoursAgo);
    }

    /**
     * GET /api/compliance/controls/{framework}/{controlId}
     *
     * Returns detailed view of a single control with evidence spans.
     *
     * Path Parameters:
     * - framework: "soc2" or "hipaa"
     * - controlId: Control identifier (e.g., "CC6_1", "164.312(a)")
     *
     * Query Parameters:
     * - page: Page number (default 0)
     * - pageSize: Results per page (default 20, max 100)
     *
     * Response:
     * {
     *   "control": {...},
     *   "spans": [
     *     {
     *       "timestamp": "2025-10-13T00:30:15Z",
     *       "framework": "soc2",
     *       "control": "CC6_1",
     *       "evidenceType": "audit_trail",
     *       "outcome": "success",
     *       "traceId": "abc123",
     *       "spanId": "span456",
     *       "tenantId": "tenant-123",
     *       "operation": "authorizeUser"
     *     }
     *   ],
     *   "totalSpans": 1247,
     *   "page": 0,
     *   "pageSize": 20,
     *   "hasMore": true
     * }
     */
    @GET
    @Path("/controls/{framework}/{controlId}")
    public ControlDetail getControlDetail(
            @PathParam("framework") String framework,
            @PathParam("controlId") String controlId,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("pageSize") @DefaultValue("20") int pageSize
    ) {
        LOG.infof("GET /api/compliance/controls/%s/%s: page=%d, pageSize=%d",
                framework, controlId, page, pageSize);

        // Validate pageSize
        if (pageSize > 100) {
            pageSize = 100;
        }

        return summaryService.getControlDetail(framework, controlId, page, pageSize);
    }

    /**
     * GET /api/compliance/export
     *
     * Export evidence spans as CSV or JSON.
     *
     * Query Parameters:
     * - format: "csv" or "json" (default "csv")
     * - framework: Optional framework filter
     * - controlId: Optional control filter
     * - hoursAgo: Lookback period (default 24)
     *
     * Response:
     * - CSV: text/csv with headers
     * - JSON: application/json array of spans
     */
    @GET
    @Path("/export")
    public Response exportEvidence(
            @QueryParam("format") @DefaultValue("csv") String format,
            @QueryParam("framework") String framework,
            @QueryParam("controlId") String controlId,
            @QueryParam("hoursAgo") @DefaultValue("24") int hoursAgo
    ) {
        LOG.infof("GET /api/compliance/export: format=%s, framework=%s, controlId=%s",
                format, framework, controlId);

        String content = summaryService.exportEvidence(format, framework, controlId, hoursAgo);
        String mediaType = "csv".equalsIgnoreCase(format) ? "text/csv" : MediaType.APPLICATION_JSON;
        String filename = String.format("fluo-compliance-evidence-%s.%s",
                java.time.LocalDate.now(), format);

        return Response.ok(content)
                .type(mediaType)
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .build();
    }

    /**
     * GET /api/compliance/health
     *
     * Health check endpoint for compliance service.
     */
    @GET
    @Path("/health")
    public String health() {
        return "{\"status\": \"ok\", \"service\": \"compliance-api\"}";
    }
}
