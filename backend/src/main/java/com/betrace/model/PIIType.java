package com.betrace.model;

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
