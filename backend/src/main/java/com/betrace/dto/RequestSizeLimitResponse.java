package com.betrace.dto;

/**
 * Response returned when a request exceeds the maximum size limit.
 *
 * PRD-007 Unit D: Request Sanitization & Injection Prevention
 */
public record RequestSizeLimitResponse(
    String error,
    String message,
    long maxSizeBytes
) {
    public static RequestSizeLimitResponse of(long maxSize) {
        return new RequestSizeLimitResponse(
            "Request too large",
            String.format("Request body exceeds maximum size of %d bytes", maxSize),
            maxSize
        );
    }
}
