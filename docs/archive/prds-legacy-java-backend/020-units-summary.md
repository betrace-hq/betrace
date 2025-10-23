# PRD-020: Performance Optimization - Unit PRDs Summary

This document summarizes the split of PRD-020 into independently implementable unit PRDs.

## Overview

PRD-020 has been split into **7 unit PRDs** (A-G), each focused on a specific aspect of performance optimization. Units can be implemented in parallel where dependencies allow.

## Unit PRDs

### Unit A: Batching Infrastructure
**File:** `020a-batching-infrastructure.md`
**Priority:** P1 (Foundation - fastest wins)
**Dependencies:** None
**Timeline:** Week 1

**Scope:**
- BatchSpanLogWriteProcessor (buffered writes)
- BatchTigerBeetleWriteProcessor (128 transfers per batch)
- BatchDuckDBInsertProcessor (1000 rows per transaction)
- DuckDBConnectionPool (HikariCP)
- MetricsService (basic metrics collection)

**Key Deliverables:**
- TigerBeetle write latency: <5ms p99 (batched)
- DuckDB insert throughput: 50K rows/sec
- Span log write throughput: 100K spans/sec

---

### Unit B: Async SEDA Pipeline
**File:** `020b-async-seda-pipeline.md`
**Priority:** P1
**Dependencies:** Unit A (batching processors)
**Timeline:** Week 2

**Scope:**
- AsyncSpanProcessingRoutes (4-stage SEDA pipeline)
- SpanAggregationStrategy (group spans by trace)
- BatchRuleEvaluationProcessor (evaluate 100 spans at once)
- SignalAggregationStrategy (batch signals for storage)
- Dead letter queue handling

**Key Deliverables:**
- Span ingestion throughput: 100K spans/sec
- Rule evaluation latency: <100ms p99 (batch)
- End-to-end latency: <500ms

---

### Unit C: Streaming Evaluation
**File:** `020c-streaming-evaluation.md`
**Priority:** P1
**Dependencies:** Units A, B
**Timeline:** Week 3

**Scope:**
- StreamingRuleEvaluationProcessor (sliding windows)
- SlidingWindow class (overlap logic)
- LongLivedTraceRoutes (routing logic)
- Trace window cleanup

**Key Deliverables:**
- Handle 10K+ span traces without OOM
- Memory per trace window: <1 MB
- Concurrent trace capacity: 500 traces

---

### Unit D: Caching Infrastructure
**File:** `020d-caching-infrastructure.md`
**Priority:** P1
**Dependencies:** None (parallel with A-C)
**Timeline:** Week 4 (first half)

**Scope:**
- PerformanceCacheService (Caffeine)
- Rule container caching (per tenant)
- Public key caching
- Trace metadata caching
- Cache warmup on startup

**Key Deliverables:**
- Rule container cache hit rate: >80%
- Public key cache hit rate: >90%
- Cache hit latency: <1ms

---

### Unit E: Backpressure and Circuit Breakers
**File:** `020e-backpressure-circuit-breakers.md`
**Priority:** P1
**Dependencies:** Units A, B
**Timeline:** Week 4 (second half)

**Scope:**
- BackpressureRoutes (503 rejection when queue full)
- Circuit breakers (rule eval, storage write)
- FallbackRuleEvaluationProcessor
- FallbackStorageWriteProcessor
- QueueMonitoringService

**Key Deliverables:**
- Backpressure trigger: Queue >90% full
- Circuit breaker failure threshold: 50%
- Graceful degradation under load

---

### Unit F: Performance Testing
**File:** `020f-performance-testing.md`
**Priority:** P1
**Dependencies:** Units A, B, C, D, E (validates all)
**Timeline:** Week 5

**Scope:**
- JMH micro-benchmarks
- Load tests (100K spans/sec)
- Memory profiling tests
- Performance regression tests
- Flame graph generation

**Key Deliverables:**
- Validates all performance targets
- JMH benchmarks for critical paths
- Load tests for throughput/latency
- Memory leak detection

---

### Unit G: Observability and Metrics
**File:** `020g-observability-metrics.md`
**Priority:** P1
**Dependencies:** None (parallel with A-F)
**Timeline:** Week 6

**Scope:**
- PerformanceMetricsRoutes (API endpoints)
- PrometheusMetricsExporter (Prometheus format)
- SystemStatsProcessor (memory, CPU, threads)
- Example Grafana dashboard JSON

**Key Deliverables:**
- Prometheus metrics exported
- Performance metrics API
- Grafana dashboard example

---

## Dependency Graph

```
Unit A (Batching)         Unit D (Caching)      Unit G (Metrics)
     ↓                         ↓                       ↓
Unit B (Async SEDA) ────────→ Unit E (Backpressure) ←─┘
     ↓                         ↓
Unit C (Streaming) ───────────┘
     ↓
Unit F (Performance Testing)
```

**Critical Path:**
A → B → C → F (4 weeks minimum)

**Parallel Paths:**
- D (Caching) can run parallel with A-C
- E (Backpressure) depends on B
- G (Metrics) can run parallel with A-F

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)
**Unit A only**
- Implement batching processors
- Establish performance baselines
- JMH benchmarks for batching

**Why first:** Fastest wins, foundation for all other units

