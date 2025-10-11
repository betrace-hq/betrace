# PRD-018d: Camel Route Integration Tests

**Priority:** P1 (Infrastructure - Test Foundation)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-018 (Comprehensive Test Suite)
**Dependencies:** PRD-004 (Rule Engine), PRD-008 (Signal Management), PRD-018c (IntegrationTestHarness)

## Problem

Camel routes are core to FLUO's architecture but lack comprehensive integration tests. No validation that routes correctly chain processors. No tests for route error handling, retries, or dead letter queues. Route changes risk breaking data flows.

## Solution

Implement integration tests for all critical Camel routes: span ingestion, rule evaluation, signal creation, notification delivery. Test end-to-end flows with real processors and mock external systems. Validate error handling and retry logic.

## Unit Description

**File:** `backend/src/test/java/com/fluo/integration/routes/`
**Type:** Integration Test Classes
**Purpose:** Validate Camel routes end-to-end with real processors

## Implementation

```java
// ============ SPAN INGESTION ROUTE TEST ============

package com.fluo.integration.routes;

import com.fluo.model.Span;
import com.fluo.test.harness.BaseIntegrationTest;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.component.mock.MockEndpoint;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for span ingestion Camel route
 * Route: direct:ingestSpans → validateSpansProcessor → enrichSpansProcessor
 *        → storeTigerBeetleProcessor → indexDuckDBProcessor
 */
@QuarkusTest
class SpanIngestionRouteTest extends BaseIntegrationTest {

    @Inject
    CamelContext camelContext;

    @Inject
    ProducerTemplate producerTemplate;

    @Test
    @DisplayName("Span ingestion route processes spans through all processors")
    void testSpanIngestionRoute_Success() throws Exception {
        // Given: Test tenant and spans
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        List<Span> spans = fixtures.createPIILeakTrace();

        // When: Send spans to route
        producerTemplate.sendBodyAndHeader("direct:ingestSpans", spans, "tenantId", tenantId);

        // Wait for async processing
        Thread.sleep(500);

        // Then: Spans stored in TigerBeetle and DuckDB
        // Query TigerBeetle for span transfers
        List<Transfer> transfers = queryTigerBeetleTransfers(CODE_SPAN);
        assertThat(transfers).hasSizeGreaterThan(0);

        // Query DuckDB for indexed spans
        List<Span> storedSpans = queryDuckDBSpans(tenantId);
        assertThat(storedSpans).hasSize(spans.size());
    }

    @Test
    @DisplayName("Span ingestion route handles invalid spans gracefully")
    void testSpanIngestionRoute_InvalidSpans() throws Exception {
        // Given: Invalid spans (missing required fields)
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        List<Span> invalidSpans = List.of(new Span()); // Empty span

        // When: Send invalid spans to route
        producerTemplate.sendBodyAndHeader("direct:ingestSpans", invalidSpans, "tenantId", tenantId);

        Thread.sleep(500);

        // Then: Error logged, no spans stored
        List<Span> storedSpans = queryDuckDBSpans(tenantId);
        assertThat(storedSpans).isEmpty();
    }

    @Test
    @DisplayName("Span ingestion route retries on TigerBeetle failure")
    void testSpanIngestionRoute_RetryLogic() throws Exception {
        // Given: Test tenant and spans
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        List<Span> spans = fixtures.createPIILeakTrace();

        // Simulate TigerBeetle failure (stop container temporarily)
        // In real implementation, use mock or fault injection

        // When: Send spans to route
        producerTemplate.sendBodyAndHeader("direct:ingestSpans", spans, "tenantId", tenantId);

        Thread.sleep(2000); // Wait for retries

        // Then: Route retried and eventually succeeded or sent to DLQ
        // Verify retry count in metrics or logs
    }
}

// ============ RULE EVALUATION ROUTE TEST ============

package com.fluo.integration.routes;

import com.fluo.model.*;
import com.fluo.services.RuleService;
import com.fluo.test.harness.BaseIntegrationTest;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.ProducerTemplate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for rule evaluation Camel route
 * Route: direct:evaluateRules → loadRulesProcessor → evaluateRuleProcessor
 *        → generateSignalProcessor → storeSignalProcessor
 */
@QuarkusTest
class RuleEvaluationRouteTest extends BaseIntegrationTest {

    @Inject
    ProducerTemplate producerTemplate;

    @Inject
    RuleService ruleService;

    @Test
    @DisplayName("Rule evaluation route generates signal when rule matches")
    void testRuleEvaluationRoute_Match() throws Exception {
        // Given: Tenant with PII detection rule
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        Rule rule = fixtures.createDetectPIILeakRule(tenantId);
        ruleService.createRule(rule);

        // And: Spans that match rule
        List<Span> spans = fixtures.createPIILeakTrace();
        String traceId = spans.get(0).getTraceId();

        // When: Trigger rule evaluation route
        producerTemplate.sendBodyAndHeader("direct:evaluateRules", spans, "tenantId", tenantId);

        Thread.sleep(500);

        // Then: Signal generated
        List<Signal> signals = queryDuckDBSignals(tenantId);
        assertThat(signals).hasSize(1);

        Signal signal = signals.get(0);
        assertThat(signal.getRuleId()).isEqualTo(rule.getId());
        assertThat(signal.getTraceId()).isEqualTo(traceId);
        assertThat(signal.getSeverity()).isEqualTo("critical");
    }

    @Test
    @DisplayName("Rule evaluation route skips when no rules match")
    void testRuleEvaluationRoute_NoMatch() throws Exception {
        // Given: Tenant with auth failure rule
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        Rule rule = fixtures.createDetectAuthFailureRule(tenantId);
        ruleService.createRule(rule);

        // And: Spans that DON'T match rule (payment trace, not auth)
        List<Span> spans = fixtures.createPaymentProcessingTrace();

        // When: Trigger rule evaluation route
        producerTemplate.sendBodyAndHeader("direct:evaluateRules", spans, "tenantId", tenantId);

        Thread.sleep(500);

        // Then: No signal generated
        List<Signal> signals = queryDuckDBSignals(tenantId);
        assertThat(signals).isEmpty();
    }

    @Test
    @DisplayName("Rule evaluation route processes multiple rules")
    void testRuleEvaluationRoute_MultipleRules() throws Exception {
        // Given: Tenant with 2 rules
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        Rule piiRule = fixtures.createDetectPIILeakRule(tenantId);
        Rule authRule = fixtures.createDetectAuthFailureRule(tenantId);
        ruleService.createRule(piiRule);
        ruleService.createRule(authRule);

        // And: Spans that match PII rule only
        List<Span> spans = fixtures.createPIILeakTrace();

        // When: Trigger rule evaluation route
        producerTemplate.sendBodyAndHeader("direct:evaluateRules", spans, "tenantId", tenantId);

        Thread.sleep(500);

        // Then: Only PII signal generated
        List<Signal> signals = queryDuckDBSignals(tenantId);
        assertThat(signals).hasSize(1);
        assertThat(signals.get(0).getRuleId()).isEqualTo(piiRule.getId());
    }
}

// ============ SIGNAL NOTIFICATION ROUTE TEST ============

package com.fluo.integration.routes;

import com.fluo.model.*;
import com.fluo.services.NotificationConfigService;
import com.fluo.test.harness.BaseIntegrationTest;
import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.ProducerTemplate;
import org.junit.jupiter.api.*;

import java.util.UUID;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for signal notification Camel route
 * Route: direct:notifySignal → loadNotificationConfigsProcessor
 *        → evaluateNotificationRulesProcessor → deliverWebhookProcessor
 */
@QuarkusTest
class SignalNotificationRouteTest extends BaseIntegrationTest {

    @Inject
    ProducerTemplate producerTemplate;

    @Inject
    NotificationConfigService notificationConfigService;

    private WireMockServer wireMockServer;

    @BeforeEach
    void setupWireMock() {
        wireMockServer = new WireMockServer(8089);
        wireMockServer.start();
        WireMock.configureFor("localhost", 8089);
    }

    @AfterEach
    void tearDownWireMock() {
        wireMockServer.stop();
    }

    @Test
    @DisplayName("Notification route delivers webhook when signal created")
    void testNotificationRoute_WebhookDelivery() throws Exception {
        // Given: Tenant with webhook notification config
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        NotificationConfig config = new NotificationConfig();
        config.setTenantId(tenantId);
        config.setChannelType("webhook");
        config.setWebhookUrl("http://localhost:8089/webhook");
        config.setNotifyAll(true);
        config.setEnabled(true);
        notificationConfigService.createConfig(config);

        // Mock webhook endpoint
        stubFor(post(urlEqualTo("/webhook"))
                .willReturn(aResponse().withStatus(200)));

        // And: Signal
        Signal signal = fixtures.createCriticalSignal(tenantId, UUID.randomUUID());

        // When: Trigger notification route
        producerTemplate.sendBodyAndHeader("direct:notifySignal", signal, "tenantId", tenantId);

        Thread.sleep(500);

        // Then: Webhook called
        verify(postRequestedFor(urlEqualTo("/webhook"))
                .withHeader("Content-Type", equalTo("application/json")));
    }

    @Test
    @DisplayName("Notification route respects quiet hours")
    void testNotificationRoute_QuietHours() throws Exception {
        // Given: Tenant with quiet hours enabled
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        NotificationConfig config = new NotificationConfig();
        config.setTenantId(tenantId);
        config.setChannelType("webhook");
        config.setWebhookUrl("http://localhost:8089/webhook");
        config.setNotifyAll(true);
        config.setEnabled(true);
        config.setQuietHoursEnabled(true);
        config.setQuietHoursStart("00:00");
        config.setQuietHoursEnd("23:59"); // All day quiet hours
        notificationConfigService.createConfig(config);

        // Mock webhook endpoint
        stubFor(post(urlEqualTo("/webhook"))
                .willReturn(aResponse().withStatus(200)));

        // And: Signal
        Signal signal = fixtures.createCriticalSignal(tenantId, UUID.randomUUID());

        // When: Trigger notification route
        producerTemplate.sendBodyAndHeader("direct:notifySignal", signal, "tenantId", tenantId);

        Thread.sleep(500);

        // Then: Webhook NOT called (quiet hours active)
        verify(0, postRequestedFor(urlEqualTo("/webhook")));
    }

    @Test
    @DisplayName("Notification route retries on webhook failure")
    void testNotificationRoute_RetryOnFailure() throws Exception {
        // Given: Tenant with webhook notification config
        UUID tenantId = fixtures.createTenant("Test Corp").id;
        NotificationConfig config = new NotificationConfig();
        config.setTenantId(tenantId);
        config.setChannelType("webhook");
        config.setWebhookUrl("http://localhost:8089/webhook");
        config.setNotifyAll(true);
        config.setEnabled(true);
        notificationConfigService.createConfig(config);

        // Mock webhook endpoint - fail first 2 times, succeed on 3rd
        stubFor(post(urlEqualTo("/webhook"))
                .inScenario("retry")
                .whenScenarioStateIs("Started")
                .willReturn(aResponse().withStatus(500))
                .willSetStateTo("FirstRetry"));

        stubFor(post(urlEqualTo("/webhook"))
                .inScenario("retry")
                .whenScenarioStateIs("FirstRetry")
                .willReturn(aResponse().withStatus(500))
                .willSetStateTo("SecondRetry"));

        stubFor(post(urlEqualTo("/webhook"))
                .inScenario("retry")
                .whenScenarioStateIs("SecondRetry")
                .willReturn(aResponse().withStatus(200)));

        // And: Signal
        Signal signal = fixtures.createCriticalSignal(tenantId, UUID.randomUUID());

        // When: Trigger notification route
        producerTemplate.sendBodyAndHeader("direct:notifySignal", signal, "tenantId", tenantId);

        Thread.sleep(5000); // Wait for retries (exponential backoff)

        // Then: Webhook called 3 times (2 failures + 1 success)
        verify(3, postRequestedFor(urlEqualTo("/webhook")));
    }
}

// ============ HELPER METHODS ============

package com.fluo.integration.routes;

import com.fluo.model.*;
import com.tigerbeetle.Transfer;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Helper methods for route integration tests
 */
abstract class RouteTestHelpers {

    protected List<Transfer> queryTigerBeetleTransfers(int code) {
        // Query TigerBeetle for transfers with specific code
        // Implementation depends on TigerBeetle client
        return new ArrayList<>();
    }

    protected List<Span> queryDuckDBSpans(UUID tenantId) throws Exception {
        // Query DuckDB for spans
        List<Span> spans = new ArrayList<>();
        try (Connection conn = getDuckDBConnection()) {
            String sql = "SELECT * FROM spans WHERE tenant_id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setObject(1, tenantId);
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Span span = new Span();
                        span.setTraceId(rs.getString("trace_id"));
                        span.setSpanId(rs.getString("span_id"));
                        span.setServiceName(rs.getString("service_name"));
                        spans.add(span);
                    }
                }
            }
        }
        return spans;
    }

    protected List<Signal> queryDuckDBSignals(UUID tenantId) throws Exception {
        // Query DuckDB for signals
        List<Signal> signals = new ArrayList<>();
        try (Connection conn = getDuckDBConnection()) {
            String sql = "SELECT * FROM signals WHERE tenant_id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setObject(1, tenantId);
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        Signal signal = new Signal();
                        signal.setId((UUID) rs.getObject("id"));
                        signal.setTenantId(tenantId);
                        signal.setRuleId((UUID) rs.getObject("rule_id"));
                        signal.setTraceId(rs.getString("trace_id"));
                        signal.setSeverity(rs.getString("severity"));
                        signals.add(signal);
                    }
                }
            }
        }
        return signals;
    }

    protected abstract Connection getDuckDBConnection() throws Exception;
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Tests validate TigerBeetle writes in routes
**ADR-013 (Camel-First):** Tests validate all Camel routes end-to-end
**ADR-014 (Named Processors):** Tests validate processor chains
**ADR-015 (Tiered Storage):** Tests validate data flow through storage tiers

## Routes Under Test

**Span Ingestion Route:**
- `direct:ingestSpans` → validate → enrich → TigerBeetle → DuckDB

**Rule Evaluation Route:**
- `direct:evaluateRules` → load rules → evaluate → generate signal → store

**Signal Notification Route:**
- `direct:notifySignal` → load configs → evaluate rules → deliver → record

## Test Requirements (QA Expert)

**Unit Tests:**
- testSpanIngestionRoute_Success - spans stored in TigerBeetle and DuckDB
- testSpanIngestionRoute_InvalidSpans - handles validation errors
- testSpanIngestionRoute_RetryLogic - retries on failures
- testRuleEvaluationRoute_Match - generates signal when rule matches
- testRuleEvaluationRoute_NoMatch - skips when no match
- testRuleEvaluationRoute_MultipleRules - evaluates all rules
- testNotificationRoute_WebhookDelivery - delivers webhook notification
- testNotificationRoute_QuietHours - respects quiet hours
- testNotificationRoute_RetryOnFailure - retries on webhook failure

**Integration Tests:**
- testFullPipeline_SpanToSignalToNotification - end-to-end workflow

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Webhook SSRF - mitigate with URL validation in tests
- Test data leakage - mitigate with ephemeral WireMock server

**Compliance:**
- SOC2 CC8.1 (Change Management) - route tests validate system behavior

## Success Criteria

- [ ] Integration tests for span ingestion route
- [ ] Integration tests for rule evaluation route
- [ ] Integration tests for signal notification route
- [ ] Tests validate processor chains end-to-end
- [ ] Tests validate error handling and retries
- [ ] WireMock for external system mocks (webhooks)
- [ ] Tests validate TigerBeetle and DuckDB writes
- [ ] All tests pass with 90% coverage
