# BeTrace Integration Tests

Cross-platform integration tests that verify all three UIs (Grafana, SigNoz, Kibana) can communicate with the shared backend.

## Test Structure

```
integration-tests/
├── utils/              - Shared test utilities
│   ├── backend.ts     - Backend API client
│   ├── config.ts      - Test configuration
│   └── fixtures.ts    - Test data fixtures
├── tests/             - Integration test suites
│   ├── rule-lifecycle.spec.ts    - Create → Store → Retrieve
│   ├── violation-flow.spec.ts    - Generate → Query
│   └── cross-platform.spec.ts    - All platforms + backend
├── package.json       - Dependencies
└── playwright.config.ts - Playwright configuration
```

## Prerequisites

All services must be running:

```bash
flox services start
flox services status  # Verify all services are "Running"
```

Services required:
- Backend (port 12011)
- SigNoz UI (port 3001)
- Grafana (port 12015)
- Tempo (port 3200)

## Running Tests

```bash
cd integration-tests

# Install dependencies
npm install

# Run all integration tests
npm test

# Run specific test suite
npx playwright test rule-lifecycle
npx playwright test violation-flow
npx playwright test cross-platform

# Run with UI mode (debugging)
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed
```

## Test Coverage

### 1. Rule Lifecycle Tests
- Create rule via SigNoz UI → Verify stored in backend
- Create rule via Grafana → Verify visible in SigNoz
- Update rule → Verify changes propagate
- Delete rule → Verify removed from all platforms

### 2. Violation Flow Tests
- Trigger rule violation → Verify violation span created
- Query violations via backend API → Verify returned
- View violations in Grafana → Verify displayed
- Export violations → Verify format

### 3. Cross-Platform Tests
- Create rule in Platform A → Verify visible in Platform B
- Concurrent rule creation → Verify no conflicts
- Backend restart → Verify all platforms reconnect
- Rule persistence → Verify survives backend restart

## Configuration

Edit `utils/config.ts` to change service URLs:

```typescript
export const config = {
  backend: 'http://localhost:12011',
  signoz: 'http://localhost:3001',
  grafana: 'http://localhost:12015',
  tempo: 'http://localhost:3200',
};
```

## Debugging Failed Tests

```bash
# Generate trace for failed test
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip

# Run single test with debug mode
PWDEBUG=1 npx playwright test rule-lifecycle

# Take screenshots on failure (automatic)
# Screenshots saved to: test-results/
```

## CI/CD Integration

Tests run in GitHub Actions on every PR:

```yaml
- name: Run Integration Tests
  run: |
    flox services start
    cd integration-tests && npm install && npm test
```

## Test Data Cleanup

Integration tests clean up after themselves:

- Rules created during tests are deleted in `afterEach()` hooks
- Violations are scoped to test trace IDs
- Temp data stored in `/tmp/betrace-integration-tests/`

## Known Limitations

- **Grafana startup time**: Grafana may take 5-15 minutes on first run (Nix packages downloading)
- **Race conditions**: Small delays added between create/query to allow backend persistence
- **Kibana tests**: Pending implementation (Priority 1, not yet started)
