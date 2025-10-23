# PRD-014a: Test Execution Service

**Priority:** P1 (User Workflow)
**Complexity:** Medium (Component)
**Type:** Unit PRD
**Parent:** PRD-014 (Developer Rule Testing)
**Dependencies:** PRD-009 (Trace Ingestion), PRD-005 (Rule Engine Sandboxing)

## Problem

Developers need to test BeTrace DSL rules against sample traces before deploying to production. Without an isolated test execution environment, rules cannot be validated, leading to high false positive rates and bugs discovered only in production.

## Solution

Implement isolated test execution service that runs rules in sandboxed Drools session with no side effects. Takes rule DSL and trace JSON as input, executes rule, and returns detailed results showing which spans matched and whether signal would be generated.

## Unit Description

**File:** `backend/src/main/java/com/fluo/services/RuleTestingService.java`
**Type:** CDI ApplicationScoped Service
**Purpose:** Execute rules in isolated environment for testing without creating real signals

## Implementation

```java
package com.fluo.services;

import com.fluo.model.Span;
import com.fluo.model.Signal;
import com.fluo.rules.dsl.DroolsGenerator;
import com.fluo.rules.dsl.FluoDslParser;
import io.opentelemetry.proto.trace.v1.Span as OtelSpan;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.drools.core.event.DefaultAgendaEventListener;
import org.kie.api.KieBase;
import org.kie.api.KieServices;
import org.kie.api.builder.KieBuilder;
import org.kie.api.builder.KieFileSystem;
import org.kie.api.builder.Message;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.kie.api.runtime.rule.Match;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

@ApplicationScoped
public class RuleTestingService {
    private static final Logger log = LoggerFactory.getLogger(RuleTestingService.class);

    @Inject
    FluoDslParser dslParser;

    @Inject
    DroolsGenerator droolsGenerator;

    /**
     * Execute rule against sample trace in isolated session
     * @param ruleDsl BeTrace DSL rule to test
     * @param spans List of spans from trace
     * @return Test execution result
     */
    public TestExecutionResult executeTest(String ruleDsl, List<Span> spans) {
        long startTime = System.currentTimeMillis();

        try {
            // Parse DSL
            var ruleExpression = dslParser.parse(ruleDsl);

            // Generate Drools DRL
            String droolsDrl = droolsGenerator.generate(
                "test-rule-" + UUID.randomUUID(),
                ruleExpression
            );

            log.debug("Generated Drools DRL for test:\n{}", droolsDrl);

            // Create isolated KieSession
            KieSession kieSession = createIsolatedSession(droolsDrl);

            // Track rule activations
            TestRuleListener listener = new TestRuleListener();
            kieSession.addEventListener(listener);

            // Insert spans into working memory
            for (Span span : spans) {
                kieSession.insert(span);
            }

            // Fire rules
            int rulesFired = kieSession.fireAllRules();

            // Dispose session (no persistence)
            kieSession.dispose();

            long executionTime = System.currentTimeMillis() - startTime;

            // Build result
            return new TestExecutionResult(
                listener.ruleFired,
                listener.matchedSpans,
                listener.signalGenerated,
                executionTime,
                rulesFired,
                extractRuleDetails(listener)
            );

        } catch (Exception e) {
            log.error("Test execution failed: {}", e.getMessage(), e);
            throw new TestExecutionException("Failed to execute test: " + e.getMessage(), e);
        }
    }

    /**
     * Create isolated KieSession with no globals or side effects
     * @param droolsDrl Drools DRL rule definition
     * @return Isolated KieSession
     */
    private KieSession createIsolatedSession(String droolsDrl) {
        KieServices kieServices = KieServices.Factory.get();
        KieFileSystem kieFileSystem = kieServices.newKieFileSystem();

        // Write DRL to virtual file system
        kieFileSystem.write("src/main/resources/test-rule.drl", droolsDrl);

        // Build KieModule
        KieBuilder kieBuilder = kieServices.newKieBuilder(kieFileSystem);
        kieBuilder.buildAll();

        // Check for errors
        if (kieBuilder.getResults().hasMessages(Message.Level.ERROR)) {
            List<Message> errors = kieBuilder.getResults().getMessages(Message.Level.ERROR);
            String errorMsg = errors.stream()
                    .map(Message::getText)
                    .reduce((a, b) -> a + "\n" + b)
                    .orElse("Unknown error");
            throw new IllegalStateException("DRL compilation failed: " + errorMsg);
        }

        // Create KieContainer
        KieContainer kieContainer = kieServices.newKieContainer(
                kieBuilder.getKieModule().getReleaseId()
        );

        // Create new session (isolated, no persistence)
        KieSession kieSession = kieContainer.newKieSession();

        // CRITICAL: Do NOT set globals (security isolation)
        // No SignalService, no TenantService, no side effects

        log.debug("Created isolated KieSession for test execution");
        return kieSession;
    }

    /**
     * Parse OTLP trace JSON to Span objects
     * @param traceJson OTLP trace JSON string
     * @return List of Span objects
     */
    public List<Span> parseTraceJson(String traceJson) {
        try {
            // Parse OTLP JSON to protobuf
            var tracesData = io.opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest
                    .newBuilder()
                    .mergeFrom(traceJson.getBytes())
                    .build();

            List<Span> spans = new ArrayList<>();

            for (var resourceSpan : tracesData.getResourceSpansList()) {
                for (var scopeSpan : resourceSpan.getScopeSpansList()) {
                    for (var otelSpan : scopeSpan.getSpansList()) {
                        spans.add(convertOtelSpan(otelSpan));
                    }
                }
            }

            log.info("Parsed {} spans from trace JSON", spans.size());
            return spans;

        } catch (Exception e) {
            log.error("Failed to parse trace JSON: {}", e.getMessage(), e);
            throw new IllegalArgumentException("Invalid trace JSON: " + e.getMessage(), e);
        }
    }

    private Span convertOtelSpan(OtelSpan otelSpan) {
        Span span = new Span();
        span.setSpanId(bytesToHex(otelSpan.getSpanId().toByteArray()));
        span.setTraceId(bytesToHex(otelSpan.getTraceId().toByteArray()));
        span.setName(otelSpan.getName());
        span.setStartTime(otelSpan.getStartTimeUnixNano());
        span.setEndTime(otelSpan.getEndTimeUnixNano());

        // Convert attributes
        Map<String, Object> attributes = new HashMap<>();
        for (var attr : otelSpan.getAttributesList()) {
            attributes.put(attr.getKey(), extractAttributeValue(attr.getValue()));
        }
        span.setAttributes(attributes);

        return span;
    }

    private Object extractAttributeValue(io.opentelemetry.proto.common.v1.AnyValue value) {
        switch (value.getValueCase()) {
            case STRING_VALUE: return value.getStringValue();
            case BOOL_VALUE: return value.getBoolValue();
            case INT_VALUE: return value.getIntValue();
            case DOUBLE_VALUE: return value.getDoubleValue();
            default: return null;
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private Map<String, Object> extractRuleDetails(TestRuleListener listener) {
        Map<String, Object> details = new HashMap<>();
        details.put("activationCount", listener.activationCount);
        details.put("matchedSpanIds", listener.matchedSpans.stream()
                .map(Span::getSpanId)
                .toList());
        return details;
    }

    /**
     * Listener to track rule activations during test execution
     */
    private static class TestRuleListener extends DefaultAgendaEventListener {
        boolean ruleFired = false;
        List<Span> matchedSpans = new ArrayList<>();
        Signal signalGenerated = null;
        int activationCount = 0;

        @Override
        public void afterMatchFired(org.kie.api.event.rule.AfterMatchFiredEvent event) {
            ruleFired = true;
            activationCount++;

            Match match = event.getMatch();

            // Extract matched spans from rule activation
            for (Object obj : match.getObjects()) {
                if (obj instanceof Span) {
                    matchedSpans.add((Span) obj);
                }
            }

            log.debug("Rule fired: {}, matched {} spans",
                    match.getRule().getName(), matchedSpans.size());
        }
    }

    /**
     * Test execution result DTO
     */
    public static class TestExecutionResult {
        public final boolean ruleFired;
        public final List<Span> matchedSpans;
        public final Signal signalGenerated;
        public final long executionTimeMs;
        public final int rulesFired;
        public final Map<String, Object> ruleDetails;

        public TestExecutionResult(
                boolean ruleFired,
                List<Span> matchedSpans,
                Signal signalGenerated,
                long executionTimeMs,
                int rulesFired,
                Map<String, Object> ruleDetails
        ) {
            this.ruleFired = ruleFired;
            this.matchedSpans = matchedSpans;
            this.signalGenerated = signalGenerated;
            this.executionTimeMs = executionTimeMs;
            this.rulesFired = rulesFired;
            this.ruleDetails = ruleDetails;
        }
    }

    public static class TestExecutionException extends RuntimeException {
        public TestExecutionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
```

