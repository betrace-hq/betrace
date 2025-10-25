# BeTrace Release Candidate Test Suite

Comprehensive automated test suite for validating BeTrace releases before production deployment.

## Overview

This test suite validates the **full stack** (Grafana + Backend + Plugin + Tempo + Alloy) with real-world scenarios, edge cases, and negative testing. It is the last line of defense before publishing.

## Philosophy

- **Feature-focused**: Tests validate use cases, not just code paths
- **Negative testing**: Invalid inputs, edge cases, failure scenarios
- **Real-world scenarios**: Multi-trace patterns, high volume, sporadic activity
- **Full stack**: Tests interact with actual services, not mocks
- **Performance validation**: Ensures 100K rules, 1M spans work as designed

## Test Categories

### 1. Rule Lifecycle Tests (`scenarios/01-rule-lifecycle/`)
- Create valid rules (simple, complex, enterprise-scale)
- Update existing rules
- Delete rules
- **Negative**: Invalid syntax, oversized expressions, duplicate names
- **Negative**: Exceed 100K rule limit
- **Edge**: Rules created before backend startup (persistence)
- **Edge**: Rapid rule creation/deletion (race conditions)

### 2. Span Ingestion Tests (`scenarios/02-span-ingestion/`)
- High-volume span ingestion (1M spans in 5 minutes)
- Sporadic spans (1 span per minute)
- Malformed spans (missing fields, invalid JSON)
- **Negative**: Oversized spans (>10MB body)
- **Negative**: Too many attributes (>128)
- **Edge**: Spans arriving out of order
- **Edge**: Duplicate span IDs

### 3. Rule Evaluation Tests (`scenarios/03-rule-evaluation/`)
- Single-span rule matches
- Multi-span trace matches (span.count(), grouping)
- Rules that should NOT match (false positives)
- **Negative**: Rules with runtime errors
- **Edge**: Multiple rules matching same span
- **Edge**: Rule evaluation performance (< 1ms per trace)

### 4. Integration Tests (`scenarios/04-integration/`)
- Backend → Tempo span export (violation spans created)
- Grafana → Backend API (rule CRUD via plugin)
- Alloy → Backend OTLP ingestion
- **Negative**: Service unavailable (Tempo down)
- **Edge**: Network latency, timeouts

### 5. Compliance Tests (`scenarios/05-compliance/`)
- SOC2 compliance span generation (@SOC2 annotations)
- Redaction enforcement (PII not logged)
- Audit trail integrity (compliance spans signed)
- **Negative**: Unsigned compliance spans rejected

### 6. Performance Tests (`scenarios/06-performance/`)
- 100K rules loaded (memory usage < 128MB)
- 1M violations stored (graceful degradation)
- Parser performance (pathological rules < 1s)
- **Edge**: Sustained high load (1000 spans/sec for 1 hour)

### 7. Recovery Tests (`scenarios/07-recovery/`)
- Backend restart with existing rules
- Grafana plugin survives backend restart
- Graceful degradation when Tempo unavailable
- **Negative**: Corrupted rule data (backend rejects on load)

## Running the Suite

```bash
# Full suite (requires Docker)
cd tests/rc-suite
go test -v ./... -tags=rc

# Specific scenario
go test -v ./scenarios/01-rule-lifecycle -tags=rc

# Performance tests only
go test -v ./scenarios/06-performance -tags=rc -timeout=2h

# Generate HTML report
go test -v ./... -tags=rc -json | tee reports/rc-$(date +%Y%m%d-%H%M%S).json
```

## Prerequisites

- Docker & Docker Compose (for full stack)
- Go 1.23+
- ~8GB RAM (for performance tests)
- ~10GB disk (for span fixtures)

## Test Fixtures

- `fixtures/rules/` - Pre-defined rule expressions (valid, invalid, edge cases)
- `fixtures/spans/` - Pre-generated span datasets (1K, 10K, 100K, 1M spans)
- `fixtures/traces/` - Multi-span trace patterns

## Success Criteria

All tests must pass with:
- ✅ 0 failures
- ✅ 0 panics
- ✅ < 5% performance degradation from previous RC
- ✅ All negative tests correctly reject invalid inputs
- ✅ Memory usage within configured limits
- ✅ No leaked goroutines

## CI Integration

This suite runs on:
- **Pre-release**: Before tagging any version
- **Nightly**: Full suite against main branch
- **Performance**: Weekly benchmarks tracked over time

See `.github/workflows/rc-test-suite.yml` for CI configuration.
