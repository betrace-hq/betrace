package com.fluo.compliance.evidence;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/**
 * Enforces PII and sensitive data redaction before evidence export.
 *
 * <p>Security: Prevents accidental PII leakage in OpenTelemetry spans.
 * Required for GDPR Article 32 (Security of Processing) and HIPAA 164.514(b) (De-identification).</p>
 *
 * <p><b>Whitelist Approach:</b> Only explicitly safe attributes are exported.
 * Any attribute not in the whitelist is blocked with warning.</p>
 *
 * @see PII
 * @see Sensitive
 * @see Redact
 */
public final class RedactionEnforcer {

    /**
     * Safe attributes that never contain PII (whitelist).
     * These are always safe to export to OpenTelemetry.
     */
    private static final Set<String> SAFE_ATTRIBUTES = Set.of(
        // Compliance metadata
        "framework",
        "control",
        "evidenceType",
        "result",
        "outcome",

        // Trace correlation
        "traceId",
        "spanId",
        "parentSpanId",

        // Timing
        "timestamp",
        "duration",
        "startTime",
        "endTime",

        // Technical details
        "operation",
        "method",
        "endpoint",
        "statusCode",
        "errorCode",
        "severity",

        // Authorization (not authentication)
        "authorized",
        "role",
        "permission",
        "action",

        // Counts and aggregates
        "count",
        "total",
        "average",
        "rate",

        // Identifiers (non-sensitive)
        "id",
        "requestId",
        "sessionId",
        "correlationId"
    );

    /**
     * Patterns that indicate potential PII (block if not explicitly redacted).
     */
    private static final Set<String> PII_PATTERNS = Set.of(
        "email",
        "phone",
        "ssn",
        "address",
        "name",
        "username",
        "password",
        "token",
        "secret",
        "key",
        "creditCard",
        "dob",
        "birthdate",
        "ip",
        "mac",
        "deviceId",
        "userId",  // Should use hash instead
        "tenantId" // Should use hash instead
    );

    private RedactionEnforcer() {
        // Utility class - no instantiation
    }

    /**
     * Validate and redact attributes before export.
     *
     * <p>Security: Whitelist-based validation prevents accidental PII leakage.
     * Any attribute not in whitelist or properly redacted will be blocked.</p>
     *
     * @param attributes Raw attributes from compliance span
     * @return Validated, redacted attributes safe for export
     * @throws PIILeakageException if unredacted PII detected
     */
    public static Map<String, Object> validateAndRedact(Map<String, Object> attributes) {
        Map<String, Object> safe = new HashMap<>();

        for (Map.Entry<String, Object> entry : attributes.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();

            // Check whitelist first
            if (SAFE_ATTRIBUTES.contains(key)) {
                safe.put(key, value);
                continue;
            }

            // Check if key matches PII pattern
            if (containsPII(key)) {
                throw new PIILeakageException(
                    String.format("Attribute '%s' matches PII pattern but is not whitelisted or redacted. " +
                        "Use @PII or @Redact annotation to explicitly handle sensitive data.", key)
                );
            }

            // Unknown attribute - block with warning
            throw new UnsafeAttributeException(
                String.format("Attribute '%s' is not in whitelist. " +
                    "Add to SAFE_ATTRIBUTES if it never contains PII, " +
                    "or use @PII/@Redact annotation if it does.", key)
            );
        }

        return Collections.unmodifiableMap(safe);
    }

    /**
     * Redact value using specified strategy.
     *
     * @param value Original value
     * @param strategy Redaction strategy
     * @param preserveCount For TRUNCATE strategy
     * @return Redacted value safe for export
     */
    public static Object redact(Object value, RedactionStrategy strategy, int preserveCount) {
        if (value == null) {
            return null;
        }

        String strValue = String.valueOf(value);

        switch (strategy) {
            case EXCLUDE:
                return null; // Completely omit from attributes

            case REDACT:
                return "<redacted>";

            case HASH:
                return hashValue(strValue);

            case TRUNCATE:
                return truncateValue(strValue, preserveCount);

            case ENCRYPT:
                // TODO: Implement encryption with tenant-specific key
                throw new UnsupportedOperationException("ENCRYPT strategy not yet implemented");

            default:
                throw new IllegalArgumentException("Unknown redaction strategy: " + strategy);
        }
    }

    /**
     * Hash value using SHA-256 for correlation without exposing data.
     */
    private static String hashValue(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to hash value", e);
        }
    }

    /**
     * Truncate value showing only first and last N characters.
     */
    private static String truncateValue(String value, int preserve) {
        if (value.length() <= preserve * 2) {
            return "***"; // Too short to truncate meaningfully
        }

        String start = value.substring(0, preserve);
        String end = value.substring(value.length() - preserve);
        return start + "..." + end;
    }

    /**
     * Check if attribute name matches PII pattern.
     */
    private static boolean containsPII(String attributeName) {
        String lower = attributeName.toLowerCase();
        for (String pattern : PII_PATTERNS) {
            if (lower.contains(pattern.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Extract redaction annotations from object and apply redaction.
     *
     * <p>Scans object fields for @PII, @Sensitive, @Redact annotations
     * and applies appropriate redaction strategies.</p>
     *
     * @param obj Object to scan for redaction annotations
     * @return Map of field names to redacted values
     */
    public static Map<String, Object> extractRedactedAttributes(Object obj) {
        if (obj == null) {
            return Collections.emptyMap();
        }

        Map<String, Object> attributes = new HashMap<>();
        Class<?> clazz = obj.getClass();

        for (Field field : clazz.getDeclaredFields()) {
            field.setAccessible(true);

            try {
                Object value = field.get(obj);
                String fieldName = field.getName();

                // Check for @Sensitive annotation
                if (field.isAnnotationPresent(Sensitive.class)) {
                    // Exclude completely - don't add to attributes
                    continue;
                }

                // Check for @PII annotation
                if (field.isAnnotationPresent(PII.class)) {
                    PII pii = field.getAnnotation(PII.class);
                    Object redacted = redact(value, pii.strategy(), 0);
                    if (redacted != null) {
                        attributes.put(fieldName, redacted);
                    }
                    continue;
                }

                // Check for @Redact annotation
                if (field.isAnnotationPresent(Redact.class)) {
                    Redact redactAnnotation = field.getAnnotation(Redact.class);
                    Object redacted = redact(value, redactAnnotation.strategy(), redactAnnotation.preserve());
                    if (redacted != null) {
                        attributes.put(fieldName, redacted);
                    }
                    continue;
                }

                // No annotation - include as-is but validate against whitelist
                if (SAFE_ATTRIBUTES.contains(fieldName)) {
                    attributes.put(fieldName, value);
                } else if (containsPII(fieldName)) {
                    throw new PIILeakageException(
                        String.format("Field '%s' in %s matches PII pattern but is not annotated. " +
                            "Add @PII, @Sensitive, or @Redact annotation.", fieldName, clazz.getSimpleName())
                    );
                }

            } catch (IllegalAccessException e) {
                throw new RuntimeException("Failed to access field: " + field.getName(), e);
            }
        }

        return attributes;
    }

    /**
     * Exception thrown when unredacted PII is detected.
     */
    public static class PIILeakageException extends RuntimeException {
        public PIILeakageException(String message) {
            super(message);
        }
    }

    /**
     * Exception thrown when unsafe attribute is detected.
     */
    public static class UnsafeAttributeException extends RuntimeException {
        public UnsafeAttributeException(String message) {
            super(message);
        }
    }
}
