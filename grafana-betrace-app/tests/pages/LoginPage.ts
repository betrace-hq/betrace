/**
 * LoginPage - Grafana login page object
 *
 * Handles authentication with Grafana.
 */

import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to login page
   */
  async navigate() {
    await this.goto('/login');
  }

  /**
   * Check if already logged in
   */
  async isLoggedIn(): Promise<boolean> {
    return !this.page.url().includes('/login');
  }

  /**
   * Login with username and password
   */
  async login(username = 'admin', password = 'admin') {
    // Check if already logged in
    if (await this.isLoggedIn()) {
      return;
    }

    // Fill login form
    await this.page.fill('input[name="user"]', username);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');

    // Wait for redirect after login
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Handle "Skip" button if it appears (change password prompt)
    await this.skipWelcomePrompts();
  }

  /**
   * Skip welcome/onboarding prompts
   */
  async skipWelcomePrompts() {
    const skipButton = this.page.locator('button:has-text("Skip")');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Also check for "Continue" or "Get Started" buttons
    const continueButton = this.page.locator('button:has-text("Continue"), button:has-text("Get Started")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
    }
  }

  /**
   * Logout
   */
  async logout() {
    await this.goto('/logout');
  }

  /**
   * Verify login successful
   */
  async verifyLoginSuccessful() {
    await expect(this.page).toHaveURL(/^((?!\/login).)*$/, { timeout: 10000 });
  }
}
