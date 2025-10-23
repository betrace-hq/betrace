package com.betrace.routes;

import com.betrace.services.ViolationStore;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * REST API for querying FLUO violations.
 *
 * ADR-026: Core competency #2 - Violation detection
 * ADR-027: Integration point for Grafana Datasource Plugin
 *
 * Architecture (Option B - FLUO ViolationStore):
 * - Violations stored in DuckDB (hot) + Parquet (cold)
 * - 10-100x faster than Tempo TraceQL queries
 * - SRE pattern discovery via trace references
 *
 * Endpoint:
 * - GET /api/violations - Query violations with filters
 *
 * Query Parameters:
 * - ruleId: Filter by rule ID (optional)
 * - severity: Minimum severity level (LOW/MEDIUM/HIGH/CRITICAL) (optional)
 * - start: Start time (ISO 8601) (optional)
 * - end: End time (ISO 8601) (optional)
 * - limit: Max results (default: 1000, max: 10000)
 *
 * Example:
 * GET /api/violations?severity=HIGH&start=2025-01-01T00:00:00Z&limit=100
 *
 * Response:
 * {
 *   "violations": [
 *     {
 *       "violationId": "uuid",
 *       "timestamp": "2025-01-22T10:30:00Z",
 *       "ruleId": "rule-123",
 *       "ruleName": "High Error Rate",
 *       "severity": "HIGH",
 *       "message": "Error rate 12% exceeds threshold 5%",
 *       "traceReferences": [
 *         {"traceId": "trace-1", "spanId": "span-1", "serviceName": "api-service"},
 *         {"traceId": "trace-2", "spanId": "span-2", "serviceName": "api-service"}
 *       ],
 *       "attributes": {"threshold": "5%", "actual": "12%"},
 *       "complianceFramework": null,
 *       "complianceControl": null
 *     }
 *   ],
 *   "count": 1,
 *   "hasMore": false
 * }
 */
@Path("/api/violations")
@Produces(MediaType.APPLICATION_JSON)
public class ViolationResource {

    private static final Logger LOG = Logger.getLogger(ViolationResource.class);

    private static final int DEFAULT_LIMIT = 1000;
    private static final int MAX_LIMIT = 10000;

    @Inject
    ViolationStore violationStore;

    /**
     * Query violations with filters.
     *
     * GET /api/violations?ruleId=rule-123&severity=HIGH&start=2025-01-01T00:00:00Z&limit=100
     */
    @GET
    public Response queryViolations(
            @QueryParam("ruleId") String ruleId,
            @QueryParam("severity") String severity,
            @QueryParam("start") String startParam,
            @QueryParam("end") String endParam,
            @QueryParam("limit") @DefaultValue("1000") int limit
    ) {
        try {
            // Validate and parse parameters
            Instant start = startParam != null ? Instant.parse(startParam) : null;
            Instant end = endParam != null ? Instant.parse(endParam) : null;

            // Enforce max limit
            if (limit > MAX_LIMIT) {
                limit = MAX_LIMIT;
            }
            if (limit < 1) {
                limit = DEFAULT_LIMIT;
            }

            // Validate severity
            if (severity != null && !isValidSeverity(severity)) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of(
                        "error", "Invalid severity. Must be: LOW, MEDIUM, HIGH, or CRITICAL",
                        "provided", severity
                    ))
                    .build();
            }

            // Query violations
            List<ViolationStore.ViolationRecord> violations =
                violationStore.query(ruleId, severity, start, end, limit);

            // Check if there might be more results
            boolean hasMore = violations.size() >= limit;

            // Return response
            return Response.ok(Map.of(
                "violations", violations,
                "count", violations.size(),
                "hasMore", hasMore
            )).build();

        } catch (Exception e) {
            LOG.errorf(e, "Error querying violations: %s", e.getMessage());
            return Response.serverError()
                .entity(Map.of("error", "Failed to query violations: " + e.getMessage()))
                .build();
        }
    }

    /**
     * Validate severity parameter.
     */
    private boolean isValidSeverity(String severity) {
        return "LOW".equals(severity) ||
               "MEDIUM".equals(severity) ||
               "HIGH".equals(severity) ||
               "CRITICAL".equals(severity);
    }
}
