/**
 * React Hook for Real-Time DSL Validation
 *
 * Provides debounced validation of FLUO DSL expressions with error enhancement.
 */

import { useEffect, useState } from 'react';
import { validateDslExpression, type ParseResult } from './dsl-parser';
import { enhanceError, detectCommonMistakes } from './error-messages';

export interface UseDslValidationOptions {
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number;

  /** Enable detection of common mistakes (default: true) */
  detectMistakes?: boolean;
}

export interface UseDslValidationResult {
  /** Validation result with errors and warnings */
  validation: ParseResult | null;

  /** True while validation is pending (debouncing) */
  isValidating: boolean;
}

/**
 * Hook for real-time DSL validation with debouncing
 *
 * @param expression - The DSL expression to validate
 * @param options - Validation options
 * @returns Validation result and loading state
 *
 * @example
 * ```tsx
 * const { validation, isValidating } = useDslValidation(dslCode);
 *
 * if (isValidating) return <Spinner />;
 * if (!validation?.valid) return <ErrorList errors={validation.errors} />;
 * ```
 */
export function useDslValidation(
  expression: string,
  options: UseDslValidationOptions = {}
): UseDslValidationResult {
  const { debounceMs = 300, detectMistakes = true } = options;

  const [validation, setValidation] = useState<ParseResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    // Handle empty expression
    if (!expression || !expression.trim()) {
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
            suggestion: 'Start with "trace.has()" or "trace.count()"',
          },
        ],
        warnings: [],
      });
      setIsValidating(false);
      return;
    }

    // Start validation
    setIsValidating(true);

    // Debounce validation to avoid blocking typing
    const timeoutId = setTimeout(() => {
      // Run validation
      const result = validateDslExpression(expression);

      // Enhance error messages with helpful suggestions
      result.errors = result.errors.map(enhanceError);

      // Detect common mistakes if enabled
      if (detectMistakes) {
        const mistakes = detectCommonMistakes(expression);
        result.warnings.push(...mistakes);
      }

      setValidation(result);
      setIsValidating(false);
    }, debounceMs);

    // Cleanup timeout on unmount or expression change
    return () => clearTimeout(timeoutId);
  }, [expression, debounceMs, detectMistakes]);

  return { validation, isValidating };
}
