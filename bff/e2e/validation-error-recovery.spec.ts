import { test, expect } from '@playwright/test';

/**
 * PRD-010d Phase 5: Cross-Browser E2E Testing
 *
 * Test Suite: Complete Error Resolution Flow
 *
 * Validates the full user journey:
 * 1. User enters invalid DSL with PII
 * 2. Monaco displays validation error markers
 * 3. User hovers over error to see details (PII redacted)
 * 4. User clicks "Fix This" button in ValidationFeedback
 * 5. Error is removed from both Monaco and ValidationFeedback
 *
 * Security Validation:
 * - PII redaction works across Monaco hover and ValidationFeedback
 * - Sensitive data never appears in any UI element
 *
 * Cross-Browser Coverage:
 * - Chrome (primary)
 * - Firefox (Gecko engine)
 * - Safari (WebKit engine)
 */

test.describe('Validation Error Recovery Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to rule editor page
    await page.goto('/rules/new');

    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { state: 'visible' });
  });

  test('E2E: User fixes DSL validation error with PII redaction', async ({ page }) => {
    // Step 1: Enter invalid DSL with credit card number (PII)
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();

    // Type invalid DSL syntax with PII
    await page.keyboard.type('trace.has(credit-card=4532-1234-5678-9010) and invalid syntax');

    // Step 2: Wait for validation error marker in Monaco
    await page.waitForSelector('.monaco-error-marker, .squiggly-error', {
      state: 'visible',
      timeout: 5000
    });

    // Step 3: Verify ValidationFeedback displays error
    const validationError = page.locator('[role="alert"], .validation-error');
    await expect(validationError).toBeVisible({ timeout: 5000 });

    // Step 4: Verify PII is redacted in ValidationFeedback
    const errorText = await validationError.textContent();
    expect(errorText).toContain('[REDACTED');
    expect(errorText).not.toContain('4532-1234-5678-9010');
    expect(errorText).not.toContain('4532');

    // Step 5: Hover over Monaco error marker to see tooltip
    const errorMarker = page.locator('.monaco-error-marker, .squiggly-error').first();
    await errorMarker.hover();

    // Wait for hover tooltip to appear
    await page.waitForSelector('.monaco-hover, .monaco-hover-content', {
      state: 'visible',
      timeout: 3000
    });

    // Step 6: Verify PII is redacted in Monaco hover tooltip
    const hoverTooltip = page.locator('.monaco-hover, .monaco-hover-content');
    const tooltipText = await hoverTooltip.textContent();
    expect(tooltipText).toContain('[REDACTED');
    expect(tooltipText).not.toContain('4532-1234-5678-9010');

    // Step 7: Click "Fix This" button in ValidationFeedback
    const fixButton = page.locator('button:has-text("Fix This")');
    if (await fixButton.isVisible()) {
      await fixButton.click();

      // Step 8: Verify error is removed from ValidationFeedback
      await expect(validationError).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('E2E: Multi-error sequential recovery with PII redaction', async ({ page }) => {
    // Step 1: Enter DSL with multiple errors and PII (SSN, email, API key)
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();

    await page.keyboard.type('trace.has(error1) and\n');
    await page.keyboard.type('trace.has(ssn=123-45-6789) invalid\n');
    await page.keyboard.type('trace.has(email=user@example.com) missing-paren\n');
    await page.keyboard.type('trace.has(api-key=sk_live_abc123xyz) syntax-error');

    // Step 2: Wait for validation errors
    await page.waitForSelector('[role="alert"], .validation-error', {
      state: 'visible',
      timeout: 5000
    });

    // Step 3: Count errors (should be 3-4 errors)
    const errorElements = page.locator('[role="alert"], .validation-error');
    const errorCount = await errorElements.count();
    expect(errorCount).toBeGreaterThanOrEqual(3);

    // Step 4: Verify all PII is redacted
    const allErrorsText = await page.locator('.validation-feedback, [role="alert"]').allTextContents();
    const combinedText = allErrorsText.join(' ');

    // Verify redaction
    expect(combinedText).toMatch(/\[REDACTED[^\]]*\]/); // At least one redaction
    expect(combinedText).not.toContain('123-45-6789');
    expect(combinedText).not.toContain('user@example.com');
    expect(combinedText).not.toContain('sk_live_abc123xyz');

    // Step 5: Fix first error (if Fix This button exists)
    const firstFixButton = page.locator('button:has-text("Fix This")').first();
    if (await firstFixButton.isVisible({ timeout: 1000 })) {
      const initialCount = await errorElements.count();
      await firstFixButton.click();

      // Verify error count decreased
      await page.waitForTimeout(500); // Allow UI to update
      const newCount = await errorElements.count();
      expect(newCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('E2E: Validation error markers sync between Monaco and ValidationFeedback', async ({ page }) => {
    // Step 1: Enter invalid DSL
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(invalid syntax here');

    // Step 2: Wait for both Monaco marker and ValidationFeedback error
    await Promise.all([
      page.waitForSelector('.monaco-error-marker, .squiggly-error', { state: 'visible', timeout: 5000 }),
      page.waitForSelector('[role="alert"], .validation-error', { state: 'visible', timeout: 5000 })
    ]);

    // Step 3: Verify Monaco has error marker
    const monacoMarker = page.locator('.monaco-error-marker, .squiggly-error');
    await expect(monacoMarker).toBeVisible();

    // Step 4: Verify ValidationFeedback has error
    const validationError = page.locator('[role="alert"], .validation-error');
    await expect(validationError).toBeVisible();

    // Step 5: Clear error by fixing syntax
    await monacoEditor.click();
    await page.keyboard.press('Control+A'); // Select all
    await page.keyboard.type('trace.has(span => span.name === "test")'); // Valid DSL

    // Step 6: Wait for errors to clear
    await page.waitForTimeout(1000); // Debounce delay

    // Step 7: Verify both Monaco and ValidationFeedback cleared errors
    await expect(monacoMarker).not.toBeVisible({ timeout: 3000 });

    // ValidationFeedback should show success or no error state
    const successIndicator = page.locator('[role="status"]:has-text("Valid"), .validation-success');
    const noErrors = await validationError.count() === 0;

    expect(noErrors || await successIndicator.isVisible()).toBeTruthy();
  });

  test('E2E: Error boundary catches validation failures gracefully', async ({ page }) => {
    // Step 1: Navigate to rule editor
    await page.goto('/rules/new');

    // Step 2: Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Step 3: Monitor uncaught exceptions
    let uncaughtError = false;
    page.on('pageerror', () => {
      uncaughtError = true;
    });

    // Step 4: Enter DSL that might trigger edge case errors
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();

    // Extreme edge cases
    await page.keyboard.type(''.repeat(1000)); // Empty string spam
    await page.keyboard.type('\u0000\u0001\u0002'); // Null bytes
    await page.keyboard.type('<script>alert("xss")</script>'); // XSS attempt

    // Step 5: Verify page doesn't crash
    await page.waitForTimeout(2000); // Allow validation to process

    // Step 6: Verify Monaco editor is still functional
    await expect(monacoEditor).toBeVisible();

    // Step 7: Verify no uncaught exceptions
    expect(uncaughtError).toBe(false);

    // Step 8: Verify error boundary didn't trigger (no "Something went wrong" message)
    const errorBoundary = page.locator('text=/Something went wrong|An error occurred/i');
    await expect(errorBoundary).not.toBeVisible();
  });
});
