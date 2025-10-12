package com.fluo.processors.auth;

import com.fluo.compliance.annotations.SOC2;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

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

    // Security: Role names must be alphanumeric + underscore/dash only (prevents injection)
    private static final Pattern VALID_ROLE_PATTERN = Pattern.compile("^[a-zA-Z0-9_-]{1,50}$");

    @Override
    @SOC2(controls = {"CC6.1", "CC7.2"},
          notes = "Tenant isolation and role extraction for authorization - emits audit trail")
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

        // Validate all roles are strings and match security pattern
        for (Object role : roles) {
            if (!(role instanceof String)) {
                throw new IllegalArgumentException("Invalid role type: " + role.getClass().getName());
            }

            String roleStr = (String) role;
            if (!VALID_ROLE_PATTERN.matcher(roleStr).matches()) {
                throw new IllegalArgumentException("Invalid role format: " + roleStr +
                    " (must be alphanumeric with underscore/dash, max 50 chars)");
            }
        }

        return roles;
    }
}
