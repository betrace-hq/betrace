package com.fluo.processors.security;

import com.fluo.security.InputSanitizer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.Map;

/**
 * Camel processor that sanitizes request bodies to prevent injection attacks.
 *
 * PRD-007 Unit D: Request Sanitization & Injection Prevention
 *
 * Processing Logic:
 * - String bodies: Sanitize for XSS/SQL/LDAP/command injection
 * - Map bodies: Recursively sanitize all string values
 * - Record bodies: Reconstruct record with sanitized fields
 *
 * Architecture:
 * - ADR-013 compliant (Camel processor for HTTP boundary)
 * - ADR-014 compliant (Named CDI bean for testability)
 */
@Named("inputSanitizerProcessor")
@ApplicationScoped
public class InputSanitizerProcessor implements Processor {

    @Inject
    InputSanitizer sanitizer;

    @Override
    public void process(Exchange exchange) throws Exception {
        Object body = exchange.getIn().getBody();

        if (body == null) {
            return;  // No body to sanitize
        }

        if (body instanceof String stringBody) {
            String sanitized = sanitizer.sanitize(stringBody);
            exchange.getIn().setBody(sanitized);
        } else if (body instanceof Map<?, ?> mapBody) {
            Map<String, Object> sanitized = sanitizer.sanitizeMap(mapBody);
            exchange.getIn().setBody(sanitized);
        } else if (body instanceof Record record) {
            Object sanitized = sanitizer.sanitizeRecord(record);
            exchange.getIn().setBody(sanitized);
        }
        // Other types pass through unchanged (numbers, UUIDs, etc.)
    }
}
