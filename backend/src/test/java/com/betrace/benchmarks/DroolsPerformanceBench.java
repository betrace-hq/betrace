package com.fluo.benchmarks;

import com.fluo.model.Span;
import com.fluo.rules.dsl.DroolsGenerator;
import com.fluo.rules.dsl.FluoDslParser;
import com.fluo.rules.dsl.RuleExpression;
import org.drools.core.ClockType;
import org.junit.jupiter.api.Test;
import org.kie.api.KieServices;
import org.kie.api.builder.KieBuilder;
import org.kie.api.builder.KieFileSystem;
import org.kie.api.builder.Message;
import org.kie.api.conf.EventProcessingOption;
import org.kie.api.io.ResourceType;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.kie.api.runtime.conf.ClockTypeOption;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Performance benchmarks for Drools-based trace rule evaluation.
 *
 * This benchmark suite validates FLUO's resource requirements:
 * - Rule compilation time and memory
 * - Span evaluation throughput (target: 1000+ spans/sec)
 * - Rule evaluation latency (target: <10ms p99)
 * - Memory per tenant (expected: 5-20 MB)
 * - Memory per rule (expected: 1-10 KB)
 * - Multi-tenant scaling
 *
 * GO/NO-GO DECISION: If benchmarks don't meet targets, reconsider architecture.
 */
public class DroolsPerformanceBench {

    private static final KieServices kieServices = KieServices.Factory.get();

    /**
     * Test 1: Rule Compilation Performance
     * Measures time and memory to compile 1, 10, 50, 100 rules per tenant
     */
    @Test
    public void benchmarkRuleCompilation() {
        System.out.println("\n=== BENCHMARK 1: Rule Compilation ===");

        int[] ruleCounts = {1, 10, 50, 100};

        for (int count : ruleCounts) {
            long startTime = System.nanoTime();
            long startMemory = getUsedMemory();

            List<String> drlRules = generateTestRules(count);
            KieContainer container = compileRules(drlRules);

            long endTime = System.nanoTime();
            long endMemory = getUsedMemory();

            long durationMs = (endTime - startTime) / 1_000_000;
            long memoryUsedKb = (endMemory - startMemory) / 1024;
            long memoryPerRuleKb = memoryUsedKb / count;

            System.out.printf("  %3d rules: %5d ms, %6d KB total, %4d KB/rule\n",
                    count, durationMs, memoryUsedKb, memoryPerRuleKb);

            // Assertions
            assertTrue(durationMs < 5000, "Compilation should take < 5s for " + count + " rules");
            // Note: First rule includes KieContainer overhead, so we accept higher memory
            if (count == 1) {
                assertTrue(memoryPerRuleKb < 20000, "First rule (with KieContainer) should use < 20 MB");
            } else {
                assertTrue(memoryPerRuleKb < 1000, "Each additional rule should use < 1 MB");
            }

            container.dispose();
        }
    }

    /**
     * Test 2: Span Throughput
     * Measures how many spans/sec can be evaluated
     * Target: 1000+ spans/sec
     */
    @Test
    public void benchmarkSpanThroughput() {
        System.out.println("\n=== BENCHMARK 2: Span Throughput ===");

        // Create session with 10 rules
        List<String> drlRules = generateTestRules(10);
        KieContainer container = compileRules(drlRules);
        KieSession session = container.newKieSession();

        AtomicInteger signalsGenerated = new AtomicInteger(0);
        session.setGlobal("signalCounter", signalsGenerated);

        int spanCount = 10000;
        List<Span> spans = generateTestSpans(spanCount, 100); // 100 traces

        long startTime = System.nanoTime();

        for (Span span : spans) {
            session.insert(span);
        }
        session.fireAllRules();

        long endTime = System.nanoTime();
        long durationMs = (endTime - startTime) / 1_000_000;
        double spansPerSec = (spanCount * 1000.0) / durationMs;

        System.out.printf("  Processed %d spans in %d ms\n", spanCount, durationMs);
        System.out.printf("  Throughput: %.0f spans/sec\n", spansPerSec);
        System.out.printf("  Signals generated: %d\n", signalsGenerated.get());

        // Assertion
        assertTrue(spansPerSec > 1000, "Throughput should be > 1000 spans/sec");

        session.dispose();
        container.dispose();
    }

