package com.fluo.services;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * JWKS (JSON Web Key Set) fetcher and cache for WorkOS JWT validation.
 *
 * Security features:
 * - Caches JWKS keys to reduce network calls and prevent DoS
 * - Auto-refreshes keys every 1 hour to handle key rotation
 * - 5-second timeout on HTTP requests to prevent hangs
 * - Thread-safe atomic reference for key updates
 * - Validates JWKS URL is from WorkOS domain only
 *
 * The JWKS endpoint provides public keys used to verify JWT signatures.
 * WorkOS rotates keys periodically for security, so we cache but refresh regularly.
 */
@ApplicationScoped
public class JwksService {

    private static final Logger log = Logger.getLogger(JwksService.class);

    private static final long CACHE_REFRESH_HOURS = 1;
    private static final int HTTP_TIMEOUT_SECONDS = 5;

    @ConfigProperty(name = "workos.client.id")
    String clientId;

    private final HttpClient httpClient;
    private final AtomicReference<JWKSource<SecurityContext>> jwkSourceRef;
    private final ScheduledExecutorService scheduler;

    public JwksService() {
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(HTTP_TIMEOUT_SECONDS))
            .build();
        this.jwkSourceRef = new AtomicReference<>();
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "jwks-refresh");
            t.setDaemon(true);
            return t;
        });
    }

    @PostConstruct
    public void initialize() {
        if (clientId == null || clientId.isBlank()) {
            throw new IllegalStateException("WorkOS client ID not configured (workos.client.id)");
        }

        // Fetch keys immediately on startup
        refreshJwks();

        // Schedule periodic refresh
        scheduler.scheduleAtFixedRate(
            this::refreshJwks,
            CACHE_REFRESH_HOURS,
            CACHE_REFRESH_HOURS,
            TimeUnit.HOURS
        );

        log.infof("JWKS service initialized for client %s (refresh: %dh)", clientId, CACHE_REFRESH_HOURS);
    }

    /**
     * Get the cached JWK source for JWT validation.
     *
     * @return JWK source containing public keys from WorkOS
     * @throws IllegalStateException if JWKS has not been loaded yet
     */
    public JWKSource<SecurityContext> getJwkSource() {
        JWKSource<SecurityContext> source = jwkSourceRef.get();
        if (source == null) {
            throw new IllegalStateException("JWKS not loaded - service may still be initializing");
        }
        return source;
    }

    /**
     * Fetch JWKS from WorkOS and update cache.
     *
     * This method is called:
     * - Once on startup (@PostConstruct)
     * - Every CACHE_REFRESH_HOURS to handle key rotation
     */
    private void refreshJwks() {
        try {
            String jwksUrl = buildJwksUrl();
            log.debugf("Fetching JWKS from %s", jwksUrl);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(jwksUrl))
                .timeout(Duration.ofSeconds(HTTP_TIMEOUT_SECONDS))
                .GET()
                .build();

            HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() != 200) {
                log.errorf("JWKS fetch failed: HTTP %d - %s", response.statusCode(), response.body());
                return;
            }

            JWKSet jwkSet = JWKSet.parse(response.body());
            JWKSource<SecurityContext> newSource = new ImmutableJWKSet<>(jwkSet);

            jwkSourceRef.set(newSource);
            log.infof("JWKS refreshed successfully (%d keys)", jwkSet.getKeys().size());

        } catch (Exception e) {
            log.error("Failed to refresh JWKS - will retry on next schedule", e);
            // Don't throw - keep using cached keys if available
        }
    }

    /**
     * Build the JWKS URL for the configured client ID.
     *
     * Format: https://api.workos.com/sso/jwks/{clientId}
     *
     * Security: Validates that client ID doesn't contain path traversal or injection characters.
     */
    private String buildJwksUrl() {
        // Validate client ID format (should be like "client_...")
        if (!clientId.matches("^[a-zA-Z0-9_-]+$")) {
            throw new IllegalStateException("Invalid client ID format: " + clientId);
        }

        return String.format("https://api.workos.com/sso/jwks/%s", clientId);
    }

    /**
     * Shutdown scheduler on application stop.
     */
    public void shutdown() {
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