## Architecture Integration

**ADR-011 (TigerBeetle-First):** Service only - test results recorded by PRD-014c
**ADR-013 (Camel-First):** Used by ExecuteRuleTestProcessor in Camel route
**ADR-014 (Named Processors):** Service injected into processors
**ADR-015 (Tiered Storage):** Not applicable (in-memory execution only)

## Test Requirements (QA Expert)

**Unit Tests:**
- testExecuteTest_RuleFires - rule matches spans, returns matched span IDs
- testExecuteTest_RuleDoesNotFire - no spans match, returns empty result
- testExecuteTest_MultipleSpansMatch - multiple spans trigger rule
- testExecuteTest_InvalidDsl - throws TestExecutionException on bad DSL
- testCreateIsolatedSession_NoGlobals - session has no SignalService global
- testCreateIsolatedSession_NoPersistence - session disposal does not save
- testParseTraceJson_ValidOtlp - parses OTLP JSON to Span objects
- testParseTraceJson_InvalidJson - throws IllegalArgumentException
- testConvertOtelSpan_AllAttributes - converts string, bool, int, double attributes
- testExecutionTime_MeasuredCorrectly - execution time in milliseconds
- testMatchedSpans_Identified - listener captures spans from rule activation

**Integration Tests:**
- testFullTestExecution_WithSampleTrace - parse JSON → execute → return result
- testIsolation_NoSignalsCreated - test execution does not persist signals
- testComplexRule_MultipleConditions - rule with AND/OR conditions

**Security Tests:**
- testNoGlobals_CannotAccessSignalService - isolated session has no globals
- testNoSideEffects_NoDatabaseWrites - test execution does not write to DB
- testMaliciousRule_Sandboxed - rule cannot access filesystem or network

**Test Coverage:** 90% minimum (ADR-014)

## Security Considerations (Security Expert)

**Threats & Mitigations:**
- Malicious DSL code execution - mitigate with isolated KieSession, no globals
- Resource exhaustion (infinite loops) - mitigate with fireAllRules() timeout (future)
- Memory leaks from unclosed sessions - mitigate with try-finally disposal
- Side effects in test mode - mitigate by not setting SignalService global
- Rule accessing production data - mitigate with test-only spans, no DB access

**Compliance:**
- SOC2 CC8.1 (Change Management) - test execution proves rule validation
- NIST 800-53 CM-3 (Change Control) - isolated testing environment

## Success Criteria

- [ ] Execute rule in isolated Drools session
- [ ] Parse OTLP trace JSON to Span objects
- [ ] Return matched spans and execution time
- [ ] No side effects (no signals created)
- [ ] No globals (SignalService not accessible)
- [ ] Session disposed after test
- [ ] All tests pass with 90% coverage
