// Simple React Context for auth using WorkOS
// No Zustand - just React Context + localStorage for persistence

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Tenant } from '@/lib/types/auth';
import { workosAuth } from './workos';
import { AuthGuard, type Permission, type Role } from '@/lib/security/auth-guard';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
}

interface AuthContextValue extends AuthState {
  login: (user: User, tenant: Tenant) => void;
  logout: () => void;
  enableDemoMode: () => void;
  canAccess: (permission: Permission) => boolean;
  hasMinRole: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER: User = {
  id: 'demo-user',
  email: 'demo@fluo.dev',
  firstName: 'Demo',
  lastName: 'User',
  profilePictureUrl: 'https://ui-avatars.com/api/?name=Demo+User&background=3b82f6&color=fff',
  role: 'admin',
  tenantId: 'demo-tenant',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const DEMO_TENANT: Tenant = {
  id: 'demo-tenant',
  name: 'Demo Organization',
  domain: 'demo.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    isAuthenticated: false,
    isLoading: true,
    isDemoMode: false,
  });

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('fluo-auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          ...parsed,
          isLoading: false,
        }));
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!state.isLoading) {
      localStorage.setItem('fluo-auth', JSON.stringify({
        user: state.user,
        tenant: state.tenant,
        isAuthenticated: state.isAuthenticated,
        isDemoMode: state.isDemoMode,
      }));
    }
  }, [state.user, state.tenant, state.isAuthenticated, state.isDemoMode, state.isLoading]);

  const login = (user: User, tenant: Tenant) => {
    setState({
      user,
      tenant,
      isAuthenticated: true,
      isLoading: false,
      isDemoMode: false,
    });
  };

  const logout = () => {
    setState({
      user: null,
      tenant: null,
      isAuthenticated: false,
      isLoading: false,
      isDemoMode: false,
    });
    localStorage.removeItem('fluo-auth');
  };

  const enableDemoMode = async () => {
    try {
      const session = await workosAuth.getDemoSession();
      setState({
        user: session.user,
        tenant: session.tenant,
        isAuthenticated: true,
        isLoading: false,
        isDemoMode: true,
      });
    } catch (error) {
      console.error('Failed to enable demo mode:', error);
      // Fallback to static demo data
      setState({
        user: DEMO_USER,
        tenant: DEMO_TENANT,
        isAuthenticated: true,
        isLoading: false,
        isDemoMode: true,
      });
    }
  };

  const canAccess = (permission: Permission): boolean => {
    return AuthGuard.hasPermission(state.user, permission);
  };

  const hasMinRole = (role: Role): boolean => {
    return AuthGuard.hasMinRole(state.user, role);
  };

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    enableDemoMode,
    canAccess,
    hasMinRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}