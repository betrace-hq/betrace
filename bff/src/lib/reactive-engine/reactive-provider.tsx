/**
 * Reactive Provider - Main integration component
 *
 * Implements ADR-006 reactive architecture by:
 * - Providing UIProvider context to the entire app
 * - Initializing background workers
 * - Setting up real-time data synchronization
 * - Managing worker lifecycle
 */

import React, { useEffect, ReactNode } from 'react';
import { UIProvider } from './ui-controller';
import { getAuthWorker, destroyAuthWorker } from '../workers/auth-worker';
import { getDataWorker, destroyDataWorker } from '../workers/data-worker';
import { useWebSocket } from '../hooks/use-websocket';

interface ReactiveProviderProps {
  children: ReactNode;
}

/**
 * Worker Initialization Component
 * Sets up background workers and connects them to the UI controller
 */
function WorkerInitializer() {
  useEffect(() => {
    // Initialize workers
    const authWorker = getAuthWorker();
    const dataWorker = getDataWorker();

    // Workers will connect to UI dispatch when hooks are used
    console.info('✅ Background workers initialized');

    // Cleanup on unmount
    return () => {
      destroyAuthWorker();
      destroyDataWorker();
      console.info('🧹 Background workers cleaned up');
    };
  }, []);

  return null;
}

/**
 * WebSocket Integration Component
 * Handles real-time updates from the backend
 */
function WebSocketIntegrator() {
  useWebSocket({
    url: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8080/ws',
    onSignalUpdate: (signalId: string, status: any) => {
      // This will be handled by the WebSocket hook using the UI controller
      console.debug('WebSocket signal update:', { signalId, status });
    },
    onRuleUpdate: (ruleId: string, rule: any) => {
      console.debug('WebSocket rule update:', { ruleId, rule });
    },
    autoConnect: true,
  });

  return null;
}

/**
 * Performance Monitor Component
 * Tracks and logs performance metrics for the reactive architecture
 */
function PerformanceMonitor() {
  useEffect(() => {
    // Monitor React render performance
    if (import.meta.env.DEV) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('react')) {
            console.debug('React performance:', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }
      });

      observer.observe({ entryTypes: ['measure'] });

      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    // Log memory usage periodically in development
    if (import.meta.env.DEV && 'memory' in performance) {
      const logMemoryUsage = () => {
        const memory = (performance as any).memory;
        console.debug('Memory usage:', {
          used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
          total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
          limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`,
        });
      };

      const interval = setInterval(logMemoryUsage, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, []);

  return null;
}

/**
 * Error Boundary for Worker Errors
 * Catches and handles errors from background workers
 */
class WorkerErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Worker error boundary caught an error:', error, errorInfo);

    // In production, you might want to send this to an error reporting service
    if (import.meta.env.PROD) {
      // reportError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Application Error
                </h3>
              </div>
            </div>
            <div className="text-sm text-red-700">
              <p>
                The application encountered an unexpected error. Please refresh
                the page to continue.
              </p>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer font-medium">
                    Error Details
                  </summary>
                  <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Main Reactive Provider Component
 *
 * Wraps the entire application with reactive architecture:
 * - UI state management via React Context + useReducer
 * - Background worker initialization and lifecycle management
 * - Real-time WebSocket integration
 * - Error boundary protection
 * - Performance monitoring (dev mode)
 */
export function ReactiveProvider({ children }: ReactiveProviderProps) {
  return (
    <WorkerErrorBoundary>
      <UIProvider>
        <WorkerInitializer />
        <WebSocketIntegrator />
        {import.meta.env.DEV && <PerformanceMonitor />}
        {children}
      </UIProvider>
    </WorkerErrorBoundary>
  );
}

/**
 * Hook to check if reactive architecture is properly initialized
 */
export function useReactiveStatus() {
  const { state } = useUIController();
  const { workers } = state;

  return {
    // Worker status
    authWorkerActive: workers.authWorker.active,
    dataWorkerActive: workers.dataWorker.active,

    // Overall system status
    isReactiveSystemReady: workers.authWorker.active && workers.dataWorker.active,

    // Error states
    hasWorkerErrors: !!(workers.authWorker.error || workers.dataWorker.error),
    workerErrors: {
      auth: workers.authWorker.error,
      data: workers.dataWorker.error,
    },

    // Last update times
    lastUpdate: {
      auth: workers.authWorker.lastUpdate,
      data: workers.dataWorker.lastUpdate,
    },
  };
}

/**
 * Development helper hook for debugging reactive state
 */
export function useReactiveDebug() {
  const { state } = useUIController();

  useEffect(() => {
    if (import.meta.env.DEV) {
      // Log state changes in development
      console.debug('Reactive state update:', state);
    }
  }, [state]);

  const exportState = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      state,
      environment: {
        mode: import.meta.env.MODE,
        dev: import.meta.env.DEV,
        demoMode: import.meta.env.VITE_DEMO_MODE,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `betrace-reactive-state-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    currentState: state,
    exportState,
    stateSize: JSON.stringify(state).length,
  };
}

// Make sure we import the UI controller
import { useUIController } from './ui-controller';