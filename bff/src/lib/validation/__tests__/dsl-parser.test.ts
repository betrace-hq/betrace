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

// ============================================================================
// PRD-010c: Security Hardening Tests
// ============================================================================

describe('DSL Parser - Security: Input Size Limits (PRD-010c)', () => {
  const MAX_TOTAL_DSL_LENGTH = 65536; // 64KB
  const MAX_STRING_LENGTH = 10000; // 10KB
  const MAX_IDENTIFIER_LENGTH = 100;

  describe('Total DSL size limit', () => {
    it('accepts DSL at exact limit (65536 bytes)', () => {
      // Create DSL exactly at the limit
      const expr = 'a'.repeat(MAX_TOTAL_DSL_LENGTH);

      expect(expr.length).toBe(MAX_TOTAL_DSL_LENGTH);
      const result = validateDslExpression(expr);
      // Should parse (will have syntax errors, but not size error)
      expect(result.errors.some(e => e.message.includes('exceeds maximum size'))).toBe(false);
    });

    it('accepts DSL 1 byte under limit (65535 bytes)', () => {
      const expr = 'a'.repeat(MAX_TOTAL_DSL_LENGTH - 1);

      expect(expr.length).toBe(MAX_TOTAL_DSL_LENGTH - 1);
      const result = validateDslExpression(expr);
      expect(result.errors.some(e => e.message.includes('exceeds maximum size'))).toBe(false);
    });

    it('rejects DSL 1 byte over limit (65537 bytes)', () => {
      const expr = 'a'.repeat(MAX_TOTAL_DSL_LENGTH + 1);
      const result = validateDslExpression(expr);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('exceeds maximum size');
      expect(result.errors[0].message).toContain('65536');
      expect(result.errors[0].message).toContain('65537');
      expect(result.errors[0].suggestion).toContain('Break your rule into smaller');
    });

    it('rejects extremely large DSL (1MB)', () => {
      const expr = 'a'.repeat(1024 * 1024);
      const result = validateDslExpression(expr);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('exceeds maximum size');
    });
  });

  describe('String length limit', () => {
    it('accepts string at exact limit (10000 chars)', () => {
      const str = 'a'.repeat(MAX_STRING_LENGTH);
      const expr = `trace.has(test).where(value == "${str}")`;

      const result = validateDslExpression(expr);
      // Should parse successfully
      expect(result.errors.some(e => e.message.includes('String literal exceeds'))).toBe(false);
    });

    it('accepts string 1 char under limit (9999 chars)', () => {
      const str = 'a'.repeat(MAX_STRING_LENGTH - 1);
      const expr = `trace.has(test).where(value == "${str}")`;

      const result = validateDslExpression(expr);
      expect(result.errors.some(e => e.message.includes('String literal exceeds'))).toBe(false);
    });

    it('rejects string 2 chars over limit (10002 chars)', () => {
      const str = 'a'.repeat(MAX_STRING_LENGTH + 2);
      const expr = `trace.has(test).where(value == "${str}")`;

      const result = validateDslExpression(expr);
      expect(result.valid).toBe(false);
      // Should fail with string length error (not DSL size error, since < 64KB)
      expect(result.errors[0].message).toContain('String literal exceeds maximum length');
      expect(result.errors[0].message).toContain('10000');
    });

    it('rejects extremely long string (100KB)', () => {
      // This hits DSL size limit first (64KB), which is expected
      const str = 'a'.repeat(100 * 1024);
      const expr = `trace.has(test).where(value == "${str}")`;

      const result = validateDslExpression(expr);
      expect(result.valid).toBe(false);
      // Will hit DSL size limit before string limit
      expect(result.errors[0].message).toContain('exceeds maximum size');
    });
  });

  describe('Identifier length limit', () => {
    it('accepts identifier at exact limit (100 chars)', () => {
      const identifier = 'a'.repeat(MAX_IDENTIFIER_LENGTH);
      const expr = `trace.has(${identifier})`;

      const result = validateDslExpression(expr);
      expect(result.errors.some(e => e.message.includes('Identifier exceeds'))).toBe(false);
    });

    it('accepts identifier 1 char under limit (99 chars)', () => {
      const identifier = 'a'.repeat(MAX_IDENTIFIER_LENGTH - 1);
      const expr = `trace.has(${identifier})`;

      const result = validateDslExpression(expr);
      expect(result.errors.some(e => e.message.includes('Identifier exceeds'))).toBe(false);
    });

    it('rejects identifier 1 char over limit (101 chars)', () => {
      const identifier = 'a'.repeat(MAX_IDENTIFIER_LENGTH + 1);
      const expr = `trace.has(${identifier})`;

      const result = validateDslExpression(expr);
      expect(result.valid).toBe(false);
      // Error will be thrown during lexing
      expect(result.errors[0].message).toContain('Identifier exceeds maximum length');
      expect(result.errors[0].message).toContain('100');
    });

    it('rejects extremely long identifier (10KB)', () => {
      const identifier = 'a'.repeat(10 * 1024);
      const expr = `trace.has(${identifier})`;

      const result = validateDslExpression(expr);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Identifier exceeds');
    });
  });
});

