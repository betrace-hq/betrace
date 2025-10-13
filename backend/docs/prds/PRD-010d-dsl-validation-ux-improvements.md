# PRD-010d: DSL Validation UX Improvements

**Status:** Draft (Revised)
**Priority:** P1
**Component:** BFF (Frontend)
**Estimated Effort:** 4-5 days (updated after expert reviews)
**Parent:** PRD-010b (Real-Time DSL Validation Feedback)
**Revision:** v2 - Addresses security (6/10) and QA (6/10) expert reviews

## Context

PRD-010b implemented real-time DSL validation with Monaco integration. Expert reviews identified critical security gaps and insufficient testing strategy that must be addressed for production readiness.

**Security Review Score:** 6/10 → Target 9.5/10
**QA Review Score:** 6/10 → Target 9.5/10

**Expert Review Findings:**
- **Security P1:** Information disclosure via error messages, XSS risks in ARIA/Monaco, resource exhaustion
- **QA P0:** No accessibility testing strategy, Monaco integration risks underestimated, no cross-browser plan, insufficient error recovery tests

## Problem Statement

The DSL validation UI has critical security and quality gaps identified by expert reviews:

### Security Issues (P1)
1. **Information Disclosure** - Error messages could leak API keys, PII, sensitive data
2. **XSS via ARIA Labels** - Monaco hover and ARIA attributes not sanitized
3. **XSS via Monaco Hover** - Markdown rendering could execute malicious content
4. **Resource Exhaustion** - No rate limiting on validation endpoint
5. **PII in Screen Reader** - ARIA labels expose sensitive data audibly

### UX/Accessibility Issues (P1)
1. **Missing ARIA Labels** - ValidationFeedback component not accessible to screen readers
2. **No Error Recovery Guidance** - Multiple errors shown but no incremental fix workflow
3. **Debounce Cancellation Gap** - Validation continues even after component unmounts
4. **Missing Monaco Hover Provider** - No inline error details on hover in editor

### Testing Gaps (P0)
1. **No Accessibility Testing** - WCAG compliance unverified (need axe-core, screen readers)
2. **Monaco Integration Risks** - Race conditions, debounce, browser quirks untested
3. **No Cross-Browser Plan** - Chrome/Firefox/Safari/screen reader matrix missing
4. **Error Recovery Untested** - Undo/redo, concurrent validation edge cases missing

## Goals

### Primary Goals
- **Security:** Sanitize error messages, add rate limiting, prevent information disclosure
- **Accessibility:** Add ARIA labels, axe-core testing, screen reader validation
- **UX:** Error recovery guidance, Monaco hover provider, debounce cancellation
- **Testing:** Cross-browser matrix, Monaco integration tests, accessibility audit

### Non-Goals
- Full WCAG 2.1 AAA compliance (targeting AA only)
- AI-powered error correction (future enhancement)
- Multi-language error messages (i18n is separate effort)
- Backend rate limiting implementation (requires separate backend PRD)
- Full Playwright E2E test suite (add critical paths only)

## P1 QA Issues (From Expert Review)

### 1. Missing ARIA Accessibility

**Current Code** (`validation-feedback.tsx:50-70`):
```tsx
return (
  <Alert className={`border-green-200 bg-green-50 dark:bg-green-950/20 ${className}`}>
    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
    <AlertTitle className="text-green-800 dark:text-green-300">Valid Expression</AlertTitle>
    <AlertDescription className="text-green-700 dark:text-green-400">
      Your FLUO DSL expression is syntactically correct.
    </AlertDescription>
  </Alert>
);
```

**Issue:** Missing ARIA attributes for screen readers:
- No `role="status"` or `aria-live="polite"` for dynamic validation updates
- No `aria-label` describing validation state
- Icon decorations not marked as `aria-hidden="true"`

**Impact:** Screen reader users cannot perceive validation feedback.

**Fix:** Add proper ARIA attributes and semantic HTML.

### 2. No Error Recovery Guidance

**Current Code** (`validation-feedback.tsx:75-95`):
```tsx
{validation.errors.map((error, index) => (
  <Alert key={`error-${index}`} variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>
      Syntax Error at line {error.line}, column {error.column}
    </AlertTitle>
    <AlertDescription>
      <p className="font-medium">{error.message}</p>
      {error.suggestion && (
        <p className="mt-2 text-sm">
          <strong>💡 Suggestion:</strong> {error.suggestion}
        </p>
      )}
    </AlertDescription>
  </Alert>
))}
```

**Issue:** When multiple errors exist, no guidance on fixing them incrementally:
- User sees 5 errors, fixes first one, re-validates, sees 4 errors
- No indication which error to fix first
- No "Fix This" action button to jump to error location

**Impact:** Poor UX when learning DSL syntax.

**Fix:** Add priority indicators and "Fix This" action buttons.

### 3. Debounce Cancellation Gap

