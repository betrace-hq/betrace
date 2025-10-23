# PRD-001d: Tenant & Role Extraction Processor

**Priority:** P0
**Complexity:** Simple
**Unit:** `ExtractTenantAndRolesProcessor.java`
**Dependencies:** PRD-001c (validated user headers)

## Problem

After WorkOS token validation, tenant ID and user roles exist as message headers but must be extracted into exchange properties for downstream processors. This enables ADR-012 tenant isolation and RBAC enforcement throughout the Camel route lifecycle.

## Architecture Integration

**ADR Compliance:**
- **ADR-013 (Camel-First):** Implements pure processor for tenant/role extraction in Camel pipeline
- **ADR-014 (Testing Standards):** Named CDI processor with 90% test coverage requirement
- **ADR-012 (Tenant Isolation):** Stores tenant ID in exchange property for downstream tenant filtering

## Implementation

```java
package com.fluo.processors.auth;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.util.List;
import java.util.UUID;

/**
 * Extract tenant ID and user roles from validated headers into exchange properties.
 *
 * ADR-012: Tenant isolation - stores authenticatedTenantId for downstream filtering
 * ADR-013: Camel-First - pure processor in authentication pipeline
 * ADR-014: Named processor for testability
 *
 * Input (from ValidateWorkOSTokenProcessor):
 * - Header: tenantId (UUID)
 * - Header: userRoles (List<String>)
 *
 * Output:
 * - Property: authenticatedTenantId (UUID) - for tenant isolation
 * - Property: authenticatedUserRoles (List<String>) - for RBAC checks
 */
@Named("extractTenantAndRolesProcessor")
@ApplicationScoped
public class ExtractTenantAndRolesProcessor implements Processor {

    private static final Logger log = LoggerFactory.getLogger(ExtractTenantAndRolesProcessor.class);

    @Override
    public void process(Exchange exchange) throws Exception {
        // Extract tenant ID from header
        UUID tenantId = extractTenantId(exchange);

        // Extract user roles from header
        List<String> roles = extractUserRoles(exchange);

        // Store in exchange properties (available to all downstream processors)
        exchange.setProperty("authenticatedTenantId", tenantId);
        exchange.setProperty("authenticatedUserRoles", roles);

        log.debug("Extracted tenant ID: {} with roles: {}", tenantId, roles);
    }

    /**
     * Extract and validate tenant ID from header.
     *
     * @throws IllegalArgumentException if tenant ID is missing or invalid
     */
    private UUID extractTenantId(Exchange exchange) {
        Object tenantIdObj = exchange.getIn().getHeader("tenantId");

        if (tenantIdObj == null) {
            throw new IllegalArgumentException("Missing tenantId header");
        }

        // Handle UUID or String
        if (tenantIdObj instanceof UUID) {
            return (UUID) tenantIdObj;
        }

        if (tenantIdObj instanceof String) {
            try {
                return UUID.fromString((String) tenantIdObj);
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid tenant ID format: " + tenantIdObj, e);
            }
        }

        throw new IllegalArgumentException("Invalid tenant ID type: " + tenantIdObj.getClass().getName());
    }

    /**
     * Extract and validate user roles from header.
     *
     * @throws IllegalArgumentException if roles are missing or invalid
     */
    @SuppressWarnings("unchecked")
    private List<String> extractUserRoles(Exchange exchange) {
        Object rolesObj = exchange.getIn().getHeader("userRoles");

        if (rolesObj == null) {
            throw new IllegalArgumentException("Missing userRoles header");
        }

        if (!(rolesObj instanceof List)) {
            throw new IllegalArgumentException("Invalid userRoles type: " + rolesObj.getClass().getName());
        }

        List<String> roles = (List<String>) rolesObj;

        if (roles.isEmpty()) {
            throw new IllegalArgumentException("User roles list cannot be empty");
        }

        // Validate all roles are strings
        for (Object role : roles) {
            if (!(role instanceof String)) {
                throw new IllegalArgumentException("Invalid role type: " + role.getClass().getName());
            }
        }

        return roles;
    }
}
```

## Testing Requirements (QA Expert - 90% Coverage)

**Unit Tests:**
- `testExtractValidTenantAndRoles()` - Happy path with UUID and List<String>
- `testExtractTenantIdAsString()` - Convert String UUID to UUID object
- `testMissingTenantId()` - Throws IllegalArgumentException with clear message
- `testMissingUserRoles()` - Throws IllegalArgumentException with clear message
- `testInvalidTenantIdFormat()` - Non-UUID string throws exception
- `testInvalidTenantIdType()` - Integer/Object throws exception
- `testEmptyRolesList()` - Empty list throws exception
- `testInvalidRoleType()` - List with non-String throws exception
- `testMultipleRoles()` - Extracts all roles correctly
- `testExchangePropertiesSet()` - Verify properties are set (not headers)

**Edge Cases:**
- Null tenant ID header
- Null roles header
- Malformed UUID string
- Mixed type list (String + Integer)
- Single role vs multiple roles

## Security Considerations (Security Expert)

**Threat Model:**
- **Tenant ID Spoofing:** Processor trusts validated headers (ValidateWorkOSTokenProcessor must enforce integrity)
- **Role Injection:** List type validation prevents injection attacks
- **UUID Validation Bypass:** Strict UUID parsing prevents malformed IDs propagating downstream
- **Type Confusion:** Type checks prevent ClassCastException exploits in downstream processors

## Success Criteria

- [ ] Exchange properties `authenticatedTenantId` and `authenticatedUserRoles` set correctly
- [ ] Tenant ID validated as UUID (strict parsing)
- [ ] User roles validated as non-empty List<String>
- [ ] Clear exceptions with error messages for invalid inputs
- [ ] 90% test coverage
- [ ] Processor logs extraction for audit trail

## Files to Create

- `backend/src/main/java/com/fluo/processors/auth/ExtractTenantAndRolesProcessor.java`
- `backend/src/test/java/com/fluo/processors/auth/ExtractTenantAndRolesProcessorTest.java`

## Dependencies

**Requires:** PRD-001c (ValidateWorkOSTokenProcessor sets headers)
**Blocks:** PRD-001f (CheckRoutePermissionsProcessor reads properties)
