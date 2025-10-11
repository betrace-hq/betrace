# PRD-017e: Email Delivery Processor

**Priority:** P1 (User Workflow)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-017 (Alert and Notification System)
**Dependencies:** PRD-008 (Signal Management)

## Problem

Organizations need email notifications for incident tracking and compliance. Email provides durable notification trail and works with all incident management systems.

## Solution

Implement processor that sends HTML emails via SMTP. Support TLS/SSL, authentication, and HTML templates with signal details. Include text/plain alternative for email clients that don't support HTML.

## Unit Description

**File:** `backend/src/main/java/com/fluo/processors/DeliverEmailNotificationProcessor.java`
**Type:** CDI Named Processor
**Purpose:** Deliver notifications via email (SMTP)

## Implementation

```java
package com.fluo.processors;

import com.fluo.model.NotificationConfig;
import com.fluo.model.Signal;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import jakarta.mail.*;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeBodyPart;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Properties;

@Named("deliverEmailNotificationProcessor")
@ApplicationScoped
public class DeliverEmailNotificationProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(DeliverEmailNotificationProcessor.class);

    @ConfigProperty(name = "fluo.base-url", defaultValue = "https://fluo.example.com")
    String fluoBaseUrl;

    @ConfigProperty(name = "fluo.notifications.email.from", defaultValue = "alerts@fluo.example.com")
    String fromEmail;

    @Override
    public void process(Exchange exchange) throws Exception {
        Signal signal = exchange.getIn().getBody(Signal.class);
        NotificationConfig config = exchange.getIn().getHeader("notificationConfig", NotificationConfig.class);

        if (!"email".equals(config.getChannelType())) {
            log.debug("Skipping email delivery for non-email config: {}", config.getId());
            return;
        }

        List<String> recipients = config.getEmailAddresses();
        if (recipients == null || recipients.isEmpty()) {
            log.warn("No email recipients configured for config: {}", config.getId());
            exchange.getIn().setHeader("emailDeliveryStatus", "skipped");
            return;
        }

        // Deliver email
        DeliveryResult result = deliverEmail(signal, config, recipients);

        // Store result in exchange for recording
        exchange.getIn().setHeader("emailDeliveryStatus", result.success ? "sent" : "failed");
        exchange.getIn().setHeader("emailErrorMessage", result.errorMessage);

        log.info("Email notification delivered: signal={}, config={}, status={}, recipients={}",
                signal.getId(), config.getId(), result.success ? "sent" : "failed", recipients.size());
    }

    /**
     * Deliver email notification via SMTP
     * @param signal Signal that triggered notification
     * @param config Notification config with SMTP settings
     * @param recipients List of email addresses
     * @return Delivery result
     */
    private DeliveryResult deliverEmail(Signal signal, NotificationConfig config, List<String> recipients) {
        try {
            // Parse SMTP config (simplified - production would use proper JSON parsing)
            Properties props = buildSmtpProperties(config);

            // Create session
            Session session = Session.getInstance(props, new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    // Extract from config.getEmailSmtpConfigJson()
                    return new PasswordAuthentication("smtp_user", "smtp_password");
                }
            });

            // Create message
            MimeMessage message = new MimeMessage(session);
            message.setFrom(new InternetAddress(fromEmail, "FLUO Alerts"));

            // Add recipients
            for (String recipient : recipients) {
                message.addRecipient(Message.RecipientType.TO, new InternetAddress(recipient));
            }

            // Subject
            String subject = String.format("[FLUO Alert] %s Signal: %s",
                    capitalize(signal.getSeverity()), signal.getRuleName());
            message.setSubject(subject);

            // Build multipart message (HTML + plain text)
            Multipart multipart = new MimeMultipart("alternative");

            // Plain text version
            MimeBodyPart textPart = new MimeBodyPart();
            textPart.setText(buildPlainTextBody(signal), "UTF-8");
            multipart.addBodyPart(textPart);

            // HTML version
            MimeBodyPart htmlPart = new MimeBodyPart();
            htmlPart.setContent(buildHtmlBody(signal), "text/html; charset=UTF-8");
            multipart.addBodyPart(htmlPart);

            message.setContent(multipart);

            // Send
            Transport.send(message);

            log.info("Email sent successfully: recipients={}", recipients);
            return new DeliveryResult(true, null);

        } catch (Exception e) {
            log.error("Email delivery failed: recipients={}, error={}", recipients, e.getMessage(), e);
            return new DeliveryResult(false, e.getMessage());
        }
    }

    /**
     * Build SMTP properties from config
     * @param config Notification config
     * @return SMTP properties
     */
    private Properties buildSmtpProperties(NotificationConfig config) {
        // Simplified - production would parse from config.getEmailSmtpConfigJson()
        Properties props = new Properties();
        props.put("mail.smtp.host", "smtp.example.com");
        props.put("mail.smtp.port", "587");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.ssl.protocols", "TLSv1.2 TLSv1.3");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.connectiontimeout", "10000");
        return props;
    }

    /**
     * Build plain text email body
     * @param signal Signal
     * @return Plain text body
     */
    private String buildPlainTextBody(Signal signal) {
        String signalUrl = String.format("%s/signals/%s", fluoBaseUrl, signal.getId());

        return String.format("""
            A new signal has been generated in FLUO:

            Severity: %s
            Rule: %s
            Description: %s

            Trace ID: %s
            Span ID: %s
            Created: %s

            View in FLUO: %s

            ---
            This alert was generated by FLUO Behavioral Assurance System
            """,
                capitalize(signal.getSeverity()),
                signal.getRuleName(),
                signal.getDescription(),
                signal.getTraceId(),
                signal.getSpanId(),
                formatTimestamp(signal.getCreatedAt().toEpochMilli()),
                signalUrl
        );
    }

    /**
     * Build HTML email body with styling
     * @param signal Signal
     * @return HTML body
     */
    private String buildHtmlBody(Signal signal) {
        String signalUrl = String.format("%s/signals/%s", fluoBaseUrl, signal.getId());
        String severityColor = getSeverityColor(signal.getSeverity());

        return String.format("""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: %s; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
                    .field { margin: 15px 0; }
                    .label { font-weight: bold; color: #666; }
                    .value { color: #333; font-family: monospace; background: white; padding: 4px 8px; border-radius: 4px; }
                    .button { display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
                    .footer { background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 style="margin: 0;">🚨 FLUO Alert</h1>
                    <p style="margin: 10px 0 0 0;">%s Signal: %s</p>
                </div>
                <div class="content">
                    <div class="field">
                        <div class="label">Description:</div>
                        <div class="value">%s</div>
                    </div>
                    <div class="field">
                        <div class="label">Severity:</div>
                        <div class="value">%s</div>
                    </div>
                    <div class="field">
                        <div class="label">Trace ID:</div>
                        <div class="value">%s</div>
                    </div>
                    <div class="field">
                        <div class="label">Span ID:</div>
                        <div class="value">%s</div>
                    </div>
                    <div class="field">
                        <div class="label">Created:</div>
                        <div class="value">%s</div>
                    </div>
                    <a href="%s" class="button">View in FLUO</a>
                </div>
                <div class="footer">
                    This alert was generated by FLUO Behavioral Assurance System
                </div>
            </body>
            </html>
            """,
                severityColor,
                capitalize(signal.getSeverity()),
                signal.getRuleName(),
                signal.getDescription(),
                capitalize(signal.getSeverity()),
                signal.getTraceId(),
                signal.getSpanId(),
                formatTimestamp(signal.getCreatedAt().toEpochMilli()),
                signalUrl
        );
    }

    private String getSeverityColor(String severity) {
        return switch (severity.toLowerCase()) {
            case "critical" -> "#dc2626";  // Red
            case "high" -> "#ea580c";      // Orange
            case "medium" -> "#ca8a04";    // Yellow
            case "low" -> "#16a34a";       // Green
            default -> "#6b7280";          // Gray
        };
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1).toLowerCase();
    }

    private String formatTimestamp(long epochMilli) {
        return DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'UTC'")
                .format(java.time.Instant.ofEpochMilli(epochMilli).atZone(java.time.ZoneOffset.UTC));
    }

    private record DeliveryResult(
            boolean success,
            String errorMessage
    ) {}
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Processor only - delivery status recorded by PRD-017f
**ADR-013 (Camel-First):** Processor used in notification Camel route
**ADR-014 (Named Processors):** DeliverEmailNotificationProcessor is @Named
**ADR-015 (Tiered Storage):** Not applicable (notification delivery only)

## Dependencies

```xml
<!-- pom.xml -->
<dependency>
    <groupId>jakarta.mail</groupId>
    <artifactId>jakarta.mail-api</artifactId>
    <version>2.1.2</version>
