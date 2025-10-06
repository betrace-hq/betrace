package com.fluo.security;

import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Extracted processors from WorkOSAuthRoutes for better testability
 */
public class WorkOSProcessors {

    private static final String WORKOS_AUTHORIZATION_URL = "https://api.workos.com/sso/authorize";
    private static final String WORKOS_TOKEN_URL = "https://api.workos.com/sso/token";
    private static final String WORKOS_USER_INFO_URL = "https://api.workos.com/sso/profile";

    /**
     * Processor for initiating WorkOS OAuth login
     */
    @Named("workosLoginProcessor")
    @ApplicationScoped
    public static class LoginProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            String organizationId = exchange.getIn().getHeader("org_id", String.class);

            // Build authorization URL
            StringBuilder authUrl = new StringBuilder(WORKOS_AUTHORIZATION_URL);
            authUrl.append("?response_type=code");
            authUrl.append("&client_id=").append(exchange.getContext().resolvePropertyPlaceholders("{{workos.client.id}}"));
            authUrl.append("&redirect_uri=").append(exchange.getContext().resolvePropertyPlaceholders("{{workos.redirect.uri}}"));
            authUrl.append("&scope=openid%20profile%20email%20organization");
            if (organizationId != null) {
                authUrl.append("&organization=").append(organizationId);
            }

            // Set redirect response
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 302);
            exchange.getIn().setHeader("Location", authUrl.toString());
            exchange.getIn().setBody(null);
        }
    }

    /**
     * Processor for preparing OAuth callback token request
     */
    @Named("workosCallbackProcessor")
    @ApplicationScoped
    public static class CallbackProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            String code = exchange.getIn().getHeader("code", String.class);
            if (code == null) {
                throw new IllegalArgumentException("No authorization code received");
            }

            // Prepare token exchange request
            Map<String, Object> tokenRequest = new HashMap<>();
            tokenRequest.put("grant_type", "authorization_code");
            tokenRequest.put("code", code);
            tokenRequest.put("client_id", exchange.getContext().resolvePropertyPlaceholders("{{workos.client.id}}"));
            tokenRequest.put("client_secret", exchange.getContext().resolvePropertyPlaceholders("{{workos.client.secret}}"));
            tokenRequest.put("redirect_uri", exchange.getContext().resolvePropertyPlaceholders("{{workos.redirect.uri}}"));

            exchange.getIn().setBody(tokenRequest);
            exchange.getIn().setHeader(Exchange.HTTP_METHOD, "POST");
            exchange.getIn().setHeader(Exchange.CONTENT_TYPE, "application/x-www-form-urlencoded");
        }
    }

    /**
     * Processor for extracting tokens from OAuth response
     */
    @Named("workosTokenExtractor")
    @ApplicationScoped
    public static class TokenExtractorProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            // Extract token from response
            @SuppressWarnings("unchecked")
            Map<String, Object> tokenResponse = exchange.getIn().getBody(Map.class);
            String accessToken = (String) tokenResponse.get("access_token");
            String idToken = (String) tokenResponse.get("id_token");

            // Store tokens in session/headers
            exchange.getIn().setHeader("Authorization", "Bearer " + accessToken);
            exchange.getIn().setHeader("WorkOS-ID-Token", idToken);
            exchange.getIn().setHeader("access_token", accessToken);
        }
    }

    /**
     * Processor for preparing user profile request
     */
    @Named("workosProfileRequestProcessor")
    @ApplicationScoped
    public static class ProfileRequestProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            String accessToken = exchange.getIn().getHeader("access_token", String.class);
            exchange.getIn().setHeader("Authorization", "Bearer " + accessToken);
            exchange.getIn().setHeader(Exchange.HTTP_METHOD, "GET");
            exchange.getIn().setBody(null);
        }
    }

    /**
     * Processor for extracting tenant and roles from WorkOS profile
     */
    @Named("workosProfileExtractor")
    @ApplicationScoped
    public static class ProfileExtractorProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            @SuppressWarnings("unchecked")
            Map<String, Object> profile = exchange.getIn().getBody(Map.class);

            // Extract WorkOS organization (tenant)
            @SuppressWarnings("unchecked")
            Map<String, Object> organization = (Map<String, Object>) profile.get("organization");
            if (organization != null) {
                String tenantId = (String) organization.get("id");
                String tenantName = (String) organization.get("name");
                exchange.getIn().setHeader("tenantId", tenantId);
                exchange.getIn().setHeader("tenantName", tenantName);
            }

            // Extract user roles from WorkOS profile
            @SuppressWarnings("unchecked")
            Map<String, Object> rawAttributes = (Map<String, Object>) profile.get("raw_attributes");
            if (rawAttributes != null) {
                @SuppressWarnings("unchecked")
                List<String> roles = (List<String>) rawAttributes.get("roles");
                exchange.getIn().setHeader("userRoles", roles);

                // Extract user details
                exchange.getIn().setHeader("userId", profile.get("id"));
                exchange.getIn().setHeader("userEmail", profile.get("email"));
                exchange.getIn().setHeader("userName", profile.get("first_name") + " " + profile.get("last_name"));
            }

            // Create security context
            Map<String, Object> securityContext = new HashMap<>();
            securityContext.put("authenticated", true);
            securityContext.put("tenantId", exchange.getIn().getHeader("tenantId", ""));
            securityContext.put("tenantName", exchange.getIn().getHeader("tenantName", ""));
            securityContext.put("userId", exchange.getIn().getHeader("userId", ""));
            securityContext.put("userEmail", exchange.getIn().getHeader("userEmail", ""));
            securityContext.put("userName", exchange.getIn().getHeader("userName", ""));
            securityContext.put("roles", exchange.getIn().getHeader("userRoles", new ArrayList<>()));
            securityContext.put("timestamp", Instant.now().toString());

            exchange.getIn().setBody(securityContext);
        }
    }

    /**
     * Processor for checking user profile authentication
     */
    @Named("workosProfileAuthChecker")
    @ApplicationScoped
    public static class ProfileAuthCheckerProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            // Check if user is authenticated
            String authHeader = exchange.getIn().getHeader("Authorization", String.class);
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                exchange.getIn().setHeader("CamelHttpResponseCode", 401);
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "Unauthorized");
                errorResponse.put("message", "No valid authentication token");
                exchange.getIn().setBody(errorResponse);
            } else {
                exchange.getIn().setHeader(Exchange.HTTP_METHOD, "GET");
                exchange.getIn().setBody(null);
            }
        }
    }

    /**
     * Processor for handling logout
     */
    @Named("workosLogoutProcessor")
    @ApplicationScoped
    public static class LogoutProcessor implements Processor {
        @Override
        public void process(Exchange exchange) throws Exception {
            // Clear authentication headers
            exchange.getIn().removeHeader("Authorization");
            exchange.getIn().removeHeader("WorkOS-ID-Token");
            exchange.getIn().removeHeader("tenantId");
            exchange.getIn().removeHeader("userRoles");

            Map<String, Object> response = new HashMap<>();
            response.put("status", "logged_out");
            response.put("timestamp", Instant.now().toString());
            exchange.getIn().setBody(response);
        }
    }
}