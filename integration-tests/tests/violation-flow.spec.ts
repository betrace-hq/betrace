/**
 * Violation Flow Integration Tests
 *
 * Tests the complete flow of violations:
 * 1. Create rule that will trigger violations
 * 2. Send trace data that matches rule
 * 3. Verify violation span created in Tempo
 * 4. Query violations via backend API
 * 5. View violations in Grafana UI
 * 6. Export violations to CSV/JSON
 */

import { test, expect } from '@playwright/test';
import backend from '../utils/backend';
import { createTestRule, generateTraceId, generateSpanId, wait, retry } from '../utils/fixtures';
import config from '../utils/config';
import axios from 'axios';

let createdRuleIds: string[] = [];
let testTraceIds: string[] = [];

test.beforeEach(async () => {
  createdRuleIds = [];
  testTraceIds = [];
});

test.afterEach(async () => {
  // Cleanup rules
  for (const id of createdRuleIds) {
    try {
      await backend.deleteRule(id);
    } catch (error) {
      console.log(`Failed to delete rule ${id}:`, error);
    }
  }
  createdRuleIds = [];
  testTraceIds = [];
});

test.describe('Violation Flow - Backend API', () => {
  test('should create violation when rule matches trace', async () => {
    // Create rule that matches slow queries
    const rule = await backend.createRule(
      createTestRule({
        name: 'Slow Query Detection',
        dsl: 'span.duration > 1000 AND span.attributes["db.system"] EXISTS',
      })
    );
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Send trace with slow query
    const traceId = generateTraceId();
    testTraceIds.push(traceId);

    await sendTraceToTempo({
      traceId,
      spanId: generateSpanId(),
      service: 'test-service',
      operation: 'db.query',
      duration: 1500,  // 1.5 seconds (triggers rule)
      attributes: {
        'db.system': 'postgresql',
        'db.statement': 'SELECT * FROM users',
      },
    });

    // Wait for backend to process trace and generate violation
    await wait(3000);

    // Query violations for this rule
    const violations = await retry(async () => {
      const results = await backend.listViolations({ ruleId: rule.id });
      expect(results.length).toBeGreaterThan(0);
      return results;
    });

    // Verify violation details
    const violation = violations[0];
    expect(violation.ruleId).toBe(rule.id);
    expect(violation.traceId).toBe(traceId);
    expect(violation.severity).toBeDefined();
  });

  test('should not create violation when rule does not match', async () => {
    // Create rule for unauthorized access
    const rule = await backend.createRule(
      createTestRule({
        name: 'Unauthorized Access',
        dsl: 'span.attributes["http.status_code"] == 401',
      })
    );
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Send trace with successful request (200)
    const traceId = generateTraceId();
    testTraceIds.push(traceId);

    await sendTraceToTempo({
      traceId,
      spanId: generateSpanId(),
      service: 'api-service',
      operation: 'GET /users',
      duration: 100,
      attributes: {
        'http.method': 'GET',
        'http.status_code': 200,  // Does NOT match rule (expects 401)
      },
    });

    // Wait for backend processing
    await wait(3000);

    // Verify no violations created
    const violations = await backend.listViolations({ ruleId: rule.id });
    expect(violations.length).toBe(0);
  });

  test('should query violations by trace ID', async () => {
    const rule = await backend.createRule(
      createTestRule({
        dsl: 'span.attributes["test.violation"] == true',
      })
    );
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Send trace that triggers violation
    const traceId = generateTraceId();
    testTraceIds.push(traceId);

    await sendTraceToTempo({
      traceId,
      spanId: generateSpanId(),
      service: 'test-service',
      operation: 'test-operation',
      duration: 100,
      attributes: {
        'test.violation': 'true',
      },
    });

    await wait(3000);

    // Query violations by trace ID
    const violations = await retry(async () => {
      const results = await backend.listViolations({ traceId });
      expect(results.length).toBeGreaterThan(0);
      return results;
    });

    expect(violations[0].traceId).toBe(traceId);
  });

  test('should query violations by time range', async () => {
    const rule = await backend.createRule(
      createTestRule({
        dsl: 'span.attributes["test.time_range"] == true',
      })
    );
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    const now = new Date();
    const startTime = new Date(now.getTime() - 60000).toISOString();  // 1 minute ago
    const endTime = new Date(now.getTime() + 60000).toISOString();    // 1 minute from now

    // Send trace
    const traceId = generateTraceId();
    testTraceIds.push(traceId);

    await sendTraceToTempo({
      traceId,
      spanId: generateSpanId(),
      service: 'test-service',
      operation: 'test-operation',
      duration: 100,
      timestamp: now.getTime() * 1000000,  // Convert to nanoseconds
      attributes: {
        'test.time_range': 'true',
      },
    });

    await wait(3000);

    // Query violations within time range
    const violations = await retry(async () => {
      const results = await backend.listViolations({ startTime, endTime });
      const matchingViolations = results.filter(v => v.ruleId === rule.id);
      expect(matchingViolations.length).toBeGreaterThan(0);
      return matchingViolations;
    });

    expect(violations.length).toBeGreaterThan(0);
  });

  test('should handle multiple violations for same rule', async () => {
    const rule = await backend.createRule(
      createTestRule({
        dsl: 'span.attributes["error"] == true',
      })
    );
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Send 3 traces that trigger violations
    const traceIds = [generateTraceId(), generateTraceId(), generateTraceId()];
    testTraceIds.push(...traceIds);

    for (const traceId of traceIds) {
      await sendTraceToTempo({
        traceId,
        spanId: generateSpanId(),
        service: 'error-service',
        operation: 'error-operation',
        duration: 100,
        attributes: {
          'error': 'true',
        },
      });
    }

    await wait(4000);

    // Query violations for this rule
    const violations = await retry(async () => {
      const results = await backend.listViolations({ ruleId: rule.id });
      expect(results.length).toBeGreaterThanOrEqual(3);
      return results;
    });

    // Verify all trace IDs present
    const violationTraceIds = violations.map(v => v.traceId);
    for (const traceId of traceIds) {
      expect(violationTraceIds).toContain(traceId);
    }
  });
});

