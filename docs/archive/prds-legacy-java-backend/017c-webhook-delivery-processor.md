# PRD-017c: Webhook Delivery Processor

**Priority:** P1 (User Workflow)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-017 (Alert and Notification System)
**Dependencies:** PRD-008 (Signal Management)

## Problem

Need to deliver notifications to external systems via webhook (PagerDuty, Opsgenie, custom integrations). Without webhook delivery, BeTrace cannot integrate with existing incident management platforms.

## Solution

Implement processor that POSTs JSON payload to configured webhook URLs. Support custom headers, retry logic with exponential backoff, and SSRF prevention. Record delivery status (success/failure, HTTP status code) for audit trail.

## Unit Description

**File:** `backend/src/main/java/com/fluo/processors/DeliverWebhookNotificationProcessor.java`
**Type:** CDI Named Processor
**Purpose:** Deliver notifications via HTTP webhook POST

## Implementation

```java
package com.fluo.processors;

import com.fluo.model.NotificationConfig;
import com.fluo.model.Signal;
import com.google.gson.Gson;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Named("deliverWebhookNotificationProcessor")
@ApplicationScoped
public class DeliverWebhookNotificationProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(DeliverWebhookNotificationProcessor.class);

    private static final int MAX_RETRIES = 3;
    private static final Duration INITIAL_BACKOFF = Duration.ofSeconds(1);
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    @ConfigProperty(name = "fluo.notifications.webhook.allowed-domains", defaultValue = "")
    String allowedDomains;

    @ConfigProperty(name = "fluo.base-url", defaultValue = "https://fluo.example.com")
    String fluoBaseUrl;

    private final HttpClient httpClient;
    private final Gson gson;

    public DeliverWebhookNotificationProcessor() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(TIMEOUT)
                .build();
        this.gson = new Gson();
    }

    @Override
    public void process(Exchange exchange) throws Exception {
        Signal signal = exchange.getIn().getBody(Signal.class);
        NotificationConfig config = exchange.getIn().getHeader("notificationConfig", NotificationConfig.class);

        if (!"webhook".equals(config.getChannelType())) {
            log.debug("Skipping webhook delivery for non-webhook config: {}", config.getId());
            return;
        }

        String webhookUrl = config.getWebhookUrl();

        // Validate webhook URL (SSRF prevention)
        validateWebhookUrl(webhookUrl);

        // Build notification payload
        Map<String, Object> payload = buildPayload(signal, config);
        String payloadJson = gson.toJson(payload);

        // Attempt delivery with retries
        DeliveryResult result = deliverWithRetries(webhookUrl, payloadJson, config);

        // Store result in exchange for recording
        exchange.getIn().setHeader("webhookDeliveryStatus", result.success ? "sent" : "failed");
        exchange.getIn().setHeader("webhookHttpStatus", result.httpStatus);
        exchange.getIn().setHeader("webhookRetryCount", result.retryCount);
        exchange.getIn().setHeader("webhookErrorMessage", result.errorMessage);

        log.info("Webhook notification delivered: signal={}, config={}, status={}, httpStatus={}",
                signal.getId(), config.getId(), result.success ? "sent" : "failed", result.httpStatus);
    }

    /**
     * Deliver notification with exponential backoff retries
     * @param webhookUrl Webhook URL
     * @param payloadJson JSON payload
     * @param config Notification config (for custom headers)
     * @return Delivery result
     */
    private DeliveryResult deliverWithRetries(String webhookUrl, String payloadJson, NotificationConfig config) {
        int retryCount = 0;
        Duration backoff = INITIAL_BACKOFF;

        while (retryCount <= MAX_RETRIES) {
            try {
                // Build HTTP request
                HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                        .uri(URI.create(webhookUrl))
                        .header("Content-Type", "application/json")
                        .header("User-Agent", "BeTrace/1.0")
                        .timeout(TIMEOUT)
                        .POST(HttpRequest.BodyPublishers.ofString(payloadJson));

                // Add custom headers from config
                if (config.getWebhookHeadersJson() != null) {
                    Map<String, String> customHeaders = gson.fromJson(
                            config.getWebhookHeadersJson(),
                            Map.class
                    );
                    customHeaders.forEach(requestBuilder::header);
                }

                HttpRequest request = requestBuilder.build();

                // Send request
                HttpResponse<String> response = httpClient.send(
                        request,
                        HttpResponse.BodyHandlers.ofString()
                );

                int statusCode = response.statusCode();

                // Success: 2xx status codes
                if (statusCode >= 200 && statusCode < 300) {
                    log.info("Webhook delivered successfully: url={}, status={}, retries={}",
                            webhookUrl, statusCode, retryCount);
                    return new DeliveryResult(true, statusCode, retryCount, null);
                }

                // Client error (4xx): don't retry
                if (statusCode >= 400 && statusCode < 500) {
                    log.warn("Webhook delivery failed (client error): url={}, status={}, body={}",
                            webhookUrl, statusCode, response.body());
                    return new DeliveryResult(false, statusCode, retryCount,
                            "Client error: " + statusCode);
                }

                // Server error (5xx): retry
                log.warn("Webhook delivery failed (server error): url={}, status={}, retries={}",
                        webhookUrl, statusCode, retryCount);

                if (retryCount < MAX_RETRIES) {
                    Thread.sleep(backoff.toMillis());
                    backoff = backoff.multipliedBy(2); // Exponential backoff
                    retryCount++;
                } else {
                    return new DeliveryResult(false, statusCode, retryCount,
                            "Max retries exceeded, server error: " + statusCode);
                }

            } catch (Exception e) {
                log.error("Webhook delivery exception: url={}, retries={}, error={}",
                        webhookUrl, retryCount, e.getMessage(), e);

                if (retryCount < MAX_RETRIES) {
                    try {
                        Thread.sleep(backoff.toMillis());
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }
                    backoff = backoff.multipliedBy(2);
                    retryCount++;
                } else {
                    return new DeliveryResult(false, 0, retryCount, e.getMessage());
                }
            }
        }

        return new DeliveryResult(false, 0, retryCount, "Max retries exceeded");
    }

    /**
     * Build notification payload JSON
     * @param signal Signal that triggered notification
     * @param config Notification config
     * @return Payload map
     */
    private Map<String, Object> buildPayload(Signal signal, NotificationConfig config) {
        Map<String, Object> payload = new HashMap<>();

        payload.put("event", "signal.created");

        // Signal details
        Map<String, Object> signalData = new HashMap<>();
        signalData.put("id", signal.getId().toString());
        signalData.put("severity", signal.getSeverity());
        signalData.put("rule_id", signal.getRuleId().toString());
        signalData.put("rule_name", signal.getRuleName());
        signalData.put("description", signal.getDescription());
        signalData.put("trace_id", signal.getTraceId());
        signalData.put("span_id", signal.getSpanId());
        signalData.put("created_at", signal.getCreatedAt().toString());
        payload.put("signal", signalData);

        // Tenant details
        Map<String, Object> tenantData = new HashMap<>();
        tenantData.put("id", config.getTenantId().toString());
        payload.put("tenant", tenantData);

        // BeTrace URL to view signal
        String signalUrl = String.format("%s/signals/%s", fluoBaseUrl, signal.getId());
        payload.put("fluo_url", signalUrl);

        // Metadata
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("matched_span_count", signal.getMatchedSpanCount());
        metadata.put("rule_category", determineCategory(signal));
        payload.put("metadata", metadata);

        return payload;
    }

    /**
     * Validate webhook URL to prevent SSRF attacks
     * @param webhookUrl Webhook URL to validate
     * @throws IllegalArgumentException if URL is invalid or blocked
     */
    private void validateWebhookUrl(String webhookUrl) {
        if (webhookUrl == null || webhookUrl.isEmpty()) {
            throw new IllegalArgumentException("Webhook URL is empty");
        }

        URI uri;
        try {
            uri = URI.create(webhookUrl);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid webhook URL: " + e.getMessage());
        }

        // Must be HTTP or HTTPS
        String scheme = uri.getScheme();
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            throw new IllegalArgumentException("Webhook URL must use HTTP or HTTPS");
        }

        String host = uri.getHost();

        // Block localhost and private IP ranges (SSRF prevention)
        if (isBlockedHost(host)) {
            throw new IllegalArgumentException("Webhook URL blocked: internal host");
        }

        // Check against allowed domains (if configured)
        if (!allowedDomains.isEmpty()) {
            String[] allowed = allowedDomains.split(",");
            boolean matchesAllowed = false;
            for (String domain : allowed) {
                if (host.endsWith(domain.trim())) {
                    matchesAllowed = true;
                    break;
                }
            }
            if (!matchesAllowed) {
                throw new IllegalArgumentException("Webhook URL not in allowed domains");
            }
        }
    }

    private boolean isBlockedHost(String host) {
        if (host == null) {
            return true;
        }

        String lowerHost = host.toLowerCase();

        // Block localhost
        if (lowerHost.equals("localhost") || lowerHost.equals("127.0.0.1") || lowerHost.equals("::1")) {
            return true;
        }

        // Block private IP ranges (simplified check)
        if (lowerHost.startsWith("10.") ||
            lowerHost.startsWith("192.168.") ||
            lowerHost.startsWith("172.16.") ||
            lowerHost.startsWith("172.17.") ||
            lowerHost.startsWith("172.18.") ||
            lowerHost.startsWith("172.19.") ||
            lowerHost.startsWith("172.20.") ||
            lowerHost.startsWith("172.21.") ||
            lowerHost.startsWith("172.22.") ||
            lowerHost.startsWith("172.23.") ||
            lowerHost.startsWith("172.24.") ||
            lowerHost.startsWith("172.25.") ||
            lowerHost.startsWith("172.26.") ||
            lowerHost.startsWith("172.27.") ||
            lowerHost.startsWith("172.28.") ||
            lowerHost.startsWith("172.29.") ||
            lowerHost.startsWith("172.30.") ||
            lowerHost.startsWith("172.31.")) {
            return true;
        }

        return false;
    }

    private String determineCategory(Signal signal) {
        String ruleName = signal.getRuleName().toLowerCase();
        if (ruleName.contains("auth")) return "authentication";
        if (ruleName.contains("pii")) return "pii";
        if (ruleName.contains("compliance")) return "compliance";
        return "unknown";
    }

    private record DeliveryResult(
            boolean success,
            int httpStatus,
            int retryCount,
            String errorMessage
    ) {}
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Processor only - delivery status recorded by PRD-017f
**ADR-013 (Camel-First):** Processor used in notification Camel route
**ADR-014 (Named Processors):** DeliverWebhookNotificationProcessor is @Named
**ADR-015 (Tiered Storage):** Not applicable (notification delivery only)

## Configuration

```properties
# application.properties
fluo.notifications.webhook.allowed-domains=pagerduty.com,opsgenie.com,example.com
fluo.base-url=https://fluo.example.com
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testProcess_SuccessfulDelivery - webhook returns 200, success
- testProcess_ServerError_Retries - 503 error triggers retries
- testProcess_ClientError_NoRetry - 400 error does not retry
- testProcess_ExponentialBackoff - retries with 1s, 2s, 4s delays
- testProcess_MaxRetriesExceeded - fails after 3 retries
- testProcess_CustomHeaders - includes custom headers from config
- testBuildPayload_AllFields - payload contains signal details
- testValidateWebhookUrl_ValidUrl - allows valid HTTPS URL
- testValidateWebhookUrl_Localhost - blocks localhost
- testValidateWebhookUrl_PrivateIP - blocks 10.x.x.x, 192.168.x.x
- testValidateWebhookUrl_AllowedDomains - enforces domain allowlist
- testValidateWebhookUrl_InvalidScheme - blocks ftp:// URLs

**Integration Tests:**
- testFullWorkflow_DeliverToWebhook - real HTTP request to test server
- testRetryBehavior_ServerRecovery - server returns 503 then 200

**Security Tests:**
- testSSRF_BlockedHosts - cannot deliver to internal IPs
- testSSRF_AllowlistBypass - cannot bypass allowlist

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- SSRF attacks - mitigate with host validation, block internal IPs
- Webhook URL injection - mitigate with strict URI parsing
- Header injection - mitigate with header validation
- Credential leakage - mitigate by not logging webhook URLs/headers
- Timeout exploitation - mitigate with 10s timeout

**Compliance:**
- SOC2 CC7.2 (System Monitoring) - webhook delivery proves incident communication

## Success Criteria

- [ ] Deliver notification via HTTP POST
- [ ] Support custom headers
- [ ] Retry failed deliveries (exponential backoff)
- [ ] Block localhost and private IPs (SSRF prevention)
- [ ] Enforce domain allowlist
- [ ] Record delivery status (success/failed, HTTP status)
- [ ] All tests pass with 90% coverage
