package com.betrace.compliance.evidence;

/**
 * Strategies for redacting sensitive data in compliance evidence.
 */
public enum RedactionStrategy {
    /** Completely exclude field from evidence (alias: REMOVE) */
    EXCLUDE,

    /** Replace value with "&lt;redacted&gt;" placeholder */
    REDACT,

    /** Replace with SHA-256 hash (for correlation without exposing data) */
    HASH,

    /** Show only first and last N characters: "1234...6789" */
    TRUNCATE,

    /** Deterministic token generation (same value + tenant = same token for joins) */
    TOKENIZE,

    /** Partial masking (shows some context, hides sensitive parts) - email: "u***@e***.com" */
    MASK,

    /** Encrypt with evidence key (auditors can decrypt if needed) */
    ENCRYPT
}
