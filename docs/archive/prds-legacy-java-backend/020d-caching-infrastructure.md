# PRD-020d: Caching Infrastructure

**Parent PRD:** PRD-020 (Performance Optimization)
**Unit:** D
**Priority:** P1
**Dependencies:** None (can be implemented in parallel with Units A-C)

## Scope

Implement caching infrastructure for hot paths using Caffeine. This unit focuses on reducing redundant computations and lookups.

**What this unit implements:**
- PerformanceCacheService with Caffeine caches
- Compiled Drools rule caching (per tenant)
- Public key caching (signature verification)
- Trace metadata caching (recent traces)
- Cache statistics and monitoring

**What this unit does NOT implement:**
- Batching processors (Unit A)
- Async SEDA pipeline (Unit B)
- Streaming evaluation (Unit C)
- Backpressure/circuit breakers (Unit E)

## Implementation

### 1. Performance Cache Service

**`com/betrace/services/PerformanceCacheService.java`:**
```java
@ApplicationScoped
public class PerformanceCacheService {

    @ConfigProperty(name = "betrace.cache.rule-containers.max-size", defaultValue = "500")
    int ruleContainerMaxSize;

    @ConfigProperty(name = "betrace.cache.rule-containers.expire-after-access-minutes", defaultValue = "30")
    int ruleContainerExpireMinutes;

    @ConfigProperty(name = "betrace.cache.public-keys.max-size", defaultValue = "1000")
    int publicKeyMaxSize;

    @ConfigProperty(name = "betrace.cache.public-keys.expire-after-write-hours", defaultValue = "1")
    int publicKeyExpireHours;

    @ConfigProperty(name = "betrace.cache.trace-metadata.max-size", defaultValue = "10000")
    int traceMetadataMaxSize;

    @ConfigProperty(name = "betrace.cache.trace-metadata.expire-after-write-minutes", defaultValue = "5")
    int traceMetadataExpireMinutes;

    // Caffeine cache for compiled Drools rules (per tenant)
    private Cache<UUID, KieContainer> ruleContainerCache;

    // Cache for public keys (signature verification)
    private Cache<UUID, PublicKey> publicKeyCache;

    // Cache for recent trace metadata (avoid duplicate TigerBeetle lookups)
    private Cache<String, TraceMetadata> traceMetadataCache;

    @PostConstruct
    public void init() {
        ruleContainerCache = Caffeine.newBuilder()
            .maximumSize(ruleContainerMaxSize)
            .expireAfterAccess(ruleContainerExpireMinutes, TimeUnit.MINUTES)
            .recordStats()
            .removalListener((UUID key, KieContainer value, RemovalCause cause) -> {
                log.debug("Evicted rule container for tenant {} (cause: {})", key, cause);
                if (value != null) {
                    value.dispose();
                }
            })
            .build();

        publicKeyCache = Caffeine.newBuilder()
            .maximumSize(publicKeyMaxSize)
            .expireAfterWrite(publicKeyExpireHours, TimeUnit.HOURS)
            .recordStats()
            .build();

        traceMetadataCache = Caffeine.newBuilder()
            .maximumSize(traceMetadataMaxSize)
            .expireAfterWrite(traceMetadataExpireMinutes, TimeUnit.MINUTES)
            .recordStats()
            .build();

        log.info("Initialized caches: ruleContainers={}, publicKeys={}, traceMetadata={}",
            ruleContainerMaxSize, publicKeyMaxSize, traceMetadataMaxSize);
    }

    public KieContainer getCachedRuleContainer(UUID tenantId, Supplier<KieContainer> loader) {
        return ruleContainerCache.get(tenantId, tid -> {
            log.debug("Cache miss: Loading rule container for tenant {}", tid);
            return loader.get();
        });
    }

    public PublicKey getCachedPublicKey(UUID tenantId, Supplier<PublicKey> loader) {
        return publicKeyCache.get(tenantId, tid -> {
            log.debug("Cache miss: Loading public key for tenant {}", tid);
            return loader.get();
        });
    }

    public Optional<TraceMetadata> getCachedTraceMetadata(String traceId) {
        return Optional.ofNullable(traceMetadataCache.getIfPresent(traceId));
    }

    public void cacheTraceMetadata(String traceId, TraceMetadata metadata) {
        traceMetadataCache.put(traceId, metadata);
    }

    public void invalidateRuleContainer(UUID tenantId) {
        log.info("Invalidating rule container cache for tenant {}", tenantId);
        ruleContainerCache.invalidate(tenantId);
    }

    public void invalidatePublicKey(UUID tenantId) {
        log.info("Invalidating public key cache for tenant {}", tenantId);
        publicKeyCache.invalidate(tenantId);
    }

    public void invalidateAllRuleContainers() {
        log.warn("Invalidating ALL rule container caches");
        ruleContainerCache.invalidateAll();
    }

    public CacheStats getRuleContainerCacheStats() {
        return ruleContainerCache.stats();
    }

    public CacheStats getPublicKeyCacheStats() {
        return publicKeyCache.stats();
    }

    public CacheStats getTraceMetadataCacheStats() {
        return traceMetadataCache.stats();
    }

    public Map<String, Object> getAllCacheStats() {
        return Map.of(
            "ruleContainers", formatCacheStats(ruleContainerCache.stats()),
            "publicKeys", formatCacheStats(publicKeyCache.stats()),
            "traceMetadata", formatCacheStats(traceMetadataCache.stats())
        );
    }

    private Map<String, Object> formatCacheStats(CacheStats stats) {
        return Map.of(
            "hitCount", stats.hitCount(),
            "missCount", stats.missCount(),
            "hitRate", stats.hitRate(),
            "evictionCount", stats.evictionCount(),
            "loadSuccessCount", stats.loadSuccessCount(),
            "loadFailureCount", stats.loadFailureCount(),
            "averageLoadPenaltyMs", stats.averageLoadPenalty() / 1_000_000.0
        );
    }
}
```

