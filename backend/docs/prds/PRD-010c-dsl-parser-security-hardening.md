# PRD-010c: DSL Parser Security Hardening

**Status:** Draft (Revised)
**Priority:** P1
**Component:** BFF (Frontend)
**Estimated Effort:** 3-4 days (updated after expert reviews)
**Parent:** PRD-010b (Real-Time DSL Validation Feedback)
**Revision:** v2 - Addresses security (7.5/10) and QA (6.5/10) expert reviews

## Context

PRD-010b implemented a comprehensive DSL parser with real-time validation. Expert reviews identified critical security and testing gaps that must be addressed before production deployment.

**Security Review Score:** 7.5/10 → Target 9.5/10
**QA Review Score:** 6.5/10 → Target 9.5/10

**Expert Review Findings:**
- **Security P0:** ReDoS detection vulnerable to DoS, recursion bypass via mutual recursion, incomplete XSS sanitization
- **QA P0:** No mutation testing, missing boundary tests, failure scenarios untested, no regression corpus

## Problem Statement

The DSL parser has critical security and quality gaps identified by expert reviews:

### Security Issues (P0/P1)
1. **ReDoS Prevention** - String literal parsing needs length limits (10KB max)
2. **XSS Prevention** - Error messages need context-aware sanitization (HTML/JS/JSON)
3. **Recursion Limits** - Global call stack depth tracking required (50 max)
4. **Input Size Limits** - Missing max lengths for strings, identifiers, total DSL
5. **Rate Limiting** - No protection against validation endpoint abuse

### Testing Gaps (P0)
1. **Mutation Testing** - Test quality unverified (need PIT with >70% score)
2. **Boundary Tests** - Exact limit testing missing (10239B vs 10240B vs 10241B)
3. **Failure Scenarios** - Parser crash, logging failure, invalid config untested
4. **Regression Corpus** - No validation against production rules
5. **Adversarial Tests** - Fuzzing, concurrent validation, resource exhaustion missing

## Goals

### Primary Goals
- **Security:** Add string length limits, context-aware sanitization, global recursion tracking
- **Testing:** Implement mutation testing (>70% score), boundary tests, failure scenarios
- **Quality:** Create production regression corpus, add fuzzing, achieve 95%+ coverage

### Non-Goals
- Full CSP implementation (separate PRD)
- Backend rate limiting implementation (out of scope - frontend only)
- Memory profiling and optimization (separate performance PRD)
- RE2 regex engine integration (future enhancement)

## P1 Security Issues (From Expert Review)

### 1. Regex DoS in String Literal Parsing

**Current Code** (`dsl-parser.ts:130`):
```typescript
private readString(): Token {
  const start = { line: this.line, column: this.column };
  const quote = this.advance(); // consume opening quote
  let value = '';

  while (!this.isAtEnd() && this.peek() !== quote) {
    if (this.peek() === '\\') {
      this.advance();
      if (!this.isAtEnd()) {
        const escaped = this.advance();
        // Escape sequence handling
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case "'": value += "'"; break;
          default: value += escaped;
        }
      }
    } else {
      value += this.advance();
    }
  }
  // ...
}
```

**Vulnerability:** While current implementation doesn't use regex, escape sequence handling could be vulnerable to pathological input with repeated backslashes.

**Impact:** Medium - Could cause UI freeze with crafted input like `"\\\\\\\\..."`

**Fix:** Add character consumption limits and timeout guards.

### 2. XSS via Unescaped Error Messages

**Current Code** (`monaco-rule-editor.tsx:85`):
```typescript
const markers: Monaco.editor.IMarkerData[] = [
  ...validation.errors.map((error) => ({
    severity: monacoRef.current!.MarkerSeverity.Error,
    startLineNumber: error.line,
    startColumn: error.column,
    endLineNumber: error.endLine,
    endColumn: error.endColumn,
    message: error.message + (error.suggestion ? `\n\n💡 Suggestion: ${error.suggestion}` : ''),
    // ^ USER INPUT NOT ESCAPED
  })),
];
```

