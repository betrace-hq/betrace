/**
 * Test Fixtures - Rules
 *
 * Reusable test data for rule tests.
 */

import type { Rule } from '../pages';

/**
 * Valid test rules
 */
export const testRules = {
  slowRequest: {
    name: 'Slow Request Detection',
    description: 'Detects requests taking longer than 1 second',
    expression: 'span.duration > 1000000000',
    severity: 'HIGH' as const,
    enabled: true,
  },

  errorSpan: {
    name: 'Error Span Detection',
    description: 'Detects spans with error status',
    expression: 'span.status == "error"',
    severity: 'CRITICAL' as const,
    enabled: true,
  },

  missingAuth: {
    name: 'Missing Authentication',
    description: 'Detects API calls without authentication',
    expression: 'span.kind == "server" and span.name:starts_with("/api/") and not span.attributes["auth.token"]',
    severity: 'HIGH' as const,
    enabled: true,
  },

  highMemory: {
    name: 'High Memory Usage',
    description: 'Detects high memory consumption',
    expression: 'span.attributes["memory.usage"] > 1000000000',
    severity: 'MEDIUM' as const,
    enabled: true,
  },

  piiAccessWithoutAudit: {
    name: 'PII Access Without Audit',
    description: 'Detects PII access without audit log',
    expression: 'trace.has(span.attributes["pii.accessed"] == true) and not trace.has(span.name == "audit.log")',
    severity: 'CRITICAL' as const,
    enabled: true,
  },

  simple: {
    name: 'Simple Test Rule',
    description: 'Always matches (for testing)',
    expression: 'true',
    severity: 'LOW' as const,
    enabled: true,
  },
};

/**
 * Invalid test rules
 */
export const invalidRules = {
  emptySyntax: {
    name: 'Invalid - Empty Expression',
    description: 'Has invalid empty expression',
    expression: '',
    severity: 'LOW' as const,
    enabled: true,
  },

  incompleteSyntax: {
    name: 'Invalid - Incomplete Syntax',
    description: 'Has incomplete expression',
    expression: 'span.duration >',
    severity: 'LOW' as const,
    enabled: true,
  },

  invalidOperator: {
    name: 'Invalid - Bad Operator',
    description: 'Uses invalid operator',
    expression: 'span.duration === 1000',
    severity: 'LOW' as const,
    enabled: true,
  },

  unknownField: {
    name: 'Invalid - Unknown Field',
    description: 'References non-existent field',
    expression: 'span.nonexistent.field == "value"',
    severity: 'LOW' as const,
    enabled: true,
  },
};

/**
 * Rule builder for dynamic test data
 */
export class RuleBuilder {
  private rule: Rule;

  constructor(base?: Partial<Rule>) {
    this.rule = {
      name: `Test Rule ${Date.now()}`,
      description: 'Generated test rule',
      expression: 'true',
      severity: 'LOW',
      enabled: true,
      ...base,
    };
  }

  withName(name: string): this {
    this.rule.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.rule.description = description;
    return this;
  }

  withExpression(expression: string): this {
    this.rule.expression = expression;
    return this;
  }

  withSeverity(severity: Rule['severity']): this {
    this.rule.severity = severity;
    return this;
  }

  enabled(enabled: boolean): this {
    this.rule.enabled = enabled;
    return this;
  }

  withTimestamp(): this {
    this.rule.name = `${this.rule.name} ${Date.now()}`;
    return this;
  }

  build(): Rule {
    return { ...this.rule };
  }
}

/**
 * Helper: Create rule with unique name
 */
export function uniqueRule(base: Partial<Rule>): Rule {
  return new RuleBuilder(base).withTimestamp().build();
}

/**
 * Helper: Create multiple unique rules
 */
export function uniqueRules(count: number, base?: Partial<Rule>): Rule[] {
  return Array.from({ length: count }, (_, i) =>
    new RuleBuilder(base)
      .withName(`${base?.name || 'Test Rule'} ${i + 1} ${Date.now()}`)
      .build()
  );
}