    /**
     * Test 3: Rule Evaluation Latency
     * Measures p50, p95, p99 latency for rule evaluation
     * Target: <10ms p99
     */
    @Test
    public void benchmarkEvaluationLatency() {
        System.out.println("\n=== BENCHMARK 3: Evaluation Latency ===");

        // Create session with 20 rules
        List<String> drlRules = generateTestRules(20);
        KieContainer container = compileRules(drlRules);
        KieSession session = container.newKieSession();

        AtomicInteger signalCounter = new AtomicInteger(0);
        session.setGlobal("signalCounter", signalCounter);

        int iterations = 1000;
        List<Long> latencies = new ArrayList<>(iterations);

        for (int i = 0; i < iterations; i++) {
            Span span = generateRandomSpan("trace-" + (i % 100));

            long startTime = System.nanoTime();
            session.insert(span);
            session.fireAllRules();
            long endTime = System.nanoTime();

            latencies.add((endTime - startTime) / 1_000); // microseconds
        }

        latencies.sort(Long::compareTo);
        long p50 = latencies.get(iterations / 2);
        long p95 = latencies.get((int) (iterations * 0.95));
        long p99 = latencies.get((int) (iterations * 0.99));

        System.out.printf("  p50 latency: %d μs (%.2f ms)\n", p50, p50 / 1000.0);
        System.out.printf("  p95 latency: %d μs (%.2f ms)\n", p95, p95 / 1000.0);
        System.out.printf("  p99 latency: %d μs (%.2f ms)\n", p99, p99 / 1000.0);

        // Assertion
        assertTrue(p99 < 10_000, "p99 latency should be < 10ms (10,000 μs)");

        session.dispose();
        container.dispose();
    }

    /**
     * Test 4: Memory Per Tenant
     * Measures actual memory usage per tenant session
     * Expected: 5-20 MB per tenant
     */
    @Test
    public void benchmarkMemoryPerTenant() {
        System.out.println("\n=== BENCHMARK 4: Memory Per Tenant ===");

        int[] ruleCounts = {10, 50, 100};

        for (int count : ruleCounts) {
            long startMemory = getUsedMemory();

            List<String> drlRules = generateTestRules(count);
            KieContainer container = compileRules(drlRules);
            KieSession session = container.newKieSession();

            AtomicInteger signalCounter = new AtomicInteger(0);
            session.setGlobal("signalCounter", signalCounter);

            // Simulate active traces (1000 spans in session)
            List<Span> spans = generateTestSpans(1000, 50);
            for (Span span : spans) {
                session.insert(span);
            }

            long endMemory = getUsedMemory();
            long memoryUsedMb = (endMemory - startMemory) / (1024 * 1024);

            System.out.printf("  %3d rules + 1000 spans: %d MB\n", count, memoryUsedMb);

            // Assertion
            assertTrue(memoryUsedMb < 50, "Tenant memory should be < 50 MB (expected 5-20 MB)");

            session.dispose();
            container.dispose();
        }
    }

    /**
     * Test 5: Multi-Tenant Scaling
     * Simulates 100 tenants with concurrent sessions
     * Target: Handle 100-500 tenants on single instance
     */
    @Test
    public void benchmarkMultiTenantScaling() {
        System.out.println("\n=== BENCHMARK 5: Multi-Tenant Scaling ===");

        int tenantCount = 100;
        List<KieSession> sessions = new ArrayList<>();

        long startMemory = getUsedMemory();

        // Create 100 tenant sessions, each with 10 rules
        for (int i = 0; i < tenantCount; i++) {
            List<String> drlRules = generateTestRules(10);
            KieContainer container = compileRules(drlRules);
            KieSession session = container.newKieSession();

            AtomicInteger signalCounter = new AtomicInteger(0);
            session.setGlobal("signalCounter", signalCounter);

            sessions.add(session);
        }

        long afterSessionsMemory = getUsedMemory();
        long sessionMemoryMb = (afterSessionsMemory - startMemory) / (1024 * 1024);
        long memoryPerTenantMb = sessionMemoryMb / tenantCount;

        System.out.printf("  %d tenants created\n", tenantCount);
        System.out.printf("  Total memory: %d MB\n", sessionMemoryMb);
        System.out.printf("  Memory per tenant: %d MB\n", memoryPerTenantMb);

        // Insert spans into each session
        long startTime = System.nanoTime();
        for (KieSession session : sessions) {
            List<Span> spans = generateTestSpans(100, 10);
            for (Span span : spans) {
                session.insert(span);
            }
            session.fireAllRules();
        }
        long endTime = System.nanoTime();
        long durationMs = (endTime - startTime) / 1_000_000;

        System.out.printf("  Evaluated 100 spans across %d tenants in %d ms\n", tenantCount, durationMs);

        // Assertions
        assertTrue(memoryPerTenantMb < 50, "Memory per tenant should be < 50 MB");
        assertTrue(sessionMemoryMb < 5000, "Total memory for 100 tenants should be < 5 GB");

        // Cleanup
        sessions.forEach(KieSession::dispose);
    }

