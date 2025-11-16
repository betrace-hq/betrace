/**
 * E2E Tests - Rules Management
 *
 * Tests core rules CRUD operations in BeTrace Grafana plugin.
 *
 * @requires-grafana
 * @requires-backend
 * @sandbox grafana-rules
 *
 * Prerequisites:
 * - Grafana running on localhost:12015 (or BETRACE_PORT_GRAFANA)
 * - BeTrace plugin installed and enabled
 * - Backend running on localhost:12011
 */

import { test, expect } from './lib/playwright-capability-plugin';
import { validateTestCapabilities } from './lib/playwright-capability-plugin';
import type { Page } from '@playwright/test';

// Test configuration
const GRAFANA_URL = process.env.BETRACE_PORT_GRAFANA
  ? `http://localhost:${process.env.BETRACE_PORT_GRAFANA}`
  : 'http://localhost:12015';

const GRAFANA_USERNAME = process.env.GRAFANA_USERNAME || 'admin';
const GRAFANA_PASSWORD = process.env.GRAFANA_PASSWORD || 'admin';

// Helper: Login to Grafana (handles both anonymous auth and explicit login)
async function loginToGrafana(page: Page) {
  console.log(`[DEBUG] Injecting BETRACE_PORT_BACKEND=${process.env.BETRACE_PORT_BACKEND} before page load`);

  // Inject backend port into window BEFORE any page navigation
  await page.addInitScript((port) => {
    (window as any).BETRACE_PORT_BACKEND = port;
    console.log(`[BeTrace] Pre-injected BETRACE_PORT_BACKEND=${port}`);
  }, process.env.BETRACE_PORT_BACKEND);

  console.log(`[DEBUG] Navigating to Grafana home: ${GRAFANA_URL}/`);
  await page.goto(`${GRAFANA_URL}/`, { waitUntil: 'networkidle' });

  console.log(`[DEBUG] Current URL after goto: ${page.url()}`);

  // If redirected to login page, fill in credentials
  if (page.url().includes('/login')) {
    console.log('[DEBUG] On login page, attempting login...');

    try {
      // Wait for login form with shorter timeout (might not exist with anonymous auth)
      await page.waitForSelector('input[name="user"]', { timeout: 5000 });
      await page.waitForSelector('input[name="password"]', { timeout: 5000 });
      await page.waitForSelector('button[type="submit"]', { timeout: 5000 });

      console.log('[DEBUG] Form elements found, filling credentials...');
      await page.fill('input[name="user"]', GRAFANA_USERNAME);
      await page.fill('input[name="password"]', GRAFANA_PASSWORD);

      console.log('[DEBUG] Clicking submit button...');
      await Promise.all([
        page.waitForNavigation({ timeout: 30000 }),
        page.click('button[type="submit"]')
      ]);

      console.log(`[DEBUG] Login successful, URL: ${page.url()}`);
    } catch (error) {
      console.log('[DEBUG] Login form not found or timed out - may be using anonymous auth');
      // Navigate away from login page (anonymous auth should work)
      await page.goto(`${GRAFANA_URL}/`, { waitUntil: 'networkidle' });
    }
  } else {
    console.log('[DEBUG] Not on login page - anonymous auth may be enabled');
  }

  // Skip "welcome" or "change password" prompts if they appear
  const skipButton = page.locator('button:has-text("Skip")');
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('[DEBUG] Clicking Skip button...');
    await skipButton.click();
  }

  console.log(`[DEBUG] Login complete, final URL: ${page.url()}`);
}

// Helper: Navigate to BeTrace Rules page
async function navigateToRulesPage(page: Page) {
  console.log(`[DEBUG] Navigating to BeTrace app Rules tab: ${GRAFANA_URL}/a/betrace-app?tab=rules`);

  // Navigate directly to Rules tab using query parameter (not a separate route)
  // The plugin uses tab-based navigation: /a/betrace-app?tab=<home|signals|rules>
  await page.goto(`${GRAFANA_URL}/a/betrace-app?tab=rules`);

  // Wait for plugin to load
  await page.waitForLoadState('networkidle');
  console.log(`[DEBUG] Current URL after navigation: ${page.url()}`);

  // Wait for Rules page content to load (rule list or create button)
  try {
    await page.waitForSelector('h2:has-text("BeTrace Rules")', { timeout: 10000 });
    console.log('[DEBUG] Rules page loaded successfully');
  } catch (error) {
    console.log('[DEBUG] Rules page content not found, checking for errors...');
    const pageContent = await page.content();
    console.log(`[DEBUG] Page HTML length: ${pageContent.length}`);
    console.log(`[DEBUG] Page title: ${await page.title()}`);
  }
}