### 2. TraceMetadata Model

**`com/betrace/model/TraceMetadata.java`:**
```java
public class TraceMetadata {
    private final String traceId;
    private final UUID tenantId;
    private final Instant startTime;
    private final Instant lastUpdateTime;
    private final int spanCount;
    private final boolean complete;
    private final Map<String, String> attributes;

    public TraceMetadata(String traceId, UUID tenantId, Instant startTime,
                         Instant lastUpdateTime, int spanCount, boolean complete,
                         Map<String, String> attributes) {
        this.traceId = traceId;
        this.tenantId = tenantId;
        this.startTime = startTime;
        this.lastUpdateTime = lastUpdateTime;
        this.spanCount = spanCount;
        this.complete = complete;
        this.attributes = attributes;
    }

    // Getters
    public String getTraceId() { return traceId; }
    public UUID getTenantId() { return tenantId; }
    public Instant getStartTime() { return startTime; }
    public Instant getLastUpdateTime() { return lastUpdateTime; }
    public int getSpanCount() { return spanCount; }
    public boolean isComplete() { return complete; }
    public Map<String, String> getAttributes() { return Collections.unmodifiableMap(attributes); }
}
```

### 3. Cache Statistics Endpoint

**`com/betrace/routes/CacheStatsRoutes.java`:**
```java
@ApplicationScoped
public class CacheStatsRoutes extends RouteBuilder {

    @Inject
    PerformanceCacheService cacheService;

    @Override
    public void configure() throws Exception {

        rest("/api/performance")
            .description("Performance metrics and diagnostics")
            .produces("application/json")

            .get("/cache-stats")
                .description("Get cache statistics")
                .to("direct:getCacheStats")

            .post("/cache-invalidate/{cache}")
                .description("Invalidate specific cache")
                .to("direct:invalidateCache");

        from("direct:getCacheStats")
            .process(exchange -> {
                Map<String, Object> stats = cacheService.getAllCacheStats();
                exchange.getIn().setBody(stats);
            })
            .marshal().json();

        from("direct:invalidateCache")
            .process(exchange -> {
                String cacheName = exchange.getIn().getHeader("cache", String.class);
                UUID tenantId = exchange.getIn().getHeader("tenantId", UUID.class);

                switch (cacheName) {
                    case "ruleContainers":
                        if (tenantId != null) {
                            cacheService.invalidateRuleContainer(tenantId);
                        } else {
                            cacheService.invalidateAllRuleContainers();
                        }
                        break;
                    case "publicKeys":
                        if (tenantId != null) {
                            cacheService.invalidatePublicKey(tenantId);
                        }
                        break;
                    default:
                        throw new IllegalArgumentException("Unknown cache: " + cacheName);
                }

                exchange.getIn().setBody(Map.of("status", "invalidated", "cache", cacheName));
            })
            .marshal().json();
    }
}
```

### 4. Cache Warmup Processor

