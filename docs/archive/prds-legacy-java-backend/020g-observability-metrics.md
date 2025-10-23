# PRD-020g: Observability and Metrics

**Parent PRD:** PRD-020 (Performance Optimization)
**Unit:** G
**Priority:** P1
**Dependencies:** Can be implemented in parallel with Units A-F

## Scope

Implement observability infrastructure for performance monitoring. This unit exposes performance metrics via API and prepares data for external consumers (Prometheus, Grafana).

**What this unit implements:**
- Performance metrics API endpoints
- Prometheus metrics exporters
- Queue statistics monitoring
- Cache statistics monitoring
- Example Grafana dashboard JSON

**What this unit does NOT implement:**
- Grafana deployment (external consumer responsibility)
- Prometheus deployment (external consumer responsibility)
- Alerting rules (external consumer responsibility)

## Implementation

### 1. Performance Metrics Routes

**`com/betrace/routes/PerformanceMetricsRoutes.java`:**
```java
@ApplicationScoped
public class PerformanceMetricsRoutes extends RouteBuilder {

    @Inject
    PerformanceCacheService cacheService;

    @Inject
    MetricsService metricsService;

    @Inject
    QueueMonitoringService queueMonitor;

    @Override
    public void configure() throws Exception {

        rest("/api/performance")
            .description("Performance metrics and diagnostics")
            .produces("application/json")

            .get("/metrics")
                .description("Get current performance metrics")
                .to("direct:getPerformanceMetrics")

            .get("/cache-stats")
                .description("Get cache statistics")
                .to("direct:getCacheStats")

            .get("/queue-stats")
                .description("Get SEDA queue statistics")
                .to("direct:getQueueStats")

            .get("/system-stats")
                .description("Get system resource statistics")
                .to("direct:getSystemStats");

        from("direct:getPerformanceMetrics")
            .process(exchange -> {
                Map<String, Object> metrics = Map.of(
                    "spanIngestionRate", metricsService.getSpanIngestionRate(),
                    "ruleEvaluationP99", metricsService.getRuleEvaluationP99(),
                    "tigerBeetleWriteLatency", metricsService.getTigerBeetleWriteLatency(),
                    "duckDBInsertThroughput", metricsService.getDuckDBInsertThroughput(),
                    "activeTenants", metricsService.getActiveTenantCount(),
                    "memoryUsageMB", getUsedMemoryMB(),
                    "uptime", getUptimeSeconds()
                );
                exchange.getIn().setBody(metrics);
            })
            .marshal().json();

        from("direct:getCacheStats")
            .process(exchange -> {
                Map<String, Object> stats = cacheService.getAllCacheStats();
                exchange.getIn().setBody(stats);
            })
            .marshal().json();

        from("direct:getQueueStats")
            .process(exchange -> {
                Map<String, Object> stats = queueMonitor.getAllQueueStatistics();
                exchange.getIn().setBody(stats);
            })
            .marshal().json();

        from("direct:getSystemStats")
            .process("systemStatsProcessor")
            .marshal().json();
    }

    private long getUsedMemoryMB() {
        Runtime runtime = Runtime.getRuntime();
        return (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
    }

    private long getUptimeSeconds() {
        return ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
    }
}
```

### 2. System Statistics Processor

**`com/betrace/processors/metrics/SystemStatsProcessor.java`:**
```java
@Named("systemStatsProcessor")
@ApplicationScoped
public class SystemStatsProcessor implements Processor {

    private final Instant startTime = Instant.now();

    @Override
    public void process(Exchange exchange) throws Exception {
        Runtime runtime = Runtime.getRuntime();
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        ThreadMXBean threadBean = ManagementFactory.getThreadMXBean();
        GarbageCollectorMXBean gcBean = ManagementFactory.getGarbageCollectorMXBeans().get(0);

        Map<String, Object> stats = Map.of(
            "memory", Map.of(
                "usedMB", (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024),
                "totalMB", runtime.totalMemory() / (1024 * 1024),
                "maxMB", runtime.maxMemory() / (1024 * 1024),
                "freeMB", runtime.freeMemory() / (1024 * 1024)
            ),
            "cpu", Map.of(
                "availableProcessors", runtime.availableProcessors(),
                "systemLoadAverage", osBean.getSystemLoadAverage()
            ),
            "threads", Map.of(
                "threadCount", threadBean.getThreadCount(),
                "peakThreadCount", threadBean.getPeakThreadCount(),
                "daemonThreadCount", threadBean.getDaemonThreadCount()
            ),
            "gc", Map.of(
                "name", gcBean.getName(),
                "collectionCount", gcBean.getCollectionCount(),
                "collectionTimeMs", gcBean.getCollectionTime()
            ),
            "uptime", Map.of(
                "seconds", Duration.between(startTime, Instant.now()).getSeconds(),
                "startTime", startTime.toString()
            )
        );

        exchange.getIn().setBody(stats);
    }
}
```

