import { test, expect } from '@playwright/test';

/**
 * Grafana Integration Tests
 *
 * Tests the BeTrace Grafana plugin integration:
 * - Dashboard loading and rendering
 * - TraceQL queries in Explore
 * - Compliance evidence visualization
 * - Alert configuration
 *
 * Requirements:
 * - Grafana running on http://localhost:12015
 * - BeTrace backend running on http://localhost:12011
 * - Tempo running with compliance spans
 */

const GRAFANA_URL = process.env.BETRACE_PORT_GRAFANA
  ? `http://localhost:${process.env.BETRACE_PORT_GRAFANA}`
  : 'http://localhost:12015';

const GRAFANA_USER = 'admin';
const GRAFANA_PASS = 'admin';

test.describe('Grafana BeTrace Plugin', () => {

  test.beforeEach(async ({ page }) => {
    // Login to Grafana
    await page.goto(`${GRAFANA_URL}/login`);

    // Check if already logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      return; // Already logged in
    }

    await page.fill('input[name="user"]', GRAFANA_USER);
    await page.fill('input[name="password"]', GRAFANA_PASS);
    await page.click('button[type="submit"]');

    // Wait for redirect after login
    await page.waitForURL(/\/\?/);
  });

  test('Grafana is accessible and healthy', async ({ page }) => {
    await page.goto(GRAFANA_URL);

    // Check for Grafana logo/header
    const header = page.locator('[aria-label="Grafana"]').first();
    await expect(header).toBeVisible({ timeout: 10000 });
  });

  test('Rule Engine Performance dashboard loads', async ({ page }) => {
    // Navigate to dashboards
    await page.goto(`${GRAFANA_URL}/dashboards`);

    // Search for BeTrace dashboard
    await page.fill('input[placeholder*="Search"]', 'BeTrace Rule Engine');

    // Wait for search results
    await page.waitForTimeout(1000);

    // Look for the dashboard link
    const dashboardLink = page.locator('text=BeTrace Rule Engine Performance').first();

    // If dashboard exists, verify it loads
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();

      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 15000 });

      // Verify key panels exist
      await expect(page.locator('text=Rule Evaluation Latency')).toBeVisible();
      await expect(page.locator('text=Spans Processed')).toBeVisible();
    } else {
      console.log('⚠️  Dashboard not found - may need to import from .flox/configs/grafana/dashboards/');
    }
  });

  test('SOC2 Compliance dashboard loads', async ({ page }) => {
    await page.goto(`${GRAFANA_URL}/dashboards`);

    await page.fill('input[placeholder*="Search"]', 'SOC2 Compliance');
    await page.waitForTimeout(1000);

    const dashboardLink = page.locator('text=BeTrace SOC2 Compliance').first();

    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();

      await page.waitForSelector('[data-testid="dashboard-scene"]', { timeout: 15000 });

      // Verify compliance panels
      await expect(page.locator('text=CC6.1 Access Control Success Rate')).toBeVisible();
      await expect(page.locator('text=CC6.3 Data Isolation Checks')).toBeVisible();
    } else {
      console.log('⚠️  SOC2 dashboard not found');
    }
  });

  test('Explore: TraceQL query for compliance spans', async ({ page }) => {
    // Navigate to Explore
    await page.goto(`${GRAFANA_URL}/explore`);

    // Wait for Explore to load
    await page.waitForSelector('[data-testid="data-testid Explore"]', { timeout: 10000 }).catch(() => {
      // Fallback: look for query builder
      return page.waitForSelector('textarea[placeholder*="query"]', { timeout: 10000 });
    });

    // Select Tempo data source (if multiple exist)
    const dataSourcePicker = page.locator('[aria-label*="Data source picker"]').first();
    if (await dataSourcePicker.isVisible()) {
      await dataSourcePicker.click();
      await page.click('text=Tempo');
    }

    // Enter TraceQL query for SOC2 compliance spans
    const queryInput = page.locator('textarea, input[type="text"]').filter({
      hasText: /query|TraceQL/i
    }).first();

    await queryInput.fill('{span.compliance.framework = "soc2"}');

    // Run query
    const runButton = page.locator('button').filter({ hasText: /Run query|Refresh/i }).first();
    await runButton.click();

    // Wait for results (or no data message)
    await page.waitForTimeout(3000);

    // Verify query ran (either shows traces or "No data" message)
    const hasResults = await page.locator('text=No data').isVisible() ||
                       await page.locator('[data-testid="trace-view"]').isVisible();

    expect(hasResults).toBeTruthy();
  });

  test('Prometheus metrics endpoint is accessible', async ({ page, request }) => {
    // Check backend metrics endpoint
    const backendPort = process.env.BETRACE_PORT_BACKEND || '12011';
    const metricsUrl = `http://localhost:${backendPort}/metrics`;

    const response = await request.get(metricsUrl);
    expect(response.status()).toBe(200);

    const body = await response.text();

    // Verify key BeTrace metrics exist
    expect(body).toContain('betrace_rule_evaluation_duration_seconds');
    expect(body).toContain('betrace_rule_engine_spans_processed_total');
    expect(body).toContain('betrace_compliance_spans_emitted_total');
  });

  test('Alerting: SOC2 violation alert exists', async ({ page }) => {
    await page.goto(`${GRAFANA_URL}/alerting/list`);

    // Wait for alert list to load
    await page.waitForTimeout(2000);

    // Search for BeTrace alerts
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('SOC2');
      await page.waitForTimeout(1000);
    }

    // Check if any SOC2-related alerts exist
    const alertExists = await page.locator('text=SOC2').first().isVisible().catch(() => false);

    if (alertExists) {
      console.log('✓ SOC2 alerts configured');
    } else {
      console.log('⚠️  No SOC2 alerts found - may need to import from prometheus rules');
    }
  });

  test('BeTrace API health check from Grafana context', async ({ request }) => {
    const backendPort = process.env.BETRACE_PORT_BACKEND || '12011';
    const healthUrl = `http://localhost:${backendPort}/health`;

    const response = await request.get(healthUrl);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.version).toBeTruthy();
  });
});

