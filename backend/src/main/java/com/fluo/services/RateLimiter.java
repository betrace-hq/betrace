package com.fluo.services;

import com.fluo.exceptions.RateLimitException;
import com.fluo.models.RateLimitResult;
import io.quarkus.logging.Log;
import io.quarkus.scheduler.Scheduled;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Token bucket rate limiter using DuckDB for state storage.
 *
 * Implements smooth token refill algorithm:
 * - Tenant limits: 1000 req/min (default)
 * - User limits: 100 req/min (default)
 * - Anonymous limits: 10 req/min (default)
 *
 * Fails open if DuckDB is unavailable (allows requests, logs error).
 */
@ApplicationScoped
public class RateLimiter {

    @Inject
    DuckDBService duckDB;

    @ConfigProperty(name = "fluo.ratelimit.tenant.requests-per-minute", defaultValue = "1000")
    int tenantRequestsPerMinute;

    @ConfigProperty(name = "fluo.ratelimit.user.requests-per-minute", defaultValue = "100")
    int userRequestsPerMinute;

    @ConfigProperty(name = "fluo.ratelimit.anonymous.requests-per-minute", defaultValue = "10")
    int anonymousRequestsPerMinute;

    private volatile boolean rateLimitingAvailable = true;

    @PostConstruct
    void initializeRateLimitTable() {
        try {
            String sql = """
                CREATE TABLE IF NOT EXISTS rate_limit_buckets (
                    bucket_key VARCHAR PRIMARY KEY,
                    tokens DOUBLE NOT NULL,
                    last_refill_ms BIGINT NOT NULL
                )
                """;

            duckDB.executeOnSharedDb(sql);
            Log.info("Rate limiting initialized with DuckDB backend");
        } catch (Exception e) {
            Log.error("Failed to initialize rate limiting table, will fail-open", e);
            rateLimitingAvailable = false;
            scheduleRateLimitingRecover();
        }
    }

    /**
     * Check tenant-level rate limit.
     */
    public RateLimitResult checkTenantLimit(UUID tenantId) {
        String key = "tenant:" + tenantId;
        return checkTokenBucket(key, tenantRequestsPerMinute, 60);
    }

    /**
     * Check user-level rate limit (scoped to tenant).
     */
    public RateLimitResult checkUserLimit(UUID tenantId, String userId) {
        String key = "user:" + tenantId + ":" + userId;
        return checkTokenBucket(key, userRequestsPerMinute, 60);
    }

    /**
     * Check anonymous rate limit (for unauthenticated requests).
     */
    public RateLimitResult checkAnonymousLimit() {
        String key = "anonymous";
        return checkTokenBucket(key, anonymousRequestsPerMinute, 60);
    }

    /**
     * Token bucket algorithm using DuckDB.
     * Uses transaction for atomic read-modify-write.
     *
     * @param key Bucket key (tenant:uuid or user:uuid:email)
     * @param maxTokens Maximum tokens in bucket
     * @param refillWindowSeconds Window for refilling tokens (usually 60 for per-minute limits)
     * @return RateLimitResult indicating if request is allowed
     */
    private RateLimitResult checkTokenBucket(String key, int maxTokens, int refillWindowSeconds) {
        // Fail-open if rate limiting unavailable
        if (!rateLimitingAvailable) {
            Log.warn("Rate limiting unavailable, allowing request (fail-open)");
            return new RateLimitResult(true, 0, maxTokens);
        }

        long nowMs = System.currentTimeMillis();
        double refillRatePerSecond = maxTokens / (double) refillWindowSeconds;

        try {
            // Begin transaction for atomic operation
            duckDB.executeOnSharedDb("BEGIN TRANSACTION");

            // Read current bucket state
            String selectSql = "SELECT tokens, last_refill_ms FROM rate_limit_buckets WHERE bucket_key = ?";
            List<Map<String, Object>> rows = duckDB.queryOnSharedDb(selectSql, key);

            double tokens;
            long lastRefillMs;

            if (rows.isEmpty()) {
                // New bucket - initialize with full tokens
                tokens = maxTokens;
                lastRefillMs = nowMs;
            } else {
                Map<String, Object> row = rows.get(0);
                tokens = ((Number) row.get("tokens")).doubleValue();
                lastRefillMs = ((Number) row.get("last_refill_ms")).longValue();

                // Refill tokens based on elapsed time
                double elapsedSeconds = (nowMs - lastRefillMs) / 1000.0;
                double tokensToAdd = elapsedSeconds * refillRatePerSecond;
                tokens = Math.min(maxTokens, tokens + tokensToAdd);
                lastRefillMs = nowMs;
            }

            // Try to consume 1 token
            if (tokens >= 1.0) {
                tokens -= 1.0;

                // Update bucket state
                String upsertSql = """
                    INSERT INTO rate_limit_buckets (bucket_key, tokens, last_refill_ms)
                    VALUES (?, ?, ?)
                    ON CONFLICT (bucket_key) DO UPDATE SET
                        tokens = excluded.tokens,
                        last_refill_ms = excluded.last_refill_ms
                    """;

                duckDB.executeOnSharedDb(upsertSql, key, tokens, lastRefillMs);
                duckDB.executeOnSharedDb("COMMIT");

                return new RateLimitResult(true, 0, tokens);
            } else {
                // Not enough tokens - calculate retry after
                double tokensNeeded = 1.0 - tokens;
                long retryAfterSeconds = (long) Math.ceil(tokensNeeded / refillRatePerSecond);

                duckDB.executeOnSharedDb("ROLLBACK");
                return new RateLimitResult(false, retryAfterSeconds, 0);
            }

        } catch (Exception e) {
            // Rollback transaction on error
            try {
                duckDB.executeOnSharedDb("ROLLBACK");
            } catch (Exception rollbackEx) {
                // Ignore rollback errors
            }

            // Fail-open: allow request but log error
            Log.error("Rate limit check failed for key: " + key + ", allowing request (fail-open)", e);
            rateLimitingAvailable = false;
            scheduleRateLimitingRecover();

            return new RateLimitResult(true, 0, maxTokens);
        }
    }

    /**
     * Cleanup job: purge buckets inactive for >5 minutes.
     * Runs every 5 minutes.
     */
    @Scheduled(every = "5m")
    void cleanupOldBuckets() {
        if (!rateLimitingAvailable) {
            return;
        }

        String sql = "DELETE FROM rate_limit_buckets WHERE last_refill_ms < ?";
        long cutoffMs = System.currentTimeMillis() - (5 * 60 * 1000);

        try {
            duckDB.executeOnSharedDb(sql, cutoffMs);
            Log.debug("Cleaned up inactive rate limit buckets");
        } catch (Exception e) {
            Log.warn("Failed to cleanup old rate limit buckets", e);
        }
    }

    /**
     * Schedule recovery attempt after rate limiting failure.
     * Waits 30 seconds before trying again.
     */
    private void scheduleRateLimitingRecover() {
        CompletableFuture.delayedExecutor(30, TimeUnit.SECONDS).execute(() -> {
            Log.info("Attempting to recover rate limiting");
            try {
                // Try to re-initialize
                initializeRateLimitTable();
                rateLimitingAvailable = true;
                Log.info("Rate limiting recovered successfully");
            } catch (Exception e) {
                Log.warn("Rate limiting recovery failed, will retry", e);
            }
        });
    }
}
