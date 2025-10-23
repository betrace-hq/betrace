import { httpClient, type ApiResponse } from './client';
import type { paths } from '@/lib/types/betrace-api';

// Extract types from OpenAPI schema
type RulesResponse = paths['/api/v1/rules']['get']['responses']['200']['content']['application/json'];
type Rule = RulesResponse extends (infer U)[] ? U : never;
type CreateRuleRequest = paths['/api/v1/rules']['post']['requestBody']['content']['application/json'];
type RuleByIdResponse = paths['/api/v1/rules/{id}']['get']['responses']['200']['content']['application/json'];

// Rules API service
export class RulesApi {
  /**
   * Get all active rules
   */
  async getAllRules(tenantId?: string): Promise<ApiResponse<Rule[]>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.get<Rule[]>('/api/v1/rules', headers);
  }

  /**
   * Create a new rule
   */
  async createRule(
    rule: CreateRuleRequest,
    tenantId?: string
  ): Promise<ApiResponse<Rule>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.post<Rule>('/api/v1/rules', rule, headers);
  }

  /**
   * Get rule by ID
   */
  async getRuleById(
    id: string,
    tenantId?: string
  ): Promise<ApiResponse<RuleByIdResponse>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.get<RuleByIdResponse>(`/api/v1/rules/${id}`, headers);
  }

  /**
   * Update an existing rule
   */
  async updateRule(
    id: string,
    rule: CreateRuleRequest,
    tenantId?: string
  ): Promise<ApiResponse<Rule>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.put<Rule>(`/api/v1/rules/${id}`, rule, headers);
  }

  /**
   * Delete a rule
   */
  async deleteRule(id: string, tenantId?: string): Promise<ApiResponse<void>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.delete<void>(`/api/v1/rules/${id}`, headers);
  }

  /**
   * Activate a rule
   */
  async activateRule(id: string, tenantId?: string): Promise<ApiResponse<Rule>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.post<Rule>(`/api/v1/rules/${id}/activate`, {}, headers);
  }

  /**
   * Deactivate a rule
   */
  async deactivateRule(id: string, tenantId?: string): Promise<ApiResponse<Rule>> {
    const headers: Record<string, string> = {};
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    return httpClient.post<Rule>(`/api/v1/rules/${id}/deactivate`, {}, headers);
  }
}

// Export singleton instance
export const rulesApi = new RulesApi();