**`com/betrace/processors/cache/CacheWarmupProcessor.java`:**
```java
@Named("cacheWarmupProcessor")
@ApplicationScoped
public class CacheWarmupProcessor implements Processor {

    @Inject
    PerformanceCacheService cacheService;

    @Inject
    TenantService tenantService;

    @Inject
    RuleService ruleService;

    @Override
    public void process(Exchange exchange) throws Exception {
        // Warmup rule containers for active tenants
        List<UUID> activeTenants = tenantService.getActiveTenants();

        log.info("Warming up cache for {} active tenants", activeTenants.size());

        int warmedUp = 0;
        for (UUID tenantId : activeTenants) {
            try {
                cacheService.getCachedRuleContainer(tenantId, () -> {
                    return ruleService.compileRulesForTenant(tenantId);
                });
                warmedUp++;
            } catch (Exception e) {
                log.error("Failed to warmup cache for tenant {}", tenantId, e);
            }
        }

        log.info("Cache warmup complete: {}/{} tenants", warmedUp, activeTenants.size());
        exchange.getIn().setBody(Map.of("warmedUp", warmedUp, "total", activeTenants.size()));
    }
}
```

**Warmup route:**
```java
@ApplicationScoped
public class CacheWarmupRoutes extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        // Warmup on application startup
        from("timer:cache-warmup?delay=10000&repeatCount=1")
            .routeId("cacheWarmupOnStartup")
            .process("cacheWarmupProcessor");

        // Manual warmup endpoint
        rest("/api/admin")
            .post("/cache-warmup")
                .description("Manually trigger cache warmup")
                .to("direct:manualCacheWarmup");

        from("direct:manualCacheWarmup")
            .process("cacheWarmupProcessor")
            .marshal().json();
    }
}
```

## Configuration Properties

```properties
# Cache Configuration
betrace.cache.rule-containers.max-size=500
betrace.cache.rule-containers.expire-after-access-minutes=30
betrace.cache.public-keys.max-size=1000
betrace.cache.public-keys.expire-after-write-hours=1
betrace.cache.trace-metadata.max-size=10000
betrace.cache.trace-metadata.expire-after-write-minutes=5

# Cache Warmup
betrace.cache.warmup.enabled=true
betrace.cache.warmup.delay-seconds=10
```

## Success Criteria

- [ ] PerformanceCacheService caches compiled Drools rules per tenant
- [ ] Rule container cache reduces compilation overhead (>80% hit rate)
- [ ] Public key cache reduces signature verification lookups (>90% hit rate)
- [ ] Trace metadata cache reduces TigerBeetle queries (>70% hit rate)
- [ ] Cache invalidation API works correctly
- [ ] Cache statistics endpoint exposes hit rate, eviction count
- [ ] Cache warmup populates cache on startup
- [ ] 90% test coverage for caching logic (ADR-014)

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**`PerformanceCacheServiceTest.java`:**
- Test rule container caching (hit/miss)
- Test rule container eviction after access timeout
- Test rule container disposal on eviction
- Test public key caching
- Test trace metadata caching
- Test cache invalidation (single tenant)
- Test cache invalidation (all tenants)
- Test cache statistics

**`CacheStatsRoutesTest.java`:**
- Test GET /api/performance/cache-stats
- Test POST /api/performance/cache-invalidate/{cache}
- Test invalidation with tenantId
- Test invalidation without tenantId (all)

**`CacheWarmupProcessorTest.java`:**
- Test warmup for active tenants
- Test warmup error handling
- Test warmup metrics

### Load Tests

**`CachePerformanceLoadTest.java`:**
```java
@QuarkusTest
public class CachePerformanceLoadTest {

    @Inject
    PerformanceCacheService cacheService;

    @Inject
    TenantSessionManager sessionManager;

    @Test
    @DisplayName("Should achieve >80% cache hit rate under load")
    public void testCacheHitRate() throws Exception {
        int tenantCount = 100;
        int requestsPerTenant = 1000;

        // Create tenants
        List<UUID> tenantIds = IntStream.range(0, tenantCount)
            .mapToObj(i -> UUID.randomUUID())
            .collect(Collectors.toList());

        // Warmup cache
        for (UUID tenantId : tenantIds) {
            sessionManager.getSession(tenantId);
        }

        // Simulate load
        for (int i = 0; i < requestsPerTenant; i++) {
            for (UUID tenantId : tenantIds) {
                sessionManager.getSession(tenantId);
            }
        }

        // Check cache hit rate
        CacheStats stats = cacheService.getRuleContainerCacheStats();
        double hitRate = stats.hitRate();

        System.out.printf("Cache hit rate: %.2f%%\n", hitRate * 100);
        assertTrue(hitRate > 0.8, "Cache hit rate should be > 80%");
    }

    @Test
    @DisplayName("Should reduce rule compilation time with caching")
    public void testCompilationTimeReduction() {
        UUID tenantId = UUID.randomUUID();

        // First call: compile rules (cache miss)
        long startTime = System.nanoTime();
        sessionManager.getSession(tenantId);
        long firstCallDuration = (System.nanoTime() - startTime) / 1_000_000;

        // Second call: cached (cache hit)
        startTime = System.nanoTime();
        sessionManager.getSession(tenantId);
        long secondCallDuration = (System.nanoTime() - startTime) / 1_000_000;

        System.out.printf("First call (cache miss): %d ms\n", firstCallDuration);
        System.out.printf("Second call (cache hit): %d ms\n", secondCallDuration);

        // Cache hit should be at least 10x faster
        assertTrue(secondCallDuration < firstCallDuration / 10,
            "Cached call should be at least 10x faster");
    }
}
```

