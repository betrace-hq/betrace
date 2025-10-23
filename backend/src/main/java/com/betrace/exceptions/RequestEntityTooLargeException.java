package com.betrace.exceptions;

/**
 * Exception thrown when a request exceeds the maximum allowed size.
 *
 * PRD-007 Unit D: Request Sanitization & Injection Prevention
 */
public class RequestEntityTooLargeException extends RuntimeException {
    private final long requestSize;
    private final long maxSize;

    public RequestEntityTooLargeException(String message) {
        super(message);
        this.requestSize = 0;
        this.maxSize = 0;
    }

    public RequestEntityTooLargeException(long requestSize, long maxSize) {
        super(String.format("Request size (%d bytes) exceeds maximum allowed size (%d bytes)", requestSize, maxSize));
        this.requestSize = requestSize;
        this.maxSize = maxSize;
    }

    public long getRequestSize() {
        return requestSize;
    }

    public long getMaxSize() {
        return maxSize;
    }
}