**Current Code** (`use-dsl-validation.ts:25-45`):
```typescript
useEffect(() => {
  if (!expression || !expression.trim()) {
    setValidation({
      valid: false,
      errors: [{ /* ... */ }],
      warnings: [],
    });
    setIsValidating(false);
    return;
  }

  setIsValidating(true);

  const timeoutId = setTimeout(() => {
    const result = validateDslExpression(expression);
    result.errors = result.errors.map(enhanceError);

    if (detectMistakes) {
      const mistakes = detectCommonMistakes(expression);
      result.warnings.push(...mistakes);
    }

    setValidation(result);
    setIsValidating(false);
  }, debounceMs);

  return () => clearTimeout(timeoutId); // Only clears timeout, not validation
}, [expression, debounceMs, detectMistakes]);
```

**Issue:** Cleanup function only cancels timeout, but if validation is already running:
- Component unmounts
- Validation completes
- `setValidation()` called on unmounted component → React warning

**Impact:** Console warnings, potential memory leak in fast navigation scenarios.

**Fix:** Use `useRef` to track mount status and skip state updates after unmount.

### 4. Missing Monaco Hover Provider

**Current Code** (`monaco-rule-editor.tsx:85-95`):
```typescript
// Set markers on the model
monacoRef.current.editor.setModelMarkers(model, 'fluo-dsl-validator', markers);
```

**Issue:** Markers show red squiggles but hovering over them doesn't show error details inline (user must look at ValidationFeedback component below editor).

**Expected Behavior:** Hovering over red squiggle shows tooltip with:
- Error message
- Suggestion
- Code example

**Impact:** Reduced discoverability of error details.

**Fix:** Register Monaco hover provider with formatted error messages.

## Security Considerations (NEW - Required by Security Review)

**Security Expert Feedback:** P1 security gaps must be addressed before production deployment.

### 1. Information Disclosure Prevention

**Risk:** Error messages may contain sensitive data from user DSL (API keys, tokens, PII).

**Mitigation:**
```typescript
// New file: bff/src/lib/validation/sensitive-data-redaction.ts

const SENSITIVE_PATTERNS = [
  { pattern: /(sk_live_|pk_live_)\w+/g, replacement: '***REDACTED_API_KEY***' },
  { pattern: /\b\d{16}\b/g, replacement: '***REDACTED_CARD***' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '***REDACTED_EMAIL***' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '***REDACTED_SSN***' },
  { pattern: /\/[a-z0-9]{8,}/gi, replacement: '/***REDACTED_ID***' },
];

export function redactSensitiveData(message: string): string {
  let redacted = message;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

// Usage
const getSafeErrorMessage = (error: ValidationError): string => {
  const sanitized = sanitizeErrorMessage(error.message, OutputContext.HTML);
  return redactSensitiveData(sanitized);
};
```

### 2. XSS Prevention (ARIA and Monaco)

**Risk:** Unsanitized error messages in ARIA labels and Monaco hover could enable XSS.

**Mitigation:**
```typescript
// Sanitize for ARIA attributes (HTML context)
<div
  role="alert"
  aria-label={sanitizeErrorMessage(error.message, OutputContext.HTML)}
  aria-live="polite"
>

// Sanitize for Monaco hover (Markdown context)
provideHover: (model, position) => {
  const error = getErrorAtPosition(position);
  return {
    contents: [{
      value: sanitizeErrorMessage(error.message, OutputContext.MARKDOWN)
    }]
  };
}
```

### 3. Rate Limiting (Frontend Protection)

**Risk:** No rate limiting on validation endpoint could enable DoS attacks.

**Mitigation:**
```typescript
// Client-side request throttling
import { throttle } from 'lodash-es';

const throttledValidate = throttle(
  async (dsl: string) => {
    const controller = new AbortController();
    try {
      return await fetch('/api/rules/validate', {
        method: 'POST',
        body: dsl,
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        // Request cancelled
      }
      throw error;
    }
  },
  1000, // Max 1 request per second
  { leading: true, trailing: true }
);
```

**Note:** Backend rate limiting (10 req/min per tenant) is out of scope for this PRD.

### 4. Screen Reader PII Protection

**Risk:** ARIA labels expose sensitive data audibly to bystanders.

**Mitigation:**
```typescript
const getAccessibleErrorMessage = (error: ValidationError): string => {
  const sanitized = sanitizeErrorMessage(error.message, OutputContext.HTML);
  const redacted = redactSensitiveData(sanitized);
  return `Validation error at line ${error.line}: ${redacted}`;
};

<div
  role="alert"
  aria-label={getAccessibleErrorMessage(error)}
  aria-live="polite"
>
```

## Technical Approach

### Fix 1: ARIA Accessibility

