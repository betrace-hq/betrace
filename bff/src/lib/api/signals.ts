import { httpClient, type ApiResponse } from './client';

// Signal status types based on PRD
export type SignalStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
export type SignalSeverity = 'ERROR' | 'WARNING' | 'INFO';

// Signal interface based on BeTrace requirements
export interface Signal {
  id: string;
  ruleId: string;
  ruleName: string;
  status: SignalStatus;
  severity: SignalSeverity;
  serviceName: string;
  message: string;
  metadata: Record<string, any>;
  traceId?: string;
  spanId?: string;
  createdAt: string;
  updatedAt: string;
  investigatedBy?: string;
  notes?: string;
  incidentId?: string;
}

// Signal creation/update request
export interface SignalUpdateRequest {
  status?: SignalStatus;
  notes?: string;
  investigatedBy?: string;
  incidentId?: string;
}

// Signal filter parameters
export interface SignalFilters {
  status?: SignalStatus[];
  severity?: SignalSeverity[];
  serviceName?: string[];
  ruleId?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
  limit?: number;
  offset?: number;
}

// Signals API service
export class SignalsApi {
  /**
   * Get signals with optional filtering
   */
  async getSignals(
    filters?: SignalFilters,
    tenantId?: string
  ): Promise<ApiResponse<Signal[]>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (filters) {
      if (filters.status?.length) {
        filters.status.forEach(status => params.append('status', status));
      }
      if (filters.severity?.length) {
        filters.severity.forEach(severity => params.append('severity', severity));
      }
      if (filters.serviceName?.length) {
        filters.serviceName.forEach(service => params.append('serviceName', service));
      }
      if (filters.ruleId?.length) {
        filters.ruleId.forEach(ruleId => params.append('ruleId', ruleId));
      }
      if (filters.timeRange) {
        params.append('startTime', filters.timeRange.start);
        params.append('endTime', filters.timeRange.end);
      }
      if (filters.limit) {
        params.append('limit', filters.limit.toString());
      }
      if (filters.offset) {
        params.append('offset', filters.offset.toString());
      }
    }

    const query = params.toString();
    const path = query ? `/signals?${query}` : '/signals';

    return httpClient.get<Signal[]>(path, headers);
  }

  /**
   * Get signal by ID
   */
  async getSignalById(
    id: string,
    tenantId?: string
  ): Promise<ApiResponse<Signal>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.get<Signal>(`/signals/${id}`, headers);
  }

  /**
   * Update signal status and metadata
   */
  async updateSignal(
    id: string,
    update: SignalUpdateRequest,
    tenantId?: string
  ): Promise<ApiResponse<Signal>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.patch<Signal>(`/signals/${id}`, update, headers);
  }

  /**
   * Get signal statistics
   */
  async getSignalStats(tenantId?: string): Promise<ApiResponse<{
    total: number;
    byStatus: Record<SignalStatus, number>;
    bySeverity: Record<SignalSeverity, number>;
  }>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.get('/signals/stats', headers);
  }

  /**
   * Get signal metrics for dashboard
   */
  async getSignalMetrics(
    timeRange: { start: string; end: string },
    tenantId?: string
  ): Promise<ApiResponse<{
    timeline: Array<{
      timestamp: string;
      count: number;
      byStatus: Record<SignalStatus, number>;
    }>;
    topServices: Array<{
      serviceName: string;
      count: number;
    }>;
    topRules: Array<{
      ruleId: string;
      ruleName: string;
      count: number;
    }>;
  }>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const params = new URLSearchParams({
      startTime: timeRange.start,
      endTime: timeRange.end,
    });

    return httpClient.get(`/signals/metrics?${params}`, headers);
  }
}

// Export singleton instance
export const signalsApi = new SignalsApi();