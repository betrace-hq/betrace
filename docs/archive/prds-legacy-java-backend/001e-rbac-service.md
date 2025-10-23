# PRD-001e: RBAC Service

**Priority:** P0
**Complexity:** Medium
**Unit:** `RBACService.java`
**Dependencies:** None

## Problem

BeTrace requires role-based access control (RBAC) to enforce route permissions based on user roles (admin, developer, sre, compliance-viewer). A centralized service must define route permissions and provide fast permission checking for the authentication pipeline.

## Architecture Integration

**ADR Compliance:**
- **ADR-013 (Camel-First):** Service injected into Camel processors for permission checks
- **ADR-014 (Testing Standards):** ApplicationScoped CDI service with 90% test coverage
- **ADR-012 (Tenant Isolation):** Combined with tenant ID validation for complete access control

## Implementation

```java
package com.betrace.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Role-Based Access Control (RBAC) service for route permissions.
 *
 * Defines which user roles can access which Camel routes.
 *
 * ADR-013: Camel-First - injects into CheckRoutePermissionsProcessor
 * ADR-014: ApplicationScoped for singleton behavior, fast in-memory lookups
 *
 * Roles:
 * - admin: Full access to all features
 * - developer: Rules + signals (read/write)
 * - sre: Signals investigation (read/write)
 * - compliance-viewer: Compliance evidence (read-only)
 */
@ApplicationScoped
public class RBACService {

    private static final Logger log = LoggerFactory.getLogger(RBACService.class);

    /**
     * Route permissions map.
     * Key: Camel route ID
     * Value: Set of roles allowed to access route
     *
     * If route not in map, access is PUBLIC (no authentication required)
     */
    private static final Map<String, Set<String>> ROUTE_PERMISSIONS = Map.ofEntries(
        // ===== Admin Routes (tenant management, user management) =====
        Map.entry("createTenant", Set.of("admin")),
        Map.entry("deleteTenant", Set.of("admin")),
        Map.entry("updateTenant", Set.of("admin")),
        Map.entry("listAllTenants", Set.of("admin")),
        Map.entry("manageUsers", Set.of("admin")),
        Map.entry("assignUserRole", Set.of("admin")),

        // ===== Developer Routes (rule management) =====
        Map.entry("createRule", Set.of("admin", "developer")),
        Map.entry("updateRule", Set.of("admin", "developer")),
        Map.entry("deleteRule", Set.of("admin", "developer")),
        Map.entry("testRule", Set.of("admin", "developer")),
        Map.entry("listRules", Set.of("admin", "developer", "sre")),
        Map.entry("getRuleById", Set.of("admin", "developer", "sre")),

        // ===== SRE Routes (signals, investigation) =====
        Map.entry("listSignals", Set.of("admin", "developer", "sre")),
        Map.entry("getSignalById", Set.of("admin", "developer", "sre")),
        Map.entry("investigateSignal", Set.of("admin", "sre")),
        Map.entry("updateSignalStatus", Set.of("admin", "sre")),
        Map.entry("addSignalComment", Set.of("admin", "sre")),
        Map.entry("exportSignals", Set.of("admin", "sre")),

        // ===== Compliance Routes (read-only evidence, reports) =====
        Map.entry("viewComplianceEvidence", Set.of("admin", "compliance-viewer")),
        Map.entry("listComplianceControls", Set.of("admin", "compliance-viewer")),
        Map.entry("generateAuditReport", Set.of("admin", "compliance-viewer")),
        Map.entry("exportComplianceSpans", Set.of("admin", "compliance-viewer")),
        Map.entry("queryComplianceEvents", Set.of("admin", "compliance-viewer")),

        // ===== Span Ingestion (write-only for services) =====
        Map.entry("ingestSpans", Set.of("admin", "developer", "sre")),
        Map.entry("batchIngestSpans", Set.of("admin"))
    );

    /**
     * Check if user roles have permission for route.
     *
     * @param routeId Camel route ID
     * @param userRoles List of user roles
     * @return true if authorized, false if denied
     */
    public boolean checkRoutePermission(String routeId, List<String> userRoles) {
        if (routeId == null || routeId.isBlank()) {
            log.warn("Route ID is null or blank, denying access");
            return false;
        }

        if (userRoles == null || userRoles.isEmpty()) {
            log.warn("User roles are null or empty, denying access to route: {}", routeId);
            return false;
        }

        // If route not in permissions map, it's a public route (allow)
        Set<String> requiredRoles = ROUTE_PERMISSIONS.get(routeId);
        if (requiredRoles == null) {
            log.debug("Route {} not in RBAC map, allowing public access", routeId);
            return true;
        }

        // Check if user has any of the required roles
        boolean authorized = userRoles.stream()
            .anyMatch(requiredRoles::contains);

        if (authorized) {
            log.debug("User authorized for route {}: roles={}", routeId, userRoles);
        } else {
            log.warn("User denied access to route {}: roles={}, required={}",
                routeId, userRoles, requiredRoles);
        }

        return authorized;
    }

    /**
     * Check if user has specific permission (by permission name).
     *
     * @param userRoles List of user roles
     * @param permission Permission name (route ID)
     * @return true if user has permission, false otherwise
     */
    public boolean hasPermission(List<String> userRoles, String permission) {
        return checkRoutePermission(permission, userRoles);
    }

    /**
     * Check if user has ANY of the specified roles.
     *
     * @param userRoles List of user roles
     * @param requiredRoles Roles to check
     * @return true if user has at least one role
     */
    public boolean hasAnyRole(List<String> userRoles, String... requiredRoles) {
        if (userRoles == null || userRoles.isEmpty()) {
            return false;
        }

        for (String requiredRole : requiredRoles) {
            if (userRoles.contains(requiredRole)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if user is admin.
     *
     * @param userRoles List of user roles
     * @return true if user has admin role
     */
    public boolean isAdmin(List<String> userRoles) {
        return userRoles != null && userRoles.contains("admin");
    }

    /**
     * Get all protected routes.
     *
     * @return Set of route IDs that require authentication
     */
    public Set<String> getProtectedRoutes() {
        return ROUTE_PERMISSIONS.keySet();
    }
}
```

