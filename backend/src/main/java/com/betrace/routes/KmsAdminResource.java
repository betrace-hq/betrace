package com.betrace.routes;

import com.betrace.kms.KeyManagementService;
import com.betrace.services.KeyCache;
import com.betrace.services.KeyRetrievalService;
import io.quarkus.logging.Log;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Map;
import java.util.UUID;

/**
 * Admin API for KMS validation and management (PRD-006 P0 Error Handling).
 *
 * Purpose:
 * - Pre-flight validation: Test KMS configuration before production deployment
 * - Diagnostic endpoint: Support team can remotely validate KMS setup
 * - Operational visibility: View cache stats, provider info
 *
 * Security:
 * - @PermitAll for now (TODO: Add @RolesAllowed("admin") in production)
 * - Endpoints are read-only or low-risk operations (validation, status)
 *
 * Usage:
 * ```bash
 * # Validate KMS configuration
 * curl -X POST http://localhost:8080/api/admin/kms/validate
 *
 * # Check KMS status
 * curl http://localhost:8080/api/admin/kms/status
 * ```
 *
 * ADR Compliance:
 * - ADR-011 (Pure Application): No deployment-specific logic
 * - ADR-015 (Quality Standards): Operational readiness validation
 */
@Path("/api/admin/kms")
@Produces(MediaType.APPLICATION_JSON)
@PermitAll
public class KmsAdminResource {

    @Inject
    KeyManagementService kms;

    @Inject
    KeyRetrievalService keyRetrieval;

    @Inject
    KeyCache keyCache;

    @ConfigProperty(name = "fluo.kms.provider", defaultValue = "local")
    String kmsProvider;

    /**
     * Validate KMS configuration (pre-flight check).
     *
     * Tests:
     * 1. Data key generation (KMS connectivity + IAM permissions)
     * 2. Encryption (KMS encrypt operation)
     * 3. Decryption (KMS decrypt operation)
     * 4. Key retrieval performance (cache working?)
     *
     * Returns:
     * - Success: All operations passed, ready for production
     * - Failure: Which operations failed + diagnostic recommendations
     *
     * @return KmsValidationResponse with test results
     */
    @POST
    @Path("/validate")
    public KmsValidationResponse validateKmsConfiguration() {
        Log.info("Starting KMS configuration validation");

        var response = new KmsValidationResponse();
        response.provider = kmsProvider;

        // Test 1: Generate data key
        try {
            long startTime = System.currentTimeMillis();
            var context = Map.of(
                "purpose", "validation",
                "timestamp", String.valueOf(System.currentTimeMillis())
            );
            var dataKey = kms.generateDataKey("AES_256", context);

            if (dataKey.plaintextKey() == null || dataKey.plaintextKey().length != 32) {
                response.tests.put("generate_data_key", "FAIL: Invalid key length");
                response.overall = "FAIL";
                response.recommendations.add("KMS returned invalid key length. Check KMS configuration.");
                return response;
            }

            dataKey.zeroPlaintextKey();
            long elapsed = System.currentTimeMillis() - startTime;

            response.tests.put("generate_data_key", "PASS (" + elapsed + "ms)");
            response.latency_ms.put("generate_data_key", elapsed);

        } catch (Exception e) {
            response.tests.put("generate_data_key", "FAIL: " + e.getMessage());
            response.overall = "FAIL";
            response.recommendations.add("Cannot generate data key. Check KMS connectivity and IAM permissions.");
            response.recommendations.add("Documentation: https://docs.fluo.dev/setup/kms-quickstart");
            if (e.getMessage().contains("not authorized") || e.getMessage().contains("AccessDenied")) {
                response.recommendations.add("IAM permissions missing. Required: kms:GenerateDataKey, kms:Encrypt, kms:Decrypt, kms:DescribeKey");
                response.recommendations.add("IAM policy template: https://docs.fluo.dev/setup/aws-kms-iam-policy");
            }
            return response;
        }

        // Test 2: Encrypt
        try {
            long startTime = System.currentTimeMillis();
            var context = Map.of("purpose", "validation_encrypt");
            byte[] plaintext = "test-plaintext-for-validation".getBytes();
            byte[] ciphertext = kms.encrypt(plaintext, context);
            long elapsed = System.currentTimeMillis() - startTime;

            response.tests.put("encrypt", "PASS (" + elapsed + "ms)");
            response.latency_ms.put("encrypt", elapsed);

        } catch (Exception e) {
            response.tests.put("encrypt", "FAIL: " + e.getMessage());
            response.overall = "FAIL";
            response.recommendations.add("Encryption failed. Check kms:Encrypt IAM permission.");
            return response;
        }

        // Test 3: Decrypt
        try {
            long startTime = System.currentTimeMillis();
            var context = Map.of("purpose", "validation_decrypt");
            var dataKey = kms.generateDataKey("AES_256", context);
            byte[] decrypted = kms.decrypt(dataKey.encryptedKey(), context);
            long elapsed = System.currentTimeMillis() - startTime;

            if (decrypted == null || decrypted.length != 32) {
                response.tests.put("decrypt", "FAIL: Invalid decrypted key length");
                response.overall = "FAIL";
                return response;
            }

            dataKey.zeroPlaintextKey();
            response.tests.put("decrypt", "PASS (" + elapsed + "ms)");
            response.latency_ms.put("decrypt", elapsed);

        } catch (Exception e) {
            response.tests.put("decrypt", "FAIL: " + e.getMessage());
            response.overall = "FAIL";
            response.recommendations.add("Decryption failed. Check kms:Decrypt IAM permission.");
            return response;
        }

        // Test 4: Key retrieval performance (cache working?)
        try {
            UUID testTenant = UUID.fromString("00000000-0000-0000-0000-000000000001");

            // First call (cache miss)
            long startTime = System.currentTimeMillis();
            keyRetrieval.getSigningKey(testTenant);
            long missLatency = System.currentTimeMillis() - startTime;

            // Second call (cache hit)
            startTime = System.currentTimeMillis();
            keyRetrieval.getSigningKey(testTenant);
            long hitLatency = System.currentTimeMillis() - startTime;

            response.tests.put("key_retrieval_cache_miss", "PASS (" + missLatency + "ms)");
            response.tests.put("key_retrieval_cache_hit", "PASS (" + hitLatency + "ms)");
            response.latency_ms.put("cache_miss", missLatency);
            response.latency_ms.put("cache_hit", hitLatency);

            // Validate cache performance
            if (hitLatency > 10) {
                response.recommendations.add("Warning: Cache hit latency is " + hitLatency + "ms (expected <10ms). Check cache configuration.");
            }

            // Clean up test key
            keyRetrieval.invalidateTenant(testTenant);

        } catch (Exception e) {
            response.tests.put("key_retrieval", "FAIL: " + e.getMessage());
            response.overall = "FAIL";
            response.recommendations.add("Key retrieval failed. This may indicate KMS adapter issues.");
            return response;
        }

        // All tests passed
        response.overall = "PASS";
        response.recommendations.add("✅ KMS configuration is valid and ready for production");

        if ("local".equals(kmsProvider)) {
            response.recommendations.add("⚠️  WARNING: Using LocalKmsAdapter (development only)");
            response.recommendations.add("⚠️  For production, switch to: fluo.kms.provider=aws");
            response.recommendations.add("⚠️  See: https://docs.fluo.dev/setup/kms-quickstart");
        }

        Log.info("KMS validation complete: " + response.overall);
        return response;
    }

