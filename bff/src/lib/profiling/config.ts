import packageJson from '../../../package.json';

export interface OtelConfig {
  endpoint: string;
  appName: string;
  environment: string;
  version: string;
  tenantId?: string;
}

export function getProfilingConfig(): OtelConfig | null {
  const endpoint = import.meta.env.VITE_OTEL_ENDPOINT || 'http://localhost:4318/v1/traces';

  if (!endpoint) {
    console.warn('[Profiling] VITE_OTEL_ENDPOINT not configured, profiling disabled');
    return null;
  }

  const environment = import.meta.env.MODE || 'development';
  const version = packageJson.version;

  // Get tenant_id from localStorage or session if available
  const getTenantId = (): string | undefined => {
    try {
      const tenantData = localStorage.getItem('tenant_id');
      return tenantData || undefined;
    } catch {
      return undefined;
    }
  };

  return {
    endpoint,
    appName: 'betrace.bff',
    environment,
    version,
    tenantId: getTenantId()
  };
}
