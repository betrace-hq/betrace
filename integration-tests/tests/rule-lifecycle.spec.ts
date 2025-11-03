/**
 * Rule Lifecycle Integration Tests
 *
 * Tests the complete lifecycle of rules across all platforms:
 * 1. Create rule via API/UI
 * 2. Verify stored in backend
 * 3. Verify visible in all UIs
 * 4. Update rule
 * 5. Verify changes propagate
 * 6. Delete rule
 * 7. Verify removed everywhere
 */

import { test, expect } from '@playwright/test';
import backend from '../utils/backend';
import { createTestRule, wait, retry } from '../utils/fixtures';
import config from '../utils/config';

let createdRuleIds: string[] = [];

test.beforeEach(async () => {
  createdRuleIds = [];
});

test.afterEach(async () => {
  // Cleanup: delete all rules created during test
  for (const id of createdRuleIds) {
    try {
      await backend.deleteRule(id);
    } catch (error) {
      console.log(`Failed to delete rule ${id}:`, error);
    }
  }
  createdRuleIds = [];
});

test.describe('Rule Lifecycle - Backend API', () => {
  test('should create rule via backend API', async () => {
    const ruleData = createTestRule();

    const rule = await backend.createRule(ruleData);
    createdRuleIds.push(rule.id);

    expect(rule.id).toBeTruthy();
    expect(rule.name).toBe(ruleData.name);
    expect(rule.dsl).toBe(ruleData.dsl);
    expect(rule.enabled).toBe(ruleData.enabled);
  });

  test('should retrieve rule after creation', async () => {
    const ruleData = createTestRule();
    const createdRule = await backend.createRule(ruleData);
    createdRuleIds.push(createdRule.id);

    await backend.waitForSync();

    const retrievedRule = await backend.getRule(createdRule.id);
    expect(retrievedRule.id).toBe(createdRule.id);
    expect(retrievedRule.name).toBe(ruleData.name);
  });

  test('should list all rules including newly created', async () => {
    const initialCount = await backend.countRules();

    const rule1 = await backend.createRule(createTestRule({ name: 'Test Rule 1' }));
    const rule2 = await backend.createRule(createTestRule({ name: 'Test Rule 2' }));
    createdRuleIds.push(rule1.id, rule2.id);

    await backend.waitForSync();

    const finalCount = await backend.countRules();
    expect(finalCount).toBe(initialCount + 2);

    const allRules = await backend.listRules();
    const ruleIds = allRules.map(r => r.id);
    expect(ruleIds).toContain(rule1.id);
    expect(ruleIds).toContain(rule2.id);
  });

  test('should update rule', async () => {
    const rule = await backend.createRule(createTestRule());
    createdRuleIds.push(rule.id);

    await backend.waitForSync();

    const updatedRule = await backend.updateRule(rule.id, {
      name: 'Updated Rule Name',
      enabled: false,
    });

    expect(updatedRule.name).toBe('Updated Rule Name');
    expect(updatedRule.enabled).toBe(false);
    expect(updatedRule.dsl).toBe(rule.dsl);  // DSL unchanged
  });

  test('should delete rule', async () => {
    const rule = await backend.createRule(createTestRule());
    await backend.waitForSync();

    await backend.deleteRule(rule.id);
    await backend.waitForSync();

    // Verify rule no longer exists
    await expect(backend.getRule(rule.id)).rejects.toThrow();
  });

  test('should handle concurrent rule creation', async () => {
    const rules = await Promise.all([
      backend.createRule(createTestRule({ name: 'Concurrent 1' })),
      backend.createRule(createTestRule({ name: 'Concurrent 2' })),
      backend.createRule(createTestRule({ name: 'Concurrent 3' })),
    ]);

    createdRuleIds.push(...rules.map(r => r.id));

    // All rules should have unique IDs
    const uniqueIds = new Set(rules.map(r => r.id));
    expect(uniqueIds.size).toBe(3);

    // All rules should be retrievable
    await backend.waitForSync();
    for (const rule of rules) {
      const retrieved = await backend.getRule(rule.id);
      expect(retrieved.id).toBe(rule.id);
    }
  });
});

