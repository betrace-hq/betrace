package com.fluo.resources;

import com.fluo.models.compliance.ComplianceSummary;
import com.fluo.services.ComplianceSummaryService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
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
