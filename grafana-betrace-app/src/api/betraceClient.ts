/**
 * BeTrace API Client with Debug Logging
 *
 * Provides a typed, debug-enabled client for BeTrace backend REST API.
 * Logs all requests, responses, and errors with timing information.
 */

import { Rule } from '../types/Rule';

// Enable debug logging with localStorage flag
const DEBUG_KEY = 'betrace.debug';
const isDebugEnabled = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(DEBUG_KEY) === 'true' || window.location.search.includes('debug=true');
  }
  return false;
};

// Debug logger
const debug = (...args: any[]) => {
  if (isDebugEnabled()) {
    console.log('[BeTrace API]', new Date().toISOString(), ...args);
  }
};

const error = (...args: any[]) => {
  console.error('[BeTrace API Error]', new Date().toISOString(), ...args);
};

// API Response types
export interface ListRulesResponse {
  rules: Rule[];
  nextPageToken?: string;
  totalCount: number;
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  details?: any;
}

// API Client Configuration
export interface BeTraceClientConfig {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class BeTraceClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: BeTraceClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:12011';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 2;
    this.retryDelay = config.retryDelay || 1000;

    debug('Client initialized:', { baseUrl: this.baseUrl, timeout: this.timeout });
  }

  /**
   * Perform HTTP request with retry logic and debug logging
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: any;
      params?: Record<string, any>;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    // Add query params
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    debug(`→ [${requestId}] ${method} ${url.pathname}`, {
      params: options.params,
      bodySize: options.body ? JSON.stringify(options.body).length : 0,
    });

    let lastError: any;

    // Retry logic
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      if (attempt > 0) {
        debug(`  ↻ [${requestId}] Retry attempt ${attempt}/${this.retryAttempts}`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url.toString(), {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        const responseText = await response.text();

        debug(`← [${requestId}] ${method} ${url.pathname}`, {
          status: response.status,
          duration: `${duration}ms`,
          bodySize: responseText.length,
        });

        if (!response.ok) {
          let errorData: any;
          try {
            errorData = JSON.parse(responseText);
          } catch {
            errorData = { message: responseText };
          }

          const apiError: ApiError = {
            message: errorData.error || errorData.message || `HTTP ${response.status}`,
            code: errorData.code || response.statusText,
            status: response.status,
            details: errorData,
          };

          error(`✗ [${requestId}] ${method} ${url.pathname} failed:`, apiError);

          throw apiError;
        }

        // Parse response
        if (!responseText) {
          return {} as T;
        }

        const data = JSON.parse(responseText);
        debug(`  ✓ [${requestId}] Response parsed successfully`, {
          type: Array.isArray(data) ? 'array' : typeof data,
          size: Array.isArray(data) ? data.length : Object.keys(data).length,
        });

        return data as T;
      } catch (err: any) {
        lastError = err;

        // Don't retry on 4xx errors (client errors)
        if (err.status && err.status >= 400 && err.status < 500) {
          error(`✗ [${requestId}] Client error (no retry):`, err);
          throw err;
        }

        // Don't retry on abort (timeout)
        if (err.name === 'AbortError') {
          error(`✗ [${requestId}] Request timeout after ${this.timeout}ms`);
          throw {
            message: 'Request timeout',
            code: 'TIMEOUT',
            status: 0,
          } as ApiError;
        }

        if (attempt === this.retryAttempts) {
          error(`✗ [${requestId}] All retry attempts exhausted`);
          break;
        }
      }
    }

    // All retries failed
    throw lastError || {
      message: 'Request failed after retries',
      code: 'UNKNOWN',
      status: 0,
    };
  }

  /**
   * List all rules
   */
  async listRules(params?: {
    enabledOnly?: boolean;
    severity?: string;
    tags?: string[];
  }): Promise<ListRulesResponse> {
    return this.request<ListRulesResponse>('GET', '/api/rules', { params });
  }

  /**
   * Get a single rule by ID
   */
  async getRule(id: string): Promise<Rule> {
    return this.request<Rule>('GET', `/api/rules/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new rule
   */
  async createRule(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rule> {
    return this.request<Rule>('POST', '/api/rules', { body: rule });
  }

  /**
   * Update an existing rule
   */
  async updateRule(id: string, rule: Partial<Rule>): Promise<Rule> {
    return this.request<Rule>('PUT', `/api/rules/${encodeURIComponent(id)}`, { body: rule });
  }

  /**
   * Delete a rule
   */
  async deleteRule(id: string): Promise<void> {
    await this.request<{ success: boolean }>('DELETE', `/api/rules/${encodeURIComponent(id)}`);
  }

  /**
   * Enable a rule
   */
  async enableRule(id: string): Promise<Rule> {
    return this.request<Rule>('POST', `/api/rules/${encodeURIComponent(id)}/enable`);
  }

  /**
   * Disable a rule
   */
  async disableRule(id: string): Promise<Rule> {
    return this.request<Rule>('POST', `/api/rules/${encodeURIComponent(id)}/disable`);
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string; version: string; uptimeSeconds: number }> {
    return this.request('GET', '/health');
  }
}

// Singleton instance
let clientInstance: BeTraceClient | null = null;

/**
 * Get or create the BeTrace API client
 */
export const getBeTraceClient = (config?: BeTraceClientConfig): BeTraceClient => {
  if (!clientInstance) {
    clientInstance = new BeTraceClient(config);
  }
  return clientInstance;
};

/**
 * Enable debug logging
 * Usage: Call in browser console: window.enableBeTraceDebug()
 */
export const enableDebug = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DEBUG_KEY, 'true');
    console.log('[BeTrace] Debug logging enabled. Refresh to see debug output.');
  }
};

/**
 * Disable debug logging
 */
export const disableDebug = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DEBUG_KEY);
    console.log('[BeTrace] Debug logging disabled.');
  }
};

// Expose to window for easy debugging
if (typeof window !== 'undefined') {
  (window as any).enableBeTraceDebug = enableDebug;
  (window as any).disableBeTraceDebug = disableDebug;
}