test.describe('Violation Flow - SigNoz UI', () => {
  test('should display violations in SigNoz UI', async ({ page }) => {
    // Create rule
    const rule = await backend.createRule(
      createTestRule({
        name: 'UI Violation Test',
        dsl: 'span.attributes["show.in.ui"] == true',
      })
    );
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Trigger violation
    const traceId = generateTraceId();
    testTraceIds.push(traceId);

    await sendTraceToTempo({
      traceId,
      spanId: generateSpanId(),
      service: 'ui-test-service',
      operation: 'ui-test-operation',
      duration: 100,
      attributes: {
        'show.in.ui': 'true',
      },
    });

    await wait(3000);

    // Navigate to violations page in SigNoz
    await page.goto(`${config.signoz}/violations`);
    await page.waitForLoadState('networkidle');

    // Verify violation appears
    await retry(async () => {
      await page.reload();
      await expect(page.locator(`text=${rule.name}`)).toBeVisible();
    });

    // Click on violation to see details
    await page.click(`text=${rule.name}`);
    await expect(page.locator(`text=${traceId}`)).toBeVisible();
  });

  test('should filter violations by rule', async ({ page }) => {
    // Create two rules
    const rule1 = await backend.createRule(
      createTestRule({ name: 'Filter Test Rule 1', dsl: 'span.attributes["rule1"] == true' })
    );
    const rule2 = await backend.createRule(
      createTestRule({ name: 'Filter Test Rule 2', dsl: 'span.attributes["rule2"] == true' })
    );
    createdRuleIds.push(rule1.id, rule2.id);
    await backend.waitForSync();

    // Trigger violations for both rules
    await sendTraceToTempo({
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      service: 'test',
      operation: 'test',
      duration: 100,
      attributes: { 'rule1': 'true' },
    });

    await sendTraceToTempo({
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      service: 'test',
      operation: 'test',
      duration: 100,
      attributes: { 'rule2': 'true' },
    });

    await wait(3000);

    // Navigate to violations page
    await page.goto(`${config.signoz}/violations`);
    await page.waitForLoadState('networkidle');

    // Filter by rule1
    await page.selectOption('select[name="ruleFilter"]', rule1.id);
    await wait(1000);

    // Verify only rule1 violations shown
    await expect(page.locator(`text=${rule1.name}`)).toBeVisible();
    await expect(page.locator(`text=${rule2.name}`)).not.toBeVisible();
  });
});

test.describe('Violation Flow - Grafana UI', () => {
  test.skip('should display violations in Grafana (pending Grafana startup)', async ({ page }) => {
    // Skip until Grafana is fully started
  });

  test.skip('should link violation to trace in Grafana', async ({ page }) => {
    // Skip until Grafana is fully started
  });
});

test.describe('Violation Flow - Export', () => {
  test('should export violations as JSON', async () => {
    const rule = await backend.createRule(
      createTestRule({ dsl: 'span.attributes["export.test"] == true' })
    );
    createdRuleIds.push(rule.id);
    await backend.waitForSync();

    // Trigger violation
    await sendTraceToTempo({
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      service: 'export-test',
      operation: 'export-test',
      duration: 100,
      attributes: { 'export.test': 'true' },
    });

    await wait(3000);

    // Export violations
    const response = await axios.get(
      `${config.backend}${config.api.violations}/export`,
      {
        params: { ruleId: rule.id, format: 'json' },
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThan(0);
  });
});

/**
 * Helper: Send trace data to Tempo via OTLP
 */
async function sendTraceToTempo(trace: {
  traceId: string;
  spanId: string;
  service: string;
  operation: string;
  duration: number;
  timestamp?: number;
  attributes?: Record<string, string>;
}): Promise<void> {
  const now = trace.timestamp || Date.now() * 1000000;  // nanoseconds

  const otlpPayload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            {
              key: 'service.name',
              value: { stringValue: trace.service },
            },
          ],
        },
        scopeSpans: [
          {
            spans: [
              {
                traceId: Buffer.from(trace.traceId, 'hex').toString('base64'),
                spanId: Buffer.from(trace.spanId, 'hex').toString('base64'),
                name: trace.operation,
                kind: 1,  // SPAN_KIND_INTERNAL
                startTimeUnixNano: now.toString(),
                endTimeUnixNano: (now + trace.duration * 1000000).toString(),
                attributes: Object.entries(trace.attributes || {}).map(([key, value]) => ({
                  key,
                  value: { stringValue: value },
                })),
                status: { code: 1 },  // STATUS_CODE_OK
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    await axios.post(`${config.tempo}/v1/traces`, otlpPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Failed to send trace to Tempo:', error);
    throw error;
  }
}
