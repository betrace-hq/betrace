package com.betrace.health;

import com.betrace.kms.KeyManagementService;
import io.quarkus.logging.Log;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.HealthCheckResponseBuilder;
import org.eclipse.microprofile.health.Readiness;

import java.util.Map;

/**
 * KMS Health Check (PRD-006 P0 Blocker - SRE Observability).
 *
 * Purpose:
 * - Verifies KMS connectivity and operation capability
 * - Integrates with Kubernetes readiness probe
 * - Allows support team to diagnose KMS configuration remotely
 *
 * Health Check Logic:
 * 1. Attempt to generate a test data key from KMS
 * 2. If successful: Service is READY (can serve traffic)
 * 3. If failed: Service is NOT READY (remove from load balancer)
 *
 * Why Readiness (not Liveness):
 * - KMS failures are external, not application crashes
 * - Readiness probe removes pod from service during KMS outage
 * - Liveness probe would cause pod restart (won't fix external KMS issue)
 *
 * Kubernetes Integration:
 * ```yaml
 * readinessProbe:
 *   httpGet:
 *     path: /q/health/ready
 *     port: 8080
 *   initialDelaySeconds: 5
 *   periodSeconds: 10
 * ```
 *
 * Compliance:
 * - SOC2 CC7.1: System monitoring
 * - SOC2 CC7.2: Detection of anomalies
 *
 * @see KeyManagementService
 */
@Readiness
@ApplicationScoped
public class KmsHealthCheck implements HealthCheck {

    @Inject
    KeyManagementService kms;

    @ConfigProperty(name = "kms.provider", defaultValue = "local")
    String kmsProvider;

    @Override
    public HealthCheckResponse call() {
        HealthCheckResponseBuilder builder = HealthCheckResponse.named("kms");

        try {
            // Test KMS connectivity by generating a test data key
            var encryptionContext = Map.of(
                "purpose", "health_check",
                "timestamp", String.valueOf(System.currentTimeMillis())
            );

            long startTime = System.currentTimeMillis();
            var dataKey = kms.generateDataKey("AES_256", encryptionContext);
            long elapsed = System.currentTimeMillis() - startTime;

            // Verify data key is valid
            if (dataKey.plaintextKey() == null || dataKey.plaintextKey().length != 32) {
                Log.warnf("KMS health check failed: Invalid data key length (expected 32 bytes, got %d)",
                    dataKey.plaintextKey() != null ? dataKey.plaintextKey().length : 0);
                return builder
                    .down()
                    .withData("provider", kmsProvider)
                    .withData("error", "Invalid data key length")
                    .build();
            }

            // Zero out test key (security best practice)
            dataKey.zeroPlaintextKey();

            Log.debugf("KMS health check passed (provider=%s, latency=%dms)", kmsProvider, elapsed);

            return builder
                .up()
                .withData("provider", kmsProvider)
                .withData("latency_ms", elapsed)
                .withData("status", "operational")
                .build();

        } catch (KeyManagementService.KmsException e) {
            Log.errorf(e, "KMS health check failed (provider=%s): %s", kmsProvider, e.getMessage());

            return builder
                .down()
                .withData("provider", kmsProvider)
                .withData("error", e.getMessage())
                .withData("error_type", e.getClass().getSimpleName())
                .withData("help_url", "https://docs.fluo.dev/setup/kms-troubleshooting")
                .build();

        } catch (Exception e) {
            Log.errorf(e, "KMS health check encountered unexpected error (provider=%s)", kmsProvider);

            return builder
                .down()
                .withData("provider", kmsProvider)
                .withData("error", "Unexpected error: " + e.getMessage())
                .withData("error_type", e.getClass().getSimpleName())
                .build();
        }
    }
}
