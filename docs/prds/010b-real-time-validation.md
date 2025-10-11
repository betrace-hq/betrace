# PRD-010b: Real-Time DSL Validation Feedback

**Parent PRD:** PRD-010 (Rule Management UI)
**Unit:** B
**Priority:** P0
**Dependencies:** Unit A (Monaco editor for error marker display)

## Scope

Implement real-time validation of FLUO DSL expressions with actionable error messages, warnings, and suggestions. Validation runs as the user types and provides immediate feedback through Monaco editor markers and UI alerts.

**Current State:** Basic client-side validation exists (parentheses matching, empty check) but doesn't understand FLUO DSL grammar.

**Goal:** Professional validation experience with:
- Grammar-aware parsing (lexer + parser for FLUO DSL)
- Syntax error detection with precise error locations
- Helpful error messages (inspired by Rust compiler)
- Suggestions for common mistakes
- Backend validation for semantic correctness

## Implementation

### Client-Side DSL Parser

```typescript
// src/lib/validation/dsl-parser.ts

export interface ValidationError {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ParseResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  ast?: RuleExpression; // For future semantic analysis
}

// Simple tokenizer for FLUO DSL
class Lexer {
  private input: string;
  private position = 0;
  private line = 1;
  private column = 1;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;

      const token = this.nextToken();
      if (token) tokens.push(token);
    }
    return tokens;
  }

  private nextToken(): Token | null {
    const start = { line: this.line, column: this.column };

    // Keywords
    if (this.matchWord('trace')) return this.makeToken('TRACE', 'trace', start);
    if (this.matchWord('has')) return this.makeToken('HAS', 'has', start);
    if (this.matchWord('where')) return this.makeToken('WHERE', 'where', start);
    if (this.matchWord('count')) return this.makeToken('COUNT', 'count', start);
    if (this.matchWord('and')) return this.makeToken('AND', 'and', start);
    if (this.matchWord('or')) return this.makeToken('OR', 'or', start);
    if (this.matchWord('not')) return this.makeToken('NOT', 'not', start);
    if (this.matchWord('true') || this.matchWord('false')) {
      return this.makeToken('BOOLEAN', this.input.substring(start.column - 1, this.column), start);
    }

    // Operators
    if (this.match('==')) return this.makeToken('EQ', '==', start);
    if (this.match('!=')) return this.makeToken('NEQ', '!=', start);
    if (this.match('>=')) return this.makeToken('GTE', '>=', start);
    if (this.match('<=')) return this.makeToken('LTE', '<=', start);
    if (this.match('>')) return this.makeToken('GT', '>', start);
    if (this.match('<')) return this.makeToken('LT', '<', start);
    if (this.matchWord('in')) return this.makeToken('IN', 'in', start);
    if (this.matchWord('matches')) return this.makeToken('MATCHES', 'matches', start);

    // Delimiters
    if (this.match('(')) return this.makeToken('LPAREN', '(', start);
    if (this.match(')')) return this.makeToken('RPAREN', ')', start);
    if (this.match('[')) return this.makeToken('LBRACKET', '[', start);
    if (this.match(']')) return this.makeToken('RBRACKET', ']', start);
    if (this.match('.')) return this.makeToken('DOT', '.', start);
    if (this.match(',')) return this.makeToken('COMMA', ',', start);

    // Strings
    if (this.peek() === '"') {
      return this.readString(start);
    }

    // Numbers
    if (this.isDigit(this.peek())) {
      return this.readNumber(start);
    }

    // Identifiers
    if (this.isAlpha(this.peek())) {
      return this.readIdentifier(start);
    }

    // Unknown character
    throw new Error(`Unexpected character '${this.peek()}' at ${this.line}:${this.column}`);
  }

  // ... (implement helper methods: match, peek, advance, isAtEnd, etc.)
}

// Parser for FLUO DSL
class Parser {
  private tokens: Token[];
  private current = 0;
  private errors: ValidationError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ParseResult {
    try {
      const ast = this.parseExpression();
      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: [],
        ast,
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [
          ...this.errors,
          {
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 1,
            message: error.message || 'Parse error',
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }
  }

  private parseExpression(): RuleExpression {
    // Implement recursive descent parser for FLUO DSL grammar
    // expression := term (("and" | "or") term)*
    let left = this.parseTerm();

    while (this.match('AND', 'OR')) {
      const operator = this.previous().type;
      const right = this.parseTerm();
      left = new BinaryExpression(operator, left, right);
    }

    return left;
  }

  private parseTerm(): RuleExpression {
    // term := "not"? span_check
    if (this.match('NOT')) {
      const expr = this.parseSpanCheck();
      return new NotExpression(expr);
    }
    return this.parseSpanCheck();
  }

  private parseSpanCheck(): RuleExpression {
    // span_check := "trace.has(" identifier ")" where_clause*
    //             | "trace.count(" identifier ")" comparison_op value
    this.consume('TRACE', 'Expected "trace"');
    this.consume('DOT', 'Expected "." after "trace"');

    if (this.match('HAS')) {
      return this.parseHasExpression();
    } else if (this.match('COUNT')) {
      return this.parseCountExpression();
    } else {
      throw this.error('Expected "has" or "count" after "trace."');
    }
  }

  // ... (implement parseHasExpression, parseCountExpression, etc.)
}

export function validateDslExpression(expression: string): ParseResult {
  try {
    const lexer = new Lexer(expression);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  } catch (error: any) {
    return {
      valid: false,
      errors: [
        {
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
          message: error.message || 'Validation failed',
          severity: 'error',
        },
      ],
      warnings: [],
    };
  }
}
```

