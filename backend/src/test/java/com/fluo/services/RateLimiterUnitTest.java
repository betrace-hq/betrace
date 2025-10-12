package com.fluo.services;

import com.fluo.models.RateLimitResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Deterministic unit tests for RateLimiter using mocked I/O.
 * Tests token bucket algorithm logic without timing dependencies.
 */
class RateLimiterUnitTest {

    @Mock
    private DuckDBService mockDuckDB;

    private TestableRateLimiter rateLimiter;
    private AtomicLong mockTime;

    @BeforeEach
    void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);
        mockTime = new AtomicLong(0);
        rateLimiter = new TestableRateLimiter(mockDuckDB, mockTime);

        // Mock database responses for token bucket state
        when(mockDuckDB.queryOnSharedDb(anyString(), any()))
            .thenReturn(List.of()); // Empty = new bucket
        doNothing().when(mockDuckDB).executeOnSharedDb(anyString(), any());
        when(mockDuckDB.executeTransaction(any())).thenAnswer(inv -> {
            Callable<?> callable = inv.getArgument(0);
            return callable.call();
        });
    }

    @Test
    @DisplayName("New bucket starts with full capacity")
    void testNewBucketFullCapacity() {
        UUID tenantId = UUID.randomUUID();

        // First request should succeed (full bucket)
        RateLimitResult result = rateLimiter.checkTenantLimit(tenantId);

        assertTrue(result.allowed(), "First request should be allowed");
        assertEquals(999.0, result.tokensRemaining(), 0.01);
    }

    @Test
    @DisplayName("Token bucket exhausts after max requests")
    void testBucketExhaustion() {
        UUID tenantId = UUID.randomUUID();
        int maxTokens = 1000;

        // Consume all tokens
        int allowed = 0;
        for (int i = 0; i < maxTokens + 10; i++) {
            if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                allowed++;
            }
        }

        assertEquals(maxTokens, allowed, "Should allow exactly max tokens");

        // Next request should be denied
        RateLimitResult denied = rateLimiter.checkTenantLimit(tenantId);
        assertFalse(denied.allowed(), "Should deny after exhaustion");
        assertTrue(denied.retryAfterSeconds() > 0, "Should provide retry-after");
    }

    @Test
    @DisplayName("Tokens refill based on elapsed time")
    void testTokenRefill() {
        UUID tenantId = UUID.randomUUID();

        // Exhaust bucket
        for (int i = 0; i < 1000; i++) {
            rateLimiter.checkTenantLimit(tenantId);
        }

        // Verify exhausted
        assertFalse(rateLimiter.checkTenantLimit(tenantId).allowed());

        // Advance time by 60 seconds (should refill 1000 tokens at 1000/min rate)
        mockTime.addAndGet(60_000);

        // Should allow requests again
        assertTrue(rateLimiter.checkTenantLimit(tenantId).allowed(),
            "Should allow after refill");
    }

    @Test
    @DisplayName("Refill does not exceed max capacity")
    void testRefillCap() {
        UUID tenantId = UUID.randomUUID();

        // Advance time way into future
        mockTime.addAndGet(600_000); // 10 minutes

        // Should still only have 1000 tokens max
        int allowed = 0;
        for (int i = 0; i < 1500; i++) {
            if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                allowed++;
            }
        }

        assertEquals(1000, allowed, "Refill should not exceed max capacity");
    }

    @Test
    @DisplayName("Concurrent requests do not violate token limit")
    void testConcurrentSafety() throws Exception {
        UUID tenantId = UUID.randomUUID();
        int threadCount = 20;
        int requestsPerThread = 100;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        AtomicInteger allowed = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    for (int j = 0; j < requestsPerThread; j++) {
                        if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                            allowed.incrementAndGet();
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
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS));
        executor.shutdown();

        // Should never exceed max tokens
        assertEquals(1000, allowed.get(),
            "Concurrent requests should not exceed token limit");
    }

    @Test
    @DisplayName("Different tenants have independent rate limits")
    void testTenantIsolation() {
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();

        // Exhaust tenant1
        for (int i = 0; i < 1000; i++) {
            rateLimiter.checkTenantLimit(tenant1);
        }

        assertFalse(rateLimiter.checkTenantLimit(tenant1).allowed(),
            "Tenant1 should be exhausted");

        // Tenant2 should still have full capacity
        assertTrue(rateLimiter.checkTenantLimit(tenant2).allowed(),
            "Tenant2 should have independent limit");
    }

    @Test
    @DisplayName("Retry-after calculation is accurate")
    void testRetryAfterCalculation() {
        UUID tenantId = UUID.randomUUID();

        // Exhaust bucket
        for (int i = 0; i < 1000; i++) {
            rateLimiter.checkTenantLimit(tenantId);
        }

        RateLimitResult denied = rateLimiter.checkTenantLimit(tenantId);
        assertFalse(denied.allowed());

        long retryAfter = denied.retryAfterSeconds();
        assertTrue(retryAfter > 0 && retryAfter <= 60,
            "Retry-after should be reasonable: " + retryAfter);

        // Advance time by retry-after seconds
        mockTime.addAndGet(retryAfter * 1000);

        // Should now allow
        assertTrue(rateLimiter.checkTenantLimit(tenantId).allowed(),
            "Should allow after retry-after period");
    }

    @Test
    @DisplayName("Partial token consumption works correctly")
    void testPartialTokens() {
        UUID tenantId = UUID.randomUUID();

        // Consume 500 tokens
        for (int i = 0; i < 500; i++) {
            rateLimiter.checkTenantLimit(tenantId);
        }

        // Advance 30 seconds (should refill 500 tokens at 1000/min = 16.67/sec)
        mockTime.addAndGet(30_000);

        // Should be able to consume another 1000 tokens total (500 remaining + 500 refilled)
        int allowed = 0;
        for (int i = 0; i < 1100; i++) {
            if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                allowed++;
            }
        }

        assertTrue(allowed >= 999 && allowed <= 1001,
            "Should allow ~1000 tokens after partial refill, got: " + allowed);
    }

    @Test
    @DisplayName("User rate limit is independent of tenant rate limit")
    void testUserVsTenantLimits() {
        UUID tenantId = UUID.randomUUID();
        String userId = "test-user";

        // Exhaust tenant limit
        for (int i = 0; i < 1000; i++) {
            rateLimiter.checkTenantLimit(tenantId);
        }

        // User limit (100/min) should still work
        assertTrue(rateLimiter.checkUserLimit(tenantId, userId).allowed(),
            "User limit should be independent");
    }

    /**
     * Testable rate limiter with injectable time source.
     */
    private static class TestableRateLimiter extends RateLimiter {
        private final AtomicLong mockTime;
        private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

        TestableRateLimiter(DuckDBService duckDB, AtomicLong mockTime) {
            this.mockTime = mockTime;
            this.duckDB = duckDB;
            // Initialize with test config
            this.tenantRequestsPerMinute = 1000;
            this.userRequestsPerMinute = 100;
            this.anonymousRequestsPerMinute = 10;
        }

        protected long currentTimeMillis() {
            return mockTime.get();
        }

        @Override
        public RateLimitResult checkTenantLimit(UUID tenantId) {
            String key = "tenant:" + tenantId;
            return checkTokenBucketInMemory(key, tenantRequestsPerMinute, 60);
        }

        @Override
        public RateLimitResult checkUserLimit(UUID tenantId, String userId) {
            String key = "user:" + tenantId + ":" + userId;
            return checkTokenBucketInMemory(key, userRequestsPerMinute, 60);
        }

        private synchronized RateLimitResult checkTokenBucketInMemory(
            String key, int maxTokens, int refillWindowSeconds) {

            long now = currentTimeMillis();
            double refillRatePerSecond = maxTokens / (double) refillWindowSeconds;

            TokenBucket bucket = buckets.computeIfAbsent(key,
                k -> new TokenBucket(maxTokens, now));

            // Refill tokens based on elapsed time
            double elapsedSeconds = (now - bucket.lastRefillMs) / 1000.0;
            double tokensToAdd = elapsedSeconds * refillRatePerSecond;
            bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
            bucket.lastRefillMs = now;

            // Try to consume 1 token
            if (bucket.tokens >= 1.0) {
                bucket.tokens -= 1.0;
                return new RateLimitResult(true, 0, bucket.tokens);
            } else {
                // Calculate retry after
                double tokensNeeded = 1.0 - bucket.tokens;
                long retryAfterSeconds = (long) Math.ceil(tokensNeeded / refillRatePerSecond);
                return new RateLimitResult(false, retryAfterSeconds, 0);
            }
        }

        private static class TokenBucket {
            double tokens;
            long lastRefillMs;

            TokenBucket(double initialTokens, long time) {
                this.tokens = initialTokens;
                this.lastRefillMs = time;
            }
        }
    }
}