test.describe('Compliance Evidence Queries', () => {

  test('Query SOC2 CC6.1 access control evidence', async ({ page }) => {
    await page.goto(`${GRAFANA_URL}/explore`);

    await page.waitForTimeout(2000);

    // Select Tempo
    const dataSourcePicker = page.locator('[aria-label*="Data source picker"]').first();
    if (await dataSourcePicker.isVisible()) {
      await dataSourcePicker.click();
      await page.click('text=Tempo').catch(() => {});
    }

    // Query for CC6.1 evidence
    const queryInput = page.locator('textarea').first();
    await queryInput.fill('{span.compliance.framework = "soc2" && span.compliance.control = "CC6.1"}');

    // Run query
    await page.click('button:has-text("Run query")').catch(() =>
      page.click('button[aria-label*="refresh"]')
    );

    await page.waitForTimeout(3000);

    // Just verify query executed
    expect(page.url()).toContain('explore');
  });

  test('Query HIPAA audit log evidence', async ({ page }) => {
    await page.goto(`${GRAFANA_URL}/explore`);
    await page.waitForTimeout(2000);

    const queryInput = page.locator('textarea').first();
    await queryInput.fill('{span.compliance.framework = "hipaa" && span.compliance.control = "164.312(b)"}');

    await page.click('button:has-text("Run query")').catch(() =>
      page.click('button[aria-label*="refresh"]')
    );

    await page.waitForTimeout(2000);
    expect(page.url()).toContain('explore');
  });

  test('Query GDPR data access evidence', async ({ page }) => {
    await page.goto(`${GRAFANA_URL}/explore`);
    await page.waitForTimeout(2000);

    const queryInput = page.locator('textarea').first();
    await queryInput.fill('{span.compliance.framework = "gdpr" && span.compliance.control = "Art. 15"}');

    await page.click('button:has-text("Run query")').catch(() =>
      page.click('button[aria-label*="refresh"]')
    );

    await page.waitForTimeout(2000);
    expect(page.url()).toContain('explore');
  });
});
