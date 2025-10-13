import { describe, it, expect } from 'vitest';
import { validateDslExpression } from '../dsl-parser';

describe('DSL Parser - Valid Expressions', () => {
  it('validates simple trace.has() expression', () => {
    const result = validateDslExpression('trace.has(payment.charge)');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.ast).toBeDefined();
    expect(result.ast?.type).toBe('has');
  });

  it('validates trace.has() with where clause', () => {
    const result = validateDslExpression('trace.has(payment.charge).where(amount > 1000)');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates trace.count() expression', () => {
    const result = validateDslExpression('trace.count(http.request) > 10');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.type).toBe('count');
  });

  it('validates AND expression', () => {
    const result = validateDslExpression('trace.has(payment.charge) and trace.has(fraud.check)');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.type).toBe('binary');
  });

  it('validates OR expression', () => {
    const result = validateDslExpression('trace.has(payment.charge) or trace.has(payment.refund)');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates NOT expression', () => {
    const result = validateDslExpression('not trace.has(fraud.flag)');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.type).toBe('not');
  });

  it('validates complex nested expression', () => {
    const result = validateDslExpression(
      'trace.has(payment.charge).where(amount > 1000) and trace.has(fraud.check)'
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates where clause with string value', () => {
    const result = validateDslExpression('trace.has(user.login).where(role == "admin")');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates where clause with boolean value', () => {
    const result = validateDslExpression('trace.has(api.request).where(authenticated == true)');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates where clause with numeric value', () => {
    const result = validateDslExpression('trace.has(database.query).where(duration > 500.5)');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates multiple where clauses', () => {
    const result = validateDslExpression(
      'trace.has(payment).where(amount > 1000).where(currency == "USD")'
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates all comparison operators', () => {
    const operators = ['==', '!=', '>', '>=', '<', '<='];
    operators.forEach((op) => {
      const result = validateDslExpression(`trace.has(test).where(value ${op} 100)`);
      expect(result.valid).toBe(true);
    });
  });

  it('validates IN operator', () => {
    const result = validateDslExpression('trace.has(api.request).where(method in "GET")');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates MATCHES operator', () => {
    const result = validateDslExpression('trace.has(api.request).where(path matches "/admin/.*")');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('DSL Parser - Syntax Errors', () => {
  it('detects empty expression', () => {
    const result = validateDslExpression('');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('cannot be empty');
  });

  it('detects whitespace-only expression', () => {
    const result = validateDslExpression('   \n  ');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('detects missing trace prefix', () => {
    const result = validateDslExpression('has(payment.charge)');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('trace');
  });

  it('detects unbalanced parentheses - missing closing', () => {
    const result = validateDslExpression('trace.has(payment.charge');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects unbalanced parentheses - missing opening', () => {
    const result = validateDslExpression('trace.has payment.charge)');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects missing span name in has()', () => {
    const result = validateDslExpression('trace.has()');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects missing span name in count()', () => {
    const result = validateDslExpression('trace.count()');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects missing comparison operator in count()', () => {
    const result = validateDslExpression('trace.count(http.request)');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects missing value in count()', () => {
    const result = validateDslExpression('trace.count(http.request) >');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects invalid dot after trace without has/count', () => {
    const result = validateDslExpression('trace.invalid()');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects missing attribute in where clause', () => {
    const result = validateDslExpression('trace.has(payment).where()');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects missing operator in where clause', () => {
    const result = validateDslExpression('trace.has(payment).where(amount)');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects missing value in where clause', () => {
    const result = validateDslExpression('trace.has(payment).where(amount >)');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects unterminated string', () => {
    const result = validateDslExpression('trace.has(payment).where(currency == "USD)');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects unexpected token after expression', () => {
    const result = validateDslExpression('trace.has(payment) extra');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('DSL Parser - Error Locations', () => {
  it('reports correct error location for missing closing paren', () => {
    const result = validateDslExpression('trace.has(payment');
    expect(result.valid).toBe(false);
    expect(result.errors[0].line).toBe(1);
    expect(result.errors[0].column).toBeGreaterThan(0);
  });

  it('reports error location in where clause', () => {
    const result = validateDslExpression('trace.has(payment).where(');
    expect(result.valid).toBe(false);
    expect(result.errors[0].line).toBe(1);
  });
});

describe('DSL Parser - AST Structure', () => {
  it('builds correct AST for has expression', () => {
    const result = validateDslExpression('trace.has(payment.charge)');
    expect(result.ast).toEqual({
      type: 'has',
      spanName: 'payment.charge',
      whereClauses: [],
    });
  });

  it('builds correct AST for has with where clause', () => {
    const result = validateDslExpression('trace.has(payment).where(amount > 1000)');
    expect(result.ast).toMatchObject({
      type: 'has',
      spanName: 'payment',
      whereClauses: [
        {
          attribute: 'amount',
          operator: '>',
          value: 1000,
        },
      ],
    });
  });

  it('builds correct AST for count expression', () => {
    const result = validateDslExpression('trace.count(http.request) > 10');
    expect(result.ast).toMatchObject({
      type: 'count',
      spanName: 'http.request',
      operator: '>',
      value: 10,
    });
  });

  it('builds correct AST for binary AND expression', () => {
    const result = validateDslExpression('trace.has(a) and trace.has(b)');
    expect(result.ast).toMatchObject({
      type: 'binary',
      operator: 'and',
      left: { type: 'has', spanName: 'a' },
      right: { type: 'has', spanName: 'b' },
    });
  });

  it('builds correct AST for NOT expression', () => {
    const result = validateDslExpression('not trace.has(fraud)');
    expect(result.ast).toMatchObject({
      type: 'not',
      expression: { type: 'has', spanName: 'fraud' },
    });
  });
});

describe('DSL Parser - Edge Cases', () => {
  it('handles identifiers with dots', () => {
    const result = validateDslExpression('trace.has(payment.charge.card)');
    expect(result.valid).toBe(true);
  });

  it('handles identifiers with underscores', () => {
    const result = validateDslExpression('trace.has(user_login)');
    expect(result.valid).toBe(true);
  });

  it('handles decimal numbers', () => {
    const result = validateDslExpression('trace.has(payment).where(amount > 100.50)');
    expect(result.valid).toBe(true);
  });

  it('handles escaped quotes in strings', () => {
    const result = validateDslExpression('trace.has(test).where(message == "Say \\"hello\\"")');
    expect(result.valid).toBe(true);
  });

  it('ignores line comments', () => {
    const result = validateDslExpression('// This is a comment\ntrace.has(payment)');
    expect(result.valid).toBe(true);
  });

  it('handles whitespace and newlines', () => {
    const result = validateDslExpression(`
      trace.has(payment.charge)
        and trace.has(fraud.check)
    `);
    expect(result.valid).toBe(true);
  });
});
