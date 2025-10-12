package com.fluo.services;

import com.fluo.models.RateLimitResult;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for RateLimiter with real I/O.
 * WARNING: These tests are timing-dependent and may be flaky.
 * For deterministic tests, see RateLimiterUnitTest.
 *
 * @see RateLimiterUnitTest
 */
@QuarkusTest
@org.junit.jupiter.api.Tag("integration")
@org.junit.jupiter.api.Tag("flaky")
class RateLimiterIntegrationTest {

    @Inject
    RateLimiter rateLimiter;

    @Test
    @DisplayName("Should handle concurrent tenant rate limit checks without race conditions")
    void testConcurrentTenantRateLimiting() throws Exception {
        UUID tenantId = UUID.randomUUID();
        int threadCount = 20;
        int requestsPerThread = 100;
        int totalRequests = threadCount * requestsPerThread;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        // Launch all threads
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await(); // Wait for all threads to be ready

                    for (int j = 0; j < requestsPerThread; j++) {
                        RateLimitResult result = rateLimiter.checkTenantLimit(tenantId);
                        if (result.allowed()) {
                            successCount.incrementAndGet();
                        } else {
                            failureCount.incrementAndGet();
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        // Start all threads simultaneously
        startLatch.countDown();

        // Wait for all threads to complete (with timeout)
        assertTrue(doneLatch.await(30, TimeUnit.SECONDS),
            "Threads did not complete in time");
        executor.shutdown();

        // Verify rate limiting was enforced correctly
        int totalProcessed = successCount.get() + failureCount.get();
        assertEquals(totalRequests, totalProcessed,
            "Some requests were lost during concurrent processing");

        // The exact allowed count depends on timing, but should be around the limit
        // Allow some variance due to token refill during test
        assertTrue(successCount.get() <= 1500, // 1000/min limit + some refill
            "Too many requests allowed: " + successCount.get());

        assertTrue(successCount.get() >= 800, // Should allow at least most of the limit
            "Too few requests allowed: " + successCount.get());
    }

    @Test
    @DisplayName("Should handle concurrent user rate limit checks without race conditions")
    void testConcurrentUserRateLimiting() throws Exception {
        UUID tenantId = UUID.randomUUID();
        String userId = "concurrent-user";
        int threadCount = 10;
        int requestsPerThread = 20;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();

                    for (int j = 0; j < requestsPerThread; j++) {
                        RateLimitResult result = rateLimiter.checkUserLimit(tenantId, userId);
                        if (result.allowed()) {
                            successCount.incrementAndGet();
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
        assertTrue(doneLatch.await(30, TimeUnit.SECONDS));
        executor.shutdown();

        // User limit is 100/min, allow some refill variance
        assertTrue(successCount.get() <= 150,
            "User rate limit violated: " + successCount.get());
    }

    @Test
    @DisplayName("Should handle concurrent anonymous rate limit checks")
    void testConcurrentAnonymousRateLimiting() throws Exception {
        int threadCount = 5;
        int requestsPerThread = 10;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();

                    for (int j = 0; j < requestsPerThread; j++) {
                        RateLimitResult result = rateLimiter.checkAnonymousLimit();
                        if (result.allowed()) {
                            successCount.incrementAndGet();
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
        assertTrue(doneLatch.await(30, TimeUnit.SECONDS));
        executor.shutdown();

        // Anonymous limit is 10/min, very strict
        assertTrue(successCount.get() <= 20,
            "Anonymous rate limit violated: " + successCount.get());
    }

    @Test
    @DisplayName("Should isolate rate limits across different tenants")
    void testTenantIsolationUnderConcurrentLoad() throws Exception {
        UUID tenant1 = UUID.randomUUID();
        UUID tenant2 = UUID.randomUUID();
        UUID tenant3 = UUID.randomUUID();

        int threadCount = 30; // 10 threads per tenant
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        ConcurrentHashMap<UUID, AtomicInteger> successCounts = new ConcurrentHashMap<>();
        successCounts.put(tenant1, new AtomicInteger(0));
        successCounts.put(tenant2, new AtomicInteger(0));
        successCounts.put(tenant3, new AtomicInteger(0));

        // Launch threads for each tenant
        for (UUID tenantId : new UUID[]{tenant1, tenant2, tenant3}) {
            for (int i = 0; i < 10; i++) {
                executor.submit(() -> {
                    try {
                        startLatch.await();

                        for (int j = 0; j < 100; j++) {
                            RateLimitResult result = rateLimiter.checkTenantLimit(tenantId);
                            if (result.allowed()) {
                                successCounts.get(tenantId).incrementAndGet();
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
        assertTrue(doneLatch.await(30, TimeUnit.SECONDS));
        executor.shutdown();

        // Each tenant should have independent rate limits
        successCounts.forEach((tenantId, count) -> {
            assertTrue(count.get() > 0,
                "Tenant " + tenantId + " got no requests through");
            assertTrue(count.get() <= 1500,
                "Tenant " + tenantId + " exceeded rate limit: " + count.get());
        });
    }

    @Test
    @DisplayName("Should handle burst traffic followed by sustained load")
    void testBurstThenSustainedLoad() throws Exception {
        UUID tenantId = UUID.randomUUID();

        // Phase 1: Burst (100 requests instantly)
        ExecutorService burstExecutor = Executors.newFixedThreadPool(10);
        CountDownLatch burstStart = new CountDownLatch(1);
        CountDownLatch burstDone = new CountDownLatch(10);
        AtomicInteger burstSuccess = new AtomicInteger(0);

        for (int i = 0; i < 10; i++) {
            burstExecutor.submit(() -> {
                try {
                    burstStart.await();
                    for (int j = 0; j < 10; j++) {
                        if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                            burstSuccess.incrementAndGet();
                        }
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    burstDone.countDown();
                }
            });
        }

        burstStart.countDown();
        assertTrue(burstDone.await(10, TimeUnit.SECONDS));
        burstExecutor.shutdown();

        // Should allow burst up to capacity
        assertTrue(burstSuccess.get() > 0, "Burst traffic completely blocked");

        // Phase 2: Sustained load (should be rate limited)
        Thread.sleep(100); // Small gap

        AtomicInteger sustainedBlocked = new AtomicInteger(0);
        for (int i = 0; i < 100; i++) {
            if (!rateLimiter.checkTenantLimit(tenantId).allowed()) {
                sustainedBlocked.incrementAndGet();
            }
            Thread.sleep(5); // Sustained rate
        }

        // After burst, subsequent requests should be rate limited
        assertTrue(sustainedBlocked.get() > 50,
            "Sustained load not properly rate limited after burst");
    }

    @Test
    @DisplayName("Should recover from rate limit after waiting")
    void testRateLimitRecovery() throws Exception {
        UUID tenantId = UUID.randomUUID();

        // Exhaust rate limit
        int exhaustCount = 0;
        for (int i = 0; i < 2000; i++) {
            if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                exhaustCount++;
            }
        }

        assertTrue(exhaustCount <= 1000, "Should hit rate limit");

        // Verify we're rate limited
        assertFalse(rateLimiter.checkTenantLimit(tenantId).allowed(),
            "Should be rate limited");

        // Wait for token refill (1000 tokens per 60 seconds = ~16.67/sec)
        // Wait 3 seconds should give us ~50 tokens
        Thread.sleep(3000);

        // Should be able to make requests again
        int recoveryCount = 0;
        for (int i = 0; i < 100; i++) {
            if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                recoveryCount++;
            }
        }

        assertTrue(recoveryCount >= 30,
            "Should recover after waiting, got " + recoveryCount);
    }

    @Test
    @DisplayName("Should handle extremely high concurrency without deadlock")
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

        // If there's a deadlock, this will timeout
        assertTrue(doneLatch.await(30, TimeUnit.SECONDS),
            "Deadlock detected: only " + completedThreads.get() + "/" + threadCount + " threads completed");

        executor.shutdown();
        assertEquals(threadCount, completedThreads.get(),
            "Not all threads completed");
    }

    @Test
    @DisplayName("Should maintain accuracy under sustained concurrent load")
    void testRateLimitAccuracyUnderLoad() throws Exception {
        UUID tenantId = UUID.randomUUID();
        int durationSeconds = 5;
        int threadCount = 10;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        AtomicInteger totalAttempts = new AtomicInteger(0);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicBoolean running = new AtomicBoolean(true);

        // Launch threads that continuously make requests
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                while (running.get()) {
                    totalAttempts.incrementAndGet();
                    if (rateLimiter.checkTenantLimit(tenantId).allowed()) {
                        successCount.incrementAndGet();
                    }
                    try {
                        Thread.sleep(1); // Small delay to avoid tight loop
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            });
        }

        // Let it run for specified duration
        Thread.sleep(durationSeconds * 1000);
        running.set(false);

        executor.shutdown();
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));

        // Calculate expected successful requests
        // 1000 req/min = ~16.67 req/sec
        // Over 5 seconds = ~83 requests (plus burst capacity)
        int expectedMax = (durationSeconds * 17) + 100; // Add burst capacity

        assertTrue(successCount.get() <= expectedMax,
            "Rate limit accuracy violated: " + successCount.get() + " allowed (expected max ~" + expectedMax + ")");

        assertTrue(totalAttempts.get() > successCount.get(),
            "No requests were rate limited (test may be invalid)");
    }
}
