package com.fluo.compliance.evidence;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * Cryptographic signer for compliance spans.
 *
 * <p>Generates HMAC-SHA256 signatures for tamper-evident compliance evidence.
 * Each signature covers: framework, control, tenantId, timestamp, result, and attributes.</p>
 *
 * <p>Security: Signatures prove that compliance evidence has not been modified after creation.
 * This is required for SOC2 CC8.1 (Change Management) and HIPAA 164.312(c)(2) (Integrity Controls).</p>
 *
 * @see ComplianceSpan#verifySignature(byte[])
 */
public final class ComplianceSpanSigner {

    private static final String HMAC_SHA256 = "HmacSHA256";

    private ComplianceSpanSigner() {
        // Utility class - no instantiation
    }

    /**
     * Generate HMAC-SHA256 signature for a compliance span.
     *
     * <p>Canonical payload format:</p>
     * <pre>
     * framework|control|evidenceType|traceId|spanId|parentSpanId|timestamp|result|duration|error|attributes
     * </pre>
     *
     * @param span The compliance span to sign
     * @param signingKey Tenant-specific signing key (from KMS, 32+ bytes recommended)
     * @return Base64-encoded HMAC-SHA256 signature
     * @throws IllegalArgumentException if signingKey is null or empty
     * @throws RuntimeException if cryptographic operations fail
     */
    public static String sign(ComplianceSpan span, byte[] signingKey) {
        if (signingKey == null || signingKey.length == 0) {
            throw new IllegalArgumentException("Signing key cannot be null or empty");
        }

        String canonicalPayload = buildCanonicalPayload(span);

        try {
            Mac hmac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec keySpec = new SecretKeySpec(signingKey, HMAC_SHA256);
            hmac.init(keySpec);

            byte[] signatureBytes = hmac.doFinal(canonicalPayload.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signatureBytes);

        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("HMAC-SHA256 algorithm not available", e);
        } catch (InvalidKeyException e) {
            throw new RuntimeException("Invalid signing key", e);
        }
    }

    /**
     * Build canonical string representation of compliance span for signing.
     *
     * <p>Order matters for signature verification. All fields are included,
     * with null values represented as empty strings.</p>
     */
    private static String buildCanonicalPayload(ComplianceSpan span) {
        StringBuilder payload = new StringBuilder();

        // Core compliance fields
        payload.append(span.framework).append('|');
        payload.append(span.control).append('|');
        payload.append(span.evidenceType).append('|');

        // Trace correlation
        payload.append(span.traceId).append('|');
        payload.append(span.spanId).append('|');
        payload.append(span.parentSpanId != null ? span.parentSpanId : "").append('|');

        // Temporal + outcome
        payload.append(span.timestamp.toEpochMilli()).append('|');
        payload.append(span.result).append('|');
        payload.append(span.duration != null ? span.duration.toMillis() : "").append('|');
        payload.append(span.error != null ? span.error : "").append('|');

        // Attributes (sorted keys for deterministic output)
        span.attributes.entrySet().stream()
            .sorted((a, b) -> a.getKey().compareTo(b.getKey()))
            .forEach(entry -> {
                payload.append(entry.getKey()).append('=').append(entry.getValue()).append(';');
            });

        return payload.toString();
    }
}
