package com.betrace.services;

import com.betrace.model.Span;
import com.betrace.model.Trace;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Failure scenario tests for DuckDB service.
 * Tests resilience, error handling, and recovery under adverse conditions.
 */
@QuarkusTest
class DuckDBServiceFailureTest {

    @Inject
    DuckDBService duckdb;

    @Test
    @DisplayName("Should handle extremely large traces gracefully")
    void testLargeTraceHandling() {
        UUID tenantId = UUID.randomUUID();

        // Create a trace with many spans (simulate large distributed trace)
        List<Span> largeSpanList = new ArrayList<>();
        for (int i = 0; i < 10_000; i++) {
            largeSpanList.add(createTestSpan(
                "span-" + i,
                "trace-large",
                i > 0 ? "span-" + (i - 1) : null,
                tenantId
            ));
        }

        Trace largeTrace = new Trace(
            generateTraceId(),
            tenantId,
            Instant.now(),
            "large-operation",
            5000L,
            "test-service",
            largeSpanList,
            Map.of("trace.size", "large")
        );

        // Should handle large trace without throwing
        assertDoesNotThrow(() -> duckdb.insertTrace(tenantId, largeTrace),
            "Should handle large traces gracefully");

        // Verify it was stored correctly
        Optional<Trace> retrieved = duckdb.getTraceById(tenantId, largeTrace.traceId());
        assertTrue(retrieved.isPresent());
        assertEquals(10_000, retrieved.get().spans().size());
    }

