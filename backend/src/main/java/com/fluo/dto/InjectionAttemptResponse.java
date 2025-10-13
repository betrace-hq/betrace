package com.fluo.dto;

/**
 * Response returned when an injection attempt is detected.
 *
 * PRD-007 Unit D: Request Sanitization & Injection Prevention
 */
public record InjectionAttemptResponse(
    String error,
    String message
) {
    public static InjectionAttemptResponse of(String injectionType) {
        return new InjectionAttemptResponse(
            "Security violation detected",
            String.format("Your request contains potentially malicious input (%s) and has been blocked", injectionType)
        );
    }
}