### 3. Prometheus Metrics Exporter

**`com/betrace/services/PrometheusMetricsExporter.java`:**
```java
@ApplicationScoped
public class PrometheusMetricsExporter {

    @Inject
    MetricsService metricsService;

    @Inject
    PerformanceCacheService cacheService;

    @Inject
    QueueMonitoringService queueMonitor;

    // Prometheus metrics (using Micrometer)
    private final Counter spanIngestionCounter;
    private final Timer ruleEvaluationTimer;
    private final Timer tigerBeetleWriteTimer;
    private final Timer duckDBInsertTimer;
    private final Gauge activeTenantGauge;
    private final Gauge memoryUsageGauge;

    public PrometheusMetricsExporter(MeterRegistry registry) {
        // Throughput metrics
        spanIngestionCounter = Counter.builder("betrace_span_ingestion_total")
            .description("Total number of spans ingested")
            .register(registry);

        // Latency metrics
        ruleEvaluationTimer = Timer.builder("betrace_rule_evaluation_latency_seconds")
            .description("Rule evaluation latency")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);

        tigerBeetleWriteTimer = Timer.builder("betrace_tigerbeetle_write_latency_seconds")
            .description("TigerBeetle write latency")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);

        duckDBInsertTimer = Timer.builder("betrace_duckdb_insert_latency_seconds")
            .description("DuckDB insert latency")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);

        // Gauge metrics
        activeTenantGauge = Gauge.builder("betrace_active_tenants", metricsService, MetricsService::getActiveTenantCount)
            .description("Number of active tenants")
            .register(registry);

        memoryUsageGauge = Gauge.builder("betrace_memory_usage_mb", this, PrometheusMetricsExporter::getUsedMemoryMB)
            .description("Memory usage in MB")
            .register(registry);

        // Queue metrics
        for (String queueName : List.of("span-ingestion", "rule-evaluation", "storage-write")) {
            Gauge.builder("betrace_seda_queue_size", queueMonitor,
                    monitor -> monitor.getQueueStatistics(queueName).get("currentSize"))
                .description("Current SEDA queue size")
                .tag("queue", queueName)
                .register(registry);
        }

        // Cache metrics
        Gauge.builder("betrace_cache_hit_rate", cacheService,
                service -> service.getRuleContainerCacheStats().hitRate())
            .description("Cache hit rate")
            .tag("cache", "ruleContainers")
            .register(registry);
    }

    public void recordSpanIngestion(long count) {
        spanIngestionCounter.increment(count);
    }

    public void recordRuleEvaluation(long durationMs) {
        ruleEvaluationTimer.record(Duration.ofMillis(durationMs));
    }

    public void recordTigerBeetleWrite(long durationMs) {
        tigerBeetleWriteTimer.record(Duration.ofMillis(durationMs));
    }

    public void recordDuckDBInsert(long durationMs) {
        duckDBInsertTimer.record(Duration.ofMillis(durationMs));
    }

    private double getUsedMemoryMB() {
        Runtime runtime = Runtime.getRuntime();
        return (runtime.totalMemory() - runtime.freeMemory()) / (1024.0 * 1024.0);
    }
}
```

### 4. Prometheus Endpoint Route

