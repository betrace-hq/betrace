package com.fluo.compliance.evidence;

/**
 * Strategies for redacting sensitive data in compliance evidence.
 */
public enum RedactionStrategy {
    /** Completely exclude field from evidence */
    EXCLUDE,

    /** Replace value with "&lt;redacted&gt;" placeholder */
    REDACT,

    /** Replace with SHA-256 hash (for correlation without exposing data) */
    HASH,

    /** Show only first and last N characters: "1234...6789" */
    TRUNCATE,

    /** Encrypt with evidence key (auditors can decrypt if needed) */
    ENCRYPT
}
