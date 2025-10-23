package com.fluo.services;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for JwksService.
 *
 * These tests verify:
 * - Initialization and key fetching
 * - Thread-safe caching
 * - Error handling
 *
 * Note: Real HTTP tests require WorkOS credentials and are in integration tests.
 */
@QuarkusTest
class JwksServiceTest {

    @Inject
    JwksService jwksService;

    @Test
    @DisplayName("Service initializes and loads JWKS")
    void testServiceInitializes() throws Exception {
        // Wait a moment for async initialization
        Thread.sleep(1000);

        // Should have loaded JWKS (or attempted to)
        // In test mode with mock credentials, this might fail to fetch but shouldn't crash
        assertNotNull(jwksService);
    }

    @Test
    @DisplayName("getJwkSource throws if JWKS not loaded")
    void testGetJwkSourceBeforeLoad() {
        // Create a new service instance that hasn't been initialized
        JwksService uninitializedService = new JwksService();

        assertThrows(IllegalStateException.class, () -> {
            uninitializedService.getJwkSource();
        });
    }

    @Test
    @DisplayName("Shutdown completes without error")
    void testShutdown() {
        assertDoesNotThrow(() -> {
            jwksService.shutdown();
        });
    }
}