**`com/betrace/routes/PrometheusRoutes.java`:**
```java
@ApplicationScoped
public class PrometheusRoutes extends RouteBuilder {

    @Inject
    MeterRegistry meterRegistry;

    @Override
    public void configure() throws Exception {

        rest("/metrics")
            .description("Prometheus metrics endpoint")
            .produces("text/plain")

            .get()
                .description("Export metrics in Prometheus format")
                .to("direct:exportPrometheusMetrics");

        from("direct:exportPrometheusMetrics")
            .process(exchange -> {
                PrometheusMeterRegistry prometheusRegistry = (PrometheusMeterRegistry) meterRegistry;
                String metricsOutput = prometheusRegistry.scrape();
                exchange.getIn().setBody(metricsOutput);
            })
            .setHeader(Exchange.CONTENT_TYPE, constant("text/plain; version=0.0.4"));
    }
}
```

### 5. Example Grafana Dashboard

**`grafana-dashboards/betrace-performance.json`:**
```json
{
  "dashboard": {
    "title": "BeTrace Performance Dashboard",
    "tags": ["betrace", "performance", "observability"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Span Ingestion Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(betrace_span_ingestion_total[5m])",
            "legendFormat": "Ingestion Rate"
          }
        ],
        "yaxes": [
          {
            "label": "spans/sec",
            "format": "short"
          }
        ]
      },
      {
        "id": 2,
        "title": "Rule Evaluation Latency (p99)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, betrace_rule_evaluation_latency_seconds)",
            "legendFormat": "p99 Latency"
          }
        ],
        "yaxes": [
          {
            "label": "ms",
            "format": "short"
          }
        ]
      },
      {
        "id": 3,
        "title": "SEDA Queue Sizes",
        "type": "graph",
        "targets": [
          {
            "expr": "betrace_seda_queue_size",
            "legendFormat": "{{queue}}"
          }
        ],
        "yaxes": [
          {
            "label": "queue size",
            "format": "short"
          }
        ]
      },
      {
        "id": 4,
        "title": "Cache Hit Rates",
        "type": "stat",
        "targets": [
          {
            "expr": "betrace_cache_hit_rate",
            "legendFormat": "{{cache}}"
          }
        ],
        "options": {
          "graphMode": "none",
          "colorMode": "value",
          "unit": "percentunit"
        }
      },
      {
        "id": 5,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "betrace_memory_usage_mb",
            "legendFormat": "Memory (MB)"
          }
        ],
        "yaxes": [
          {
            "label": "MB",
            "format": "short"
          }
        ]
      },
      {
        "id": 6,
        "title": "TigerBeetle Write Latency (Heatmap)",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(betrace_tigerbeetle_write_latency_seconds_bucket[5m])",
            "format": "heatmap"
          }
        ]
      },
      {
        "id": 7,
        "title": "Active Tenants",
        "type": "stat",
        "targets": [
          {
            "expr": "betrace_active_tenants",
            "legendFormat": "Active Tenants"
          }
        ],
        "options": {
          "graphMode": "none",
          "colorMode": "value"
        }
      }
    ],
    "refresh": "10s",
    "time": {
      "from": "now-1h",
      "to": "now"
    }
  }
}
```

### 6. Enhanced MetricsService

