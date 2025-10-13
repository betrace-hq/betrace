package com.fluo.compliance.evidence;

/**
 * Types of compliance evidence that can be captured.
 */
public enum EvidenceType {
    /** Audit trail of actions */
    AUDIT_TRAIL,

    /** Log entries */
    LOG,

    /** Metrics and measurements */
    METRIC,

    /** Configuration snapshots */
    CONFIG,

    /** Test results */
    TEST,

    /** Security scan results */
    SCAN,

    /** Certificates and credentials */
    CERTIFICATE,

    /** Documentation and policies */
    DOCUMENTATION,

    /** Security events (injection attempts, failed authentications) - PRD-007 Unit E */
    SECURITY_EVENT
}
