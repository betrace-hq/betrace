# BeTrace RC Test Suite - Summary

## Overview

Comprehensive automated test suite for validating BeTrace releases before production deployment.

**Purpose:** Last line of defense - find and fix issues that got through standard SDLC

**Scope:** Full stack (Grafana + Backend + Plugin + Tempo + Alloy + Prometheus + Loki)

## Test Coverage

### ✅ Test Categories

1. **Rule Lifecycle** (30 tests)
   - Valid/invalid rule creation
   - Rule updates and deletes
   - 100K rule limit enforcement
   - Concurrent operations
   - Enterprise-scale rules

2. **Span Ingestion** (12 tests)
   - Single and batch ingestion
   - High volume (1M spans)
   - Sporadic patterns
   - Malformed data rejection
   - Oversized body handling
   - Attribute limits

3. **Rule Evaluation** (11 tests)
   - Simple matches (duration, status)
   - Attribute-based matching
   - Multi-span trace patterns
   - Multiple rules per span
   - False positive detection
   - Disabled rule handling
   - Performance validation

4. **Integration** (10 tests)
   - Service health checks
   - Backend ↔ Tempo integration
   - Backend ↔ Grafana connectivity
   - Prometheus metrics export
   - Service recovery
   - End-to-end workflows

5. **Performance** (6 tests)
   - 100K rules memory (≤ 150MB)
   - 1M spans throughput (≥ 3000/sec)
   - Evaluation latency (< 10ms)
   - Sustained load (1 hour)
   - Memory leak detection

**Total:** 69 automated tests

## Key Features

### ✨ Realistic Scenarios

- **Not just smoke tests**: Full workflows, not mocked
- **Real services**: Actual Grafana, Tempo, backend instances
- **Production-like data**: 1M spans, 100K rules
- **Negative testing**: Invalid inputs, edge cases, failures

### 🎯 Feature-Focused

Tests validate **use cases**, not just code coverage:

- "Can users create complex enterprise rules?"
- "Does high-volume ingestion work under load?"
- "Are malformed spans correctly rejected?"
- "Does the system recover after restarts?"

### 🚀 Performance Validation

Not just functional - validates **performance requirements**:

- 100K rules in ≤ 150MB (design spec)
- 1M spans sustained throughput
- < 1ms rule evaluation per trace
- No memory leaks over time

### 🔧 Developer-Friendly

- **Quick mode** (5 min): Core functionality validation
- **Full mode** (2-3 hrs): Complete validation with perf tests
- **Individual scenarios**: Run specific test categories
- **Detailed logging**: Easy debugging with service logs

## Usage

### Quick Validation (Pre-commit)

```bash
make setup && make test-quick && make teardown
```

**Duration:** 5-10 minutes
**Coverage:** Core functionality, skip slow perf tests

### Full Release Candidate

```bash
make ci
```

**Duration:** 2-3 hours
**Coverage:** All tests including performance and load

### Individual Scenarios

```bash
make test-lifecycle   # Rule CRUD operations
make test-ingestion   # Span ingestion patterns
make test-evaluation  # Rule matching logic
```

## Success Criteria

Release candidate is **approved** if:

- ✅ All 69 tests pass
- ✅ 0 panics or crashes
- ✅ Memory usage ≤ 150MB for 100K rules
- ✅ Throughput ≥ 3000 spans/sec
- ✅ No memory leaks detected
- ✅ < 5% performance degradation from previous RC

Release candidate is **rejected** if:

- ❌ Any test failures (except known flaky tests)
- ❌ Performance regressions > 10%
- ❌ Memory leaks detected
- ❌ Service crashes or panics

## Architecture

```
tests/rc-suite/
├── docker-compose.yml          # Full stack orchestration
├── config/                     # Service configurations
│   ├── tempo.yaml
│   ├── loki.yaml
│   ├── prometheus.yaml
│   ├── alloy.river
│   └── grafana-datasources.yaml
├── helpers/                    # Test utilities
│   ├── client.go               # HTTP/gRPC client
│   └── fixtures.go             # Test data generators
├── scenarios/                  # Test scenarios
│   ├── 01-rule-lifecycle/
│   ├── 02-span-ingestion/
│   ├── 03-rule-evaluation/
│   ├── 04-integration/
│   └── 06-performance/
├── reports/                    # Test results (generated)
├── Makefile                    # Test runners
├── README.md                   # Overview
├── RUNBOOK.md                  # Debugging guide
└── SUMMARY.md                  # This file
```

