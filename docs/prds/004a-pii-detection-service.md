# PRD-004a: PII Detection Service

**Priority:** P0
**Complexity:** Medium
**Unit:** `PIIDetectionService.java`
**Dependencies:** None

## Problem

FLUO needs to detect PII in span attributes before storage to prevent GDPR/HIPAA violations. Currently, `@PII` annotations exist but are not enforced, allowing raw PII to leak into Tempo, Grafana, logs, and tiered storage.

## Architecture Integration

**ADR Compliance:**
- **ADR-011:** No SQL tables - stateless detection service only
- **ADR-015:** Detection occurs before any storage tier write

## Implementation

```java
package com.fluo.services;

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
            !lower.contains("filename") && !lower.contains("display_name")) {
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
```

```java
package com.fluo.model;

/**
 * Types of PII that can be detected in span attributes.
 */
public enum PIIType {
    EMAIL,
    SSN,
    CREDIT_CARD,
    PHONE,
    NAME,
    ADDRESS
}
```

## Testing Requirements (QA - 90% Coverage)

**Unit Tests:**
- `testDetectEmailByPattern()` - Matches "user@example.com"
- `testDetectSSNByPattern()` - Matches "123-45-6789"
- `testDetectCreditCardByPattern()` - Matches "4111-1111-1111-1111"
- `testDetectPhoneByPattern()` - Matches "(555) 123-4567"
- `testDetectEmailByConvention()` - Field name "user_email" detected
- `testDetectSSNByConvention()` - Field name "social_security" detected
- `testDetectNameByConvention()` - Field name "full_name" detected but NOT "username"
- `testMultiplePIIFields()` - Detects multiple fields in single span
- `testNoFalseNegativesForCommonFormats()` - All standard formats caught
- `testAcceptableFalsePositives()` - Over-detection is acceptable
- `testNullAndEmptyValues()` - Skip null/empty values without error
- `testCaseInsensitivity()` - Detects "EMAIL" and "email" equally

**Edge Cases:**
- Unusual email formats (user+tag@domain.co.uk)
- Phone numbers with extensions
- International phone formats
- Field names with underscores, camelCase, kebab-case
- Nested attribute paths (user.contact.email)

## Security Considerations (Security Expert)

**Threat Model:**
- **False Negatives (PII Missed):** CRITICAL - PII leaks to storage
  - Mitigation: Dual strategy (pattern + convention), err on over-detection
- **Regex DoS:** Pattern matching with malicious input causes CPU spike
  - Mitigation: Compiled patterns, no backtracking, timeout on match
- **Field Name Enumeration:** Attacker discovers PII fields via naming patterns
  - Mitigation: Acceptable - field names are not secrets
- **Bypass via Encoding:** Base64/URL-encoded PII bypasses detection
  - Mitigation: Future enhancement, not MVP scope

## Success Criteria

- [ ] Detect EMAIL by pattern (RFC 5322 subset)
- [ ] Detect SSN by pattern (XXX-XX-XXXX)
- [ ] Detect CREDIT_CARD by pattern (16 digits with optional separators)
- [ ] Detect PHONE by pattern (US/Canada formats)
- [ ] Detect PII by field name convention (email, ssn, phone, name, address)
- [ ] False positives acceptable (no false negative tolerance)
- [ ] Pattern compilation cached for performance
- [ ] 90% test coverage

## Files to Create

- `backend/src/main/java/com/fluo/services/PIIDetectionService.java`
- `backend/src/main/java/com/fluo/model/PIIType.java`
- `backend/src/test/java/com/fluo/services/PIIDetectionServiceTest.java`

## Dependencies

**Requires:** None (standalone service)
**Blocks:** PRD-004c (PII Detection Processor needs this service)
