package com.fluo.processors.security;

import com.fluo.exceptions.RateLimitExceededException;
import com.fluo.models.RateLimitErrorResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Handles RateLimitExceededException and generates HTTP 429 response.
 *
 * Response includes:
 * - HTTP status 429 (Too Many Requests)
 * - Retry-After header (seconds)
 * - X-RateLimit-* headers for client visibility
 * - JSON error body
 */
@Named("rateLimitErrorProcessor")
@ApplicationScoped
public class RateLimitErrorProcessor implements Processor {

    @Override
    public void process(Exchange exchange) throws Exception {
        Throwable cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Throwable.class);

        if (cause instanceof RateLimitExceededException rle) {
            // Build error response
            RateLimitErrorResponse response = new RateLimitErrorResponse(
                "Rate limit exceeded",
                rle.getMessage(),
                rle.getRetryAfterSeconds()
            );

            // Set response body and headers (use getMessage() for Camel 3.x)
            exchange.getMessage().setBody(response);
            exchange.getMessage().setHeader(Exchange.HTTP_RESPONSE_CODE, 429);
            exchange.getMessage().setHeader(Exchange.CONTENT_TYPE, "application/json");

            // Standard rate limit headers (RFC 6585)
            exchange.getMessage().setHeader("Retry-After", String.valueOf(rle.getRetryAfterSeconds()));

            // X-RateLimit headers for client visibility
            exchange.getMessage().setHeader("X-RateLimit-Limit", "1000");  // TODO: Get actual limit from config
            exchange.getMessage().setHeader("X-RateLimit-Remaining", "0");
            exchange.getMessage().setHeader("X-RateLimit-Reset",
                String.valueOf(System.currentTimeMillis() / 1000 + rle.getRetryAfterSeconds()));
        }
    }
}