**Vulnerability:** Error messages contain user input (token values) that are displayed in Monaco markers and ValidationFeedback component without sanitization.

**Impact:** Medium - XSS if Monaco or shadcn/ui Alert component renders HTML.

**Example Attack:**
```typescript
validateDslExpression('trace.has(<script>alert("XSS")</script>)')
// Error message: "Unexpected token: <script>alert("XSS")</script>"
// Displayed in Monaco marker and Alert component
```

**Fix:** Sanitize all user input before inclusion in error messages using DOMPurify or similar.

### 3. Missing Recursion Depth Limits

**Current Code** (`dsl-parser.ts:300-350`):
```typescript
private parseExpression(): RuleExpression {
  return this.parseOrExpression();
}

private parseOrExpression(): RuleExpression {
  let left = this.parseAndExpression();
  while (this.match('OR')) {
    const right = this.parseAndExpression();
    left = { type: 'binary', operator: 'or', left, right };
  }
  return left;
}

private parseAndExpression(): RuleExpression {
  let left = this.parseNotExpression();
  while (this.match('AND')) {
    const right = this.parseNotExpression();
    left = { type: 'binary', operator: 'and', left, right };
  }
  return left;
}

private parseNotExpression(): RuleExpression {
  if (this.match('NOT')) {
    return { type: 'not', expression: this.parseNotExpression() }; // RECURSIVE
  }
  return this.parsePrimaryExpression();
}
```

**Vulnerability:** Deeply nested expressions like `not not not not ... trace.has(x)` (1000+ levels) could cause stack overflow.

**Impact:** Low-Medium - DoS via stack overflow, but unlikely in practice.

**Fix:** Add `MAX_RECURSION_DEPTH = 50` and track depth counter.

## Technical Approach

### Fix 1: ReDoS Prevention with Input Size Limits

**Implementation:**
```typescript
// Constants
private readonly MAX_STRING_LENGTH = 10000; // 10KB strings
private readonly MAX_IDENTIFIER_LENGTH = 100; // Reasonable identifier limit
private readonly MAX_TOTAL_DSL_LENGTH = 65536; // 64KB total DSL

// Validate total DSL size before parsing
export function validateDslExpression(expression: string): ParseResult {
  if (expression.length > MAX_TOTAL_DSL_LENGTH) {
    return {
      valid: false,
      errors: [{
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: `DSL expression exceeds maximum size of ${MAX_TOTAL_DSL_LENGTH} bytes`,
        severity: 'error',
      }],
      warnings: [],
    };
  }

  try {
    const lexer = new Lexer(expression);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  } catch (error: any) {
    // ... error handling
  }
}

private readString(): Token {
  const start = { line: this.line, column: this.column };
  const quote = this.advance();
  let value = '';
  let charCount = 0;

  while (!this.isAtEnd() && this.peek() !== quote) {
    if (charCount++ > this.MAX_STRING_LENGTH) {
      throw this.error(`String literal exceeds maximum length of ${this.MAX_STRING_LENGTH} characters`);
    }

    if (this.peek() === '\\') {
      this.advance(); // consume backslash
      if (this.isAtEnd()) {
        throw this.error('Unterminated string: backslash at end of input');
      }
      const escaped = this.advance();
      // Whitelist allowed escape sequences
      const escapeMap: Record<string, string> = {
        'n': '\n',
        't': '\t',
        'r': '\r',
        '\\': '\\',
        '"': '"',
        "'": "'",
      };
      value += escapeMap[escaped] ?? escaped;
    } else {
      value += this.advance();
    }
  }

  if (this.isAtEnd()) {
    throw this.error('Unterminated string literal');
  }

  this.advance(); // consume closing quote
  return { type: 'STRING', value, ...start };
}

private readIdentifier(): string {
  const start = this.position;
  while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
    if (this.position - start > this.MAX_IDENTIFIER_LENGTH) {
      throw this.error(`Identifier exceeds maximum length of ${this.MAX_IDENTIFIER_LENGTH} characters`);
    }
    this.advance();
  }
  return this.input.substring(start, this.position);
}
```

