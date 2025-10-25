# Grafana Integration Tests

## Overview

BeTrace includes comprehensive Playwright-based integration tests for Grafana functionality. These tests verify:

- ✅ Dashboard loading and rendering
- ✅ TraceQL queries in Explore
- ✅ Compliance evidence visualization
- ✅ Prometheus metrics exposure
- ✅ Alert configuration
- ✅ Backend API health

## Prerequisites

1. **Services Running** (via Flox):
   ```bash
   flox services start
   ```

   Required services:
   - Grafana (port 12015)
   - BeTrace Backend (port 12011)
   - Tempo (port 3200)
   - Prometheus (port 9090)

2. **Playwright Installed**:
   ```bash
   cd grafana-betrace-app
   npm install
   npx playwright install chromium
   ```

## Running Tests

### One-time Test Run

```bash
cd grafana-betrace-app
npm run test:integration
```

### Interactive UI Mode

```bash
npm run test:integration:ui
```

Shows Playwright UI with:
- Test list and status
- Test execution trace
- Screenshots/videos on failure
- Step-by-step debugging

### Headed Mode (Watch Browser)

```bash
npm run test:integration:headed
```

Runs tests with visible browser window.

### Continuous Testing Service

Start continuous test runner via Flox:

```bash
flox services start grafana-test
```

This runs Playwright tests every 60 seconds and logs results.

**Monitor logs:**
```bash
flox services logs grafana-test
```

**Stop continuous testing:**
```bash
flox services stop grafana-test
```

## Test Coverage

### Grafana Core

- **Health Check**: Verifies Grafana is accessible
- **Dashboard Loading**: Loads BeTrace dashboards (Rule Engine Performance, SOC2 Compliance)
- **Explore**: Executes TraceQL queries for compliance evidence

### Compliance Evidence Queries

Tests TraceQL queries for all compliance frameworks:

```traceql
# SOC2 CC6.1 - Access Control
{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}

# HIPAA 164.312(b) - Audit Controls
{span.compliance.framework = "hipaa" && span.compliance.control = "164.312(b)"}

# GDPR Art. 15 - Right of Access
{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 15"}
```

### Backend Integration

- **Health Endpoint**: `GET http://localhost:12011/health`
- **Metrics Endpoint**: `GET http://localhost:12011/metrics`
  - Verifies Prometheus metrics:
    - `betrace_rule_evaluation_duration_seconds`
    - `betrace_rule_engine_spans_processed_total`
    - `betrace_compliance_spans_emitted_total`

### Alerting

- Checks for SOC2/HIPAA/GDPR alert rules in Grafana
- Verifies Prometheus alerting rules imported

## Test Results

### Artifacts

Playwright generates:
- **HTML Report**: `grafana-betrace-app/playwright-report/index.html`
- **JSON Results**: `grafana-betrace-app/playwright-results.json`
- **Screenshots**: Captured on test failure
- **Videos**: Retained on failure
- **Traces**: Available for debugging in Playwright UI

**View HTML report:**
```bash
npx playwright show-report
```

### CI/CD Integration

For CI pipelines:

```yaml
# Example: GitHub Actions
- name: Start Services
  run: flox services start

- name: Wait for Grafana
  run: |
    timeout 30 bash -c 'until curl -f http://localhost:12015; do sleep 1; done'

- name: Run Integration Tests
  run: |
    cd grafana-betrace-app
    npm run test:integration

- name: Upload Playwright Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: grafana-betrace-app/playwright-report
```

## Troubleshooting

### Tests Fail: "Grafana not accessible"

**Check Grafana is running:**
```bash
curl http://localhost:12015/api/health
```

**Restart Grafana:**
```bash
flox services restart grafana
```

### Tests Fail: "No data" in TraceQL queries

**Verify Tempo is receiving spans:**
```bash
curl http://localhost:3200/api/search
```

**Emit test compliance spans:**
```bash
cd backend
go run ./cmd/test-observability
```

### Tests Fail: "Metrics endpoint not found"

**Check backend is running:**
```bash
curl http://localhost:12011/health
```

**Restart backend:**
```bash
flox services restart backend
```

### Dashboards Not Found

**Import dashboards manually:**
```bash
# Copy dashboards to Grafana provisioning directory
cp .flox/configs/grafana/dashboards/*.json \
   /path/to/grafana/provisioning/dashboards/
```

Or configure via Grafana UI:
1. Go to Dashboards → Import
2. Upload `.flox/configs/grafana/dashboards/rule-engine-performance.json`
3. Select Prometheus data source
4. Import

## Test Configuration

Configuration file: `grafana-betrace-app/playwright.config.ts`

**Key settings:**
- **Workers**: 1 (sequential to avoid Grafana state races)
- **Retries**: 2 on CI, 0 locally
- **Timeout**: 10s per action
- **Viewport**: 1920x1080
- **Browser**: Chromium only (headless)

**Environment variables:**
```bash
# Override Grafana port
export BETRACE_PORT_GRAFANA=3000

# Override backend port
export BETRACE_PORT_BACKEND=8080
```

## Continuous Testing Best Practices

1. **Run continuously during development:**
   ```bash
   flox services start grafana-test
   ```

2. **Monitor test output:**
   ```bash
   flox services logs grafana-test --follow
   ```

3. **Stop when making Grafana changes:**
   ```bash
   flox services stop grafana-test
   # Make changes to dashboards/alerts
   flox services restart grafana
   flox services start grafana-test
   ```

4. **Adjust test interval** (edit `.flox/env/manifest.toml`):
   ```toml
   [services.grafana-test]
   command = """
     # ... tests ...
     sleep 300  # Run every 5 minutes instead of 60s
   """
   ```

## Adding New Tests

**Example: Test new dashboard panel**

```typescript
// grafana-betrace-app/tests/grafana-integration.spec.ts

test('My New Dashboard Panel Loads', async ({ page }) => {
  await page.goto(`${GRAFANA_URL}/d/my-dashboard-uid`);

  // Wait for panel to render
  await page.waitForSelector('[data-testid="panel-title"]');

  // Verify panel exists
  await expect(page.locator('text=My Panel Title')).toBeVisible();

  // Check panel has data
  const hasData = await page.locator('text=No data').isVisible();
  expect(hasData).toBe(false); // Should have data
});
```

## References

- [Playwright Documentation](https://playwright.dev)
- [Grafana Testing Guide](https://grafana.com/docs/grafana/latest/developers/plugins/e2e-test-a-plugin/)
- [TraceQL Documentation](https://grafana.com/docs/tempo/latest/traceql/)
- [AUDITOR_GUIDE.md](./AUDITOR_GUIDE.md) - Compliance evidence queries
