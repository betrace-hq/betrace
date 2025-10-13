/**
 * Validation Feedback Component
 *
 * Displays validation errors, warnings, and success states for FLUO DSL expressions.
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ParseResult } from '@/lib/validation/dsl-parser';

export interface ValidationFeedbackProps {
  /** Validation result from useDslValidation hook */
  validation: ParseResult | null;

  /** True while validation is in progress */
  isValidating: boolean;

  /** Additional CSS classes */
  className?: string;
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
}: ValidationFeedbackProps) {
  // Validating state
  if (isValidating) {
    return (
      <Alert className={className}>
        <Info className="h-4 w-4 animate-pulse" />
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
      <Alert className={`border-green-200 bg-green-50 dark:bg-green-950/20 ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-800 dark:text-green-300">Valid Expression</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400">
          Your FLUO DSL expression is syntactically correct.
        </AlertDescription>
      </Alert>
    );
  }

  // Invalid expression (error/warning state)
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Display errors */}
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

      {/* Display warnings */}
      {validation.warnings.map((warning, index) => (
        <Alert key={`warning-${index}`} className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-300">
            Warning at line {warning.line}, column {warning.column}
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-400">
            <p>{warning.message}</p>
            {warning.suggestion && (
              <p className="mt-2 text-sm">
                <strong>💡 Suggestion:</strong> {warning.suggestion}
              </p>
            )}
            {warning.example && (
              <p className="mt-2 text-sm">
                <strong>Example:</strong> <code className="text-xs">{warning.example}</code>
              </p>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