**Key Changes:**
- Add `MAX_TOTAL_DSL_LENGTH` (64KB) checked before parsing
- Add `MAX_STRING_LENGTH` (10KB) for string literals
- Add `MAX_IDENTIFIER_LENGTH` (100 chars) for identifiers
- Use `Record<string, string>` for escape sequences
- Early termination on malformed input

### Fix 2: XSS Prevention with Context-Aware Sanitization

**Implementation:**
```typescript
// New file: bff/src/lib/validation/sanitize.ts

/**
 * Output contexts for error messages
 */
export enum OutputContext {
  HTML = 'html',
  JAVASCRIPT = 'javascript',
  JSON = 'json',
  MARKDOWN = 'markdown',
}

/**
 * Context-aware sanitization for error messages.
 * Prevents XSS in HTML, JavaScript, JSON, and Markdown contexts.
 */
export function sanitizeErrorMessage(message: string, context: OutputContext = OutputContext.HTML): string {
  switch (context) {
    case OutputContext.HTML:
      return message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');

    case OutputContext.JAVASCRIPT:
      return message
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\//g, '\\/'); // Prevent script tag injection

    case OutputContext.JSON:
      return JSON.stringify(message).slice(1, -1); // Remove surrounding quotes

    case OutputContext.MARKDOWN:
      return message
        .replace(/\\/g, '\\\\')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    default:
      return sanitizeErrorMessage(message, OutputContext.HTML);
  }
}

/**
 * Sanitizes token value for inclusion in error messages.
 * Truncates long tokens and applies context-aware escaping.
 */
export function sanitizeTokenValue(token: string, context: OutputContext = OutputContext.HTML): string {
  const MAX_TOKEN_DISPLAY_LENGTH = 50;
  const truncated = token.length > MAX_TOKEN_DISPLAY_LENGTH
    ? token.substring(0, MAX_TOKEN_DISPLAY_LENGTH) + '...'
    : token;

  return sanitizeErrorMessage(truncated, context);
}
```

**Usage in Parser:**
```typescript
// dsl-parser.ts
import { sanitizeTokenValue } from './sanitize';

private error(message: string): Error {
  const currentToken = this.peek();
  this.errors.push({
    line: currentToken.line,
    column: currentToken.column,
    endLine: currentToken.line,
    endColumn: currentToken.column + currentToken.value.length,
    message: message, // Base message (trusted)
    severity: 'error',
  });
  return new Error(message);
}

private consume(type: TokenType, message: string): Token {
  if (this.check(type)) return this.advance();

  const token = this.peek();
  // Sanitize token value before including in error
  const sanitizedValue = sanitizeTokenValue(token.value);
  throw this.error(`${message}, got "${sanitizedValue}"`);
}
```

**Usage in error-messages.ts:**
```typescript
import { sanitizeErrorMessage } from './sanitize';

export function enhanceError(error: ValidationError): ValidationError {
  // Sanitize message before enhancement
  const sanitizedMessage = sanitizeErrorMessage(error.message);

  const errorText = sanitizedMessage.toLowerCase();
  // ... pattern matching

  return {
    ...error,
    message: sanitizedMessage,
    suggestion: error.suggestion ? sanitizeErrorMessage(error.suggestion) : undefined,
  };
}
```

### Fix 3: Global Recursion Depth Limits

**Security Expert Feedback:** Previous approach only tracked local recursion per method. Need global tracking to prevent mutual recursion bypass.

