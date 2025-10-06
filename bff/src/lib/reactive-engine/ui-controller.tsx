/**
 * FLUO UI Controller - React Context + useReducer reactive state management
 *
 * Implements ADR-006 reactive architecture with:
 * - Non-blocking main thread UI operations
 * - Background worker delegation for heavy tasks
 * - Signal-based communication for instant updates
 * - Stable references following React best practices
 */

import { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import { Signal, SignalStatus } from '../types/fluo-api';
import { Rule } from '../types/fluo-api';
import { AuthState } from '../types/auth';

// =============================================================================
// State Types
// =============================================================================

export interface UIState {
  // Authentication state
  auth: AuthState;

  // Signal management
  signals: {
    data: Signal[];
    loading: boolean;
    error: string | null;
    filters: SignalFilters;
    totalCount: number;
  };

  // Rule management
  rules: {
    data: Rule[];
    loading: boolean;
    error: string | null;
    activeRule: Rule | null;
  };

  // Analytics and metrics
  analytics: {
    signalCounts: Record<SignalStatus, number>;
    loading: boolean;
    error: string | null;
  };

  // UI state
  ui: {
    sidebarOpen: boolean;
    theme: 'light' | 'dark' | 'system';
    notifications: Notification[];
  };

  // Background worker status
  workers: {
    authWorker: WorkerStatus;
    dataWorker: WorkerStatus;
  };
}

export interface SignalFilters {
  status?: SignalStatus;
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  page: number;
  pageSize: number;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface WorkerStatus {
  active: boolean;
  lastUpdate: Date | null;
  error: string | null;
}

// =============================================================================
// Action Types
// =============================================================================

export type UIAction =
  // Authentication actions
  | { type: 'SET_AUTH_LOADING'; payload: boolean }
  | { type: 'SET_AUTH_USER'; payload: AuthState['user'] }
  | { type: 'SET_AUTH_ERROR'; payload: string | null }
  | { type: 'LOGOUT' }

  // Signal actions
  | { type: 'SET_SIGNALS_LOADING'; payload: boolean }
  | { type: 'SET_SIGNALS_DATA'; payload: { signals: Signal[]; totalCount: number } }
  | { type: 'SET_SIGNALS_ERROR'; payload: string | null }
  | { type: 'UPDATE_SIGNAL'; payload: { signalId: string; status: SignalStatus } }
  | { type: 'SET_SIGNAL_FILTERS'; payload: Partial<SignalFilters> }
  | { type: 'RESET_SIGNAL_FILTERS' }

  // Rule actions
  | { type: 'SET_RULES_LOADING'; payload: boolean }
  | { type: 'SET_RULES_DATA'; payload: Rule[] }
  | { type: 'SET_RULES_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_RULE'; payload: Rule | null }
  | { type: 'ADD_RULE'; payload: Rule }
  | { type: 'UPDATE_RULE'; payload: Rule }
  | { type: 'DELETE_RULE'; payload: string }

  // Analytics actions
  | { type: 'SET_ANALYTICS_LOADING'; payload: boolean }
  | { type: 'SET_SIGNAL_COUNTS'; payload: Record<SignalStatus, number> }
  | { type: 'SET_ANALYTICS_ERROR'; payload: string | null }

  // UI actions
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' }
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id' | 'timestamp' | 'read'> }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }

  // Worker actions
  | { type: 'SET_WORKER_STATUS'; payload: { worker: 'authWorker' | 'dataWorker'; status: WorkerStatus } };

// =============================================================================
// Initial State
// =============================================================================

const createInitialState = (): UIState => ({
  auth: {
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
  },

  signals: {
    data: [],
    loading: false,
    error: null,
    filters: {
      page: 1,
      pageSize: 20,
    },
    totalCount: 0,
  },

  rules: {
    data: [],
    loading: false,
    error: null,
    activeRule: null,
  },

  analytics: {
    signalCounts: {
      OPEN: 0,
      INVESTIGATING: 0,
      RESOLVED: 0,
      FALSE_POSITIVE: 0,
    },
    loading: false,
    error: null,
  },

  ui: {
    sidebarOpen: true,
    theme: 'system',
    notifications: [],
  },

  workers: {
    authWorker: {
      active: false,
      lastUpdate: null,
      error: null,
    },
    dataWorker: {
      active: false,
      lastUpdate: null,
      error: null,
    },
  },
});

// =============================================================================
// Reducer
// =============================================================================

const uiReducer = (state: UIState, action: UIAction): UIState => {
  switch (action.type) {
    // Authentication actions
    case 'SET_AUTH_LOADING':
      return {
        ...state,
        auth: { ...state.auth, loading: action.payload },
      };

    case 'SET_AUTH_USER':
      return {
        ...state,
        auth: {
          ...state.auth,
          user: action.payload,
          isAuthenticated: action.payload !== null,
          loading: false,
          error: null,
        },
      };

    case 'SET_AUTH_ERROR':
      return {
        ...state,
        auth: { ...state.auth, error: action.payload, loading: false },
      };

    case 'LOGOUT':
      return {
        ...state,
        auth: {
          user: null,
          loading: false,
          error: null,
          isAuthenticated: false,
        },
      };

    // Signal actions
    case 'SET_SIGNALS_LOADING':
      return {
        ...state,
        signals: { ...state.signals, loading: action.payload },
      };

    case 'SET_SIGNALS_DATA':
      return {
        ...state,
        signals: {
          ...state.signals,
          data: action.payload.signals,
          totalCount: action.payload.totalCount,
          loading: false,
          error: null,
        },
      };

    case 'SET_SIGNALS_ERROR':
      return {
        ...state,
        signals: { ...state.signals, error: action.payload, loading: false },
      };

    case 'UPDATE_SIGNAL':
      return {
        ...state,
        signals: {
          ...state.signals,
          data: state.signals.data.map(signal =>
            signal.id === action.payload.signalId
              ? { ...signal, status: action.payload.status }
              : signal
          ),
        },
      };

    case 'SET_SIGNAL_FILTERS':
      return {
        ...state,
        signals: {
          ...state.signals,
          filters: { ...state.signals.filters, ...action.payload },
        },
      };

    case 'RESET_SIGNAL_FILTERS':
      return {
        ...state,
        signals: {
          ...state.signals,
          filters: {
            page: 1,
            pageSize: 20,
          },
        },
      };

    // Rule actions
    case 'SET_RULES_LOADING':
      return {
        ...state,
        rules: { ...state.rules, loading: action.payload },
      };

    case 'SET_RULES_DATA':
      return {
        ...state,
        rules: {
          ...state.rules,
          data: action.payload,
          loading: false,
          error: null,
        },
      };

    case 'SET_RULES_ERROR':
      return {
        ...state,
        rules: { ...state.rules, error: action.payload, loading: false },
      };

    case 'SET_ACTIVE_RULE':
      return {
        ...state,
        rules: { ...state.rules, activeRule: action.payload },
      };

    case 'ADD_RULE':
      return {
        ...state,
        rules: {
          ...state.rules,
          data: [...state.rules.data, action.payload],
        },
      };

    case 'UPDATE_RULE':
      return {
        ...state,
        rules: {
          ...state.rules,
          data: state.rules.data.map(rule =>
            rule.id === action.payload.id ? action.payload : rule
          ),
          activeRule: state.rules.activeRule?.id === action.payload.id
            ? action.payload
            : state.rules.activeRule,
        },
      };

    case 'DELETE_RULE':
      return {
        ...state,
        rules: {
          ...state.rules,
          data: state.rules.data.filter(rule => rule.id !== action.payload),
          activeRule: state.rules.activeRule?.id === action.payload
            ? null
            : state.rules.activeRule,
        },
      };

    // Analytics actions
    case 'SET_ANALYTICS_LOADING':
      return {
        ...state,
        analytics: { ...state.analytics, loading: action.payload },
      };

    case 'SET_SIGNAL_COUNTS':
      return {
        ...state,
        analytics: {
          ...state.analytics,
          signalCounts: action.payload,
          loading: false,
          error: null,
        },
      };

    case 'SET_ANALYTICS_ERROR':
      return {
        ...state,
        analytics: { ...state.analytics, error: action.payload, loading: false },
      };

    // UI actions
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
      };

    case 'SET_THEME':
      return {
        ...state,
        ui: { ...state.ui, theme: action.payload },
      };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [
            ...state.ui.notifications,
            {
              ...action.payload,
              id: crypto.randomUUID(),
              timestamp: new Date(),
              read: false,
            },
          ],
        },
      };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.map(notification =>
            notification.id === action.payload
              ? { ...notification, read: true }
              : notification
          ),
        },
      };

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter(
            notification => notification.id !== action.payload
          ),
        },
      };

    case 'CLEAR_NOTIFICATIONS':
      return {
        ...state,
        ui: { ...state.ui, notifications: [] },
      };

    // Worker actions
    case 'SET_WORKER_STATUS':
      return {
        ...state,
        workers: {
          ...state.workers,
          [action.payload.worker]: action.payload.status,
        },
      };

    default:
      return state;
  }
};

// =============================================================================
// Context
// =============================================================================

interface UIContextValue {
  state: UIState;
  dispatch: Dispatch<UIAction>;
}

const UIContext = createContext<UIContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

interface UIProviderProps {
  children: ReactNode;
}

export const UIProvider = ({ children }: UIProviderProps) => {
  const [state, dispatch] = useReducer(uiReducer, createInitialState());

  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
};

// =============================================================================
// Hook
// =============================================================================

export const useUIController = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIController must be used within a UIProvider');
  }
  return context;
};

// =============================================================================
// Selector Hooks (for optimized re-renders)
// =============================================================================

export const useAuth = () => {
  const { state } = useUIController();
  return state.auth;
};

export const useSignals = () => {
  const { state } = useUIController();
  return state.signals;
};

export const useRules = () => {
  const { state } = useUIController();
  return state.rules;
};

export const useAnalytics = () => {
  const { state } = useUIController();
  return state.analytics;
};

export const useUI = () => {
  const { state } = useUIController();
  return state.ui;
};

export const useWorkers = () => {
  const { state } = useUIController();
  return state.workers;
};