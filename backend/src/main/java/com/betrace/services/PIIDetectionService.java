package com.betrace.services;

import com.betrace.model.PIIType;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Detects PII in span attributes using pattern and convention-based detection.
 * False positives are acceptable - better to over-redact than leak PII.
 */
@ApplicationScoped
public class PIIDetectionService {

    // PII Regex Patterns (compiled once for performance)
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern SSN_PATTERN = Pattern.compile(
        "\\d{3}-\\d{2}-\\d{4}"
    );

    private static final Pattern CREDIT_CARD_PATTERN = Pattern.compile(
        "\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}"
    );

    private static final Pattern PHONE_PATTERN = Pattern.compile(
        "\\(?\\d{3}\\)?[- ]?\\d{3}[- ]?\\d{4}"
    );

    /**
     * Detect PII in span attributes using pattern matching and naming conventions.
     *
     * @param attributes Span attributes to scan
     * @return Map of field names to detected PII types
     */
    public Map<String, PIIType> detectPII(Map<String, Object> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return Map.of();
        }

        Map<String, PIIType> piiFields = new HashMap<>();

        for (Map.Entry<String, Object> entry : attributes.entrySet()) {
            String fieldName = entry.getKey();
            String fieldValue = String.valueOf(entry.getValue());

            // Skip null/empty values
            if (fieldValue == null || fieldValue.isEmpty() || fieldValue.equals("null")) {
                continue;
            }

            // Strategy 1: Pattern-based detection (high confidence)
            PIIType detectedByPattern = detectByPattern(fieldValue);
            if (detectedByPattern != null) {
                piiFields.put(fieldName, detectedByPattern);
                Log.debugf("Detected PII by pattern: field=%s type=%s", fieldName, detectedByPattern);
                continue;
            }

            // Strategy 2: Convention-based detection (field name heuristics)
            PIIType detectedByConvention = detectByConvention(fieldName);
            if (detectedByConvention != null) {
                piiFields.put(fieldName, detectedByConvention);
                Log.debugf("Detected PII by convention: field=%s type=%s", fieldName, detectedByConvention);
            }
        }

        if (!piiFields.isEmpty()) {
            Log.infof("Detected %d PII fields in span attributes", piiFields.size());
        }

        return piiFields;
    }

    /**
     * Detect PII by pattern matching against known formats.
     */
    private PIIType detectByPattern(String value) {
        if (EMAIL_PATTERN.matcher(value).matches()) {
            return PIIType.EMAIL;
        }

        if (SSN_PATTERN.matcher(value).matches()) {
            return PIIType.SSN;
        }

        if (CREDIT_CARD_PATTERN.matcher(value).matches()) {
            return PIIType.CREDIT_CARD;
        }

        if (PHONE_PATTERN.matcher(value).matches()) {
            return PIIType.PHONE;
        }

        return null;
    }

    /**
     * Detect PII by field name conventions.
     * False positives acceptable - better to over-redact than leak.
     */
    private PIIType detectByConvention(String fieldName) {
        String lower = fieldName.toLowerCase();

        // Email detection
        if (lower.contains("email") || lower.contains("e-mail") || lower.contains("e_mail")) {
            return PIIType.EMAIL;
        }

        // SSN detection
        if (lower.contains("ssn") || lower.contains("social_security") ||
            lower.contains("social-security") || lower.contains("socialsecurity")) {
            return PIIType.SSN;
        }

        // Phone detection
        if (lower.contains("phone") || lower.contains("mobile") ||
            lower.contains("telephone") || lower.contains("cell")) {
            return PIIType.PHONE;
        }

        // Credit card detection
        if (lower.contains("credit_card") || lower.contains("creditcard") ||
            lower.contains("card_number") || lower.contains("cardnumber") ||
            lower.contains("pan")) {
            return PIIType.CREDIT_CARD;
        }

        // Name detection (exclude username, hostname, etc.)
        if ((lower.contains("name") || lower.contains("full_name") || lower.contains("fullname")) &&
            !lower.contains("username") && !lower.contains("hostname") &&
            !lower.contains("filename") && !lower.contains("display_name") &&
            !lower.contains("_name_")) {  // Exclude fields like "user_name_field"
            return PIIType.NAME;
        }

        // Address detection
        if (lower.contains("address") || lower.contains("street") ||
            lower.contains("city") || lower.contains("zip") || lower.contains("postal")) {
            return PIIType.ADDRESS;
        }

        return null;
    }
}