### Error Message Guide Integration

```typescript
// src/lib/validation/error-messages.ts

interface ErrorMessageGuide {
  [key: string]: {
    message: string;
    suggestion: string;
    example?: string;
  };
}

export const DSL_ERROR_MESSAGES: ErrorMessageGuide = {
  MISSING_TRACE_PREFIX: {
    message: 'Rules must start with "trace.has()" or "trace.count()"',
    suggestion: 'Start your rule with "trace.has(operation_name)"',
    example: 'trace.has(payment.charge_card)',
  },
  UNBALANCED_PARENTHESES: {
    message: 'Unbalanced parentheses in expression',
    suggestion: 'Check that every opening "(" has a matching closing ")"',
  },
  INVALID_OPERATOR: {
    message: 'Invalid comparison operator',
    suggestion: 'Use one of: ==, !=, >, >=, <, <=, in, matches',
  },
  MISSING_WHERE_ATTRIBUTE: {
    message: 'where() clause requires an attribute name',
    suggestion: 'Specify the attribute to filter on: .where(attribute == value)',
    example: '.where(amount > 1000)',
  },
  QUOTED_IDENTIFIER: {
    message: 'Identifiers should not be quoted',
    suggestion: 'Remove quotes from operation names and attributes',
    example: 'Use: trace.has(payment.charge) instead of trace.has("payment.charge")',
  },
  REGEX_MUST_BE_QUOTED: {
    message: 'Regular expression patterns must be quoted',
    suggestion: 'Wrap the regex pattern in double quotes',
    example: '.where(endpoint matches "/api/v1/admin/.*")',
  },
  ASSIGNMENT_OPERATOR: {
    message: 'Use "==" for comparison, not "="',
    suggestion: 'Did you mean to use "==" instead of "="?',
  },
};

export function enhanceError(error: ValidationError): ValidationError {
  // Match error message to guide entry
  for (const [key, guide] of Object.entries(DSL_ERROR_MESSAGES)) {
    if (error.message.includes(key.toLowerCase().replace(/_/g, ' '))) {
      return {
        ...error,
        message: guide.message,
        suggestion: guide.suggestion,
      };
    }
  }
  return error;
}
```

### Real-Time Validation Hook

```typescript
// src/lib/validation/use-dsl-validation.ts
import { useEffect, useState } from 'react';
import { validateDslExpression, type ParseResult } from './dsl-parser';
import { enhanceError } from './error-messages';

export function useDslValidation(expression: string) {
  const [validation, setValidation] = useState<ParseResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!expression.trim()) {
      setValidation({
        valid: false,
        errors: [
          {
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 1,
            message: 'Expression cannot be empty',
            severity: 'error',
          },
        ],
        warnings: [],
      });
      return;
    }

    setIsValidating(true);

    // Debounce validation
    const timeoutId = setTimeout(() => {
      const result = validateDslExpression(expression);

      // Enhance error messages
      result.errors = result.errors.map(enhanceError);

      setValidation(result);
      setIsValidating(false);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [expression]);

  return { validation, isValidating };
}
```

### Integrate Validation with Monaco Editor

```typescript
// src/components/rules/monaco-dsl-editor.tsx (updated)
import { useDslValidation } from '@/lib/validation/use-dsl-validation';

export function MonacoDslEditor({ value, onChange, ... }: MonacoDslEditorProps) {
  const { validation, isValidating } = useDslValidation(value);

  useEffect(() => {
    if (!editorRef.current || !validation) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    // Convert validation errors to Monaco markers
    const markers = validation.errors.map((error) => ({
      severity: monaco.MarkerSeverity.Error,
      startLineNumber: error.line,
      startColumn: error.column,
      endLineNumber: error.endLine,
      endColumn: error.endColumn,
      message: error.message + (error.suggestion ? `\n\nSuggestion: ${error.suggestion}` : ''),
    }));

    monaco.editor.setModelMarkers(model, 'fluo-dsl-validator', markers);
  }, [validation]);

  // ... rest of component
}
```

### Validation Feedback UI

