package com.fluo.routes;

import com.fluo.model.TenantContext;
import com.fluo.model.Tenant;
import org.apache.camel.Exchange;
import org.apache.camel.Route;
import org.apache.camel.support.RoutePolicySupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

/**
 * Route Policy that automatically establishes tenant context for any route.
 *
 * This demonstrates Camel's Policy pattern - cross-cutting concerns
 * handled declaratively without polluting business logic.
 *
 * Usage:
 * from("direct:some-route")
 *     .routePolicy(new TenantContextPolicy())
 *     .log("I automatically have tenant context!")
 *     .process(exchange -> {
 *         TenantContext ctx = exchange.getProperty("tenantContext", TenantContext.class);
 *         // Use the context
 *     });
 */
public class TenantContextPolicy extends RoutePolicySupport {

    private static final Logger LOG = LoggerFactory.getLogger(TenantContextPolicy.class);

    @Override
    public void onExchangeBegin(Route route, Exchange exchange) {
        // Extract tenant ID from various sources
        String tenantId = extractTenantId(exchange);

        // If no tenant ID found, fail the exchange
        if (tenantId == null) {
            String errorMsg = "No tenant ID found in request. Tenant ID must be provided via headers (tenantId, id, tenant) or JWT token";
            LOG.error(errorMsg);
            exchange.setProperty(Exchange.ROUTE_STOP, Boolean.TRUE);
            exchange.setProperty("tenantContextError", errorMsg);
            exchange.getIn().setHeader("CamelHttpResponseCode", 400);
            exchange.getIn().setBody(Map.of(
                "error", "MISSING_TENANT",
                "message", errorMsg
            ));
            return;
        }

        // Check if context already exists
        TenantContext existingContext = exchange.getProperty("tenantContext", TenantContext.class);
        if (existingContext != null && existingContext.getTenantId().equals(tenantId)) {
            LOG.debug("Tenant context already established for: {}", tenantId);
            return;
        }

        // Establish new context
        try {
            TenantContext context = establishContext(exchange, tenantId);

            // Store in exchange properties (survives across routes)
            exchange.setProperty("tenantContext", context);
            exchange.getIn().setHeader("tenantId", tenantId);
            exchange.getIn().setHeader("tenantContext", context);

            LOG.debug("Established tenant context via policy for: {}", tenantId);
        } catch (Exception e) {
            LOG.error("Failed to establish tenant context for: {}", tenantId, e);
            // Stop the route and return error response
            exchange.setProperty(Exchange.ROUTE_STOP, Boolean.TRUE);
            exchange.setProperty("tenantContextError", e.getMessage());
            exchange.getIn().setHeader("CamelHttpResponseCode", 403);
            exchange.getIn().setBody(Map.of(
                "error", "INVALID_TENANT",
                "message", e.getMessage()
            ));
        }
    }

    @Override
    public void onExchangeDone(Route route, Exchange exchange) {
        // Clean up context if needed
        TenantContext context = exchange.getProperty("tenantContext", TenantContext.class);
        if (context != null) {
            LOG.debug("Clearing tenant context for: {}", context.getTenantId());
            // Could perform cleanup here if needed
            exchange.removeProperty("tenantContext");
        }
    }

    private String extractTenantId(Exchange exchange) {
        // Try multiple sources in order of priority

        // 1. Explicit header
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);
        if (tenantId != null) {
            return tenantId;
        }

        // 2. From REST path parameter
        tenantId = exchange.getIn().getHeader("id", String.class);
        if (tenantId != null) {
            return tenantId;
        }

        // 3. From JWT token (if using security)
        String authHeader = exchange.getIn().getHeader("Authorization", String.class);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            // In real implementation, decode JWT and extract tenant claim
            // For now, just demonstrate the pattern
            tenantId = extractTenantFromToken(authHeader);
            if (tenantId != null) {
                return tenantId;
            }
        }

        // 4. From query parameter
        tenantId = exchange.getIn().getHeader("tenant", String.class);
        if (tenantId != null) {
            return tenantId;
        }

        // No tenant found - this is an error
        return null;
    }

    // Package-protected for testing
    String extractTenantFromToken(String authHeader) {
        // Mock implementation - in reality would decode JWT
        // and extract tenant claim
        return null;
    }

    private TenantContext establishContext(Exchange exchange, String tenantId) {
        // In real implementation, would fetch from cache or service
        // For demonstration, create a simple context

        // Try to get tenant from cache (if UltimateTenantRoute is active)
        Object cachedTenant = exchange.getContext()
            .createProducerTemplate()
            .requestBodyAndHeader("cache://tenants?operation=GET", null, "CamelCacheKey", tenantId);

        if (cachedTenant instanceof Tenant) {
            Tenant tenant = (Tenant) cachedTenant;
            if (tenant.getStatus() != Tenant.TenantStatus.ACTIVE) {
                throw new IllegalStateException("Tenant is not active: " + tenantId);
            }
            return new TenantContext(tenantId, tenant);
        }

        throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
}