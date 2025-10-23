# PRD-017b: Notification Rules Processor

**Priority:** P1 (User Workflow)
**Complexity:** Simple (Component)
**Type:** Unit PRD
**Parent:** PRD-017 (Alert and Notification System)
**Dependencies:** PRD-017a (NotificationConfigService), PRD-008 (Signal Management)

## Problem

Not all signals should trigger notifications. Need to evaluate notification rules (severity filter, rule ID filter, category filter, quiet hours) to determine whether to send notification for a given signal.

## Solution

Implement processor that evaluates notification rules against signal metadata. Check severity level, rule ID, category, and current time against quiet hours. Return boolean decision on whether to notify.

## Unit Description

**File:** `backend/src/main/java/com/betrace/processors/EvaluateNotificationRulesProcessor.java`
**Type:** CDI Named Processor
**Purpose:** Evaluate whether signal should trigger notifications based on configured rules

## Implementation

```java
package com.betrace.processors;

import com.betrace.model.NotificationConfig;
import com.betrace.model.Signal;
import com.betrace.services.NotificationConfigService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Named("evaluateNotificationRulesProcessor")
@ApplicationScoped
public class EvaluateNotificationRulesProcessor implements Processor {
    private static final Logger log = LoggerFactory.getLogger(EvaluateNotificationRulesProcessor.class);

    @Inject
    NotificationConfigService notificationConfigService;

    @Override
    public void process(Exchange exchange) throws Exception {
        Signal signal = exchange.getIn().getBody(Signal.class);
        UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);

        // Load enabled notification configs for tenant
        List<NotificationConfig> configs = notificationConfigService.listEnabledConfigs(tenantId);

        if (configs.isEmpty()) {
            log.debug("No enabled notification configs for tenant {}", tenantId);
            exchange.getIn().setHeader("shouldNotify", false);
            exchange.getIn().setHeader("notificationConfigs", new ArrayList<>());
            return;
        }

        // Evaluate rules for each config
        List<NotificationConfig> matchingConfigs = new ArrayList<>();
        for (NotificationConfig config : configs) {
            if (shouldNotify(signal, config)) {
                matchingConfigs.add(config);
            }
        }

        boolean shouldNotify = !matchingConfigs.isEmpty();
        exchange.getIn().setHeader("shouldNotify", shouldNotify);
        exchange.getIn().setHeader("notificationConfigs", matchingConfigs);

        log.info("Notification rules evaluated: signal={}, shouldNotify={}, matchingConfigs={}",
                signal.getId(), shouldNotify, matchingConfigs.size());
    }

    /**
     * Evaluate whether signal matches notification config rules
     * @param signal Signal to evaluate
     * @param config Notification configuration
     * @return true if signal should trigger notification
     */
    private boolean shouldNotify(Signal signal, NotificationConfig config) {
        // Check quiet hours first (fastest check)
        if (config.isQuietHoursEnabled() && isQuietHours(config)) {
            log.debug("Signal {} skipped: quiet hours active", signal.getId());
            return false;
        }

        // If notify_all is true, notify on every signal (ignore filters)
        if (config.isNotifyAll()) {
            log.debug("Signal {} matched: notify_all enabled", signal.getId());
            return true;
        }

        // Check severity filter
        if (!config.getSeverityFilter().isEmpty()) {
            if (!config.getSeverityFilter().contains(signal.getSeverity().toLowerCase())) {
                log.debug("Signal {} skipped: severity {} not in filter {}",
                        signal.getId(), signal.getSeverity(), config.getSeverityFilter());
                return false;
            }
        }

        // Check rule ID filter
        if (!config.getRuleIds().isEmpty()) {
            if (!config.getRuleIds().contains(signal.getRuleId())) {
                log.debug("Signal {} skipped: rule_id {} not in filter {}",
                        signal.getId(), signal.getRuleId(), config.getRuleIds());
                return false;
            }
        }

        // Check category filter
        if (!config.getCategories().isEmpty()) {
            String signalCategory = determineCategory(signal);
            if (!config.getCategories().contains(signalCategory)) {
                log.debug("Signal {} skipped: category {} not in filter {}",
                        signal.getId(), signalCategory, config.getCategories());
                return false;
            }
        }

        log.debug("Signal {} matched notification rules for config {}", signal.getId(), config.getId());
        return true;
    }

    /**
     * Check if current time is within quiet hours
     * @param config Notification configuration with quiet hours settings
     * @return true if currently in quiet hours
     */
    private boolean isQuietHours(NotificationConfig config) {
        if (!config.isQuietHoursEnabled()) {
            return false;
        }

        LocalTime now = ZonedDateTime.now(ZoneId.of(config.getQuietHoursTimezone())).toLocalTime();
        LocalTime start = config.getQuietHoursStart();
        LocalTime end = config.getQuietHoursEnd();

        // Handle quiet hours that span midnight (e.g., 22:00 - 06:00)
        if (start.isBefore(end)) {
            // Normal case: quiet hours within same day
            return now.isAfter(start) && now.isBefore(end);
        } else {
            // Spans midnight: quiet hours from start to 23:59:59 OR 00:00:00 to end
            return now.isAfter(start) || now.isBefore(end);
        }
    }

    /**
     * Determine signal category from rule name or attributes
     * @param signal Signal to categorize
     * @return Category string (authentication, pii, compliance, unknown)
     */
    private String determineCategory(Signal signal) {
        String ruleName = signal.getRuleName().toLowerCase();

        if (ruleName.contains("auth") || ruleName.contains("login")) {
            return "authentication";
        } else if (ruleName.contains("pii") || ruleName.contains("redact")) {
            return "pii";
        } else if (ruleName.contains("compliance") || ruleName.contains("soc2") || ruleName.contains("hipaa")) {
            return "compliance";
        } else {
            return "unknown";
        }
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Processor only - reads configs from DuckDB
**ADR-013 (Camel-First):** Processor used in notification Camel route
**ADR-014 (Named Processors):** EvaluateNotificationRulesProcessor is @Named
**ADR-015 (Tiered Storage):** Not applicable (rules evaluation only)

## Test Requirements (QA Expert)

**Unit Tests:**
- testProcess_NoConfigs - shouldNotify=false when no configs exist
- testProcess_MatchingSeverity - shouldNotify=true when severity matches filter
- testProcess_NonMatchingSeverity - shouldNotify=false when severity doesn't match
- testProcess_MatchingRuleId - shouldNotify=true when rule ID in filter
- testProcess_NonMatchingRuleId - shouldNotify=false when rule ID not in filter
- testProcess_MatchingCategory - shouldNotify=true when category matches
- testProcess_NonMatchingCategory - shouldNotify=false when category doesn't match
- testProcess_NotifyAll - shouldNotify=true regardless of filters
- testProcess_QuietHours - shouldNotify=false during quiet hours
- testIsQuietHours_WithinHours - returns true when in quiet hours
- testIsQuietHours_OutsideHours - returns false when outside quiet hours
- testIsQuietHours_SpansMidnight - handles quiet hours crossing midnight
- testDetermineCategory_Authentication - categorizes auth-related signals
- testDetermineCategory_PII - categorizes PII-related signals
- testDetermineCategory_Compliance - categorizes compliance signals
- testDetermineCategory_Unknown - returns unknown for unrecognized signals

**Integration Tests:**
- testFullWorkflow_CreateConfigEvaluate - create config → evaluate signal
- testMultipleConfigs_DifferentRules - signal matches subset of configs

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Notification bypasses - mitigate with strict rule evaluation order
- Timezone attacks - mitigate with validated timezone strings
- Rule injection - mitigate with prepared statements in config service
- Category manipulation - mitigate with deterministic category logic

**Compliance:**
- SOC2 CC7.2 (System Monitoring) - notification rules enforce communication policies

## Success Criteria

- [ ] Evaluate notification rules for signal
- [ ] Filter by severity (critical, high, medium, low)
- [ ] Filter by rule ID
- [ ] Filter by category (authentication, pii, compliance)
- [ ] Respect quiet hours with timezone support
- [ ] Handle quiet hours spanning midnight
- [ ] Return list of matching configs
- [ ] All tests pass with 90% coverage
