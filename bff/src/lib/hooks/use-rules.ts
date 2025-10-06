import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rulesApi } from '@/lib/api/rules';
import { useAuth } from '@/lib/auth/auth-context';
import { DemoApiService } from '@/lib/api/demo-api';

// Query keys for rules
export const rulesKeys = {
  all: ['rules'] as const,
  lists: () => [...rulesKeys.all, 'list'] as const,
  list: (filters: string) => [...rulesKeys.lists(), filters] as const,
  details: () => [...rulesKeys.all, 'detail'] as const,
  detail: (id: string) => [...rulesKeys.details(), id] as const,
};

/**
 * Hook to fetch all rules
 */
export function useRules() {
  const { tenant, isDemoMode } = useAuth();

  return useQuery({
    queryKey: rulesKeys.list(tenant?.id || 'default'),
    queryFn: () => {
      if (isDemoMode) {
        return DemoApiService.getRules();
      }
      return rulesApi.getAllRules(tenant?.id);
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch a specific rule by ID
 */
export function useRule(id: string) {
  const { tenant } = useAuth();

  return useQuery({
    queryKey: rulesKeys.detail(id),
    queryFn: () => rulesApi.getRuleById(id, tenant?.id),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to create a new rule
 */
export function useCreateRule() {
  const queryClient = useQueryClient();
  const { tenant, isDemoMode } = useAuth();

  return useMutation({
    mutationFn: (ruleData: any) => {
      if (isDemoMode) {
        return DemoApiService.createRule(ruleData);
      }
      return rulesApi.createRule(ruleData, tenant?.id);
    },
    onSuccess: () => {
      // Invalidate and refetch rules list
      queryClient.invalidateQueries({ queryKey: rulesKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to create rule:', error);
    },
  });
}

/**
 * Hook to update an existing rule
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();
  const { tenant, isDemoMode } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      ruleData
    }: {
      id: string;
      ruleData: any
    }) => {
      if (isDemoMode) {
        return DemoApiService.updateRule(id, ruleData);
      }
      return rulesApi.updateRule(id, ruleData, tenant?.id);
    },
    onSuccess: (_, { id }) => {
      // Invalidate specific rule and rules list
      queryClient.invalidateQueries({ queryKey: rulesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: rulesKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to update rule:', error);
    },
  });
}

/**
 * Hook to delete a rule
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();
  const { tenant, isDemoMode } = useAuth();

  return useMutation({
    mutationFn: (id: string) => {
      if (isDemoMode) {
        return DemoApiService.deleteRule(id);
      }
      return rulesApi.deleteRule(id, tenant?.id);
    },
    onSuccess: (_, id) => {
      // Remove rule from cache and invalidate lists
      queryClient.removeQueries({ queryKey: rulesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: rulesKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to delete rule:', error);
    },
  });
}

/**
 * Hook to activate a rule
 */
export function useActivateRule() {
  const queryClient = useQueryClient();
  const { tenant, isDemoMode } = useAuth();

  return useMutation({
    mutationFn: (id: string) => {
      if (isDemoMode) {
        return DemoApiService.activateRule(id);
      }
      return rulesApi.activateRule(id, tenant?.id);
    },
    onSuccess: (_, id) => {
      // Update rule in cache
      queryClient.invalidateQueries({ queryKey: rulesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: rulesKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to activate rule:', error);
    },
  });
}

/**
 * Hook to deactivate a rule
 */
export function useDeactivateRule() {
  const queryClient = useQueryClient();
  const { tenant, isDemoMode } = useAuth();

  return useMutation({
    mutationFn: (id: string) => {
      if (isDemoMode) {
        return DemoApiService.deactivateRule(id);
      }
      return rulesApi.deactivateRule(id, tenant?.id);
    },
    onSuccess: (_, id) => {
      // Update rule in cache
      queryClient.invalidateQueries({ queryKey: rulesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: rulesKeys.lists() });
    },
    onError: (error) => {
      console.error('Failed to deactivate rule:', error);
    },
  });
}