package com.fluo.compliance;

import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.EdECPrivateKeySpec;
import java.security.spec.EdECPublicKeySpec;
import java.security.spec.NamedParameterSpec;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;
import java.util.UUID;
import java.time.Instant;

/**
 * Cryptographic signing service for ComplianceSpan evidence integrity.
 *
 * Implements Ed25519 digital signatures to provide tamper-evident audit trails
 * for SOC2/HIPAA compliance. Each span is signed with the tenant's private key,
 * enabling external auditors to verify evidence integrity using public keys.
 *
 * Security Properties:
 * - Ed25519: 128-bit security level, deterministic signatures
 * - Per-tenant key isolation: Each tenant has unique signing keys
 * - Fail-open: Unsigned spans allowed if signing fails (availability > integrity)
 * - Key rotation: Support 2 active keys per tenant (current + previous)
 *
 * Compliance:
 * - SOC2 CC6.1: Logical Access Controls (prevent unauthorized modifications)
 * - SOC2 CC8.1: Change Management (detect unauthorized changes)
 * - HIPAA 164.312(b): Audit Controls (protect against improper alteration)
 *
 * @see <a href="https://docs.fluo.com/prds/PRD-003-compliance-span-signing">PRD-003</a>
 */
@ApplicationScoped
public class ComplianceSpanSigner {

    private static final Logger LOG = LoggerFactory.getLogger(ComplianceSpanSigner.class);

    private static final String ALGORITHM = "Ed25519";
    private static final String SIGNATURE_STATUS_SIGNED = "signed";
    private static final String SIGNATURE_STATUS_FAILED = "signing_failed";
    private static final String SIGNATURE_STATUS_LEGACY = "legacy";

    /**
     * Sign a compliance span using Ed25519 digital signature.
     *
     * Creates a deterministic signature over the span's canonical representation:
     * - traceId + spanId + tenantId + framework + control + evidenceType + timestamp
     *
     * Performance: <5ms p99 latency (target)
     *
     * @param spanData Canonical span data to sign (all fields concatenated)
     * @param tenantId Tenant ID for key isolation
     * @return Base64-encoded Ed25519 signature, or null if signing fails
     */
    public String signSpan(String spanData, String tenantId) {
        if (spanData == null || tenantId == null) {
            LOG.warn("Cannot sign span: spanData or tenantId is null");
            return null;
        }

        try {
            // Get tenant's Ed25519 private key
            PrivateKey privateKey = getTenantSigningKey();
            if (privateKey == null) {
                LOG.error("No signing key found for tenant {}", tenantId);
                return null;
            }

            // Sign the span data
            Signature signature = Signature.getInstance(ALGORITHM);
            signature.initSign(privateKey);
            signature.update(spanData.getBytes(StandardCharsets.UTF_8));
            byte[] signatureBytes = signature.sign();

            // Encode as base64 for storage/transmission
            String signatureBase64 = Base64.getEncoder().encodeToString(signatureBytes);

            LOG.debug("Signed span for tenant {} (signature length: {} bytes)", tenantId, signatureBytes.length);
            return signatureBase64;

        } catch (NoSuchAlgorithmException e) {
            LOG.error("Ed25519 algorithm not available - this should never happen in Java 15+", e);
            return null;
        } catch (InvalidKeyException e) {
            LOG.error("Invalid signing key for tenant {}", tenantId, e);
            return null;
        } catch (SignatureException e) {
            LOG.error("Signature generation failed for tenant {}", tenantId, e);
            return null;
        }
    }

