package com.betrace.routes;

import com.betrace.exceptions.RateLimitExceededException;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;

/**
 * Global Camel route configuration for cross-cutting concerns.
 *
 * Applies rate limiting to ALL REST endpoints except exempted paths.
 * Uses interceptFrom("rest:*") for efficient global interception.
 */
@ApplicationScoped
public class GlobalRouteConfiguration extends RouteBuilder {

    @ConfigProperty(name = "fluo.ratelimit.exempt-paths")
    List<String> exemptPaths;

    @Override
    public void configure() throws Exception {
        // Global exception handler for rate limit violations
        onException(RateLimitExceededException.class)
            .handled(true)
            .process("rateLimitErrorProcessor")
            .marshal().json()
            .setHeader(Exchange.CONTENT_TYPE, constant("application/json"));

        // Intercept ALL REST endpoints (except exempted paths)
        interceptFrom("rest:*")
            .when(method(this, "shouldApplyRateLimit"))
            .process("rateLimitProcessor");
    }

    /**
     * Determine if rate limiting should be applied to the request.
     *
     * Exempts paths configured in fluo.ratelimit.exempt-paths:
     * - Health checks: /q/health
     * - Metrics: /q/metrics
     * - OpenAPI: /q/openapi
     * - Public status: /api/public/status
     *
     * @param exchange Camel exchange
     * @return true if rate limiting should be applied
     */
    public boolean shouldApplyRateLimit(Exchange exchange) {
        String path = exchange.getIn().getHeader(Exchange.HTTP_PATH, String.class);

        if (path == null) {
            return true;
        }

        // Check if path matches any exempted prefix
        for (String exemptPath : exemptPaths) {
            if (path.startsWith(exemptPath)) {
                return false;  // Exempt from rate limiting
            }
        }

        return true;  // Apply rate limiting
    }
}