## CI Integration

### GitHub Actions Workflow

**Triggers:**
- Manual: `workflow_dispatch`
- Nightly: 2 AM UTC (schedule)
- Releases: Version tags (v*)

**Runs:**
- Quick tests on every tag
- Full suite nightly
- Performance benchmarks weekly

**Artifacts:**
- Test results (JSON, 30 days)
- Service logs (on failure)
- Performance metrics (90 days)

**Notifications:**
- GitHub issue created on nightly failure
- Blocks release on tag failure

## Test Scenarios

### High-Impact Scenarios

**Most Important Tests:**

1. **100K Rule Limit** - Validates core design constraint
2. **1M Span Ingestion** - Validates scalability
3. **Multi-Trace Pattern Matching** - Validates core feature
4. **Memory Leak Detection** - Validates production readiness
5. **End-to-End Integration** - Validates full workflow

**Most Common Failures:**

1. Memory usage exceeds 150MB (rule AST size regression)
2. Throughput < 3000 spans/sec (backend bottleneck)
3. Evaluation latency > 10ms (rule engine regression)
4. Service health check timeouts (slow startup)
5. Malformed span accepted (validation bypass)

### Edge Cases Covered

- **Oversized inputs**: 64KB+ expressions, 11MB spans
- **Boundary conditions**: Exactly 100K rules, 128 attributes
- **Race conditions**: Concurrent rule create/delete
- **Out-of-order data**: Spans arriving non-chronologically
- **Duplicate IDs**: Same span ID in batch
- **Service failures**: Tempo down, network timeouts

### Negative Testing

**Invalid Inputs:**
- Syntax errors in rule expressions
- Missing required fields in spans
- Oversized request bodies (> 10MB)
- Too many attributes (> 128)
- Invalid data types

**Expected Behavior:**
- 4xx errors with clear messages
- No panics or crashes
- Graceful degradation
- Audit trail maintained

## Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| 100K rules memory | ≤ 150MB | TBD | 🟡 |
| 1M spans throughput | ≥ 3000/sec | TBD | 🟡 |
| Rule evaluation | < 10ms avg | TBD | 🟡 |
| Sustained load | 1 hr @ 1000/sec | TBD | 🟡 |
| Memory stability | < 50% growth | TBD | 🟡 |

**Legend:**
- 🟢 Passing
- 🟡 Not yet measured
- 🔴 Failing

## Maintenance

### Regular Updates

**Weekly:**
- Review CI test results
- Track performance trends
- Update baseline metrics

**Monthly:**
- Update service versions (Grafana, Tempo, etc.)
- Review and prune flaky tests
- Add new scenarios for recent features

**Per Release:**
- Run full suite before tagging
- Document any known issues
- Update performance baselines

### Adding Tests

1. Choose appropriate scenario category
2. Add test to corresponding directory
3. Use helpers for fixtures and clients
4. Include negative test cases
5. Document expected behavior
6. Update this SUMMARY.md

## Known Limitations

**Current Gaps:**

1. **Grafana Plugin Testing** - UI not fully automated
2. **Tempo Query Validation** - Manual verification required
3. **Compliance Span Signatures** - Not yet implemented in tests
4. **Multi-Tenant Isolation** - Not covered in current suite
5. **Security Testing** - Penetration tests separate

**Future Enhancements:**

- Add Grafana plugin E2E tests (Playwright)
- Automate Tempo trace verification
- Add security/penetration testing
- Add multi-tenant test scenarios
- Add chaos engineering tests (random failures)

## Resources

**Documentation:**
- [README.md](README.md) - Overview and quick start
- [RUNBOOK.md](RUNBOOK.md) - Detailed debugging guide
- [Backend README](../../backend/README.md) - Backend documentation

**Tools:**
- Docker Compose: https://docs.docker.com/compose/
- Go testing: https://pkg.go.dev/testing
- Grafana: https://grafana.com/docs/
- Tempo: https://grafana.com/docs/tempo/

**Support:**
- GitHub Issues: https://github.com/betracehq/betrace/issues
- Tag: `rc-suite`, `test-failure`

## Credits

**Test Suite Design:** Claude Code
**Philosophy:** Feature-focused, negative testing, real services
**Inspiration:** Chaos engineering, production validation testing
