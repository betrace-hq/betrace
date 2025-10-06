/**
 * Authentication Worker - Background authentication processing
 *
 * Implements ADR-006 background worker architecture:
 * - Off-main-thread authentication operations
 * - Token refresh and validation
 * - Session management
 * - Signal-based UI updates
 */

import { UIAction } from '../reactive-engine/ui-controller';

// =============================================================================
// Message Types
// =============================================================================

export interface AuthWorkerMessage {
  id: string;
  type: 'INIT' | 'LOGIN' | 'LOGOUT' | 'REFRESH_TOKEN' | 'VALIDATE_SESSION';
  payload?: any;
}

export interface AuthWorkerResponse {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'STATUS_UPDATE';
  payload?: any;
  error?: string;
}

// =============================================================================
// Auth Worker Implementation
// =============================================================================

export class AuthWorker {
  private worker: Worker | null = null;
  private messageHandlers = new Map<string, (response: AuthWorkerResponse) => void>();
  private dispatchUI: ((action: UIAction) => void) | null = null;

  constructor() {
    this.initializeWorker();
  }

  /**
   * Initialize the Web Worker for authentication operations.
   */
  private initializeWorker() {
    if (typeof Worker !== 'undefined') {
      // In a real implementation, this would load a separate worker file
      // For now, we'll simulate the worker behavior
      this.worker = new Worker(
        new URL('./auth-worker-impl.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<AuthWorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Auth worker error:', error);
        this.updateWorkerStatus(false, error.message);
      };

      this.updateWorkerStatus(true);
    } else {
      console.warn('Web Workers not supported, falling back to main thread');
    }
  }

  /**
   * Set the UI dispatch function for sending actions to the UI controller.
   */
  setUIDispatch(dispatch: (action: UIAction) => void) {
    this.dispatchUI = dispatch;
  }

  /**
   * Handle messages from the worker.
   */
  private handleWorkerMessage(response: AuthWorkerResponse) {
    const handler = this.messageHandlers.get(response.id);
    if (handler) {
      handler(response);
      this.messageHandlers.delete(response.id);
    }

    // Handle UI updates
    if (this.dispatchUI) {
      switch (response.type) {
        case 'SUCCESS':
          if (response.payload?.user) {
            this.dispatchUI({
              type: 'SET_AUTH_USER',
              payload: response.payload.user,
            });
          }
          break;

        case 'ERROR':
          this.dispatchUI({
            type: 'SET_AUTH_ERROR',
            payload: response.error || 'Authentication error',
          });
          break;
      }
    }

    this.updateWorkerStatus(true);
  }

  /**
   * Send message to worker with promise-based response.
   */
  private sendMessage(message: AuthWorkerMessage): Promise<AuthWorkerResponse> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        return this.fallbackToMainThread(message).then(resolve).catch(reject);
      }

      this.messageHandlers.set(message.id, resolve);
      this.worker.postMessage(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(message.id)) {
          this.messageHandlers.delete(message.id);
          reject(new Error('Auth worker timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Fallback to main thread when workers are not available.
   */
  private async fallbackToMainThread(message: AuthWorkerMessage): Promise<AuthWorkerResponse> {
    // Import auth operations dynamically to avoid blocking main thread
    const { processAuthOperation } = await import('./auth-operations');

    try {
      const result = await processAuthOperation(message.type, message.payload);
      return {
        id: message.id,
        type: 'SUCCESS',
        payload: result,
      };
    } catch (error) {
      return {
        id: message.id,
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update worker status in UI.
   */
  private updateWorkerStatus(active: boolean, error?: string) {
    if (this.dispatchUI) {
      this.dispatchUI({
        type: 'SET_WORKER_STATUS',
        payload: {
          worker: 'authWorker',
          status: {
            active,
            lastUpdate: new Date(),
            error: error || null,
          },
        },
      });
    }
  }

  // =============================================================================
  // Public API
  // =============================================================================

  /**
   * Initialize authentication system.
   */
  async initialize(): Promise<void> {
    if (this.dispatchUI) {
      this.dispatchUI({ type: 'SET_AUTH_LOADING', payload: true });
    }

    const message: AuthWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'INIT',
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Auth initialization failed:', error);
      if (this.dispatchUI) {
        this.dispatchUI({
          type: 'SET_AUTH_ERROR',
          payload: error instanceof Error ? error.message : 'Initialization failed',
        });
      }
    }
  }

  /**
   * Perform user login.
   */
  async login(credentials: { email: string; password: string }): Promise<void> {
    if (this.dispatchUI) {
      this.dispatchUI({ type: 'SET_AUTH_LOADING', payload: true });
    }

    const message: AuthWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'LOGIN',
      payload: credentials,
    };

    try {
      const response = await this.sendMessage(message);
      if (response.type === 'ERROR') {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Login failed:', error);
      if (this.dispatchUI) {
        this.dispatchUI({
          type: 'SET_AUTH_ERROR',
          payload: error instanceof Error ? error.message : 'Login failed',
        });
      }
      throw error;
    }
  }

  /**
   * Perform user logout.
   */
  async logout(): Promise<void> {
    const message: AuthWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'LOGOUT',
    };

    try {
      await this.sendMessage(message);
      if (this.dispatchUI) {
        this.dispatchUI({ type: 'LOGOUT' });
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Don't throw error for logout failures
    }
  }

  /**
   * Refresh authentication token.
   */
  async refreshToken(): Promise<void> {
    const message: AuthWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'REFRESH_TOKEN',
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Logout user on token refresh failure
      if (this.dispatchUI) {
        this.dispatchUI({ type: 'LOGOUT' });
      }
    }
  }

  /**
   * Validate current session.
   */
  async validateSession(): Promise<boolean> {
    const message: AuthWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'VALIDATE_SESSION',
    };

    try {
      const response = await this.sendMessage(message);
      return response.type === 'SUCCESS';
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }

  /**
   * Cleanup worker resources.
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.messageHandlers.clear();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let authWorkerInstance: AuthWorker | null = null;

export const getAuthWorker = (): AuthWorker => {
  if (!authWorkerInstance) {
    authWorkerInstance = new AuthWorker();
  }
  return authWorkerInstance;
};

export const destroyAuthWorker = () => {
  if (authWorkerInstance) {
    authWorkerInstance.destroy();
    authWorkerInstance = null;
  }
};