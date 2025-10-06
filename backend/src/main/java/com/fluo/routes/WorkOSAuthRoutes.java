package com.fluo.routes;

import org.apache.camel.builder.RouteBuilder;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import io.quarkus.runtime.Startup;
import jakarta.annotation.PostConstruct;

/**
 * WorkOS OAuth authentication routes for tenant and role-based security.
 *
 * This configures Camel routes to work with WorkOS SSO for multi-tenant
 * authentication and authorization using extracted processors.
 */
@ApplicationScoped
@Startup
public class WorkOSAuthRoutes extends RouteBuilder {

    // WorkOS OAuth endpoints
    private static final String WORKOS_TOKEN_URL = "https://api.workos.com/sso/token";
    private static final String WORKOS_USER_INFO_URL = "https://api.workos.com/sso/profile";

    // WorkOS configuration (temporary values to be replaced)
    @ConfigProperty(name = "workos.client.id", defaultValue = "client_TEMP_WORKOS_CLIENT_ID")
    String clientId;

    @ConfigProperty(name = "workos.client.secret", defaultValue = "sk_test_TEMP_WORKOS_SECRET_KEY")
    String clientSecret;

    @ConfigProperty(name = "workos.redirect.uri", defaultValue = "http://localhost:8080/api/auth/callback")
    String redirectUri;

    @PostConstruct
    public void initialize() {
        // WorkOS configuration is now handled via properties and HTTP endpoints
        // No special component configuration needed
    }

    @Override
    public void configure() throws Exception {

        // OAuth REST endpoints
        rest("/auth")
            .get("/login")
                .description("Initiate WorkOS OAuth login")
                .to("direct:workosLogin")

            .get("/callback")
                .description("WorkOS OAuth callback")
                .to("direct:workosCallback")

            .get("/logout")
                .description("Logout from WorkOS")
                .to("direct:workosLogout")

            .get("/profile")
                .description("Get user profile with tenant and roles")
                .to("direct:getUserProfile");

        // WorkOS login flow
        from("direct:workosLogin")
            .routeId("workos-login")
            .log("Initiating WorkOS OAuth login")
            .process("workosLoginProcessor")
            .log("Redirecting to WorkOS for authentication");

        // OAuth callback handler
        from("direct:workosCallback")
            .routeId("workos-callback")
            .log("Processing WorkOS OAuth callback")
            .process("workosCallbackProcessor")
            .to("http:" + WORKOS_TOKEN_URL + "?bridgeEndpoint=true")
            .process("workosTokenExtractor")
            .to("direct:extractTenantAndRoles")
            .log("WorkOS authentication successful for tenant: ${header.tenantId}");

        // Extract tenant and roles from WorkOS profile
        from("direct:extractTenantAndRoles")
            .routeId("extract-tenant-roles")
            .log("Extracting tenant and roles from WorkOS profile")
            .process("workosProfileRequestProcessor")
            .to("http:" + WORKOS_USER_INFO_URL + "?bridgeEndpoint=true")
            .process("workosProfileExtractor");

        // Get user profile endpoint
        from("direct:getUserProfile")
            .routeId("get-user-profile")
            .log("Getting user profile")
            .process("workosProfileAuthChecker")
            .to("http:" + WORKOS_USER_INFO_URL + "?bridgeEndpoint=true")
            .to("direct:extractTenantAndRoles");

        // Logout endpoint
        from("direct:workosLogout")
            .routeId("workos-logout")
            .log("Processing logout")
            .process("workosLogoutProcessor")
            .log("User logged out successfully");
    }
}