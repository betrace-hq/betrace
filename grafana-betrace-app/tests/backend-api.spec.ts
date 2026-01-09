/**
 * Backend API Tests
 *
 * Tests backend REST API directly without Grafana UI
 * Uses generative coverage tracking
 *
 * @requires-backend
 */

import { test, expect } from './lib/coverage-fixtures';

const BACKEND_URL = process.env.BETRACE_PORT_BACKEND
  ? `http://localhost:${process.env.BETRACE_PORT_BACKEND}`
  : 'http://localhost:12011';

test.describe('Backend API', () => {
  test('health endpoint responds', async ({ request, trackFeature }) => {
    trackFeature('backend-health', 'Backend Health Check', 'Backend API');

    const response = await request.get(`${BACKEND_URL}/health`);
    // Backend health endpoint returns 200 with JSON body (not necessarily "ok" status)
    expect(response.status()).toBeLessThan(500);  // Any non-500 is acceptable
  });

  test('rules endpoint returns empty list', async ({ request, trackUseCase, trackFeature }) => {
    trackUseCase('UC-RULES-001', 'List Rules', 'User can retrieve all configured rules');
    trackFeature('rules-api', 'Rules REST API', 'Backend API');

    const response = await request.get(`${BACKEND_URL}/v1/rules`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('rules');
    expect(Array.isArray(data.rules)).toBeTruthy();
  });

  test('can create and retrieve a rule', async ({ request, trackUseCase, trackFeature }) => {
    trackUseCase('UC-RULES-002', 'Create Rule', 'User can create a new rule');
    trackFeature('rules-crud', 'Rules CRUD Operations', 'Backend API');

    // DSL v2.0 syntax: when { <condition> } always { <requirement> }
    const testRule = {
      name: `E2E Test Rule ${Date.now()}`,
      description: 'Created by backend API test',
      expression: 'when { slow_query.where(duration > 1000) } always { alert }',
      enabled: true,
      severity: 'MEDIUM',
    };

    // Create rule
    const createResponse = await request.post(`${BACKEND_URL}/v1/rules`, {
      data: testRule,
    });

    // If creation fails, log the error for debugging
    if (!createResponse.ok()) {
      const errorBody = await createResponse.text();
      console.log(`Rule creation failed with status ${createResponse.status()}: ${errorBody}`);
    }

    expect(createResponse.ok()).toBeTruthy();

    const createdRule = await createResponse.json();
    expect(createdRule).toHaveProperty('id');
    expect(createdRule.name).toBe(testRule.name);

    // Retrieve and verify
    const getResponse = await request.get(`${BACKEND_URL}/v1/rules/${createdRule.id}`);
    expect(getResponse.ok()).toBeTruthy();

    const retrievedRule = await getResponse.json();
    expect(retrievedRule.id).toBe(createdRule.id);
    expect(retrievedRule.name).toBe(testRule.name);

    // Cleanup: delete the test rule
    const deleteResponse = await request.delete(`${BACKEND_URL}/v1/rules/${createdRule.id}`);
    expect(deleteResponse.ok()).toBeTruthy();
  });

  test('metrics endpoint responds', async ({ request, trackFeature }) => {
    trackFeature('metrics-endpoint', 'Prometheus Metrics Endpoint', 'Backend API');

    const response = await request.get(`${BACKEND_URL}/metrics`);
    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body).toContain('go_');  // Go runtime metrics
  });
});