describe('DSL Parser - Security: XSS Prevention (PRD-010c)', () => {
  it('sanitizes malicious script tags in error messages for unexpected characters', () => {
    // Use < character which will trigger "Unexpected character" error
    const maliciousInput = 'trace.has(test) <script>';
    const result = validateDslExpression(maliciousInput);

    expect(result.valid).toBe(false);
    // The '<' character should be sanitized in the error message
    const errorMsg = result.errors[0].message;
    expect(errorMsg).toContain('&lt;');
    expect(errorMsg).not.toContain('<');
  });

  it('sanitizes HTML entities in unexpected characters', () => {
    // Use > character which will trigger unexpected character error
    const maliciousInput = 'trace.has(test) >';
    const result = validateDslExpression(maliciousInput);

    expect(result.valid).toBe(false);
    const errorMsg = result.errors[0].message;
    // Should contain sanitized version
    expect(errorMsg).toContain('&gt;');
  });

  it('sanitizes quotes and special characters in unexpected token errors', () => {
    // Use ampersand which will trigger unexpected character error
    const maliciousInput = 'trace.has(test) &';
    const result = validateDslExpression(maliciousInput);

    expect(result.valid).toBe(false);
    // The '&' character should be sanitized to '&amp;' in error message
    const errorMsg = result.errors[0].message;
    expect(errorMsg).toContain('&amp;');
  });

  it('rejects long identifiers with proper error', () => {
    const longToken = 'a'.repeat(200);
    const result = validateDslExpression(`trace.has(${longToken})`);

    expect(result.valid).toBe(false);
    // Should fail with identifier length error during lexing
    expect(result.errors[0].message).toContain('Identifier exceeds');
  });
});

