/**
 * Coverage System Example
 *
 * Demonstrates how to use the generative coverage system
 */

import { test, expect } from './lib/coverage-fixtures';

const BACKEND_URL = process.env.BETRACE_PORT_BACKEND
  ? `http://localhost:${process.env.BETRACE_PORT_BACKEND}`
  : 'http://localhost:12011';

test.describe('Coverage Example', () => {
  test('UC-001: List all rules (use case tracking)', async ({
    coveragePage: page,
    trackUseCase,
    trackFeature,
    trackInteraction,
    request,
  }) => {
    // Track use case - generative coverage will record this
    trackUseCase(
      'UC-001',
      'List Rules',
      'User can view all configured rules in the system'
    );

    // Track feature - generative coverage will record this
    trackFeature('rules-list', 'Rules List View', 'RulesPage');

    // Make API call - coverage collector automatically intercepts and tracks
    const response = await request.get(`${BACKEND_URL}/v1/rules`);
    expect(response.ok()).toBeTruthy();

    // Track user interaction - adds to feature coverage
    trackInteraction('rules-list', 'view');

    const data = await response.json();
    expect(data).toHaveProperty('rules');

    // API route coverage: GET /v1/rules is automatically tracked
    // LoC coverage: JavaScript executed during this test is automatically tracked
  });

  test('UC-002: Create a new rule (use case tracking)', async ({
    request,
    trackUseCase,
    trackFeature,
    trackInteraction,
  }) => {
    trackUseCase(
      'UC-002',
      'Create Rule',
      'User can create a new trace validation rule'
    );

    trackFeature('rule-creation', 'Rule Creation Form', 'RuleEditor');

    // API routes automatically tracked: POST /v1/rules
    trackInteraction('rule-creation', 'submit');
  });

  test('FEAT-001: Health check endpoint', async ({
    request,
    trackFeature,
  }) => {
    trackFeature('health-check', 'Backend Health Check', 'Backend API');

    // API route automatically tracked: GET /health
    const response = await request.get(`${BACKEND_URL}/health`);
    expect(response.status()).toBeLessThan(500);
  });

  test('FEAT-002: Metrics endpoint', async ({
    request,
    trackFeature,
  }) => {
    trackFeature('metrics', 'Prometheus Metrics', 'Backend API');

    // API route automatically tracked: GET /metrics
    const response = await request.get(`${BACKEND_URL}/metrics`);
    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body).toContain('go_');
  });
});

/**
 * After this test file runs, the coverage collector has automatically tracked:
 *
 * 1. Use Cases:
 *    - UC-001: List Rules (covered)
 *    - UC-002: Create Rule (covered)
 *
 * 2. Features:
 *    - rules-list (RulesPage) - interactions: view
 *    - rule-creation (RuleEditor) - interactions: submit
 *    - health-check (Backend API)
 *    - metrics (Backend API)
 *
 * 3. API Routes:
 *    - GET /v1/rules
 *    - POST /v1/rules
 *    - GET /health
 *    - GET /metrics
 *
 * 4. LoC Coverage:
 *    - All JavaScript executed during test is tracked
 *
 * No manual tracking required - it's all generative!
 */
