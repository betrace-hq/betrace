/**
 * useRuleWorkflows - React adapter for Effect workflows
 *
 * Thin wrapper around RuleWorkflows that integrates with React:
 * - Manages loading/error states
 * - Provides callbacks for success/error
 * - Returns memoized functions
 *
 * All business logic stays in RuleWorkflows.ts
 */

import { useState, useCallback } from 'react';
import { Effect, Exit } from 'effect';
import { RuleWorkflows, RuleNotFoundError, RuleConflictError, UserCancelledError } from '../services/RuleWorkflows';
import { RuleValidationError, RuleSyntaxError } from '../services/RuleValidation';
import { runEffect } from './useEffect';
import type { Rule } from '../services/BeTraceService';

/**
 * Result type for workflow execution
 */
type WorkflowResult<T> =
  | { _tag: 'success'; value: T }
  | { _tag: 'error'; error: string }
  | { _tag: 'cancelled' };

/**
 * Hook options
 */
interface UseWorkflowOptions<T> {
  onSuccess?: (value: T) => void;
  onError?: (error: string) => void;
  onCancelled?: () => void;
}

/**
 * Hook for individual workflow operations
 */
const useWorkflow = <T,>(options: UseWorkflowOptions<T> = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (effect: Effect.Effect<T, any, any>): Promise<WorkflowResult<T>> => {
      setIsLoading(true);
      setError(null);

      const result = await runEffect(effect);

      setIsLoading(false);

      if (result._tag === 'success') {
        options.onSuccess?.(result.value);
        return { _tag: 'success', value: result.value };
      } else {
        // Format error message based on error type
        let errorMessage: string;

        if (result.error instanceof RuleValidationError) {
          errorMessage = `${result.error.field}: ${result.error.message}`;
        } else if (result.error instanceof RuleSyntaxError) {
          errorMessage = result.error.message;
        } else if (result.error instanceof RuleNotFoundError) {
          errorMessage = `Rule not found: ${result.error.ruleId}`;
        } else if (result.error instanceof RuleConflictError) {
          errorMessage = result.error.message;
        } else if (result.error instanceof UserCancelledError) {
          options.onCancelled?.();
          return { _tag: 'cancelled' };
        } else if (result.error instanceof Error) {
          errorMessage = result.error.message;
        } else {
          errorMessage = String(result.error);
        }

        setError(errorMessage);
        options.onError?.(errorMessage);
        return { _tag: 'error', error: errorMessage };
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    execute,
    isLoading,
    error,
    reset,
  };
};

/**
 * Hook for all rule workflows
 */
export const useRuleWorkflows = () => {
  // Create rule
  const createRuleWorkflow = useWorkflow<Rule>();
  const createRule = useCallback(
    async (
      rule: { name: string; description?: string; expression: string; enabled: boolean },
      options: UseWorkflowOptions<Rule> = {}
    ) => {
      const workflow = useWorkflow<Rule>(options);
      return workflow.execute(RuleWorkflows.createRuleWithValidation(rule));
    },
    []
  );

  // Update rule
  const updateRuleWorkflow = useWorkflow<Rule>();
  const updateRule = useCallback(
    async (
      ruleId: string,
      updates: { name: string; description?: string; expression: string; enabled: boolean },
      options: UseWorkflowOptions<Rule> = {}
    ) => {
      const workflow = useWorkflow<Rule>(options);
      return workflow.execute(RuleWorkflows.updateRuleWithValidation(ruleId, updates));
    },
    []
  );

  // Clone rule
  const cloneRuleWorkflow = useWorkflow<Rule>();
  const cloneRule = useCallback(
    async (ruleId: string, options: UseWorkflowOptions<Rule> = {}) => {
      const workflow = useWorkflow<Rule>(options);
      return workflow.execute(RuleWorkflows.cloneRule(ruleId));
    },
    []
  );

  // Toggle rule
  const toggleRuleWorkflow = useWorkflow<Rule>();
  const toggleRule = useCallback(
    async (rule: Rule, options: UseWorkflowOptions<Rule> = {}) => {
      const workflow = useWorkflow<Rule>(options);
      return workflow.execute(RuleWorkflows.toggleRule(rule));
    },
    []
  );

  // Delete rule
  const deleteRuleWorkflow = useWorkflow<{ deleted: boolean; ruleId: string }>();
  const deleteRule = useCallback(
    async (
      ruleId: string,
      confirmFn: () => boolean,
      options: UseWorkflowOptions<{ deleted: boolean; ruleId: string }> = {}
    ) => {
      const workflow = useWorkflow<{ deleted: boolean; ruleId: string }>(options);
      return workflow.execute(RuleWorkflows.deleteRuleWithConfirm(ruleId, confirmFn));
    },
    []
  );

  // Bulk operations
  const bulkEnableRules = useCallback(
    async (ruleIds: string[], options: UseWorkflowOptions<Rule[]> = {}) => {
      const workflow = useWorkflow<Rule[]>(options);
      return workflow.execute(RuleWorkflows.bulkEnableRules(ruleIds));
    },
    []
  );

  const bulkDisableRules = useCallback(
    async (ruleIds: string[], options: UseWorkflowOptions<Rule[]> = {}) => {
      const workflow = useWorkflow<Rule[]>(options);
      return workflow.execute(RuleWorkflows.bulkDisableRules(ruleIds));
    },
    []
  );

  const bulkDeleteRules = useCallback(
    async (
      ruleIds: string[],
      confirmFn: () => boolean,
      options: UseWorkflowOptions<{ deleted: boolean; count: number }> = {}
    ) => {
      const workflow = useWorkflow<{ deleted: boolean; count: number }>(options);
      return workflow.execute(RuleWorkflows.bulkDeleteRules(ruleIds, confirmFn));
    },
    []
  );

  // Test expression
  const testExpression = useCallback(
    async (expression: string, options: UseWorkflowOptions<{ valid: boolean; syntax: string }> = {}) => {
      const workflow = useWorkflow<{ valid: boolean; syntax: string }>(options);
      return workflow.execute(RuleWorkflows.testExpression(expression));
    },
    []
  );

  return {
    createRule,
    updateRule,
    cloneRule,
    toggleRule,
    deleteRule,
    bulkEnableRules,
    bulkDisableRules,
    bulkDeleteRules,
    testExpression,
  };
};
