package com.fluo.security;

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

    @ConfigProperty(name = "auth.signature.secret", defaultValue = "CHANGE_ME_IN_PRODUCTION")
    String signatureSecret;

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
     *
     * @param tenantId Tenant ID to verify
     * @param roles User roles to verify
     * @param expectedSignature Signature from upstream processor
     * @return true if signature is valid, false otherwise
     */
    public boolean verifyAuthContext(UUID tenantId, List<String> roles, String expectedSignature) {
        try {
            String actualSignature = signAuthContext(tenantId, roles);
            return constantTimeCompare(actualSignature, expectedSignature);

        } catch (Exception e) {
            log.warn("Signature verification failed", e);
            return false;
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
     * This implementation always compares full strings regardless of mismatch position.
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

        int result = 0;
        for (int i = 0; i < aBytes.length; i++) {
            result |= aBytes[i] ^ bBytes[i];
        }

        return result == 0;
    }
}
