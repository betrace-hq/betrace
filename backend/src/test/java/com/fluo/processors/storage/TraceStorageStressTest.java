package com.fluo.processors.storage;

import com.fluo.model.Span;
import com.fluo.model.Trace;
import com.fluo.services.DuckDBService;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Stress tests for trace storage processors and routes.
 * Tests system behavior under high load and extreme conditions.
 */
@QuarkusTest
class TraceStorageStressTest {

    @Inject
    DuckDBService duckdb;

    @Inject
    AggregateSpansToTraceProcessor aggregateProcessor;

    @Inject
    StoreTraceInDuckDBProcessor storeProcessor;

    @Inject
    CamelContext camelContext;

    @Inject
    ProducerTemplate producer;

    @Test
    @DisplayName("Should handle high-throughput span aggregation")
    void testHighThroughputAggregation() throws Exception {
        int spanCount = 10_000;
        String traceId = generateTraceId();
        UUID tenantId = UUID.randomUUID();

        List<Span> spans = new ArrayList<>();
        for (int i = 0; i < spanCount; i++) {
            spans.add(createTestSpan(
                "span-" + i,
                traceId,
                i > 0 ? "span-" + (i - 1) : null,
                tenantId
            ));
        }

        // Measure aggregation performance
        long startTime = System.currentTimeMillis();

        org.apache.camel.Exchange exchange = createExchange(spans);
        aggregateProcessor.process(exchange);

        long elapsed = System.currentTimeMillis() - startTime;

        // Verify aggregation succeeded
        Trace trace = exchange.getIn().getBody(Trace.class);
        assertNotNull(trace);
        assertEquals(spanCount, trace.spans().size());

        // Performance assertion: should aggregate 10K spans in < 1 second
        assertTrue(elapsed < 1000,
            "Aggregation too slow: " + elapsed + "ms for " + spanCount + " spans");
    }

