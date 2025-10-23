/**
 * Reactive Authentication Hook - Context+useReducer implementation
 *
 * Replaces direct auth calls with reactive architecture following ADR-006:
 * - Uses React Context + useReducer for state management
 * - Delegates authentication to background workers
 * - Provides stable references following React best practices
 */

import { useCallback, useEffect } from 'react';
import { useUIController } from '../reactive-engine/ui-controller';
import { getAuthWorker } from '../workers/auth-worker';

export function useReactiveAuth() {
  const { state, dispatch } = useUIController();
  const { auth } = state;

  // Get auth worker instance
  const authWorker = getAuthWorker();

  // Set up worker connection if not already done
  useEffect(() => {
    authWorker.setUIDispatch(dispatch);
  }, [dispatch]);

  // Initialize authentication on mount
  useEffect(() => {
    authWorker.initialize();
  }, []); // Only run on mount

  // Stable callback functions using useCallback for dependency arrays
  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      try {
        await authWorker.login(credentials);
      } catch (error) {
        // Error handling is done in the worker
        throw error;
      }
    },
    [authWorker]
  );

  const logout = useCallback(async () => {
    await authWorker.logout();
  }, [authWorker]);

  const refreshToken = useCallback(async () => {
    await authWorker.refreshToken();
  }, [authWorker]);

  const validateSession = useCallback(async (): Promise<boolean> => {
    return await authWorker.validateSession();
  }, [authWorker]);

  // Auto-refresh token periodically
  useEffect(() => {
    if (!auth.isAuthenticated) return;

    const interval = setInterval(() => {
      refreshToken().catch(console.error);
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => clearInterval(interval);
  }, [auth.isAuthenticated, refreshToken]);

  return {
    // Authentication state
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loading,
    error: auth.error,

    // Actions with stable references
    login,
    logout,
    refreshToken,
    validateSession,

    // Computed values
    isLoggedIn: auth.isAuthenticated && auth.user !== null,
    isGuest: !auth.isAuthenticated,
    hasError: auth.error !== null,
  };
}

/**
 * Hook for user permissions and role-based access.
 */
export function usePermissions() {
  const { user, isAuthenticated } = useReactiveAuth();

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!isAuthenticated || !user?.permissions) {
        return false;
      }

      return user.permissions.includes(permission);
    },
    [isAuthenticated, user?.permissions]
  );

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!isAuthenticated || !user?.role) {
        return false;
      }

      return user.role === role;
    },
    [isAuthenticated, user?.role]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      return permissions.some(permission => hasPermission(permission));
    },
    [hasPermission]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      return permissions.every(permission => hasPermission(permission));
    },
    [hasPermission]
  );

  const canAccessSignals = hasPermission('signals:read');
  const canModifySignals = hasPermission('signals:write');
  const canAccessRules = hasPermission('rules:read');
  const canModifyRules = hasPermission('rules:write');
  const canAccessAnalytics = hasPermission('analytics:read');
  const canManageUsers = hasPermission('users:write');
  const canManageSystem = hasPermission('system:admin');

  return {
    // Permission checkers
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,

    // Common permissions
    canAccessSignals,
    canModifySignals,
    canAccessRules,
    canModifyRules,
    canAccessAnalytics,
    canManageUsers,
    canManageSystem,

    // User info
    userRole: user?.role,
    userPermissions: user?.permissions || [],
    isAdmin: hasRole('admin'),
    isViewer: hasRole('viewer'),
  };
}

/**
 * Hook for demo mode detection and handling.
 */
export function useDemoMode() {
  const { user } = useReactiveAuth();

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || user?.id === 'demo-user';

  return {
    isDemoMode,
    isDemoUser: user?.id === 'demo-user',
    demoCredentials: {
      email: 'demo@betrace.example',
      password: 'demo123',
    },
  };
}

/**
 * Hook for session management and timeout handling.
 */
export function useSession() {
  const { isAuthenticated, validateSession, logout } = useReactiveAuth();
  const { dispatch } = useUIController();

  // Check session validity periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSession = async () => {
      const isValid = await validateSession();
      if (!isValid) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            type: 'warning',
            title: 'Session Expired',
            message: 'Your session has expired. Please log in again.',
          },
        });
        await logout();
      }
    };

    // Check session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, validateSession, logout, dispatch]);

  // Handle browser visibility change (session validation on focus)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        const isValid = await validateSession();
        if (!isValid) {
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              type: 'warning',
              title: 'Session Expired',
              message: 'Your session has expired. Please log in again.',
            },
          });
          await logout();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, validateSession, logout, dispatch]);

  return {
    // Session state
    isSessionValid: isAuthenticated,

    // Session actions
    validateSession,
    logout,
  };
}