// Helper: Create test rule
interface TestRule {
  name: string;
  description: string;
  expression: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
}

async function createTestRule(page: Page, rule: TestRule) {
  // Click "Create Rule" button
  await page.click('button:has-text("Create Rule")');

  // Wait for form to open
  await expect(page.locator('input[name="name"]')).toBeVisible();

  // Fill form fields
  await page.fill('input[name="name"]', rule.name);
  await page.fill('input[name="description"]', rule.description);

  // Fill Monaco editor (expression)
  const monacoEditor = page.locator('.monaco-editor').first();
  if (await monacoEditor.isVisible({ timeout: 5000 }).catch(() => false)) {
    await monacoEditor.click();
    await page.keyboard.type(rule.expression);
  } else {
    // Fallback if Monaco doesn't load
    const expressionInput = page.locator('textarea[name="expression"]');
    await expressionInput.fill(rule.expression);
  }

  // Select severity
  await page.selectOption('select[name="severity"]', rule.severity);

  // Set enabled status
  if (rule.enabled) {
    const enabledCheckbox = page.locator('input[name="enabled"]');
    if (!(await enabledCheckbox.isChecked())) {
      await enabledCheckbox.check();
    }
  }

  // Submit form
  await page.click('button:has-text("Create")');

  // Wait for creation to complete
  await page.waitForTimeout(1000);
}