```typescript
// src/components/rules/validation-feedback.tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ParseResult } from '@/lib/validation/dsl-parser';

interface ValidationFeedbackProps {
  validation: ParseResult | null;
  isValidating: boolean;
}

export function ValidationFeedback({ validation, isValidating }: ValidationFeedbackProps) {
  if (isValidating) {
    return (
      <Alert>
        <Info className="h-4 w-4 animate-pulse" />
        <AlertTitle>Validating...</AlertTitle>
      </Alert>
    );
  }

  if (!validation) return null;

  if (validation.valid) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-300">Valid Expression</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400">
          Your FLUO DSL expression is syntactically correct.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {validation.errors.map((error, index) => (
        <Alert key={index} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            Syntax Error (Line {error.line}:{error.column})
          </AlertTitle>
          <AlertDescription>
            <p>{error.message}</p>
            {error.suggestion && (
              <p className="mt-2 text-sm">
                <strong>Suggestion:</strong> {error.suggestion}
              </p>
            )}
          </AlertDescription>
        </Alert>
      ))}

      {validation.warnings.map((warning, index) => (
        <Alert key={index}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>{warning.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
```

## Success Criteria

- [ ] Client-side DSL parser correctly validates FLUO DSL syntax
- [ ] Error messages are clear, actionable, and include suggestions
- [ ] Monaco editor shows red squiggles under syntax errors
- [ ] Hovering over errors shows detailed message and suggestion
- [ ] Validation runs with 300ms debounce (doesn't block typing)
- [ ] Common mistakes have helpful error messages (e.g., "use == not =")
- [ ] Validation feedback UI shows errors, warnings, and success states

## Testing Requirements

### Unit Tests (Vitest)
```typescript
// src/lib/validation/dsl-parser.test.ts
describe('DSL Parser', () => {
  it('validates correct expression', () => {
    const result = validateDslExpression('trace.has(payment.charge) and trace.has(fraud.check)');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects unbalanced parentheses', () => {
    const result = validateDslExpression('trace.has(payment.charge');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('parenthes');
  });

  it('suggests == instead of =', () => {
    const result = validateDslExpression('trace.has(user.login).where(role = admin)');
    expect(result.errors[0].suggestion).toContain('==');
  });

  it('detects missing trace prefix', () => {
    const result = validateDslExpression('has(payment.charge)');
    expect(result.errors[0].message).toContain('trace.');
  });

  it('validates where clause syntax', () => {
    const result = validateDslExpression('trace.has(payment).where(amount > 1000)');
    expect(result.valid).toBe(true);
  });
});

// src/lib/validation/use-dsl-validation.test.ts
describe('useDslValidation', () => {
  it('debounces validation', async () => {
    const { result, rerender } = renderHook(() => useDslValidation('trace.has(test)'));

    expect(result.current.isValidating).toBe(true);

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });
  });
});
```

### Storybook Stories
```typescript
// src/stories/ValidationFeedback.stories.tsx
export const ValidExpression: Story = {
  args: {
    validation: {
      valid: true,
      errors: [],
      warnings: [],
    },
    isValidating: false,
  },
};

export const SyntaxError: Story = {
  args: {
    validation: {
      valid: false,
      errors: [
        {
          line: 1,
          column: 15,
          endLine: 1,
          endColumn: 20,
          message: 'Unbalanced parentheses in expression',
          severity: 'error',
          suggestion: 'Check that every opening "(" has a matching closing ")"',
        },
      ],
      warnings: [],
    },
    isValidating: false,
  },
};
```

## Files to Create

- `/Users/sscoble/Projects/fluo/bff/src/lib/validation/dsl-parser.ts` - Lexer and parser for FLUO DSL
- `/Users/sscoble/Projects/fluo/bff/src/lib/validation/error-messages.ts` - Error message guide
- `/Users/sscoble/Projects/fluo/bff/src/lib/validation/use-dsl-validation.ts` - React hook for validation
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/validation-feedback.tsx` - Validation UI component
- `/Users/sscoble/Projects/fluo/bff/src/lib/validation/dsl-parser.test.ts` - Parser tests
- `/Users/sscoble/Projects/fluo/bff/src/lib/validation/use-dsl-validation.test.ts` - Hook tests
- `/Users/sscoble/Projects/fluo/bff/src/stories/ValidationFeedback.stories.tsx` - Storybook stories

## Files to Modify

- `/Users/sscoble/Projects/fluo/bff/src/components/rules/monaco-dsl-editor.tsx` - Integrate validation markers
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rule-editor.tsx` - Add ValidationFeedback component

## Integration Notes

- **Monaco Markers**: Validation errors are displayed as Monaco editor markers (red squiggles)
- **Debouncing**: 300ms debounce prevents validation from blocking typing
- **Future Enhancement**: Backend validation for semantic correctness (e.g., checking if operation names exist in traces)
- **Error Recovery**: Parser should attempt to recover from errors to provide multiple error messages
