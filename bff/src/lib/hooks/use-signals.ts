import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { signalsApi, type SignalFilters, type SignalUpdateRequest } from '@/lib/api/signals';
import { useAuth } from '@/lib/auth/auth-context';
import { DemoApiService } from '@/lib/api/demo-api';

// Query keys for signals
export const signalsKeys = {
  all: ['signals'] as const,
  lists: () => [...signalsKeys.all, 'list'] as const,
  list: (filters: SignalFilters) => [...signalsKeys.lists(), filters] as const,
  details: () => [...signalsKeys.all, 'detail'] as const,
  detail: (id: string) => [...signalsKeys.details(), id] as const,
  stats: () => [...signalsKeys.all, 'stats'] as const,
  metrics: () => [...signalsKeys.all, 'metrics'] as const,
  metricsWithRange: (timeRange: { start: string; end: string }) =>
    [...signalsKeys.metrics(), timeRange] as const,
};

/**
 * Hook to fetch signals with optional filtering
 */
export function useSignals(filters?: SignalFilters) {
  const { tenant, isDemoMode } = useAuth();

  return useQuery({
    queryKey: signalsKeys.list(filters || {}),
    queryFn: () => {
      if (isDemoMode) {
        return DemoApiService.getSignals({
          status: filters?.status?.[0],
          severity: filters?.severity?.[0],
        });
      }
      return signalsApi.getSignals(filters, tenant?.id).then(response => response.data);
    },
    staleTime: 10 * 1000, // 10 seconds for real-time data
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch a specific signal by ID
 */
export function useSignal(id: string) {
  const { tenant, isDemoMode } = useAuth();

  return useQuery({
    queryKey: signalsKeys.detail(id),
    queryFn: () => {
      if (isDemoMode) {
        return DemoApiService.getSignalById(id);
      }
      return signalsApi.getSignalById(id, tenant?.id);
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to get signal statistics
 */
export function useSignalStats() {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: signalsKeys.stats(),
    queryFn: () => signalsApi.getSignalStats(tenant?.id),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to get signal metrics for dashboard
 */
export function useSignalMetrics(timeRange: { start: string; end: string }) {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: signalsKeys.metricsWithRange(timeRange),
    queryFn: () => signalsApi.getSignalMetrics(timeRange, tenant?.id),
    enabled: !!timeRange.start && !!timeRange.end,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to update signal status and metadata
 */
export function useUpdateSignal() {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      update
    }: {
      id: string;
      update: SignalUpdateRequest
    }) =>
      signalsApi.updateSignal(id, update, tenant?.id),
    onSuccess: (data, { id }) => {
      // Update signal in cache
      queryClient.setQueryData(signalsKeys.detail(id), data);

      // Invalidate signals lists and stats
      queryClient.invalidateQueries({ queryKey: signalsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: signalsKeys.stats() });
    },
    onError: (error) => {
      console.error('Failed to update signal:', error);
    },
  });
}

/**
 * Hook to mark signal as investigating
 */
export function useInvestigateSignal() {
  const updateSignal = useUpdateSignal();
  const queryClient = useQueryClient();
  const { user, isDemoMode } = useAuth();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      if (isDemoMode) {
        return DemoApiService.investigateSignal(id, notes || `Investigation started by ${user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}`);
      }
      const response = await updateSignal.mutateAsync({
        id,
        update: {
          status: 'INVESTIGATING',
          investigatedBy: user?.email,
          notes,
        },
      });
      return response as any;
    },
    onSuccess: () => {
      if (isDemoMode) {
        queryClient.invalidateQueries({ queryKey: signalsKeys.lists() });
      }
    },
    onError: (error) => {
      console.error('Failed to mark signal as investigating:', error);
    },
  });
}

/**
 * Hook to resolve signal
 */
export function useResolveSignal() {
  const updateSignal = useUpdateSignal();
  const queryClient = useQueryClient();
  const { user, isDemoMode } = useAuth();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      if (isDemoMode) {
        return DemoApiService.resolveSignal(id, notes || `Resolved by ${user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}`);
      }
      const response = await updateSignal.mutateAsync({
        id,
        update: {
          status: 'RESOLVED',
          notes,
        },
      });
      return response as any;
    },
    onSuccess: () => {
      if (isDemoMode) {
        queryClient.invalidateQueries({ queryKey: signalsKeys.lists() });
      }
    },
    onError: (error) => {
      console.error('Failed to resolve signal:', error);
    },
  });
}

/**
 * Hook to mark signal as false positive
 */
export function useMarkFalsePositive() {
  const updateSignal = useUpdateSignal();
  const queryClient = useQueryClient();
  const { user, isDemoMode } = useAuth();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      if (isDemoMode) {
        return DemoApiService.markFalsePositive(id, notes || `Marked as false positive by ${user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}`);
      }
      const response = await updateSignal.mutateAsync({
        id,
        update: {
          status: 'FALSE_POSITIVE',
          investigatedBy: user?.email,
          notes,
        },
      });
      return response as any;
    },
    onSuccess: () => {
      if (isDemoMode) {
        queryClient.invalidateQueries({ queryKey: signalsKeys.lists() });
      }
    },
    onError: (error) => {
      console.error('Failed to mark signal as false positive:', error);
    },
  });
}

/**
 * Hook to add notes to signal
 */
export function useAddSignalNotes() {
  const updateSignal = useUpdateSignal();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      updateSignal.mutateAsync({
        id,
        update: { notes },
      }),
    onError: (error) => {
      console.error('Failed to add notes to signal:', error);
    },
  });
}