# CI Hardening Summary

**Status:** ✅ Complete

## Overview

BeTrace CI has been hardened with comprehensive coverage gates, timeouts, artifact collection, and failure reporting to ensure test reliability and prevent regressions.

## Key Features

### 1. **Coverage Gates** ✅

Automated quality gates that fail builds if coverage thresholds are not met:

```bash
# Check coverage gates locally
nix run .#check-coverage-gates

# Override thresholds
USE_CASE_MIN=80 FEATURE_MIN=80 nix run .#check-coverage-gates
```

**Default Thresholds:**
- Use Cases: 70% minimum
- Features: 70% minimum
- API Routes: 80% minimum
- LoC: 60% minimum (warning only)

**Location:** `.github/workflows/test-with-coverage.yml`

### 2. **Test Timeouts** ✅

All test jobs have strict timeouts to prevent hanging:

- **Job timeout**: 15-20 minutes (entire test suite)
- **Step timeouts**: 2-10 minutes (individual steps)
- **Service startup**: 5 minutes max
- **Service verification**: 2 minutes max

Example:
```yaml
jobs:
  backend-api-tests:
    timeout-minutes: 15
    steps:
      - name: Run tests
        timeout-minutes: 10
```

### 3. **Artifact Collection** ✅

All test runs collect artifacts for debugging:

**Always Collected:**
- Coverage reports (JSON/HTML/Markdown) - 30 day retention
- Test results (Playwright reports) - 7 day retention

**On Failure:**
- Service logs (backend, Grafana, Loki, Tempo) - 7 day retention
- Test videos and screenshots - 7 day retention
- Grafana container logs - 7 day retention

**Download artifacts:**
```bash
gh run download <run-id> --name coverage-backend-api
gh run download <run-id> --name service-logs
```

### 4. **Coverage Reporting** ✅

Automatic coverage reports posted to PRs and GitHub Summary:

**PR Comments:**
```markdown
## 📊 Coverage Report

| Metric | Coverage |
|--------|----------|
| Use Cases | 100% |
| Features | 100% |
| API Routes | 100% |
| Lines of Code | 45.2% |
```

**GitHub Job Summary:**
- Visible in Actions run summary
- Shows all coverage dimensions
- Links to detailed reports

### 5. **Failure Handling** ✅

Robust failure handling with detailed diagnostics:

- Tests run with `continue-on-error` to collect artifacts
- Service logs collected automatically on failure
- Coverage gates run even if tests fail
- Final step re-raises failure after artifact collection

### 6. **Service Health Checks** ✅

Services verified before tests run:

```yaml
- name: Verify services
  timeout-minutes: 2
  run: |
    curl -f http://localhost:12011/health || exit 1
    curl -f http://localhost:12015/api/health || exit 1
```

### 7. **Parallel Test Execution** ✅

Independent test suites run in parallel:

- Backend API tests (15 min timeout)
- Grafana plugin tests (20 min timeout)
- Coverage aggregation job (waits for both)

Total CI time: ~20 minutes (parallel execution)

## CI Workflows

### Main Workflow: `test-with-coverage.yml`

Comprehensive testing with coverage tracking:

```bash
# Triggers:
# - Pull requests to main
# - Pushes to main
# - Manual dispatch

# Jobs:
# 1. backend-api-tests     - API-only tests with coverage
# 2. grafana-plugin-tests  - E2E tests with full stack
# 3. coverage-report       - Aggregate and report coverage
# 4. test-summary          - Final pass/fail decision
```

### Existing Workflows

**Preserved for compatibility:**
- `e2e-tests.yml` - Grafana plugin tests (matrix: Grafana 9.5, 10.4, 11.0)
- `integration-tests.yml` - Full integration test suite
- `rc-test-suite.yml` - Release candidate testing

## Coverage Gate Script

**Location:** `scripts/check-coverage-gates.sh`

**Features:**
- Color-coded output (✅ pass, ❌ fail, ⚠️ warning)
- Configurable thresholds via environment variables
- Detailed coverage breakdown
- Actionable failure messages

**Usage:**
```bash
# Check with defaults
nix run .#check-coverage-gates

# Custom thresholds
USE_CASE_MIN=80 \
FEATURE_MIN=80 \
API_ROUTE_MIN=90 \
LOC_MIN=70 \
nix run .#check-coverage-gates

# Check specific coverage file
nix run .#check-coverage-gates path/to/coverage.json
```

**Exit Codes:**
- `0` - All thresholds met
- `1` - One or more thresholds not met

## Local Testing

Test CI configuration locally before pushing:

```bash
# Run tests with coverage
nix run .#test-backend-api

# Check coverage gates
nix run .#check-coverage-gates

# Expected output:
📊 Checking Coverage Gates
================================

Coverage Thresholds:
  Use Cases:  70% minimum
  Features:   70% minimum
  API Routes: 80% minimum
  LoC:        60% minimum

Current Coverage:
  ✅ Use Cases:  100% (meets 70%)
  ✅ Features:   100% (meets 70%)
  ✅ API Routes: 100% (meets 80%)
  ⚠️  LoC:        0% (below 60%)

✅ All coverage thresholds met!
```

## Configuration

