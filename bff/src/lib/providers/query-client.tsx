'use client';

import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Performance-optimized settings for FLUO data patterns
            staleTime: 5 * 60 * 1000, // 5 minutes - rules change infrequently
            gcTime: 10 * 60 * 1000, // 10 minutes in cache after unused
            refetchOnWindowFocus: false, // Prevent unnecessary refetches
            refetchOnMount: true, // Always get fresh data on mount
            refetchOnReconnect: 'always', // Ensure data consistency after reconnect
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors (except 408)
              if (error?.status >= 400 && error?.status < 500 && error?.status !== 408) {
                return false;
              }
              // Exponential backoff for retries
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Network error handling
            networkMode: 'online',
          },
          mutations: {
            retry: false,
            // Optimistic updates for better UX
            networkMode: 'online',
          },
        },
        // Query-specific overrides for different data types
        queryCache: new QueryCache({
          onError: (error, query) => {
            console.error(`Query error for ${query.queryKey}:`, error);
          },
          onSuccess: (data, query) => {
            // Log successful cache hits for monitoring
            if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt < 1000) {
              console.debug(`Fresh data loaded for ${query.queryKey}`);
            }
          },
        }),
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}