**Implementation:**
```typescript
// dsl-parser.ts
class Parser {
  private tokens: Token[];
  private current = 0;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private globalCallDepth = 0; // NEW: Global depth tracker
  private readonly MAX_RECURSION_DEPTH = 50;

  private checkRecursionDepth(methodName: string): void {
    if (this.globalCallDepth > this.MAX_RECURSION_DEPTH) {
      throw this.error(
        `Expression too complex: maximum nesting depth of ${this.MAX_RECURSION_DEPTH} exceeded (in ${methodName})`
      );
    }
  }

  private enterMethod(methodName: string): void {
    this.globalCallDepth++;
    this.checkRecursionDepth(methodName);
  }

  private exitMethod(): void {
    this.globalCallDepth--;
  }

  private parseExpression(): RuleExpression {
    this.enterMethod('parseExpression');
    try {
      return this.parseOrExpression();
    } finally {
      this.exitMethod();
    }
  }

  private parseOrExpression(): RuleExpression {
    this.enterMethod('parseOrExpression');
    try {
      let left = this.parseAndExpression();
      while (this.match('OR')) {
        const right = this.parseAndExpression();
        left = { type: 'binary', operator: 'or', left, right };
      }
      return left;
    } finally {
      this.exitMethod();
    }
  }

  private parseAndExpression(): RuleExpression {
    this.enterMethod('parseAndExpression');
    try {
      let left = this.parseNotExpression();
      while (this.match('AND')) {
        const right = this.parseNotExpression();
        left = { type: 'binary', operator: 'and', left, right };
      }
      return left;
    } finally {
      this.exitMethod();
    }
  }

  private parseNotExpression(): RuleExpression {
    this.recursionDepth++;
    this.checkRecursionDepth();
    try {
      if (this.match('NOT')) {
        return { type: 'not', expression: this.parseNotExpression() };
      }
      return this.parsePrimaryExpression();
    } finally {
      this.recursionDepth--;
    }
  }

  private parsePrimaryExpression(): RuleExpression {
    this.recursionDepth++;
    this.checkRecursionDepth();
    try {
      // ... existing logic
    } finally {
      this.recursionDepth--;
    }
  }
}
```

**Key Changes:**
- Add `recursionDepth` counter and `MAX_RECURSION_DEPTH` constant
- Increment/decrement depth at start/end of each recursive method
- Use `try/finally` to ensure depth is decremented even on errors
- Throw clear error when limit exceeded

## Test Requirements

### Security Tests (New File: `dsl-parser.security.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { validateDslExpression } from '../dsl-parser';

