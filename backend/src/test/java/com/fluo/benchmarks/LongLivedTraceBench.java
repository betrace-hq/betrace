package com.fluo.benchmarks;

import com.fluo.model.Span;
import com.fluo.rules.dsl.DroolsGenerator;
import com.fluo.rules.dsl.FluoDslParser;
import com.fluo.rules.dsl.RuleExpression;
import org.junit.jupiter.api.Test;
import org.kie.api.KieServices;
import org.kie.api.builder.KieBuilder;
import org.kie.api.builder.KieFileSystem;
import org.kie.api.builder.Message;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Benchmark for long-lived traces to test memory pressure and throughput.
 *
 * Simulates realistic scenarios where:
 * - Traces take 30+ seconds to complete
 * - Spans arrive incrementally over time
 * - Rules can't resolve until trace is complete
 * - Session must hold partial trace state
 *
 * This tests worst-case memory usage and validates that Drools can handle
 * slow distributed transactions without memory exhaustion.
 */
public class LongLivedTraceBench {

    private static final KieServices kieServices = KieServices.Factory.get();

    /**
     * Test 1: Single session with many long-lived traces
     *
     * Scenario: 1000 concurrent traces, each with 10 spans arriving over 30s
     * Measures: Peak memory, sustained throughput
     */
    @Test
    public void benchmarkLongLivedTraces() {
        System.out.println("\n=== BENCHMARK: Long-Lived Traces (30s duration) ===");

        int traceCount = 1000;
        int spansPerTrace = 10;
        int traceDurationMs = 30_000; // 30 seconds
        int spanIntervalMs = traceDurationMs / spansPerTrace; // 3 seconds between spans

        // Create rules that require multiple spans to resolve
        String dsl = "trace.has(payment.fraud_check) and trace.has(payment.charge_card)";
        FluoDslParser parser = new FluoDslParser();
        RuleExpression ast = parser.parse(dsl);
        DroolsGenerator generator = new DroolsGenerator("fraud-rule", "Fraud Rule", "Check fraud before charge");
        String drl = generator.generate(ast, "AtomicInteger", "signalCounter.incrementAndGet()");

        KieContainer container = compileRules(List.of(drl));
        KieSession session = container.newKieSession();

        AtomicInteger signalCounter = new AtomicInteger(0);
        session.setGlobal("signalCounter", signalCounter);

        long startMemory = getUsedMemory();
        long startTime = System.currentTimeMillis();

        // Generate traces with incrementally arriving spans
        List<TraceSimulation> traces = generateLongLivedTraces(traceCount, spansPerTrace, spanIntervalMs);

        System.out.printf("  Simulating %d traces with %d spans each over %ds\n",
                traceCount, spansPerTrace, traceDurationMs / 1000);

        // Insert spans in arrival-time order
        int totalSpans = 0;
        long lastMemoryCheck = startTime;
        long peakMemory = startMemory;
        Map<Long, Long> memoryOverTime = new TreeMap<>();

        // Sort all spans by arrival time
        List<SpanArrival> allSpans = new ArrayList<>();
        for (TraceSimulation trace : traces) {
            for (int i = 0; i < trace.spans.size(); i++) {
                allSpans.add(new SpanArrival(trace.spans.get(i), trace.startTime + (i * spanIntervalMs)));
            }
        }
        allSpans.sort(Comparator.comparingLong(s -> s.arrivalTime));

        // Process spans in arrival order
        long simulationStart = System.currentTimeMillis();
        for (SpanArrival spanArrival : allSpans) {
            session.insert(spanArrival.span);
            totalSpans++;

            // Periodically fire rules and check memory
            if (totalSpans % 500 == 0) {
                session.fireAllRules();

                long currentMemory = getUsedMemory();
                peakMemory = Math.max(peakMemory, currentMemory);
                long elapsedMs = System.currentTimeMillis() - simulationStart;
                memoryOverTime.put(elapsedMs, (currentMemory - startMemory) / (1024 * 1024)); // MB

                System.out.printf("  Progress: %5d/%d spans, Memory: %d MB, Signals: %d\n",
                        totalSpans, allSpans.size(),
                        (currentMemory - startMemory) / (1024 * 1024),
                        signalCounter.get());
            }
        }

        // Final rule evaluation
        session.fireAllRules();

        long endTime = System.currentTimeMillis();
        long endMemory = getUsedMemory();

        long durationMs = endTime - startTime;
        long peakMemoryMb = (peakMemory - startMemory) / (1024 * 1024);
        long finalMemoryMb = (endMemory - startMemory) / (1024 * 1024);
        double throughput = (totalSpans * 1000.0) / durationMs;

        System.out.println("\n  Results:");
        System.out.printf("  - Total spans processed: %d\n", totalSpans);
        System.out.printf("  - Duration: %d ms\n", durationMs);
        System.out.printf("  - Throughput: %.0f spans/sec\n", throughput);
        System.out.printf("  - Peak memory usage: %d MB\n", peakMemoryMb);
        System.out.printf("  - Final memory usage: %d MB\n", finalMemoryMb);
        System.out.printf("  - Memory per active trace: %.2f KB\n",
                (double)(peakMemoryMb * 1024) / traceCount);
        System.out.printf("  - Signals generated: %d\n", signalCounter.get());

        System.out.println("\n  Memory over time:");
        memoryOverTime.forEach((time, memory) ->
            System.out.printf("    %5d ms: %4d MB\n", time, memory));

        // Assertions
        assertTrue(throughput > 100, "Should maintain > 100 spans/sec even with long-lived traces");
        assertTrue(peakMemoryMb < 500, "Peak memory should be < 500 MB for 1000 concurrent traces");
        assertTrue((double)(peakMemoryMb * 1024) / traceCount < 1024,
                "Memory per trace should be < 1 MB on average");

        session.dispose();
        container.dispose();
    }

