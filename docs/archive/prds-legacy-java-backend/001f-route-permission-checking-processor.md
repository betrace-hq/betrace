# PRD-001f: Route Permission Checking Processor

**Priority:** P0
**Complexity:** Medium
**Unit:** `CheckRoutePermissionsProcessor.java`
**Dependencies:** PRD-001d (tenant/roles extracted), PRD-001e (RBACService)

## Problem

After tenant ID and roles are extracted into exchange properties, the authentication pipeline must enforce route permissions using RBAC. Unauthorized requests must be stopped with 403 Forbidden before reaching route handlers.

## Architecture Integration

**ADR Compliance:**
- **ADR-013 (Camel-First):** Implements Camel processor in authentication interceptor pipeline
- **ADR-014 (Testing Standards):** Named CDI processor with 90% test coverage requirement
- **ADR-012 (Tenant Isolation):** Enforces RBAC after tenant isolation verification

## Implementation

```java
package com.betrace.processors.auth;

import com.betrace.services.RBACService;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;

import java.util.List;
import java.util.UUID;

/**
 * Check route permissions using RBAC service.
 *
 * Enforces role-based access control on Camel routes.
 * If user lacks permission, returns 403 Forbidden and stops route.
 *
 * ADR-013: Camel-First - processor in authentication interceptor pipeline
 * ADR-014: Named processor for testability
 *
 * Input (from ExtractTenantAndRolesProcessor):
 * - Property: authenticatedTenantId (UUID)
 * - Property: authenticatedUserRoles (List<String>)
 *
 * Output:
 * - Header: authorized (Boolean) - set to true if access granted
 * - If denied: HTTP 403 + stop route
 */
@Named("checkRoutePermissionsProcessor")
@ApplicationScoped
public class CheckRoutePermissionsProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(CheckRoutePermissionsProcessor.class);

    @Inject
    RBACService rbacService;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Get route ID from exchange
        String routeId = exchange.getFromRouteId();

        // Get authenticated user roles from exchange properties
        List<String> userRoles = exchange.getProperty("authenticatedUserRoles", List.class);
        UUID tenantId = exchange.getProperty("authenticatedTenantId", UUID.class);

        // Validate inputs (should never be null at this point, but defensive check)
        if (routeId == null || routeId.isBlank()) {
            log.error("Route ID is null or blank, denying access");
            setUnauthorizedResponse(exchange, routeId, userRoles, "Missing route ID");
            return;
        }

        if (userRoles == null || userRoles.isEmpty()) {
            log.error("User roles are null or empty for route: {}, tenant: {}", routeId, tenantId);
            setUnauthorizedResponse(exchange, routeId, userRoles, "Missing user roles");
            return;
        }

        // Check RBAC permission
        boolean authorized = rbacService.checkRoutePermission(routeId, userRoles);

        if (authorized) {
            // Set authorized header for downstream processors
            exchange.getIn().setHeader("authorized", true);
            log.info("Authorized: route={}, tenant={}, roles={}", routeId, tenantId, userRoles);
        } else {
            // User does not have permission
            setUnauthorizedResponse(exchange, routeId, userRoles, "Insufficient permissions");
        }
    }

    /**
     * Set 403 Forbidden response and stop route.
     */
    private void setUnauthorizedResponse(Exchange exchange, String routeId, List<String> userRoles, String reason) {
        UUID tenantId = exchange.getProperty("authenticatedTenantId", UUID.class);
        UUID userId = exchange.getIn().getHeader("userId", UUID.class);

        log.warn("Authorization denied: route={}, tenant={}, user={}, roles={}, reason={}",
            routeId, tenantId, userId, userRoles, reason);

        // Set HTTP 403 Forbidden
        exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 403);

        // Set error body
        String errorBody = String.format(
            "{\"error\": \"Forbidden\", \"message\": \"%s\", \"route\": \"%s\"}",
            reason, routeId
        );
        exchange.getIn().setBody(errorBody);

        // Set content type
        exchange.getIn().setHeader(Exchange.CONTENT_TYPE, "application/json");

        // Stop route (prevent handler execution)
        exchange.setRouteStop(true);

        // Set unauthorized header for compliance span processor
        exchange.getIn().setHeader("authorized", false);
        exchange.getIn().setHeader("authorizationFailureReason", reason);
    }
}
```

## Testing Requirements (QA Expert - 90% Coverage)

**Unit Tests:**
- `testAuthorizedUserProceeds()` - Admin accessing createRule sets authorized=true, no route stop
- `testUnauthorizedUser403()` - Viewer accessing createRule returns 403 + stops route
- `testRBACServiceGrantsAccess()` - Mock RBAC returns true, processor allows
- `testRBACServiceDeniesAccess()` - Mock RBAC returns false, processor stops with 403
- `testMissingRouteId()` - Null route ID returns 403 + stops route
- `testMissingUserRoles()` - Null roles returns 403 + stops route
- `testEmptyUserRoles()` - Empty list returns 403 + stops route
- `testAllRoleCombinations()` - Test matrix: admin/developer/sre/compliance-viewer × all routes
- `testRouteStopOnDenial()` - Verify exchange.setRouteStop(true) called
- `testAuthorizedHeaderSet()` - authorized=true when granted, authorized=false when denied
- `testErrorBodyFormat()` - JSON error body with route ID
- `testContentTypeSet()` - Content-Type: application/json on 403

**Integration Tests:**
- `testEndToEndAuthorization()` - Full pipeline from JWT to route handler
- `testMultipleConsecutiveRequests()` - Authorized request followed by unauthorized request

**Edge Cases:**
- RBAC service throws exception (should deny by default)
- Route ID with special characters
- User roles with null elements
- Tenant ID missing (should still enforce RBAC)

## Security Considerations (Security Expert)

**Threat Model:**
- **Privilege Escalation:** Fail-secure on RBAC service errors (deny by default)
- **RBAC Service Bypass:** Direct injection of RBACService prevents reflection/proxy bypasses
- **Fail-Open Vulnerability:** Null/empty roles/routeId always denied (fail-secure)
- **Authorization Decision Leakage:** Error messages do not reveal which routes exist (generic "Forbidden")

**Security Design:**
- Default deny policy for all errors
- Log all authorization denials for security monitoring
- Set authorized=false header for compliance span generation
- Stop route before handler execution (prevents timing attacks)

## Success Criteria

- [ ] Authorized users proceed with authorized=true header set
- [ ] Unauthorized users receive HTTP 403 with JSON error body
- [ ] Route stops on authorization failure (setRouteStop(true))
- [ ] All authorization denials logged with route, tenant, user, roles
- [ ] RBAC service errors default to deny (fail-secure)
- [ ] Error body includes route ID and generic error message
- [ ] Content-Type set to application/json on errors
- [ ] 90% test coverage
- [ ] Integration test validates full authentication pipeline

## Files to Create

- `backend/src/main/java/com/betrace/processors/auth/CheckRoutePermissionsProcessor.java`
- `backend/src/test/java/com/betrace/processors/auth/CheckRoutePermissionsProcessorTest.java`

## Dependencies

**Requires:**
- PRD-001d (ExtractTenantAndRolesProcessor sets exchange properties)
- PRD-001e (RBACService for permission checks)

**Blocks:** None (final processor in authentication pipeline)