describe('DSL Parser - Security Hardening', () => {
  describe('ReDoS Prevention', () => {
    it('rejects strings exceeding MAX_STRING_LENGTH', () => {
      const longString = '"' + 'a'.repeat(10001) + '"';
      const expr = `trace.has(x).where(y == ${longString})`;
      const result = validateDslExpression(expr);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('exceeds maximum length');
    });

    it('handles pathological backslash sequences', () => {
      const backslashes = '\\\\'.repeat(1000);
      const expr = `trace.has(x).where(y == "${backslashes}")`;

      // Should complete in < 100ms
      const start = Date.now();
      const result = validateDslExpression(expr);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(result.valid).toBe(true);
    });
  });

  describe('XSS Prevention', () => {
    it('sanitizes HTML in error messages', () => {
      const result = validateDslExpression('trace.has(<script>alert("XSS")</script>)');

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).not.toContain('<script>');
      expect(result.errors[0].message).toContain('&lt;script&gt;');
    });

    it('sanitizes quotes in error messages', () => {
      const result = validateDslExpression('trace.has("foo\' onclick="alert()")');

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).not.toContain('onclick=');
      expect(result.errors[0].message).toContain('&#x27;');
    });

    it('truncates long token values in errors', () => {
      const longToken = 'a'.repeat(100);
      const result = validateDslExpression(`trace.has(${longToken})`);

      if (!result.valid) {
        const errorMessage = result.errors[0].message;
        expect(errorMessage.length).toBeLessThan(200);
        expect(errorMessage).toContain('...');
      }
    });
  });

  describe('Recursion Depth Limits', () => {
    it('rejects deeply nested NOT expressions', () => {
      const deepNot = 'not '.repeat(51) + 'trace.has(x)';
      const result = validateDslExpression(deepNot);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('maximum nesting depth');
    });

    it('rejects deeply nested parenthesized expressions', () => {
      const deepParen = '('.repeat(51) + 'trace.has(x)' + ')'.repeat(51);
      const result = validateDslExpression(deepParen);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('maximum nesting depth');
    });

    it('allows reasonable nesting depth (< 50)', () => {
      const reasonableNot = 'not '.repeat(30) + 'trace.has(x)';
      const result = validateDslExpression(reasonableNot);

      expect(result.valid).toBe(true);
    });
  });
});
```

### Mutation Testing (NEW - Required by QA Review)

**QA Expert Feedback:** Tests may provide false confidence. Mutation testing verifies test quality.

**Setup:**
```json
// package.json
{
  "devDependencies": {
    "@stryker-mutator/core": "^8.0.0",
    "@stryker-mutator/vitest-runner": "^8.0.0"
  },
  "scripts": {
    "test:mutation": "stryker run"
  }
}
```

**Configuration (stryker.config.json):**
```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "mutate": [
    "src/lib/validation/dsl-parser.ts",
    "src/lib/validation/sanitize.ts"
  ],
  "thresholds": {
    "high": 80,
    "low": 70,
    "break": 70
  }
}
```

**Target:** >70% mutation score for security-critical files

### Boundary Tests (NEW - Required by QA Review)

**QA Expert Feedback:** Test exact limits, not just "exceeds limit". Off-by-one errors are common.

```typescript
describe('DSL Parser - Boundary Conditions', () => {
  describe('Total DSL Size', () => {
    it('accepts DSL at exact limit (65536 bytes)', () => {
      const atLimit = 'a'.repeat(65536);
      const result = validateDslExpression(atLimit);
      expect(result.valid).toBe(true);
    });

    it('accepts DSL 1 byte under limit (65535 bytes)', () => {
      const underLimit = 'a'.repeat(65535);
      const result = validateDslExpression(underLimit);
      expect(result.valid).toBe(true);
    });

    it('rejects DSL 1 byte over limit (65537 bytes)', () => {
      const overLimit = 'a'.repeat(65537);
      const result = validateDslExpression(overLimit);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('exceeds maximum size');
    });
  });

  describe('String Literal Length', () => {
    it('accepts string at exact limit (10000 chars)', () => {
      const atLimit = '"' + 'a'.repeat(10000) + '"';
      const result = validateDslExpression(`trace.has(x).where(y == ${atLimit})`);
      expect(result.valid).toBe(true);
    });

    it('rejects string 1 char over limit (10001 chars)', () => {
      const overLimit = '"' + 'a'.repeat(10001) + '"';
      const result = validateDslExpression(`trace.has(x).where(y == ${overLimit})`);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('exceeds maximum length');
    });
  });

  describe('Recursion Depth', () => {
    it('accepts nesting at exact limit (50 levels)', () => {
      const atLimit = 'not '.repeat(50) + 'trace.has(x)';
      const result = validateDslExpression(atLimit);
      expect(result.valid).toBe(true);
    });

    it('rejects nesting 1 level over limit (51 levels)', () => {
      const overLimit = 'not '.repeat(51) + 'trace.has(x)';
      const result = validateDslExpression(overLimit);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('maximum nesting depth');
    });
  });

  describe('Identifier Length', () => {
    it('accepts identifier at exact limit (100 chars)', () => {
      const atLimit = 'a'.repeat(100);
      const result = validateDslExpression(`trace.has(${atLimit})`);
      expect(result.valid).toBe(true);
    });

    it('rejects identifier 1 char over limit (101 chars)', () => {
      const overLimit = 'a'.repeat(101);
      const result = validateDslExpression(`trace.has(${overLimit})`);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Identifier exceeds maximum length');
    });
  });
});
```

### Failure Scenario Tests (NEW - Required by QA Review)

**QA Expert Feedback:** Test what happens when things go wrong. Parser crash, cleanup failures, etc.

```typescript
describe('DSL Parser - Failure Scenarios', () => {
  it('cleans up resources when parser crashes', () => {
    const malformed = 'trace.has((((((';

    expect(() => validateDslExpression(malformed)).toThrow();

    // Verify parser resets depth counter for next parse
    const valid = 'trace.has(test)';
    const result = validateDslExpression(valid);
    expect(result.valid).toBe(true);
  });

  it('handles sanitization errors gracefully', () => {
    // Mock sanitization failure
    vi.spyOn(require('../sanitize'), 'sanitizeErrorMessage').mockImplementation(() => {
      throw new Error('Sanitization failed');
    });

    const result = validateDslExpression('invalid');

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).not.toContain('<script>'); // Still safe
  });

  it('resets global call depth after exception', () => {
    const deepNesting = 'not '.repeat(60) + 'trace.has(x)';

    expect(() => validateDslExpression(deepNesting)).toThrow();

    // Next parse should start with depth = 0
    const result = validateDslExpression('trace.has(test)');
    expect(result.valid).toBe(true);
  });

  it('handles concurrent validation attempts', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      Promise.resolve(validateDslExpression(`trace.has(test${i})`))
    );

    const results = await Promise.all(promises);

    results.forEach(result => {
      expect(result.valid).toBe(true);
    });
  });
});
```

### Regression Corpus Tests (NEW - Required by QA Review)

**QA Expert Feedback:** Ensure security changes don't break valid production rules.

```typescript
// Create corpus from production
// bff/src/lib/validation/__tests__/fixtures/production-rules.json
[
  { "id": "rule-001", "dsl": "trace.has(payment.charge)", "description": "Basic payment rule" },
  { "id": "rule-002", "dsl": "trace.has(api.request).where(status == 200)", "description": "API success rule" },
  // ... 50+ real production rules
]

