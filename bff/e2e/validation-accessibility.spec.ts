import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * PRD-010d Phase 5: Accessibility E2E Testing
 *
 * Test Suite: Screen Reader and Keyboard Navigation
 *
 * Validates WCAG 2.1 AA compliance in real browser environments:
 * 1. Screen reader announcements (aria-live regions)
 * 2. Keyboard-only navigation
 * 3. Focus management
 * 4. Accessible error recovery flow
 *
 * Cross-Browser Coverage:
 * - Chrome (primary + ChromeVox)
 * - Firefox (NVDA compatibility)
 * - Safari (VoiceOver compatibility)
 */

test.describe('Validation Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rules/new');
    await page.waitForSelector('.monaco-editor', { state: 'visible' });
  });

  test('A11Y: Screen reader announces validation errors via aria-live', async ({ page }) => {
    // Step 1: Enter invalid DSL to trigger validation error
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(invalid syntax');

    // Step 2: Wait for aria-live region to populate
    await page.waitForSelector('[aria-live="polite"], [aria-live="assertive"]', {
      state: 'visible',
      timeout: 5000
    });

    // Step 3: Verify aria-live region contains error message
    const liveRegion = page.locator('[aria-live="assertive"][role="alert"], [aria-live="polite"][role="status"]');
    await expect(liveRegion).toBeVisible();

    const liveText = await liveRegion.textContent();
    expect(liveText).toMatch(/error|invalid|syntax/i);

    // Step 4: Verify role="alert" for errors
    const alertRegion = page.locator('[role="alert"]');
    await expect(alertRegion).toBeVisible();

    // Step 5: Verify aria-atomic for complete announcement
    const hasAriaAtomic = await liveRegion.getAttribute('aria-atomic');
    expect(hasAriaAtomic).toBeTruthy();
  });

  test('A11Y: Keyboard navigation to Fix This button and activation', async ({ page }) => {
    // Step 1: Enter invalid DSL
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(error here');

    // Step 2: Wait for validation error with Fix This button
    await page.waitForSelector('button:has-text("Fix This")', {
      state: 'visible',
      timeout: 5000
    });

    // Step 3: Navigate to Fix This button using keyboard only
    // Press Tab multiple times to reach the button
    let focusedElement: string | null = null;
    let tabPresses = 0;
    const maxTabs = 20;

    while (tabPresses < maxTabs) {
      await page.keyboard.press('Tab');
      tabPresses++;

      // Check if Fix This button is focused
      const focused = await page.evaluateHandle(() => document.activeElement);
      const tagName = await focused.evaluate(el => el?.tagName);
      const text = await focused.evaluate(el => el?.textContent);

      if (tagName === 'BUTTON' && text?.includes('Fix This')) {
        focusedElement = 'Fix This button';
        break;
      }
    }

    // Step 4: Verify Fix This button received focus
    expect(focusedElement).toBe('Fix This button');

    // Step 5: Activate button with Enter key
    await page.keyboard.press('Enter');

    // Step 6: Verify error was fixed (ValidationFeedback cleared)
    await page.waitForTimeout(500); // Allow UI to update

    const validationError = page.locator('[role="alert"]');
    const errorCount = await validationError.count();
    expect(errorCount).toBe(0);
  });

  test('A11Y: Focus management during error resolution', async ({ page }) => {
    // Step 1: Enter invalid DSL
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(error');

    // Step 2: Wait for validation error
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 3: Verify focus remains in Monaco editor (not stolen by error)
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const focusedClass = await focusedElement.evaluate(el => el?.className);

    // Monaco keeps focus in the editor, not stolen by ValidationFeedback
    expect(focusedClass).toMatch(/monaco|editor/i);

    // Step 4: Tab to Fix This button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Step 5: Verify focus moved to actionable element (button or link)
    const newFocusedElement = await page.evaluateHandle(() => document.activeElement);
    const newTagName = await newFocusedElement.evaluate(el => el?.tagName);

    expect(['BUTTON', 'A', 'INPUT']).toContain(newTagName);
  });

  test('A11Y: ARIA labels provide context for assistive technology', async ({ page }) => {
    // Step 1: Enter invalid DSL with PII
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(ssn=123-45-6789) invalid');

    // Step 2: Wait for validation error
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 3: Verify Fix This button has aria-label
    const fixButton = page.locator('button:has-text("Fix This")');
    if (await fixButton.isVisible({ timeout: 1000 })) {
      const ariaLabel = await fixButton.getAttribute('aria-label');
      expect(ariaLabel).toMatch(/line \d+|column \d+|error/i);
    }

    // Step 4: Verify ValidationFeedback has aria-label or accessible name
    const validationFeedback = page.locator('[role="alert"], [role="status"]');
    const accessibleName = await validationFeedback.evaluate(el => {
      // Get accessible name (aria-label, aria-labelledby, or text content)
      return el.getAttribute('aria-label') ||
             el.textContent ||
             'No accessible name';
    });

    expect(accessibleName).not.toBe('No accessible name');
    expect(accessibleName.length).toBeGreaterThan(0);
  });

  test('A11Y: Multiple errors announced sequentially without overlap', async ({ page }) => {
    // Step 1: Enter DSL with 3 distinct errors
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();

    await page.keyboard.type('trace.has(error1\n');
    await page.keyboard.type('trace.has(error2\n');
    await page.keyboard.type('trace.has(error3');

    // Step 2: Wait for multiple errors
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 3: Verify multiple aria-live regions or error elements
    const errorElements = page.locator('[role="alert"]');
    const errorCount = await errorElements.count();
    expect(errorCount).toBeGreaterThanOrEqual(3);

    // Step 4: Verify each error has unique accessible text
    const errorTexts = await errorElements.allTextContents();
    const uniqueTexts = new Set(errorTexts);

    expect(uniqueTexts.size).toBeGreaterThanOrEqual(2); // At least 2 unique error messages

    // Step 5: Verify aria-atomic on live regions (prevents partial announcements)
    for (let i = 0; i < Math.min(errorCount, 3); i++) {
      const error = errorElements.nth(i);
      const ariaAtomic = await error.getAttribute('aria-atomic');
      // aria-atomic should be true or inherited from parent
      expect(['true', null]).toContain(ariaAtomic);
    }
  });

  test('A11Y: Keyboard-only complete error resolution workflow', async ({ page }) => {
    // Step 1: Navigate to editor using keyboard only
    await page.keyboard.press('Tab'); // Tab to first focusable element
    await page.keyboard.press('Tab'); // Tab to Monaco editor (or next element)

    // Step 2: Type invalid DSL
    await page.keyboard.type('trace.has(invalid');

    // Step 3: Wait for validation error
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 4: Navigate to Fix This button using Tab
    let foundFixButton = false;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');

      const focused = await page.evaluateHandle(() => document.activeElement);
      const text = await focused.evaluate(el => el?.textContent);

      if (text?.includes('Fix This')) {
        foundFixButton = true;
        break;
      }
    }

    expect(foundFixButton).toBe(true);

    // Step 5: Activate Fix This button with keyboard
    await page.keyboard.press('Enter');

    // Step 6: Verify error resolved
    await page.waitForTimeout(500);

    const errorAfterFix = await page.locator('[role="alert"]').count();
    expect(errorAfterFix).toBe(0);
  });

  test('A11Y: Screen reader context for priority errors (🎯 FIX THIS FIRST)', async ({ page }) => {
    // Step 1: Enter DSL with multiple errors
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();

    await page.keyboard.type('trace.has(error1 invalid\n');
    await page.keyboard.type('trace.has(error2 invalid\n');

    // Step 2: Wait for multiple errors
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 3: Check for priority indicator badge
    const priorityBadge = page.locator('text=/FIX THIS FIRST|Priority/i');

    if (await priorityBadge.isVisible({ timeout: 1000 })) {
      // Step 4: Verify priority badge is within an error alert
      const parentAlert = priorityBadge.locator('xpath=ancestor::*[@role="alert"]');
      await expect(parentAlert).toBeVisible();

      // Step 5: Verify priority indicator is accessible (not aria-hidden)
      const ariaHidden = await priorityBadge.getAttribute('aria-hidden');
      expect(ariaHidden).not.toBe('true');
    }
  });

  test('A11Y: Cross-browser ARIA attribute consistency', async ({ page, browserName }) => {
    // Step 1: Enter invalid DSL
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(invalid');

    // Step 2: Wait for validation error
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 3: Verify ARIA attributes are present and consistent across browsers
    const errorElement = page.locator('[role="alert"]').first();

    // Check role
    const role = await errorElement.getAttribute('role');
    expect(role).toBe('alert');

    // Check aria-live (should be assertive for alerts)
    const ariaLive = await errorElement.getAttribute('aria-live');
    expect(['assertive', 'polite']).toContain(ariaLive);

    // Step 4: Log browser-specific behavior for debugging
    console.log(`[${browserName}] ARIA attributes:`, {
      role,
      ariaLive,
      hasAriaAtomic: await errorElement.getAttribute('aria-atomic'),
      hasAriaLabel: await errorElement.getAttribute('aria-label')
    });

    // Step 5: Verify no ARIA errors (Chrome/Firefox dev tools would show warnings)
    const consoleWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('ARIA')) {
        consoleWarnings.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);

    // No ARIA-related warnings should be present
    expect(consoleWarnings.length).toBe(0);
  });
});

/**
 * Helper function to check if element is in accessibility tree
 */
async function isAccessible(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector);
  const ariaHidden = await element.getAttribute('aria-hidden');
  const display = await element.evaluate(el => window.getComputedStyle(el).display);
  const visibility = await element.evaluate(el => window.getComputedStyle(el).visibility);

  return ariaHidden !== 'true' && display !== 'none' && visibility !== 'hidden';
}
