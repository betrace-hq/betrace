# PRD-017d: Slack Delivery Processor

**Priority:** P1 (User Workflow)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-017 (Alert and Notification System)
**Dependencies:** PRD-008 (Signal Management)

## Problem

Teams use Slack for real-time incident communication. Need to deliver formatted notifications to Slack channels when signals are generated.

## Solution

Implement processor that POSTs formatted message to Slack incoming webhook. Use Slack Block Kit for rich formatting with signal details, severity indicators, and action buttons.

## Unit Description

**File:** `backend/src/main/java/com/fluo/processors/DeliverSlackNotificationProcessor.java`
**Type:** CDI Named Processor
**Purpose:** Deliver notifications to Slack via incoming webhook

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
import java.util.*;

@Named("deliverSlackNotificationProcessor")
@ApplicationScoped
public class DeliverSlackNotificationProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(DeliverSlackNotificationProcessor.class);

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    @ConfigProperty(name = "fluo.base-url", defaultValue = "https://fluo.example.com")
    String fluoBaseUrl;

    private final HttpClient httpClient;
    private final Gson gson;

    public DeliverSlackNotificationProcessor() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(TIMEOUT)
                .build();
        this.gson = new Gson();
    }

    @Override
    public void process(Exchange exchange) throws Exception {
        Signal signal = exchange.getIn().getBody(Signal.class);
        NotificationConfig config = exchange.getIn().getHeader("notificationConfig", NotificationConfig.class);

        if (!"slack".equals(config.getChannelType())) {
            log.debug("Skipping Slack delivery for non-Slack config: {}", config.getId());
            return;
        }

        String slackWebhookUrl = config.getSlackWebhookUrl();

        // Build Slack message with Block Kit
        Map<String, Object> slackMessage = buildSlackMessage(signal, config);
        String messageJson = gson.toJson(slackMessage);

        // Deliver to Slack
        DeliveryResult result = deliverToSlack(slackWebhookUrl, messageJson);

        // Store result in exchange for recording
        exchange.getIn().setHeader("slackDeliveryStatus", result.success ? "sent" : "failed");
        exchange.getIn().setHeader("slackHttpStatus", result.httpStatus);
        exchange.getIn().setHeader("slackErrorMessage", result.errorMessage);

        log.info("Slack notification delivered: signal={}, config={}, status={}",
                signal.getId(), config.getId(), result.success ? "sent" : "failed");
    }

    /**
     * Deliver message to Slack webhook
     * @param webhookUrl Slack webhook URL
     * @param messageJson JSON message payload
     * @return Delivery result
     */
    private DeliveryResult deliverToSlack(String webhookUrl, String messageJson) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(webhookUrl))
                    .header("Content-Type", "application/json")
                    .timeout(TIMEOUT)
                    .POST(HttpRequest.BodyPublishers.ofString(messageJson))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            int statusCode = response.statusCode();

            if (statusCode == 200) {
                log.info("Slack notification delivered successfully: url={}", webhookUrl);
                return new DeliveryResult(true, statusCode, null);
            } else {
                log.warn("Slack notification failed: url={}, status={}, body={}",
                        webhookUrl, statusCode, response.body());
                return new DeliveryResult(false, statusCode, "Slack returned: " + statusCode);
            }

        } catch (Exception e) {
            log.error("Slack delivery exception: url={}, error={}", webhookUrl, e.getMessage(), e);
            return new DeliveryResult(false, 0, e.getMessage());
        }
    }

    /**
     * Build Slack message with Block Kit formatting
     * @param signal Signal that triggered notification
     * @param config Notification config
     * @return Slack message map
     */
    private Map<String, Object> buildSlackMessage(Signal signal, NotificationConfig config) {
        Map<String, Object> message = new HashMap<>();

        // Target channel (optional override)
        if (config.getSlackChannel() != null && !config.getSlackChannel().isEmpty()) {
            message.put("channel", config.getSlackChannel());
        }

        message.put("username", "BeTrace");
        message.put("icon_emoji", ":rotating_light:");

        // Main text (fallback for notifications)
        String emoji = getSeverityEmoji(signal.getSeverity());
        message.put("text", String.format("%s *%s Signal: %s*",
                emoji, capitalize(signal.getSeverity()), signal.getRuleName()));

        // Rich formatting with Block Kit
        List<Map<String, Object>> blocks = new ArrayList<>();

        // Header block
        blocks.add(Map.of(
                "type", "header",
                "text", Map.of(
                        "type", "plain_text",
                        "text", emoji + " " + capitalize(signal.getSeverity()) + " Signal: " + signal.getRuleName()
                )
        ));

        // Divider
        blocks.add(Map.of("type", "divider"));

        // Signal details section
        List<Map<String, Object>> fields = new ArrayList<>();
        fields.add(Map.of(
                "type", "mrkdwn",
                "text", "*Description:*\n" + signal.getDescription()
        ));
        fields.add(Map.of(
                "type", "mrkdwn",
                "text", "*Severity:*\n" + capitalize(signal.getSeverity())
        ));
        fields.add(Map.of(
                "type", "mrkdwn",
                "text", "*Trace ID:*\n`" + signal.getTraceId() + "`"
        ));
        fields.add(Map.of(
                "type", "mrkdwn",
                "text", "*Created:*\n" + formatTimestamp(signal.getCreatedAt().toEpochMilli())
        ));

        blocks.add(Map.of(
                "type", "section",
                "fields", fields
        ));

        // Divider
        blocks.add(Map.of("type", "divider"));

        // Action buttons
        String signalUrl = String.format("%s/signals/%s", fluoBaseUrl, signal.getId());
        blocks.add(Map.of(
                "type", "actions",
                "elements", List.of(
                        Map.of(
                                "type", "button",
                                "text", Map.of("type", "plain_text", "text", "View in BeTrace"),
                                "url", signalUrl,
                                "style", "primary"
                        ),
                        Map.of(
                                "type", "button",
                                "text", Map.of("type", "plain_text", "text", "Mark as Investigating"),
                                "url", signalUrl + "?action=investigating"
                        )
                )
        ));

        // Footer
        blocks.add(Map.of(
                "type", "context",
                "elements", List.of(
                        Map.of(
                                "type", "mrkdwn",
                                "text", "BeTrace Behavioral Assurance System | " + config.getTenantId()
                        )
                )
        ));

        message.put("blocks", blocks);

        // Attachment color (fallback for older Slack clients)
        message.put("attachments", List.of(
                Map.of("color", getSeverityColor(signal.getSeverity()))
        ));

        return message;
    }

    private String getSeverityEmoji(String severity) {
        return switch (severity.toLowerCase()) {
            case "critical" -> ":red_circle:";
            case "high" -> ":orange_circle:";
            case "medium" -> ":yellow_circle:";
            case "low" -> ":green_circle:";
            default -> ":white_circle:";
        };
    }

    private String getSeverityColor(String severity) {
        return switch (severity.toLowerCase()) {
            case "critical" -> "danger";    // Red
            case "high" -> "warning";       // Orange
            case "medium" -> "#ffd700";     // Yellow
            case "low" -> "good";           // Green
            default -> "#808080";           // Gray
        };
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
    }

    private String formatTimestamp(long epochMilli) {
        return "<!date^" + (epochMilli / 1000) + "^{date_short_pretty} at {time}|" +
                new java.util.Date(epochMilli) + ">";
    }

    private record DeliveryResult(
            boolean success,
            int httpStatus,
            String errorMessage
    ) {}
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Processor only - delivery status recorded by PRD-017f
**ADR-013 (Camel-First):** Processor used in notification Camel route
**ADR-014 (Named Processors):** DeliverSlackNotificationProcessor is @Named
**ADR-015 (Tiered Storage):** Not applicable (notification delivery only)

