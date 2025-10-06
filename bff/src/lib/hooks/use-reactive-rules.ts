/**
 * Reactive Rules Hook - Context+useReducer implementation
 *
 * Replaces TanStack Query with reactive architecture following ADR-006:
 * - Uses React Context + useReducer for state management
 * - Delegates heavy operations to background workers
 * - Provides stable references following React best practices
 */

import { useCallback, useEffect } from 'react';
import { useUIController } from '../reactive-engine/ui-controller';
import { getDataWorker } from '../workers/data-worker';
import { Rule } from '../types/fluo-api';

export function useReactiveRules() {
  const { state, dispatch } = useUIController();
  const { rules } = state;

  // Get data worker instance
  const dataWorker = getDataWorker();

  // Set up worker connection if not already done
  useEffect(() => {
    dataWorker.setUIDispatch(dispatch);
  }, [dispatch]);

  // Stable callback functions using useCallback for dependency arrays
  const fetchRules = useCallback(async () => {
    await dataWorker.fetchRules();
  }, [dataWorker]);

  const createRule = useCallback(
    async (ruleData: Omit<Rule, 'id'>) => {
      try {
        await dataWorker.createRule(ruleData);

        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Rule Created',
            message: `Rule "${ruleData.name}" created successfully`,
          },
        });
      } catch (error) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Creation Failed',
            message: error instanceof Error ? error.message : 'Failed to create rule',
          },
        });
        throw error;
      }
    },
    [dispatch, dataWorker]
  );

  const updateRule = useCallback(
    async (rule: Rule) => {
      try {
        await dataWorker.updateRule(rule);

        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Rule Updated',
            message: `Rule "${rule.name}" updated successfully`,
          },
        });
      } catch (error) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Update Failed',
            message: error instanceof Error ? error.message : 'Failed to update rule',
          },
        });
        throw error;
      }
    },
    [dispatch, dataWorker]
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      const rule = rules.data.find(r => r.id === ruleId);
      const ruleName = rule?.name || ruleId;

      try {
        await dataWorker.deleteRule(ruleId);

        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Rule Deleted',
            message: `Rule "${ruleName}" deleted successfully`,
          },
        });
      } catch (error) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Deletion Failed',
            message: error instanceof Error ? error.message : 'Failed to delete rule',
          },
        });
        throw error;
      }
    },
    [dispatch, dataWorker, rules.data]
  );

  const setActiveRule = useCallback(
    (rule: Rule | null) => {
      dispatch({ type: 'SET_ACTIVE_RULE', payload: rule });
    },
    [dispatch]
  );

  const refreshRules = useCallback(async () => {
    await dataWorker.fetchRules();
  }, [dataWorker]);

  // Auto-fetch rules on mount
  useEffect(() => {
    fetchRules();
  }, []); // Only run on mount

  return {
    // Data
    rules: rules.data,
    loading: rules.loading,
    error: rules.error,
    activeRule: rules.activeRule,

    // Actions with stable references
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    setActiveRule,
    refreshRules,

    // Computed values
    hasRules: rules.data.length > 0,
    hasError: rules.error !== null,
    isEmpty: !rules.loading && rules.data.length === 0,
    totalRules: rules.data.length,
  };
}

/**
 * Hook for rule validation and testing.
 */
