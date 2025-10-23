package com.fluo.exceptions;

/**
 * Exception thrown when input sanitization detects an injection attempt
 * (SQL injection, XSS, LDAP injection, or command injection).
 *
 * PRD-007 Unit D: Request Sanitization & Injection Prevention
 */
public class InjectionAttemptException extends RuntimeException {
    private final String injectionType;

    public InjectionAttemptException(String message) {
        super(message);
        this.injectionType = extractInjectionType(message);
    }

    public InjectionAttemptException(String message, Throwable cause) {
        super(message, cause);
        this.injectionType = extractInjectionType(message);
    }

    public String getInjectionType() {
        return injectionType;
    }

    private static String extractInjectionType(String message) {
        if (message == null) {
            return "unknown";
        }

        if (message.contains("SQL")) {
            return "sql_injection";
        } else if (message.contains("XSS") || message.contains("HTML")) {
            return "xss";
        } else if (message.contains("LDAP")) {
            return "ldap_injection";
        } else if (message.contains("Command")) {
            return "command_injection";
        } else {
            return "unknown";
        }
    }
}
