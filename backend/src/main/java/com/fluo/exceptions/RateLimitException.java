package com.fluo.exceptions;

/**
 * Exception for rate limiting system failures (not quota exceeded).
 * Used for internal errors like DuckDB unavailability.
 */
public class RateLimitException extends RuntimeException {
    public RateLimitException(String message) {
        super(message);
    }

    public RateLimitException(String message, Throwable cause) {
        super(message, cause);
    }
}