export function useRuleValidation() {
  const validateOgnlExpression = useCallback((expression: string): { valid: boolean; error?: string } => {
    try {
      // Basic OGNL validation
      if (!expression.trim()) {
        return { valid: false, error: 'Expression cannot be empty' };
      }

      // Check for basic syntax issues
      const openParens = (expression.match(/\(/g) || []).length;
      const closeParens = (expression.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        return { valid: false, error: 'Mismatched parentheses' };
      }

      // Check for dangerous patterns
      const dangerousPatterns = [
        /System\./,
        /Runtime\./,
        /Class\./,
        /\.class/,
        /new\s+\w+/,
        /@[a-zA-Z]/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(expression)) {
          return { valid: false, error: 'Expression contains potentially unsafe operations' };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid expression syntax' };
    }
  }, []);

  const validateRuleData = useCallback((rule: Partial<Rule>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!rule.name?.trim()) {
      errors.push('Rule name is required');
    }

    if (!rule.description?.trim()) {
      errors.push('Rule description is required');
    }

    if (!rule.ognlExpression?.trim()) {
      errors.push('OGNL expression is required');
    } else {
      const ognlValidation = validateOgnlExpression(rule.ognlExpression);
      if (!ognlValidation.valid) {
        errors.push(`OGNL expression error: ${ognlValidation.error}`);
      }
    }

    if (!rule.priority || rule.priority < 1 || rule.priority > 10) {
      errors.push('Priority must be between 1 and 10');
    }

    return { valid: errors.length === 0, errors };
  }, [validateOgnlExpression]);

  return {
    validateOgnlExpression,
    validateRuleData,
  };
}

/**
 * Hook for rule operations and utilities.
 */
export function useRuleActions() {
  const { dispatch } = useUIController();
  const dataWorker = getDataWorker();

  useEffect(() => {
    dataWorker.setUIDispatch(dispatch);
  }, [dispatch]);

  const duplicateRule = useCallback(
    async (rule: Rule) => {
      const duplicatedRule: Omit<Rule, 'id'> = {
        ...rule,
        name: `${rule.name} (Copy)`,
        enabled: false, // Disable copies by default
      };

      try {
        await dataWorker.createRule(duplicatedRule);

        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Rule Duplicated',
            message: `Rule "${duplicatedRule.name}" created successfully`,
          },
        });
      } catch (error) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Duplication Failed',
            message: error instanceof Error ? error.message : 'Failed to duplicate rule',
          },
        });
        throw error;
      }
    },
    [dispatch, dataWorker]
  );

  const toggleRuleStatus = useCallback(
    async (rule: Rule) => {
      const updatedRule = { ...rule, enabled: !rule.enabled };

      try {
        await dataWorker.updateRule(updatedRule);

        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Rule Status Updated',
            message: `Rule "${rule.name}" ${updatedRule.enabled ? 'enabled' : 'disabled'}`,
          },
        });
      } catch (error) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Status Update Failed',
            message: error instanceof Error ? error.message : 'Failed to update rule status',
          },
        });
        throw error;
      }
    },
    [dispatch, dataWorker]
  );

  const bulkUpdateRules = useCallback(
    async (ruleIds: string[], updates: Partial<Rule>) => {
      const { rules } = useReactiveRules();
      const targetRules = rules.filter(rule => ruleIds.includes(rule.id));

      const results = await Promise.allSettled(
        targetRules.map(rule => dataWorker.updateRule({ ...rule, ...updates }))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Bulk Update Complete',
            message: `${successful} rules updated successfully${failed > 0 ? `, ${failed} failed` : ''}`,
          },
        });
      }

      if (failed > 0 && successful === 0) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Bulk Update Failed',
            message: `Failed to update ${failed} rules`,
          },
        });
      }

      return { successful, failed };
    },
    [dispatch, dataWorker]
  );

  return {
    duplicateRule,
    toggleRuleStatus,
    bulkUpdateRules,
  };
}

/**
 * Hook for rule search and filtering.
 */
export function useRuleFilters() {
  const { rules } = useReactiveRules();
  const { search, enabled, category } = { search: '', enabled: undefined, category: undefined }; // Default empty filters

  const filteredRules = rules.filter(rule => {
    // Search filter
    if (search && !rule.name.toLowerCase().includes(search.toLowerCase()) &&
        !rule.description.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }

    // Enabled filter
    if (enabled !== undefined && rule.enabled !== enabled) {
      return false;
    }

    // Category filter
    if (category && rule.category !== category) {
      return false;
    }

    return true;
  });

  const categories = [...new Set(rules.map(rule => rule.category).filter(Boolean))];

  return {
    filteredRules,
    categories,
    totalFiltered: filteredRules.length,
    hasActiveFilters: !!(search || enabled !== undefined || category),
  };
}