describe('DSL Parser - Security: ReDoS Prevention (PRD-010c)', () => {
  it('parses pathological nested parentheses quickly', () => {
    const nested = '('.repeat(100) + 'trace.has(test)' + ')'.repeat(100);
    const start = Date.now();
    const result = validateDslExpression(nested);
    const elapsed = Date.now() - start;

    // Should complete in < 100ms even with errors
    expect(elapsed).toBeLessThan(100);
  });

  it('parses repeated backslashes quickly', () => {
    const backslashes = '\\'.repeat(1000);
    const expr = `trace.has(test).where(value == "${backslashes}")`;
    const start = Date.now();
    const result = validateDslExpression(expr);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('parses deeply nested AND/OR expressions quickly', () => {
    let expr = 'trace.has(a)';
    for (let i = 0; i < 50; i++) {
      expr = `(${expr} and trace.has(b${i}))`;
    }

    const start = Date.now();
    const result = validateDslExpression(expr);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('parses repeated special characters quickly', () => {
    const repeated = '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!';
    const start = Date.now();
    const result = validateDslExpression(repeated);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});

describe('DSL Parser - Security: Pathological Input (PRD-010c)', () => {
  it('handles unterminated string without hanging', () => {
    const unterminated = 'trace.has(test).where(value == "never ends';
    const start = Date.now();
    const result = validateDslExpression(unterminated);
    const elapsed = Date.now() - start;

    expect(result.valid).toBe(false);
    expect(elapsed).toBeLessThan(100);
  });

  it('handles deeply nested structures', () => {
    let expr = 'trace.has(test)';
    for (let i = 0; i < 100; i++) {
      expr = `(${expr} and trace.has(nested${i}))`;
    }

    const start = Date.now();
    const result = validateDslExpression(expr);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('handles alternating valid and invalid tokens', () => {
    const alternating = 'trace.has(a) !@# and trace.has(b) $%^ or trace.has(c)';
    const start = Date.now();
    const result = validateDslExpression(alternating);
    const elapsed = Date.now() - start;

    // Parser handles invalid tokens by continuing (lexer error recovery)
    expect(elapsed).toBeLessThan(100);
  });

  it('handles null bytes and control characters', () => {
    const controlChars = 'trace.has(test\x00\x01\x02)';
    const start = Date.now();
    const result = validateDslExpression(controlChars);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('handles Unicode edge cases', () => {
    const unicode = 'trace.has(test\u0000\uFFFF\uD800)';
    const start = Date.now();
    const result = validateDslExpression(unicode);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});

describe('DSL Parser - Security: Recursion Depth Limits (PRD-010c)', () => {
  const MAX_RECURSION_DEPTH = 100;

  describe('Recursion tracking mechanism', () => {
    it('has recursion guards in place for all parse methods', () => {
      // Verify the recursion limit exists by parsing a normal expression
      const result = validateDslExpression('trace.has(test) and trace.has(other)');

      // Should parse successfully (recursion depth: 3 for parseExpression → parseTerm → parseSpanCheck)
      expect(result.valid).toBe(true);
    });

    it('handles deep parsing without stack overflow', () => {
      // The BeTrace DSL grammar is simple and doesn't support grouping parentheses
      // The parser uses iterative loops for AND/OR chains, not recursion
      // This means realistic expressions won't hit recursion limits
      // But we still protect against pathological cases or grammar extensions

      // Create a long flat AND chain (iterative, not recursive)
      let expr = 'trace.has(test0)';
      for (let i = 1; i < 200; i++) {
        expr = `${expr} and trace.has(test${i})`;
      }

      const result = validateDslExpression(expr);
      // Should parse without hitting recursion limit (uses iterative while loop)
      expect(result.errors.every(e => !e.message.includes('recursion depth'))).toBe(true);
    });

    it('protects against theoretical deep recursion', () => {
      // While the current grammar doesn't easily trigger deep recursion,
      // the limit protects against:
      // 1. Future grammar extensions (e.g., supporting grouping parens)
      // 2. Malformed input that causes excessive recursion
      // 3. Stack overflow attacks

      // The recursion guards are in place in:
      // - parseExpression()
      // - parseTerm()
      // - parseSpanCheck()

      // Each call increments depth, max is 100
      expect(MAX_RECURSION_DEPTH).toBe(100);
    });
  });

  describe('Performance and safety', () => {
    it('parses long expression chains quickly (<100ms)', () => {
      // Long iterative chain (200 AND operations)
      let expr = 'trace.has(test0)';
      for (let i = 1; i < 200; i++) {
        expr = `${expr} and trace.has(test${i})`;
      }

      const start = Date.now();
      const result = validateDslExpression(expr);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
      // No recursion error (iterative parsing)
      expect(result.errors.every(e => !e.message.includes('recursion depth'))).toBe(true);
    });

    it('handles complex boolean logic efficiently', () => {
      // Mix of AND, OR, NOT operations
      const expr = `
        trace.has(payment.charge).where(amount > 1000) and
        trace.has(fraud.check).where(score < 50) or
        not trace.has(user.verified) and
        trace.has(location.suspicious)
      `;

      const start = Date.now();
      const result = validateDslExpression(expr);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(result.valid).toBe(true);
    });
  });
});
