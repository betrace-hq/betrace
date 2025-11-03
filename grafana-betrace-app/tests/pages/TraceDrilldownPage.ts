/**
 * TraceDrilldownPage - BeTrace trace drilldown page object
 *
 * Provides methods for interacting with trace visualization.
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class TraceDrilldownPage extends BasePage {
  // Locators
  readonly traceIdInput: Locator;
  readonly loadTraceButton: Locator;
  readonly traceDisplay: Locator;
  readonly viewInTempoButton: Locator;

  constructor(page: Page) {
    super(page);

    this.traceIdInput = page.locator('input[name="traceId"], input[placeholder*="Trace ID"]');
    this.loadTraceButton = page.locator('button:has-text("Load Trace"), button:has-text("Load")');
    this.traceDisplay = page.locator('.trace-view, .trace-display, [data-testid="trace-view"]');
    this.viewInTempoButton = page.locator('button:has-text("View in Tempo")');
  }

  /**
   * Navigate to trace drilldown page
   */
  async navigate() {
    await this.goto('/a/betrace-app/trace-drilldown');
  }

  /**
   * Verify page loaded
   */
  async verifyPageLoaded() {
    await expect(
      this.page.locator('h1, h2').filter({ hasText: 'Trace Drilldown' })
    ).toBeVisible();
    await expect(this.traceIdInput).toBeVisible();
  }

  /**
   * Enter trace ID
   */
  async enterTraceId(traceId: string) {
    await this.traceIdInput.fill(traceId);
  }

  /**
   * Load trace
   */
  async loadTrace(traceId: string) {
    await this.enterTraceId(traceId);
    await this.loadTraceButton.click();
    await this.page.waitForTimeout(2000); // Wait for trace to load
  }

  /**
   * Verify trace loaded
   */
  async verifyTraceLoaded(traceId: string) {
    // Check for trace ID in display
    await expect(this.page.locator(`text=${traceId}`)).toBeVisible({ timeout: 10000 });

    // Or check for trace display container
    if (await this.traceDisplay.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(this.traceDisplay).toBeVisible();
    }
  }

  /**
   * Verify trace not found
   */
  async verifyTraceNotFound() {
    await expect(
      this.page.locator('text=/not found|no trace|error/i')
    ).toBeVisible({ timeout: 5000 });
  }

  /**
   * Click "View in Tempo" button
   */
  async clickViewInTempo() {
    await this.viewInTempoButton.click();
  }

  /**
   * Verify Tempo link opens
   */
  async verifyTempoLinkOpens(traceId: string) {
    // Wait for new page to open
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.clickViewInTempo(),
    ]);

    // Verify URL contains Tempo explore and trace ID
    expect(newPage.url()).toContain('/explore');
    expect(newPage.url()).toContain(traceId);

    await newPage.close();
  }

  /**
   * Verify span count
   */
  async verifySpanCount(expectedCount: number) {
    const spanElements = this.page.locator('.span, [data-testid="span"]');
    await expect(spanElements).toHaveCount(expectedCount, { timeout: 10000 });
  }

  /**
   * Get trace duration
   */
  async getTraceDuration(): Promise<string | null> {
    const durationElement = this.page.locator(
      '[data-testid="trace-duration"], .trace-duration'
    );

    if (await durationElement.isVisible({ timeout: 2000 }).catch(() => false)) {
      return await durationElement.textContent();
    }

    return null;
  }

  /**
   * Verify error message
   */
  async verifyErrorMessage(message?: string) {
    const errorLocator = message
      ? this.page.locator(`text=${message}`)
      : this.page.locator('text=/error|failed|invalid/i');

    await expect(errorLocator).toBeVisible({ timeout: 5000 });
  }
}
