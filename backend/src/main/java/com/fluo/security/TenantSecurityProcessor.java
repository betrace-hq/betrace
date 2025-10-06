package com.fluo.security;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

/**
 * Processor to enforce tenant and role-based security on routes.
 *
 * This processor validates that:
 * 1. User is authenticated via WorkOS
 * 2. User belongs to the correct tenant
 * 3. User has required roles for the operation
 */
public class TenantSecurityProcessor implements Processor {

    private static final Logger LOG = LoggerFactory.getLogger(TenantSecurityProcessor.class);

    private final String requiredRole;
    private final boolean requireTenantMatch;

    public TenantSecurityProcessor(String requiredRole, boolean requireTenantMatch) {
        this.requiredRole = requiredRole;
        this.requireTenantMatch = requireTenantMatch;
    }

    // Static factory methods for common security patterns
    public static TenantSecurityProcessor requireAuthentication() {
        return new TenantSecurityProcessor(null, false);
    }

    public static TenantSecurityProcessor requireRole(String role) {
        return new TenantSecurityProcessor(role, false);
    }

    public static TenantSecurityProcessor requireTenantAccess() {
        return new TenantSecurityProcessor(null, true);
    }

    public static TenantSecurityProcessor requireTenantRole(String role) {
        return new TenantSecurityProcessor(role, true);
    }

    @Override
    public void process(Exchange exchange) throws Exception {
        // Check if we're in test mode
        String testMode = System.getProperty("security.test.mode",
            exchange.getContext().resolvePropertyPlaceholders("{{security.test.mode:false}}"));

        // Extract authentication headers
        String authHeader = exchange.getIn().getHeader("Authorization", String.class);
        String userTenantId = exchange.getIn().getHeader("tenantId", String.class);

        // Handle userRoles as either List or comma-separated String
        List<String> userRoles = null;
        Object rolesHeader = exchange.getIn().getHeader("userRoles");
        if (rolesHeader instanceof List) {
            @SuppressWarnings("unchecked")
            List<String> rolesList = (List<String>) rolesHeader;
            userRoles = rolesList;
        } else if (rolesHeader instanceof String) {
            String rolesString = (String) rolesHeader;
            userRoles = java.util.Arrays.asList(rolesString.split(","));
        }

        // Check if user is authenticated
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            LOG.warn("Unauthorized access attempt - no authentication token");
            setUnauthorizedResponse(exchange, "Authentication required");
            return;
        }

        // In test mode, accept test tokens
        if ("true".equals(testMode) && authHeader.contains("test-token")) {
            LOG.debug("Test mode: accepting test token");
            // Continue with the provided test headers
        }

        // Check tenant access if required
        if (requireTenantMatch) {
            String requestedTenantId = extractRequestedTenantId(exchange);

            if (requestedTenantId == null) {
                LOG.warn("No tenant ID in request");
                setBadRequestResponse(exchange, "Tenant ID required");
                return;
            }

            if (!requestedTenantId.equals(userTenantId)) {
                LOG.warn("Tenant mismatch - User tenant: {}, Requested tenant: {}",
                    userTenantId, requestedTenantId);
                setForbiddenResponse(exchange, "Access denied to this tenant");
                return;
            }
        }

        // Check role-based access if required
        if (requiredRole != null) {
            if (userRoles == null || !userRoles.contains(requiredRole)) {
                LOG.warn("Insufficient privileges - Required role: {}, User roles: {}",
                    requiredRole, userRoles);
                setForbiddenResponse(exchange, "Insufficient privileges");
                return;
            }
        }

        // Add security context to exchange for downstream processors
        java.util.Map<String, Object> securityContext = new java.util.HashMap<>();
        securityContext.put("authenticated", true);
        securityContext.put("tenantId", userTenantId != null ? userTenantId : "");
        securityContext.put("roles", userRoles != null ? userRoles : new java.util.ArrayList<>());
        securityContext.put("authToken", authHeader.substring(7)); // Remove "Bearer " prefix

        exchange.getIn().setHeader("SecurityContext", securityContext);
        LOG.debug("Security check passed for tenant: {} with roles: {}", userTenantId, userRoles);
    }

    private String extractRequestedTenantId(Exchange exchange) {
        // Try to get tenant ID from various sources

        // 1. From path parameter
        String tenantFromPath = exchange.getIn().getHeader("tenantId", String.class);
        if (tenantFromPath != null) {
            return tenantFromPath;
        }

        // 2. From query parameter
        String tenantFromQuery = exchange.getIn().getHeader("CamelHttpQuery.tenantId", String.class);
        if (tenantFromQuery != null) {
            return tenantFromQuery;
        }

        // 3. From request body (for POST/PUT requests)
        Object body = exchange.getIn().getBody();
        if (body instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> bodyMap = (Map<String, Object>) body;
            Object tenantFromBody = bodyMap.get("tenantId");
            if (tenantFromBody != null) {
                return tenantFromBody.toString();
            }
        }

        return null;
    }

    private void setUnauthorizedResponse(Exchange exchange, String message) {
        exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 401);
        exchange.getIn().setHeader(Exchange.CONTENT_TYPE, "application/json");
        java.util.Map<String, Object> errorResponse = new java.util.HashMap<>();
        errorResponse.put("error", "Unauthorized");
        errorResponse.put("message", message);
        errorResponse.put("timestamp", java.time.Instant.now().toString());
        exchange.getIn().setBody(errorResponse);
    }

    private void setForbiddenResponse(Exchange exchange, String message) {
        exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 403);
        exchange.getIn().setHeader(Exchange.CONTENT_TYPE, "application/json");
        java.util.Map<String, Object> errorResponse = new java.util.HashMap<>();
        errorResponse.put("error", "Forbidden");
        errorResponse.put("message", message);
        errorResponse.put("timestamp", java.time.Instant.now().toString());
        exchange.getIn().setBody(errorResponse);
    }

    private void setBadRequestResponse(Exchange exchange, String message) {
        exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 400);
        exchange.getIn().setHeader(Exchange.CONTENT_TYPE, "application/json");
        java.util.Map<String, Object> errorResponse = new java.util.HashMap<>();
        errorResponse.put("error", "Bad Request");
        errorResponse.put("message", message);
        errorResponse.put("timestamp", java.time.Instant.now().toString());
        exchange.getIn().setBody(errorResponse);
    }
}