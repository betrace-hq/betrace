/**
 * BasePage - Base class for all page objects
 *
 * Provides common functionality for interacting with Grafana pages.
 */

import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.BETRACE_PORT_GRAFANA
      ? `http://localhost:${process.env.BETRACE_PORT_GRAFANA}`
      : 'http://localhost:12015';
  }

  /**
   * Navigate to a specific path
   */
  async goto(path: string) {
    await this.page.goto(`${this.baseURL}${path}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(locator: Locator, timeout = 5000) {
    await expect(locator).toBeVisible({ timeout });
  }

  /**
   * Fill a form field
   */
  async fillField(name: string, value: string) {
    await this.page.fill(`[name="${name}"]`, value);
  }

  /**
   * Click a button by text
   */
  async clickButton(text: string) {
    await this.page.click(`button:has-text("${text}")`);
  }

  /**
   * Select from dropdown
   */
  async selectOption(name: string, value: string) {
    await this.page.selectOption(`select[name="${name}"]`, value);
  }

  /**
   * Check if text is visible on page
   */
  async hasText(text: string): Promise<boolean> {
    return await this.page.locator(`text=${text}`).isVisible({ timeout: 2000 }).catch(() => false);
  }

  /**
   * Wait for success message
   */
  async waitForSuccessMessage(message?: string) {
    const successLocator = message
      ? this.page.locator(`text=${message}`)
      : this.page.locator('text=/success|created|saved|updated|deleted/i');

    await expect(successLocator).toBeVisible({ timeout: 5000 });
  }

  /**
   * Wait for error message
   */
  async waitForErrorMessage(message?: string) {
    const errorLocator = message
      ? this.page.locator(`text=${message}`)
      : this.page.locator('text=/error|failed|invalid/i');

    await expect(errorLocator).toBeVisible({ timeout: 5000 });
  }

  /**
   * Take screenshot (useful for debugging)
   */
  async screenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }
}