    /**
     * Get KMS operational status.
     *
     * Returns:
     * - KMS provider
     * - Cache statistics (hit rate, size)
     * - Recent performance metrics
     *
     * @return KmsStatusResponse
     */
    @GET
    @Path("/status")
    public KmsStatusResponse getKmsStatus() {
        var response = new KmsStatusResponse();
        response.provider = kmsProvider;

        // Get cache stats
        var stats = keyCache.getStats();
        response.cache_size = (int) stats.totalKeys();
        response.cache_private_keys = (int) stats.privateKeyCount();
        response.cache_public_keys = (int) stats.publicKeyCount();
        response.cache_encryption_keys = (int) stats.encryptionKeyCount();

        // Determine health status
        if ("local".equals(kmsProvider)) {
            response.status = "WARNING";
            response.issues.add("Using LocalKmsAdapter (not production-ready)");
            response.issues.add("Switch to AWS KMS for production: fluo.kms.provider=aws");
        } else {
            response.status = "HEALTHY";
        }

        return response;
    }

    /**
     * KMS validation response.
     */
    public static class KmsValidationResponse {
        public String provider;
        public String overall = "PENDING";
        public java.util.Map<String, String> tests = new java.util.HashMap<>();
        public java.util.Map<String, Long> latency_ms = new java.util.HashMap<>();
        public java.util.List<String> recommendations = new java.util.ArrayList<>();
    }

    /**
     * KMS status response.
     */
    public static class KmsStatusResponse {
        public String provider;
        public String status;
        public int cache_size;
        public int cache_private_keys;
        public int cache_public_keys;
        public int cache_encryption_keys;
        public java.util.List<String> issues = new java.util.ArrayList<>();
    }
}
