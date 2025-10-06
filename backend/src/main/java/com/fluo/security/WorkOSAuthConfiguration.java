package com.fluo.security;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.annotation.PostConstruct;

/**
 * WorkOS OAuth configuration properties for tenant and role-based security.
 *
 * This class holds the configuration properties for WorkOS SSO integration.
 * The actual routes are defined in WorkOSAuthRoutes.
 */
@ApplicationScoped
public class WorkOSAuthConfiguration {

    // WorkOS configuration (temporary values to be replaced)
    @ConfigProperty(name = "workos.client.id", defaultValue = "client_TEMP_WORKOS_CLIENT_ID")
    String clientId;

    @ConfigProperty(name = "workos.client.secret", defaultValue = "sk_test_TEMP_WORKOS_SECRET_KEY")
    String clientSecret;

    @ConfigProperty(name = "workos.redirect.uri", defaultValue = "http://localhost:8080/api/auth/callback")
    String redirectUri;

    @PostConstruct
    public void configureWorkOS() {
        // WorkOS configuration is now handled via properties and HTTP endpoints
        // No special component configuration needed
    }

    // Getters for access by other components
    public String getClientId() {
        return clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public String getRedirectUri() {
        return redirectUri;
    }
}