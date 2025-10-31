/**
 * React Hooks for Effect Integration
 *
 * Provides React hooks that bridge Effect-based services with React state.
 * Follows standard React Query patterns for familiarity.
 */

import { useState, useEffect as useReactEffect, useCallback, useRef } from 'react';
import { Effect } from 'effect';
import { runEffect } from '../services/runtime';
import { BeTraceService, BeTraceServiceError } from '../services/BeTraceService';

// ============================================================================
// Hook Types
// ============================================================================

export interface QueryState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
}

export interface MutationState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
}

export interface MutationCallbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// useEffectQuery - For data fetching
// ============================================================================

/**
 * Execute an Effect and manage its state in React.
 *
 * Similar to React Query's useQuery, but for Effect-based operations.
 *
 * @example
 * ```ts
 * const rulesQuery = useEffectQuery(
 *   (service) => service.listRules(),
 *   { refetchOnMount: true }
 * );
 *
 * if (rulesQuery.isLoading) return <Spinner />;
 * if (rulesQuery.isError) return <Alert>{rulesQuery.error}</Alert>;
 * return <RuleList rules={rulesQuery.data.rules} />;
 * ```
 */
export function useEffectQuery<A>(
  makeEffect: (service: BeTraceService) => Effect.Effect<A, BeTraceServiceError>,
  options: {
    enabled?: boolean;
    refetchOnMount?: boolean;
    onSuccess?: (data: A) => void;
    onError?: (error: string) => void;
  } = {}
): QueryState<A> {
  const {
    enabled = true,
    refetchOnMount = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const effect = Effect.gen(function* () {
        const service = yield* BeTraceService;
        return yield* makeEffect(service);
      });

      const result = await runEffect(effect);
      setData(result);
      setError(null);
      onSuccess?.(result);
    } catch (err) {
      const errorMessage =
        err instanceof BeTraceServiceError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'An unknown error occurred';

      setError(errorMessage);
      setData(null);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, makeEffect, onSuccess, onError]);

  useReactEffect(() => {
    if (enabled && refetchOnMount) {
      fetchData();
    }
  }, [enabled, refetchOnMount, fetchData]);

  return {
    data,
    error,
    isLoading,
    isError: error !== null,
    isSuccess: data !== null && error === null,
    refetch: fetchData,
  };
}

// ============================================================================
// useEffectMutation - For data mutations
// ============================================================================

/**
 * Execute an Effect mutation (create, update, delete) from React.
 *
 * Similar to React Query's useMutation, but for Effect-based operations.
 *
 * @example
 * ```ts
 * const createRuleMutation = useEffectMutation(
 *   (service, rule) => service.createRule(rule),
 *   {
 *     onSuccess: () => rulesQuery.refetch(),
 *     onError: (error) => alert(error),
 *   }
 * );
 *
 * const handleCreate = () => {
 *   createRuleMutation.mutate({
 *     name: 'My Rule',
 *     description: 'Test',
 *     expression: 'trace.has("error")',
 *     enabled: true,
 *   });
 * };
 * ```
 */
export function useEffectMutation<TInput, TOutput>(
  makeEffect: (
    service: BeTraceService,
    input: TInput
  ) => Effect.Effect<TOutput, BeTraceServiceError>,
  callbacks: MutationCallbacks<TOutput> = {}
): MutationState<TOutput> & {
  mutate: (input: TInput) => Promise<void>;
  mutateAsync: (input: TInput) => Promise<TOutput>;
} {
  const { onSuccess, onError } = callbacks;

  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (input: TInput) => {
      setIsLoading(true);
      setError(null);

      try {
        const effect = Effect.gen(function* () {
          const service = yield* BeTraceService;
          return yield* makeEffect(service, input);
        });

        const result = await runEffect(effect);
        setData(result);
        setError(null);
        onSuccess?.(result);
      } catch (err) {
        const errorMessage =
          err instanceof BeTraceServiceError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'An unknown error occurred';

        setError(errorMessage);
        setData(null);
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [makeEffect, onSuccess, onError]
  );

  const mutateAsync = useCallback(
    async (input: TInput): Promise<TOutput> => {
      setIsLoading(true);
      setError(null);

      try {
        const effect = Effect.gen(function* () {
          const service = yield* BeTraceService;
          return yield* makeEffect(service, input);
        });

        const result = await runEffect(effect);
        setData(result);
        setError(null);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof BeTraceServiceError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'An unknown error occurred';

        setError(errorMessage);
        setData(null);
        onError?.(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [makeEffect, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    isError: error !== null,
    isSuccess: data !== null && error === null,
    mutate,
    mutateAsync,
    reset,
  };
}

// ============================================================================
// useEffectCallback - For one-off Effect executions
// ============================================================================

/**
 * Create a callback that executes an Effect.
 *
 * Useful for event handlers where you don't need state management.
 *
 * @example
 * ```ts
 * const deleteRule = useEffectCallback(
 *   (service, id: string) => service.deleteRule(id),
 *   {
 *     onSuccess: () => rulesQuery.refetch(),
 *     onError: (error) => alert(error),
 *   }
 * );
 *
 * const handleDelete = () => {
 *   if (confirm('Delete?')) {
 *     deleteRule(ruleId);
 *   }
 * };
 * ```
 */
export function useEffectCallback<TInput, TOutput>(
  makeEffect: (
    service: BeTraceService,
    input: TInput
  ) => Effect.Effect<TOutput, BeTraceServiceError>,
  callbacks: MutationCallbacks<TOutput> = {}
): (input: TInput) => Promise<void> {
  const { onSuccess, onError } = callbacks;

  return useCallback(
    async (input: TInput) => {
      try {
        const effect = Effect.gen(function* () {
          const service = yield* BeTraceService;
          return yield* makeEffect(service, input);
        });

        const result = await runEffect(effect);
        onSuccess?.(result);
      } catch (err) {
        const errorMessage =
          err instanceof BeTraceServiceError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'An unknown error occurred';

        onError?.(errorMessage);
      }
    },
    [makeEffect, onSuccess, onError]
  );
}
