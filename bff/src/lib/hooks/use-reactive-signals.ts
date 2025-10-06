/**
 * Reactive Signals Hook - Context+useReducer implementation
 *
 * Replaces TanStack Query with reactive architecture following ADR-006:
 * - Uses React Context + useReducer for state management
 * - Delegates heavy operations to background workers
 * - Provides stable references following React best practices
 */

import { useCallback, useEffect } from 'react';
import { useUIController } from '../reactive-engine/ui-controller';
import { getDataWorker } from '../workers/data-worker';
import { SignalStatus } from '../types/fluo-api';
import type { SignalFilters } from '../reactive-engine/ui-controller';

export function useReactiveSignals() {
  const { state, dispatch } = useUIController();
  const { signals } = state;

  // Get data worker instance
  const dataWorker = getDataWorker();

  // Set up worker connection if not already done
  useEffect(() => {
    dataWorker.setUIDispatch(dispatch);
  }, [dispatch]);

  // Stable callback functions using useCallback for dependency arrays
  const fetchSignals = useCallback(
    async (filters?: Partial<SignalFilters>) => {
      if (filters) {
        dispatch({ type: 'SET_SIGNAL_FILTERS', payload: filters });
      }
      await dataWorker.fetchSignals(filters);
    },
    [dispatch, dataWorker]
  );

  const updateSignal = useCallback(
    async (signalId: string, status: SignalStatus) => {
      try {
        await dataWorker.updateSignal(signalId, status);

        // Show success notification
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Signal Updated',
            message: `Signal status changed to ${status}`,
          },
        });
      } catch (error) {
        // Show error notification
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Update Failed',
            message: error instanceof Error ? error.message : 'Failed to update signal',
          },
        });
        throw error;
      }
    },
    [dispatch, dataWorker]
  );

  const setFilters = useCallback(
    (filters: Partial<SignalFilters>) => {
      dispatch({ type: 'SET_SIGNAL_FILTERS', payload: filters });
      // Trigger refetch with new filters
      dataWorker.fetchSignals(filters);
    },
    [dispatch, dataWorker]
  );

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_SIGNAL_FILTERS' });
    // Trigger refetch with default filters
    dataWorker.fetchSignals();
  }, [dispatch, dataWorker]);

  const refreshSignals = useCallback(async () => {
    await dataWorker.fetchSignals(signals.filters);
  }, [dataWorker, signals.filters]);

  // Auto-fetch signals on mount and filter changes
  useEffect(() => {
    fetchSignals(signals.filters);
  }, []); // Only run on mount, fetchSignals handles filter changes

  return {
    // Data
    signals: signals.data,
    totalCount: signals.totalCount,
    loading: signals.loading,
    error: signals.error,
    filters: signals.filters,

    // Actions with stable references
    fetchSignals,
    updateSignal,
    setFilters,
    resetFilters,
    refreshSignals,

    // Computed values
    hasSignals: signals.data.length > 0,
    hasError: signals.error !== null,
    isEmpty: !signals.loading && signals.data.length === 0,
  };
}

/**
 * Hook for signal statistics and analytics.
 */
export function useSignalAnalytics() {
  const { state, dispatch } = useUIController();
  const { analytics } = state;

  const dataWorker = getDataWorker();

  useEffect(() => {
    dataWorker.setUIDispatch(dispatch);
  }, [dispatch]);

  const fetchAnalytics = useCallback(async () => {
    await dataWorker.fetchAnalytics();
  }, [dataWorker]);

  // Auto-fetch analytics on mount
  useEffect(() => {
    fetchAnalytics();
  }, []); // Only run on mount

  return {
    // Data
    signalCounts: analytics.signalCounts,
    loading: analytics.loading,
    error: analytics.error,

    // Actions
    fetchAnalytics,

    // Computed values
    totalSignals: Object.values(analytics.signalCounts).reduce((sum, count) => sum + count, 0),
    hasData: Object.values(analytics.signalCounts).some(count => count > 0),
  };
}

/**
 * Hook for individual signal operations.
 */
export function useSignalActions() {
  const { dispatch } = useUIController();
  const dataWorker = getDataWorker();

  useEffect(() => {
    dataWorker.setUIDispatch(dispatch);
  }, [dispatch]);

  const updateSignalStatus = useCallback(
    async (signalId: string, status: SignalStatus) => {
      try {
        await dataWorker.updateSignal(signalId, status);

        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Signal Updated',
            message: `Signal status changed to ${status}`,
          },
        });
      } catch (error) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Update Failed',
            message: error instanceof Error ? error.message : 'Failed to update signal',
          },
        });
        throw error;
      }
    },
    [dispatch, dataWorker]
  );

  const bulkUpdateSignals = useCallback(
    async (signalIds: string[], status: SignalStatus) => {
      const results = await Promise.allSettled(
        signalIds.map(id => dataWorker.updateSignal(id, status))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (successful > 0) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'success',
            title: 'Bulk Update Complete',
            message: `${successful} signals updated successfully${failed > 0 ? `, ${failed} failed` : ''}`,
          },
        });
      }

      if (failed > 0 && successful === 0) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'error',
            title: 'Bulk Update Failed',
            message: `Failed to update ${failed} signals`,
          },
        });
      }

      return { successful, failed };
    },
    [dispatch, dataWorker]
  );

  return {
    updateSignalStatus,
    bulkUpdateSignals,
  };
}

/**
 * Hook for signal filtering and search.
 */
export function useSignalFilters() {
  const { state, dispatch } = useUIController();
  const { filters } = state.signals;

  const setStatus = useCallback(
    (status?: SignalStatus) => {
      dispatch({
        type: 'SET_SIGNAL_FILTERS',
        payload: { ...filters, status, page: 1 }, // Reset to first page
      });
    },
    [dispatch, filters]
  );

  const setSearch = useCallback(
    (search?: string) => {
      dispatch({
        type: 'SET_SIGNAL_FILTERS',
        payload: { ...filters, search, page: 1 }, // Reset to first page
      });
    },
    [dispatch, filters]
  );

  const setDateRange = useCallback(
    (dateRange?: { start: Date; end: Date }) => {
      dispatch({
        type: 'SET_SIGNAL_FILTERS',
        payload: { ...filters, dateRange, page: 1 }, // Reset to first page
      });
    },
    [dispatch, filters]
  );

  const setPage = useCallback(
    (page: number) => {
      dispatch({
        type: 'SET_SIGNAL_FILTERS',
        payload: { ...filters, page },
      });
    },
    [dispatch, filters]
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      dispatch({
        type: 'SET_SIGNAL_FILTERS',
        payload: { ...filters, pageSize, page: 1 }, // Reset to first page
      });
    },
    [dispatch, filters]
  );

  const clearFilters = useCallback(() => {
    dispatch({ type: 'RESET_SIGNAL_FILTERS' });
  }, [dispatch]);

  return {
    // Current filters
    filters,

    // Filter setters
    setStatus,
    setSearch,
    setDateRange,
    setPage,
    setPageSize,
    clearFilters,

    // Computed values
    hasActiveFilters: !!(filters.status || filters.search || filters.dateRange),
    isFirstPage: filters.page === 1,
  };
}