describe('DSL Parser - Regression Corpus', () => {
  const productionRules = require('./fixtures/production-rules.json');

  productionRules.forEach(({ id, dsl, description }) => {
    it(`should not reject production rule: ${id} (${description})`, () => {
      const result = validateDslExpression(dsl);

      expect(result.valid).withContext(
        `Production rule rejected:\n` +
        `  ID: ${id}\n` +
        `  Description: ${description}\n` +
        `  DSL: ${dsl}\n` +
        `  Errors: ${JSON.stringify(result.errors)}`
      ).toBe(true);
    });
  });
});
```

### Context-Aware Sanitization Tests (NEW - Security P0)

```typescript
import { sanitizeErrorMessage, OutputContext } from '../sanitize';

describe('Sanitization - Context-Aware Escaping', () => {
  const maliciousInput = '<script>alert("XSS")</script>';

  it('escapes HTML context', () => {
    const sanitized = sanitizeErrorMessage(maliciousInput, OutputContext.HTML);
    expect(sanitized).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    expect(sanitized).not.toContain('<script>');
  });

  it('escapes JavaScript context', () => {
    const jsInput = '"; alert("XSS"); //';
    const sanitized = sanitizeErrorMessage(jsInput, OutputContext.JAVASCRIPT);
    expect(sanitized).toBe('\\"; alert(\\"XSS\\"); \\/\\/');
    expect(sanitized).not.toContain('"; alert(');
  });

  it('escapes JSON context', () => {
    const jsonInput = '{"key": "value"}';
    const sanitized = sanitizeErrorMessage(jsonInput, OutputContext.JSON);
    expect(sanitized).toBe('{\\"key\\": \\"value\\"}');
  });

  it('escapes Markdown context (Monaco hover)', () => {
    const mdInput = '[Click here](javascript:alert("XSS"))';
    const sanitized = sanitizeErrorMessage(mdInput, OutputContext.MARKDOWN);
    expect(sanitized).not.toContain('[Click here]');
    expect(sanitized).toBe('\\[Click here\\]\\(javascript:alert(&lt;"XSS"&gt;)\\)');
  });
});
```

**Test Coverage Targets:**
- Overall instruction coverage: 95%+
- Branch coverage: 90%+
- Mutation score: >70% for security-critical files
- All boundary conditions tested (±1 byte/char/level)
- All failure scenarios have tests
- Regression corpus: 50+ production rules validated

## Success Metrics

### Security Metrics (Updated)
- ✅ No ReDoS vulnerabilities (< 100ms parsing, 64KB DSL limit)
- ✅ No XSS vulnerabilities (context-aware sanitization for HTML/JS/JSON/Markdown)
- ✅ No stack overflow (global recursion depth limited to 50)
- ✅ Input size limits enforced (64KB DSL, 10KB strings, 100 char identifiers)
- ✅ Security review score: 7.5/10 → 9.5/10

### Performance Metrics
- Parsing time for 10KB input: < 10ms (p95)
- Parsing time for 64KB input: < 50ms (p95)
- No performance regression for normal input (<1KB)
- Memory usage: < 5MB for worst-case input
- Sanitization overhead: < 1ms per error message

### Test Coverage (Updated)
- Security tests: 50+ tests (security, boundary, failure, context-aware)
- Mutation score: >70% for dsl-parser.ts and sanitize.ts
- Boundary tests: All limits tested at ±1 byte/char/level
- Failure scenarios: Parser crash, sanitization errors, concurrent validation
- Regression corpus: 50+ production rules validated
- Overall instruction coverage: 95%+
- Branch coverage: 90%+
- Overall test pass rate: 100% (maintained)

### Quality Metrics (New)
- Zero false positives on production rules
- All P0 security issues resolved
- All P0 testing gaps filled
- Code review approval from security and QA experts

## Implementation Plan (Updated)

### Phase 1: Input Size Limits & ReDoS Prevention (4 hours)
1. Add constants: `MAX_TOTAL_DSL_LENGTH`, `MAX_STRING_LENGTH`, `MAX_IDENTIFIER_LENGTH`
2. Add pre-parse DSL size validation
3. Add character counting to `readString()` and `readIdentifier()`
4. Write boundary tests for all limits (±1 byte/char)
5. Write security tests for pathological input
6. Verify < 100ms parsing time for worst-case

### Phase 2: Context-Aware XSS Prevention (5 hours)
1. Create `sanitize.ts` with `OutputContext` enum
2. Implement `sanitizeErrorMessage()` for HTML/JS/JSON/Markdown
3. Implement `sanitizeTokenValue()` with truncation
4. Update parser to sanitize token values in errors
5. Update `error-messages.ts` to use context-aware sanitization
6. Update Monaco integration for Markdown context
7. Write context-aware sanitization tests (all 4 contexts)
8. Write XSS security tests for each context
9. Verify Monaco markers and ValidationFeedback are safe

### Phase 3: Global Recursion Limits (3 hours)
1. Replace `recursionDepth` with `globalCallDepth`
2. Add `enterMethod()` and `exitMethod()` helpers
3. Update all recursive methods to use global tracking
4. Use `try/finally` for cleanup
5. Write security tests for deep nesting and mutual recursion
6. Write failure scenario tests (depth reset after crash)
7. Verify clear error messages with method names

### Phase 4: Mutation Testing Setup (3 hours)
1. Install Stryker mutator (`@stryker-mutator/core`, `@stryker-mutator/vitest-runner`)
2. Create `stryker.config.json` with 70% threshold
3. Run mutation testing on `dsl-parser.ts` and `sanitize.ts`
4. Fix any tests with false confidence (mutations not caught)
5. Achieve >70% mutation score

### Phase 5: Failure Scenarios & Regression (4 hours)
1. Write parser crash cleanup tests
2. Write sanitization error handling tests
3. Write concurrent validation tests
4. Create production rules corpus (50+ rules from staging/docs)
5. Write regression corpus tests
6. Verify zero false positives on production rules

### Phase 6: Integration & Expert Review (3 hours)
1. Run full test suite (100% pass rate + >70% mutation score)
2. Performance benchmarks (10KB and 64KB inputs)
3. Security expert re-review (target 9.5/10)
4. QA expert re-review (target 9.5/10)
5. Address any remaining P1 issues
6. Commit implementation

**Total Estimated Effort:** 22 hours (3-4 days, updated from 1 day)

## Out of Scope

- Content Security Policy (CSP) headers - requires backend changes (separate PRD)
- Backend rate limiting - out of scope for frontend-only PRD
- Memory profiling and optimization - separate performance PRD
- DOMPurify integration - custom context-aware sanitization more appropriate
- RE2 regex engine integration - future enhancement for complete ReDoS elimination
- AI-powered error correction - future UX enhancement

## References

- **PRD-010b:** Real-Time DSL Validation Feedback (parent PRD)
- **Security Expert Review:** 7.5/10 - Identified 3 P0 issues (ReDoS, XSS, recursion bypass)
- **QA Expert Review:** 6.5/10 - Identified 4 P0 testing gaps (mutation, boundary, failure, regression)
- **OWASP XSS Prevention:** https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- **ReDoS Prevention:** https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS
- **Mutation Testing (Stryker):** https://stryker-mutator.io/docs/stryker-js/introduction/
- **Context-Aware Output Encoding:** https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#output-encoding

## Acceptance Criteria (Updated)

### Security (P0)
- [ ] All input size limits enforced (64KB DSL, 10KB strings, 100 char identifiers)
- [ ] Context-aware sanitization for all output contexts (HTML/JS/JSON/Markdown)
- [ ] Global recursion depth tracking prevents mutual recursion bypass
- [ ] No XSS vulnerabilities in error messages
- [ ] No ReDoS vulnerabilities (< 100ms worst-case)
- [ ] Security expert approval (9.5/10 target)

### Testing (P0)
- [ ] Mutation score >70% for security-critical files
- [ ] All boundary conditions tested (±1 byte/char/level)
- [ ] All failure scenarios have tests
- [ ] Production regression corpus (50+ rules) passes
- [ ] 95%+ instruction coverage, 90%+ branch coverage
- [ ] QA expert approval (9.5/10 target)

### Quality
- [ ] Zero false positives on production rules
- [ ] Performance benchmarks meet targets (<10ms for 10KB, <50ms for 64KB)
- [ ] All tests pass (100% pass rate)
- [ ] Code review approval from both experts

## Open Questions (Resolved)

1. **Should we add CSP headers?** → ✅ Deferred to separate PRD (out of scope)
2. **Should we use DOMPurify?** → ✅ No, context-aware sanitization more appropriate
3. **What should MAX_STRING_LENGTH be?** → ✅ 10,000 chars (allows 10KB JSON in where clauses)
4. **What should MAX_RECURSION_DEPTH be?** → ✅ 50 levels (more than enough for realistic rules)
5. **What should MAX_TOTAL_DSL_LENGTH be?** → ✅ 64KB (reasonable for complex rules)
6. **What should MAX_IDENTIFIER_LENGTH be?** → ✅ 100 chars (prevents abuse)
7. **How to prevent mutual recursion bypass?** → ✅ Global call depth tracking across all methods
8. **Which output contexts need sanitization?** → ✅ HTML, JavaScript, JSON, Markdown (Monaco hover)