</dependency>
<dependency>
    <groupId>org.eclipse.angus</groupId>
    <artifactId>angus-mail</artifactId>
    <version>2.0.2</version>
</dependency>
```

## Configuration

```properties
# application.properties
fluo.notifications.email.from=alerts@fluo.example.com
fluo.base-url=https://fluo.example.com
```

## Test Requirements (QA Expert)

**Unit Tests:**
- testProcess_SuccessfulDelivery - email sent successfully
- testProcess_NoRecipients - skips when no recipients configured
- testProcess_SmtpException - handles SMTP errors gracefully
- testBuildPlainTextBody - generates plain text with all fields
- testBuildHtmlBody - generates HTML with styling
- testBuildHtmlBody_CriticalSeverity - uses red color
- testBuildHtmlBody_HighSeverity - uses orange color
- testBuildHtmlBody_MediumSeverity - uses yellow color
- testBuildHtmlBody_LowSeverity - uses green color
- testBuildSmtpProperties - configures SMTP with TLS
- testDeliverEmail_MultipleRecipients - sends to multiple addresses

**Integration Tests:**
- testFullWorkflow_DeliverEmail - real SMTP delivery (requires test server)

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- SMTP credential leakage - mitigate with encrypted config storage
- Email injection - mitigate with proper RFC 5322 address validation
- HTML injection - mitigate with HTML escaping
- SMTP relay abuse - mitigate with authentication required
- Timeout exploitation - mitigate with 10s timeout

**Compliance:**
- SOC2 CC7.2 (System Monitoring) - email delivery proves incident communication
- Email provides durable audit trail (recipients can forward to auditors)

## Success Criteria

- [ ] Send email via SMTP with TLS
- [ ] Support multiple recipients
- [ ] Include HTML and plain text versions
- [ ] Style HTML with severity colors
- [ ] Include View in FLUO button
- [ ] Format timestamps in UTC
- [ ] Record delivery status
- [ ] All tests pass with 90% coverage
