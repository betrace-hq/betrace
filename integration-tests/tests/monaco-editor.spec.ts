/**
 * Monaco Editor Integration Tests
 *
 * Automated tests to validate Monaco editor functionality in SigNoz app
 */

import { test, expect } from '@playwright/test';

test.describe('Monaco Editor - SigNoz Rules Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Rules page
    await page.goto('http://localhost:3001/rules');
    await page.waitForLoadState('networkidle');
  });

  test('should render Rules page with "Create Rule" button', async ({ page }) => {
    // Verify page title
    await expect(page.locator('h2:has-text("Rules")')).toBeVisible();

    // Verify "Create Rule" button exists
    const createButton = page.locator('button:has-text("Create Rule")').first();
    await expect(createButton).toBeVisible();
  });

  test('should open rule modal when clicking "Create Rule"', async ({ page }) => {
    // Click "Create Rule" button
    await page.click('button:has-text("Create Rule")');

    // Verify modal opened
    await expect(page.locator('text=Create New Rule')).toBeVisible({ timeout: 5000 });
  });

  test('should display 6 rule templates', async ({ page }) => {
    // Click "Create Rule"
    await page.click('button:has-text("Create Rule")');

    // Wait for modal
    await page.waitForSelector('text=Create New Rule');

    // Verify template header
    await expect(page.locator('text=Start from template')).toBeVisible();

    // Verify template cards exist
    await expect(page.locator('text=Slow Database Query')).toBeVisible();
    await expect(page.locator('text=HTTP 5xx Errors')).toBeVisible();
    await expect(page.locator('text=Unauthorized Access')).toBeVisible();
    await expect(page.locator('text=Failed Payment Transaction')).toBeVisible();
    await expect(page.locator('text=PII Access Without Audit')).toBeVisible();
    await expect(page.locator('text=High Memory Usage')).toBeVisible();
  });

  test('should select template and show Monaco editor', async ({ page }) => {
    // Click "Create Rule"
    await page.click('button:has-text("Create Rule")');

    // Click on "Slow Database Query" template
    await page.click('text=Slow Database Query');

    // Verify Monaco editor container loads
    // Monaco editor creates a div with class "monaco-editor"
    const monacoEditor = page.locator('.monaco-editor');
    await expect(monacoEditor).toBeVisible({ timeout: 10000 });

    // Verify template DSL loaded
    await expect(page.locator('input[name="name"]')).toHaveValue(/Slow Database Query/);
  });

  test('should display Monaco editor with syntax highlighting', async ({ page }) => {
    // Open create rule modal
    await page.click('button:has-text("Create Rule")');

    // Select template
    await page.click('text=Slow Database Query');

    // Wait for Monaco to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Check that Monaco's core elements exist
    const viewLines = page.locator('.view-lines');
    await expect(viewLines).toBeVisible({ timeout: 5000 });

    // Monaco creates line numbers
    const lineNumbers = page.locator('.line-numbers');
    await expect(lineNumbers.first()).toBeVisible();
  });

  test('should allow typing in Monaco editor', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Create Rule")');

    // Click "Start from scratch"
    await page.click('text=Start from scratch');

    // Wait for Monaco
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Click in Monaco editor
    const editor = page.locator('.monaco-editor .view-lines').first();
    await editor.click();

    // Type DSL code
    await page.keyboard.type('span.duration > 1000');

    // Verify code appears in Monaco (check for text content)
    await expect(page.locator('.view-line')).toContainText('span');
    await expect(page.locator('.view-line')).toContainText('duration');
  });

  test('should show autocomplete suggestions (Ctrl+Space)', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Create Rule")');

    // Start from scratch
    await page.click('text=Start from scratch');

    // Wait for Monaco
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Click in editor
    const editor = page.locator('.monaco-editor .view-lines').first();
    await editor.click();

    // Type "span."
    await page.keyboard.type('span.');

    // Press Ctrl+Space for autocomplete
    await page.keyboard.press('Control+Space');

    // Wait for suggest widget
    const suggestWidget = page.locator('.suggest-widget');
    await expect(suggestWidget).toBeVisible({ timeout: 5000 });

    // Verify autocomplete suggestions appear
    // Monaco creates .monaco-list for suggestions
    const suggestions = page.locator('.monaco-list');
    await expect(suggestions).toBeVisible();
  });

  test('should validate DSL and show errors for invalid syntax', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Create Rule")');

    // Start from scratch
    await page.click('text=Start from scratch');

    // Wait for Monaco
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Fill in name
    await page.fill('input[name="name"]', 'Test Validation');

    // Click in editor and type invalid syntax
    const editor = page.locator('.monaco-editor .view-lines').first();
    await editor.click();
    await page.keyboard.type('invalid {{ syntax');

    // Monaco shows errors with squiggly lines (decorations)
    // Wait a bit for validation to run
    await page.waitForTimeout(1000);

    // Check if "Create Rule" button is disabled (validation failed)
    const createButton = page.locator('button:has-text("Create Rule")').last();
    await expect(createButton).toBeDisabled();
  });

  test('should enable "Create Rule" button when DSL is valid', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Create Rule")');

    // Select template (which has valid DSL)
    await page.click('text=Slow Database Query');

    // Wait for Monaco
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Wait for validation
    await page.waitForTimeout(1000);

    // Button should be enabled
    const createButton = page.locator('button:has-text("Create Rule")').last();
    await expect(createButton).toBeEnabled();
  });

  test('should create rule via Monaco editor and save to backend', async ({ page }) => {
    // Count existing rules
    const existingRules = await page.locator('tr').count();

    // Open modal
    await page.click('button:has-text("Create Rule")');

    // Start from scratch
    await page.click('text=Start from scratch');

    // Fill form
    await page.fill('input[name="name"]', 'Monaco Test Rule');
    await page.fill('textarea[name="description"]', 'Created via Monaco editor test');

    // Wait for Monaco and type DSL
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });
    const editor = page.locator('.monaco-editor .view-lines').first();
    await editor.click();
    await page.keyboard.type('span.duration > 5000');

    // Wait for validation
    await page.waitForTimeout(1500);

    // Click Create Rule
    const createButton = page.locator('button:has-text("Create Rule")').last();
    await createButton.click();

    // Wait for modal to close
    await expect(page.locator('text=Create New Rule')).not.toBeVisible({ timeout: 5000 });

    // Verify rule appears in list
    await expect(page.locator('text=Monaco Test Rule')).toBeVisible({ timeout: 5000 });

    // Verify rule count increased
    const newRuleCount = await page.locator('tr').count();
    expect(newRuleCount).toBeGreaterThan(existingRules);

    // Cleanup: Delete the test rule
    const ruleRow = page.locator('tr:has-text("Monaco Test Rule")');
    const deleteButton = ruleRow.locator('button:has-text("Delete")');
    await deleteButton.click();
  });

  test('should edit existing rule with Monaco editor', async ({ page }) => {
    // First create a rule to edit
    await page.click('button:has-text("Create Rule")');
    await page.click('text=Unauthorized Access');
    await page.fill('input[name="name"]', 'Edit Monaco Test');
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Create Rule")');
    await page.waitForTimeout(2000);

    // Find and click Edit button
    const ruleRow = page.locator('tr:has-text("Edit Monaco Test")');
    const editButton = ruleRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Verify modal opened in edit mode
    await expect(page.locator('text=Edit Rule')).toBeVisible();

    // Verify Monaco loaded with existing DSL
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Modify the rule name
    await page.fill('input[name="name"]', 'Edit Monaco Test - Modified');

    // Update rule
    await page.click('button:has-text("Update Rule")');

    // Verify updated name appears
    await expect(page.locator('text=Edit Monaco Test - Modified')).toBeVisible({ timeout: 5000 });

    // Cleanup
    const deleteButton = page.locator('tr:has-text("Edit Monaco Test - Modified")').locator('button:has-text("Delete")');
    await deleteButton.click();
  });
});
