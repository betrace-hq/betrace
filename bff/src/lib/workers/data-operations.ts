/**
 * Data Operations - Main thread fallback implementations
 *
 * These operations run when Web Workers are not available,
 * providing the same functionality as the worker implementations.
 */

import { demoApi } from '../api/demo-api';
import { api } from '../api';
import { Signal, Rule, SignalStatus } from '../types/fluo-api';

/**
 * Process data operations on main thread.
 */
export async function processDataOperation(type: string, payload?: any): Promise<any> {
  switch (type) {
    case 'INIT':
      return initializeData();

    case 'FETCH_SIGNALS':
      return fetchSignals(payload?.filters);

    case 'FETCH_RULES':
      return fetchRules();

    case 'FETCH_ANALYTICS':
      return fetchAnalytics();

    case 'UPDATE_SIGNAL':
      return updateSignal(payload?.signalId, payload?.status);

    case 'CREATE_RULE':
      return createRule(payload?.rule);

    case 'UPDATE_RULE':
      return updateRule(payload?.rule);

    case 'DELETE_RULE':
      return deleteRule(payload?.ruleId);

    case 'SYNC_CACHE':
      return syncCache();

    default:
      throw new Error(`Unknown data operation: ${type}`);
  }
}

/**
 * Initialize data layer and cache.
 */
async function initializeData(): Promise<any> {
  try {
    // Initialize API connections
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      demoApi.initialize();
    }

    // Pre-load essential data
    const [signals, rules, analytics] = await Promise.allSettled([
      fetchSignals(),
      fetchRules(),
      fetchAnalytics(),
    ]);

    return {
      initialized: true,
      preloadedData: {
        signals: signals.status === 'fulfilled' ? signals.value : null,
        rules: rules.status === 'fulfilled' ? rules.value : null,
        analytics: analytics.status === 'fulfilled' ? analytics.value : null,
      },
    };
  } catch (error) {
    console.error('Data initialization error:', error);
    throw error;
  }
}

/**
 * Fetch signals with optional filters.
 */
async function fetchSignals(filters?: any): Promise<any> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      const result = await demoApi.getSignals(filters);
      return {
        signals: result.data,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
      };
    }

    // Use real API
    const result = await api.signals.list(filters);
    return {
      signals: result.data,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
    };
  } catch (error) {
    console.error('Fetch signals error:', error);
    throw error;
  }
}

/**
 * Fetch rules.
 */
async function fetchRules(): Promise<any> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      const rules = await demoApi.getRules();
      return { rules };
    }

    // Use real API
    const rules = await api.rules.list();
    return { rules };
  } catch (error) {
    console.error('Fetch rules error:', error);
    throw error;
  }
}

/**
 * Fetch analytics data.
 */
async function fetchAnalytics(): Promise<any> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      const analytics = await demoApi.getAnalytics();
      return { signalCounts: analytics.signalCounts };
    }

    // Use real API
    const analytics = await api.analytics.getSignalCounts();
    return { signalCounts: analytics };
  } catch (error) {
    console.error('Fetch analytics error:', error);
    throw error;
  }
}

/**
 * Update signal status.
 */
async function updateSignal(signalId: string, status: SignalStatus): Promise<any> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      const updatedSignal = await demoApi.updateSignal(signalId, { status });
      return { updatedSignal };
    }

    // Use real API
    const updatedSignal = await api.signals.update(signalId, { status });
    return { updatedSignal };
  } catch (error) {
    console.error('Update signal error:', error);
    throw error;
  }
}

/**
 * Create new rule.
 */
async function createRule(rule: Omit<Rule, 'id'>): Promise<any> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      const newRule = await demoApi.createRule(rule);
      return { newRule };
    }

    // Use real API
    const newRule = await api.rules.create(rule);
    return { newRule };
  } catch (error) {
    console.error('Create rule error:', error);
    throw error;
  }
}

/**
 * Update existing rule.
 */
async function updateRule(rule: Rule): Promise<any> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      const updatedRule = await demoApi.updateRule(rule.id, rule);
      return { updatedRule };
    }

    // Use real API
    const updatedRule = await api.rules.update(rule.id, rule);
    return { updatedRule };
  } catch (error) {
    console.error('Update rule error:', error);
    throw error;
  }
}

/**
 * Delete rule.
 */
async function deleteRule(ruleId: string): Promise<any> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      await demoApi.deleteRule(ruleId);
      return { deletedRuleId: ruleId };
    }

    // Use real API
    await api.rules.delete(ruleId);
    return { deletedRuleId: ruleId };
  } catch (error) {
    console.error('Delete rule error:', error);
    throw error;
  }
}

/**
 * Sync cache with latest data.
 */
async function syncCache(): Promise<any> {
  try {
    // Fetch latest data and update cache
    const [signalsResult, rulesResult] = await Promise.allSettled([
      fetchSignals(),
      fetchRules(),
    ]);

    const updates = [];

    if (signalsResult.status === 'fulfilled') {
      updates.push({
        type: 'signals',
        data: signalsResult.value,
      });
    }

    if (rulesResult.status === 'fulfilled') {
      updates.push({
        type: 'rules',
        data: rulesResult.value.rules,
      });
    }

    return { updates };
  } catch (error) {
    console.error('Cache sync error:', error);
    throw error;
  }
}

// =============================================================================
// Cache Management
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttl: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

// Export singleton cache instance
export const dataCache = new DataCache();