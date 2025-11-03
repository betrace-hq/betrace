/**
 * Test data fixtures for integration tests
 *
 * Provides consistent test data across all test suites.
 */

import { CreateRuleRequest } from './backend';

/**
 * Generate unique test ID
 */
export function uniqueId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sample rules for testing
 */
export const sampleRules: CreateRuleRequest[] = [
  {
    name: 'Slow Database Query',
    dsl: 'span.duration > 1000 AND span.attributes["db.system"] EXISTS',
    enabled: true,
  },
  {
    name: 'Unauthorized API Access',
    dsl: 'span.attributes["http.status_code"] == 401',
    enabled: true,
  },
  {
    name: 'High Memory Usage',
    dsl: 'span.attributes["process.runtime.memory.used"] > 1000000000',
    enabled: false,
  },
  {
    name: 'Failed Payment Transaction',
    dsl: 'span.name CONTAINS "payment" AND span.status.code == 2',
    enabled: true,
  },
  {
    name: 'PII Access Without Audit',
    dsl: 'span.attributes["pii.accessed"] == true AND NOT span.attributes["audit.logged"]',
    enabled: true,
  },
];

/**
 * Create test rule with unique name
 */
export function createTestRule(overrides: Partial<CreateRuleRequest> = {}): CreateRuleRequest {
  const base = sampleRules[0];
  return {
    ...base,
    name: overrides.name || `${base.name} ${uniqueId()}`,
    ...overrides,
  };
}

/**
 * Generate random rule name
 */
export function randomRuleName(): string {
  const adjectives = ['Fast', 'Slow', 'Critical', 'Warning', 'Info'];
  const nouns = ['Query', 'Request', 'Transaction', 'Operation', 'Process'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun} ${uniqueId()}`;
}

/**
 * Sample trace data for violation testing
 */
export const sampleTrace = {
  traceId: '1234567890abcdef1234567890abcdef',
  spanId: 'abcdef1234567890',
  service: 'test-service',
  operation: 'test-operation',
  duration: 1500,
  attributes: {
    'http.method': 'GET',
    'http.status_code': 200,
    'db.system': 'postgresql',
  },
};

/**
 * Generate unique trace ID
 */
export function generateTraceId(): string {
  return uniqueId('trace').padEnd(32, '0');
}

/**
 * Generate unique span ID
 */
export function generateSpanId(): string {
  return uniqueId('span').padEnd(16, '0');
}

/**
 * Wait helper (for sync delays)
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry helper (for flaky operations)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delay?: number } = {}
): Promise<T> {
  const { attempts = 3, delay = 1000 } = options;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i < attempts - 1) {
        await wait(delay);
      } else {
        throw error;
      }
    }
  }

  throw new Error('Retry failed');
}
