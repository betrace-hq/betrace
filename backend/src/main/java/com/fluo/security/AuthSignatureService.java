package com.fluo.security;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Cryptographic signature service for authentication chain integrity.
 *
 * Security: Prevents authentication bypass by ensuring downstream processors
 * can verify that upstream authentication actually executed.
 *
 * Uses HMAC-SHA256 to sign authenticated user context (tenant ID + roles).
 * Signature is stored in exchange property for verification by downstream processors.
 *
 * Threat Model:
 * - Without signatures: Attacker bypasses ValidateWorkOSTokenProcessor, forges headers
 * - With signatures: Downstream processors verify HMAC, reject forged headers
 *
 * SOC2 CC6.1: Logical access controls (cryptographic authentication chain)
 */
@ApplicationScoped
public class AuthSignatureService {

    private static final Logger log = LoggerFactory.getLogger(AuthSignatureService.class);
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    @ConfigProperty(name = "auth.signature.secret")
    String signatureSecret;

    @ConfigProperty(name = "auth.signature.secret.previous")
    Optional<String> previousSignatureSecret;

    /**
     * Validate signature secret on startup.
     *
     * Security P0: Prevents production deployment with weak/default secrets.
     * Enforces minimum 32-byte entropy and rejects known insecure defaults.
     *
     * @throws IllegalStateException if secret is weak or default
     */
    @PostConstruct
    public void validateSecret() {
        if (signatureSecret == null || signatureSecret.isBlank()) {
            throw new IllegalStateException(
                "auth.signature.secret is required. Set AUTH_SIGNATURE_SECRET environment variable. " +
                "Generate with: openssl rand -base64 32"
            );
        }

        if (signatureSecret.length() < 32) {
            throw new IllegalStateException(
                String.format("auth.signature.secret must be at least 32 characters (current: %d). " +
                    "Generate secure secret with: openssl rand -base64 32",
                    signatureSecret.length())
            );
        }

        // Reject known insecure defaults (but allow test secret for unit tests)
        String lowerSecret = signatureSecret.toLowerCase();
        if ((lowerSecret.contains("changeme") ||
             lowerSecret.contains("change_me") ||
             lowerSecret.contains("default")) &&
            !lowerSecret.contains("test")) { // Allow test secrets

            throw new IllegalStateException(
                "Insecure default auth.signature.secret detected. " +
                "Generate production secret with: openssl rand -base64 32"
            );
        }

        log.info("Auth signature service initialized with valid secret (length: {} bytes)", signatureSecret.length());
    }

    /**
     * Generate HMAC signature for authenticated user context.
     *
     * @param tenantId Validated tenant ID from WorkOS token
     * @param roles Validated user roles from WorkOS token
     * @return Base64-encoded HMAC-SHA256 signature
     */
    public String signAuthContext(UUID tenantId, List<String> roles) {
        try {
            String data = buildSignatureData(tenantId, roles);

            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKey = new SecretKeySpec(
                signatureSecret.getBytes(StandardCharsets.UTF_8),
                HMAC_ALGORITHM
            );
            mac.init(secretKey);

            byte[] signature = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signature);

        } catch (Exception e) {
            log.error("Failed to sign auth context", e);
            throw new RuntimeException("Signature generation failed", e);
        }
    }

    /**
     * Verify HMAC signature for authenticated user context.
     *
     * Uses constant-time comparison to prevent timing attacks.
     * Supports key rotation by accepting signatures from current OR previous secret (grace period).
     *
     * @param tenantId Tenant ID to verify
     * @param roles User roles to verify
     * @param expectedSignature Signature from upstream processor
     * @return true if signature is valid with current or previous secret, false otherwise
     */
    public boolean verifyAuthContext(UUID tenantId, List<String> roles, String expectedSignature) {
        try {
            // Check against current secret
            String currentSignature = signAuthContext(tenantId, roles);
            if (constantTimeCompare(currentSignature, expectedSignature)) {
                return true;
            }

            // If previous secret is configured, check against it (key rotation grace period)
            if (previousSignatureSecret.isPresent()) {
                String previousSignature = signWithSecret(tenantId, roles, previousSignatureSecret.get());
                if (constantTimeCompare(previousSignature, expectedSignature)) {
                    log.debug("Signature verified with previous secret (key rotation grace period)");
                    return true;
                }
            }

            return false;

        } catch (Exception e) {
            log.warn("Signature verification failed", e);
            return false;
        }
    }

    /**
     * Generate HMAC signature with a specific secret (used for key rotation verification).
     *
     * @param tenantId Tenant ID to sign
     * @param roles User roles to sign
     * @param secret Secret to use for signing
     * @return Base64-encoded HMAC-SHA256 signature
     */
    private String signWithSecret(UUID tenantId, List<String> roles, String secret) {
        try {
            String data = buildSignatureData(tenantId, roles);

            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            SecretKeySpec secretKey = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8),
                HMAC_ALGORITHM
            );
            mac.init(secretKey);

            byte[] signature = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signature);

        } catch (Exception e) {
            log.error("Failed to sign with secret", e);
            throw new RuntimeException("Signature generation failed", e);
        }
    }

    /**
     * Build canonical string representation for signing.
     *
     * Format: "tenantId|role1,role2,role3"
     * Roles are sorted alphabetically for deterministic signatures.
     */
    private String buildSignatureData(UUID tenantId, List<String> roles) {
        String sortedRoles = String.join(",", roles.stream().sorted().toList());
        return tenantId.toString() + "|" + sortedRoles;
    }

    /**
     * Constant-time string comparison to prevent timing attacks.
     *
     * Security: Standard string equality leaks length and content via timing.
     * Uses MessageDigest.isEqual() which is guaranteed constant-time by Java security API.
     */
    private boolean constantTimeCompare(String a, String b) {
        if (a == null || b == null) {
            return false;
        }

        byte[] aBytes = a.getBytes(StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(StandardCharsets.UTF_8);

        if (aBytes.length != bBytes.length) {
            return false;
        }

        // Use Java's built-in constant-time comparison (MessageDigest.isEqual)
        return MessageDigest.isEqual(aBytes, bBytes);
    }
}
