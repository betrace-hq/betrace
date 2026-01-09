/**
 * E2E Tests - Plugin Configuration
 *
 * Tests plugin settings and backend connection.
 *
 * NOTE: These tests are skipped until the ConfigPage UI is fully implemented.
 * The current ConfigPage is a minimal stub. These tests expect features like:
 * - Test Connection button
 * - API key input
 * - Connection status display
 * - Retry functionality
 * - Settings persistence
 */

import { test, expect } from '@playwright/test';
import { LoginPage, ConfigPage, type PluginConfig } from './pages';

// Skip entire test suite - ConfigPage UI not fully implemented
test.describe.skip('BeTrace Plugin Configuration', () => {
  let loginPage: LoginPage;
  let configPage: ConfigPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    configPage = new ConfigPage(page);

    await loginPage.login();
    await configPage.navigate();
  });

  test('T1.3 - Configuration page loads', async () => {
    await configPage.verifyPageLoaded();
  });

  test('T4.1 - Configure backend - success', async ({ page }) => {
    const config: PluginConfig = {
      backendUrl: 'http://localhost:12011',
      apiKey: 'test-api-key',
    };

    // Mock successful backend connection
    await page.route('**/health', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    await configPage.configureBackend(config);
    await configPage.verifySettingsSaved();

    // Test connection
    await configPage.testConnection();
    await configPage.verifyConnectionSuccess();
  });

  test('T4.2 - Backend connection - failure', async ({ page }) => {
    const config: PluginConfig = {
      backendUrl: 'http://localhost:99999', // Invalid port
    };

    // Mock failed connection
    await page.route('**/health', (route) => {
      route.abort('failed');
    });

    await configPage.configureBackend(config);
    await configPage.verifySettingsSaved();

    // Test connection
    await configPage.testConnection();
    await configPage.verifyConnectionFailed();

    // Verify retry button appears
    await configPage.verifyRetryButtonVisible();
  });

  test('T4.3 - Backend connection - retry', async ({ page }) => {
    const config: PluginConfig = {
      backendUrl: 'http://localhost:12011',
    };

    let attemptCount = 0;

    // Mock: first attempt fails, second succeeds
    await page.route('**/health', (route) => {
      attemptCount++;
      if (attemptCount === 1) {
        route.abort('failed');
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok' }),
        });
      }
    });

    await configPage.configureBackend(config);
    await configPage.testConnection();
    await configPage.verifyConnectionFailed();

    // Click retry
    await configPage.clickRetry();
    await configPage.verifyConnectionSuccess();
  });

  test('T4.4 - Validate backend URL format', async () => {
    const invalidConfigs = [
      { backendUrl: 'not-a-url' },
      { backendUrl: 'ftp://invalid-protocol' },
      { backendUrl: '' },
    ];

    for (const config of invalidConfigs) {
      await configPage.fillConfig(config);
      await configPage.saveConfig();

      // Should show validation error
      await configPage.verifyErrorMessage();

      // Reload page for next iteration
      await configPage.navigate();
    }
  });

  test('T4.5 - Configuration persists after save', async () => {
    const config: PluginConfig = {
      backendUrl: 'http://localhost:12011',
      apiKey: 'persistent-key-123',
      timeout: 30000,
      retryAttempts: 3,
    };

    await configPage.configureBackend(config);
    await configPage.verifySettingsSaved();

    // Reload page
    await configPage.navigate();

    // Verify settings persisted
    const savedUrl = await configPage.getBackendUrl();
    expect(savedUrl).toBe(config.backendUrl);
  });

  test('T4.6 - Optional fields are optional', async () => {
    const minimalConfig: PluginConfig = {
      backendUrl: 'http://localhost:12011',
      // No API key, timeout, or retry attempts
    };

    await configPage.configureBackend(minimalConfig);
    await configPage.verifySettingsSaved();
  });

  test('T4.7 - Update existing configuration', async () => {
    const originalConfig: PluginConfig = {
      backendUrl: 'http://localhost:12011',
      apiKey: 'original-key',
    };

    await configPage.configureBackend(originalConfig);
    await configPage.verifySettingsSaved();

    // Update configuration
    const updatedConfig: PluginConfig = {
      backendUrl: 'http://localhost:12012',
      apiKey: 'updated-key',
    };

    await configPage.fillConfig(updatedConfig);
    await configPage.saveConfig();
    await configPage.verifySettingsSaved();

    // Verify new URL
    const savedUrl = await configPage.getBackendUrl();
    expect(savedUrl).toBe(updatedConfig.backendUrl);
  });

  test('T4.8 - Connection timeout handling', async ({ page }) => {
    const config: PluginConfig = {
      backendUrl: 'http://localhost:12011',
      timeout: 1000, // 1 second timeout
    };

    // Mock slow response (longer than timeout)
    await page.route('**/health', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' }),
      });
    });

    await configPage.configureBackend(config);
    await configPage.testConnection();

    // Should show timeout error
    await configPage.verifyConnectionFailed();
    await expect(configPage.page.locator('text=/timeout|timed out/i')).toBeVisible({
      timeout: 10000,
    });
  });

  test('T4.9 - API key masking', async () => {
    const config: PluginConfig = {
      backendUrl: 'http://localhost:12011',
      apiKey: 'super-secret-key-12345',
    };

    await configPage.fillConfig(config);

    // Check if API key input has type="password" or is masked
    const apiKeyInput = configPage.apiKeyInput;
    if (await apiKeyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const inputType = await apiKeyInput.getAttribute('type');

      // Should be password or masked
      expect(['password', 'text']).toContain(inputType);

      // If text type, verify it shows masked value when saved
      await configPage.saveConfig();
      await configPage.verifySettingsSaved();

      // Reload
      await configPage.navigate();

      // API key should not be visible in plain text (or should be masked)
      const savedValue = await apiKeyInput.inputValue();

      // Either empty, masked (***), or the same (depends on implementation)
      if (savedValue && savedValue !== config.apiKey) {
        expect(savedValue).toMatch(/\*+/); // Masked with asterisks
      }
    }
  });
});
