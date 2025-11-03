/**
 * ConfigPage - BeTrace plugin configuration page object
 *
 * Handles plugin settings and backend connection configuration.
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface PluginConfig {
  backendUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
}

export class ConfigPage extends BasePage {
  // Locators
  readonly backendUrlInput: Locator;
  readonly apiKeyInput: Locator;
  readonly timeoutInput: Locator;
  readonly retryAttemptsInput: Locator;
  readonly saveButton: Locator;
  readonly testConnectionButton: Locator;
  readonly connectionStatus: Locator;

  constructor(page: Page) {
    super(page);

    this.backendUrlInput = page.locator('input[name="backendUrl"]');
    this.apiKeyInput = page.locator('input[name="apiKey"]');
    this.timeoutInput = page.locator('input[name="timeout"]');
    this.retryAttemptsInput = page.locator('input[name="retryAttempts"]');
    this.saveButton = page.locator('button:has-text("Save")');
    this.testConnectionButton = page.locator('button:has-text("Test Connection")');
    this.connectionStatus = page.locator('.connection-status, [data-testid="connection-status"]');
  }

  /**
   * Navigate to config page
   */
  async navigate() {
    await this.goto('/a/betrace-app/config');
  }

  /**
   * Verify page loaded
   */
  async verifyPageLoaded() {
    await expect(
      this.page.locator('h1, h2').filter({ hasText: /Configuration|Settings/i })
    ).toBeVisible();
    await expect(this.backendUrlInput).toBeVisible();
  }

  /**
   * Fill configuration
   */
  async fillConfig(config: PluginConfig) {
    await this.backendUrlInput.fill(config.backendUrl);

    if (config.apiKey) {
      if (await this.apiKeyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.apiKeyInput.fill(config.apiKey);
      }
    }

    if (config.timeout) {
      if (await this.timeoutInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.timeoutInput.fill(config.timeout.toString());
      }
    }

    if (config.retryAttempts) {
      if (await this.retryAttemptsInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.retryAttemptsInput.fill(config.retryAttempts.toString());
      }
    }
  }

  /**
   * Save configuration
   */
  async saveConfig() {
    await this.saveButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Configure backend (complete workflow)
   */
  async configureBackend(config: PluginConfig) {
    await this.fillConfig(config);
    await this.saveConfig();
  }

  /**
   * Test connection to backend
   */
  async testConnection() {
    if (await this.testConnectionButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.testConnectionButton.click();
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Verify connection successful
   */
  async verifyConnectionSuccess() {
    await expect(
      this.page.locator('text=/connected|success|online/i')
    ).toBeVisible({ timeout: 10000 });

    if (await this.connectionStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(this.connectionStatus).toContainText(/connected|online/i);
    }
  }

  /**
   * Verify connection failed
   */
  async verifyConnectionFailed() {
    await expect(
      this.page.locator('text=/failed|error|offline|unreachable/i')
    ).toBeVisible({ timeout: 10000 });

    if (await this.connectionStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(this.connectionStatus).toContainText(/failed|error|offline/i);
    }
  }

  /**
   * Verify settings saved
   */
  async verifySettingsSaved() {
    await expect(
      this.page.locator('text=/saved|success|updated/i')
    ).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get current backend URL
   */
  async getBackendUrl(): Promise<string> {
    return await this.backendUrlInput.inputValue();
  }

  /**
   * Verify retry button visible
   */
  async verifyRetryButtonVisible() {
    await expect(this.page.locator('button:has-text("Retry")')).toBeVisible();
  }

  /**
   * Click retry button
   */
  async clickRetry() {
    await this.page.click('button:has-text("Retry")');
    await this.page.waitForTimeout(2000);
  }
}
