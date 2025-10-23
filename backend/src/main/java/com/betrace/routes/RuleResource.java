package com.betrace.routes;

import com.betrace.model.Rule;
import com.betrace.services.ASTRuleManager;
import com.betrace.rules.dsl.ASTInterpreter;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST API for FLUO rule management
 *
 * ADR-023: Single-tenant deployment - no tenant parameter needed
 * ADR-027: Integration point for Grafana App Plugin
 *
 * Endpoints:
 * - GET /api/rules - List all rules
 * - POST /api/rules - Create new rule
 * - GET /api/rules/{id} - Get rule by ID
 * - PUT /api/rules/{id} - Update rule
 * - DELETE /api/rules/{id} - Delete rule
 * - POST /api/rules/test - Test rule with sample trace
 */
@Path("/api/rules")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RuleResource {

    private static final Logger LOG = Logger.getLogger(RuleResource.class);

    // ADR-023: Single-tenant uses default tenant ID
    private static final String DEFAULT_TENANT = "default";

    @Inject
    ASTRuleManager ruleManager;

    /**
     * List all rules
     *
     * GET /api/rules
     */
    @GET
    public Response listRules() {
        try {
            Map<String, ASTInterpreter.CompiledRule> compiledRules =
                ruleManager.getRulesForTenant(DEFAULT_TENANT);

            if (compiledRules == null) {
                return Response.ok(Collections.emptyList()).build();
            }

            // Convert compiled rules to REST API format
            // TODO: Store original DSL source in CompiledRule for retrieval
            List<RuleDTO> rules = compiledRules.entrySet().stream()
                .map(entry -> new RuleDTO(
                    entry.getKey(),
                    entry.getValue().name(),
                    entry.getValue().description(),
                    "", // TODO: Add dslSource to CompiledRule
                    true, // active status not tracked in ASTRuleManager yet
                    Instant.now(), // TODO: track creation time
                    Instant.now()  // TODO: track update time
                ))
                .collect(Collectors.toList());

            return Response.ok(rules).build();
        } catch (Exception e) {
            LOG.errorf(e, "Error listing rules");
            return Response.serverError()
                .entity(Map.of("error", "Failed to list rules: " + e.getMessage()))
                .build();
        }
    }

    /**
     * Create new rule
     *
     * POST /api/rules
     * Body: { "name": "...", "description": "...", "expression": "...", "active": true }
     */
    @POST
    public Response createRule(CreateRuleRequest request) {
        try {
            // Validate request
            if (request.name == null || request.name.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Rule name is required"))
                    .build();
            }
            if (request.expression == null || request.expression.isBlank()) {
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Rule expression is required"))
                    .build();
            }

            // Generate rule ID
            String ruleId = UUID.randomUUID().toString();

            // Add rule to rule manager
            boolean success = ruleManager.addRule(
                DEFAULT_TENANT,
                ruleId,
                request.name,
                request.expression,
                request.description != null ? request.description : "",
                "MEDIUM" // Default severity
            );

            if (!success) {
                return Response.serverError()
                    .entity(Map.of("error", "Failed to compile rule"))
                    .build();
            }

            // Return created rule
            RuleDTO createdRule = new RuleDTO(
                ruleId,
                request.name,
                request.description,
                request.expression,
                request.active != null ? request.active : true,
                Instant.now(),
                Instant.now()
            );

            LOG.infof("Created rule: %s (%s)", request.name, ruleId);

            return Response.status(Response.Status.CREATED)
                .entity(createdRule)
                .build();
        } catch (Exception e) {
            LOG.errorf(e, "Error creating rule");
            return Response.serverError()
                .entity(Map.of("error", "Failed to create rule: " + e.getMessage()))
                .build();
        }
    }

    /**
     * Get rule by ID
     *
     * GET /api/rules/{id}
     */
    @GET
    @Path("/{id}")
    public Response getRule(@PathParam("id") String ruleId) {
        try {
            Map<String, ASTInterpreter.CompiledRule> compiledRules =
                ruleManager.getRulesForTenant(DEFAULT_TENANT);

            if (compiledRules == null || !compiledRules.containsKey(ruleId)) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "Rule not found"))
                    .build();
            }

            ASTInterpreter.CompiledRule compiledRule = compiledRules.get(ruleId);
            // TODO: Store original DSL source in CompiledRule for retrieval
            RuleDTO rule = new RuleDTO(
                ruleId,
                compiledRule.name(),
                compiledRule.description(),
                "", // TODO: Add dslSource to CompiledRule
                true,
                Instant.now(),
                Instant.now()
            );

            return Response.ok(rule).build();
        } catch (Exception e) {
            LOG.errorf(e, "Error getting rule %s", ruleId);
            return Response.serverError()
                .entity(Map.of("error", "Failed to get rule: " + e.getMessage()))
                .build();
        }
    }

    /**
     * Update rule
     *
     * PUT /api/rules/{id}
     * Body: { "name": "...", "description": "...", "expression": "...", "active": true }
     */
    @PUT
    @Path("/{id}")
    public Response updateRule(@PathParam("id") String ruleId, CreateRuleRequest request) {
        try {
            // Check if rule exists
            Map<String, ASTInterpreter.CompiledRule> compiledRules =
                ruleManager.getRulesForTenant(DEFAULT_TENANT);

            if (compiledRules == null || !compiledRules.containsKey(ruleId)) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "Rule not found"))
                    .build();
            }

            // Remove old rule
            ruleManager.removeRule(DEFAULT_TENANT, ruleId);

            // Add updated rule
            boolean success = ruleManager.addRule(
                DEFAULT_TENANT,
                ruleId,
                request.name,
                request.expression,
                request.description != null ? request.description : "",
                "MEDIUM"
            );

            if (!success) {
                return Response.serverError()
                    .entity(Map.of("error", "Failed to compile updated rule"))
                    .build();
            }

            RuleDTO updatedRule = new RuleDTO(
                ruleId,
                request.name,
                request.description,
                request.expression,
                request.active != null ? request.active : true,
                Instant.now(), // Original creation time lost
                Instant.now()
            );

            LOG.infof("Updated rule: %s (%s)", request.name, ruleId);

            return Response.ok(updatedRule).build();
        } catch (Exception e) {
            LOG.errorf(e, "Error updating rule %s", ruleId);
            return Response.serverError()
                .entity(Map.of("error", "Failed to update rule: " + e.getMessage()))
                .build();
        }
    }

    /**
     * Delete rule
     *
     * DELETE /api/rules/{id}
     */
    @DELETE
    @Path("/{id}")
    public Response deleteRule(@PathParam("id") String ruleId) {
        try {
            // Check if rule exists
            Map<String, ASTInterpreter.CompiledRule> compiledRules =
                ruleManager.getRulesForTenant(DEFAULT_TENANT);

            if (compiledRules == null || !compiledRules.containsKey(ruleId)) {
                return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "Rule not found"))
                    .build();
            }

            ruleManager.removeRule(DEFAULT_TENANT, ruleId);

            LOG.infof("Deleted rule: %s", ruleId);

            return Response.noContent().build();
        } catch (Exception e) {
            LOG.errorf(e, "Error deleting rule %s", ruleId);
            return Response.serverError()
                .entity(Map.of("error", "Failed to delete rule: " + e.getMessage()))
                .build();
        }
    }

    /**
     * Test rule against sample trace
     *
     * POST /api/rules/test
     * Body: { "expression": "...", "sampleTrace": [...] }
     */
    @POST
    @Path("/test")
    public Response testRule(TestRuleRequest request) {
        // TODO: Implement rule testing
        // For now, return placeholder response
        return Response.ok(Map.of(
            "matched", false,
            "message", "Rule testing not yet implemented (Phase 4)"
        )).build();
    }

    // ===== DTOs =====

    public static class RuleDTO {
        public String id;
        public String name;
        public String description;
        public String expression;
        public boolean active;
        public Instant createdAt;
        public Instant updatedAt;

        public RuleDTO() {}

        public RuleDTO(String id, String name, String description, String expression,
                      boolean active, Instant createdAt, Instant updatedAt) {
            this.id = id;
            this.name = name;
            this.description = description;
            this.expression = expression;
            this.active = active;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
        }
    }

    public static class CreateRuleRequest {
        public String name;
        public String description;
        public String expression;
        public Boolean active;
    }

    public static class TestRuleRequest {
        public String expression;
        public List<Map<String, Object>> sampleTrace;
    }
}