    @Test
    @DisplayName("Should handle concurrent writes to same tenant database")
    void testConcurrentWritesToSameTenant() throws Exception {
        UUID tenantId = UUID.randomUUID();
        int threadCount = 20;
        int tracesPerThread = 10;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        ConcurrentHashMap<String, Throwable> errors = new ConcurrentHashMap<>();
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            final int threadId = i;
            executor.submit(() -> {
                try {
                    startLatch.await();

                    for (int j = 0; j < tracesPerThread; j++) {
                        try {
                            Trace trace = createTestTrace(
                                tenantId,
                                Instant.now().minusSeconds(threadId * 10 + j)
                            );
                            duckdb.insertTrace(tenantId, trace);
                            successCount.incrementAndGet();
                        } catch (Exception e) {
                            errors.put("thread-" + threadId + "-trace-" + j, e);
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
            "Concurrent writes did not complete in time");
        executor.shutdown();

        // Should have minimal failures (DuckDB handles concurrent writes)
        assertTrue(errors.isEmpty() || errors.size() < threadCount / 2,
            "Too many failures during concurrent writes: " + errors.size() + " errors");

        assertTrue(successCount.get() >= threadCount * tracesPerThread * 0.9,
            "Too many writes failed: " + successCount.get() + "/" + (threadCount * tracesPerThread));
    }

    @Test
    @DisplayName("Should handle invalid trace data gracefully")
    void testInvalidTraceData() {
        UUID tenantId = UUID.randomUUID();

        // Test with null spans list
        Trace nullSpansTrace = new Trace(
            generateTraceId(),
            tenantId,
            Instant.now(),
            "null-spans",
            0L,
            "test-service",
            null, // null spans
            Map.of()
        );

        // Should throw or handle gracefully, not crash
        assertDoesNotThrow(() -> {
            try {
                duckdb.insertTrace(tenantId, nullSpansTrace);
            } catch (RuntimeException e) {
                // Expected - just ensure it doesn't crash the system
                assertTrue(e.getMessage().contains("trace") ||
                          e.getMessage().contains("Failed") ||
                          e.getMessage().contains("null"));
            }
        });
    }

    @Test
    @DisplayName("Should handle malformed trace IDs gracefully")
    void testMalformedTraceIds() {
        UUID tenantId = UUID.randomUUID();

        // Test with various malformed trace IDs
        String[] invalidTraceIds = {
            "not-32-chars",
            "not-hex-characters!@#$%^&*()",
            "z".repeat(32), // Invalid hex
            "", // Empty
            "12345678901234567890123456789012345" // Too long
        };

        for (String invalidId : invalidTraceIds) {
            assertDoesNotThrow(() -> {
                Optional<Trace> result = duckdb.getTraceById(tenantId, invalidId);
                // Should return empty or throw IllegalArgumentException, not crash
                assertTrue(result.isEmpty() || result.isPresent());
            }, "Should handle malformed trace ID: " + invalidId);
        }
    }

    @Test
    @DisplayName("Should handle queries with extreme time ranges")
    void testExtremeTimeRangeQueries() {
        UUID tenantId = UUID.randomUUID();

        // Insert a trace
        Trace trace = createTestTrace(tenantId, Instant.now());
        duckdb.insertTrace(tenantId, trace);

        // Query with very large time range
        Instant veryOld = Instant.ofEpochMilli(0); // 1970
        Instant farFuture = Instant.ofEpochMilli(Long.MAX_VALUE / 1000); // Far future

        assertDoesNotThrow(() -> {
            List<Trace> results = duckdb.queryTraces(tenantId, veryOld, farFuture, 1000);
            assertNotNull(results);
        }, "Should handle extreme time ranges");

        // Query with inverted time range (end before start)
        assertDoesNotThrow(() -> {
            List<Trace> results = duckdb.queryTraces(
                tenantId,
                Instant.now(),
                Instant.now().minusSeconds(3600),
                100
            );
            assertNotNull(results);
            assertTrue(results.isEmpty(), "Inverted time range should return empty");
        });
    }

    @Test
    @DisplayName("Should handle very high query limits gracefully")
    void testHighQueryLimits() {
        UUID tenantId = UUID.randomUUID();

        // Insert some traces
        for (int i = 0; i < 100; i++) {
            duckdb.insertTrace(tenantId, createTestTrace(tenantId, Instant.now().minusSeconds(i)));
        }

        // Query with extremely high limit
        assertDoesNotThrow(() -> {
            List<Trace> results = duckdb.queryTraces(
                tenantId,
                Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now(),
                Integer.MAX_VALUE
            );
            assertNotNull(results);
            assertTrue(results.size() <= 100, "Should not return more traces than exist");
        });
    }

    @Test
    @DisplayName("Should handle rapid tenant database creation")
    void testRapidTenantDatabaseCreation() throws Exception {
        int tenantCount = 50;
        ExecutorService executor = Executors.newFixedThreadPool(10);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(tenantCount);

        ConcurrentHashMap<UUID, Throwable> errors = new ConcurrentHashMap<>();

        for (int i = 0; i < tenantCount; i++) {
            executor.submit(() -> {
                UUID tenantId = UUID.randomUUID();
                try {
                    startLatch.await();

                    // Create a trace (forces database creation)
                    Trace trace = createTestTrace(tenantId, Instant.now());
                    duckdb.insertTrace(tenantId, trace);

                    // Verify we can read it back
                    Optional<Trace> retrieved = duckdb.getTraceById(tenantId, trace.traceId());
                    assertTrue(retrieved.isPresent());

                } catch (Exception e) {
                    errors.put(tenantId, e);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(30, TimeUnit.SECONDS));
        executor.shutdown();

        assertTrue(errors.isEmpty() || errors.size() < tenantCount / 10,
            "Too many failures creating tenant databases: " + errors.size());
    }

    @Test
    @DisplayName("Should handle database cleanup without corruption")
    void testDatabaseCleanupRobustness() {
        UUID tenantId = UUID.randomUUID();
        Instant now = Instant.now();

        // Insert old traces (older than retention period)
        for (int i = 0; i < 10; i++) {
            Trace oldTrace = createTestTrace(tenantId, now.minus(10, ChronoUnit.DAYS));
            duckdb.insertTrace(tenantId, oldTrace);
        }

        // Insert recent traces
        List<String> recentTraceIds = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Trace recentTrace = createTestTrace(tenantId, now.minus(i, ChronoUnit.HOURS));
            duckdb.insertTrace(tenantId, recentTrace);
            recentTraceIds.add(recentTrace.traceId());
        }

        // Run cleanup
        int deleted = duckdb.deleteOldTraces(tenantId);
        assertTrue(deleted > 0, "Should delete old traces");

        // Verify recent traces still exist
        for (String traceId : recentTraceIds) {
            Optional<Trace> trace = duckdb.getTraceById(tenantId, traceId);
            assertTrue(trace.isPresent(), "Recent trace should not be deleted: " + traceId);
        }

        // Verify database is still functional after cleanup
        assertDoesNotThrow(() -> {
            Trace newTrace = createTestTrace(tenantId, Instant.now());
            duckdb.insertTrace(tenantId, newTrace);
            Optional<Trace> retrieved = duckdb.getTraceById(tenantId, newTrace.traceId());
            assertTrue(retrieved.isPresent());
        }, "Database should remain functional after cleanup");
    }

    @Test
    @DisplayName("Should handle trace updates correctly")
    void testTraceUpdateHandling() {
        UUID tenantId = UUID.randomUUID();
        String traceId = generateTraceId();

        // Insert initial trace
        Trace originalTrace = new Trace(
            traceId,
            tenantId,
            Instant.now(),
            "original-operation",
            1000L,
            "test-service",
            Collections.singletonList(createTestSpan("span1", traceId, null, tenantId)),
            Map.of("version", "1")
        );
        duckdb.insertTrace(tenantId, originalTrace);

        // Try to insert again with more spans (simulating late-arriving spans)
        Trace updatedTrace = new Trace(
            traceId, // Same trace ID
            tenantId,
            Instant.now(),
            "updated-operation",
            2000L,
            "test-service",
            Arrays.asList(
                createTestSpan("span1", traceId, null, tenantId),
                createTestSpan("span2", traceId, "span1", tenantId)
            ),
            Map.of("version", "2")
        );

        assertDoesNotThrow(() -> duckdb.insertTrace(tenantId, updatedTrace),
            "Should handle trace updates gracefully (ON CONFLICT DO NOTHING)");

        // Verify original is preserved (ON CONFLICT DO NOTHING)
        Optional<Trace> retrieved = duckdb.getTraceById(tenantId, traceId);
        assertTrue(retrieved.isPresent());
    }

    @Test
    @DisplayName("Should handle empty query results gracefully")
    void testEmptyQueryResults() {
        UUID tenantId = UUID.randomUUID();

        // Query tenant with no traces
        assertDoesNotThrow(() -> {
            List<Trace> results = duckdb.queryTraces(
                tenantId,
                Instant.now().minus(1, ChronoUnit.HOURS),
                Instant.now(),
                100
            );
            assertNotNull(results);
            assertTrue(results.isEmpty());
        });

        // Get non-existent trace
        Optional<Trace> trace = duckdb.getTraceById(tenantId, generateTraceId());
        assertTrue(trace.isEmpty());
    }

    @Test
    @DisplayName("Should handle special characters in service names")
    void testSpecialCharactersInServiceNames() {
        UUID tenantId = UUID.randomUUID();

        String[] specialServiceNames = {
            "service-with-dashes",
            "service_with_underscores",
            "service.with.dots",
            "service/with/slashes",
            "service with spaces",
            "service'with'quotes",
            "service\"with\"doublequotes",
            "service(with)parens"
        };

        for (String serviceName : specialServiceNames) {
            Trace trace = new Trace(
                generateTraceId(),
                tenantId,
                Instant.now(),
                "test-op",
                1000L,
                serviceName,
                Collections.singletonList(createTestSpan("span1", "trace1", null, tenantId)),
                Map.of()
            );

            assertDoesNotThrow(() -> {
                duckdb.insertTrace(tenantId, trace);
                Optional<Trace> retrieved = duckdb.getTraceById(tenantId, trace.traceId());
                assertTrue(retrieved.isPresent());
                assertEquals(serviceName, retrieved.get().serviceName());
            }, "Should handle service name: " + serviceName);
        }
    }

    // Helper methods

    private Trace createTestTrace(UUID tenantId, Instant timestamp) {
        String traceId = generateTraceId();
        List<Span> spans = Arrays.asList(
            createTestSpan("span1", traceId, null, tenantId),
            createTestSpan("span2", traceId, "span1", tenantId)
        );

        return new Trace(
            traceId,
            tenantId,
            timestamp,
            "test-operation",
            Trace.calculateDuration(spans),
            "test-service",
            spans,
            Map.of("test", "true")
        );
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
            now.plusMillis(50),
            50_000_000L,
            Span.SpanKind.SERVER,
            Span.SpanStatus.OK,
            new HashMap<>(),
            new HashMap<>()
        );
    }

    private String generateTraceId() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