## Testing Requirements (QA Expert - 90% Coverage)

**Unit Tests:**
- `testAdminFullAccess()` - Admin can access all routes
- `testDeveloperLimitedAccess()` - Developer can access rules + signals, denied admin/compliance
- `testSreSignalsOnly()` - SRE can investigate signals, denied rules/admin/compliance
- `testComplianceViewerReadOnly()` - Compliance-viewer denied write routes
- `testUnknownRouteAllowed()` - Routes not in map are public
- `testNullRouteId()` - Returns false with warning log
- `testEmptyRouteId()` - Returns false with warning log
- `testNullUserRoles()` - Returns false with warning log
- `testEmptyUserRoles()` - Returns false with warning log
- `testHasPermissionHelper()` - Alias for checkRoutePermission
- `testHasAnyRole()` - Check multiple roles
- `testIsAdmin()` - Admin role check
- `testGetProtectedRoutes()` - Returns all protected routes

**Permission Matrix Tests:**
- Test every route + role combination (admin, developer, sre, compliance-viewer)
- Test multi-role users (e.g., ["developer", "sre"])

**Edge Cases:**
- Role name case sensitivity
- Null elements in userRoles list
- Duplicate roles in list
- Unknown role names

## Security Considerations (Security Expert)

**Threat Model:**
- **RBAC Bypass:** Default deny policy for null/empty inputs prevents bypass
- **Privilege Escalation:** Immutable ROUTE_PERMISSIONS map prevents runtime tampering
- **Role Validation Bypass:** Strict null/empty checks prevent uninitialized role access
- **Default Deny Policy:** Unknown routes are PUBLIC (intentional for health checks), protected routes must be explicitly mapped

**Design Decisions:**
- Unknown routes default to ALLOW (public) to avoid breaking health checks
- Null/empty roles/routeId default to DENY (fail-secure)
- Log all denials for security monitoring

## Success Criteria

- [ ] Return true/false for checkRoutePermission() with no exceptions
- [ ] Admin role can access all protected routes
- [ ] Developer role denied admin/compliance routes
- [ ] SRE role denied rule modification routes
- [ ] Compliance-viewer role denied write operations
- [ ] Public routes (not in map) are allowed
- [ ] Null/empty inputs return false (fail-secure)
- [ ] 90% test coverage
- [ ] Log all authorization denials

## Files to Create

- `backend/src/main/java/com/betrace/services/RBACService.java`
- `backend/src/test/java/com/betrace/services/RBACServiceTest.java`

## Dependencies

**Requires:** None (standalone service)
**Blocks:** PRD-001f (CheckRoutePermissionsProcessor injects this service)
