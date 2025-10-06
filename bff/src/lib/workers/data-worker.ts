/**
 * Data Worker - Background data fetching and caching
 *
 * Implements ADR-006 background worker architecture:
 * - Off-main-thread data operations
 * - API calls and data processing
 * - Caching and synchronization
 * - Real-time data updates
 */

import { UIAction } from '../reactive-engine/ui-controller';
import { Signal, Rule, SignalStatus } from '../types/fluo-api';

// =============================================================================
// Message Types
// =============================================================================

export interface DataWorkerMessage {
  id: string;
  type:
    | 'INIT'
    | 'FETCH_SIGNALS'
    | 'FETCH_RULES'
    | 'FETCH_ANALYTICS'
    | 'UPDATE_SIGNAL'
    | 'CREATE_RULE'
    | 'UPDATE_RULE'
    | 'DELETE_RULE'
    | 'SYNC_CACHE';
  payload?: any;
}

export interface DataWorkerResponse {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS' | 'CACHE_UPDATE';
  payload?: any;
  error?: string;
}

// =============================================================================
// Data Worker Implementation
// =============================================================================

export class DataWorker {
  private worker: Worker | null = null;
  private messageHandlers = new Map<string, (response: DataWorkerResponse) => void>();
  private dispatchUI: ((action: UIAction) => void) | null = null;
  private cacheUpdateInterval: number | null = null;

  constructor() {
    this.initializeWorker();
    this.startCacheSync();
  }

