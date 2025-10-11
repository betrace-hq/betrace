package com.fluo.exceptions;

/**
 * Exception thrown when a rate limit is exceeded.
 * Contains retry-after information for HTTP 429 response.
 */
public class RateLimitExceededException extends RuntimeException {
    private final long retryAfterSeconds;

    public RateLimitExceededException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
