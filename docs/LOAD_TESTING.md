# BeTrace Load Testing Guide

**Version**: 2.0.0
**Last Updated**: 2025-11-02

---

## Overview

This guide covers load testing BeTrace to verify end-to-end trace flow and violation detection under realistic production loads.

## Test Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Load Test Script                                            │
│  - Generates OTLP traces                                     │
│  - Injects violations (10% of traces)                        │
│  - Sends to Alloy OTLP endpoint                              │
└────────────────┬─────────────────────────────────────────────┘
                 ↓ (OTLP/HTTP)
┌──────────────────────────────────────────────────────────────┐
│  Alloy (Grafana Agent)                                       │
│  - Receives OTLP traces                                      │
│  - Tail-based sampling                                       │
│  - Exports to Tempo                                          │
└────────────────┬─────────────────────────────────────────────┘
                 ↓ (OTLP/gRPC)
┌──────────────────────────────────────────────────────────────┐
│  BeTrace Backend                                             │
│  - Ingests spans                                             │
│  - Evaluates rules                                           │
│  - Emits violations to Tempo                                 │
└────────────────┬─────────────────────────────────────────────┘
                 ↓ (Violation spans)
┌──────────────────────────────────────────────────────────────┐
│  Tempo                                                       │
│  - Stores all traces                                         │
│  - Stores violation spans                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

```bash
# 1. Start all services
flox services start

# Wait for services to initialize (30 seconds)
sleep 30

# 2. Verify services are healthy
flox services status

# Expected output:
# NAME       STATUS    PID
# alloy      Running   12345
# backend    Running   12346
# grafana    Running   12347
# loki       Running   12348
# prometheus Running   12349
# pyroscope  Running   12350
# tempo      Running   12351
```

### Run Load Test

```bash
# Basic test (100 spans/sec for 60 seconds)
./scripts/load-test.sh

# Custom configuration
SPANS_PER_SECOND=1000 DURATION_SECONDS=300 ./scripts/load-test.sh

# High load test (10k spans/sec for 10 minutes)
SPANS_PER_SECOND=10000 DURATION_SECONDS=600 VIOLATION_RATE=0.05 ./scripts/load-test.sh
```

### Verify Results

```bash
# Check violations were detected
curl http://localhost:12011/v1/violations | jq

# Check violations in Tempo
curl "http://localhost:3200/api/search?tags=betrace.violation.id" | jq

# View in Grafana
open http://localhost:12015/a/betrace-app/violations
```

---

## Load Test Scenarios

### Scenario 1: Normal Load (100 spans/sec)

**Purpose**: Verify basic functionality under typical load

**Configuration**:
```bash
export SPANS_PER_SECOND=100
export DURATION_SECONDS=60
export VIOLATION_RATE=0.1
```

**Expected Results**:
- Total spans: ~6,000
- Expected violations: ~600
- Backend CPU: < 5%
- Backend Memory: < 100MB

**Run**:
```bash
./scripts/load-test.sh
```

---

### Scenario 2: Medium Load (1k spans/sec)

**Purpose**: Test sustained production load

**Configuration**:
```bash
export SPANS_PER_SECOND=1000
export DURATION_SECONDS=300
export VIOLATION_RATE=0.1
```

**Expected Results**:
- Total spans: ~300,000
- Expected violations: ~30,000
- Backend CPU: ~20%
- Backend Memory: ~200MB

**Run**:
```bash
SPANS_PER_SECOND=1000 DURATION_SECONDS=300 ./scripts/load-test.sh
```

---

### Scenario 3: High Load (10k spans/sec)

**Purpose**: Test capacity limits and performance under stress

**Configuration**:
```bash
export SPANS_PER_SECOND=10000
export DURATION_SECONDS=600
export VIOLATION_RATE=0.05
```

**Expected Results**:
- Total spans: ~6,000,000
- Expected violations: ~300,000
- Backend CPU: ~70%
- Backend Memory: ~500MB

**Run**:
```bash
SPANS_PER_SECOND=10000 DURATION_SECONDS=600 VIOLATION_RATE=0.05 ./scripts/load-test.sh
```

---

### Scenario 4: Spike Load (burst test)

**Purpose**: Test resilience to traffic spikes

**Configuration**:
```bash
# Baseline: 100 spans/sec for 60s
SPANS_PER_SECOND=100 DURATION_SECONDS=60 ./scripts/load-test.sh

# Spike: 10k spans/sec for 30s
SPANS_PER_SECOND=10000 DURATION_SECONDS=30 ./scripts/load-test.sh &

# Return to baseline
sleep 30
SPANS_PER_SECOND=100 DURATION_SECONDS=60 ./scripts/load-test.sh
```