**Updates to `com/betrace/services/MetricsService.java`:**
```java
@ApplicationScoped
public class MetricsService {

    @Inject
    PrometheusMetricsExporter prometheusExporter;

    private final AtomicLong spanIngestionCount = new AtomicLong(0);
    private final AtomicLong ruleEvaluationCount = new AtomicLong(0);
    private final AtomicLong signalCreationCount = new AtomicLong(0);
    private final AtomicLong ruleEvaluationFallbackCount = new AtomicLong(0);
    private final AtomicLong storageWriteFallbackCount = new AtomicLong(0);

    private final List<Long> spanIngestionLatencies = new CopyOnWriteArrayList<>();
    private final List<Long> ruleEvaluationLatencies = new CopyOnWriteArrayList<>();
    private final List<Long> tigerBeetleWriteLatencies = new CopyOnWriteArrayList<>();
    private final List<Long> duckDBInsertLatencies = new CopyOnWriteArrayList<>();

    private final Set<UUID> activeTenants = ConcurrentHashMap.newKeySet();

    public void recordSpanIngestion(long count, long latencyMs) {
        spanIngestionCount.addAndGet(count);
        spanIngestionLatencies.add(latencyMs);
        prometheusExporter.recordSpanIngestion(count);
    }

    public void recordRuleEvaluation(long latencyMs) {
        ruleEvaluationCount.incrementAndGet();
        ruleEvaluationLatencies.add(latencyMs);
        prometheusExporter.recordRuleEvaluation(latencyMs);
    }

    public void recordSignalCreation(long count) {
        signalCreationCount.addAndGet(count);
    }

    public void recordTigerBeetleWrite(long latencyMs) {
        tigerBeetleWriteLatencies.add(latencyMs);
        prometheusExporter.recordTigerBeetleWrite(latencyMs);
    }

    public void recordDuckDBInsert(long latencyMs) {
        duckDBInsertLatencies.add(latencyMs);
        prometheusExporter.recordDuckDBInsert(latencyMs);
    }

    public void recordRuleEvaluationFallback() {
        ruleEvaluationFallbackCount.incrementAndGet();
    }

    public void recordStorageWriteFallback(long signalCount) {
        storageWriteFallbackCount.addAndGet(signalCount);
    }

    public void registerActiveTenant(UUID tenantId) {
        activeTenants.add(tenantId);
    }

    public void unregisterActiveTenant(UUID tenantId) {
        activeTenants.remove(tenantId);
    }

    public int getActiveTenantCount() {
        return activeTenants.size();
    }

    public double getSpanIngestionRate() {
        return spanIngestionCount.get() / 60.0; // Per minute
    }

    public long getRuleEvaluationP99() {
        return calculateP99(ruleEvaluationLatencies);
    }

    public long getTigerBeetleWriteLatency() {
        return calculateP99(tigerBeetleWriteLatencies);
    }

    public long getDuckDBInsertThroughput() {
        return signalCreationCount.get() / 60; // Per minute
    }

    private long calculateP99(List<Long> latencies) {
        if (latencies.isEmpty()) {
            return 0;
        }
        List<Long> sorted = new ArrayList<>(latencies);
        sorted.sort(Long::compareTo);
        int index = (int) (sorted.size() * 0.99);
        return sorted.get(Math.min(index, sorted.size() - 1));
    }
}
```

## Configuration Properties

```properties
# Metrics Configuration
betrace.metrics.enabled=true
betrace.metrics.export-interval-seconds=60

# Prometheus Configuration
betrace.prometheus.enabled=true
betrace.prometheus.port=9090
betrace.prometheus.path=/metrics

# Performance Monitoring
betrace.monitoring.performance-endpoint.enabled=true
betrace.monitoring.cache-stats.enabled=true
betrace.monitoring.queue-stats.enabled=true
```

## Success Criteria

- [ ] Performance metrics API exposes all key metrics
- [ ] Prometheus endpoint exports metrics in correct format
- [ ] Cache statistics endpoint shows hit rate, eviction count
- [ ] Queue statistics endpoint shows current size, utilization
- [ ] System statistics endpoint shows memory, CPU, threads
- [ ] Grafana dashboard JSON includes all panels
- [ ] Metrics integrated with MetricsService
- [ ] 90% test coverage for metrics routes (ADR-014)

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**`PerformanceMetricsRoutesTest.java`:**
- Test GET /api/performance/metrics
- Test GET /api/performance/cache-stats
- Test GET /api/performance/queue-stats
- Test GET /api/performance/system-stats
- Test JSON response format

**`PrometheusRoutesTest.java`:**
- Test GET /metrics
- Test Prometheus format output
- Test metric labels

**`SystemStatsProcessorTest.java`:**
- Test memory statistics calculation
- Test CPU statistics
- Test thread statistics
- Test GC statistics

**`PrometheusMetricsExporterTest.java`:**
- Test metric recording
- Test counter increments
- Test timer recording
- Test gauge values

### Integration Tests