**Implementation:**
```tsx
// validation-feedback.tsx

export function ValidationFeedback({
  validation,
  isValidating,
  className = '',
}: ValidationFeedbackProps) {
  // Validating state
  if (isValidating) {
    return (
      <Alert
        className={className}
        role="status"
        aria-live="polite"
        aria-label="Validating DSL expression"
      >
        <Info className="h-4 w-4 animate-pulse" aria-hidden="true" />
        <AlertTitle>Validating...</AlertTitle>
        <AlertDescription>Checking your DSL expression for errors...</AlertDescription>
      </Alert>
    );
  }

  if (!validation) return null;

  // Valid expression (success state)
  if (validation.valid && validation.errors.length === 0) {
    return (
      <Alert
        className={`border-green-200 bg-green-50 dark:bg-green-950/20 ${className}`}
        role="status"
        aria-live="polite"
        aria-label="DSL expression is valid"
      >
        <CheckCircle
          className="h-4 w-4 text-green-600 dark:text-green-400"
          aria-hidden="true"
        />
        <AlertTitle className="text-green-800 dark:text-green-300">
          Valid Expression
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400">
          Your FLUO DSL expression is syntactically correct.
        </AlertDescription>
      </Alert>
    );
  }

  // Errors and warnings
  return (
    <div
      className={`space-y-2 ${className}`}
      role="region"
      aria-label={`${validation.errors.length} syntax errors found`}
    >
      {validation.errors.map((error, index) => (
        <Alert
          key={`error-${index}`}
          variant="destructive"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>
            Syntax Error at line {error.line}, column {error.column}
          </AlertTitle>
          <AlertDescription>
            <p className="font-medium">{error.message}</p>
            {error.suggestion && (
              <p className="mt-2 text-sm">
                <strong>💡 Suggestion:</strong> {error.suggestion}
              </p>
            )}
            {error.example && (
              <pre
                className="mt-2 rounded bg-slate-900 p-2 text-xs text-slate-100"
                aria-label="Code example"
              >
                <code>{error.example}</code>
              </pre>
            )}
          </AlertDescription>
        </Alert>
      ))}

      {validation.warnings.length > 0 && (
        <details className="mt-2">
          <summary
            className="cursor-pointer text-sm text-yellow-700 dark:text-yellow-400"
            aria-label={`${validation.warnings.length} warnings (click to expand)`}
          >
            ⚠️ {validation.warnings.length} warning(s)
          </summary>
          <div className="mt-2 space-y-2" role="list">
            {validation.warnings.map((warning, index) => (
              <Alert
                key={`warning-${index}`}
                className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20"
                role="listitem"
              >
                <AlertCircle
                  className="h-4 w-4 text-yellow-600 dark:text-yellow-400"
                  aria-hidden="true"
                />
                <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                  Warning at line {warning.line}, column {warning.column}
                </AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                  <p className="font-medium">{warning.message}</p>
                  {warning.suggestion && (
                    <p className="mt-2 text-sm">
                      <strong>💡 Suggestion:</strong> {warning.suggestion}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
```

**Key Changes:**
- Add `role="status"`, `role="alert"`, `role="region"` for semantic meaning
- Add `aria-live="polite"` (status) and `aria-live="assertive"` (errors)
- Add `aria-label` describing validation state
- Mark decorative icons with `aria-hidden="true"`
- Wrap warnings in collapsible `<details>` with `role="list"`

### Fix 2: Error Recovery Guidance

**Implementation:**
```tsx
// validation-feedback.tsx

interface ValidationFeedbackProps {
  validation: ParseResult | null;
  isValidating: boolean;
  className?: string;
  onFixError?: (error: ValidationError) => void; // NEW
}

export function ValidationFeedback({
  validation,
  isValidating,
  className = '',
  onFixError,
}: ValidationFeedbackProps) {
  // ... existing code

  const handleFixError = (error: ValidationError) => {
    if (onFixError) {
      onFixError(error);
    }
  };

  return (
    <div
      className={`space-y-2 ${className}`}
      role="region"
      aria-label={`${validation.errors.length} syntax errors found`}
    >
      {validation.errors.length > 1 && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>💡 Tip:</strong> Fix errors one at a time starting with the first one.
            Fixing early errors may resolve later ones automatically.
          </p>
        </div>
      )}

      {validation.errors.map((error, index) => (
        <Alert
          key={`error-${index}`}
          variant="destructive"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle className="flex items-center justify-between">
            <span>
              {index === 0 && <span className="mr-2 text-xs font-bold">🎯 FIX THIS FIRST</span>}
              Syntax Error at line {error.line}, column {error.column}
            </span>
            {onFixError && (
              <button
                onClick={() => handleFixError(error)}
                className="ml-2 rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-800"
                aria-label={`Jump to error at line ${error.line}, column ${error.column}`}
              >
                Fix This →
              </button>
            )}
          </AlertTitle>
          <AlertDescription>
            <p className="font-medium">{error.message}</p>
            {error.suggestion && (
              <p className="mt-2 text-sm">
                <strong>💡 Suggestion:</strong> {error.suggestion}
              </p>
            )}
            {error.example && (
              <pre
                className="mt-2 rounded bg-slate-900 p-2 text-xs text-slate-100"
                aria-label="Code example"
              >
                <code>{error.example}</code>
              </pre>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
```