### Adjusting Coverage Thresholds

**Method 1: Environment Variables (per-run)**
```yaml
- name: Check coverage gates
  env:
    USE_CASE_MIN: 80
    FEATURE_MIN: 80
    API_ROUTE_MIN: 90
  run: nix run .#check-coverage-gates
```

**Method 2: Script Defaults (permanent)**
Edit `scripts/check-coverage-gates.sh`:
```bash
USE_CASE_MIN=${USE_CASE_MIN:-80}   # Raise from 70 to 80
FEATURE_MIN=${FEATURE_MIN:-80}     # Raise from 70 to 80
API_ROUTE_MIN=${API_ROUTE_MIN:-90} # Raise from 80 to 90
```

### Adjusting Timeouts

Edit `.github/workflows/test-with-coverage.yml`:
```yaml
jobs:
  backend-api-tests:
    timeout-minutes: 20  # Increase if needed

    steps:
      - name: Run tests
        timeout-minutes: 15  # Increase if needed
```

### Adding New Test Suites

1. Add test runner to `nix/shell-test-runner.nix` or `nix/process-compose-test.nix`
2. Add app to `flake.nix`:
```nix
test-my-feature = {
  type = "app";
  program = "${testRunners.my-feature}/bin/test-my-feature";
};
```
3. Add job to `.github/workflows/test-with-coverage.yml`
4. Update `coverage-report` job to include new artifacts

## Benefits

### 1. **Prevents Regressions**
- Coverage gates ensure new code is tested
- Thresholds prevent coverage from decreasing
- Automated checks on every PR

### 2. **Fast Feedback**
- Parallel test execution (~20 min total)
- Early failure on missing coverage
- PR comments with immediate visibility

### 3. **Easy Debugging**
- All artifacts collected automatically
- Service logs on failure
- Videos and screenshots for visual debugging
- 30-day retention for coverage history

### 4. **Reproducible Locally**
- Same commands work in CI and locally
- Nix ensures identical environments
- Flox manages services consistently

### 5. **No Hanging Tests**
- Strict timeouts at job and step level
- Automatic cleanup on timeout
- GitHub Actions automatically kills hung jobs

### 6. **Comprehensive Reporting**
- PR comments with coverage summary
- GitHub job summary with detailed metrics
- Artifact downloads for detailed analysis
- Historical tracking via artifact retention

## Troubleshooting

### Coverage Gates Failing

```bash
❌ Coverage thresholds not met
```

**Solution:**
1. Review coverage report: `grafana-betrace-app/coverage-reports/coverage-latest.html`
2. Add missing test annotations (trackUseCase, trackFeature)
3. Write tests for uncovered API endpoints
4. See `grafana-betrace-app/tests/COVERAGE.md` for guidance

### Tests Timing Out

```bash
Error: The operation was canceled.
```

**Solution:**
1. Check service logs in artifacts
2. Verify service startup in local environment:
```bash
flox services start
flox services status
```
3. Increase timeout if legitimate (see Configuration above)

### Missing Coverage Reports

```bash
⚠️ No coverage file found
```

**Solution:**
1. Ensure tests import from coverage fixtures:
```typescript
import { test, expect } from './lib/coverage-fixtures';
```
2. Verify globalTeardown is configured in `playwright.config.ts`
3. Check test run completed (not killed early)

### Service Health Check Failures

```bash
curl: (7) Failed to connect to localhost:12011
```

**Solution:**
1. Increase service startup wait time
2. Check Flox service configuration: `.flox/env/manifest.toml`
3. Review service logs in artifacts
4. Test locally: `flox activate -- flox services start`

## Next Steps

### Recommended Improvements

1. **Add More Test Coverage**
   - Apply coverage fixtures to existing tests
   - Add E2E tests for Monaco editor
   - Test Grafana plugin pages (increase LoC coverage)

2. **Increase Thresholds Gradually**
   - Start at 70%/70%/80%
   - Increase by 5-10% every sprint
   - Target: 90%/90%/95% within 3 months

3. **Add Performance Gates**
   - Track test execution time
   - Fail if tests take >N seconds
   - Identify slow tests automatically

4. **Add Security Gates**
   - npm audit threshold
   - Go security scanner
   - OWASP dependency check

5. **Matrix Testing**
   - Test across multiple Node versions
   - Test across multiple Go versions
   - Test against Grafana versions 9.5, 10.4, 11.0

## Files Modified

```
.github/workflows/
  └── test-with-coverage.yml    ← New comprehensive CI workflow

scripts/
  └── check-coverage-gates.sh   ← Coverage gate checker

flake.nix                        ← Added check-coverage-gates app

docs/
  └── CI-HARDENING.md           ← This document
```

## References

- [Coverage Strategy](./COVERAGE-STRATEGY.md) - Coverage system architecture
- [Coverage User Guide](../grafana-betrace-app/tests/COVERAGE.md) - How to use coverage fixtures
- [GitHub Actions Docs](https://docs.github.com/en/actions) - Workflow syntax
- [Playwright Test](https://playwright.dev/docs/test-intro) - Test framework

---

**Status:** Production Ready
**Last Updated:** 2025-11-12
**Maintainer:** BeTrace Team
