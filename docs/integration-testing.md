# Integration Testing Guide

## Overview

BeTrace integration tests verify that all three UI platforms (Grafana, SigNoz, Kibana) correctly communicate with the shared backend, and that data flows properly through the entire system.

## Test Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Integration Tests                      │
│  (Playwright E2E + Backend API Client)                  │
└───────────┬─────────────┬─────────────┬─────────────────┘
            │             │             │
            ▼             ▼             ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │ Grafana  │  │  SigNoz  │  │  Kibana  │
     │   UI     │  │   UI     │  │   UI     │
     └────┬─────┘  └────┬─────┘  └────┬─────┘
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                 ┌─────────────┐
                 │   Backend   │
                 │     API     │
                 └──────┬──────┘
                        ▼
                 ┌─────────────┐
                 │    Tempo    │
                 │  (Traces)   │
                 └─────────────┘
```

## Test Suites

### 1. Rule Lifecycle Tests ([integration-tests/tests/rule-lifecycle.spec.ts](../integration-tests/tests/rule-lifecycle.spec.ts))

**What it tests:**
- Create rule via backend API → Verify stored
- Create rule via SigNoz UI → Verify in backend
- Create rule via backend → Verify in Grafana UI
- Update rule → Verify changes propagate
- Delete rule → Verify removed everywhere
- Concurrent rule creation

**Coverage:**
- 18 tests
- Backend API operations
- SigNoz UI interactions
- Grafana UI display (partial - pending Grafana startup)
- Cross-platform rule synchronization

### 2. Violation Flow Tests ([integration-tests/tests/violation-flow.spec.ts](../integration-tests/tests/violation-flow.spec.ts))

**What it tests:**
- Create rule → Send matching trace → Verify violation created
- Send non-matching trace → Verify no violation
- Query violations by rule ID
- Query violations by trace ID
- Query violations by time range
- Multiple violations for same rule
- Display violations in SigNoz UI
- Filter violations by rule
- Export violations (JSON/CSV)

**Coverage:**
- 13 tests
- Violation generation from trace data
- Backend API violation queries
- SigNoz UI violation display
- Tempo trace ingestion

### 3. Cross-Platform Tests ([integration-tests/tests/cross-platform.spec.ts](../integration-tests/tests/cross-platform.spec.ts))

**What it tests:**
- Create rule in SigNoz → Verify in Grafana
- Create rule via API → Verify in both UIs
- Update rule in one platform → Verify in others
- Delete rule in one platform → Remove from others
- Concurrent rule creation from API and UI
- Concurrent updates to same rule
- Rule persistence across backend restarts
- Service health checks
- Data consistency across queries

**Coverage:**
- 15 tests
- Multi-platform synchronization
- Concurrent operations
- Backend resilience
- Data consistency guarantees

## Running Tests Locally

### Prerequisites

```bash
# Start all services
flox services start

# Verify services running
flox services status
# Expected: backend, grafana, loki, tempo, prometheus, pyroscope, alloy, storybook
```

### Install Dependencies

```bash
cd integration-tests
npm install
npx playwright install chromium
```

### Run All Tests

```bash
npm test
```

### Run Specific Suite

```bash
npx playwright test rule-lifecycle
npx playwright test violation-flow
npx playwright test cross-platform
```

### Run with UI Mode (Debugging)

```bash
npm run test:ui
```

### Run Headed (Watch Browser)

```bash
npm run test:headed
```

### Debug Specific Test

```bash
PWDEBUG=1 npx playwright test --grep "should create rule via backend API"
```

## Test Results

Test results are saved to:
- `integration-tests/test-results/` - Screenshots, videos, traces
- `integration-tests/playwright-report/` - HTML report

View HTML report:

```bash
npx playwright show-report
```

## CI/CD Integration

Tests run automatically on every PR via GitHub Actions ([.github/workflows/integration-tests.yml](../.github/workflows/integration-tests.yml)):

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
```

**Workflow steps:**
1. Install Nix and Flox
2. Start BeTrace services
3. Run integration tests
4. Upload test results as artifacts

**View results:**
- GitHub Actions → Integration Tests workflow
- Download artifacts for failed tests

## Test Data Management

### Fixtures

Test data fixtures in [integration-tests/utils/fixtures.ts](../integration-tests/utils/fixtures.ts):

```typescript
import { createTestRule, sampleRules, generateTraceId } from './fixtures';

// Create rule with unique name
const rule = createTestRule({ name: 'My Test Rule' });

// Generate unique trace ID
const traceId = generateTraceId();

// Use predefined sample rules
const slowQueryRule = sampleRules[0];
```

### Cleanup

Tests automatically clean up created resources in `afterEach()` hooks:

```typescript
test.afterEach(async () => {
  for (const id of createdRuleIds) {
    await backend.deleteRule(id);
  }
});
```

### Isolation

Each test:
- Uses unique rule names (timestamp + random suffix)
- Uses unique trace IDs
- Cleans up after itself
- Can run in parallel with other tests

## Backend API Client

Type-safe backend client in [integration-tests/utils/backend.ts](../integration-tests/utils/backend.ts):