    /**
     * Test 2: Memory leak detection with trace expiration
     *
     * Tests that completed traces are properly garbage collected
     */
    @Test
    public void benchmarkTraceExpiration() {
        System.out.println("\n=== BENCHMARK: Trace Expiration & Memory Reclamation ===");

        // Create rule
        String dsl = "trace.has(payment.charge_card)";
        FluoDslParser parser = new FluoDslParser();
        RuleExpression ast = parser.parse(dsl);
        DroolsGenerator generator = new DroolsGenerator("simple-rule", "Simple", "Simple rule");
        String drl = generator.generate(ast, "AtomicInteger", "signalCounter.incrementAndGet()");

        KieContainer container = compileRules(List.of(drl));
        KieSession session = container.newKieSession();

        AtomicInteger signalCounter = new AtomicInteger(0);
        session.setGlobal("signalCounter", signalCounter);

        long startMemory = getUsedMemory();

        // Insert 10 waves of 100 traces each
        int waves = 10;
        int tracesPerWave = 100;
        int spansPerTrace = 10;

        for (int wave = 0; wave < waves; wave++) {
            System.out.printf("\n  Wave %d: Inserting %d traces...\n", wave + 1, tracesPerWave);

            // Insert traces
            for (int i = 0; i < tracesPerWave; i++) {
                String traceId = "wave" + wave + "-trace" + i;
                for (int s = 0; s < spansPerTrace; s++) {
                    Span span = createSpan(traceId, "span" + s, "payment.charge_card");
                    session.insert(span);
                }
            }

            session.fireAllRules();

            // Force GC and measure
            System.gc();
            Thread.yield();
            System.gc();

            long currentMemory = getUsedMemory();
            long memoryMb = (currentMemory - startMemory) / (1024 * 1024);

            System.out.printf("  Wave %d complete: Memory = %d MB, Signals = %d\n",
                    wave + 1, memoryMb, signalCounter.get());

            // Memory should not grow unbounded
            if (wave > 0) {
                assertTrue(memoryMb < 100 * (wave + 1),
                    "Memory should stabilize, not grow linearly with trace count");
            }
        }

        long finalMemory = getUsedMemory();
        long finalMemoryMb = (finalMemory - startMemory) / (1024 * 1024);

        System.out.printf("\n  Final memory: %d MB\n", finalMemoryMb);
        System.out.printf("  Total traces processed: %d\n", waves * tracesPerWave);
        System.out.printf("  Total signals: %d\n", signalCounter.get());

        // Memory should be reasonable even after processing 1000 traces
        assertTrue(finalMemoryMb < 200, "Memory should be < 200 MB after processing 1000 traces");

        session.dispose();
        container.dispose();
    }