  /**
   * Initialize the Web Worker for data operations.
   */
  private initializeWorker() {
    if (typeof Worker !== 'undefined') {
      // In a real implementation, this would load a separate worker file
      this.worker = new Worker(
        new URL('./data-worker-impl.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<DataWorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Data worker error:', error);
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
  private handleWorkerMessage(response: DataWorkerResponse) {
    const handler = this.messageHandlers.get(response.id);
    if (handler) {
      handler(response);
      if (response.type !== 'PROGRESS') {
        this.messageHandlers.delete(response.id);
      }
    }

    // Handle UI updates
    if (this.dispatchUI) {
      switch (response.type) {
        case 'SUCCESS':
          this.handleSuccessResponse(response);
          break;

        case 'ERROR':
          this.handleErrorResponse(response);
          break;

        case 'CACHE_UPDATE':
          this.handleCacheUpdate(response);
          break;
      }
    }

    this.updateWorkerStatus(true);
  }

  /**
   * Handle successful responses and update UI state.
   */
  private handleSuccessResponse(response: DataWorkerResponse) {
    if (!this.dispatchUI) return;

    const { payload } = response;

    if (payload?.signals) {
      this.dispatchUI({
        type: 'SET_SIGNALS_DATA',
        payload: {
          signals: payload.signals,
          totalCount: payload.totalCount || payload.signals.length,
        },
      });
    }

    if (payload?.rules) {
      this.dispatchUI({
        type: 'SET_RULES_DATA',
        payload: payload.rules,
      });
    }

    if (payload?.signalCounts) {
      this.dispatchUI({
        type: 'SET_SIGNAL_COUNTS',
        payload: payload.signalCounts,
      });
    }

    if (payload?.updatedSignal) {
      this.dispatchUI({
        type: 'UPDATE_SIGNAL',
        payload: {
          signalId: payload.updatedSignal.id,
          status: payload.updatedSignal.status,
        },
      });
    }

    if (payload?.newRule) {
      this.dispatchUI({
        type: 'ADD_RULE',
        payload: payload.newRule,
      });
    }

    if (payload?.updatedRule) {
      this.dispatchUI({
        type: 'UPDATE_RULE',
        payload: payload.updatedRule,
      });
    }

    if (payload?.deletedRuleId) {
      this.dispatchUI({
        type: 'DELETE_RULE',
        payload: payload.deletedRuleId,
      });
    }
  }

  /**
   * Handle error responses and update UI state.
   */
  private handleErrorResponse(response: DataWorkerResponse) {
    if (!this.dispatchUI) return;

    // Determine which error to set based on the original request
    // This is a simplified approach - in practice, you'd track request types
    this.dispatchUI({
      type: 'SET_SIGNALS_ERROR',
      payload: response.error || 'Data operation failed',
    });
  }

  /**
   * Handle cache updates from background sync.
   */
  private handleCacheUpdate(response: DataWorkerResponse) {
    if (!this.dispatchUI || !response.payload) return;

    // Update UI with fresh data from cache
    if (response.payload.type === 'signals') {
      this.dispatchUI({
        type: 'SET_SIGNALS_DATA',
        payload: response.payload.data,
      });
    } else if (response.payload.type === 'rules') {
      this.dispatchUI({
        type: 'SET_RULES_DATA',
        payload: response.payload.data,
      });
    }
  }

  /**
   * Send message to worker with promise-based response.
   */
  private sendMessage(message: DataWorkerMessage): Promise<DataWorkerResponse> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        return this.fallbackToMainThread(message).then(resolve).catch(reject);
      }

      this.messageHandlers.set(message.id, resolve);
      this.worker.postMessage(message);

      // Timeout after 60 seconds for data operations
      setTimeout(() => {
        if (this.messageHandlers.has(message.id)) {
          this.messageHandlers.delete(message.id);
          reject(new Error('Data worker timeout'));
        }
      }, 60000);
    });
  }

  /**
   * Fallback to main thread when workers are not available.
   */
  private async fallbackToMainThread(message: DataWorkerMessage): Promise<DataWorkerResponse> {
    // Import data operations dynamically
    const { processDataOperation } = await import('./data-operations');

    try {
      const result = await processDataOperation(message.type, message.payload);
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
   * Start background cache synchronization.
   */
  private startCacheSync() {
    // Sync cache every 30 seconds
    this.cacheUpdateInterval = window.setInterval(() => {
      this.syncCache().catch(console.error);
    }, 30000);
  }

  /**
   * Update worker status in UI.
   */
  private updateWorkerStatus(active: boolean, error?: string) {
    if (this.dispatchUI) {
      this.dispatchUI({
        type: 'SET_WORKER_STATUS',
        payload: {
          worker: 'dataWorker',
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
   * Initialize data worker and cache.
   */
  async initialize(): Promise<void> {
    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'INIT',
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Data worker initialization failed:', error);
    }
  }

  /**
   * Fetch signals with optional filters.
   */
  async fetchSignals(filters?: any): Promise<void> {
    if (this.dispatchUI) {
      this.dispatchUI({ type: 'SET_SIGNALS_LOADING', payload: true });
    }

    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'FETCH_SIGNALS',
      payload: { filters },
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to fetch signals:', error);
      if (this.dispatchUI) {
        this.dispatchUI({
          type: 'SET_SIGNALS_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to fetch signals',
        });
      }
    }
  }

  /**
   * Fetch rules.
   */
  async fetchRules(): Promise<void> {
    if (this.dispatchUI) {
      this.dispatchUI({ type: 'SET_RULES_LOADING', payload: true });
    }

    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'FETCH_RULES',
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
      if (this.dispatchUI) {
        this.dispatchUI({
          type: 'SET_RULES_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to fetch rules',
        });
      }
    }
  }

  /**
   * Fetch analytics data.
   */
  async fetchAnalytics(): Promise<void> {
    if (this.dispatchUI) {
      this.dispatchUI({ type: 'SET_ANALYTICS_LOADING', payload: true });
    }

    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'FETCH_ANALYTICS',
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      if (this.dispatchUI) {
        this.dispatchUI({
          type: 'SET_ANALYTICS_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to fetch analytics',
        });
      }
    }
  }

  /**
   * Update signal status.
   */
  async updateSignal(signalId: string, status: SignalStatus): Promise<void> {
    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'UPDATE_SIGNAL',
      payload: { signalId, status },
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to update signal:', error);
      throw error;
    }
  }

  /**
   * Create new rule.
   */
  async createRule(rule: Omit<Rule, 'id'>): Promise<void> {
    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'CREATE_RULE',
      payload: { rule },
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to create rule:', error);
      throw error;
    }
  }

  /**
   * Update existing rule.
   */
  async updateRule(rule: Rule): Promise<void> {
    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'UPDATE_RULE',
      payload: { rule },
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to update rule:', error);
      throw error;
    }
  }

  /**
   * Delete rule.
   */
  async deleteRule(ruleId: string): Promise<void> {
    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'DELETE_RULE',
      payload: { ruleId },
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to delete rule:', error);
      throw error;
    }
  }

  /**
   * Manually sync cache.
   */
  async syncCache(): Promise<void> {
    const message: DataWorkerMessage = {
      id: crypto.randomUUID(),
      type: 'SYNC_CACHE',
    };

    try {
      await this.sendMessage(message);
    } catch (error) {
      console.error('Cache sync failed:', error);
    }
  }

  /**
   * Cleanup worker resources.
   */
  destroy() {
    if (this.cacheUpdateInterval) {
      clearInterval(this.cacheUpdateInterval);
      this.cacheUpdateInterval = null;
    }

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

let dataWorkerInstance: DataWorker | null = null;

export const getDataWorker = (): DataWorker => {
  if (!dataWorkerInstance) {
    dataWorkerInstance = new DataWorker();
  }
  return dataWorkerInstance;
};

export const destroyDataWorker = () => {
  if (dataWorkerInstance) {
    dataWorkerInstance.destroy();
    dataWorkerInstance = null;
  }
};