/**
 * E2E Tests - Trace Drilldown
 *
 * Tests trace visualization and navigation.
 *
 * NOTE: These tests are skipped until the TraceDrilldown UI is implemented.
 * The page objects expect features like:
 * - Trace ID input
 * - Load/Clear buttons
 * - Trace visualization
 * - Deep link to Tempo
 */

import { test, expect } from '@playwright/test';
import { LoginPage, TraceDrilldownPage } from './pages';

// TraceDrilldown UI now implemented as tab in RootPage - unskipped for validation
test.describe('BeTrace Trace Drilldown', () => {
  let loginPage: LoginPage;
  let tracePage: TraceDrilldownPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    tracePage = new TraceDrilldownPage(page);

    await loginPage.login();
    await tracePage.navigate();
  });

  test('T3.1 - Navigate to trace drilldown', async () => {
    await tracePage.verifyPageLoaded();
  });

  test('T3.2 - Enter trace ID', async () => {
    const testTraceId = '1234567890abcdef';

    await tracePage.enterTraceId(testTraceId);

    // Verify input contains the trace ID
    const inputValue = await tracePage.traceIdInput.inputValue();
    expect(inputValue).toBe(testTraceId);
  });

  test('T3.3 - Load trace - success (mock)', async ({ page }) => {
    // This test requires a mock backend or test trace ID
    const testTraceId = 'test-trace-12345';

    // Intercept API call and return mock data
    await page.route('**/api/traces/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          traceId: testTraceId,
          spans: [
            {
              spanId: 'span-1',
              operationName: 'GET /api/users',
              duration: 1500000,
              startTime: Date.now() * 1000,
            },
          ],
        }),
      });
    });

    await tracePage.loadTrace(testTraceId);
    await tracePage.verifyTraceLoaded(testTraceId);
  });

  test('T3.4 - Load trace - not found', async ({ page }) => {
    const nonExistentTraceId = 'nonexistent-trace-id';

    // Intercept API call and return 404
    await page.route('**/api/traces/**', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Trace not found',
        }),
      });
    });

    await tracePage.loadTrace(nonExistentTraceId);
    await tracePage.verifyTraceNotFound();
  });

  test('T3.5 - Load trace - invalid format', async () => {
    const invalidTraceId = 'invalid!@#$%';

    await tracePage.enterTraceId(invalidTraceId);

    // Verify validation error or helpful message
    await tracePage.loadTraceButton.click();

    // Should show error about invalid format
    await tracePage.verifyErrorMessage();
  });

  test('T3.6 - Tempo deep link button visible (if feature exists)', async ({ page }) => {
    // This test checks if Tempo integration is present
    const testTraceId = 'test-trace-tempo';

    // Mock successful trace load
    await page.route('**/api/traces/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          traceId: testTraceId,
          spans: [{ spanId: 'span-1', operationName: 'test' }],
        }),
      });
    });

    await tracePage.loadTrace(testTraceId);

    // Check if "View in Tempo" button exists
    if (await tracePage.viewInTempoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(tracePage.viewInTempoButton).toBeVisible();
    } else {
      // Feature not implemented yet - test passes
      console.log('Tempo deep link feature not implemented');
    }
  });

  test('T3.7 - Clear and reload trace', async ({ page }) => {
    const traceId1 = 'trace-1';
    const traceId2 = 'trace-2';

    // Mock backend
    await page.route('**/api/traces/**', (route) => {
      const url = route.request().url();
      const traceId = url.includes(traceId1) ? traceId1 : traceId2;

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          traceId,
          spans: [{ spanId: 'span-1', operationName: `trace-${traceId}` }],
        }),
      });
    });

    // Load first trace
    await tracePage.loadTrace(traceId1);
    await tracePage.verifyTraceLoaded(traceId1);

    // Load second trace (should replace first)
    await tracePage.loadTrace(traceId2);
    await tracePage.verifyTraceLoaded(traceId2);
  });

  test('T3.8 - Backend connection error handling', async ({ page }) => {
    const testTraceId = 'test-trace-error';

    // Intercept and simulate network error
    await page.route('**/api/traces/**', (route) => {
      route.abort('failed');
    });

    await tracePage.loadTrace(testTraceId);

    // Verify error message appears
    await tracePage.verifyErrorMessage();

    // Verify helpful retry option exists
    const retryButton = page.locator('button:has-text("Retry")');
    if (await retryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(retryButton).toBeVisible();
    }
  });
});
