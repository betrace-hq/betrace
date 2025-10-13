import { useQuery } from '@tanstack/react-query';

export interface GrafanaConfig {
  baseUrl: string;
  orgId: number;
  datasourceUid: string;
}

export interface UseGrafanaConfigResult {
  isLoading: boolean;
  isConfigured: boolean;
  baseUrl?: string;
  orgId?: number;
  datasourceUid?: string;
}

/**
 * Validates that a URL is a valid HTTP/HTTPS URL
 * SECURITY: Prevents javascript:, data:, file: protocol injection
 */
function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Hook to fetch and cache Grafana configuration from backend
 * Returns configuration status and details if available
 *
 * SECURITY: Validates baseUrl to prevent URL injection attacks
 */
export function useGrafanaConfig(): UseGrafanaConfigResult {
  const { data, isLoading, isError } = useQuery<GrafanaConfig>({
    queryKey: ['grafana-config'],
    queryFn: async () => {
      const response = await fetch('/api/grafana/config');

      if (!response.ok) {
        if (response.status === 404) {
          // Grafana not configured
          throw new Error('Not configured');
        }
        throw new Error('Failed to fetch Grafana config');
      }

      const config = await response.json();

      // SECURITY P0-1: Validate baseUrl to prevent URL injection
      if (config.baseUrl && !isValidHttpUrl(config.baseUrl)) {
        console.error('[Security] Invalid Grafana baseUrl detected:', config.baseUrl);
        throw new Error('Invalid Grafana base URL');
      }

      return config;
    },
    // Cache for 5 minutes since config rarely changes
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Configuration is valid if all required fields are present
  const isConfigured =
    !isLoading &&
    !isError &&
    !!data?.baseUrl &&
    typeof data?.orgId === 'number' &&
    !!data?.datasourceUid;

  return {
    isLoading,
    isConfigured,
    baseUrl: data?.baseUrl,
    orgId: data?.orgId,
    datasourceUid: data?.datasourceUid,
  };
}
