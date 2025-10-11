package com.fluo.models;

/**
 * Result of a rate limit check.
 *
 * @param allowed Whether the request is allowed
 * @param retryAfterSeconds Seconds to wait before retrying (0 if allowed)
 * @param tokensRemaining Tokens remaining in bucket (for X-RateLimit-Remaining header)
 */
public record RateLimitResult(
    boolean allowed,
    long retryAfterSeconds,
    double tokensRemaining
) {
    /**
     * Convenience constructor for simple allow/deny results.
     */
    public RateLimitResult(boolean allowed, long retryAfterSeconds) {
        this(allowed, retryAfterSeconds, 0.0);
    }
}
