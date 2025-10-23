/**
 * BeTrace DSL Error Message Guide
 *
 * Provides helpful, actionable error messages and suggestions for common DSL mistakes.
 * Inspired by Rust compiler's helpful error messages.
 */

import type { ValidationError } from './dsl-parser';

interface ErrorMessageGuide {
  message: string;
  suggestion: string;
  example?: string;
}

export const DSL_ERROR_MESSAGES: Record<string, ErrorMessageGuide> = {
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
  MISSING_SPAN_NAME: {
    message: 'trace.has() requires a span operation name',
    suggestion: 'Provide the name of the operation to check',
    example: 'trace.has(database.query)',
  },
  MISSING_COUNT_VALUE: {
    message: 'trace.count() requires a comparison and numeric value',
    suggestion: 'Specify what to compare the count against',
    example: 'trace.count(http.request) > 10',
  },
  UNTERMINATED_STRING: {
    message: 'String is missing closing quote',
    suggestion: 'Add a closing " to complete the string',
  },
  UNEXPECTED_TOKEN: {
    message: 'Unexpected token in expression',
    suggestion: 'Check your DSL syntax for typos or missing operators',
  },
};

/**
 * Enhance validation errors with helpful messages from the guide
 */
export function enhanceError(error: ValidationError): ValidationError {
  // Try to match error message patterns to guide entries
  const errorText = error.message.toLowerCase();

  if (errorText.includes('parenthes') || errorText.includes('expected ")"')) {
    return {
      ...error,
      ...DSL_ERROR_MESSAGES.UNBALANCED_PARENTHESES,
    };
  }

  if (errorText.includes('expected "trace"')) {
    return {
      ...error,
      ...DSL_ERROR_MESSAGES.MISSING_TRACE_PREFIX,
    };
  }

  if (errorText.includes('expected attribute name')) {
    return {
      ...error,
      ...DSL_ERROR_MESSAGES.MISSING_WHERE_ATTRIBUTE,
    };
  }

  if (errorText.includes('unterminated string')) {
    return {
      ...error,
      ...DSL_ERROR_MESSAGES.UNTERMINATED_STRING,
    };
  }

  if (errorText.includes('expected span operation name')) {
    return {
      ...error,
      ...DSL_ERROR_MESSAGES.MISSING_SPAN_NAME,
    };
  }

  if (errorText.includes('expected numeric value') || errorText.includes('expected comparison operator')) {
    return {
      ...error,
      ...DSL_ERROR_MESSAGES.MISSING_COUNT_VALUE,
    };
  }

  if (errorText.includes('unexpected token')) {
    return {
      ...error,
      ...DSL_ERROR_MESSAGES.UNEXPECTED_TOKEN,
    };
  }

  // Return original error if no match
  return error;
}

/**
 * Check for common mistakes and add warnings
 */
export function detectCommonMistakes(expression: string): ValidationError[] {
  const warnings: ValidationError[] = [];

  // Check for single = instead of ==
  const singleEqualMatch = expression.match(/[^=!<>]=[^=]/);
  if (singleEqualMatch) {
    warnings.push({
      line: 1,
      column: expression.indexOf(singleEqualMatch[0]) + 2,
      endLine: 1,
      endColumn: expression.indexOf(singleEqualMatch[0]) + 3,
      message: DSL_ERROR_MESSAGES.ASSIGNMENT_OPERATOR.message,
      severity: 'warning',
      suggestion: DSL_ERROR_MESSAGES.ASSIGNMENT_OPERATOR.suggestion,
    });
  }

  // Check for quoted identifiers in has()
  const quotedIdMatch = expression.match(/trace\.has\(["']([^"']+)["']\)/);
  if (quotedIdMatch) {
    warnings.push({
      line: 1,
      column: expression.indexOf(quotedIdMatch[0]) + 11,
      endLine: 1,
      endColumn: expression.indexOf(quotedIdMatch[0]) + 11 + quotedIdMatch[1].length + 2,
      message: DSL_ERROR_MESSAGES.QUOTED_IDENTIFIER.message,
      severity: 'warning',
      suggestion: DSL_ERROR_MESSAGES.QUOTED_IDENTIFIER.suggestion,
      example: DSL_ERROR_MESSAGES.QUOTED_IDENTIFIER.example,
    });
  }

  return warnings;
}