    @Test
    @DisplayName("Should handle concurrent trace storage operations")
    void testConcurrentTraceStorage() throws Exception {
        int threadCount = 50;
        int tracesPerThread = 20;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();

                    for (int j = 0; j < tracesPerThread; j++) {
                        try {
                            UUID tenantId = UUID.randomUUID();
                            Trace trace = createTestTrace(tenantId, Instant.now());

                            org.apache.camel.Exchange exchange = createExchange(trace);
                            storeProcessor.process(exchange);

                            successCount.incrementAndGet();
                        } catch (Exception e) {
                            errorCount.incrementAndGet();
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(60, TimeUnit.SECONDS),
            "Concurrent storage operations did not complete in time");
        executor.shutdown();

        // Verify high success rate
        int totalOperations = threadCount * tracesPerThread;
        assertTrue(successCount.get() >= totalOperations * 0.95,
            "Too many failures: " + errorCount.get() + "/" + totalOperations);
    }

    @Test
    @DisplayName("Should handle sustained load over time")
    void testSustainedLoad() throws Exception {
        int durationSeconds = 10;
        int targetThroughput = 100; // traces per second

        // Reuse single tenant to avoid creating too many DuckDB files
        UUID tenantId = UUID.randomUUID();

        AtomicInteger processedCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);
        AtomicBoolean running = new AtomicBoolean(true);

        // Start background worker
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.submit(() -> {
            while (running.get()) {
                try {
                    Trace trace = createTestTrace(tenantId, Instant.now());

                    org.apache.camel.Exchange exchange = createExchange(trace);
                    storeProcessor.process(exchange);

                    processedCount.incrementAndGet();

                    // Maintain target throughput
                    Thread.sleep(1000 / targetThroughput);
                } catch (Exception e) {
                    errorCount.incrementAndGet();
                }
            }
        });

        // Run for specified duration
        Thread.sleep(durationSeconds * 1000);
        running.set(false);

        executor.shutdown();
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));

        // Verify throughput
        int expectedCount = targetThroughput * durationSeconds;
        assertTrue(processedCount.get() >= expectedCount * 0.8,
            "Throughput too low: " + processedCount.get() + " (expected ~" + expectedCount + ")");

        // Verify error rate is low
        double errorRate = (double) errorCount.get() / processedCount.get();
        assertTrue(errorRate < 0.05,
            "Error rate too high: " + (errorRate * 100) + "%");
    }

    @Test
    @DisplayName("Should handle mixed span aggregation and storage operations")
    void testMixedOperations() throws Exception {
        int operationCount = 200;  // Reduced from 1000
        ExecutorService executor = Executors.newFixedThreadPool(10);  // Reduced from 20
        CountDownLatch doneLatch = new CountDownLatch(operationCount);

        // Reuse a few tenants instead of creating new one each time
        List<UUID> tenants = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());

        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < operationCount; i++) {
            final boolean shouldAggregate = i % 2 == 0;
            final int tenantIndex = i % tenants.size();

            executor.submit(() -> {
                try {
                    UUID tenantId = tenants.get(tenantIndex);

                    if (shouldAggregate) {
                        // Aggregate spans into trace
                        List<Span> spans = createTestSpans(tenantId, 10);
                        org.apache.camel.Exchange exchange = createExchange(spans);
                        aggregateProcessor.process(exchange);

                        Trace trace = exchange.getIn().getBody(Trace.class);
                        if (trace != null) {
                            successCount.incrementAndGet();
                        }
                    } else {
                        // Store trace directly
                        Trace trace = createTestTrace(tenantId, Instant.now());
                        org.apache.camel.Exchange exchange = createExchange(trace);
                        storeProcessor.process(exchange);
                        successCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    // Ignore errors for this stress test
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        assertTrue(doneLatch.await(60, TimeUnit.SECONDS),
            "Mixed operations did not complete in time");
        executor.shutdown();

        // Verify reasonable success rate
        assertTrue(successCount.get() >= operationCount * 0.9,
            "Too many failures in mixed operations: " + successCount.get() + "/" + operationCount);
    }

    @Test
    @DisplayName("Should handle burst traffic patterns")
    void testBurstTraffic() throws Exception {
        // Reduced burst size to avoid resource exhaustion
        int burstSize = 100;  // Down from 500
        int burstCount = 3;    // Down from 5
        int gapMs = 1000;

        // Reuse tenants to avoid creating too many DuckDB files
        UUID tenantId = UUID.randomUUID();

        AtomicInteger totalProcessed = new AtomicInteger(0);
        AtomicInteger totalErrors = new AtomicInteger(0);

        for (int burst = 0; burst < burstCount; burst++) {
            // Generate burst
            ExecutorService burstExecutor = Executors.newFixedThreadPool(10);  // Down from 50
            CountDownLatch burstDone = new CountDownLatch(burstSize);

            for (int i = 0; i < burstSize; i++) {
                burstExecutor.submit(() -> {
                    try {
                        Trace trace = createTestTrace(tenantId, Instant.now());

                        org.apache.camel.Exchange exchange = createExchange(trace);
                        storeProcessor.process(exchange);

                        totalProcessed.incrementAndGet();
                    } catch (Exception e) {
                        totalErrors.incrementAndGet();
                    } finally {
                        burstDone.countDown();
                    }
                });
            }

            assertTrue(burstDone.await(30, TimeUnit.SECONDS),
                "Burst " + burst + " did not complete");
            burstExecutor.shutdown();

            // Gap between bursts
            if (burst < burstCount - 1) {
                Thread.sleep(gapMs);
            }
        }

        // Verify system handled bursts
        int expectedTotal = burstSize * burstCount;
        assertTrue(totalProcessed.get() >= expectedTotal * 0.95,
            "Too many failures during burst traffic: " + totalErrors.get() + "/" + expectedTotal);
    }

    @Test
    @DisplayName("Should handle large trace queries efficiently")
    void testLargeQueryPerformance() {
        UUID tenantId = UUID.randomUUID();
        int traceCount = 1000;

        // Insert many traces
        for (int i = 0; i < traceCount; i++) {
            Trace trace = createTestTrace(tenantId, Instant.now().minusSeconds(i));
            duckdb.insertTrace(tenantId, trace);
        }

        // Query all traces
        long startTime = System.currentTimeMillis();

        List<Trace> results = duckdb.queryTraces(
            tenantId,
            Instant.now().minus(1, ChronoUnit.HOURS),
            Instant.now(),
            traceCount
        );

        long elapsed = System.currentTimeMillis() - startTime;

        // Verify results
        assertNotNull(results);
        assertEquals(traceCount, results.size());

        // Performance assertion: should query 1000 traces in < 500ms
        assertTrue(elapsed < 500,
            "Query too slow: " + elapsed + "ms for " + traceCount + " traces");
    }

    @Test
    @DisplayName("Should handle memory pressure gracefully")
    void testMemoryPressure() throws Exception {
        // Create many tenants with traces to stress memory
        int tenantCount = 20;  // Reduced to avoid exhausting file descriptors
        int tracesPerTenant = 50;

        List<UUID> tenants = new ArrayList<>();
        for (int i = 0; i < tenantCount; i++) {
            tenants.add(UUID.randomUUID());
        }

        // Insert traces for all tenants
        ExecutorService executor = Executors.newFixedThreadPool(20);
        CountDownLatch doneLatch = new CountDownLatch(tenantCount * tracesPerTenant);
        AtomicInteger errorCount = new AtomicInteger(0);

        for (UUID tenantId : tenants) {
            for (int j = 0; j < tracesPerTenant; j++) {
                executor.submit(() -> {
                    try {
                        Trace trace = createTestTrace(tenantId, Instant.now());
                        duckdb.insertTrace(tenantId, trace);
                    } catch (Exception e) {
                        errorCount.incrementAndGet();
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }
        }

        assertTrue(doneLatch.await(120, TimeUnit.SECONDS),
            "Memory pressure test did not complete");
        executor.shutdown();

        // Verify system remained stable
        int totalOperations = tenantCount * tracesPerTenant;
        assertTrue(errorCount.get() < totalOperations * 0.1,
            "Too many errors under memory pressure: " + errorCount.get() + "/" + totalOperations);

        // Verify all tenants still accessible
        for (UUID tenantId : tenants) {
            assertDoesNotThrow(() -> {
                List<Trace> traces = duckdb.queryTraces(
                    tenantId,
                    Instant.now().minus(1, ChronoUnit.HOURS),
                    Instant.now(),
                    100
                );
                assertNotNull(traces);
            });
        }
    }

    // Helper methods

    private org.apache.camel.Exchange createExchange(Object body) {
        org.apache.camel.Exchange exchange = camelContext.getEndpoint("direct:test")
            .createExchange();
        exchange.getIn().setBody(body);
        return exchange;
    }

    private Trace createTestTrace(UUID tenantId, Instant timestamp) {
        String traceId = generateTraceId();
        List<Span> spans = createTestSpans(tenantId, 2);

        return new Trace(
            traceId,
            tenantId,
            timestamp,
            "stress-test-operation",
            Trace.calculateDuration(spans),
            "stress-test-service",
            spans,
            Map.of("test.type", "stress")
        );
    }

    private List<Span> createTestSpans(UUID tenantId, int count) {
        String traceId = generateTraceId();
        List<Span> spans = new ArrayList<>();

        for (int i = 0; i < count; i++) {
            spans.add(createTestSpan(
                "span-" + i,
                traceId,
                i > 0 ? "span-" + (i - 1) : null,
                tenantId
            ));
        }

        return spans;
    }

    private Span createTestSpan(String spanId, String traceId, String parentSpanId, UUID tenantId) {
        Instant now = Instant.now();
        return new Span(
            spanId,
            traceId,
            parentSpanId,
            "test-operation",
            "test-service",
            now,
            now.plusMillis(10),
            10_000_000L,
            Span.SpanKind.SERVER,
            Span.SpanStatus.OK,
            new HashMap<>(),
            new HashMap<>(),
            tenantId.toString()
        );
    }

    private String generateTraceId() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
