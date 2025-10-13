package com.fluo.exceptions;

import jakarta.persistence.PersistenceException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.sql.SQLSyntaxErrorException;
import java.util.Map;

/**
 * PRD-027 P0 Requirement 3: Error Message Sanitization
 *
 * Maps exceptions to sanitized error responses.
 *
 * Security Principle: Never expose internal system details in error responses.
 *
 * Bad:  "ERROR: column 'admin_password' does not exist in table 'users'"
 * Good: "Invalid SQL syntax"
 *
 * Implementation:
 * 1. Log full exception details internally (for debugging)
 * 2. Return generic error message to client (prevent information disclosure)
 * 3. Map exception types to appropriate HTTP status codes
 *
 * Protected Information:
 * - Database schema (table names, column names)
 * - Stack traces (class names, line numbers)
 * - File paths (/etc/passwd, /var/log/mysql.log)
 * - Internal error codes (JPA error codes, SQL error codes)
 */
@Provider
public class SecurityExceptionMapper implements ExceptionMapper<Exception> {

    private static final Logger LOG = Logger.getLogger(SecurityExceptionMapper.class);

    @Override
    public Response toResponse(Exception exception) {
        // Log full exception details internally for debugging
        // These logs are only accessible to ops team, not end users
        LOG.error("Query execution error", exception);

        // Determine sanitized error message and status code
        String userMessage;
        int statusCode;

        if (exception instanceof SecurityException) {
            // Our custom SecurityException messages are safe to return
            // They don't leak schema details
            userMessage = exception.getMessage();
            statusCode = 400; // Bad Request

        } else if (exception instanceof SQLSyntaxErrorException) {
            // SQL syntax errors leak schema details
            // Bad: "Unknown column 'admin_password' in 'where clause'"
            // Good: "Invalid SQL syntax"
            userMessage = "Invalid SQL syntax";
            statusCode = 400; // Bad Request

        } else if (exception instanceof PersistenceException) {
            // JPA persistence errors can leak:
            // - Table structure
            // - Constraint names
            // - Foreign key relationships
            userMessage = "Database error occurred";
            statusCode = 500; // Internal Server Error

        } else if (exception instanceof IllegalArgumentException) {
            // Validation errors (from @Valid, etc.)
            userMessage = "Invalid request parameters";
            statusCode = 400; // Bad Request

        } else {
            // Generic fallback for unexpected errors
            userMessage = "Query execution failed";
            statusCode = 500; // Internal Server Error
        }

        // Return sanitized error to client
        return Response
                .status(statusCode)
                .entity(Map.of(
                        "error", userMessage,
                        "status", statusCode
                ))
                .build();
    }
}
