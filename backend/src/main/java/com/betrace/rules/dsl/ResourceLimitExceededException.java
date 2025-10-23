package com.fluo.rules.dsl;

/**
 * Exception thrown when AST interpreter resource limits are exceeded.
 *
 * <p>Resource limits prevent DoS attacks via:</p>
 * <ul>
 *   <li>Deeply nested expressions (stack overflow)</li>
 *   <li>Large span batches (memory exhaustion)</li>
 *   <li>Massive attribute maps (memory exhaustion)</li>
 *   <li>Huge string values (memory exhaustion)</li>
 * </ul>
 *
 * <p>This exception indicates a malicious or malformed rule that should be rejected.</p>
 *
 * @see ASTInterpreter
 */
public class ResourceLimitExceededException extends RuntimeException {

    public ResourceLimitExceededException(String message) {
        super(message);
    }

    public ResourceLimitExceededException(String message, Throwable cause) {
        super(message, cause);
    }
}