**Usage in rule-editor.tsx:**
```tsx
const handleFixError = (error: ValidationError) => {
  // Focus Monaco editor and set cursor to error position
  if (editorRef.current) {
    editorRef.current.focus();
    editorRef.current.setPosition({
      lineNumber: error.line,
      column: error.column,
    });
    editorRef.current.revealPositionInCenter({
      lineNumber: error.line,
      column: error.column,
    });
  }
};

<ValidationFeedback
  validation={dslValidation}
  isValidating={false}
  onFixError={handleFixError}
/>
```

**Key Changes:**
- Add "🎯 FIX THIS FIRST" badge to first error
- Add "Fix This →" button that jumps to error location in Monaco
- Show tip when multiple errors exist
- Pass `onFixError` callback from parent component

### Fix 3: Debounce Cancellation

**Implementation:**
```typescript
// use-dsl-validation.ts

export function useDslValidation(
  expression: string,
  options: UseDslValidationOptions = {}
): UseDslValidationResult {
  const { debounceMs = 300, detectMistakes = true } = options;

  const [validation, setValidation] = useState<ParseResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const isMountedRef = useRef(true); // NEW

  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false; // Mark as unmounted
    };
  }, []);

  useEffect(() => {
    if (!expression || !expression.trim()) {
      if (isMountedRef.current) {
        setValidation({
          valid: false,
          errors: [{
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 1,
            message: 'Expression cannot be empty',
            severity: 'error',
            suggestion: 'Start with "trace.has()" or "trace.count()"',
          }],
          warnings: [],
        });
        setIsValidating(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsValidating(true);
    }

    const timeoutId = setTimeout(() => {
      // Check if still mounted before running validation
      if (!isMountedRef.current) return;

      const result = validateDslExpression(expression);
      result.errors = result.errors.map(enhanceError);

      if (detectMistakes) {
        const mistakes = detectCommonMistakes(expression);
        result.warnings.push(...mistakes);
      }

      // Check again before setting state
      if (isMountedRef.current) {
        setValidation(result);
        setIsValidating(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      // Don't set isMountedRef here, the outer useEffect handles it
    };
  }, [expression, debounceMs, detectMistakes]);

  return { validation, isValidating };
}
```

**Key Changes:**
- Add `isMountedRef` to track component mount status
- Check `isMountedRef.current` before all state updates
- Separate mount/unmount effect from validation effect

### Fix 4: Monaco Hover Provider

**Implementation:**
```typescript
// monaco-rule-editor.tsx

const handleEditorDidMount: OnMount = (editor, monaco) => {
  editorRef.current = editor;
  monacoRef.current = monaco;

  // Register FLUO DSL language if not already registered
  if (!isRegistered.current) {
    monaco.languages.register({ id: 'fluo-dsl' });

    // ... existing tokenizer registration

    // Register hover provider for inline error details
    monaco.languages.registerHoverProvider('fluo-dsl', {
      provideHover: (model, position) => {
        const markers = monaco.editor.getModelMarkers({
          resource: model.uri,
          owner: 'fluo-dsl-validator',
        });

        // Find marker at cursor position
        const marker = markers.find(
          (m) =>
            m.startLineNumber <= position.lineNumber &&
            m.endLineNumber >= position.lineNumber &&
            m.startColumn <= position.column &&
            m.endColumn >= position.column
        );

        if (!marker) return null;

        // Format hover content with markdown
        const contents = [
          {
            value: `**${marker.severity === monaco.MarkerSeverity.Error ? '❌ Error' : '⚠️ Warning'}**`,
          },
          { value: marker.message },
        ];

        return {
          range: new monaco.Range(
            marker.startLineNumber,
            marker.startColumn,
            marker.endLineNumber,
            marker.endColumn
          ),
          contents,
        };
      },
    });

    isRegistered.current = true;
  }

  // ... existing focus logic
};
```

**Key Changes:**
- Register `registerHoverProvider` for 'fluo-dsl' language
- Find marker at cursor position in `provideHover()`
- Return formatted hover content with markdown
- Show error/warning badge and full message including suggestions

## Test Requirements

### Accessibility Tests (New File: `validation-feedback.accessibility.test.tsx`)

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationFeedback } from '../validation-feedback';
import type { ParseResult } from '@/lib/validation/dsl-parser';

