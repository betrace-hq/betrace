/**
 * RuleValidation - Pure validation logic as Effect programs
 *
 * All validation rules in one place:
 * - No React dependencies
 * - No side effects
 * - Composable with Effect.gen
 * - Testable with Jest (1000+ seeds)
 *
 * Philosophy: Validation is business logic, not UI concern.
 */

import { Effect, Schema } from 'effect';

/**
 * Validation errors
 */
export class RuleValidationError {
  readonly _tag = 'RuleValidationError';
  constructor(
    readonly field: string,
    readonly message: string
  ) {}
}

export class RuleSyntaxError {
  readonly _tag = 'RuleSyntaxError';
  constructor(
    readonly message: string,
    readonly position?: { line: number; column: number }
  ) {}
}

/**
 * Pure validation functions as Effect programs
 */
export const RuleValidation = {
  /**
   * Validate rule name
   */
  validateName: (name: string) =>
    Effect.gen(function* () {
      if (!name || name.trim().length === 0) {
        yield* Effect.fail(new RuleValidationError('name', 'Name is required'));
      }

      if (name.length < 3) {
        yield* Effect.fail(new RuleValidationError('name', 'Name must be at least 3 characters'));
      }

      if (name.length > 100) {
        yield* Effect.fail(new RuleValidationError('name', 'Name must be less than 100 characters'));
      }

      // Check for valid characters (alphanumeric, dash, underscore)
      if (!/^[a-zA-Z0-9-_\s]+$/.test(name)) {
        yield* Effect.fail(
          new RuleValidationError('name', 'Name can only contain letters, numbers, dashes, underscores, and spaces')
        );
      }

      return name.trim();
    }),

  /**
   * Validate rule description
   */
  validateDescription: (description: string) =>
    Effect.gen(function* () {
      if (description.length > 500) {
        yield* Effect.fail(new RuleValidationError('description', 'Description must be less than 500 characters'));
      }

      return description.trim();
    }),

  /**
   * Validate BeTraceDSL expression syntax
   */
  validateExpression: (expression: string) =>
    Effect.gen(function* () {
      if (!expression || expression.trim().length === 0) {
        yield* Effect.fail(new RuleSyntaxError('Expression is required'));
      }

      // Check for DSL keywords (use word boundaries for and/or/not)
      const hasKeywords = /trace\.|span\.|has\(|\band\b|\bor\b|\bnot\b/.test(expression);
      if (!hasKeywords) {
        yield* Effect.fail(
          new RuleSyntaxError(
            'Expression should contain BeTraceDSL keywords (trace., span., has(), and, or, not)'
          )
        );
      }

      // Check for balanced parentheses
      const openParens = (expression.match(/\(/g) || []).length;
      const closeParens = (expression.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        yield* Effect.fail(
          new RuleSyntaxError(`Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`)
        );
      }

      // Check for balanced brackets
      const openBrackets = (expression.match(/\[/g) || []).length;
      const closeBrackets = (expression.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        yield* Effect.fail(
          new RuleSyntaxError(`Unbalanced brackets: ${openBrackets} opening, ${closeBrackets} closing`)
        );
      }

      // Check for balanced quotes
      const doubleQuotes = (expression.match(/"/g) || []).length;
      if (doubleQuotes % 2 !== 0) {
        yield* Effect.fail(new RuleSyntaxError('Unbalanced double quotes'));
      }

      const singleQuotes = (expression.match(/'/g) || []).length;
      if (singleQuotes % 2 !== 0) {
        yield* Effect.fail(new RuleSyntaxError('Unbalanced single quotes'));
      }

      // Check for common syntax errors
      if (/\(\s*\)/.test(expression)) {
        yield* Effect.fail(new RuleSyntaxError('Empty parentheses found'));
      }

      if (/\[\s*\]/.test(expression)) {
        yield* Effect.fail(new RuleSyntaxError('Empty brackets found'));
      }

      // Check for invalid operators
      if (/===|!==/.test(expression)) {
        yield* Effect.fail(new RuleSyntaxError('Use == or != (not === or !==)'));
      }

      return expression.trim();
    }),

  /**
   * Validate complete rule
   */
  validateRule: (rule: { name: string; description?: string; expression: string; enabled: boolean }) =>
    Effect.gen(function* () {
      // Validate all fields in parallel
      const validatedName = yield* RuleValidation.validateName(rule.name);
      const validatedDescription = rule.description
        ? yield* RuleValidation.validateDescription(rule.description)
        : '';
      const validatedExpression = yield* RuleValidation.validateExpression(rule.expression);

      return {
        name: validatedName,
        description: validatedDescription,
        expression: validatedExpression,
        enabled: rule.enabled,
      };
    }),

  /**
   * Check for duplicate rule names
   */
  checkDuplicateName: (name: string, existingNames: string[], excludeId?: string) =>
    Effect.gen(function* () {
      const normalized = name.trim().toLowerCase();
      const duplicate = existingNames
        .filter((existing) => existing.toLowerCase() === normalized)
        .find((existing) => existing !== excludeId);

      if (duplicate) {
        yield* Effect.fail(new RuleValidationError('name', `Rule name "${name}" already exists`));
      }

      return name;
    }),

  /**
   * Validate expression complexity (for performance)
   */
  validateComplexity: (expression: string, maxComplexity: number = 100) =>
    Effect.gen(function* () {
      // Count nested conditions
      const nestedLevels = (expression.match(/\(/g) || []).length;
      if (nestedLevels > maxComplexity) {
        yield* Effect.fail(
          new RuleSyntaxError(`Expression too complex: ${nestedLevels} nested levels (max ${maxComplexity})`)
        );
      }

      // Count logical operators
      const operators = (expression.match(/\band\b|\bor\b|\bnot\b/g) || []).length;
      if (operators > maxComplexity) {
        yield* Effect.fail(
          new RuleSyntaxError(`Expression too complex: ${operators} logical operators (max ${maxComplexity})`)
        );
      }

      return expression;
    }),
};

/**
 * Test result types (for UI display)
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: RuleValidationError | RuleSyntaxError };

/**
 * Helper to convert Effect to UI-friendly result
 */
export const runValidation = async (
  effect: Effect.Effect<any, RuleValidationError | RuleSyntaxError, never>
): Promise<ValidationResult> => {
  const result = await Effect.runPromise(Effect.either(effect));

  if (result._tag === 'Right') {
    return { valid: true };
  } else {
    return { valid: false, error: result.left };
  }
};
