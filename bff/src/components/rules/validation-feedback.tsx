/**
 * Validation Feedback Component (PRD-010d)
 *
 * Displays validation errors, warnings, and success states for FLUO DSL expressions.
 * Implements WCAG 2.1 AA accessibility with proper ARIA attributes and screen reader support.
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ParseResult } from '@/lib/validation/dsl-parser';
import { createSafeErrorMessage } from '@/lib/validation/dsl-parser';
import { OutputContext } from '@/lib/validation/sanitize';

export interface ValidationFeedbackProps {
  /** Validation result from useDslValidation hook */
  validation: ParseResult | null;

  /** True while validation is in progress */
  isValidating: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Callback when user clicks "Fix This" button to jump to error location (PRD-010d Phase 3) */
  onFixError?: (error: { line: number; column: number }) => void;
}

/**
 * Validation Feedback UI Component
 *
 * Shows real-time validation feedback for DSL expressions:
 * - Validating state (animated spinner)
 * - Success state (green checkmark)
 * - Error state (red alert with suggestions)
 * - Warning state (yellow alert)
 *
 * @example
 * ```tsx
 * const { validation, isValidating } = useDslValidation(expression);
 *
 * <ValidationFeedback
 *   validation={validation}
 *   isValidating={isValidating}
 * />
 * ```
 */
export function ValidationFeedback({
  validation,
  isValidating,
  className = '',
  onFixError,
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

  // No validation result yet
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
        <AlertTitle className="text-green-800 dark:text-green-300">Valid Expression</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400">
          Your FLUO DSL expression is syntactically correct.
        </AlertDescription>
      </Alert>
    );
  }

  // Invalid expression (error/warning state)
  const hasErrors = validation.errors.length > 0;
  const ariaLabel = hasErrors
    ? `${validation.errors.length} syntax ${validation.errors.length === 1 ? 'error' : 'errors'} found`
    : `${validation.warnings.length} ${validation.warnings.length === 1 ? 'warning' : 'warnings'} found`;

  return (
    <div
      className={`space-y-2 ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Tip for multiple errors (PRD-010d Phase 3) */}
      {validation.errors.length > 1 && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>💡 Tip:</strong> Fix errors one at a time starting with the first one.
            Fixing early errors may resolve later ones automatically.
          </p>
        </div>
      )}

      {/* Display errors */}
      {validation.errors.map((error, index) => {
        // Create safe error message (sanitized + redacted for screen readers)
        const safeMessage = createSafeErrorMessage(error.message, OutputContext.HTML);
        const safeSuggestion = error.suggestion
          ? createSafeErrorMessage(error.suggestion, OutputContext.HTML)
          : null;
        const isFirstError = index === 0;

        return (
          <Alert
            key={`error-${index}`}
            variant="destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle className="flex items-center justify-between">
              <span>
                {isFirstError && (
                  <span className="mr-2 rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white dark:bg-red-700">
                    🎯 FIX THIS FIRST
                  </span>
                )}
                Syntax Error at line {error.line}, column {error.column}
              </span>
              {onFixError && (
                <button
                  onClick={() => onFixError({ line: error.line, column: error.column })}
                  className="ml-2 rounded bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-900"
                  aria-label={`Jump to error at line ${error.line}, column ${error.column}`}
                >
                  Fix This →
                </button>
              )}
            </AlertTitle>
            <AlertDescription>
              <p className="font-medium">{safeMessage}</p>
              {safeSuggestion && (
                <p className="mt-2 text-sm">
                  <strong>💡 Suggestion:</strong> {safeSuggestion}
                </p>
              )}
            </AlertDescription>
          </Alert>
        );
      })}

      {/* Display warnings */}
      {validation.warnings.length > 0 && (
        <details className="mt-2">
          <summary
            className="cursor-pointer text-sm text-yellow-700 dark:text-yellow-400"
            aria-label={`${validation.warnings.length} ${validation.warnings.length === 1 ? 'warning' : 'warnings'} (click to expand)`}
          >
            ⚠️ {validation.warnings.length} {validation.warnings.length === 1 ? 'warning' : 'warnings'}
          </summary>
          <div className="mt-2 space-y-2" role="list">
            {validation.warnings.map((warning, index) => {
              const safeMessage = createSafeErrorMessage(warning.message, OutputContext.HTML);
              const safeSuggestion = warning.suggestion
                ? createSafeErrorMessage(warning.suggestion, OutputContext.HTML)
                : null;

              return (
                <Alert
                  key={`warning-${index}`}
                  className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20"
                  role="listitem"
                >
                  <AlertTriangle
                    className="h-4 w-4 text-yellow-600 dark:text-yellow-400"
                    aria-hidden="true"
                  />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                    Warning at line {warning.line}, column {warning.column}
                  </AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                    <p>{safeMessage}</p>
                    {safeSuggestion && (
                      <p className="mt-2 text-sm">
                        <strong>💡 Suggestion:</strong> {safeSuggestion}
                      </p>
                    )}
                    {warning.example && (
                      <pre
                        className="mt-2 rounded bg-slate-900 p-2 text-xs text-slate-100"
                        aria-label="Code example"
                      >
                        <code>{warning.example}</code>
                      </pre>
                    )}
                  </AlertDescription>
                </Alert>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