## Slack Block Kit Message Structure

```json
{
  "channel": "#alerts",
  "username": "BeTrace",
  "icon_emoji": ":rotating_light:",
  "text": "🔴 *Critical Signal: Detect PII Leak*",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🔴 Critical Signal: Detect PII Leak"
      }
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Description:*\nSSN found without redaction"},
        {"type": "mrkdwn", "text": "*Severity:*\nCritical"},
        {"type": "mrkdwn", "text": "*Trace ID:*\n`abc123`"},
        {"type": "mrkdwn", "text": "*Created:*\n<!date^1234567890^{date_short_pretty} at {time}|...>"}
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "View in BeTrace"},
          "url": "https://fluo.example.com/signals/uuid",
          "style": "primary"
        },
        {
          "type": "button",
          "text": {"type": "plain_text", "text": "Mark as Investigating"},
          "url": "https://fluo.example.com/signals/uuid?action=investigating"
        }
      ]
    }
  ]
}
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testProcess_SuccessfulDelivery - Slack returns 200, success
- testProcess_SlackError - Slack returns 400, failed
- testBuildSlackMessage_AllFields - message contains all signal details
- testBuildSlackMessage_CriticalSeverity - uses red circle emoji
- testBuildSlackMessage_HighSeverity - uses orange circle emoji
- testBuildSlackMessage_MediumSeverity - uses yellow circle emoji
- testBuildSlackMessage_LowSeverity - uses green circle emoji
- testBuildSlackMessage_ActionButtons - includes View and Mark as Investigating buttons
- testBuildSlackMessage_ChannelOverride - includes channel field when configured
- testDeliverToSlack_Timeout - handles timeout gracefully
- testDeliverToSlack_Exception - handles network errors

**Integration Tests:**
- testFullWorkflow_DeliverToSlack - real HTTP request to Slack test webhook

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Slack webhook leakage - mitigate by not logging webhook URLs
- Message injection - mitigate with JSON escaping
- Credential exposure - mitigate with secure config storage
- Timeout exploitation - mitigate with 10s timeout

**Compliance:**
- SOC2 CC7.2 (System Monitoring) - Slack delivery proves incident communication

## Success Criteria

- [ ] Deliver notification to Slack via webhook
- [ ] Format message with Slack Block Kit
- [ ] Include severity emoji and color
- [ ] Add action buttons (View in BeTrace, Mark as Investigating)
- [ ] Support channel override
- [ ] Format timestamp with Slack date formatting
- [ ] Record delivery status
- [ ] All tests pass with 90% coverage
