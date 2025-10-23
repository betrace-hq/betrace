import { useAuth } from '../auth/auth-context';
import type { User } from '../types/auth';

/**
 * Security guard utilities for authorization and access control
 */

export type Permission =
  | 'signals:read'
  | 'signals:write'
  | 'signals:investigate'
  | 'rules:read'
  | 'rules:write'
  | 'rules:activate'
  | 'tenant:read'
  | 'tenant:write'
  | 'tenant:manage'
  | 'users:read'
  | 'users:write'
  | 'billing:read'
  | 'billing:write';

export type Role = 'viewer' | 'member' | 'admin' | 'owner';

export interface SecurityContext {
  user: User | null;
  tenant: any;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthGuard {
  private static permissionMatrix: Record<Role, Permission[]> = {
    viewer: [
      'signals:read',
      'rules:read',
      'tenant:read',
      'users:read'
    ],
    member: [
      'signals:read',
      'signals:write',
      'signals:investigate',
      'rules:read',
      'rules:write',
      'tenant:read',
      'users:read'
    ],
    admin: [
      'signals:read',
      'signals:write',
      'signals:investigate',
      'rules:read',
      'rules:write',
      'rules:activate',
      'tenant:read',
      'tenant:write',
      'users:read',
      'users:write',
      'billing:read'
    ],
    owner: [
      'signals:read',
      'signals:write',
      'signals:investigate',
      'rules:read',
      'rules:write',
      'rules:activate',
      'tenant:read',
      'tenant:write',
      'tenant:manage',
      'users:read',
      'users:write',
      'billing:read',
      'billing:write'
    ]
  };

  /**
   * Check if user has required permission
   */
  static hasPermission(user: User | null, permission: Permission): boolean {
    if (!user || !user.role) {
      return false;
    }

    const userRole = user.role as Role;
    const permissions = this.permissionMatrix[userRole];

    return permissions?.includes(permission) ?? false;
  }

  /**
   * Check if user has minimum role level
   */
  static hasMinRole(user: User | null, minRole: Role): boolean {
    if (!user || !user.role) {
      return false;
    }

    const roleHierarchy: Record<Role, number> = {
      viewer: 0,
      member: 1,
      admin: 2,
      owner: 3
    };

    const userRoleLevel = roleHierarchy[user.role as Role] ?? -1;
    const minRoleLevel = roleHierarchy[minRole];

    return userRoleLevel >= minRoleLevel;
  }

  /**
   * Validate session and check for suspicious activity
   */
  static validateSession(context: SecurityContext): {
    isValid: boolean;
    warnings: string[];
    shouldLogout: boolean;
  } {
    const warnings: string[] = [];
    let shouldLogout = false;

    // Check if user exists
    if (!context.user) {
      return { isValid: false, warnings: ['No user in session'], shouldLogout: true };
    }

    // Check session age (example: 24 hours max)
    const sessionAge = Date.now() - new Date(context.user.lastLoginAt).getTime();
    const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxSessionAge) {
      warnings.push('Session expired');
      shouldLogout = true;
    }

    // Check for suspicious user agent changes
    const storedUserAgent = localStorage.getItem('betrace_user_agent');
    if (storedUserAgent && context.userAgent && storedUserAgent !== context.userAgent) {
      warnings.push('User agent changed - possible session hijacking');
      // Don't auto-logout, but flag for monitoring
    }

    // Check for rapid role/permission changes
    const lastRoleCheck = localStorage.getItem('betrace_last_role_check');
    const currentTime = Date.now();
    if (lastRoleCheck) {
      const timeSinceLastCheck = currentTime - parseInt(lastRoleCheck);
      if (timeSinceLastCheck < 60000) { // Less than 1 minute
        warnings.push('Rapid permission checks detected');
      }
    }
    localStorage.setItem('betrace_last_role_check', currentTime.toString());

    return {
      isValid: !shouldLogout,
      warnings,
      shouldLogout
    };
  }

  /**
   * Rate limiting for sensitive operations
   */
  static checkRateLimit(operation: string, maxAttempts: number = 5, windowMs: number = 300000): boolean {
    const key = `rate_limit_${operation}`;
    const now = Date.now();
    const window = windowMs; // 5 minutes default

    const stored = localStorage.getItem(key);
    const attempts = stored ? JSON.parse(stored) : [];

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter((timestamp: number) => now - timestamp < window);

    if (recentAttempts.length >= maxAttempts) {
      console.warn(`Rate limit exceeded for operation: ${operation}`);
      return false;
    }

    // Add current attempt
    recentAttempts.push(now);
    localStorage.setItem(key, JSON.stringify(recentAttempts));

    return true;
  }

  /**
   * Sanitize sensitive data for logging
   */
  static sanitizeForLogging(data: any): any {
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeForLogging(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Generate secure audit trail entry
   */
  static createAuditEntry(
    action: string,
    resource: string,
    user: User | null,
    details?: any
  ): {
    timestamp: string;
    action: string;
    resource: string;
    userId?: string;
    userEmail?: string;
    tenantId?: string;
    details: any;
    sessionId: string;
    ipAddress?: string;
  } {
    return {
      timestamp: new Date().toISOString(),
      action,
      resource,
      userId: user?.id,
      userEmail: user?.email,
      tenantId: user?.id, // Assuming user has tenant info
      details: this.sanitizeForLogging(details),
      sessionId: crypto.randomUUID(),
      ipAddress: 'unknown' // Would be populated by backend
    };
  }
}

/**
 * React hook for permission checking
 */
export function usePermissions() {
  const { user } = useAuth();

  return {
    hasPermission: (permission: Permission) => AuthGuard.hasPermission(user, permission),
    hasMinRole: (role: Role) => AuthGuard.hasMinRole(user, role),
    canRead: (resource: 'signals' | 'rules' | 'tenant' | 'users' | 'billing') =>
      AuthGuard.hasPermission(user, `${resource}:read` as Permission),
    canWrite: (resource: 'signals' | 'rules' | 'tenant' | 'users' | 'billing') =>
      AuthGuard.hasPermission(user, `${resource}:write` as Permission),
    canManage: (resource: 'tenant') =>
      AuthGuard.hasPermission(user, `${resource}:manage` as Permission),
  };
}

/**
 * Security monitoring utilities
 */
export class SecurityMonitor {
  private static events: any[] = [];

  static logSecurityEvent(
    type: 'auth_failure' | 'permission_denied' | 'rate_limit' | 'suspicious_activity',
    details: any
  ) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      details: AuthGuard.sanitizeForLogging(details),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.events.push(event);

    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }

    // In production, send to security monitoring service
    console.warn('Security event:', event);
  }

  static getSecurityEvents(): any[] {
    return [...this.events];
  }

  static clearSecurityEvents() {
    this.events = [];
  }
}