package com.betrace.security;

import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.support.DefaultExchange;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("WorkOSProcessors Tests")
class WorkOSProcessorsTest {

    private CamelContext camelContext;
    private Exchange exchange;

    @BeforeEach
    void setUp() {
        camelContext = new DefaultCamelContext();
        exchange = new DefaultExchange(camelContext);
    }

    @Test
    @DisplayName("LoginProcessor should build authorization URL without org ID")
    void testLoginProcessorWithoutOrgId() throws Exception {
        WorkOSProcessors.LoginProcessor processor = new WorkOSProcessors.LoginProcessor();

        // Set properties on context
        camelContext.getPropertiesComponent().setLocation("classpath:application.properties");
        camelContext.getPropertiesComponent().addOverrideProperty("workos.client.id", "test-client-id");
        camelContext.getPropertiesComponent().addOverrideProperty("workos.redirect.uri", "http://localhost:8080/api/auth/callback");

        processor.process(exchange);

        assertEquals(302, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        String location = exchange.getIn().getHeader("Location", String.class);
        assertNotNull(location);
        assertTrue(location.contains("https://api.workos.com/sso/authorize"));
        assertTrue(location.contains("client_id=test-client-id"));
        assertTrue(location.contains("redirect_uri=http://localhost:8080/api/auth/callback"));
        assertTrue(location.contains("response_type=code"));
        assertTrue(location.contains("scope=openid%20profile%20email%20organization"));
        assertFalse(location.contains("&organization="));
        assertNull(exchange.getIn().getBody());
    }

    @Test
    @DisplayName("LoginProcessor should build authorization URL with org ID")
    void testLoginProcessorWithOrgId() throws Exception {
        WorkOSProcessors.LoginProcessor processor = new WorkOSProcessors.LoginProcessor();
        exchange.getIn().setHeader("org_id", "org-12345");

        // Set properties on context
        camelContext.getPropertiesComponent().addOverrideProperty("workos.client.id", "test-client-id");
        camelContext.getPropertiesComponent().addOverrideProperty("workos.redirect.uri", "http://localhost:8080/api/auth/callback");

        processor.process(exchange);

        assertEquals(302, exchange.getIn().getHeader(Exchange.HTTP_RESPONSE_CODE));
        String location = exchange.getIn().getHeader("Location", String.class);
        assertNotNull(location);
        assertTrue(location.contains("&organization=org-12345"));
    }

    @Test
    @DisplayName("CallbackProcessor should throw exception without authorization code")
    void testCallbackProcessorWithoutCode() {
        WorkOSProcessors.CallbackProcessor processor = new WorkOSProcessors.CallbackProcessor();

        Exception exception = assertThrows(IllegalArgumentException.class, () -> {
            processor.process(exchange);
        });

        assertEquals("No authorization code received", exception.getMessage());
    }

    @Test
    @DisplayName("CallbackProcessor should prepare token request with code")
    void testCallbackProcessorWithCode() throws Exception {
        WorkOSProcessors.CallbackProcessor processor = new WorkOSProcessors.CallbackProcessor();
        exchange.getIn().setHeader("code", "test-auth-code");

        // Set properties on context
        camelContext.getPropertiesComponent().addOverrideProperty("workos.client.id", "test-client-id");
        camelContext.getPropertiesComponent().addOverrideProperty("workos.client.secret", "test-client-secret");
        camelContext.getPropertiesComponent().addOverrideProperty("workos.redirect.uri", "http://localhost:8080/api/auth/callback");

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("authorization_code", body.get("grant_type"));
        assertEquals("test-auth-code", body.get("code"));
        assertEquals("test-client-id", body.get("client_id"));
        assertEquals("test-client-secret", body.get("client_secret"));
        assertEquals("http://localhost:8080/api/auth/callback", body.get("redirect_uri"));
        assertEquals("POST", exchange.getIn().getHeader(Exchange.HTTP_METHOD));
        assertEquals("application/x-www-form-urlencoded", exchange.getIn().getHeader(Exchange.CONTENT_TYPE));
    }

    @Test
    @DisplayName("TokenExtractorProcessor should extract and store tokens")
    void testTokenExtractorProcessor() throws Exception {
        WorkOSProcessors.TokenExtractorProcessor processor = new WorkOSProcessors.TokenExtractorProcessor();

        Map<String, Object> tokenResponse = new HashMap<>();
        tokenResponse.put("access_token", "test-access-token");
        tokenResponse.put("id_token", "test-id-token");
        exchange.getIn().setBody(tokenResponse);

        processor.process(exchange);

        assertEquals("Bearer test-access-token", exchange.getIn().getHeader("Authorization"));
        assertEquals("test-id-token", exchange.getIn().getHeader("WorkOS-ID-Token"));
        assertEquals("test-access-token", exchange.getIn().getHeader("access_token"));
    }

    @Test
    @DisplayName("ProfileRequestProcessor should prepare profile request")
    void testProfileRequestProcessor() throws Exception {
        WorkOSProcessors.ProfileRequestProcessor processor = new WorkOSProcessors.ProfileRequestProcessor();
        exchange.getIn().setHeader("access_token", "test-token");

        processor.process(exchange);

        assertEquals("Bearer test-token", exchange.getIn().getHeader("Authorization"));
        assertEquals("GET", exchange.getIn().getHeader(Exchange.HTTP_METHOD));
        assertNull(exchange.getIn().getBody());
    }

    @Test
    @DisplayName("ProfileExtractorProcessor should extract full profile with organization")
    void testProfileExtractorWithOrganization() throws Exception {
        WorkOSProcessors.ProfileExtractorProcessor processor = new WorkOSProcessors.ProfileExtractorProcessor();

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", "user-123");
        profile.put("email", "test@example.com");
        profile.put("first_name", "Test");
        profile.put("last_name", "User");

        Map<String, Object> organization = new HashMap<>();
        organization.put("id", "org-456");
        organization.put("name", "Test Organization");
        profile.put("organization", organization);

        Map<String, Object> rawAttributes = new HashMap<>();
        rawAttributes.put("roles", Arrays.asList("admin", "user"));
        profile.put("raw_attributes", rawAttributes);

        exchange.getIn().setBody(profile);

        processor.process(exchange);

        assertEquals("org-456", exchange.getIn().getHeader("tenantId"));
        assertEquals("Test Organization", exchange.getIn().getHeader("tenantName"));
        assertEquals("user-123", exchange.getIn().getHeader("userId"));
        assertEquals("test@example.com", exchange.getIn().getHeader("userEmail"));
        assertEquals("Test User", exchange.getIn().getHeader("userName"));

        @SuppressWarnings("unchecked")
        List<String> roles = exchange.getIn().getHeader("userRoles", List.class);
        assertNotNull(roles);
        assertEquals(2, roles.size());
        assertTrue(roles.contains("admin"));
        assertTrue(roles.contains("user"));

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = exchange.getIn().getBody(Map.class);
        assertNotNull(securityContext);
        assertTrue((Boolean) securityContext.get("authenticated"));
        assertEquals("org-456", securityContext.get("tenantId"));
        assertEquals("Test Organization", securityContext.get("tenantName"));
        assertEquals("user-123", securityContext.get("userId"));
        assertEquals("test@example.com", securityContext.get("userEmail"));
        assertEquals("Test User", securityContext.get("userName"));
        assertNotNull(securityContext.get("timestamp"));
    }

    @Test
    @DisplayName("ProfileExtractorProcessor should handle missing organization")
    void testProfileExtractorWithoutOrganization() throws Exception {
        WorkOSProcessors.ProfileExtractorProcessor processor = new WorkOSProcessors.ProfileExtractorProcessor();

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", "user-123");
        profile.put("email", "test@example.com");
        profile.put("first_name", "Test");
        profile.put("last_name", "User");

        exchange.getIn().setBody(profile);

        processor.process(exchange);

        assertNull(exchange.getIn().getHeader("tenantId"));
        assertNull(exchange.getIn().getHeader("tenantName"));

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = exchange.getIn().getBody(Map.class);
        assertNotNull(securityContext);
        assertEquals("", securityContext.get("tenantId"));
        assertEquals("", securityContext.get("tenantName"));
    }

    @Test
    @DisplayName("ProfileExtractorProcessor should handle missing raw attributes")
    void testProfileExtractorWithoutRawAttributes() throws Exception {
        WorkOSProcessors.ProfileExtractorProcessor processor = new WorkOSProcessors.ProfileExtractorProcessor();

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", "user-123");
        profile.put("email", "test@example.com");
        profile.put("first_name", "Test");
        profile.put("last_name", "User");

        exchange.getIn().setBody(profile);

        processor.process(exchange);

        assertNull(exchange.getIn().getHeader("userRoles"));

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = exchange.getIn().getBody(Map.class);
        assertNotNull(securityContext);
        @SuppressWarnings("unchecked")
        List<?> roles = (List<?>) securityContext.get("roles");
        assertTrue(roles.isEmpty());
    }

    @Test
    @DisplayName("ProfileExtractorProcessor should handle null names")
    void testProfileExtractorWithNullNames() throws Exception {
        WorkOSProcessors.ProfileExtractorProcessor processor = new WorkOSProcessors.ProfileExtractorProcessor();

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", "user-123");
        profile.put("email", "test@example.com");
        profile.put("first_name", null);
        profile.put("last_name", null);

        // Need rawAttributes for userName to be set
        Map<String, Object> rawAttributes = new HashMap<>();
        rawAttributes.put("roles", Arrays.asList());
        profile.put("raw_attributes", rawAttributes);

        exchange.getIn().setBody(profile);

        processor.process(exchange);

        assertEquals("null null", exchange.getIn().getHeader("userName"));

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = exchange.getIn().getBody(Map.class);
        assertEquals("null null", securityContext.get("userName"));
    }

    @Test
    @DisplayName("ProfileExtractorProcessor should include valid timestamp")
    void testProfileExtractorTimestamp() throws Exception {
        WorkOSProcessors.ProfileExtractorProcessor processor = new WorkOSProcessors.ProfileExtractorProcessor();

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", "user-123");

        exchange.getIn().setBody(profile);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = exchange.getIn().getBody(Map.class);
        assertNotNull(securityContext.get("timestamp"));

        String timestamp = (String) securityContext.get("timestamp");
        assertTrue(timestamp.contains("T"));
        assertDoesNotThrow(() -> Instant.parse(timestamp));
    }

    @Test
    @DisplayName("ProfileAuthCheckerProcessor should reject without token")
    void testProfileAuthCheckerWithoutToken() throws Exception {
        WorkOSProcessors.ProfileAuthCheckerProcessor processor = new WorkOSProcessors.ProfileAuthCheckerProcessor();

        processor.process(exchange);

        assertEquals(401, exchange.getIn().getHeader("CamelHttpResponseCode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("Unauthorized", body.get("error"));
        assertEquals("No valid authentication token", body.get("message"));
    }

    @Test
    @DisplayName("ProfileAuthCheckerProcessor should reject invalid token format")
    void testProfileAuthCheckerInvalidToken() throws Exception {
        WorkOSProcessors.ProfileAuthCheckerProcessor processor = new WorkOSProcessors.ProfileAuthCheckerProcessor();
        exchange.getIn().setHeader("Authorization", "InvalidToken");

        processor.process(exchange);

        assertEquals(401, exchange.getIn().getHeader("CamelHttpResponseCode"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("Unauthorized", body.get("error"));
    }

    @Test
    @DisplayName("ProfileAuthCheckerProcessor should accept valid token")
    void testProfileAuthCheckerValidToken() throws Exception {
        WorkOSProcessors.ProfileAuthCheckerProcessor processor = new WorkOSProcessors.ProfileAuthCheckerProcessor();
        exchange.getIn().setHeader("Authorization", "Bearer valid-token");
        exchange.getIn().setBody("existing-body");

        processor.process(exchange);

        assertNull(exchange.getIn().getHeader("CamelHttpResponseCode"));
        assertEquals("GET", exchange.getIn().getHeader(Exchange.HTTP_METHOD));
        assertNull(exchange.getIn().getBody());
    }

    @Test
    @DisplayName("LogoutProcessor should clear all auth headers")
    void testLogoutProcessor() throws Exception {
        WorkOSProcessors.LogoutProcessor processor = new WorkOSProcessors.LogoutProcessor();

        // Set headers that should be cleared
        exchange.getIn().setHeader("Authorization", "Bearer test-token");
        exchange.getIn().setHeader("WorkOS-ID-Token", "test-id-token");
        exchange.getIn().setHeader("tenantId", "tenant-123");
        exchange.getIn().setHeader("userRoles", Arrays.asList("admin"));

        processor.process(exchange);

        assertNull(exchange.getIn().getHeader("Authorization"));
        assertNull(exchange.getIn().getHeader("WorkOS-ID-Token"));
        assertNull(exchange.getIn().getHeader("tenantId"));
        assertNull(exchange.getIn().getHeader("userRoles"));

        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        assertNotNull(body);
        assertEquals("logged_out", body.get("status"));
        assertNotNull(body.get("timestamp"));

        String timestamp = (String) body.get("timestamp");
        assertTrue(timestamp.contains("T"));
        assertDoesNotThrow(() -> Instant.parse(timestamp));
    }

    @Test
    @DisplayName("ProfileExtractorProcessor should handle empty roles list")
    void testProfileExtractorEmptyRoles() throws Exception {
        WorkOSProcessors.ProfileExtractorProcessor processor = new WorkOSProcessors.ProfileExtractorProcessor();

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", "user-123");

        Map<String, Object> rawAttributes = new HashMap<>();
        rawAttributes.put("roles", Arrays.asList());
        profile.put("raw_attributes", rawAttributes);

        exchange.getIn().setBody(profile);

        processor.process(exchange);

        @SuppressWarnings("unchecked")
        List<String> roles = exchange.getIn().getHeader("userRoles", List.class);
        assertNotNull(roles);
        assertTrue(roles.isEmpty());

        @SuppressWarnings("unchecked")
        Map<String, Object> securityContext = exchange.getIn().getBody(Map.class);
        @SuppressWarnings("unchecked")
        List<?> contextRoles = (List<?>) securityContext.get("roles");
        assertTrue(contextRoles.isEmpty());
    }

    @Test
    @DisplayName("TokenExtractorProcessor should handle null tokens")
    void testTokenExtractorNullTokens() throws Exception {
        WorkOSProcessors.TokenExtractorProcessor processor = new WorkOSProcessors.TokenExtractorProcessor();

        Map<String, Object> tokenResponse = new HashMap<>();
        tokenResponse.put("access_token", null);
        tokenResponse.put("id_token", null);
        exchange.getIn().setBody(tokenResponse);

        processor.process(exchange);

        assertEquals("Bearer null", exchange.getIn().getHeader("Authorization"));
        assertNull(exchange.getIn().getHeader("WorkOS-ID-Token"));
        assertNull(exchange.getIn().getHeader("access_token"));
    }

    @Test
    @DisplayName("LoginProcessor should handle special characters in org ID")
    void testLoginProcessorSpecialCharsInOrgId() throws Exception {
        WorkOSProcessors.LoginProcessor processor = new WorkOSProcessors.LoginProcessor();
        exchange.getIn().setHeader("org_id", "org-123&test=value");

        // Set properties on context
        camelContext.getPropertiesComponent().addOverrideProperty("workos.client.id", "test-client-id");
        camelContext.getPropertiesComponent().addOverrideProperty("workos.redirect.uri", "http://localhost:8080/api/auth/callback");

        processor.process(exchange);

        String location = exchange.getIn().getHeader("Location", String.class);
        assertNotNull(location);
        // Should include org ID as-is (URL encoding would be done by HTTP client)
        assertTrue(location.contains("&organization=org-123&test=value"));
    }
}