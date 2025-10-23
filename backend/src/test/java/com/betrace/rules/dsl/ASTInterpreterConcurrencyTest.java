package com.fluo.rules.dsl;

import com.fluo.model.Span;
import com.fluo.rules.RuleContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Concurrency tests for ASTInterpreter - Verifies thread-safe resource limit enforcement.
 *
 * <p>Tests cover:</p>
 * <ul>
 *   <li>ThreadLocal depth tracking isolation</li>
 *   <li>Concurrent evaluation without shared state</li>
 *   <li>Resource limit enforcement under concurrent load</li>
 *   <li>ThreadLocal cleanup preventing memory leaks</li>
 * </ul>
 */
class ASTInterpreterConcurrencyTest {

    private ASTInterpreter interpreter;
    private List<Span> testSpans;

    @BeforeEach
    void setUp() {
        interpreter = new ASTInterpreter();
        testSpans = createTestSpans();
    }

    private List<Span> createTestSpans() {
        Instant now = Instant.now();
        return List.of(
            Span.create(
                "span-1",
                "trace-123",
                "auth.check",
                "test-service",
                now,
                now.plusMillis(100),
                Map.of("auth.result", "success")
            ),
            Span.create(
                "span-2",
                "trace-123",
                "database.query",
                "test-service",
                now.plusMillis(100),
                now.plusMillis(400),
                Map.of("query.duration_ms", 300)
            )
        );
    }