**Expected Results**:
- Backend handles spike gracefully
- No errors or dropped spans
- CPU returns to baseline after spike

---

## Manual Testing (Without Script)

### Send Single Test Span

```bash
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [{
          "key": "service.name",
          "value": {"stringValue": "test-service"}
        }]
      },
      "scopeSpans": [{
        "spans": [{
          "traceId": "'$(openssl rand -hex 16)'",
          "spanId": "'$(openssl rand -hex 8)'",
          "name": "slow-operation",
          "kind": 2,
          "startTimeUnixNano": "'$(date +%s%N)'",
          "endTimeUnixNano": "'$(($(date +%s%N) + 2000000000))'",
          "status": {"code": 0},
          "attributes": [{
            "key": "http.method",
            "value": {"stringValue": "GET"}
          }]
        }]
      }]
    }]
  }'
```

### Verify Span Reached Backend

```bash
# Check backend logs
flox services logs backend | tail -20

# Should see:
# Ingested span: trace_id=... span_id=... name=slow-operation
```

### Check for Violations

```bash
# List recent violations
curl http://localhost:12011/v1/violations?start_time=$(date -u -d '5 minutes ago' +%s) | jq

# Check violation count
curl http://localhost:12011/v1/violations?start_time=$(date -u -d '5 minutes ago' +%s) | jq '.violations | length'
```

---

## Performance Benchmarks

### Backend Performance (from benchmarks)

| Scenario | Throughput | Latency (p99) | CPU | Memory |
|----------|-----------|---------------|-----|--------|
| No rules | 16.96M spans/sec | <100ns | N/A | 0B |
| 1 rule | 13.27M spans/sec | <150ns | ~5% | ~50MB |
| 10 rules | 3.78M spans/sec | <500ns | ~20% | ~100MB |
| Production (50 rules) | ~1M spans/sec | <2ms | ~50% | ~500MB |

### Expected Load Test Results

| Test | Spans | Violations | Duration | Pass Criteria |
|------|-------|------------|----------|---------------|
| Normal | 6k | ~600 | 60s | > 90% violations detected |
| Medium | 300k | ~30k | 300s | > 90% violations detected |
| High | 6M | ~300k | 600s | > 85% violations detected |
| Spike | Varies | Varies | 120s | No errors, CPU recovers |

---

## Monitoring During Load Tests

### Grafana Dashboards

1. **BeTrace Backend Overview**
   - URL: http://localhost:12015/d/betrace-backend
   - Metrics: Span ingestion rate, rule evaluation time, violation rate

2. **Tempo Dashboard**
   - URL: http://localhost:12015/d/tempo
   - Metrics: Trace ingestion rate, storage usage

3. **Alloy Dashboard**
   - URL: http://localhost:12015/d/alloy
   - Metrics: OTLP receiver throughput, sampling rates

### Key Metrics to Watch

```bash
# Backend metrics
curl http://localhost:12011/metrics | grep betrace_

# Key metrics:
# - betrace_spans_ingested_total
# - betrace_violations_total
# - betrace_rule_evaluations_total
# - betrace_rule_evaluation_duration_seconds

# System metrics
kubectl top pods -n betrace  # If running in Kubernetes
# Or
docker stats betrace-backend  # If running in Docker
```

### Alerting During Tests

Alerts should NOT fire during normal load tests. If alerts fire, investigate:

- **BeTraceHighCPU**: CPU > 80% sustained
  - Action: Verify load is within capacity (< 10k spans/sec per instance)

- **BeTraceHighLatency**: p99 > 500ms
  - Action: Check rule complexity, reduce rule count

- **BeTraceHighViolationRate**: > 100 violations/sec
  - Action: Expected during load test if VIOLATION_RATE is high

---

## Troubleshooting

### Issue: No violations detected

**Symptoms**:
```bash
curl http://localhost:12011/v1/violations | jq '.violations | length'
# Output: 0
```

**Diagnosis**:
```bash
# 1. Check if rules exist
curl http://localhost:12011/v1/rules | jq '.rules | length'

# 2. Check if spans are being ingested
flox services logs backend | grep "Ingested span"

# 3. Check if rules are enabled
curl http://localhost:12011/v1/rules | jq '.rules[] | {name, enabled}'
```

**Solutions**:
1. Verify rules were created: `./scripts/load-test.sh` creates test rules automatically
2. Verify Alloy is forwarding to backend (check Alloy config)
3. Verify rule expressions match test spans

---

### Issue: High error rate during test

**Symptoms**:
```bash
./scripts/load-test.sh
# Output: Many "curl: (52) Empty reply from server" errors
```

