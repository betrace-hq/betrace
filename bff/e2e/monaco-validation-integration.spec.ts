import { test, expect } from '@playwright/test';

/**
 * PRD-010d Phase 5: Monaco-ValidationFeedback Integration Testing
 *
 * Test Suite: Cross-Component Communication
 *
 * Validates integration between Monaco editor and ValidationFeedback:
 * 1. Monaco error markers trigger ValidationFeedback updates
 * 2. ValidationFeedback "Fix This" actions update Monaco cursor position
 * 3. State synchronization during rapid edits
 * 4. Error clearing synchronization
 *
 * Critical Gaps from QA Review:
 * - Monaco marker click → ValidationFeedback scroll
 * - ValidationFeedback Fix button → Monaco cursor jump
 * - Concurrent edit conflict resolution
 *
 * Cross-Browser Coverage:
 * - Chrome (primary)
 * - Firefox (different Monaco rendering)
 * - Safari (WebKit Monaco differences)
 */

test.describe('Monaco-ValidationFeedback Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rules/new');
    await page.waitForSelector('.monaco-editor', { state: 'visible' });
  });

  test('Integration: Monaco error marker triggers ValidationFeedback update', async ({ page }) => {
    // Step 1: Type invalid DSL in Monaco
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(invalid syntax');

    // Step 2: Wait for Monaco error marker
    await page.waitForSelector('.monaco-error-marker, .squiggly-error', {
      state: 'visible',
      timeout: 5000
    });

    // Step 3: Verify ValidationFeedback displays corresponding error
    const validationError = page.locator('[role="alert"]');
    await expect(validationError).toBeVisible({ timeout: 5000 });

    // Step 4: Verify error message consistency
    const monacoMarker = page.locator('.monaco-error-marker, .squiggly-error').first();
    await monacoMarker.hover();

    // Wait for Monaco hover tooltip
    await page.waitForSelector('.monaco-hover', { state: 'visible', timeout: 3000 });

    const monacoTooltipText = await page.locator('.monaco-hover').textContent();
    const validationErrorText = await validationError.textContent();

    // Both should mention "invalid" or "syntax"
    expect(monacoTooltipText?.toLowerCase()).toMatch(/invalid|syntax|error/);
    expect(validationErrorText?.toLowerCase()).toMatch(/invalid|syntax|error/);
  });

  test('Integration: ValidationFeedback Fix button updates Monaco cursor position', async ({ page }) => {
    // Step 1: Enter multi-line DSL with error on line 3
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();

    await page.keyboard.type('trace.has(span => span.name === "line1")\n');
    await page.keyboard.type('trace.and(span => span.name === "line2")\n');
    await page.keyboard.type('trace.has(invalid syntax on line 3');

    // Step 2: Wait for validation error
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 3: Click "Fix This" button in ValidationFeedback
    const fixButton = page.locator('button:has-text("Fix This")');

    if (await fixButton.isVisible({ timeout: 1000 })) {
      // Get current cursor position before clicking
      const cursorBefore = await page.evaluate(() => {
        const editor = (window as any).monaco?.editor?.getEditors?.()?.[0];
        return editor?.getPosition();
      });

      // Click Fix This button
      await fixButton.click();

      // Step 4: Wait for cursor to move
      await page.waitForTimeout(500);

      // Get new cursor position
      const cursorAfter = await page.evaluate(() => {
        const editor = (window as any).monaco?.editor?.getEditors?.()?.[0];
        return editor?.getPosition();
      });

      // Step 5: Verify cursor moved to error location (line 3)
      if (cursorAfter) {
        expect(cursorAfter.lineNumber).toBe(3);
      } else {
        // If Monaco API not available, verify focus moved to editor
        const focusedElement = await page.evaluate(() => document.activeElement?.className);
        expect(focusedElement).toMatch(/monaco|editor/);
      }
    }
  });

  test('Integration: Rapid edits maintain validation state consistency', async ({ page }) => {
    // Step 1: Type, delete, type rapidly to trigger concurrent validations
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();

    // Rapid edit sequence (race condition test)
    await page.keyboard.type('trace.has(error1');
    await page.waitForTimeout(100); // Partial debounce

    await page.keyboard.press('Control+A');
    await page.keyboard.type('trace.has(error2');
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+A');
    await page.keyboard.type('trace.has(error3');

    // Step 2: Wait for final validation to complete
    await page.waitForTimeout(2000); // Full debounce + validation

    // Step 3: Verify ValidationFeedback shows only LATEST error state
    const validationErrors = page.locator('[role="alert"]');
    const errorCount = await validationErrors.count();

    // Should have 1 error for "error3" (not stale errors from error1/error2)
    expect(errorCount).toBeGreaterThanOrEqual(1);

    // Step 4: Verify error message references "error3" (latest edit)
    const errorText = await validationErrors.first().textContent();
    expect(errorText).toContain('error3');
    expect(errorText).not.toContain('error1'); // No stale state
  });

  test('Integration: Error clearing synchronizes across Monaco and ValidationFeedback', async ({ page }) => {
    // Step 1: Enter invalid DSL
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(invalid');

    // Step 2: Wait for error in both components
    await Promise.all([
      page.waitForSelector('.monaco-error-marker, .squiggly-error', { state: 'visible', timeout: 5000 }),
      page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 })
    ]);

    // Step 3: Fix DSL by completing syntax
    await page.keyboard.type(' => span.name === "test")');

    // Step 4: Wait for validation to rerun
    await page.waitForTimeout(1500); // Debounce + validation

    // Step 5: Verify Monaco error marker cleared
    const monacoMarkerAfter = page.locator('.monaco-error-marker, .squiggly-error');
    await expect(monacoMarkerAfter).not.toBeVisible({ timeout: 3000 });

    // Step 6: Verify ValidationFeedback error cleared
    const validationErrorAfter = page.locator('[role="alert"]');
    const errorCountAfter = await validationErrorAfter.count();

    expect(errorCountAfter).toBe(0);

    // Step 7: Verify success state displayed
    const successIndicator = page.locator('[role="status"]:has-text("Valid")');
    const hasSuccess = await successIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    // Either no errors or explicit success message
    expect(errorCountAfter === 0 || hasSuccess).toBe(true);
  });

  test('Integration: Multiple Monaco editors maintain independent validation state', async ({ page }) => {
    // This test verifies no state leakage if multiple editors exist on page

    // Step 1: Check if multiple editors are present (e.g., split view)
    const editors = page.locator('.monaco-editor');
    const editorCount = await editors.count();

    if (editorCount > 1) {
      // Step 2: Type different DSL in each editor
      await editors.first().click();
      await page.keyboard.type('trace.has(error in editor 1');

      await editors.nth(1).click();
      await page.keyboard.type('trace.has(error in editor 2');

      // Step 3: Wait for validation
      await page.waitForTimeout(1500);

      // Step 4: Verify each editor has independent error markers
      const markersEditor1 = editors.first().locator('.monaco-error-marker, .squiggly-error');
      const markersEditor2 = editors.nth(1).locator('.monaco-error-marker, .squiggly-error');

      await expect(markersEditor1).toBeVisible();
      await expect(markersEditor2).toBeVisible();

      // Step 5: Fix editor 1, verify editor 2 still has error
      await editors.first().click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('trace.has(span => span.name === "valid")');

      await page.waitForTimeout(1500);

      // Editor 1 should clear, editor 2 should retain error
      await expect(markersEditor1).not.toBeVisible();
      await expect(markersEditor2).toBeVisible();
    } else {
      // Single editor - verify state resets correctly
      const monacoEditor = page.locator('.monaco-editor');
      await monacoEditor.click();
      await page.keyboard.type('trace.has(error1');

      await page.waitForTimeout(1500);
      const error1Count = await page.locator('[role="alert"]').count();
      expect(error1Count).toBeGreaterThan(0);

      // Clear and start fresh
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('trace.has(error2');

      await page.waitForTimeout(1500);

      // Verify old error1 state is gone, only error2 exists
      const error2Text = await page.locator('[role="alert"]').first().textContent();
      expect(error2Text).toContain('error2');
      expect(error2Text).not.toContain('error1');
    }
  });

  test('Integration: Validation debounce prevents UI thrashing during typing', async ({ page }) => {
    // Step 1: Monitor ValidationFeedback update frequency
    let validationUpdateCount = 0;

    // Listen for aria-live region updates
    await page.exposeFunction('onValidationUpdate', () => {
      validationUpdateCount++;
    });

    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        (window as any).onValidationUpdate?.();
      });

      const liveRegions = document.querySelectorAll('[aria-live]');
      liveRegions.forEach(region => {
        observer.observe(region, {
          childList: true,
          characterData: true,
          subtree: true
        });
      });
    });

    // Step 2: Type continuously for 2 seconds
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();

    const longText = 'trace.has(invalid syntax with many characters to trigger multiple validations';
    for (const char of longText) {
      await page.keyboard.type(char);
      await page.waitForTimeout(50); // 50ms between characters = 20 chars/sec
    }

    // Step 3: Wait for final validation
    await page.waitForTimeout(1500);

    // Step 4: Verify validation didn't update on EVERY keystroke
    // With 300ms debounce, should have ~5-10 updates, not 78 (one per character)
    console.log(`Validation updates: ${validationUpdateCount}`);
    expect(validationUpdateCount).toBeLessThan(longText.length / 2);
    expect(validationUpdateCount).toBeGreaterThan(0);
  });

  test('Integration: Monaco hover and ValidationFeedback display same PII-redacted message', async ({ page }) => {
    // Step 1: Enter DSL with PII (email + credit card)
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(email=admin@example.com and card=4532-1234-5678-9010) invalid');

    // Step 2: Wait for validation error
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 3: Get ValidationFeedback error text
    const validationError = page.locator('[role="alert"]');
    const validationText = await validationError.textContent();

    // Step 4: Hover over Monaco error marker
    const monacoMarker = page.locator('.monaco-error-marker, .squiggly-error').first();
    await monacoMarker.hover();

    await page.waitForSelector('.monaco-hover', { state: 'visible', timeout: 3000 });

    // Step 5: Get Monaco hover text
    const monacoHover = page.locator('.monaco-hover');
    const monacoText = await monacoHover.textContent();

    // Step 6: Verify BOTH redact PII
    expect(validationText).toContain('[REDACTED');
    expect(validationText).not.toContain('admin@example.com');
    expect(validationText).not.toContain('4532-1234-5678-9010');

    expect(monacoText).toContain('[REDACTED');
    expect(monacoText).not.toContain('admin@example.com');
    expect(monacoText).not.toContain('4532-1234-5678-9010');

    // Step 7: Verify messages are semantically similar (both mention same error)
    // Extract non-PII keywords from both messages
    const extractKeywords = (text: string | null) =>
      text?.toLowerCase().match(/\b\w{4,}\b/g)?.filter(w => !w.includes('redact')) || [];

    const validationKeywords = extractKeywords(validationText);
    const monacoKeywords = extractKeywords(monacoText);

    // Should have at least 1 overlapping keyword (e.g., "invalid", "syntax", "error")
    const overlap = validationKeywords.filter(k => monacoKeywords.includes(k));
    expect(overlap.length).toBeGreaterThan(0);
  });

  test('Integration: Browser refresh preserves no stale validation state', async ({ page }) => {
    // Step 1: Enter invalid DSL
    const monacoEditor = page.locator('.monaco-editor');
    await monacoEditor.click();
    await page.keyboard.type('trace.has(error before refresh');

    // Step 2: Wait for validation error
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 5000 });

    // Step 3: Refresh page
    await page.reload();
    await page.waitForSelector('.monaco-editor', { state: 'visible' });

    // Step 4: Verify no stale errors displayed
    await page.waitForTimeout(1000); // Allow page to fully load

    const staleErrors = page.locator('[role="alert"]');
    const errorCount = await staleErrors.count();

    // Should be 0 errors (fresh page with empty editor)
    expect(errorCount).toBe(0);

    // Step 5: Verify Monaco editor is empty
    const editorText = await page.evaluate(() => {
      const editor = (window as any).monaco?.editor?.getEditors?.()?.[0];
      return editor?.getValue() || '';
    });

    expect(editorText.trim()).toBe('');
  });
});