    /**
     * Verify a compliance span signature using Ed25519.
     *
     * Used by external auditors to validate evidence integrity.
     *
     * @param spanData Canonical span data (same format as signing)
     * @param signatureBase64 Base64-encoded signature to verify
     * @param tenantId Tenant ID
     * @return true if signature is valid, false otherwise
     */
    public boolean verifySignature(String spanData, String signatureBase64, String tenantId) {
        if (spanData == null || signatureBase64 == null || tenantId == null) {
            LOG.warn("Cannot verify signature: missing required parameters");
            return false;
        }

        try {
            // Get tenant's Ed25519 public key
            PublicKey publicKey = getTenantPublicKey(tenantId);
            if (publicKey == null) {
                LOG.error("No public key found for tenant {}", tenantId);
                return false;
            }

            // Decode signature from base64
            byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);

            // Verify the signature
            Signature signature = Signature.getInstance(ALGORITHM);
            signature.initVerify(publicKey);
            signature.update(spanData.getBytes(StandardCharsets.UTF_8));
            boolean valid = signature.verify(signatureBytes);

            if (!valid) {
                LOG.warn("Signature verification failed for tenant {} - possible tampering", tenantId);
            }

            return valid;

        } catch (NoSuchAlgorithmException e) {
            LOG.error("Ed25519 algorithm not available", e);
            return false;
        } catch (InvalidKeyException e) {
            LOG.error("Invalid public key for tenant {}", tenantId, e);
            return false;
        } catch (SignatureException e) {
            LOG.error("Signature verification failed for tenant {}", tenantId, e);
            return false;
        } catch (IllegalArgumentException e) {
            LOG.error("Invalid base64 signature for tenant {}", tenantId, e);
            return false;
        }
    }

    /**
     * Generate canonical span data for signing.
     *
     * Format: traceId|spanId|tenantId|framework|control|evidenceType|timestamp
     *
     * This ensures consistent signature input across all implementations.
     *
     * @param traceId OpenTelemetry trace ID
     * @param spanId OpenTelemetry span ID
     * @param tenantId Tenant UUID
     * @param framework Compliance framework (e.g., "soc2", "hipaa")
     * @param control Control ID (e.g., "CC6.1", "164.312(b)")
     * @param evidenceType Evidence type (e.g., "audit_trail", "access_log")
     * @param timestamp ISO-8601 timestamp
     * @return Canonical span data string
     */
    public String buildCanonicalSpanData(
            String traceId,
            String spanId,
            String tenantId,
            String framework,
            String control,
            String evidenceType,
            Instant timestamp
    ) {
        return String.join("|",
            traceId != null ? traceId : "",
            spanId != null ? spanId : "",
            tenantId != null ? tenantId : "",
            framework != null ? framework : "",
            control != null ? control : "",
            evidenceType != null ? evidenceType : "",
            timestamp != null ? timestamp.toString() : ""
        );
    }

    /**
     * Get tenant's Ed25519 private key for signing.
     *
     * TODO: Integrate with PRD-006a KMS for key management
     * Current implementation generates ephemeral keys for testing.
     *
     * @return Ed25519 private key, or null if not found
     */
    private PrivateKey getTenantSigningKey() {
        // TODO: Load from KMS (PRD-006a integration)
        // For now, generate ephemeral key for testing
        try {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance(ALGORITHM);
            KeyPair keyPair = keyGen.generateKeyPair();
            return keyPair.getPrivate();
        } catch (NoSuchAlgorithmException e) {
            LOG.error("Ed25519 not available", e);
            return null;
        }
    }

    /**
     * Get tenant's Ed25519 public key for verification.
     *
     * TODO: Load from KMS or public key registry
     * Current implementation generates ephemeral keys for testing.
     *
     * @param tenantId Tenant ID
     * @return Ed25519 public key, or null if not found
     */
    private PublicKey getTenantPublicKey(String tenantId) {
        // TODO: Load from KMS or public key registry (PRD-006a integration)
        // For now, generate ephemeral key for testing
        try {
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance(ALGORITHM);
            KeyPair keyPair = keyGen.generateKeyPair();
            return keyPair.getPublic();
        } catch (NoSuchAlgorithmException e) {
            LOG.error("Ed25519 not available", e);
            return null;
        }
    }

    /**
     * Generate signature status for span attributes.
     *
     * @param signatureSuccess True if signing succeeded
     * @return "signed" or "signing_failed"
     */
    public String getSignatureStatus(boolean signatureSuccess) {
        return signatureSuccess ? SIGNATURE_STATUS_SIGNED : SIGNATURE_STATUS_FAILED;
    }

    /**
     * Get legacy signature status for pre-existing spans.
     *
     * @return "legacy"
     */
    public String getLegacySignatureStatus() {
        return SIGNATURE_STATUS_LEGACY;
    }
}