describe('ValidationFeedback - Accessibility', () => {
  it('has role="status" for validating state', () => {
    const { container } = render(
      <ValidationFeedback validation={null} isValidating={true} />
    );

    const alert = container.querySelector('[role="status"]');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });

  it('has role="alert" for error state', () => {
    const validation: ParseResult = {
      valid: false,
      errors: [
        {
          line: 1,
          column: 5,
          endLine: 1,
          endColumn: 10,
          message: 'Test error',
          severity: 'error',
        },
      ],
      warnings: [],
    };

    const { container } = render(
      <ValidationFeedback validation={validation} isValidating={false} />
    );

    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('marks decorative icons as aria-hidden', () => {
    const validation: ParseResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const { container } = render(
      <ValidationFeedback validation={validation} isValidating={false} />
    );

    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('provides aria-label for error region', () => {
    const validation: ParseResult = {
      valid: false,
      errors: [
        { line: 1, column: 5, endLine: 1, endColumn: 10, message: 'Error 1', severity: 'error' },
        { line: 2, column: 3, endLine: 2, endColumn: 8, message: 'Error 2', severity: 'error' },
      ],
      warnings: [],
    };

    const { container } = render(
      <ValidationFeedback validation={validation} isValidating={false} />
    );

    const region = container.querySelector('[role="region"]');
    expect(region).toHaveAttribute('aria-label', '2 syntax errors found');
  });
});
```

### Error Recovery Tests (New File: `validation-feedback.ux.test.tsx`)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValidationFeedback } from '../validation-feedback';
import type { ParseResult, ValidationError } from '@/lib/validation/dsl-parser';

describe('ValidationFeedback - Error Recovery UX', () => {
  it('shows "FIX THIS FIRST" badge on first error', () => {
    const validation: ParseResult = {
      valid: false,
      errors: [
        { line: 1, column: 5, endLine: 1, endColumn: 10, message: 'Error 1', severity: 'error' },
        { line: 2, column: 3, endLine: 2, endColumn: 8, message: 'Error 2', severity: 'error' },
      ],
      warnings: [],
    };

    render(<ValidationFeedback validation={validation} isValidating={false} />);

    expect(screen.getByText('🎯 FIX THIS FIRST')).toBeInTheDocument();
  });

  it('shows tip when multiple errors exist', () => {
    const validation: ParseResult = {
      valid: false,
      errors: [
        { line: 1, column: 5, endLine: 1, endColumn: 10, message: 'Error 1', severity: 'error' },
        { line: 2, column: 3, endLine: 2, endColumn: 8, message: 'Error 2', severity: 'error' },
      ],
      warnings: [],
    };

    render(<ValidationFeedback validation={validation} isValidating={false} />);

    expect(screen.getByText(/Fix errors one at a time/i)).toBeInTheDocument();
  });

  it('calls onFixError when "Fix This" button clicked', async () => {
    const user = userEvent.setup();
    const onFixError = vi.fn();
    const error: ValidationError = {
      line: 1,
      column: 5,
      endLine: 1,
      endColumn: 10,
      message: 'Test error',
      severity: 'error',
    };

    const validation: ParseResult = {
      valid: false,
      errors: [error],
      warnings: [],
    };

    render(
      <ValidationFeedback
        validation={validation}
        isValidating={false}
        onFixError={onFixError}
      />
    );

    const button = screen.getByRole('button', { name: /Jump to error/i });
    await user.click(button);

    expect(onFixError).toHaveBeenCalledWith(error);
  });
});
```

### Debounce Cancellation Tests (Added to `use-dsl-validation.test.ts`)

```typescript
describe('useDslValidation - Cleanup', () => {
  it('cancels pending validation on unmount', async () => {
    const { result, unmount } = renderHook(
      ({ expr }) => useDslValidation(expr, { debounceMs: 500 }),
      { initialProps: { expr: 'trace.has(test)' } }
    );

    expect(result.current.isValidating).toBe(true);

    // Unmount before validation completes
    unmount();

    // Wait longer than debounce
    await new Promise(resolve => setTimeout(resolve, 600));

    // Should not cause React warnings about updating unmounted component
  });

  it('does not update state after unmount', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(
      ({ expr }) => useDslValidation(expr, { debounceMs: 100 }),
      { initialProps: { expr: 'trace.has(test)' } }
    );

    unmount();

    await new Promise(resolve => setTimeout(resolve, 200));

    // No React warnings
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('unmounted component')
    );

    consoleError.mockRestore();
  });
});
```

### Monaco Hover Tests (Added to `monaco-rule-editor.test.tsx`)

```typescript
describe('MonacoRuleEditor - Hover Provider', () => {
  it('registers hover provider for FLUO DSL', async () => {
    const { container } = render(
      <MonacoRuleEditor value="trace.has(invalid syntax" onChange={() => {}} />
    );

    await waitFor(() => {
      const editor = container.querySelector('.monaco-editor');
      expect(editor).toBeInTheDocument();
    });

    // Verify hover provider is registered
    // (Implementation depends on Monaco testing setup)
  });

  it('shows error details on hover', async () => {
    // Test requires Monaco editor instance
    // Verify that hovering over red squiggle shows tooltip
  });
});
```

### Security Tests (NEW - Required by Security Review)

```typescript
import { describe, it, expect } from 'vitest';
import { redactSensitiveData } from '../sensitive-data-redaction';
import { sanitizeErrorMessage, OutputContext } from '../sanitize';

describe('Validation Security', () => {
  describe('Information Disclosure Prevention', () => {
    it('redacts API keys from error messages', () => {
      const message = 'Invalid token: sk_live_abc123xyz';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('sk_live_abc123xyz');
      expect(redacted).toContain('***REDACTED_API_KEY***');
    });

    it('redacts credit card numbers', () => {
      const message = 'Card number: 1234567890123456';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('1234567890123456');
      expect(redacted).toContain('***REDACTED_CARD***');
    });

    it('redacts email addresses', () => {
      const message = 'Email: user@example.com';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('user@example.com');
      expect(redacted).toContain('***REDACTED_EMAIL***');
    });

    it('redacts SSNs', () => {
      const message = 'SSN: 123-45-6789';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('123-45-6789');
      expect(redacted).toContain('***REDACTED_SSN***');
    });
  });

  describe('XSS Prevention', () => {
    it('sanitizes HTML for ARIA labels', () => {
      const malicious = '<script>alert("XSS")</script>';
      const sanitized = sanitizeErrorMessage(malicious, OutputContext.HTML);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('sanitizes Markdown for Monaco hover', () => {
      const malicious = '[Click](javascript:alert("XSS"))';
      const sanitized = sanitizeErrorMessage(malicious, OutputContext.MARKDOWN);
      expect(sanitized).not.toContain('[Click]');
      expect(sanitized).toContain('\\[Click\\]');
    });
  });

  describe('Rate Limiting', () => {
    it('throttles validation requests to 1 per second', async () => {
      const validateSpy = vi.fn();
      const throttledValidate = throttle(validateSpy, 1000);

      // Rapid fire 5 requests
      for (let i = 0; i < 5; i++) {
        throttledValidate(`test${i}`);
      }

      // Should only call once immediately
      expect(validateSpy).toHaveBeenCalledTimes(1);

      // Wait for throttle period
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should call once more (trailing edge)
      expect(validateSpy).toHaveBeenCalledTimes(2);
    });
  });
});
```

### Monaco Integration Tests (NEW - Required by QA Review)

```typescript
describe('Monaco Editor Integration', () => {
  it('debounces validation during rapid typing', async () => {
    const user = userEvent.setup({ delay: null });
    const validateSpy = vi.fn();

    render(<RuleEditor onValidate={validateSpy} debounceMs={500} />);
    const editor = screen.getByRole('textbox');

    await user.type(editor, 'trace.has(span)');

    // Should not validate on every keystroke
    expect(validateSpy).toHaveBeenCalledTimes(0);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledTimes(1);
    }, { timeout: 600 });
  });

  it('shows hover tooltip after debounce delay', async () => {
    render(<RuleEditor value="invalid syntax" />);
    const editor = screen.getByRole('textbox');

    fireEvent.mouseMove(editor, { clientX: 10, clientY: 10 });

    // Should not show immediately
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Should show after debounce
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Syntax Error');
    }, { timeout: 600 });
  });

  it('handles editor unmount during validation', async () => {
    const { unmount } = render(<RuleEditor />);
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox'), 'invalid');

    // Unmount before validation completes
    unmount();

    // Should not throw or cause memory leaks
    await new Promise(resolve => setTimeout(resolve, 600));
  });

  it('preserves undo stack after "Fix This"', async () => {
    const user = userEvent.setup();
    render(<RuleEditor />);

    await user.type(screen.getByRole('textbox'), 'trace.has(');
    await user.click(screen.getByText('Fix This'));

    // Should be able to undo the fix
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByRole('textbox')).toHaveValue('trace.has(');
  });

  it('handles concurrent validation during fix', async () => {
    const validateSpy = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<RuleEditor onValidate={validateSpy} />);
    await user.type(screen.getByRole('textbox'), 'invalid');

    const fixButton = screen.getByText('Fix This');
    await user.click(fixButton);

    // Should not apply stale fix suggestion
    expect(screen.getByRole('textbox')).not.toHaveValue('invalid');
  });
});
```

### Accessibility Testing with axe-core (NEW - Required by QA Review)

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

describe('Accessibility Audit', () => {
  it('passes axe audit for validation feedback', async () => {
    const { container } = render(
      <ValidationFeedback
        validation={{
          valid: false,
          errors: [{ line: 1, column: 5, endLine: 1, endColumn: 10, message: 'Error', severity: 'error' }],
          warnings: [],
        }}
        isValidating={false}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('passes axe audit for rule editor', async () => {
    const { container } = render(<RuleEditor />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard-only navigation', async () => {
    const user = userEvent.setup();
    render(<RuleEditor />);

    await user.tab(); // Focus editor
    expect(document.activeElement).toBe(screen.getByRole('textbox'));

    await user.keyboard('{Control>}M{/Control}'); // Format
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
});
```

### Cross-Browser Testing Strategy (NEW - Required by QA Review)

**Setup Playwright:**
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

**Critical Path E2E Tests:**
```typescript
// e2e/rule-editor.spec.ts
import { test, expect } from '@playwright/test';

test('validates DSL in Chrome, Firefox, Safari', async ({ page, browserName }) => {
  await page.goto('/rules/new');

  const editor = page.locator('[data-testid="rule-editor"]');
  await editor.fill('trace.has(invalid');

  // Should show error after debounce
  await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 1000 });
  await expect(page.locator('[role="alert"]')).toContainText('Syntax Error');
});

test('Monaco hover works in all browsers', async ({ page }) => {
  await page.goto('/rules/new');

  const editor = page.locator('[data-testid="rule-editor"]');
  await editor.fill('invalid syntax');

  // Hover over error
  await editor.hover({ position: { x: 10, y: 10 } });

  // Should show tooltip
  await expect(page.locator('[role="tooltip"]')).toBeVisible({ timeout: 600 });
});
```

**Screen Reader Testing (Manual QA):**
- NVDA (Windows) - All ARIA labels announced correctly
- JAWS (Windows) - Validation errors announced
- VoiceOver (macOS) - Focus management works
- VoiceOver (iOS) - Touch gestures supported

**Test Coverage Targets (Updated):**
- Accessibility tests: 30+ tests (axe-core + manual screen reader)
- Security tests: 10+ tests (info disclosure, XSS, rate limiting)
- Monaco integration: 15+ tests (debounce, hover, lifecycle)
- Cross-browser E2E: 10+ critical paths (Chrome/Firefox/Safari)
- Overall instruction coverage: 95%+
- Accessibility audit: Zero WCAG 2.1 AA violations
- Overall test pass rate: 100% (maintained)

## Success Metrics (Updated)

### Security Metrics (New)
- ✅ All error messages sanitized (HTML/JS/JSON/Markdown contexts)
- ✅ Sensitive data redacted (API keys, cards, emails, SSNs)
- ✅ Client-side rate limiting (1 req/sec throttle)
- ✅ Zero XSS vulnerabilities in ARIA/Monaco
- ✅ PII protected in screen reader announcements
- ✅ Security review score: 6/10 → 9.5/10

### Accessibility Metrics
- ✅ All alerts have proper ARIA roles and labels
- ✅ Screen reader announces validation state changes
- ✅ Decorative icons marked with aria-hidden
- ✅ Keyboard navigation works for all interactive elements
- ✅ Zero axe-core violations (WCAG 2.1 AA)
- ✅ Manual screen reader testing passed (NVDA, JAWS, VoiceOver)

### UX Metrics
- ✅ "FIX THIS FIRST" badge visible on first error
- ✅ "Fix This" button jumps to error in Monaco
- ✅ Tip shown when multiple errors exist
- ✅ No React console warnings on unmount
- ✅ Monaco hover shows errors inline
- ✅ Undo/redo preserved after "Fix This"

### Performance Metrics
- ✅ No memory leaks on fast navigation
- ✅ Validation cancels properly on unmount
- ✅ Hover provider responds in < 50ms
- ✅ Debounce prevents excessive validation (1 call per 500ms)

### Cross-Browser Metrics (New)
- ✅ Works in Chrome, Firefox, Safari (Playwright E2E)
- ✅ Monaco integration stable across browsers
- ✅ Screen reader compatible (NVDA, JAWS, VoiceOver)

### Test Coverage (Updated)
- Security tests: 10+ tests (info disclosure, XSS, rate limiting)
- Accessibility tests: 30+ tests (axe-core + ARIA + keyboard)
- Monaco integration: 15+ tests (debounce, hover, lifecycle, undo)
- Cross-browser E2E: 10+ critical paths (Playwright)
- Overall instruction coverage: 95%+
- Overall test pass rate: 100% (maintained)
- QA review score: 6/10 → 9.5/10

## Implementation Plan (Updated)

### Phase 1: Security Foundation (6 hours)
1. Create `sensitive-data-redaction.ts` with regex patterns
2. Integrate with `sanitize.ts` from PRD-010c
3. Update error message pipeline (parser → sanitize → redact → display)
4. Add client-side throttling (1 req/sec)
5. Update ARIA labels to use redacted messages
6. Update Monaco hover to use Markdown sanitization
7. Write security tests (10+ tests for info disclosure, XSS, rate limiting)
8. Verify no sensitive data in error messages

### Phase 2: ARIA Accessibility with axe-core (6 hours)
1. Install `jest-axe` and `@axe-core/react`
2. Add `role`, `aria-live`, `aria-label` attributes (using redacted messages)
3. Mark decorative icons with `aria-hidden="true"`
4. Wrap warnings in `<details>` with `role="list"`
5. Write axe-core audit tests
6. Write keyboard navigation tests
7. Fix all WCAG 2.1 AA violations
8. Manual screen reader testing (NVDA, VoiceOver)

### Phase 3: Error Recovery & UX (4 hours)
1. Add "🎯 FIX THIS FIRST" badge to first error
2. Add "Fix This →" button with `onFixError` callback
3. Implement cursor jump in rule-editor.tsx with undo preservation
4. Show tip when multiple errors exist
5. Add `isMountedRef` to use-dsl-validation.ts
6. Write error recovery tests (undo/redo, concurrent validation)
7. Write cleanup tests (debounce cancellation)

### Phase 4: Monaco Integration & Hover (5 hours)
1. Register `registerHoverProvider` with sanitization
2. Implement `provideHover()` with Markdown context
3. Add debounce to hover provider (500ms)
4. Write Monaco integration tests (15+ tests)
5. Test undo stack preservation
6. Test concurrent validation scenarios
7. Verify tooltips in all browsers

### Phase 5: Cross-Browser Testing (8 hours)
1. Install Playwright and configure for 3 browsers
2. Create `playwright.config.ts`
3. Write critical path E2E tests (10+ tests)
4. Test DSL validation in Chrome/Firefox/Safari
5. Test Monaco hover in all browsers
6. Test keyboard navigation across browsers
7. Fix browser-specific bugs
8. Document browser compatibility

### Phase 6: Integration & Expert Review (3 hours)
1. Run full test suite (100% pass rate, 95%+ coverage)
2. Run axe-core audit (zero violations)
3. Manual accessibility audit with screen readers
4. Performance testing (no memory leaks, < 50ms hover)
5. Security expert re-review (target 9.5/10)
6. QA expert re-review (target 9.5/10)
7. Address any remaining P1 issues
8. Commit implementation

**Total Estimated Effort:** 32 hours (4-5 days, updated from 1 day)

## Out of Scope

- Full WCAG 2.1 AAA compliance audit - requires dedicated accessibility expert (targeting AA only)
- Backend rate limiting implementation - requires separate backend PRD
- AI-powered error correction ("Fix this automatically") - future enhancement
- Multi-language error messages (i18n) - separate internationalization PRD
- Voice input for DSL editing - advanced accessibility feature
- Full Playwright E2E suite - implementing critical paths only

## References

- **PRD-010b:** Real-Time DSL Validation Feedback (parent PRD)
- **PRD-010c:** DSL Parser Security Hardening (sibling PRD with sanitize.ts)
- **Security Expert Review:** 6/10 - Identified 3 P1 issues (info disclosure, XSS, rate limiting)
- **QA Expert Review:** 6/10 - Identified 4 P0 issues (accessibility, Monaco, cross-browser, testing)
- **WCAG 2.1 AA:** https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa
- **ARIA Authoring Practices:** https://www.w3.org/WAI/ARIA/apg/
- **axe-core:** https://github.com/dequelabs/axe-core
- **Playwright Testing:** https://playwright.dev/docs/intro
- **OWASP XSS Prevention:** https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

## Acceptance Criteria (Updated)

### Security (P1)
- [ ] All error messages sanitized with context-aware escaping
- [ ] Sensitive data redacted (API keys, cards, emails, SSNs, UUIDs)
- [ ] Client-side rate limiting (1 req/sec throttle)
- [ ] Zero XSS vulnerabilities (all contexts tested)
- [ ] PII protected in screen reader announcements
- [ ] Security expert approval (9.5/10 target)

### Accessibility (P0)
- [ ] All interactive elements have proper ARIA labels
- [ ] Screen reader testing passed (NVDA, JAWS, VoiceOver)
- [ ] Keyboard-only navigation supported
- [ ] Zero axe-core violations (WCAG 2.1 AA)
- [ ] Focus management works correctly
- [ ] Color contrast meets AA standards

### UX (P1)
- [ ] "FIX THIS FIRST" badge visible on first error
- [ ] "Fix This" button jumps to error location
- [ ] Tip shown when multiple errors exist
- [ ] Monaco hover shows error details inline
- [ ] Undo/redo preserved after "Fix This"
- [ ] No React console warnings on unmount

### Testing (P0)
- [ ] Security tests: 10+ tests pass
- [ ] Accessibility tests: 30+ tests pass (axe-core + manual)
- [ ] Monaco integration: 15+ tests pass
- [ ] Cross-browser E2E: 10+ tests pass (Chrome/Firefox/Safari)
- [ ] Overall test coverage: 95%+
- [ ] Overall test pass rate: 100%
- [ ] QA expert approval (9.5/10 target)

### Cross-Browser (P1)
- [ ] Works in Chrome (latest)
- [ ] Works in Firefox (latest)
- [ ] Works in Safari (latest)
- [ ] Monaco hover stable across browsers
- [ ] No browser-specific bugs

## Open Questions (Resolved)

1. **Should we support keyboard shortcuts for "Fix This"?** → ✅ Deferred to keyboard navigation PRD
2. **Should we add AI-powered auto-fix?** → ✅ Deferred to future enhancement PRD
3. **How many errors should we show before "Show More"?** → ✅ Show all for now, add pagination if needed
4. **Should we add undo/redo for DSL edits?** → ✅ Monaco provides this built-in
5. **Which output contexts need sanitization?** → ✅ HTML (ARIA), Markdown (Monaco hover)
6. **What sensitive patterns should be redacted?** → ✅ API keys, cards, emails, SSNs, UUIDs
7. **What screen readers should we support?** → ✅ NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS)
8. **Which browsers should we test?** → ✅ Chrome, Firefox, Safari (latest versions)