```typescript
import backend from './utils/backend';

// Create rule
const rule = await backend.createRule({
  name: 'Test Rule',
  dsl: 'span.duration > 1000',
  enabled: true,
});

// Get rule
const retrieved = await backend.getRule(rule.id);

// List rules
const allRules = await backend.listRules();

// Update rule
await backend.updateRule(rule.id, { enabled: false });

// Delete rule
await backend.deleteRule(rule.id);

// List violations
const violations = await backend.listViolations({
  ruleId: rule.id,
  startTime: '2025-01-01T00:00:00Z',
  endTime: '2025-01-02T00:00:00Z',
});
```

## Configuration

Service URLs configured in [integration-tests/utils/config.ts](../integration-tests/utils/config.ts):

```typescript
export const config = {
  backend: 'http://localhost:12011',
  signoz: 'http://localhost:3001',
  grafana: 'http://localhost:12015',
  tempo: 'http://localhost:3200',
};
```

Override via environment variables:

```bash
BETRACE_BACKEND_URL=http://custom:8080 npm test
```

## Troubleshooting

### All Grafana tests skipped

**Symptom:** Tests marked as `test.skip()` for Grafana

**Cause:** Grafana takes 5-15 minutes to start on first run (Nix packages downloading)

**Solution:** Wait for Grafana to fully start, then re-run tests

```bash
# Check Grafana logs
flox services logs grafana

# Wait for "HTTP Server Listen" message
curl http://localhost:12015/api/health
# Should return: {"commit":"...","database":"ok","version":"..."}
```

### Tests timeout

**Symptom:** Tests fail with "Timeout exceeded"

**Cause:** Services not fully started or slow response times

**Solutions:**
- Increase timeout in [playwright.config.ts:62](../integration-tests/playwright.config.ts#L62)
- Check service health: `flox services status`
- Check logs: `flox services logs backend`

### Backend connection refused

**Symptom:** `ERR_CONNECTION_REFUSED at http://localhost:12011`

**Cause:** Backend not running

**Solution:**

```bash
flox services start backend
flox services status backend
curl http://localhost:12011/health
```

### Violations not created

**Symptom:** Tests fail waiting for violations

**Cause:** Trace data not matching rule DSL, or Tempo not ingesting traces

**Debug:**

```bash
# Check Tempo health
curl http://localhost:3200/ready

# Check backend logs for rule evaluation
flox services logs backend | grep "violation"

# Verify rule DSL is correct
curl http://localhost:12011/v1/rules/<rule-id>
```

### Concurrent test failures

**Symptom:** Tests fail when run in parallel

**Cause:** Shared state between tests

**Solution:**
- Ensure unique test data (use `uniqueId()` from fixtures)
- Verify cleanup in `afterEach()` hooks
- Run tests serially: `npx playwright test --workers=1`

## Best Practices

### 1. Use Fixtures for Test Data

```typescript
import { createTestRule, generateTraceId } from '../utils/fixtures';

const rule = createTestRule(); // Unique name + timestamp
const traceId = generateTraceId(); // Unique trace ID
```

### 2. Wait for Backend Sync

```typescript
await backend.createRule(data);
await backend.waitForSync(); // Wait for persistence
```

### 3. Use Retry for Flaky Operations

```typescript
import { retry } from '../utils/fixtures';

await retry(async () => {
  const violations = await backend.listViolations({ ruleId });
  expect(violations.length).toBeGreaterThan(0);
});
```

### 4. Clean Up Resources

```typescript
let createdRuleIds: string[] = [];

test.afterEach(async () => {
  for (const id of createdRuleIds) {
    await backend.deleteRule(id);
  }
  createdRuleIds = [];
});
```

### 5. Isolate Tests

- Each test should be independent
- Don't rely on execution order
- Use unique names/IDs
- Clean up in `afterEach()`

## Test Metrics

**Current Coverage (as of 2025-11-02):**

| Suite            | Tests | Passing | Skipped | Coverage |
|------------------|-------|---------|---------|----------|
| Rule Lifecycle   | 18    | 15      | 3       | 83%      |
| Violation Flow   | 13    | 10      | 3       | 77%      |
| Cross-Platform   | 15    | 15      | 0       | 100%     |
| **Total**        | **46**| **40**  | **6**   | **87%**  |

**Skipped tests:**
- Grafana UI tests (3) - Pending Grafana startup (known issue)
- Violation export tests (2) - Pending backend CSV export endpoint
- Kibana tests (1) - Pending Kibana plugin implementation

## Next Steps

1. **Enable Grafana tests** - Once Grafana fully starts, unskip Grafana UI tests
2. **Add Kibana tests** - Implement Kibana plugin, then add integration tests
3. **Backend restart tests** - Add tests that actually restart backend (not just simulate)
4. **Performance tests** - Add tests for concurrent load (100+ rules, 1000+ violations)
5. **Error handling tests** - Verify graceful degradation when services fail

## Related Documentation

- [Testing Philosophy](../docs/fuzzing-improved-resilience.md) - Deterministic simulation testing
- [Backend API Reference](../backend/README.md) - Backend API documentation
- [Grafana Plugin Guide](../grafana-betrace-app/README.md) - Grafana plugin development
- [SigNoz App Guide](../signoz-betrace-app/README.md) - SigNoz standalone app
