package com.betrace.exceptions;

/**
 * Thrown when authentication fails due to invalid credentials or token.
 */
public class AuthenticationException extends Exception {

    public AuthenticationException(String message) {
        super(message);
    }

    public AuthenticationException(String message, Throwable cause) {
        super(message, cause);
    }
}