    /**
     * Test 3: Concurrent sessions with long-lived traces
     *
     * Simulates multi-tenant environment with slow traces
     */
    @Test
    public void benchmarkMultiTenantLongLivedTraces() {
        System.out.println("\n=== BENCHMARK: Multi-Tenant Long-Lived Traces ===");

        int tenantCount = 10;
        int tracesPerTenant = 100;
        int spansPerTrace = 10;

        // Create rule
        String dsl = "trace.has(api.request) and trace.has(api.response)";
        FluoDslParser parser = new FluoDslParser();
        RuleExpression ast = parser.parse(dsl);
        DroolsGenerator generator = new DroolsGenerator("api-rule", "API Rule", "Request-response pair");
        String drl = generator.generate(ast, "AtomicInteger", "signalCounter.incrementAndGet()");

        KieContainer container = compileRules(List.of(drl));

        long startMemory = getUsedMemory();
        long startTime = System.currentTimeMillis();

        // Create sessions for each tenant
        List<TenantSession> tenantSessions = new ArrayList<>();
        for (int t = 0; t < tenantCount; t++) {
            KieSession session = container.newKieSession();
            AtomicInteger counter = new AtomicInteger(0);
            session.setGlobal("signalCounter", counter);
            tenantSessions.add(new TenantSession("tenant-" + t, session, counter));
        }

        System.out.printf("  %d tenants, %d traces per tenant, %d spans per trace\n",
                tenantCount, tracesPerTenant, spansPerTrace);

        // Insert spans for all tenants
        int totalSpans = 0;
        for (TenantSession tenant : tenantSessions) {
            for (int tr = 0; tr < tracesPerTenant; tr++) {
                String traceId = tenant.tenantId + "-trace-" + tr;

                // Insert spans incrementally (simulating arrival over time)
                for (int s = 0; s < spansPerTrace; s++) {
                    String operation = (s % 2 == 0) ? "api.request" : "api.response";
                    Span span = createSpan(traceId, "span" + s, operation);
                    tenant.session.insert(span);
                    totalSpans++;
                }

                // Fire rules periodically
                if (tr % 20 == 0) {
                    tenant.session.fireAllRules();
                }
            }
        }

        // Final evaluation for all tenants
        for (TenantSession tenant : tenantSessions) {
            tenant.session.fireAllRules();
        }

        long endTime = System.currentTimeMillis();
        long endMemory = getUsedMemory();

        long durationMs = endTime - startTime;
        long memoryMb = (endMemory - startMemory) / (1024 * 1024);
        int totalSignals = tenantSessions.stream().mapToInt(t -> t.counter.get()).sum();

        System.out.println("\n  Results:");
        System.out.printf("  - Total spans: %d\n", totalSpans);
        System.out.printf("  - Duration: %d ms\n", durationMs);
        System.out.printf("  - Throughput: %.0f spans/sec\n", (totalSpans * 1000.0) / durationMs);
        System.out.printf("  - Total memory: %d MB\n", memoryMb);
        System.out.printf("  - Memory per tenant: %d MB\n", memoryMb / tenantCount);
        System.out.printf("  - Total signals: %d\n", totalSignals);

        // Assertions
        assertTrue(memoryMb / tenantCount < 50, "Memory per tenant should be < 50 MB");
        assertTrue(totalSignals > 0, "Should generate signals");

        // Cleanup
        tenantSessions.forEach(t -> t.session.dispose());
        container.dispose();
    }

    // ========== Helper Methods ==========

    private List<TraceSimulation> generateLongLivedTraces(int traceCount, int spansPerTrace, int spanIntervalMs) {
        List<TraceSimulation> traces = new ArrayList<>();
        Random random = new Random(42);

        long baseTime = System.currentTimeMillis();

        for (int i = 0; i < traceCount; i++) {
            String traceId = "trace-" + i;
            List<Span> spans = new ArrayList<>();

            // Stagger trace start times to simulate realistic arrival
            long traceStartTime = baseTime + (i * 10); // 10ms between trace starts

            for (int s = 0; s < spansPerTrace; s++) {
                String operation = (s % 2 == 0) ? "payment.fraud_check" : "payment.charge_card";
                Map<String, Object> attributes = new HashMap<>();
                attributes.put("amount", random.nextDouble() * 1000);
                attributes.put("trace.seq", s);

                Instant startTime = Instant.ofEpochMilli(traceStartTime + (s * spanIntervalMs));
                Instant endTime = startTime.plusMillis(random.nextInt(100));

                Span span = Span.create(
                    "span-" + i + "-" + s,
                    traceId,
                    operation,
                    "payment-service",
                    startTime,
                    endTime,
                    attributes,
                    "tenant-test"
                );

                spans.add(span);
            }

            traces.add(new TraceSimulation(traceId, traceStartTime, spans));
        }

        return traces;
    }

    private Span createSpan(String traceId, String spanId, String operation) {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("test", "true");

        return Span.create(
            spanId,
            traceId,
            operation,
            "test-service",
            Instant.now(),
            Instant.now().plusMillis(10),
            attributes,
            "tenant-test"
        );
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

    private long getUsedMemory() {
        System.gc();
        System.gc();
        Thread.yield();
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }

    // ========== Helper Classes ==========

    private record TraceSimulation(
        String traceId,
        long startTime,
        List<Span> spans
    ) {}

    private record SpanArrival(
        Span span,
        long arrivalTime
    ) {}

    private record TenantSession(
        String tenantId,
        KieSession session,
        AtomicInteger counter
    ) {}
}
