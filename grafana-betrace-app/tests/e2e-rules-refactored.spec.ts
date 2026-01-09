/**
 * E2E Tests - Rules Management (Refactored with Page Objects)
 *
 * Tests core rules CRUD operations using page object pattern.
 *
 * NOTE: These tests are skipped until the RulesPage UI matches expectations.
 * The page objects expect features like:
 * - Rule form with name, description, expression inputs
 * - Monaco editor for DSL expressions
 * - Severity dropdown
 * - Enable/disable toggle
 * - Search and filter functionality
 */

import { test, expect } from '@playwright/test';
import { LoginPage, RulesPage, type Rule } from './pages';

// Skip entire test suite - RulesPage UI not fully implemented
test.describe.skip('BeTrace Rules Management (Page Objects)', () => {
  let loginPage: LoginPage;
  let rulesPage: RulesPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    rulesPage = new RulesPage(page);

    // Login and navigate to rules page
    await loginPage.login();
    await rulesPage.navigate();
  });

  test('T1.1 - Rules page loads successfully', async () => {
    await rulesPage.verifyPageLoaded();
  });

  test('T2.2 - Create rule - happy path', async () => {
    const testRule: Rule = {
      name: `E2E Test Rule ${Date.now()}`,
      description: 'Created by E2E test with page objects',
      expression: 'span.duration > 1000000000',
      severity: 'HIGH',
      enabled: true,
    };

    await rulesPage.createRule(testRule);
    await rulesPage.verifyRuleInList(testRule.name);

    // Verify rule details
    const ruleRow = rulesPage.getRuleRow(testRule.name);
    await expect(ruleRow).toContainText('HIGH');
    await expect(ruleRow).toContainText('Enabled');
  });

  test('T2.3 - Create rule - validation errors', async () => {
    await rulesPage.openCreateRuleForm();
    await rulesPage.submitCreateForm();
    await rulesPage.verifyValidationError();
  });

  test('T2.4 - Create rule - invalid DSL expression', async () => {
    const invalidRule: Rule = {
      name: `Invalid Rule ${Date.now()}`,
      description: 'Test invalid expression',
      expression: 'span.duration >',
      severity: 'HIGH',
      enabled: true,
    };

    await rulesPage.createRule(invalidRule);
    await rulesPage.verifyValidationError('syntax error');
  });

  test('T2.5 - Edit rule', async () => {
    const originalRule: Rule = {
      name: `Edit Test ${Date.now()}`,
      description: 'Original description',
      expression: 'span.duration > 1000',
      severity: 'MEDIUM',
      enabled: true,
    };

    await rulesPage.createRule(originalRule);

    const newName = `${originalRule.name} - Updated`;
    await rulesPage.editRule(originalRule.name, { name: newName });

    await rulesPage.verifyRuleInList(newName);
  });

  test('T2.6 - Delete rule', async () => {
    const ruleToDelete: Rule = {
      name: `Delete Test ${Date.now()}`,
      description: 'Will be deleted',
      expression: 'span.status == "error"',
      severity: 'LOW',
      enabled: false,
    };

    await rulesPage.createRule(ruleToDelete);
    await rulesPage.verifyRuleInList(ruleToDelete.name);

    await rulesPage.deleteRule(ruleToDelete.name);
    await rulesPage.verifyRuleDeleted(ruleToDelete.name);
  });

  test('T2.7 - Enable/Disable rule toggle', async () => {
    const toggleRule: Rule = {
      name: `Toggle Test ${Date.now()}`,
      description: 'Test enable/disable',
      expression: 'true',
      severity: 'LOW',
      enabled: true,
    };

    await rulesPage.createRule(toggleRule);
    await rulesPage.verifyRuleStatus(toggleRule.name, 'Enabled');

    await rulesPage.toggleRuleEnabled(toggleRule.name);
    await rulesPage.verifyRuleStatus(toggleRule.name, 'Disabled');

    await rulesPage.toggleRuleEnabled(toggleRule.name);
    await rulesPage.verifyRuleStatus(toggleRule.name, 'Enabled');
  });

  test('T5.1 - Monaco editor loads in rule form', async () => {
    await rulesPage.verifyMonacoLoads();
    await rulesPage.typeInMonaco('span.duration');
  });

  test('T2.8 - Search rules', async ({ page }) => {
    // Create multiple rules with different names
    const rule1: Rule = {
      name: `Search Test Alpha ${Date.now()}`,
      description: 'First rule',
      expression: 'true',
      severity: 'LOW',
      enabled: true,
    };

    const rule2: Rule = {
      name: `Search Test Beta ${Date.now()}`,
      description: 'Second rule',
      expression: 'true',
      severity: 'HIGH',
      enabled: true,
    };

    await rulesPage.createRule(rule1);
    await rulesPage.navigate(); // Refresh
    await rulesPage.createRule(rule2);
    await rulesPage.navigate(); // Refresh

    // Search for "Alpha"
    await rulesPage.searchRules('Alpha');
    await rulesPage.verifyRuleInList(rule1.name);

    // Clear search
    await rulesPage.searchRules('');
    await rulesPage.verifyRuleInList(rule1.name);
    await rulesPage.verifyRuleInList(rule2.name);
  });

  test('T2.9 - Filter by severity', async () => {
    // Create rules with different severities
    const lowRule: Rule = {
      name: `Low Severity ${Date.now()}`,
      description: 'Low severity rule',
      expression: 'true',
      severity: 'LOW',
      enabled: true,
    };

    const highRule: Rule = {
      name: `High Severity ${Date.now()}`,
      description: 'High severity rule',
      expression: 'true',
      severity: 'HIGH',
      enabled: true,
    };

    await rulesPage.createRule(lowRule);
    await rulesPage.navigate();
    await rulesPage.createRule(highRule);
    await rulesPage.navigate();

    // Filter by HIGH
    await rulesPage.filterBySeverity('HIGH');
    await rulesPage.verifyRuleInList(highRule.name);

    // Reset filter
    await rulesPage.filterBySeverity('ALL');
    await rulesPage.verifyRuleInList(lowRule.name);
    await rulesPage.verifyRuleInList(highRule.name);
  });
});
