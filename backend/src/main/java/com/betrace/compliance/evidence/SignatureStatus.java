package com.fluo.compliance.evidence;

/**
 * Status of cryptographic signature on ComplianceSpan (PRD-003).
 *
 * <p>Signature status indicates integrity guarantee level:</p>
 * <ul>
 *   <li>{@link #SIGNED}: Span signed with Ed25519, tamper-evident</li>
 *   <li>{@link #UNSIGNED}: Span created before signature feature</li>
 *   <li>{@link #SIGNING_FAILED}: Attempted signing but KMS error occurred</li>
 *   <li>{@link #LEGACY}: Historical span from before PRD-003 deployment</li>
 * </ul>
 *
 * @see ComplianceSpan#sign
 * @see ComplianceSpan#verify
 */
public enum SignatureStatus {
    /**
     * Span successfully signed with Ed25519 signature.
     * Tamper-evident - any modification invalidates signature.
     */
    SIGNED,

    /**
     * Span not signed (created before signature feature enabled).
     * No integrity guarantee, but evidence still valid for compliance.
     */
    UNSIGNED,

    /**
     * Signing attempted but failed (e.g., KMS unavailable).
     * Fail-open: span still emitted for availability, but flagged.
     */
    SIGNING_FAILED,

    /**
     * Historical span created before PRD-003 signature feature.
     * Distinguished from UNSIGNED for audit clarity.
     */
    LEGACY
}