// Test suite
test.describe('BeTrace Rules Management', () => {
  // Validate capabilities before any tests run
  test.beforeAll(async ({ preprocessor, projectCapabilities, testCapabilities }) => {
    await validateTestCapabilities(preprocessor, projectCapabilities, testCapabilities);
  });

  test.beforeEach(async ({ page }) => {
    // Capture console logs from the browser
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning' || msg.text().includes('BeTrace')) {
        console.log(`[BROWSER ${type.toUpperCase()}] ${msg.text()}`);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      console.error(`[BROWSER ERROR] ${error.message}`);
    });

    await loginToGrafana(page);
    await navigateToRulesPage(page);
  });

  test('T1.1 - Rules page loads successfully', async ({ page }) => {
    // Verify page title or heading
    await expect(page.locator('h1, h2').filter({ hasText: 'Rules' })).toBeVisible();

    // Verify "Create Rule" button exists
    await expect(page.locator('button:has-text("Create Rule")')).toBeVisible();

    // Verify table or list container exists
    const tableOrList = page.locator('table, [role="grid"], .rules-list').first();
    await expect(tableOrList).toBeVisible({ timeout: 10000 });
  });

  test('T2.2 - Create rule - happy path', async ({ page }) => {
    const testRule: TestRule = {
      name: `E2E Test Rule ${Date.now()}`,
      description: 'Created by E2E test',
      expression: 'span.duration > 1000000000',
      severity: 'HIGH',
      enabled: true,
    };

    await createTestRule(page, testRule);

    // Verify rule appears in list
    await expect(page.locator(`text=${testRule.name}`)).toBeVisible({ timeout: 5000 });

    // Verify rule details are correct
    const ruleRow = page.locator(`tr:has-text("${testRule.name}")`).first();
    await expect(ruleRow).toContainText('HIGH');
    await expect(ruleRow).toContainText('Enabled');
  });

  test('T2.3 - Create rule - validation errors', async ({ page }) => {
    // Click Create Rule
    await page.click('button:has-text("Create Rule")');

    // Try to submit with empty name
    await page.click('button:has-text("Create")');

    // Verify validation error appears
    await expect(
      page.locator('text=/Name is required|This field is required/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('T2.4 - Create rule - invalid DSL expression', async ({ page }) => {
    const invalidRule: TestRule = {
      name: `Invalid Rule ${Date.now()}`,
      description: 'Test invalid expression',
      expression: 'span.duration >',
      severity: 'HIGH',
      enabled: true,
    };

    await createTestRule(page, invalidRule);

    // Verify error message appears (either from frontend or backend)
    const errorMessage = page.locator('text=/syntax error|invalid expression|parse error/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('T2.5 - Edit rule', async ({ page }) => {
    // First create a rule to edit
    const originalRule: TestRule = {
      name: `Edit Test ${Date.now()}`,
      description: 'Original description',
      expression: 'span.duration > 1000',
      severity: 'MEDIUM',
      enabled: true,
    };

    await createTestRule(page, originalRule);

    // Find the rule and click Edit
    const ruleRow = page.locator(`tr:has-text("${originalRule.name}")`).first();
    await ruleRow.locator('button:has-text("Edit")').click();

    // Wait for edit form
    await expect(page.locator('input[name="name"]')).toBeVisible();

    // Change the name
    const newName = `${originalRule.name} - Updated`;
    await page.fill('input[name="name"]', newName);

    // Save changes
    await page.click('button:has-text("Save")');

    // Verify updated name appears in list
    await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 5000 });
  });

  test('T2.6 - Delete rule', async ({ page }) => {
    // Create a rule to delete
    const ruleToDelete: TestRule = {
      name: `Delete Test ${Date.now()}`,
      description: 'Will be deleted',
      expression: 'span.status == "error"',
      severity: 'LOW',
      enabled: false,
    };

    await createTestRule(page, ruleToDelete);

    // Verify rule exists
    await expect(page.locator(`text=${ruleToDelete.name}`)).toBeVisible();

    // Find and click Delete button
    const ruleRow = page.locator(`tr:has-text("${ruleToDelete.name}")`).first();
    await ruleRow.locator('button:has-text("Delete")').click();

    // Confirm deletion (if confirmation modal appears)
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Verify rule is removed from list
    await expect(page.locator(`text=${ruleToDelete.name}`)).not.toBeVisible({ timeout: 5000 });
  });

  test('T2.7 - Enable/Disable rule toggle', async ({ page }) => {
    // Create an enabled rule
    const toggleRule: TestRule = {
      name: `Toggle Test ${Date.now()}`,
      description: 'Test enable/disable',
      expression: 'true',
      severity: 'LOW',
      enabled: true,
    };

    await createTestRule(page, toggleRule);

    // Find the rule row
    const ruleRow = page.locator(`tr:has-text("${toggleRule.name}")`).first();

    // Verify initially enabled
    await expect(ruleRow).toContainText(/Enabled/i);

    // Click toggle/disable button
    const toggleButton = ruleRow.locator('button, input[type="checkbox"]').filter({
      hasText: /Enable|Disable/i,
    }).or(ruleRow.locator('[role="switch"]'));

    await toggleButton.first().click();

    // Wait for state to update
    await page.waitForTimeout(1000);

    // Verify status changed to Disabled
    await expect(ruleRow).toContainText(/Disabled/i);

    // Toggle back to enabled
    await toggleButton.first().click();
    await page.waitForTimeout(1000);

    // Verify status changed back to Enabled
    await expect(ruleRow).toContainText(/Enabled/i);
  });

  test('T5.1 - Monaco editor loads in rule form', async ({ page }) => {
    // Debug: Check if there's any error message on the page
    const bodyText = await page.locator('body').textContent() || '';
    console.log('[DEBUG] First 500 chars of page:', bodyText.substring(0, 500));

    // Check for error indicators
    if (bodyText.includes('Error') || bodyText.includes('error') || bodyText.includes('failed')) {
      console.log('[DEBUG] Page contains error text!');
      const errorElements = await page.locator('*:has-text("error"), *:has-text("Error"), *:has-text("failed")').all();
      for (const elem of errorElements.slice(0, 5)) {
        const text = await elem.textContent().catch(() => '');
        console.log(`[DEBUG] Error element: "${text.substring(0, 200)}"`);
      }
    }

    //Check if backend is reachable from plugin
    const canReachBackend = await page.evaluate(async (port) => {
      try {
        const response = await fetch(`http://localhost:${port}/v1/rules`);
        return { ok: response.ok, status: response.status };
      } catch (error: any) {
        return { ok: false, error: error.message };
      }
    }, process.env.BETRACE_PORT_BACKEND);
    console.log(`[DEBUG] Backend reachable from browser:`, canReachBackend);

    // Click Create Rule
    await page.click('button:has-text("Create Rule")');

    // Wait for form
    await expect(page.locator('input[name="name"]')).toBeVisible();

    // Verify Monaco editor is present
    const monacoEditor = page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 10000 });

    // Verify Monaco is interactive (can type in it)
    await monacoEditor.click();
    await page.keyboard.type('span.duration');

    // Verify text appears in editor
    await expect(page.locator('.monaco-editor')).toContainText('span.duration');
  });
});

// Optional: Cleanup after all tests
test.afterAll(async () => {
  // Could add cleanup logic here if needed
  // For example, delete all test rules created during this run
  console.log('E2E Rules tests complete');
});
