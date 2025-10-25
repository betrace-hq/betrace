# BeTrace RC Test Suite - Runbook

Complete guide for running, debugging, and maintaining the Release Candidate test suite.

## Quick Start

```bash
cd tests/rc-suite

# Run quick tests (skips slow performance tests)
make setup
make test-quick
make teardown

# Run full suite (2-3 hours)
make setup
make test-full
make teardown

# Or use CI helper
make ci
```

## Prerequisites

**Required:**
- Docker 24.0+ & Docker Compose 2.20+
- Go 1.23+
- ~8GB RAM available
- ~20GB disk space

**Check dependencies:**
```bash
make check-deps
```

## Test Categories

### 1. Rule Lifecycle (01-rule-lifecycle)

**What it tests:**
- Creating valid/invalid rules
- Updating existing rules
- Deleting rules
- 100K rule limit enforcement
- Concurrent rule operations

**Run individually:**
```bash
make test-lifecycle
```

**Expected duration:** 30-60 minutes (full), 5 minutes (short)

**Common failures:**
- `rule limit exceeded`: Backend correctly enforcing 100K limit
- `timeout`: Increase timeout in test or reduce rule count
- `validation failed`: Check rule expression syntax

### 2. Span Ingestion (02-span-ingestion)

**What it tests:**
- Single span ingestion
- Batch ingestion (100, 1000 spans)
- High-volume ingestion (1M spans)
- Sporadic ingestion (1 span per 5 seconds)
- Malformed spans (missing fields, invalid types)
- Oversized bodies (>10MB)
- Too many attributes (>128)

**Run individually:**
```bash
make test-ingestion
```

**Expected duration:** 20-40 minutes (full), 2 minutes (short)

**Common failures:**
- `request entity too large`: Correctly rejected by body limit middleware
- `bad request`: Malformed span correctly rejected
- `throughput < 3000 spans/sec`: Performance issue, check backend logs

### 3. Rule Evaluation (03-rule-evaluation)

**What it tests:**
- Simple rule matches (duration, status)
- Attribute-based matching
- Multi-span trace patterns
- Multiple rules matching same span
- Non-matching scenarios (false positives)
- Disabled rules (should not fire)
- Evaluation performance (< 1ms per trace)

**Run individually:**
```bash
make test-evaluation
```

**Expected duration:** 15-30 minutes (full), 3 minutes (short)

**Common failures:**
- `violation not found`: Check rule expression or wait longer for evaluation
- `unexpected violation`: Rule too broad, generating false positives
- `evaluation > 1ms`: Performance regression, investigate rule engine

### 4. Integration (04-integration)

**What it tests:**
- Backend health checks
- Grafana reachability
- Tempo readiness
- Prometheus metrics export
- Backend → Tempo span export
- Service recovery after restart
- End-to-end workflow

**Run individually:**
```bash
go test -v -tags=rc ./scenarios/04-integration
```

**Expected duration:** 10-20 minutes (full), 2 minutes (short)

**Common failures:**
- `service unhealthy`: Check `docker-compose ps` and `make logs`
- `datasource not found`: Grafana provisioning issue, check config
- `timeout`: Increase wait time or investigate service logs

### 6. Performance (06-performance)

**What it tests:**
- 100K rules memory usage (target: ≤ 150MB)
- 1M spans throughput (target: ≥ 3000 spans/sec)
- Rule evaluation latency (target: < 10ms avg)
- Sustained load (1000 spans/sec for 1 hour)
- Memory leak detection

**Run individually:**
```bash
go test -v -tags=rc ./scenarios/06-performance -timeout=3h
```

**Expected duration:** 2-3 hours

**Common failures:**
- `memory > 150MB`: Memory leak or rule AST size regression
- `throughput < 3000`: Backend bottleneck, check CPU/network
- `memory growth > 50%`: Potential memory leak, investigate with pprof

## Debugging Failed Tests

### Step 1: Check Service Health

```bash
cd tests/rc-suite
docker-compose ps
make health
```

All services should show `healthy` status.

### Step 2: View Logs

```bash
# Backend logs
make logs

# All services
make logs-all

# Specific service
docker-compose logs tempo
```

### Step 3: Manual Service Testing

```bash
# Backend health
curl http://localhost:12011/health

# Create rule manually
curl -X POST http://localhost:12011/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "debug-rule",
    "expression": "span.duration > 1000",
    "severity": "HIGH",
    "enabled": true
  }'

# Send span manually
curl -X POST http://localhost:12011/api/spans \
  -H "Content-Type: application/json" \
  -d '{
    "spans": [{
      "traceId": "test-trace-1",
      "spanId": "test-span-1",
      "name": "test.span",
      "startTime": '$(date +%s000000000)',
      "endTime": '$(date +%s000000000)',
      "status": "ok"
    }]
  }'
```

