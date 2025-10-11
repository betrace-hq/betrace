# PRD-017a: Notification Config Service

**Priority:** P1 (User Workflow)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-017 (Alert and Notification System)
**Dependencies:** PRD-002 (TigerBeetle Persistence)

## Problem

Tenants need to configure notification channels (webhook, Slack, email) and rules for when to send notifications. Without a config service, there's no way to manage notification preferences or test delivery.

## Solution

Implement service to manage notification configurations stored in DuckDB. Support CRUD operations for notification channels, validation of webhook URLs and Slack webhooks, and test notification delivery.

## Unit Description

**File:** `backend/src/main/java/com/fluo/services/NotificationConfigService.java`
**Type:** CDI ApplicationScoped Service
**Purpose:** Manage notification channel configurations and rules

## Implementation

```java
package com.fluo.services;

import io.duckdb.DuckDBConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class NotificationConfigService {
    private static final Logger log = LoggerFactory.getLogger(NotificationConfigService.class);

    @Inject
    DuckDBConnection duckDB;

    /**
     * Create notification configuration
     * @param config Notification configuration
     * @return Created config with ID
     */
    public NotificationConfig createConfig(NotificationConfig config) {
        String sql = """
            INSERT INTO notification_configs (
                id, tenant_id, channel_type, enabled,
                webhook_url, webhook_headers,
                slack_webhook_url, slack_channel,
                email_addresses, email_smtp_config,
                notify_all, severity_filter, rule_ids, categories,
                quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;

        UUID id = UUID.randomUUID();

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, id);
            stmt.setObject(2, config.getTenantId());
            stmt.setString(3, config.getChannelType());
            stmt.setBoolean(4, config.isEnabled());

            // Webhook config
            stmt.setString(5, config.getWebhookUrl());
            stmt.setString(6, config.getWebhookHeadersJson());

            // Slack config
            stmt.setString(7, config.getSlackWebhookUrl());
            stmt.setString(8, config.getSlackChannel());

            // Email config
            stmt.setArray(9, duckDB.createArrayOf("VARCHAR", config.getEmailAddresses().toArray()));
            stmt.setString(10, config.getEmailSmtpConfigJson());

            // Notification rules
            stmt.setBoolean(11, config.isNotifyAll());
            stmt.setArray(12, duckDB.createArrayOf("VARCHAR", config.getSeverityFilter().toArray()));
            stmt.setArray(13, duckDB.createArrayOf("UUID", config.getRuleIds().toArray()));
            stmt.setArray(14, duckDB.createArrayOf("VARCHAR", config.getCategories().toArray()));

            // Quiet hours
            stmt.setBoolean(15, config.isQuietHoursEnabled());
            stmt.setObject(16, config.getQuietHoursStart());
            stmt.setObject(17, config.getQuietHoursEnd());
            stmt.setString(18, config.getQuietHoursTimezone());

            stmt.executeUpdate();

            log.info("Created notification config: id={}, tenant={}, channel={}",
                    id, config.getTenantId(), config.getChannelType());

            config.setId(id);
            return config;

        } catch (Exception e) {
            log.error("Failed to create notification config: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create notification config", e);
        }
    }

    /**
     * Get notification config by ID
     * @param configId Config UUID
     * @return Notification config
     */
    public NotificationConfig getConfig(UUID configId) {
        String sql = """
            SELECT * FROM notification_configs WHERE id = ?
        """;

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, configId);
            ResultSet rs = stmt.executeQuery();

            if (rs.next()) {
                return mapRow(rs);
            }

            throw new IllegalArgumentException("Notification config not found: " + configId);

        } catch (Exception e) {
            log.error("Failed to get notification config: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get notification config", e);
        }
    }

    /**
     * List all notification configs for tenant
     * @param tenantId Tenant UUID
     * @return List of notification configs
     */
    public List<NotificationConfig> listConfigs(UUID tenantId) {
        String sql = """
            SELECT * FROM notification_configs
            WHERE tenant_id = ?
            ORDER BY created_at DESC
        """;

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, tenantId);
            ResultSet rs = stmt.executeQuery();

            List<NotificationConfig> configs = new ArrayList<>();
            while (rs.next()) {
                configs.add(mapRow(rs));
            }

            log.debug("Loaded {} notification configs for tenant {}", configs.size(), tenantId);
            return configs;

        } catch (Exception e) {
            log.error("Failed to list notification configs: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to list notification configs", e);
        }
    }

    /**
     * List enabled notification configs for tenant
     * @param tenantId Tenant UUID
     * @return List of enabled configs
     */
    public List<NotificationConfig> listEnabledConfigs(UUID tenantId) {
        String sql = """
            SELECT * FROM notification_configs
            WHERE tenant_id = ? AND enabled = true
            ORDER BY created_at DESC
        """;

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, tenantId);
            ResultSet rs = stmt.executeQuery();

            List<NotificationConfig> configs = new ArrayList<>();
            while (rs.next()) {
                configs.add(mapRow(rs));
            }

            log.debug("Loaded {} enabled notification configs for tenant {}", configs.size(), tenantId);
            return configs;

        } catch (Exception e) {
            log.error("Failed to list enabled notification configs: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to list enabled notification configs", e);
        }
    }

    /**
     * Update notification config
     * @param config Updated config
     * @return Updated config
     */
    public NotificationConfig updateConfig(NotificationConfig config) {
        String sql = """
            UPDATE notification_configs SET
                enabled = ?,
                webhook_url = ?,
                webhook_headers = ?,
                slack_webhook_url = ?,
                slack_channel = ?,
                email_addresses = ?,
                email_smtp_config = ?,
                notify_all = ?,
                severity_filter = ?,
                rule_ids = ?,
                categories = ?,
                quiet_hours_enabled = ?,
                quiet_hours_start = ?,
                quiet_hours_end = ?,
                quiet_hours_timezone = ?,
                updated_at = NOW()
            WHERE id = ?
        """;

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setBoolean(1, config.isEnabled());
            stmt.setString(2, config.getWebhookUrl());
            stmt.setString(3, config.getWebhookHeadersJson());
            stmt.setString(4, config.getSlackWebhookUrl());
            stmt.setString(5, config.getSlackChannel());
            stmt.setArray(6, duckDB.createArrayOf("VARCHAR", config.getEmailAddresses().toArray()));
            stmt.setString(7, config.getEmailSmtpConfigJson());
            stmt.setBoolean(8, config.isNotifyAll());
            stmt.setArray(9, duckDB.createArrayOf("VARCHAR", config.getSeverityFilter().toArray()));
            stmt.setArray(10, duckDB.createArrayOf("UUID", config.getRuleIds().toArray()));
            stmt.setArray(11, duckDB.createArrayOf("VARCHAR", config.getCategories().toArray()));
            stmt.setBoolean(12, config.isQuietHoursEnabled());
            stmt.setObject(13, config.getQuietHoursStart());
            stmt.setObject(14, config.getQuietHoursEnd());
            stmt.setString(15, config.getQuietHoursTimezone());
            stmt.setObject(16, config.getId());

            int updated = stmt.executeUpdate();

            if (updated == 0) {
                throw new IllegalArgumentException("Notification config not found: " + config.getId());
            }

            log.info("Updated notification config: id={}", config.getId());
            return config;

        } catch (Exception e) {
            log.error("Failed to update notification config: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to update notification config", e);
        }
    }

    /**
     * Delete notification config
     * @param configId Config UUID
     */
    public void deleteConfig(UUID configId) {
        String sql = "DELETE FROM notification_configs WHERE id = ?";

        try (PreparedStatement stmt = duckDB.prepareStatement(sql)) {
            stmt.setObject(1, configId);
            int deleted = stmt.executeUpdate();

            if (deleted == 0) {
                throw new IllegalArgumentException("Notification config not found: " + configId);
            }

            log.info("Deleted notification config: id={}", configId);

        } catch (Exception e) {
            log.error("Failed to delete notification config: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete notification config", e);
        }
    }

    /**
     * Test notification delivery
     * @param configId Config UUID
     * @return Test result (success or error message)
     */
    public TestResult testNotification(UUID configId) {
        NotificationConfig config = getConfig(configId);

        try {
            switch (config.getChannelType()) {
                case "webhook" -> testWebhook(config.getWebhookUrl());
                case "slack" -> testSlackWebhook(config.getSlackWebhookUrl());
                case "email" -> testEmail(config.getEmailAddresses(), config.getEmailSmtpConfigJson());
                default -> throw new IllegalArgumentException("Unknown channel type: " + config.getChannelType());
            }

            log.info("Test notification succeeded: configId={}", configId);
            return new TestResult(true, "Test notification delivered successfully");

        } catch (Exception e) {
            log.error("Test notification failed: configId={}, error={}", configId, e.getMessage(), e);
            return new TestResult(false, "Test failed: " + e.getMessage());
        }
    }

    private void testWebhook(String webhookUrl) throws Exception {
        // Send test payload to webhook
        java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
        java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(webhookUrl))
                .header("Content-Type", "application/json")
                .POST(java.net.http.HttpRequest.BodyPublishers.ofString("""
                    {"event": "test", "message": "FLUO test notification"}
                """))
                .build();

        java.net.http.HttpResponse<String> response = client.send(
                request,
                java.net.http.HttpResponse.BodyHandlers.ofString()
        );

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new Exception("Webhook returned status: " + response.statusCode());
        }
    }

    private void testSlackWebhook(String slackWebhookUrl) throws Exception {
        // Send test message to Slack
        java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
        java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(slackWebhookUrl))
                .header("Content-Type", "application/json")
                .POST(java.net.http.HttpRequest.BodyPublishers.ofString("""
                    {"text": "FLUO test notification"}
                """))
                .build();

        java.net.http.HttpResponse<String> response = client.send(
                request,
                java.net.http.HttpResponse.BodyHandlers.ofString()
        );

        if (response.statusCode() != 200) {
            throw new Exception("Slack webhook returned status: " + response.statusCode());
        }
    }

    private void testEmail(List<String> emailAddresses, String smtpConfigJson) throws Exception {
        // Test SMTP connection and send test email
        // Implementation would use JavaMail or similar
        throw new UnsupportedOperationException("Email testing not yet implemented");
    }

    private NotificationConfig mapRow(ResultSet rs) throws Exception {
        NotificationConfig config = new NotificationConfig();
        config.setId((UUID) rs.getObject("id"));
        config.setTenantId((UUID) rs.getObject("tenant_id"));
        config.setChannelType(rs.getString("channel_type"));
        config.setEnabled(rs.getBoolean("enabled"));

        config.setWebhookUrl(rs.getString("webhook_url"));
        config.setWebhookHeadersJson(rs.getString("webhook_headers"));

        config.setSlackWebhookUrl(rs.getString("slack_webhook_url"));
        config.setSlackChannel(rs.getString("slack_channel"));

        config.setEmailAddresses(List.of((String[]) rs.getArray("email_addresses").getArray()));
        config.setEmailSmtpConfigJson(rs.getString("email_smtp_config"));

        config.setNotifyAll(rs.getBoolean("notify_all"));
        config.setSeverityFilter(List.of((String[]) rs.getArray("severity_filter").getArray()));
        config.setRuleIds(List.of((UUID[]) rs.getArray("rule_ids").getArray()));
        config.setCategories(List.of((String[]) rs.getArray("categories").getArray()));

        config.setQuietHoursEnabled(rs.getBoolean("quiet_hours_enabled"));
        config.setQuietHoursStart((LocalTime) rs.getObject("quiet_hours_start"));
        config.setQuietHoursEnd((LocalTime) rs.getObject("quiet_hours_end"));
        config.setQuietHoursTimezone(rs.getString("quiet_hours_timezone"));

        config.setCreatedAt(rs.getTimestamp("created_at").toInstant());
        config.setUpdatedAt(rs.getTimestamp("updated_at").toInstant());

        return config;
    }

    public record TestResult(boolean success, String message) {}
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Notification configs stored in DuckDB (not TigerBeetle - configs are mutable)
**ADR-013 (Camel-First):** Service used by notification processors
**ADR-014 (Named Processors):** Service injected into processors
**ADR-015 (Tiered Storage):** Not applicable (configs in DuckDB only)

## Test Requirements (QA Expert)

**Unit Tests:**
- testCreateConfig - creates config with all fields
- testGetConfig - retrieves config by ID
- testGetConfig_NotFound - throws exception when not found
- testListConfigs - returns all configs for tenant
- testListEnabledConfigs - filters by enabled=true
- testUpdateConfig - updates all fields
- testUpdateConfig_NotFound - throws exception
- testDeleteConfig - removes config
- testDeleteConfig_NotFound - throws exception
- testTestNotification_Webhook - sends test to webhook URL
- testTestNotification_Slack - sends test to Slack
- testTenantIsolation - tenant A cannot access tenant B configs

**Integration Tests:**
- testFullWorkflow_CreateTestDelete - create → test → delete
- testWebhookValidation - rejects invalid URLs

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- SSRF via webhook URL - mitigate with URL validation, allowlist
- Credential leakage in logs - mitigate by not logging sensitive fields
- SQL injection - mitigate with prepared statements
- Unauthorized access - mitigate with tenant ID filtering
- Webhook header injection - mitigate with strict validation

**Compliance:**
- SOC2 CC6.1 (Access Control) - tenant isolation enforced
- SOC2 CC7.2 (System Monitoring) - notification configs auditable

## Success Criteria

- [ ] Create notification config (webhook, Slack, email)
- [ ] List notification configs for tenant
- [ ] Update notification config
- [ ] Delete notification config
- [ ] Test notification delivery
- [ ] Tenant isolation enforced
- [ ] All tests pass with 90% coverage