**Diagnosis**:
```bash
# Check backend logs for errors
flox services logs backend | grep ERROR

# Check backend CPU/memory
top -pid $(pgrep betrace-backend)
```

**Solutions**:
1. Reduce `SPANS_PER_SECOND` (backend may be overloaded)
2. Increase backend resources (if running in container)
3. Check for rule evaluation errors (DSL syntax issues)

---

### Issue: Violations not appearing in Tempo

**Symptoms**:
```bash
curl "http://localhost:3200/api/search?tags=betrace.violation.id" | jq '.traces | length'
# Output: 0
```

**Diagnosis**:
```bash
# 1. Check backend can reach Tempo
curl http://localhost:3200/ready

# 2. Check OTLP export env var
flox services logs backend | grep OTEL_EXPORTER_OTLP_ENDPOINT

# 3. Check Tempo logs
flox services logs tempo | tail -20
```

**Solutions**:
1. Verify `OTEL_EXPORTER_OTLP_ENDPOINT` is set correctly
2. Restart backend: `flox services restart backend`
3. Check Tempo retention (violations may have expired)

---

## Advanced Load Testing

### Using k6 for Programmatic Tests

```javascript
// k6-load-test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp-up to 100 VUs
    { duration: '5m', target: 100 },  // Stay at 100 VUs
    { duration: '2m', target: 0 },    // Ramp-down to 0 VUs
  ],
};

export default function() {
  const traceId = Math.random().toString(16).substring(2, 34);
  const spanId = Math.random().toString(16).substring(2, 18);
  const now = Date.now() * 1000000;

  const payload = JSON.stringify({
    resourceSpans: [{
      resource: {
        attributes: [{ key: 'service.name', value: { stringValue: 'k6-test' }}]
      },
      scopeSpans: [{
        spans: [{
          traceId: traceId,
          spanId: spanId,
          name: 'api.request',
          kind: 2,
          startTimeUnixNano: now.toString(),
          endTimeUnixNano: (now + 600000000).toString(),  // 600ms
          status: { code: 0 },
          attributes: []
        }]
      }]
    }]
  });

  const res = http.post('http://localhost:4318/v1/traces', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

**Run**:
```bash
k6 run k6-load-test.js
```

---

### Using OpenTelemetry SDK

```go
// loadtest.go
package main

import (
    "context"
    "time"

    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    "go.opentelemetry.io/otel/sdk/trace"
)

func main() {
    exporter, _ := otlptracehttp.New(context.Background(),
        otlptracehttp.WithEndpoint("localhost:4318"),
        otlptracehttp.WithInsecure(),
    )

    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
    )
    otel.SetTracerProvider(tp)

    tracer := otel.Tracer("loadtest")

    // Generate 10k spans
    for i := 0; i < 10000; i++ {
        ctx, span := tracer.Start(context.Background(), "operation")
        time.Sleep(time.Millisecond * 600)  // Trigger slow-request rule
        span.End()
    }

    tp.Shutdown(context.Background())
}
```

**Run**:
```bash
go run loadtest.go
```

---

## Load Test Results Template

After running load tests, document results:

```markdown
## Load Test Results - 2025-11-02

### Configuration
- **Scenario**: High Load
- **Duration**: 600s
- **Target Rate**: 10k spans/sec
- **Violation Rate**: 5%

### Results
- **Total Spans**: 6,000,000
- **Violations Detected**: 298,450 (99.5% of expected)
- **Average Latency**: 1.2ms (p50), 4.5ms (p99)
- **Backend CPU**: Peak 72%, Average 68%
- **Backend Memory**: Peak 520MB, Average 480MB
- **Errors**: 0

### Violations Breakdown
- load-test-slow-requests: 150,200
- load-test-errors: 98,150
- load-test-missing-auth: 50,100

### Conclusion
✅ Backend handled 10k spans/sec with 0 errors
✅ 99.5% violation detection rate (exceeds 85% target)
✅ Resource usage within limits
✅ Ready for production at this load
```

---

## Next Steps

1. **Baseline Testing**: Run Scenario 1 (normal load) to establish baseline
2. **Capacity Testing**: Run Scenario 3 (high load) to find upper limits
3. **Soak Testing**: Run Scenario 2 (medium load) for 24 hours to detect memory leaks
4. **Chaos Testing**: Inject failures (kill pods, network issues) during load test

---

## Support

- **Load Test Script**: [scripts/load-test.sh](../scripts/load-test.sh)
- **Benchmarks**: [backend/docs/PERFORMANCE_RESULTS.md](../backend/docs/PERFORMANCE_RESULTS.md)
- **Runbooks**: [docs/runbooks/](runbooks/)

---

**Last Updated**: 2025-11-02
**Version**: 2.0.0