**`MetricsIntegrationTest.java`:**
```java
@QuarkusTest
public class MetricsIntegrationTest {

    @Test
    @DisplayName("Should export metrics via /api/performance/metrics")
    public void testPerformanceMetricsEndpoint() {
        given()
            .when().get("/api/performance/metrics")
            .then()
            .statusCode(200)
            .contentType("application/json")
            .body("spanIngestionRate", notNullValue())
            .body("ruleEvaluationP99", notNullValue())
            .body("activeTenants", notNullValue());
    }

    @Test
    @DisplayName("Should export metrics in Prometheus format")
    public void testPrometheusEndpoint() {
        given()
            .when().get("/metrics")
            .then()
            .statusCode(200)
            .contentType(containsString("text/plain"))
            .body(containsString("betrace_span_ingestion_total"))
            .body(containsString("betrace_rule_evaluation_latency_seconds"));
    }

    @Test
    @DisplayName("Should track cache statistics")
    public void testCacheStatsEndpoint() {
        given()
            .when().get("/api/performance/cache-stats")
            .then()
            .statusCode(200)
            .contentType("application/json")
            .body("ruleContainers.hitRate", notNullValue())
            .body("publicKeys.hitRate", notNullValue());
    }

    @Test
    @DisplayName("Should track queue statistics")
    public void testQueueStatsEndpoint() {
        given()
            .when().get("/api/performance/queue-stats")
            .then()
            .statusCode(200)
            .contentType("application/json")
            .body("span-ingestion.currentSize", notNullValue())
            .body("rule-evaluation.currentSize", notNullValue());
    }
}
```

## Files to Create

### Backend - Routes
- `backend/src/main/java/com/betrace/routes/PerformanceMetricsRoutes.java`
- `backend/src/main/java/com/betrace/routes/PrometheusRoutes.java`

### Backend - Processors
- `backend/src/main/java/com/betrace/processors/metrics/SystemStatsProcessor.java`

### Backend - Services
- `backend/src/main/java/com/betrace/services/PrometheusMetricsExporter.java`

### Tests - Unit Tests
- `backend/src/test/java/com/betrace/routes/PerformanceMetricsRoutesTest.java`
- `backend/src/test/java/com/betrace/routes/PrometheusRoutesTest.java`
- `backend/src/test/java/com/betrace/processors/metrics/SystemStatsProcessorTest.java`
- `backend/src/test/java/com/betrace/services/PrometheusMetricsExporterTest.java`

### Tests - Integration Tests
- `backend/src/test/java/com/betrace/integration/MetricsIntegrationTest.java`

### Documentation (Optional - external consumer responsibility)
- `grafana-dashboards/betrace-performance.json` (example dashboard)

## Files to Modify

### Backend - Services
- `backend/src/main/java/com/betrace/services/MetricsService.java`
  - Add Prometheus exporter integration
  - Add active tenant tracking
  - Add fallback metrics

### Dependencies (pom.xml)
- Add Micrometer Prometheus registry dependency

```xml
<!-- Add to backend/pom.xml -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
    <version>1.11.5</version>
</dependency>
```

### Configuration
- `backend/src/main/resources/application.properties`
  - Add metrics and Prometheus configuration

## Implementation Timeline

**Week 6:** Observability
- Day 1-2: PerformanceMetricsRoutes + SystemStatsProcessor
- Day 3: PrometheusMetricsExporter + PrometheusRoutes
- Day 4: MetricsService enhancements
- Day 5: Integration tests
- Day 6-7: Grafana dashboard, documentation

**Deliverable:** Performance observability complete

## Dependencies

**Requires:**
- Unit A: MetricsService (enhanced)
- Unit B: Queue monitoring
- Unit D: Cache statistics
- Unit E: Queue monitoring service

**Blocks:**
- Production readiness (enables monitoring)

## Performance Targets

- Metrics API latency: <10ms
- Prometheus scrape latency: <50ms
- Metrics overhead: <1% CPU
- Metric storage: <10 MB memory

## ADR Compliance

- **ADR-011:** Pure application, metrics exported for external consumers
- **ADR-013:** Metrics integrated with Camel routes
- **ADR-014:** Named processors with 90% test coverage
- **ADR-015:** Observes tiered storage performance