    /**
     * Test 6: Session Lifecycle and GC Pressure
     * Tests session creation/disposal to check for memory leaks
     */
    @Test
    public void benchmarkSessionLifecycle() {
        System.out.println("\n=== BENCHMARK 6: Session Lifecycle & GC ===");

        List<String> drlRules = generateTestRules(10);

        long startMemory = getUsedMemory();

        // Create and dispose 1000 sessions
        for (int i = 0; i < 1000; i++) {
            KieContainer container = compileRules(drlRules);
            KieSession session = container.newKieSession();

            // Insert some spans
            List<Span> spans = generateTestSpans(10, 1);
            for (Span span : spans) {
                session.insert(span);
            }
            session.fireAllRules();

            session.dispose();
            container.dispose();

            if (i % 100 == 0) {
                System.gc();
                long currentMemory = getUsedMemory();
                long memoryGrowthMb = (currentMemory - startMemory) / (1024 * 1024);
                System.out.printf("  After %4d sessions: %d MB growth\n", i, memoryGrowthMb);
            }
        }

        System.gc();
        Thread.yield();
        long endMemory = getUsedMemory();
        long memoryGrowthMb = (endMemory - startMemory) / (1024 * 1024);

        System.out.printf("  Final memory growth: %d MB\n", memoryGrowthMb);

        // Assertion: should not leak significant memory
        assertTrue(memoryGrowthMb < 100, "Memory growth should be < 100 MB after 1000 sessions");
    }

    // ========== Helper Methods ==========

    private List<String> generateTestRules(int count) {
        List<String> dslRules = new ArrayList<>();

        for (int i = 0; i < count; i++) {
            // Generate varied rules to test different patterns
            String dsl = switch (i % 5) {
                case 0 -> "trace.has(payment.charge_card) and not trace.has(payment.fraud_check)";
                case 1 -> "trace.has(database.query_pii).where(data.contains_pii == true)";
                case 2 -> "trace.has(api.request) and trace.has(auth.validate)";
                case 3 -> "trace.has(payment.process).where(amount > 1000)";
                case 4 -> "trace.count(retry.attempt) > 3";
                default -> "trace.has(operation.test)";
            };
            dslRules.add(dsl);
        }

        return compileDslToDrl(dslRules);
    }

    private List<String> compileDslToDrl(List<String> dslRules) {
        FluoDslParser parser = new FluoDslParser();
        List<String> drlRules = new ArrayList<>();

        for (int i = 0; i < dslRules.size(); i++) {
            RuleExpression ast = parser.parse(dslRules.get(i));
            DroolsGenerator generator = new DroolsGenerator("rule-" + i, "Test rule " + i, "tenant-test");
            String drl = generator.generate(ast, "AtomicInteger", "signalCounter.incrementAndGet()");
            drlRules.add(drl);
        }

        return drlRules;
    }

    private KieContainer compileRules(List<String> drlRules) {
        KieFileSystem kfs = kieServices.newKieFileSystem();

        for (int i = 0; i < drlRules.size(); i++) {
            kfs.write("src/main/resources/rules/rule" + i + ".drl", drlRules.get(i));
        }

        KieBuilder kieBuilder = kieServices.newKieBuilder(kfs);
        kieBuilder.buildAll();

        if (kieBuilder.getResults().hasMessages(Message.Level.ERROR)) {
            throw new RuntimeException("Compilation errors: " + kieBuilder.getResults().toString());
        }

        return kieServices.newKieContainer(kieBuilder.getKieModule().getReleaseId());
    }

    private List<Span> generateTestSpans(int count, int traceCount) {
        List<Span> spans = new ArrayList<>();
        Random random = new Random(42); // Fixed seed for reproducibility

        String[] operations = {
            "payment.charge_card", "payment.fraud_check", "payment.validate_request",
            "database.query_pii", "database.store",
            "api.request", "api.validate_key", "auth.validate",
            "retry.attempt", "operation.test"
        };

        for (int i = 0; i < count; i++) {
            String traceId = "trace-" + (i % traceCount);
            String spanId = "span-" + i;
            String operation = operations[random.nextInt(operations.length)];

            Map<String, Object> attributes = new HashMap<>();
            attributes.put("amount", random.nextDouble() * 2000);
            attributes.put("data.contains_pii", random.nextBoolean());
            attributes.put("tenant.id", "tenant-test");

            Instant startTime = Instant.now();
            Instant endTime = startTime.plusMillis(random.nextInt(100));

            Span span = Span.create(
                spanId,
                traceId,
                operation,
                "test-service",
                startTime,
                endTime,
                attributes,
                "tenant-test"
            );

            spans.add(span);
        }

        return spans;
    }

    private Span generateRandomSpan(String traceId) {
        Random random = new Random();
        String[] operations = {"payment.charge_card", "payment.fraud_check", "database.query_pii", "api.request"};

        Map<String, Object> attributes = new HashMap<>();
        attributes.put("tenant.id", "tenant-test");
        attributes.put("amount", random.nextDouble() * 1000);

        Instant startTime = Instant.now();
        Instant endTime = startTime.plusMillis(random.nextInt(50));

        return Span.create(
            UUID.randomUUID().toString(),
            traceId,
            operations[random.nextInt(operations.length)],
            "test-service",
            startTime,
            endTime,
            attributes,
            "tenant-test"
        );
    }

    private long getUsedMemory() {
        System.gc();
        System.gc();
        Thread.yield();
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }
}
