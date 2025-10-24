import { DataQuery, DataSourceJsonData } from '@grafana/data';

/**
 * BeTrace Datasource Query
 */
export interface BeTraceQuery extends DataQuery {
  queryType: 'violations' | 'stats' | 'traces';

  // Violation query options
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'all';
  serviceName?: string;
  ruleId?: string;
  limit?: number;

  // Stats query options
  statsType?: 'total' | 'by_severity' | 'by_service' | 'by_rule' | 'timeline';
  groupBy?: string;
  interval?: string;

  // Trace query options
  traceId?: string;
}

export const defaultQuery: Partial<BeTraceQuery> = {
  queryType: 'violations',
  severity: 'all',
  limit: 100,
};

/**
 * BeTrace Datasource Configuration
 */
export interface BeTraceDataSourceOptions extends DataSourceJsonData {
  backendUrl?: string;
  timeout?: number;
}

/**
 * BeTrace Secure Configuration (for API keys, etc.)
 */
export interface BeTraceSecureJsonData {
  apiKey?: string;
}

/**
 * Violation data structure returned from backend
 */
export interface ViolationData {
  id: string;
  traceId: string;
  spanId: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: number;
  serviceName: string;
  spanName: string;
  attributes: Record<string, any>;
}

/**
 * Stats data structure returned from backend
 */
export interface StatsData {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  last24h: number;
  lastHour: number;
  affectedServices: number;
  affectedTraces: number;
}
