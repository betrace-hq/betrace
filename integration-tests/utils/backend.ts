/**
 * Backend API client for integration tests
 *
 * Provides type-safe methods for interacting with BeTrace backend API.
 */

import axios, { AxiosInstance } from 'axios';
import config from './config';

export interface Rule {
  id: string;
  name: string;
  dsl: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Violation {
  id: string;
  ruleId: string;
  ruleName: string;
  traceId: string;
  spanId: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface CreateRuleRequest {
  name: string;
  dsl: string;
  enabled?: boolean;
}

export interface UpdateRuleRequest {
  name?: string;
  dsl?: string;
  enabled?: boolean;
}

export class BackendClient {
  private client: AxiosInstance;

  constructor(baseURL: string = config.backend) {
    this.client = axios.create({
      baseURL,
      timeout: config.timeouts.apiRequest,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string }> {
    const response = await this.client.get(config.api.health);
    return response.data;
  }

  /**
   * List all rules
   */
  async listRules(): Promise<Rule[]> {
    const response = await this.client.get<Rule[]>(config.api.rules);
    return response.data;
  }

  /**
   * Get rule by ID
   */
  async getRule(id: string): Promise<Rule> {
    const response = await this.client.get<Rule>(`${config.api.rules}/${id}`);
    return response.data;
  }

  /**
   * Create new rule
   */
  async createRule(data: CreateRuleRequest): Promise<Rule> {
    const response = await this.client.post<Rule>(config.api.rules, data);
    return response.data;
  }

  /**
   * Update existing rule
   */
  async updateRule(id: string, data: UpdateRuleRequest): Promise<Rule> {
    const response = await this.client.put<Rule>(`${config.api.rules}/${id}`, data);
    return response.data;
  }

  /**
   * Delete rule
   */
  async deleteRule(id: string): Promise<void> {
    await this.client.delete(`${config.api.rules}/${id}`);
  }

  /**
   * List violations
   */
  async listViolations(params?: {
    ruleId?: string;
    traceId?: string;
    startTime?: string;
    endTime?: string;
  }): Promise<Violation[]> {
    const response = await this.client.get<Violation[]>(config.api.violations, { params });
    return response.data;
  }

  /**
   * Get violation by ID
   */
  async getViolation(id: string): Promise<Violation> {
    const response = await this.client.get<Violation>(`${config.api.violations}/${id}`);
    return response.data;
  }

  /**
   * Wait for backend to persist data
   */
  async waitForSync(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, config.timeouts.backendSync));
  }

  /**
   * Verify rule exists in backend
   */
  async verifyRuleExists(id: string, maxAttempts: number = 3): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this.getRule(id);
        return true;
      } catch (error) {
        if (i < maxAttempts - 1) {
          await this.waitForSync();
        }
      }
    }
    return false;
  }

  /**
   * Count rules (for verification)
   */
  async countRules(): Promise<number> {
    const rules = await this.listRules();
    return rules.length;
  }

  /**
   * Delete all rules (cleanup helper)
   */
  async deleteAllRules(): Promise<void> {
    const rules = await this.listRules();
    await Promise.all(rules.map(rule => this.deleteRule(rule.id)));
  }
}

export const backend = new BackendClient();
export default backend;
