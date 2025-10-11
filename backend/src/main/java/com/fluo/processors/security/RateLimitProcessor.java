package com.fluo.processors.security;

import com.fluo.exceptions.RateLimitExceededException;
import com.fluo.model.TenantContext;
import com.fluo.models.RateLimitResult;
import com.fluo.services.MetricsService;
import com.fluo.services.RateLimiter;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.UUID;

/**
 * Camel processor for rate limiting enforcement.
 *
 * Enforces two-tier rate limiting:
 * 1. Tenant-level (1000 req/min default)
 * 2. User-level (100 req/min default)
 *
 * For unauthenticated requests, uses anonymous rate limit (10 req/min default).
 *
 * Throws RateLimitExceededException if quota exceeded, which is handled by
 * RateLimitErrorProcessor to generate HTTP 429 response.
 */
@Named("rateLimitProcessor")
@ApplicationScoped
public class RateLimitProcessor implements Processor {

    @Inject
    RateLimiter rateLimiter;

    @Inject
    MetricsService metricsService;

    @Inject
    TenantContext tenantContext;

    @Override
    public void process(Exchange exchange) throws Exception {
        UUID tenantId;
        String userId = null;

        // Determine authentication status and get context
        if (tenantContext.isAuthenticated()) {
            tenantId = UUID.fromString(tenantContext.getTenantId());
            userId = tenantContext.getUserId();

            Log.debug("Rate limiting authenticated request: tenant=" + tenantId + ", user=" + userId);

            // Check tenant-level rate limit first
            RateLimitResult tenantResult = rateLimiter.checkTenantLimit(tenantId);
            if (!tenantResult.allowed()) {
                metricsService.recordRateLimitViolation(tenantId, "tenant", tenantResult.retryAfterSeconds());
                throw new RateLimitExceededException(
                    "Tenant rate limit exceeded. Retry after " + tenantResult.retryAfterSeconds() + " seconds",
                    tenantResult.retryAfterSeconds()
                );
            }

            // Check user-level rate limit (if user ID available)
            if (userId != null) {
                RateLimitResult userResult = rateLimiter.checkUserLimit(tenantId, userId);
                if (!userResult.allowed()) {
                    metricsService.recordRateLimitViolation(tenantId, "user", userResult.retryAfterSeconds());
                    throw new RateLimitExceededException(
                        "User rate limit exceeded. Retry after " + userResult.retryAfterSeconds() + " seconds",
                        userResult.retryAfterSeconds()
                    );
                }
            }

            // Record successful request
            metricsService.recordAllowedRequest(tenantId, userId);

        } else {
            // Unauthenticated request - use anonymous rate limit
            tenantId = UUID.fromString("00000000-0000-0000-0000-000000000000");

            Log.debug("Rate limiting anonymous request");

            RateLimitResult anonymousResult = rateLimiter.checkAnonymousLimit();
            if (!anonymousResult.allowed()) {
                metricsService.recordRateLimitViolation(tenantId, "anonymous", anonymousResult.retryAfterSeconds());
                throw new RateLimitExceededException(
                    "Anonymous rate limit exceeded. Retry after " + anonymousResult.retryAfterSeconds() + " seconds",
                    anonymousResult.retryAfterSeconds()
                );
            }

            // Record successful anonymous request
            metricsService.recordAllowedRequest(tenantId, null);
        }
    }
}