### Phase 2: Async Pipeline (Week 2)
**Unit B**
- Build async SEDA pipeline
- Integrate Unit A batching processors
- Integration tests

**Why second:** Enables throughput, depends on batching

### Phase 3: Long-Lived Traces (Week 3)
**Unit C**
- Implement streaming evaluation
- Memory-bounded processing
- Load tests for long traces

**Why third:** Prevents OOM, depends on async pipeline

### Phase 4: Resilience (Week 4)
**Units D + E in parallel**
- D: Caching infrastructure
- E: Backpressure and circuit breakers

**Why fourth:** Optimizes hot paths, adds resilience

### Phase 5: Validation (Week 5)
**Unit F**
- Comprehensive performance testing
- Validate all targets met
- Performance regression tests

**Why fifth:** Validates all previous work

### Phase 6: Observability (Week 6)
**Unit G**
- Metrics and monitoring
- Grafana dashboards
- Prometheus integration

**Why sixth:** Enables production monitoring

---

## Performance Targets (Validated by Unit F)

| Metric | Target | Validated By |
|--------|--------|--------------|
| Span ingestion throughput | 100K/sec | Units A, B, F |
| Rule evaluation p99 latency | <100ms | Units B, C, F |
| Memory per tenant | <50 MB | Units C, D, F |
| Long-lived trace handling | Streaming | Units C, F |
| TigerBeetle write latency | <5ms (batched) | Units A, F |
| DuckDB insert throughput | 50K rows/sec | Units A, F |
| Max concurrent tenants | 500 | Units D, F |
| Cache hit rate (rules) | >80% | Units D, F |
| Backpressure trigger | Queue >90% | Units E, F |

---

## Testing Requirements

Each unit must achieve **90% test coverage** (ADR-014):

**Unit A:**
- Unit tests for batching processors
- JMH benchmarks for batch writes

**Unit B:**
- Route configuration tests
- Integration tests for async pipeline

**Unit C:**
- Unit tests for sliding windows
- Load tests for long-lived traces
- Memory profiling tests

**Unit D:**
- Unit tests for caching logic
- Cache hit rate validation
- JMH benchmarks for cache

**Unit E:**
- Backpressure integration tests
- Circuit breaker triggering tests
- Fallback processor tests

**Unit F:**
- JMH benchmarks for all paths
- High throughput load tests (100K spans/sec)
- Sustained load tests (5 minutes)
- Memory leak detection tests
- Performance regression tests

**Unit G:**
- Metrics API tests
- Prometheus format validation
- Integration tests for metrics

---

## ADR Compliance

All units comply with BeTrace architectural decisions:

- **ADR-011 (Pure Application):** No deployment coupling, consumers configure JVM/infrastructure
- **ADR-013 (Camel-First):** All async via SEDA queues, Wire Tap for audit
- **ADR-014 (Named Processors):** 90% test coverage, named processors for testability
- **ADR-015 (Tiered Storage):** Optimize append-only writes, batch DuckDB inserts

---

## Files Created Summary

**Unit PRDs:**
- `/Users/sscoble/Projects/betrace/docs/prds/020a-batching-infrastructure.md`
- `/Users/sscoble/Projects/betrace/docs/prds/020b-async-seda-pipeline.md`
- `/Users/sscoble/Projects/betrace/docs/prds/020c-streaming-evaluation.md`
- `/Users/sscoble/Projects/betrace/docs/prds/020d-caching-infrastructure.md`
- `/Users/sscoble/Projects/betrace/docs/prds/020e-backpressure-circuit-breakers.md`
- `/Users/sscoble/Projects/betrace/docs/prds/020f-performance-testing.md`
- `/Users/sscoble/Projects/betrace/docs/prds/020g-observability-metrics.md`

**This Summary:**
- `/Users/sscoble/Projects/betrace/docs/prds/020-units-summary.md`

---

## Next Steps

1. Review unit PRDs with team
2. Prioritize units based on dependencies
3. Assign units to developers
4. Begin implementation with Unit A (Week 1)
5. Validate each unit with Unit F tests
6. Deploy observability (Unit G) for production monitoring

---

## Questions for Implementation

**Unit A:**
- What buffer size for span log writes? (default: 1000)
- Should we batch across tenants or per-tenant? (per-tenant)

**Unit B:**
- What SEDA queue sizes? (default: 10K span-ingestion, 5K rule-eval)
- How many concurrent consumers? (default: 10 ingestion, 5 eval)

**Unit C:**
- What window size for streaming? (default: 100 spans)
- What overlap percentage? (default: 20%)
- What max trace age? (default: 60 minutes)

**Unit D:**
- What cache sizes? (default: 500 tenants, 1000 keys, 10K traces)
- What expiration times? (default: 30min rules, 1hr keys, 5min traces)

**Unit E:**
- What backpressure threshold? (default: 90%)
- What circuit breaker failure rate? (default: 50%)
- What circuit breaker delay? (default: 30s)

**Unit F:**
- What JMH warmup/measurement iterations? (default: 3 warmup, 5 measurement)
- What load test duration? (default: 60 seconds sustained)

**Unit G:**
- What metrics export interval? (default: 60 seconds)
- What Prometheus port? (default: 9090)
