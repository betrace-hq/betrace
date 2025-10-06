/**
 * Centralized query key management for TanStack Query caching.
 *
 * Performance considerations:
 * - Rules: Cached for 15 minutes (rarely change)
 * - Signals: Cached for 30 seconds (frequently updated)
 * - Analytics: Cached for 2 minutes (updated periodically)
 * - Sessions: Cached for 10 minutes (moderate frequency)
 */

export const queryKeys = {
  // Rules - cacheable for longer periods (15 minutes)
  rules: {
    all: ['rules'] as const,
    lists: () => [...queryKeys.rules.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.rules.lists(), filters] as const,
    details: () => [...queryKeys.rules.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.rules.details(), id] as const,
    validation: (expression: string) => ['rules', 'validation', expression] as const,
  },

  // Signals - cached for shorter periods (30 seconds)
  signals: {
    all: ['signals'] as const,
    lists: () => [...queryKeys.signals.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.signals.lists(), filters] as const,
    details: () => [...queryKeys.signals.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.signals.details(), id] as const,
    investigation: (id: string) => [...queryKeys.signals.all, 'investigation', id] as const,
  },

  // Analytics - cached for moderate periods (2 minutes)
  analytics: {
    all: ['analytics'] as const,
    dashboard: () => [...queryKeys.analytics.all, 'dashboard'] as const,
    metrics: (timeframe: string) => [...queryKeys.analytics.all, 'metrics', timeframe] as const,
    trends: (period: string) => [...queryKeys.analytics.all, 'trends', period] as const,
  },

  // Sessions - cached for moderate periods (10 minutes)
  sessions: {
    all: ['sessions'] as const,
    current: () => [...queryKeys.sessions.all, 'current'] as const,
    user: (userId: string) => [...queryKeys.sessions.all, 'user', userId] as const,
  },

  // Tenants - cached for longer periods (10 minutes)
  tenants: {
    all: ['tenants'] as const,
    current: () => [...queryKeys.tenants.all, 'current'] as const,
    settings: (tenantId: string) => [...queryKeys.tenants.all, 'settings', tenantId] as const,
  },
} as const;

/**
 * Cache time configurations for different data types.
 * Optimized for performance vs. data freshness requirements.
 */
export const cacheConfig = {
  // Rules change infrequently - aggressive caching
  rules: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },

  // Signals are dynamic - moderate caching
  signals: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  },

  // Analytics are computed - balanced caching
  analytics: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },

  // Session data - moderate caching
  sessions: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  },

  // Tenant data - moderate caching
  tenants: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 20 * 60 * 1000, // 20 minutes
  },

  // Real-time data - minimal caching
  realtime: {
    staleTime: 0, // Always fetch fresh
    gcTime: 30 * 1000, // 30 seconds
    refetchInterval: 5000, // Refetch every 5 seconds
  },
} as const;

/**
 * Query invalidation helpers for maintaining cache consistency.
 */
export const invalidationHelpers = {
  // Invalidate all rules after mutations
  invalidateRules: () => queryKeys.rules.all,

  // Invalidate specific rule after update
  invalidateRule: (id: string) => queryKeys.rules.detail(id),

  // Invalidate signals when new ones are created or status changes
  invalidateSignals: () => queryKeys.signals.all,

  // Invalidate specific signal after status update
  invalidateSignal: (id: string) => queryKeys.signals.detail(id),

  // Invalidate analytics when underlying data changes
  invalidateAnalytics: () => queryKeys.analytics.all,

  // Invalidate session after authentication changes
  invalidateSession: () => queryKeys.sessions.current(),
} as const;