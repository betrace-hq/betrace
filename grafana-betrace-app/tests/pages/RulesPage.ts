/**
 * RulesPage - BeTrace rules management page object
 *
 * Provides methods for interacting with the rules management UI.
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface Rule {
  name: string;
  description: string;
  expression: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
}

export class RulesPage extends BasePage {
  // Locators
  readonly createRuleButton: Locator;
  readonly rulesTable: Locator;
  readonly searchInput: Locator;
  readonly severityFilter: Locator;

  constructor(page: Page) {
    super(page);

    this.createRuleButton = page.locator('button:has-text("Create Rule")');
    this.rulesTable = page.locator('table, [role="grid"], .rules-list').first();
    this.searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
    this.severityFilter = page.locator('select:has-text("Severity"), [aria-label*="Severity"]');
  }

  /**
   * Navigate to rules page
   */
  async navigate() {
    await this.goto('/a/betrace-app');

    // Try to find and click Rules link
    const rulesLink = this.page.locator('a:has-text("Rules")').first();
    if (await rulesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await rulesLink.click();
      await this.page.waitForLoadState('networkidle');
    } else {
      // Direct navigation if link not found
      await this.goto('/a/betrace-app/rules');
    }
  }

  /**
   * Verify page loaded
   */
  async verifyPageLoaded() {
    await expect(this.page.locator('h1, h2').filter({ hasText: 'Rules' })).toBeVisible();
    await expect(this.createRuleButton).toBeVisible();
    await expect(this.rulesTable).toBeVisible({ timeout: 10000 });
  }

  /**
   * Open create rule form
   */
  async openCreateRuleForm() {
    await this.createRuleButton.click();
    await this.page.waitForTimeout(500);
    await expect(this.page.locator('input[name="name"]')).toBeVisible();
  }

  /**
   * Fill rule form
   */
  async fillRuleForm(rule: Rule) {
    await this.page.fill('input[name="name"]', rule.name);
    await this.page.fill('input[name="description"]', rule.description);

    // Handle Monaco editor for expression
    await this.fillMonacoEditor(rule.expression);

    // Select severity
    await this.page.selectOption('select[name="severity"]', rule.severity);

    // Set enabled status
    const enabledCheckbox = this.page.locator('input[name="enabled"]');
    const isChecked = await enabledCheckbox.isChecked().catch(() => false);

    if (rule.enabled && !isChecked) {
      await enabledCheckbox.check();
    } else if (!rule.enabled && isChecked) {
      await enabledCheckbox.uncheck();
    }
  }

  /**
   * Fill Monaco editor with expression
   */
  async fillMonacoEditor(expression: string) {
    const monacoEditor = this.page.locator('.monaco-editor').first();

    if (await monacoEditor.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Monaco editor found - click and type
      await monacoEditor.click();
      await this.page.keyboard.type(expression);
    } else {
      // Fallback to textarea if Monaco doesn't load
      const expressionInput = this.page.locator('textarea[name="expression"]');
      if (await expressionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expressionInput.fill(expression);
      }
    }
  }

  /**
   * Submit create rule form
   */
  async submitCreateForm() {
    await this.page.click('button:has-text("Create")');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Create a rule (complete workflow)
   */
  async createRule(rule: Rule) {
    await this.openCreateRuleForm();
    await this.fillRuleForm(rule);
    await this.submitCreateForm();
  }

  /**
   * Verify rule exists in list
   */
  async verifyRuleInList(name: string) {
    await expect(this.page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Find rule row by name
   */
  getRuleRow(name: string): Locator {
    return this.page.locator(`tr:has-text("${name}")`).first();
  }

  /**
   * Edit a rule
   */
  async editRule(currentName: string, updates: Partial<Rule>) {
    const ruleRow = this.getRuleRow(currentName);
    await ruleRow.locator('button:has-text("Edit")').click();

    await expect(this.page.locator('input[name="name"]')).toBeVisible();

    if (updates.name) {
      await this.page.fill('input[name="name"]', updates.name);
    }

    if (updates.description) {
      await this.page.fill('input[name="description"]', updates.description);
    }

    if (updates.expression) {
      await this.fillMonacoEditor(updates.expression);
    }

    if (updates.severity) {
      await this.page.selectOption('select[name="severity"]', updates.severity);
    }

    if (updates.enabled !== undefined) {
      const enabledCheckbox = this.page.locator('input[name="enabled"]');
      if (updates.enabled) {
        await enabledCheckbox.check();
      } else {
        await enabledCheckbox.uncheck();
      }
    }

    await this.page.click('button:has-text("Save")');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Delete a rule
   */
  async deleteRule(name: string) {
    const ruleRow = this.getRuleRow(name);
    await ruleRow.locator('button:has-text("Delete")').click();

    // Handle confirmation modal if it appears
    const confirmButton = this.page
      .locator('button:has-text("Confirm"), button:has-text("Delete")')
      .last();

    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify rule deleted
   */
  async verifyRuleDeleted(name: string) {
    await expect(this.page.locator(`text=${name}`)).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Toggle rule enabled/disabled
   */
  async toggleRuleEnabled(name: string) {
    const ruleRow = this.getRuleRow(name);

    // Look for toggle button or switch
    const toggleButton = ruleRow
      .locator('button, input[type="checkbox"]')
      .filter({ hasText: /Enable|Disable/i })
      .or(ruleRow.locator('[role="switch"]'));

    await toggleButton.first().click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify rule status
   */
  async verifyRuleStatus(name: string, status: 'Enabled' | 'Disabled') {
    const ruleRow = this.getRuleRow(name);
    await expect(ruleRow).toContainText(status, { timeout: 5000 });
  }

  /**
   * Search for rules
   */
  async searchRules(query: string) {
    if (await this.searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.searchInput.fill(query);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Filter by severity
   */
  async filterBySeverity(severity: string) {
    if (await this.severityFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.severityFilter.selectOption(severity);
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Get rule count
   */
  async getRuleCount(): Promise<number> {
    const rows = await this.rulesTable.locator('tbody tr').count();
    return rows;
  }

  /**
   * Verify Monaco editor loads
   */
  async verifyMonacoLoads() {
    await this.openCreateRuleForm();
    const monacoEditor = this.page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 10000 });
  }

  /**
   * Type in Monaco and verify
   */
  async typeInMonaco(text: string) {
    const monacoEditor = this.page.locator('.monaco-editor').first();
    await monacoEditor.click();
    await this.page.keyboard.type(text);
    await expect(monacoEditor).toContainText(text);
  }

  /**
   * Verify validation error appears
   */
  async verifyValidationError(errorText?: string) {
    const errorLocator = errorText
      ? this.page.locator(`text=${errorText}`)
      : this.page.locator('text=/required|invalid|error/i');

    await expect(errorLocator).toBeVisible({ timeout: 5000 });
  }
}
