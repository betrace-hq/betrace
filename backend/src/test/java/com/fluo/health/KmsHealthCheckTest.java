package com.fluo.health;

import com.fluo.kms.KeyManagementService;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test KMS Health Check (PRD-006 P0 SRE Observability).
 *
 * Note: We test the health check directly via bean injection rather than
 * via HTTP endpoint to avoid dependency on Quarkus health endpoint configuration.
 */
@QuarkusTest
class KmsHealthCheckTest {

    @Inject
    KeyManagementService kms;

    @Test
    void testHealthCheck_whenKmsOperational_shouldReturnUp() {
        // Given: KMS health check
        KmsHealthCheck healthCheck = new KmsHealthCheck();
        healthCheck.kms = kms;
        healthCheck.kmsProvider = "local";

        // When: Health check is called
        HealthCheckResponse response = healthCheck.call();

        // Then: Should be UP
        assertThat(response.getStatus()).isEqualTo(HealthCheckResponse.Status.UP);
        assertThat(response.getName()).isEqualTo("kms");

        // And: Should include KMS provider info
        assertThat(response.getData()).isPresent();
        assertThat(response.getData().get().get("provider")).isEqualTo("local");
        assertThat(response.getData().get().get("status")).isEqualTo("operational");
        assertThat(response.getData().get().get("latency_ms")).isInstanceOf(Long.class);
    }

    @Test
    void testHealthCheck_whenKmsAvailable_shouldHaveLowLatency() {
        // Given: KMS health check
        KmsHealthCheck healthCheck = new KmsHealthCheck();
        healthCheck.kms = kms;
        healthCheck.kmsProvider = "local";

        // When: Health check is called
        HealthCheckResponse response = healthCheck.call();

        // Then: Latency should be reasonable for local KMS
        assertThat(response.getData()).isPresent();
        Long latencyMs = (Long) response.getData().get().get("latency_ms");
        assertThat(latencyMs)
            .as("KMS health check latency should be <1000ms for local provider")
            .isLessThan(1000L);
    }
}
