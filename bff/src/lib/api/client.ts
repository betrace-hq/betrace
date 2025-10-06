import type { paths } from '@/lib/types/fluo-api';
import { SecureHeaders, CSRFProtection } from '../security/csrf';
import { AuthGuard, SecurityMonitor } from '../security/auth-guard';

export type FluoApiPaths = paths;

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  enabled: boolean;
}

// Base API configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_FLUO_API_URL || 'http://localhost:8080',
  timeout: 30000,
} as const;

// Response wrapper type
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

// Error response type
export interface ApiError {
  message: string;
  status: number;
  statusText: string;
  details?: any;
}

// Custom error class
export class FluoApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FluoApiError';
  }
}

// HTTP client with security and rate limiting
class HttpClient {
  private baseUrl: string;
  private timeout: number;
  private rateLimitConfig: RateLimitConfig;

  constructor(baseUrl: string, timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
    this.rateLimitConfig = {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      enabled: true
    };
  }

  private checkRateLimit(operation: string): boolean {
    if (!this.rateLimitConfig.enabled) return true;

    return AuthGuard.checkRateLimit(
      operation,
      this.rateLimitConfig.maxRequests,
      this.rateLimitConfig.windowMs
    );
  }

  private sanitizeHeaders(headers: Record<string, string> = {}): Record<string, string> {
    // Apply security headers and CSRF protection
    const secureHeaders = SecureHeaders.applyToFetch(headers);

    // Remove any potentially dangerous headers
    const sanitized = { ...secureHeaders };
    delete sanitized['X-Forwarded-For'];
    delete sanitized['X-Real-IP'];

    return sanitized;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const operation = `${options.method || 'GET'}_${path.split('/')[1] || 'api'}`;

    // Check rate limiting
    if (!this.checkRateLimit(operation)) {
      SecurityMonitor.logSecurityEvent('rate_limit', {
        operation,
        path,
        timestamp: new Date().toISOString()
      });
      throw new FluoApiError(429, 'Too Many Requests', 'Rate limit exceeded');
    }

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Sanitize and secure headers
    const secureHeaders = this.sanitizeHeaders(options.headers as Record<string, string>);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...secureHeaders,
        },
      });

      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch {
          errorDetails = { message: response.statusText };
        }

        throw new FluoApiError(
          response.status,
          response.statusText,
          errorDetails.message || `HTTP ${response.status}: ${response.statusText}`,
          errorDetails
        );
      }

      // Parse response
      let data: T;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FluoApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new FluoApiError(408, 'Request Timeout', 'Request timed out');
      }

      throw new FluoApiError(
        0,
        'Network Error',
        error instanceof Error ? error.message : 'Unknown network error'
      );
    }
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET', headers });
  }

  async post<T>(
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  async put<T>(
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  async patch<T>(
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  async delete<T>(path: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE', headers });
  }
}

// Export configured client instance
export const httpClient = new HttpClient(API_CONFIG.baseUrl, API_CONFIG.timeout);