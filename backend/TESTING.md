# BeTrace Backend Testing Guide

## Quick Start

```bash
# Run all tests (WARNING: includes slow stress tests!)
mvn test

# Run tests with beautiful real-time monitoring
./watch-tests.sh

# Check test status (quick snapshot)
./test-status.sh

# Monitor a specific test run log
./watch-tests.sh /tmp/fluo-test-output.log
```

## Test Monitoring Tools

### `watch-tests.sh` - Real-Time Test Monitor (Recommended)

Beautiful TUI with `gum` that updates every 2 seconds. Shows:
- Currently running test suites
- Completed tests with pass/fail status
- Live summary (passing/failing counts)
- Automatic detection of build status

**Usage:**
```bash
# Monitor surefire reports directory (default)
./watch-tests.sh

# Monitor a specific log file
./watch-tests.sh /tmp/my-test-run.log

# Watch tests while running in another terminal
Terminal 1: mvn test 2>&1 | tee /tmp/test-run.log
Terminal 2: ./watch-tests.sh /tmp/test-run.log
```

### `test-status.sh` - Quick Status Check

One-time snapshot of current test status. Useful for CI or quick checks.

```bash
./test-status.sh                    # Check surefire reports
./test-status.sh /tmp/test-run.log  # Check specific log
```

## Test Categories

### Fast Tests (< 10 seconds)
Unit tests, integration tests - safe to run frequently:
```bash
mvn test -Dtest='!*Stress*,!*Bench*,!*Concurrency*'
```

### Concurrency Tests (10-30 seconds)
Thread safety and concurrent access tests:
```bash
mvn test -Dtest='*Concurrency*'
```

### Stress Tests (30+ seconds, resource intensive)
**WARNING: These create heavy load and resource exhaustion**
```bash
mvn test -Dtest='*Stress*'
```

### Performance Benchmarks
```bash
mvn test -Dtest='*Bench*'
```

## Running Tests by Component

### Security Tests Only
```bash
mvn test -Dtest='TenantSecurityProcessorTest,DuckDBServiceTest'
```

### Rate Limiter Tests
```bash
mvn test -Dtest='RateLimiter*'
```

### DSL Parser Tests
```bash
mvn test -Dtest='*Dsl*'
```

## Test Output Locations

- **Surefire Reports**: `target/surefire-reports/`
- **JaCoCo Coverage**: `target/site/jacoco/index.html`
- **Test Logs**: Check `target/surefire-reports/*.txt`

## Known Issues

### Slow Tests

The following tests are intentionally slow and should NOT be in default CI:

1. **TraceStorageStressTest** (3-5 minutes)
   - Tests with 20 tenants × 50 concurrent operations
   - Creates massive resource exhaustion
   - Should be run separately or in nightly builds

2. **RateLimiterConcurrencyTest.testRateLimitAccuracyUnderLoad** (5+ seconds)
   - Tests rate limiter under sustained concurrent load
   - 3 tests currently fail due to test design (expecting depleted initial capacity)

### Test Design Issues

**Rate Limiter Test Failures** (3 tests):
- `testRateLimitAccuracyUnderLoad`
- `testBurstThenSustainedLoad`
- `testRateLimitRecovery`

**Issue**: Tests assume rate limiter starts with depleted capacity, but token bucket correctly starts with FULL capacity (1000 tokens).

**Status**: Test bug, NOT code bug. Tests need refactoring.

## CI Recommendations

```bash
# Fast CI pipeline (< 1 minute)
mvn test -Dtest='!*Stress*,!*Bench*' -DfailIfNoTests=false

# Nightly build (includes stress tests)
mvn test

# Coverage report
mvn jacoco:report
open target/site/jacoco/index.html
```

## Debugging Failed Tests

### View detailed failure output
```bash
cat target/surefire-reports/<TestClass>.txt
```

### Run single test with debug logging
```bash
mvn test -Dtest=MyTest -X
```

### Run test with Quarkus dev mode
```bash
mvn quarkus:test
```

## Test Coverage Requirements

- **Overall Instruction Coverage**: 90% minimum
- **Overall Branch Coverage**: 80% minimum
- **Critical Components** (Security, DuckDB, Rate Limiter): 95% minimum

Check coverage:
```bash
mvn jacoco:report
open target/site/jacoco/index.html
```

## Mutation Testing with PIT

PIT mutation testing validates the quality of your tests by introducing mutations (small changes) to the code and checking if tests catch them. BeTrace uses tiered mutation thresholds based on security criticality.

### Mutation Testing Profiles

**P0: Authentication Services (80% threshold)**
```bash
# Run mutation testing on authentication components
mvn test -Ppit-auth

# Covered: WorkOSAuthService, JwtValidatorService, JwksService, auth processors
# Threshold: 80% mutations must be killed
# Coverage: 95% instruction coverage required
```

**P1: Security Components (75% threshold)**
```bash
# Run mutation testing on security components
mvn test -Ppit-security

# Covered: RateLimiter, DuckDBService, security processors, compliance evidence
# Threshold: 75% mutations must be killed
# Coverage: 90% instruction coverage required
```

**P2: Standard Components (70% threshold)**
```bash
# Run mutation testing on all application code
mvn test -Ppit-all

# Covered: All com.fluo.* packages (excludes models, config, Application)
# Threshold: 70% mutations must be killed
# Coverage: 90% instruction coverage required
```

### Understanding Mutation Scores

- **100% impossible**: Equivalent mutants cannot be killed (e.g., changing `i++` to `++i` in some contexts)
- **80%+ excellent**: Authentication/security code - highest criticality
- **75%+ good**: Security-adjacent code - rate limiting, encryption
- **70%+ acceptable**: Standard business logic

### Viewing Mutation Reports

After running PIT, view the HTML report:
```bash
open target/pit-reports/*/index.html
```

### Common Surviving Mutants (Acceptable)

1. **Logging mutations**: Changing log levels rarely caught by tests
2. **Boundary conditions**: `>=` vs `>` when both are logically equivalent
3. **Return value mutations**: `return true` → `return false` in void methods
4. **Math mutations**: Negation of already-validated calculations

### CI Integration

```bash
# Fast CI (unit tests only)
mvn test -Dtest='!*Stress*,!*Bench*'

# Nightly build (with mutation testing)
mvn test -Ppit-auth -Ppit-security
```

## Dependencies

- **gum**: For beautiful TUI monitoring (optional)
  ```bash
  # Install with Nix
  nix-shell -p gum

  # Or use fallback mode (scripts work without gum)
  ```

## Examples

### Watch tests while developing
```bash
# Terminal 1: Run tests in watch mode
mvn quarkus:test

# Terminal 2: Monitor progress
./watch-tests.sh
```

### Run subset of tests with monitoring
```bash
# Terminal 1
mvn test -Dtest='Security*,DuckDB*' 2>&1 | tee /tmp/security-tests.log

# Terminal 2
./watch-tests.sh /tmp/security-tests.log
```

### Quick health check before committing
```bash
./test-status.sh || echo "Tests failing - check output"
```
