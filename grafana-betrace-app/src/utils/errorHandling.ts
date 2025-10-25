/**
 * Standardized error handling utilities for BeTrace Grafana plugin
 *
 * Provides consistent error messages, retry logic, and graceful degradation
 * for network failures and partial outages.
 */

export interface ErrorResponse {
  message: string;
  type: 'network' | 'timeout' | 'server' | 'unknown';
  retryable: boolean;
  statusCode?: number;
}

/**
 * Parse error from fetch or other async operations
 */
export function parseError(error: unknown): ErrorResponse {
  // Network/connection errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: 'Unable to connect to BeTrace backend. Check that the backend service is running.',
      type: 'network',
      retryable: true,
    };
  }

  // Timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return {
      message: 'Request timed out. The backend may be experiencing high load.',
      type: 'timeout',
      retryable: true,
    };
  }

  // HTTP errors with status codes
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as any).status;

    if (status === 503) {
      return {
        message: 'Backend service temporarily unavailable. Data will refresh automatically.',
        type: 'server',
        retryable: true,
        statusCode: 503,
      };
    }

    if (status === 429) {
      return {
        message: 'Too many requests. Please wait a moment before refreshing.',
        type: 'server',
        retryable: true,
        statusCode: 429,
      };
    }

    if (status >= 500) {
      return {
        message: 'Backend error occurred. Showing cached data if available.',
        type: 'server',
        retryable: true,
        statusCode: status,
      };
    }

    if (status === 404) {
      return {
        message: 'Resource not found. This may be expected for new installations.',
        type: 'server',
        retryable: false,
        statusCode: 404,
      };
    }
  }

  // Generic error
  return {
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    type: 'unknown',
    retryable: false,
  };
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorResponse = parseError(error);

      // Don't retry if error is not retryable
      if (!errorResponse.retryable || attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * User-friendly error messages for common scenarios
 */
export const ErrorMessages = {
  BACKEND_UNREACHABLE: 'Cannot connect to BeTrace backend. Please check that the backend service is running.',
  BACKEND_SLOW: 'Backend is responding slowly. This may indicate high resource usage.',
  BACKEND_ERROR: 'Backend encountered an error. Please try again in a few moments.',
  NO_DATA: 'No data available yet. This is normal for new installations.',
  PARTIAL_DATA: 'Showing partial data due to a temporary issue. Full data will load shortly.',
  RATE_LIMITED: 'Too many requests. Please wait before refreshing.',
  TIMEOUT: 'Request timed out. The system may be under heavy load.',
} as const;

/**
 * Check if error should trigger fallback to cached/stale data
 */
export function shouldUseFallbackData(error: ErrorResponse): boolean {
  return error.retryable && error.type !== 'network';
}

/**
 * Format error for user display
 */
export function formatErrorMessage(error: ErrorResponse, context?: string): string {
  const prefix = context ? `${context}: ` : '';
  return `${prefix}${error.message}`;
}
