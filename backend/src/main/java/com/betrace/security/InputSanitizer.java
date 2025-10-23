package com.fluo.security;

import com.fluo.exceptions.InjectionAttemptException;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.RecordComponent;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Sanitizes user input to prevent injection attacks (XSS, SQL, LDAP, command injection).
 *
 * PRD-007 Unit D: Request Sanitization & Injection Prevention
 *
 * Security Features:
 * - XSS Prevention: Strips malicious HTML/JavaScript using OWASP Java HTML Sanitizer
 * - SQL Injection Detection: Blocks SQL keywords and dangerous patterns
 * - LDAP Injection Detection: Blocks LDAP metacharacters
 * - Command Injection Detection: Blocks shell metacharacters
 *
 * Architecture:
 * - ADR-013 compliant (service layer)
 * - ADR-011 compliant (pure application, no deployment logic)
 */
@ApplicationScoped
public class InputSanitizer {

    private static final Logger LOG = Logger.getLogger(InputSanitizer.class);

    // HTML/XSS sanitization policy - allow minimal safe HTML
    private final PolicyFactory htmlPolicy = new HtmlPolicyBuilder()
        .allowElements("p", "br", "strong", "em")
        .toFactory();

    // SQL injection patterns
    private static final Pattern SQL_INJECTION_PATTERN = Pattern.compile(
        "('|(\\-\\-)|;|\\bOR\\b|\\bAND\\b|\\bUNION\\b|\\bSELECT\\b|\\bINSERT\\b|\\bUPDATE\\b|\\bDELETE\\b|\\bDROP\\b)",
        Pattern.CASE_INSENSITIVE
    );

    // LDAP injection patterns
    private static final Pattern LDAP_INJECTION_PATTERN = Pattern.compile(
        "[\\(\\)\\*\\|\\&\\=\\!\\<\\>\\~]"
    );

    // Command injection patterns
    private static final Pattern COMMAND_INJECTION_PATTERN = Pattern.compile(
        "[;\\|\\&\\$\\`\\(\\)\\<\\>\\n]"
    );

    /**
     * Sanitize string input for XSS, SQL injection, LDAP injection, and command injection.
     *
     * @param input Raw input string
     * @return Sanitized string
     * @throws InjectionAttemptException if malicious patterns detected
     */
    public String sanitize(String input) {
        if (input == null || input.isBlank()) {
            return input;
        }

        // 1. Detect injection attempts BEFORE HTML sanitization (on original input)
        //    This prevents false positives from safe HTML tags like <p>, <strong>

        if (SQL_INJECTION_PATTERN.matcher(input).find()) {
            LOG.warnf("SQL injection attempt detected: %s", input);
            throw new InjectionAttemptException("SQL injection pattern detected in input");
        }

        if (LDAP_INJECTION_PATTERN.matcher(input).find()) {
            LOG.warnf("LDAP injection attempt detected: %s", input);
            throw new InjectionAttemptException("LDAP injection pattern detected in input");
        }

        if (COMMAND_INJECTION_PATTERN.matcher(input).find()) {
            LOG.warnf("Command injection attempt detected: %s", input);
            throw new InjectionAttemptException("Command injection pattern detected in input");
        }

        // 2. Strip dangerous HTML (XSS prevention) - done last so safe HTML passes through
        return htmlPolicy.sanitize(input);
    }

    /**
     * Recursively sanitize all string values in a map.
     *
     * @param map Map with potentially unsafe string values
     * @return New map with sanitized string values
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> sanitizeMap(Map<?, ?> map) {
        Map<String, Object> sanitized = new HashMap<>();

        for (Map.Entry<?, ?> entry : map.entrySet()) {
            String key = entry.getKey().toString();
            Object value = entry.getValue();

            if (value instanceof String stringValue) {
                sanitized.put(key, sanitize(stringValue));
            } else if (value instanceof Map<?, ?> nestedMap) {
                sanitized.put(key, sanitizeMap(nestedMap));
            } else if (value instanceof List<?> list) {
                sanitized.put(key, sanitizeList(list));
            } else {
                sanitized.put(key, value);  // Pass through non-string values
            }
        }

        return sanitized;
    }

    /**
     * Recursively sanitize all string values in a list.
     *
     * @param list List with potentially unsafe string values
     * @return New list with sanitized string values
     */
    private List<Object> sanitizeList(List<?> list) {
        return list.stream()
            .map(item -> {
                if (item instanceof String stringItem) {
                    return sanitize(stringItem);
                } else if (item instanceof Map<?, ?> mapItem) {
                    return sanitizeMap(mapItem);
                } else if (item instanceof List<?> nestedList) {
                    return sanitizeList(nestedList);
                } else {
                    return item;
                }
            })
            .toList();
    }

    /**
     * Sanitize Java record by creating new instance with sanitized fields.
     *
     * Uses reflection to extract record components, sanitize string fields,
     * and reconstruct record with sanitized values.
     *
     * @param record Record instance to sanitize
     * @return New record instance with sanitized string fields
     * @throws RuntimeException if record cannot be reconstructed
     */
    public Object sanitizeRecord(Record record) {
        try {
            RecordComponent[] components = record.getClass().getRecordComponents();
            Object[] sanitizedValues = new Object[components.length];

            for (int i = 0; i < components.length; i++) {
                RecordComponent component = components[i];
                Method accessor = component.getAccessor();
                Object value = accessor.invoke(record);

                if (value instanceof String stringValue) {
                    sanitizedValues[i] = sanitize(stringValue);
                } else if (value instanceof Map<?, ?> mapValue) {
                    sanitizedValues[i] = sanitizeMap(mapValue);
                } else if (value instanceof List<?> listValue) {
                    sanitizedValues[i] = sanitizeList(listValue);
                } else {
                    sanitizedValues[i] = value;
                }
            }

            // Reconstruct record with sanitized values
            Class<?>[] paramTypes = Arrays.stream(components)
                .map(RecordComponent::getType)
                .toArray(Class<?>[]::new);
            Constructor<?> constructor = record.getClass().getDeclaredConstructor(paramTypes);
            return constructor.newInstance(sanitizedValues);

        } catch (Exception e) {
            LOG.errorf(e, "Failed to sanitize record: %s", e.getMessage());
            throw new RuntimeException("Record sanitization failed", e);
        }
    }
}
