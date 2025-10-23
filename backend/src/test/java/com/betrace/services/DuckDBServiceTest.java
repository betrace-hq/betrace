package com.betrace.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.betrace.model.Span;
import com.betrace.model.Trace;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class DuckDBServiceTest {

    @Inject
    DuckDBService duckdb;

    @Inject
    ObjectMapper objectMapper;

    private final List<UUID> testTenants = new ArrayList<>();

    @AfterEach
    void cleanup() {
        // Cleanup test data
        testTenants.forEach(tenantId -> {
            try {
                duckdb.deleteOldTraces(tenantId);
            } catch (Exception e) {
                // Ignore cleanup errors
            }
        });
        testTenants.clear();
    }

    @Test
    @DisplayName("Should store and retrieve trace")
    void testInsertAndGetTrace() {
        // Given
        UUID tenantId = createTestTenant();
        Trace trace = createTestTrace(tenantId);

        // When
        duckdb.insertTrace(tenantId, trace);
        Optional<Trace> retrieved = duckdb.getTraceById(tenantId, trace.traceId());

        // Then
        assertTrue(retrieved.isPresent());
        assertEquals(trace.traceId(), retrieved.get().traceId());
        assertEquals(tenantId, retrieved.get().tenantId());
        assertEquals(trace.spans().size(), retrieved.get().spans().size());
    }

    @Test
    @DisplayName("Should query traces by time range")
    void testQueryTraces() {
        // Given
        UUID tenantId = createTestTenant();
        Instant now = Instant.now();

        // Insert traces at different times
        for (int day = 0; day < 10; day++) {
            for (int i = 0; i < 5; i++) {
                Trace trace = createTestTrace(tenantId, now.minus(day, ChronoUnit.DAYS));
                duckdb.insertTrace(tenantId, trace);
            }
        }

        // When: Query last 5 days
        List<Trace> recent = duckdb.queryTraces(
            tenantId,
            now.minus(5, ChronoUnit.DAYS),
            now,
            100
        );

        // Then: Should get ~30 traces (6 days × 5 traces, including today)
        assertTrue(recent.size() >= 25 && recent.size() <= 35, "Expected 25-35 traces, got " + recent.size());
    }

    @Test
    @DisplayName("Should enforce query limit")
    void testQueryLimit() {
        // Given
        UUID tenantId = createTestTenant();
        Instant now = Instant.now();

        // Insert 50 traces
        for (int i = 0; i < 50; i++) {
            Trace trace = createTestTrace(tenantId, now.minusSeconds(i * 10));
            duckdb.insertTrace(tenantId, trace);
        }

        // When: Query with limit 10
        List<Trace> limited = duckdb.queryTraces(
            tenantId,
            now.minus(1, ChronoUnit.HOURS),
            now,
            10
        );

        // Then
        assertEquals(10, limited.size());
    }

    @Test
    @DisplayName("Should isolate tenants")
    void testTenantIsolation() {
        // Given
        UUID tenant1 = createTestTenant();
        UUID tenant2 = createTestTenant();

        Trace trace1 = createTestTrace(tenant1);
        Trace trace2 = createTestTrace(tenant2);

        // When
        duckdb.insertTrace(tenant1, trace1);
        duckdb.insertTrace(tenant2, trace2);

        // Then: Each tenant can only see their own trace
        assertTrue(duckdb.getTraceById(tenant1, trace1.traceId()).isPresent());
        assertTrue(duckdb.getTraceById(tenant1, trace2.traceId()).isEmpty());

        assertTrue(duckdb.getTraceById(tenant2, trace2.traceId()).isPresent());
        assertTrue(duckdb.getTraceById(tenant2, trace1.traceId()).isEmpty());
    }

    @Test
    @DisplayName("Should delete old traces")
    void testDeleteOldTraces() {
        // Given
        UUID tenantId = createTestTenant();
        Instant now = Instant.now();

        // Insert old trace (10 days ago)
        Trace oldTrace = createTestTrace(tenantId, now.minus(10, ChronoUnit.DAYS));
        duckdb.insertTrace(tenantId, oldTrace);

        // Insert recent trace
        Trace recentTrace = createTestTrace(tenantId, now.minus(1, ChronoUnit.DAYS));
        duckdb.insertTrace(tenantId, recentTrace);

        // When: Delete traces older than 7 days
        int deleted = duckdb.deleteOldTraces(tenantId);

        // Then: Old trace deleted, recent trace remains
        assertTrue(deleted > 0);
        assertTrue(duckdb.getTraceById(tenantId, oldTrace.traceId()).isEmpty());
        assertTrue(duckdb.getTraceById(tenantId, recentTrace.traceId()).isPresent());
    }

    @Test
    @DisplayName("Should handle duplicate trace inserts")
    void testDuplicateInsert() {
        // Given
        UUID tenantId = createTestTenant();
        Trace trace = createTestTrace(tenantId);

        // When: Insert same trace twice
        duckdb.insertTrace(tenantId, trace);
        duckdb.insertTrace(tenantId, trace);

        // Then: Only one trace exists
        List<Trace> traces = duckdb.queryTraces(
            tenantId,
            Instant.now().minus(1, ChronoUnit.HOURS),
            Instant.now(),
            100
        );

        long count = traces.stream()
            .filter(t -> t.traceId().equals(trace.traceId()))
            .count();

        assertEquals(1, count);
    }

    @Test
    @DisplayName("Should return empty optional for non-existent trace")
    void testGetNonExistentTrace() {
        // Given
        UUID tenantId = createTestTenant();
        String fakeTraceId = "99999999999999999999999999999999";

        // When
        Optional<Trace> result = duckdb.getTraceById(tenantId, fakeTraceId);

        // Then
        assertTrue(result.isEmpty());
    }

    // Helper methods

    private UUID createTestTenant() {
        UUID tenantId = UUID.randomUUID();
        testTenants.add(tenantId);
        return tenantId;
    }

    private Trace createTestTrace(UUID tenantId) {
        return createTestTrace(tenantId, Instant.now());
    }

    private Trace createTestTrace(UUID tenantId, Instant timestamp) {
        String traceId = generateTraceId();
        List<Span> spans = Arrays.asList(
            createSpan("span1", traceId, null, "GET /api", timestamp, tenantId),
            createSpan("span2", traceId, "span1", "DB Query", timestamp.plusMillis(10), tenantId)
        );

        return new Trace(
            traceId,
            tenantId,
            timestamp,
            "GET /api",
            Trace.calculateDuration(spans),
            "test-service",
            spans,
            Map.of("service.name", "test-service")
        );
    }

    private Span createSpan(String spanId, String traceId, String parentSpanId,
                           String operationName, Instant startTime, UUID tenantId) {
        return new Span(
            spanId,
            traceId,
            parentSpanId,
            operationName,
            "test-service",
            startTime,
            startTime.plusMillis(50),
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
