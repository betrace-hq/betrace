package com.fluo.processors;

import com.fluo.dto.CreateRuleRequest;
import com.fluo.services.TenantService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Processor that validates tenant access authorization.
 *
 * SECURITY: Prevents tenant enumeration by checking both existence and access rights.
 * Generic error message prevents distinguishing between non-existent and unauthorized tenants.
 */
@Named("tenantAccessProcessor")
@ApplicationScoped
public class TenantAccessProcessor implements Processor {

    private static final Logger logger = LoggerFactory.getLogger(TenantAccessProcessor.class);

    @Inject
    TenantService tenantService;

    @Override
    public void process(Exchange exchange) throws Exception {
        CreateRuleRequest request = exchange.getIn().getBody(CreateRuleRequest.class);
        String userId = exchange.getIn().getHeader("userId", String.class);

        if (request == null || request.tenantId() == null) {
            logger.warn("Missing request or tenant ID in tenant access check");
            setForbiddenResponse(exchange, "Invalid tenant identifier");
            return;
        }

        String tenantId = request.tenantId().toString();

        // Extract userId from Authorization header if not in userId header
        if (userId == null || userId.isBlank()) {
            String authHeader = exchange.getIn().getHeader("Authorization", String.class);
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                // In a real system, decode JWT to get userId
                // For now, use a placeholder
                userId = "authenticated-user";
            }
        }

        if (userId == null || userId.isBlank()) {
            logger.warn("No user ID available for tenant access check");
            setForbiddenResponse(exchange, "Invalid tenant identifier");
            return;
        }

        // Check both existence and access in one call
        if (!tenantService.hasAccess(userId, tenantId)) {
            // Generic error - don't reveal if tenant exists or user lacks access
            logger.warn("Tenant access denied for user {} to tenant {}", userId, tenantId);
            setForbiddenResponse(exchange, "Invalid tenant identifier");
            return;
        }

        logger.debug("Tenant access granted for user {} to tenant {}", userId, tenantId);
    }

    private void setForbiddenResponse(Exchange exchange, String message) {
        exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 403);
        exchange.getIn().setHeader("Content-Type", "application/json");
        exchange.getIn().setBody(String.format("{\"error\":\"%s\"}", message));
        exchange.setProperty(Exchange.ROUTE_STOP, Boolean.TRUE);
    }
}
