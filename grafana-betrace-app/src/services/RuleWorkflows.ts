/**
 * RuleWorkflows - Multi-step operations as Effect programs
 *
 * All complex workflows in one place:
 * - Composable Effect programs
 * - Automatic retry and error handling
 * - Testable without HTTP (mock BeTraceService)
 *
 * Philosophy: Multi-step operations are business logic, not UI concern.
 */

import { Effect } from 'effect';
import { BeTraceService, Rule } from './BeTraceService';
import { RuleValidation, RuleValidationError, RuleSyntaxError } from './RuleValidation';

/**
 * Workflow errors
 */
export class RuleNotFoundError {
  readonly _tag = 'RuleNotFoundError';
  constructor(readonly ruleId: string) {}
}

export class RuleConflictError {
  readonly _tag = 'RuleConflictError';
  constructor(readonly message: string) {}
}

export class UserCancelledError {
  readonly _tag = 'UserCancelledError';
  constructor(readonly message: string) {}
}

/**
 * Multi-step workflows as Effect programs
 */
export const RuleWorkflows = {
  /**
   * Create rule with validation
   */
  createRuleWithValidation: (rule: {
    name: string;
    description?: string;
    expression: string;
    enabled: boolean;
  }) =>
    Effect.gen(function* () {
      const service = yield* BeTraceService;

      // 1. Fetch existing rules to check for duplicates
      const { rules } = yield* service.listRules();
      const existingNames = rules.map((r) => r.name);

      // 2. Validate rule
      const validated = yield* RuleValidation.validateRule(rule);

      // 3. Check for duplicate name
      yield* RuleValidation.checkDuplicateName(validated.name, existingNames);

      // 4. Create rule
      const created = yield* service.createRule({
        name: validated.name,
        description: validated.description,
        expression: validated.expression,
        enabled: validated.enabled,
      });

      return created;
    }),

  /**
   * Update rule with validation
   */
  updateRuleWithValidation: (ruleId: string, updates: {
    name: string;
    description?: string;
    expression: string;
    enabled: boolean;
  }) =>
    Effect.gen(function* () {
      const service = yield* BeTraceService;

      // 1. Fetch existing rules
      const { rules } = yield* service.listRules();
      const existingNames = rules.map((r) => r.name);

      // 2. Validate updates
      const validated = yield* RuleValidation.validateRule(updates);

      // 3. Check for duplicate name (excluding current rule)
      yield* RuleValidation.checkDuplicateName(validated.name, existingNames, ruleId);

      // 4. Update rule
      const updated = yield* service.updateRule(ruleId, {
        name: validated.name,
        description: validated.description,
        expression: validated.expression,
        enabled: validated.enabled,
      });

      return updated;
    }),

  /**
   * Clone rule
   */
  cloneRule: (ruleId: string) =>
    Effect.gen(function* () {
      const service = yield* BeTraceService;

      // 1. Fetch original rule
      const original = yield* service.getRule(ruleId);
      if (!original) {
        yield* Effect.fail(new RuleNotFoundError(ruleId));
      }

      // 2. Generate unique name
      const { rules } = yield* service.listRules();
      const existingNames = new Set(rules.map((r) => r.name));

      let copyName = `${original.name} (copy)`;
      let counter = 2;
      while (existingNames.has(copyName)) {
        copyName = `${original.name} (copy ${counter})`;
        counter++;
      }

      // 3. Create copy
      const copy = yield* service.createRule({
        name: copyName,
        description: original.description,
        expression: original.expression,
        enabled: false, // Always create disabled
      });

      return copy;
    }),

  /**
   * Toggle rule (enable/disable)
   */
  toggleRule: (rule: Rule) =>
    Effect.gen(function* () {
      const service = yield* BeTraceService;

      return yield* (rule.enabled
        ? service.disableRule(rule.id!)
        : service.enableRule(rule.id!));
    }),

  /**
   * Delete rule with confirmation
   */
  deleteRuleWithConfirm: (ruleId: string, confirmFn: () => boolean) =>
    Effect.gen(function* () {
      // 1. Ask for confirmation
      if (!confirmFn()) {
        yield* Effect.fail(new UserCancelledError('Delete cancelled by user'));
      }

      // 2. Delete rule
      const service = yield* BeTraceService;
      yield* service.deleteRule(ruleId);

      return { deleted: true, ruleId };
    }),

  /**
   * Bulk enable rules
   */
  bulkEnableRules: (ruleIds: string[]) =>
    Effect.gen(function* () {
      const service = yield* BeTraceService;

      // Enable all rules in parallel
      const results = yield* Effect.all(
        ruleIds.map((id) => service.enableRule(id)),
        { concurrency: 5 } // Limit concurrent requests
      );

      return results;
    }),

  /**
   * Bulk disable rules
   */
  bulkDisableRules: (ruleIds: string[]) =>
    Effect.gen(function* () {
      const service = yield* BeTraceService;

      // Disable all rules in parallel
      const results = yield* Effect.all(
        ruleIds.map((id) => service.disableRule(id)),
        { concurrency: 5 }
      );

      return results;
    }),

  /**
   * Bulk delete rules
   */
  bulkDeleteRules: (ruleIds: string[], confirmFn: () => boolean) =>
    Effect.gen(function* () {
      // 1. Ask for confirmation
      if (!confirmFn()) {
        yield* Effect.fail(new UserCancelledError('Delete cancelled by user'));
      }

      // 2. Delete all rules in parallel
      const service = yield* BeTraceService;
      const results = yield* Effect.all(
        ruleIds.map((id) => service.deleteRule(id)),
        { concurrency: 5 }
      );

      return { deleted: true, count: results.length };
    }),

  /**
   * Test expression against sample trace data
   * (Future: actual trace evaluation)
   */
  testExpression: (expression: string) =>
    Effect.gen(function* () {
      // 1. Validate syntax
      yield* RuleValidation.validateExpression(expression);

      // 2. TODO: Send to backend for evaluation against sample traces
      // For now, just return syntax validation result

      return { valid: true, syntax: 'ok' };
    }),
};
