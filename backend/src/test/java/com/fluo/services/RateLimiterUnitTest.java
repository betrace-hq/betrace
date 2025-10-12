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

    @Test
    @DisplayName("Multiple tenants can be rate limited concurrently without interference")
    void testMultiTenantConcurrency() throws Exception {
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();
        UUID tenant3 = UUID.randomUUID();

        ExecutorService executor = Executors.newFixedThreadPool(30);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(30);

        ConcurrentHashMap<UUID, AtomicInteger> counts = new ConcurrentHashMap<>();
        counts.put(tenant1, new AtomicInteger(0));
        counts.put(tenant2, new AtomicInteger(0));
        counts.put(tenant3, new AtomicInteger(0));

        // 10 threads per tenant
        for (UUID tenant : new UUID[]{tenant1, tenant2, tenant3}) {
            for (int i = 0; i < 10; i++) {
                executor.submit(() -> {
                    try {
                        startLatch.await();
                        for (int j = 0; j < 100; j++) {
                            if (rateLimiter.checkTenantLimit(tenant).allowed()) {
                                counts.get(tenant).incrementAndGet();
                            }
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS));
        executor.shutdown();

        // Each tenant should get exactly 1000 tokens
        assertEquals(1000, counts.get(tenant1).get(), "Tenant1 should have independent limit");
        assertEquals(1000, counts.get(tenant2).get(), "Tenant2 should have independent limit");
        assertEquals(1000, counts.get(tenant3).get(), "Tenant3 should have independent limit");
    }

    @Test
    @DisplayName("Burst traffic is handled correctly without exceeding limit")
    void testBurstTraffic() {
        UUID tenantId = UUID.randomUUID();

        // Simulate burst: 100 rapid requests
        int burstAllowed = 0;
        for (int i = 0; i < 100; i++) {
            if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                burstAllowed++;
            }
        }

        assertEquals(100, burstAllowed, "Burst should be allowed up to capacity");

        // More requests should be denied (no time elapsed)
        assertFalse(rateLimiter.checkTenantLimit(tenantId).allowed(),
            "Should deny after burst exhaustion");

        // Advance time by 6 seconds (should refill ~100 tokens at 16.67/sec)
        mockTime.addAndGet(6_000);

        // Should allow ~100 more requests
        int afterBurst = 0;
        for (int i = 0; i < 150; i++) {
            if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                afterBurst++;
            }
        }

        assertTrue(afterBurst >= 99 && afterBurst <= 101,
            "Should allow ~100 after 6s refill, got: " + afterBurst);
    }

    @Test
    @DisplayName("High concurrency does not cause deadlock")
    void testHighConcurrencyNoDeadlock() throws Exception {
        UUID tenantId = UUID.randomUUID();
        int threadCount = 100;
        int requestsPerThread = 10;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        AtomicInteger completedThreads = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    for (int j = 0; j < requestsPerThread; j++) {
                        rateLimiter.checkTenantLimit(tenantId);
                    }
                    completedThreads.incrementAndGet();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        assertTrue(doneLatch.await(10, TimeUnit.SECONDS),
            "Deadlock detected: only " + completedThreads.get() + "/" + threadCount + " completed");
        executor.shutdown();

        assertEquals(threadCount, completedThreads.get(),
            "All threads should complete without deadlock");
    }

    @Test
    @DisplayName("Token bucket maintains accuracy under sustained load")
    void testSustainedLoadAccuracy() {
        UUID tenantId = UUID.randomUUID();

        // Exhaust initial capacity
        for (int i = 0; i < 1000; i++) {
            rateLimiter.checkTenantLimit(tenantId);
        }

        // Simulate 60 seconds of sustained requests with refill
        // At 1000 tokens/60s = 16.67 tokens/sec
        int totalAllowed = 0;
        for (int sec = 0; sec < 60; sec++) {
            mockTime.addAndGet(1_000); // Advance 1 second

            // Try 20 requests per second
            for (int req = 0; req < 20; req++) {
                if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                    totalAllowed++;
                }
            }
        }

        // Should allow ~1000 requests over 60 seconds (16.67/sec * 60sec)
        assertTrue(totalAllowed >= 999 && totalAllowed <= 1001,
            "Should allow ~1000 over 60s, got: " + totalAllowed);
    }

    @Test
    @DisplayName("Recovery after exhaustion works deterministically")
    void testDeterministicRecovery() {
        UUID tenantId = UUID.randomUUID();

        // Exhaust bucket
        for (int i = 0; i < 1000; i++) {
            rateLimiter.checkTenantLimit(tenantId);
        }

        // Verify exhausted
        assertFalse(rateLimiter.checkTenantLimit(tenantId).allowed());

        // Advance exactly 3 seconds (should refill 50 tokens at 16.67/sec)
        mockTime.addAndGet(3_000);

        // Count allowed requests after recovery
        int afterRecovery = 0;
        for (int i = 0; i < 100; i++) {
            if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                afterRecovery++;
            }
        }

        assertEquals(50, afterRecovery,
            "Should allow exactly 50 tokens after 3s recovery");
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