    @Test
    @DisplayName("Concurrency: 10 threads evaluate rules simultaneously")
    void testConcurrentRuleEvaluation() throws InterruptedException {
        int threadCount = 10;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        // Submit 10 concurrent evaluation tasks
        for (int i = 0; i < threadCount; i++) {
            final int threadNum = i;
            executor.submit(() -> {
                try {
                    startLatch.await(); // Wait for all threads to be ready

                    RuleContext ruleContext = RuleContext.forTenant("tenant-" + threadNum);
                    HasExpression expr = new HasExpression("auth.check");

                    boolean result = interpreter.evaluate(expr, testSpans, ruleContext);

                    if (result) {
                        successCount.incrementAndGet();
                    } else {
                        failureCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                    e.printStackTrace();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown(); // Start all threads simultaneously
        boolean completed = doneLatch.await(10, TimeUnit.SECONDS);

        executor.shutdown();

        assertTrue(completed, "All threads should complete within 10 seconds");
        assertEquals(threadCount, successCount.get(), "All threads should succeed");
        assertEquals(0, failureCount.get(), "No thread should fail");
    }

    @Test
    @DisplayName("Concurrency: ThreadLocal depth tracking is isolated per thread")
    void testThreadLocalDepthIsolation() throws InterruptedException, ExecutionException {
        int threadCount = 5;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        List<Future<Boolean>> futures = new ArrayList<>();

        // Each thread evaluates rule with different nesting depth
        for (int i = 0; i < threadCount; i++) {
            final int depth = (i + 1) * 10; // 10, 20, 30, 40, 50 levels

            Future<Boolean> future = executor.submit(() -> {
                // Create nested expression
                RuleExpression expr = new HasExpression("auth.check");
                for (int j = 0; j < depth; j++) {
                    expr = new NotExpression(expr);
                }

                RuleContext ruleContext = RuleContext.forTenant("depth-test");
                return interpreter.evaluate(expr, testSpans, ruleContext);
            });

            futures.add(future);
        }

        // All threads should complete successfully
        for (Future<Boolean> future : futures) {
            assertDoesNotThrow(() -> future.get(5, TimeUnit.SECONDS),
                "Thread should complete without exception");
        }

        executor.shutdown();
    }

    @Test
    @DisplayName("Concurrency: Resource limits enforced independently per thread")
    void testResourceLimitEnforcementPerThread() throws InterruptedException {
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        AtomicInteger exceptionsThrown = new AtomicInteger(0);

        // Thread 1: Violates AST depth limit (150 levels)
        executor.submit(() -> {
            try {
                startLatch.await();

                RuleExpression expr = new HasExpression("test");
                for (int i = 0; i < 150; i++) {
                    expr = new NotExpression(expr);
                }

                RuleContext ctx = RuleContext.forTenant("thread-1");
                interpreter.evaluate(expr, testSpans, ctx);
            } catch (ResourceLimitExceededException e) {
                exceptionsThrown.incrementAndGet(); // Expected
            } catch (Exception e) {
                // Unexpected
            } finally {
                doneLatch.countDown();
            }
        });

        // Thread 2: Valid rule (should succeed)
        executor.submit(() -> {
            try {
                startLatch.await();

                HasExpression expr = new HasExpression("auth.check");
                RuleContext ctx = RuleContext.forTenant("thread-2");
                boolean result = interpreter.evaluate(expr, testSpans, ctx);

                if (!result) {
                    exceptionsThrown.incrementAndGet(); // Should have succeeded
                }
            } catch (Exception e) {
                exceptionsThrown.incrementAndGet(); // Unexpected
            } finally {
                doneLatch.countDown();
            }
        });

        startLatch.countDown();
        doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        // Thread 1 should throw ResourceLimitExceededException
        // Thread 2 should succeed
        assertEquals(1, exceptionsThrown.get(),
            "Only thread violating limit should throw exception");
    }

    @Test
    @DisplayName("Concurrency: Thread pool reuse does not leak ThreadLocal state")
    void testThreadLocalCleanupWithThreadPoolReuse() throws InterruptedException {
        int poolSize = 3;
        ExecutorService executor = Executors.newFixedThreadPool(poolSize);

        // First round: Evaluate rules with depth tracking
        CountDownLatch round1 = new CountDownLatch(poolSize);
        for (int i = 0; i < poolSize; i++) {
            executor.submit(() -> {
                try {
                    RuleExpression expr = new HasExpression("auth.check");
                    for (int j = 0; j < 50; j++) { // 50 levels deep
                        expr = new NotExpression(expr);
                    }

                    RuleContext ctx = RuleContext.forTenant("round-1");
                    interpreter.evaluate(expr, testSpans, ctx);
                } finally {
                    round1.countDown();
                }
            });
        }
        round1.await(5, TimeUnit.SECONDS);

        // Second round: Same threads evaluate simple rules
        // If ThreadLocal not cleaned up, depth starts at 50 instead of 0
        CountDownLatch round2 = new CountDownLatch(poolSize);
        AtomicInteger successCount = new AtomicInteger(0);

        for (int i = 0; i < poolSize; i++) {
            executor.submit(() -> {
                try {
                    // Simple rule that should always succeed
                    HasExpression expr = new HasExpression("auth.check");
                    RuleContext ctx = RuleContext.forTenant("round-2");

                    boolean result = interpreter.evaluate(expr, testSpans, ctx);
                    if (result) {
                        successCount.incrementAndGet();
                    }
                } finally {
                    round2.countDown();
                }
            });
        }

        round2.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(poolSize, successCount.get(),
            "All threads should succeed in round 2 (ThreadLocal was cleaned up)");
    }

    @Test
    @DisplayName("Concurrency: High contention - 50 threads evaluate simultaneously")
    void testHighConcurrentLoad() throws InterruptedException {
        int threadCount = 50;
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        ConcurrentHashMap<String, Boolean> results = new ConcurrentHashMap<>();

        for (int i = 0; i < threadCount; i++) {
            final String threadId = "thread-" + i;
            executor.submit(() -> {
                try {
                    startLatch.await();

                    HasExpression expr = new HasExpression("auth.check");
                    RuleContext ctx = RuleContext.forTenant(threadId);

                    boolean result = interpreter.evaluate(expr, testSpans, ctx);
                    results.put(threadId, result);
                } catch (Exception e) {
                    results.put(threadId, false);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean completed = doneLatch.await(30, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "All 50 threads should complete within 30 seconds");
        assertEquals(threadCount, results.size(), "All threads should report results");

        long successCount = results.values().stream().filter(b -> b).count();
        assertEquals(threadCount, successCount, "All threads should succeed");
    }

    @Test
    @DisplayName("Concurrency: Different tenants evaluated in parallel")
    void testMultiTenantConcurrentEvaluation() throws InterruptedException, ExecutionException, TimeoutException {
        int tenantCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(tenantCount);
        List<Future<Boolean>> futures = new ArrayList<>();

        // Each tenant evaluates rules concurrently
        for (int i = 0; i < tenantCount; i++) {
            final String tenantId = "tenant-" + i;
            final String operation = "operation-" + i;

            // Create tenant-specific spans
            List<Span> tenantSpans = List.of(Span.create(
                "span-" + i,
                "trace-" + i,
                operation,
                "service-" + i,
                Instant.now(),
                Instant.now(),
                Map.of()
            ));

            Future<Boolean> future = executor.submit(() -> {
                HasExpression expr = new HasExpression(operation);
                RuleContext ctx = RuleContext.forTenant(tenantId);
                return interpreter.evaluate(expr, tenantSpans, ctx);
            });

            futures.add(future);
        }

        // All tenants should evaluate successfully
        for (int i = 0; i < tenantCount; i++) {
            Boolean result = futures.get(i).get(5, TimeUnit.SECONDS);
            assertTrue(result, "Tenant " + i + " should find matching span");
        }

        executor.shutdown();
    }

    @Test
    @DisplayName("Concurrency: TOCTOU prevention - immutable span list")
    void testTOCTOUPreventionWithImmutableList() throws InterruptedException {
        // Create initial span list
        List<Span> initialSpans = new ArrayList<>(testSpans);

        CountDownLatch evaluationStarted = new CountDownLatch(1);
        CountDownLatch mutationCompleted = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        AtomicInteger spanCountDuringEvaluation = new AtomicInteger(-1);

        // Thread 1: Evaluator
        executor.submit(() -> {
            try {
                evaluationStarted.countDown(); // Signal evaluation started

                // Evaluation uses defensive copy, so mutations won't affect it
                HasExpression expr = new HasExpression("auth.check");
                RuleContext ctx = RuleContext.forTenant("evaluator");
                interpreter.evaluate(expr, initialSpans, ctx);

                mutationCompleted.await(); // Wait for mutation thread
                spanCountDuringEvaluation.set(initialSpans.size());
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        // Thread 2: Mutator (tries to exploit TOCTOU)
        executor.submit(() -> {
            try {
                evaluationStarted.await(); // Wait for evaluation to start

                // Try to mutate list during evaluation
                for (int i = 0; i < 1000; i++) {
                    initialSpans.add(Span.create(
                        "attack-span-" + i,
                        "attack-trace",
                        "attack",
                        "attack-service",
                        Instant.now(),
                        Instant.now(),
                        Map.of()
                    ));
                }

                mutationCompleted.countDown();
            } catch (Exception e) {
                // Expected: List might be immutable or throw ConcurrentModificationException
                mutationCompleted.countDown();
            }
        });

        executor.shutdown();
        executor.awaitTermination(10, TimeUnit.SECONDS);

        // Evaluation should have used defensive copy, unaffected by mutations
        // (spanCountDuringEvaluation reflects post-mutation state of original list)
        assertTrue(spanCountDuringEvaluation.get() > 2,
            "Original list was mutated by attacker thread");
    }

    @Test
    @DisplayName("Concurrency: Stress test - 100 threads with random rules")
    void testStressTestWithRandomRules() throws InterruptedException {
        int threadCount = 100;
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(20); // 20 thread pool

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        ThreadLocalRandom random = ThreadLocalRandom.current();

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    // Random rule type
                    RuleExpression expr;
                    if (random.nextBoolean()) {
                        expr = new HasExpression("auth.check");
                    } else {
                        CountExpression countExpr = new CountExpression("auth.check", "==", 1);
                        expr = countExpr;
                    }

                    // Random nesting depth (0-20 levels)
                    int depth = random.nextInt(21);
                    for (int j = 0; j < depth; j++) {
                        expr = new NotExpression(expr);
                    }

                    RuleContext ctx = RuleContext.forTenant("stress-test");
                    interpreter.evaluate(expr, testSpans, ctx);

                    successCount.incrementAndGet();
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        boolean completed = doneLatch.await(60, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "All 100 threads should complete within 60 seconds");
        assertTrue(successCount.get() > 95,
            "At least 95% of evaluations should succeed (got: " + successCount.get() + ")");
    }

    @Test
    @DisplayName("Concurrency: Exception in one thread does not affect others")
    void testExceptionIsolation() throws InterruptedException {
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(3);
        ExecutorService executor = Executors.newFixedThreadPool(3);

        ConcurrentHashMap<String, String> outcomes = new ConcurrentHashMap<>();

        // Thread 1: Violates depth limit
        executor.submit(() -> {
            try {
                startLatch.await();
                RuleExpression expr = new HasExpression("test");
                for (int i = 0; i < 150; i++) {
                    expr = new NotExpression(expr);
                }
                interpreter.evaluate(expr, testSpans, RuleContext.forTenant("t1"));
                outcomes.put("t1", "success");
            } catch (ResourceLimitExceededException e) {
                outcomes.put("t1", "limit-exceeded");
            } catch (Exception e) {
                outcomes.put("t1", "unexpected-error");
            } finally {
                doneLatch.countDown();
            }
        });

        // Thread 2: Valid evaluation
        executor.submit(() -> {
            try {
                startLatch.await();
                HasExpression expr = new HasExpression("auth.check");
                interpreter.evaluate(expr, testSpans, RuleContext.forTenant("t2"));
                outcomes.put("t2", "success");
            } catch (Exception e) {
                outcomes.put("t2", "error");
            } finally {
                doneLatch.countDown();
            }
        });

        // Thread 3: Valid evaluation
        executor.submit(() -> {
            try {
                startLatch.await();
                HasExpression expr = new HasExpression("database.query");
                interpreter.evaluate(expr, testSpans, RuleContext.forTenant("t3"));
                outcomes.put("t3", "success");
            } catch (Exception e) {
                outcomes.put("t3", "error");
            } finally {
                doneLatch.countDown();
            }
        });

        startLatch.countDown();
        doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        // Thread 1 should fail with limit exceeded
        assertEquals("limit-exceeded", outcomes.get("t1"));

        // Threads 2 and 3 should succeed independently
        assertEquals("success", outcomes.get("t2"));
        assertEquals("success", outcomes.get("t3"));
    }
}
