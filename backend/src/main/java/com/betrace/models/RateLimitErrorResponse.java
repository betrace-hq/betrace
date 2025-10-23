package com.betrace.models;

/**
 * Error response for rate limit violations (HTTP 429).
 *
 * @param error Error type
 * @param message Human-readable error message
 * @param retryAfterSeconds Seconds to wait before retrying
 */
public record RateLimitErrorResponse(
    String error,
    String message,
    long retryAfterSeconds
) {}