### Step 4: Access Services

- **Grafana:** http://localhost:12015 (admin/admin)
- **Tempo:** http://localhost:3200
- **Prometheus:** http://localhost:9090
- **Backend API:** http://localhost:12011

### Step 5: Check Docker Resources

```bash
docker stats

# Look for:
# - High CPU usage (> 80% sustained)
# - High memory usage (> 6GB)
# - Container restarts
```

### Step 6: Reset Environment

```bash
make teardown
make clean
make setup
```

## Performance Tuning

### Increase Throughput

**Docker resources:**
```yaml
# docker-compose.yml
services:
  betrace-backend:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G
```

**Backend config:**
```yaml
# backend/config.yaml
http:
  max_concurrent_requests: 1000  # Increase from default
grpc:
  max_concurrent_streams: 2000   # Increase from default
```

### Reduce Memory Usage

**Disable verbose logging:**
```yaml
environment:
  - BETRACE_LOG_LEVEL=info  # Change from debug
```

**Increase GC frequency:**
```go
// Add to test setup
debug.SetGCPercent(50) // More aggressive GC
```

## CI Integration

### GitHub Actions Workflow

Located at: `.github/workflows/rc-test-suite.yml`

**Triggers:**
- Manual dispatch (workflow_dispatch)
- Nightly at 2 AM UTC (schedule)
- Version tags (v*)

**Jobs:**
1. `rc-tests` - Full test suite (quick mode for tags, full for nightly)
2. `performance-benchmarks` - Performance tests (nightly only)

**Artifacts:**
- Test results (JSON format)
- Service logs (on failure)
- Performance metrics (90 day retention)

### Running Locally Like CI

```bash
# Simulate CI quick tests
make check-deps
make setup
go test -v -tags=rc -short ./scenarios/... -timeout=30m -json > reports/ci-quick.json
make teardown

# Simulate CI full tests
make check-deps
make ci
```

## Maintenance

### Updating Test Fixtures

Edit `helpers/fixtures.go`:

```go
// Add new rule pattern
func NewRulePattern() RuleFixture {
    return RuleFixture{
        Name: "new-pattern",
        Expression: "...",
        // ...
    }
}
```

### Adding New Test Scenarios

1. Create new directory: `scenarios/0X-new-scenario/`
2. Create test file: `new_scenario_test.go`
3. Add build tag: `// +build rc`
4. Update `Makefile` with new target

### Updating Service Versions

Edit `docker-compose.yml`:

```yaml
services:
  tempo:
    image: grafana/tempo:2.7.0  # Update version
```

Then rebuild:
```bash
make teardown
make setup
```

## Troubleshooting

### "Error: No space left on device"

```bash
# Clean Docker
docker system prune -af --volumes

# Clean test artifacts
make clean
```

### "Error: context deadline exceeded"

Increase test timeout:
```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
```

Or increase service wait time:
```bash
# In Makefile
setup:
    @sleep 60  # Increase from 30
```

### "Error: bind: address already in use"

```bash
# Find process using port
lsof -i :12011

# Kill it or use different ports
# Edit docker-compose.yml ports section
```

### Tests Pass Locally, Fail in CI

**Common causes:**
1. **Resource limits**: CI has less RAM/CPU
   - Solution: Reduce batch sizes or add `-short` flag

2. **Timing issues**: CI is slower
   - Solution: Increase timeouts and sleep durations

3. **Docker networking**: Different in CI
   - Solution: Use service names, not localhost

## Performance Baselines

Track these metrics over time:

| Metric | Target | Alert If |
|--------|--------|----------|
| 100K rules memory | ≤ 150MB | > 200MB |
| 1M spans throughput | ≥ 3000/sec | < 2500/sec |
| Rule evaluation latency | < 10ms avg | > 15ms avg |
| Sustained load stability | 1 hour @ 1000/sec | Fails before 1 hour |
| Memory growth (10 iterations) | < 50% | > 100% |

**Tracking:**
```bash
# Extract metrics from test output
grep "memory:" reports/full-tests.json
grep "throughput:" reports/full-tests.json
```

## Support

**Issues:** https://github.com/betracehq/betrace/issues

**Tag with:** `rc-suite`, `test-failure`