### JMH Benchmarks

**`CacheBenchmark.java`:**
```java
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
public class CacheBenchmark {

    private PerformanceCacheService cacheService;
    private UUID tenantId;

    @Setup
    public void setup() {
        cacheService = new PerformanceCacheService();
        tenantId = UUID.randomUUID();

        // Warmup cache
        cacheService.getCachedRuleContainer(tenantId, this::createMockRuleContainer);
    }

    @Benchmark
    public void benchmarkCacheHit(Blackhole blackhole) {
        KieContainer container = cacheService.getCachedRuleContainer(tenantId, this::createMockRuleContainer);
        blackhole.consume(container);
    }

    @Benchmark
    public void benchmarkCacheMiss(Blackhole blackhole) {
        UUID newTenantId = UUID.randomUUID();
        KieContainer container = cacheService.getCachedRuleContainer(newTenantId, this::createMockRuleContainer);
        blackhole.consume(container);
    }

    private KieContainer createMockRuleContainer() {
        // Simulate rule compilation overhead
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return mock(KieContainer.class);
    }
}
```

## Files to Create

### Backend - Services
- `backend/src/main/java/com/betrace/services/PerformanceCacheService.java`

### Backend - Models
- `backend/src/main/java/com/betrace/model/TraceMetadata.java`

### Backend - Routes
- `backend/src/main/java/com/betrace/routes/CacheStatsRoutes.java`
- `backend/src/main/java/com/betrace/routes/CacheWarmupRoutes.java`

### Backend - Processors
- `backend/src/main/java/com/betrace/processors/cache/CacheWarmupProcessor.java`

### Tests - Unit Tests
- `backend/src/test/java/com/betrace/services/PerformanceCacheServiceTest.java`
- `backend/src/test/java/com/betrace/routes/CacheStatsRoutesTest.java`
- `backend/src/test/java/com/betrace/processors/cache/CacheWarmupProcessorTest.java`

### Tests - Load Tests
- `backend/src/test/java/com/betrace/loadtests/CachePerformanceLoadTest.java`

### Tests - JMH Benchmarks
- `backend/src/test/java/com/betrace/benchmarks/CacheBenchmark.java`

## Files to Modify

### Backend - Services
- `backend/src/main/java/com/betrace/services/TenantSessionManager.java`
  - Integrate PerformanceCacheService for rule container caching
  - Replace manual caching with cache service

### Dependencies (pom.xml)
- Add Caffeine cache dependency

```xml
<!-- Add to backend/pom.xml -->
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
    <version>3.1.8</version>
</dependency>
```

## Implementation Timeline

**Week 4:** Caching Infrastructure
- Day 1-2: PerformanceCacheService + TraceMetadata model
- Day 3: CacheStatsRoutes + invalidation API
- Day 4: CacheWarmupProcessor + warmup routes
- Day 5: Integration with TenantSessionManager
- Day 6-7: Load tests, JMH benchmarks, cache hit rate validation

**Deliverable:** Caching infrastructure operational

## Dependencies

**Requires:**
- Existing TenantSessionManager
- Existing RuleService

**Blocks:**
- Unit F: Performance testing (validates cache effectiveness)
- Unit G: Metrics (exposes cache statistics)

## Performance Targets

- Rule container cache hit rate: >80%
- Public key cache hit rate: >90%
- Trace metadata cache hit rate: >70%
- Cache hit latency: <1ms
- Cache miss latency: <100ms (rule compilation)

## ADR Compliance

- **ADR-011:** Pure application, no deployment coupling
- **ADR-013:** Cache service usable from Camel processors
- **ADR-014:** Named processors with 90% test coverage
- **ADR-015:** Reduces redundant storage lookups