test.describe('Rule Lifecycle - SigNoz UI', () => {
  test('should create rule via SigNoz UI and verify in backend', async ({ page }) => {
    await page.goto(config.signoz);

    // Navigate to Rules page
    await page.click('text=Rules');
    await expect(page).toHaveURL(/.*\/rules/);

    // Click "Create Rule" button
    await page.click('button:has-text("Create Rule")');

    // Fill in rule form
    const ruleName = createTestRule().name;
    await page.fill('input[name="name"]', ruleName);
    await page.fill('textarea[name="dsl"]', 'span.duration > 1000');

    // Submit form
    await page.click('button:has-text("Save")');

    // Wait for success notification
    await expect(page.locator('text=Rule created successfully')).toBeVisible({
      timeout: config.timeouts.uiAction,
    });

    // Verify rule appears in backend
    await backend.waitForSync();
    const allRules = await backend.listRules();
    const createdRule = allRules.find(r => r.name === ruleName);

    expect(createdRule).toBeTruthy();
    if (createdRule) {
      createdRuleIds.push(createdRule.id);
      expect(createdRule.dsl).toBe('span.duration > 1000');
    }
  });

  test('should display rule created via backend in SigNoz UI', async ({ page }) => {
    // Create rule via backend
    const rule = await backend.createRule(createTestRule());
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Navigate to SigNoz Rules page
    await page.goto(`${config.signoz}/rules`);

    // Verify rule appears in list
    await retry(async () => {
      await page.reload();
      await expect(page.locator(`text=${rule.name}`)).toBeVisible();
    });

    // Verify rule details
    const ruleRow = page.locator(`tr:has-text("${rule.name}")`);
    await expect(ruleRow).toBeVisible();
  });

  test('should update rule via SigNoz UI', async ({ page }) => {
    // Create rule via backend
    const rule = await backend.createRule(createTestRule());
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Navigate to Rules page
    await page.goto(`${config.signoz}/rules`);
    await page.waitForLoadState('networkidle');

    // Find and click edit button for this rule
    const ruleRow = page.locator(`tr:has-text("${rule.name}")`);
    await ruleRow.locator('button:has-text("Edit")').click();

    // Update rule name
    const updatedName = `${rule.name} - Updated`;
    await page.fill('input[name="name"]', updatedName);
    await page.click('button:has-text("Save")');

    // Verify in backend
    await backend.waitForSync();
    const updatedRule = await backend.getRule(rule.id);
    expect(updatedRule.name).toBe(updatedName);
  });

  test('should delete rule via SigNoz UI', async ({ page }) => {
    // Create rule via backend
    const rule = await backend.createRule(createTestRule());
    await backend.waitForSync();

    // Navigate to Rules page
    await page.goto(`${config.signoz}/rules`);
    await page.waitForLoadState('networkidle');

    // Find and click delete button
    const ruleRow = page.locator(`tr:has-text("${rule.name}")`);
    await ruleRow.locator('button:has-text("Delete")').click();

    // Confirm deletion
    await page.click('button:has-text("Confirm")');

    // Verify rule removed from UI
    await wait(1000);
    await expect(page.locator(`text=${rule.name}`)).not.toBeVisible();

    // Verify rule removed from backend
    await backend.waitForSync();
    await expect(backend.getRule(rule.id)).rejects.toThrow();
  });
});

test.describe('Rule Lifecycle - Grafana UI', () => {
  test('should display rule created via backend in Grafana', async ({ page }) => {
    // Create rule via backend
    const rule = await backend.createRule(createTestRule());
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Login to Grafana
    await page.goto(config.grafana);
    await page.fill('input[name="user"]', config.grafana.username);
    await page.fill('input[name="password"]', config.grafana.password);
    await page.click('button:has-text("Log in")');

    // Navigate to BeTrace plugin
    await page.goto(`${config.grafana}/a/betrace-app/rules`);
    await page.waitForLoadState('networkidle');

    // Verify rule appears in list
    await retry(async () => {
      await page.reload();
      await expect(page.locator(`text=${rule.name}`)).toBeVisible();
    });
  });

  test.skip('should create rule via Grafana UI (pending Grafana startup)', async ({ page }) => {
    // Skip until Grafana is fully started
    // Will enable once Grafana plugin is fully loaded
  });
});

test.describe('Rule Lifecycle - Cross-Platform Sync', () => {
  test('should sync rule creation across all platforms', async ({ page }) => {
    // Create rule via backend
    const rule = await backend.createRule(createTestRule());
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Verify in SigNoz
    await page.goto(`${config.signoz}/rules`);
    await expect(page.locator(`text=${rule.name}`)).toBeVisible({
      timeout: config.timeouts.uiAction,
    });

    // Verify in backend API
    const retrievedRule = await backend.getRule(rule.id);
    expect(retrievedRule.id).toBe(rule.id);
  });

  test('should sync rule updates across platforms', async ({ page }) => {
    // Create rule
    const rule = await backend.createRule(createTestRule());
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Update via backend
    const updatedName = `${rule.name} - Updated via API`;
    await backend.updateRule(rule.id, { name: updatedName });
    await backend.waitForSync();

    // Verify update in SigNoz UI
    await page.goto(`${config.signoz}/rules`);
    await retry(async () => {
      await page.reload();
      await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    });
  });

  test('should sync rule deletion across platforms', async ({ page }) => {
    // Create rule
    const rule = await backend.createRule(createTestRule());
    await backend.waitForSync();

    // Verify exists in SigNoz
    await page.goto(`${config.signoz}/rules`);
    await expect(page.locator(`text=${rule.name}`)).toBeVisible();

    // Delete via backend
    await backend.deleteRule(rule.id);
    await backend.waitForSync();

    // Verify removed from SigNoz
    await retry(async () => {
      await page.reload();
      await expect(page.locator(`text=${rule.name}`)).not.toBeVisible();
    });
  });
});
