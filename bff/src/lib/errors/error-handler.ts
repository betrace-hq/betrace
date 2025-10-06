/**
 * Professional Error Handling and Recovery System
 */

import { auditLogger } from '../monitoring/audit-logger';
import { SecurityMonitor } from '../security/auth-guard';

export type ErrorCategory =
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'server'
  | 'client'
  | 'security'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorInfo {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  context: Record<string, any>;
  timestamp: string;
  userId?: string;
  tenantId?: string;
  url: string;
  userAgent: string;
  stack?: string;
  retryable: boolean;
  userMessage: string;
  technicalMessage: string;
  resolution?: string;
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'redirect' | 'logout' | 'refresh' | 'ignore';
  params?: Record<string, any>;
}

export class ErrorHandler {
  private errors: ErrorInfo[] = [];
  private maxErrors = 100;

  /**
   * Handle an error with context
   */
  handleError(
    error: Error,
    context: Record<string, any> = {},
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      retryable?: boolean;
      userMessage?: string;
    } = {}
  ): ErrorInfo {
    const errorInfo = this.createErrorInfo(error, context, options);

    // Store error
    this.errors.push(errorInfo);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to audit system
    auditLogger.logSystem('error', {
      errorId: errorInfo.id,
      category: errorInfo.category,
      message: errorInfo.technicalMessage,
      context: errorInfo.context,
      stack: errorInfo.stack
    }, {
      severity: errorInfo.severity === 'critical' ? 'critical' : 'medium'
    });

    // Log security events
    if (errorInfo.category === 'security') {
      SecurityMonitor.logSecurityEvent('suspicious_activity', {
        errorId: errorInfo.id,
        message: errorInfo.message,
        context: errorInfo.context
      });
    }

    // Console logging for development
    if (import.meta.env.DEV) {
      this.logToConsole(errorInfo);
    }

    // Send to monitoring service in production
    if (import.meta.env.PROD) {
      this.sendToMonitoringService(errorInfo);
    }

    return errorInfo;
  }

  /**
   * Handle API errors specifically
   */
  handleApiError(
    error: Error,
    request: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: any;
    },
    response?: {
      status: number;
      statusText: string;
      headers?: Record<string, string>;
    }
  ): ErrorInfo {
    const category = this.categorizeApiError(response?.status);
    const severity = this.determineApiErrorSeverity(response?.status);

    return this.handleError(error, {
      request: {
        url: request.url,
        method: request.method,
        // Don't log sensitive headers/body
        headers: this.sanitizeHeaders(request.headers),
        body: this.sanitizeRequestBody(request.body)
      },
      response: response ? {
        status: response.status,
        statusText: response.statusText,
        headers: this.sanitizeHeaders(response.headers)
      } : undefined
    }, {
      category,
      severity,
      retryable: this.isRetryableApiError(response?.status),
      userMessage: this.getApiErrorUserMessage(response?.status)
    });
  }

  /**
   * Handle validation errors
   */
  handleValidationError(
    field: string,
    value: any,
    rule: string,
    context: Record<string, any> = {}
  ): ErrorInfo {
    const error = new Error(`Validation failed for field '${field}': ${rule}`);

    return this.handleError(error, {
      field,
      value: typeof value === 'string' ? value.substring(0, 100) : value,
      rule,
      ...context
    }, {
      category: 'validation',
      severity: 'low',
      retryable: false,
      userMessage: `Please check the ${field} field and try again.`
    });
  }

  /**
   * Handle network errors
   */
  handleNetworkError(
    error: Error,
    url: string,
    context: Record<string, any> = {}
  ): ErrorInfo {
    return this.handleError(error, {
      url,
      networkType: navigator.onLine ? 'online' : 'offline',
      connectionType: (navigator as any).connection?.effectiveType,
      ...context
    }, {
      category: 'network',
      severity: 'medium',
      retryable: true,
      userMessage: 'Network connection issue. Please check your internet connection and try again.'
    });
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(
    error: Error,
    context: Record<string, any> = {}
  ): ErrorInfo {
    return this.handleError(error, context, {
      category: 'authentication',
      severity: 'high',
      retryable: false,
      userMessage: 'Authentication failed. Please log in again.'
    });
  }

  /**
   * Handle authorization errors
   */
  handleAuthzError(
    error: Error,
    resource: string,
    action: string,
    context: Record<string, any> = {}
  ): ErrorInfo {
    return this.handleError(error, {
      resource,
      action,
      ...context
    }, {
      category: 'authorization',
      severity: 'medium',
      retryable: false,
      userMessage: 'You do not have permission to perform this action.'
    });
  }

  /**
   * Get recovery action for an error
   */
  getRecoveryAction(errorInfo: ErrorInfo): ErrorRecoveryAction {
    switch (errorInfo.category) {
      case 'authentication':
        return { type: 'logout' };

      case 'authorization':
        return { type: 'redirect', params: { to: '/dashboard' } };

      case 'network':
        if (errorInfo.retryable) {
          return { type: 'retry', params: { delay: 1000, maxAttempts: 3 } };
        }
        return { type: 'refresh' };

      case 'validation':
        return { type: 'ignore' };

      case 'server':
        if (errorInfo.retryable) {
          return { type: 'retry', params: { delay: 2000, maxAttempts: 2 } };
        }
        return { type: 'redirect', params: { to: '/dashboard' } };

      case 'security':
        return { type: 'logout' };

      default:
        return { type: 'refresh' };
    }
  }

  /**
   * Get errors by criteria
   */
  getErrors(criteria: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    userId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  } = {}): ErrorInfo[] {
    let filtered = [...this.errors];

    if (criteria.category) {
      filtered = filtered.filter(e => e.category === criteria.category);
    }

    if (criteria.severity) {
      filtered = filtered.filter(e => e.severity === criteria.severity);
    }

    if (criteria.userId) {
      filtered = filtered.filter(e => e.userId === criteria.userId);
    }

    if (criteria.startTime) {
      filtered = filtered.filter(e => e.timestamp >= criteria.startTime!);
    }

    if (criteria.endTime) {
      filtered = filtered.filter(e => e.timestamp <= criteria.endTime!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (criteria.limit) {
      filtered = filtered.slice(0, criteria.limit);
    }

    return filtered;
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindowHours: number = 24): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    retryableCount: number;
  } {
    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000).toISOString();
    const recentErrors = this.getErrors({ startTime: since });

    const byCategory = {} as Record<ErrorCategory, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;

    recentErrors.forEach(error => {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });

    return {
      total: recentErrors.length,
      byCategory,
      bySeverity,
      retryableCount: recentErrors.filter(e => e.retryable).length
    };
  }

  private createErrorInfo(
    error: Error,
    context: Record<string, any>,
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      retryable?: boolean;
      userMessage?: string;
    }
  ): ErrorInfo {
    const category = options.category || this.categorizeError(error);
    const severity = options.severity || this.determineSeverity(error, category);

    return {
      id: crypto.randomUUID(),
      category,
      severity,
      message: error.message,
      originalError: error,
      context,
      timestamp: new Date().toISOString(),
      userId: this.getCurrentUserId(),
      tenantId: this.getCurrentTenantId(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      stack: error.stack,
      retryable: options.retryable ?? this.isRetryable(error, category),
      userMessage: options.userMessage || this.generateUserMessage(error, category),
      technicalMessage: `${error.name}: ${error.message}`,
      resolution: this.getResolutionSteps(category)
    };
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || name.includes('network')) {
      return 'network';
    }

    if (message.includes('unauthorized') || message.includes('authentication')) {
      return 'authentication';
    }

    if (message.includes('forbidden') || message.includes('permission')) {
      return 'authorization';
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }

    if (message.includes('security') || message.includes('xss') || message.includes('injection')) {
      return 'security';
    }

    if (message.includes('server') || message.includes('500') || message.includes('503')) {
      return 'server';
    }

    return 'unknown';
  }

  private categorizeApiError(status?: number): ErrorCategory {
    if (!status) return 'network';

    if (status === 401) return 'authentication';
    if (status === 403) return 'authorization';
    if (status >= 400 && status < 500) return 'client';
    if (status >= 500) return 'server';

    return 'unknown';
  }

  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    if (category === 'security') return 'critical';
    if (category === 'authentication') return 'high';
    if (category === 'server') return 'high';
    if (category === 'authorization') return 'medium';
    if (category === 'network') return 'medium';
    return 'low';
  }

  private determineApiErrorSeverity(status?: number): ErrorSeverity {
    if (!status) return 'medium';
    if (status >= 500) return 'high';
    if (status === 401 || status === 403) return 'medium';
    return 'low';
  }

  private isRetryable(error: Error, category: ErrorCategory): boolean {
    if (category === 'network') return true;
    if (category === 'server') return true;
    return false;
  }

  private isRetryableApiError(status?: number): boolean {
    if (!status) return true; // Network error
    if (status >= 500) return true; // Server error
    if (status === 429) return true; // Rate limit
    return false;
  }

  private generateUserMessage(error: Error, category: ErrorCategory): string {
    const messages = {
      network: 'Connection issue. Please check your internet and try again.',
      authentication: 'Please log in again to continue.',
      authorization: 'You do not have permission to perform this action.',
      validation: 'Please check your input and try again.',
      server: 'Server error. Please try again later.',
      client: 'Something went wrong. Please try again.',
      security: 'Security issue detected. Please contact support.',
      unknown: 'An unexpected error occurred. Please try again.'
    };

    return messages[category];
  }

  private getApiErrorUserMessage(status?: number): string {
    if (!status) return 'Connection error. Please try again.';

    const messages: Record<number, string> = {
      400: 'Invalid request. Please check your input.',
      401: 'Please log in to continue.',
      403: 'You do not have permission to access this resource.',
      404: 'The requested resource was not found.',
      409: 'There was a conflict with your request.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'Server error. Please try again later.',
      502: 'Service temporarily unavailable.',
      503: 'Service temporarily unavailable.',
      504: 'Request timeout. Please try again.'
    };

    return messages[status] || 'An error occurred. Please try again.';
  }

  private getResolutionSteps(category: ErrorCategory): string {
    const resolutions = {
      network: 'Check internet connection, try refreshing the page',
      authentication: 'Log out and log back in, clear browser cache',
      authorization: 'Contact administrator for access, check user permissions',
      validation: 'Review input format, check required fields',
      server: 'Wait a few minutes and retry, contact support if persistent',
      client: 'Refresh the page, clear browser cache',
      security: 'Contact security team immediately',
      unknown: 'Refresh the page, contact support if persistent'
    };

    return resolutions[category];
  }

  private getCurrentUserId(): string | undefined {
    try {
      const authData = JSON.parse(localStorage.getItem('fluo-auth-storage') || '{}');
      return authData.state?.user?.id;
    } catch {
      return undefined;
    }
  }

  private getCurrentTenantId(): string | undefined {
    try {
      const authData = JSON.parse(localStorage.getItem('fluo-auth-storage') || '{}');
      return authData.state?.tenant?.id;
    } catch {
      return undefined;
    }
  }

  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> {
    if (!headers) return {};

    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-csrf-token'];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return body;

    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        return this.sanitizeObject(parsed);
      } catch {
        return '[REDACTED]';
      }
    }

    return this.sanitizeObject(body);
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    const sanitized = { ...obj };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private logToConsole(errorInfo: ErrorInfo): void {
    const level = errorInfo.severity === 'high' || errorInfo.severity === 'critical' ? 'error' : 'warn';
    console[level](`[ERROR] ${errorInfo.category}:`, {
      id: errorInfo.id,
      message: errorInfo.technicalMessage,
      context: errorInfo.context,
      stack: errorInfo.stack
    });
  }

  private async sendToMonitoringService(errorInfo: ErrorInfo): Promise<void> {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: errorInfo.id,
          category: errorInfo.category,
          severity: errorInfo.severity,
          message: errorInfo.technicalMessage,
          context: errorInfo.context,
          userId: errorInfo.userId,
          tenantId: errorInfo.tenantId,
          url: errorInfo.url,
          timestamp: errorInfo.timestamp
        })
      });
    } catch (error) {
      console.error('Failed to send error to monitoring service:', error);
    }
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Global error handlers
window.addEventListener('error', (event) => {
  errorHandler.handleError(event.error || new Error(event.message), {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  errorHandler.handleError(error, {
    type: 'unhandled_promise_rejection'
  });
});