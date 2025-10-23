/**
 * Authentication Operations - Main thread fallback implementations
 *
 * These operations run when Web Workers are not available,
 * providing the same functionality as the worker implementations.
 */

import { WorkOSAuthService } from '../auth/workos';
import { SecurityValidator } from '../security/validation';

/**
 * Process authentication operations on main thread.
 */
export async function processAuthOperation(type: string, payload?: any): Promise<any> {
  switch (type) {
    case 'INIT':
      return initializeAuth();

    case 'LOGIN':
      return login(payload);

    case 'LOGOUT':
      return logout();

    case 'REFRESH_TOKEN':
      return refreshToken();

    case 'VALIDATE_SESSION':
      return validateSession();

    default:
      throw new Error(`Unknown auth operation: ${type}`);
  }
}

/**
 * Initialize authentication system.
 */
async function initializeAuth(): Promise<any> {
  try {
    // Check for existing session
    const token = localStorage.getItem('betrace_auth_token');
    if (token) {
      const isValid = await validateToken(token);
      if (isValid) {
        const user = await getUserFromToken(token);
        return { user };
      } else {
        localStorage.removeItem('betrace_auth_token');
      }
    }

    return { user: null };
  } catch (error) {
    console.error('Auth initialization error:', error);
    throw error;
  }
}

/**
 * Perform user login.
 */
async function login(credentials: { email: string; password: string }): Promise<any> {
  try {
    // Validate and sanitize input
    const emailValidation = SecurityValidator.validateEmail(credentials.email);
    const passwordValidation = SecurityValidator.validate(credentials.password, { required: true, minLength: 8, maxLength: 128 });

    if (!emailValidation.isValid) {
      throw new Error(`Invalid email: ${emailValidation.errors.join(', ')}`);
    }

    if (!passwordValidation.isValid) {
      throw new Error(`Invalid password: ${passwordValidation.errors.join(', ')}`);
    }

    const sanitizedEmail = emailValidation.sanitizedValue!;
    const sanitizedPassword = passwordValidation.sanitizedValue!;

    // In demo mode, use mock authentication
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      return mockLogin(sanitizedEmail, sanitizedPassword);
    }

    // Use WorkOS for production authentication
    const workosAuth = new WorkOSAuthService();
    const result = await workosAuth.getDemoSession(); // For now, using demo session

    // For demo session, generate a mock token
    const mockToken = generateMockToken();
    localStorage.setItem('betrace_auth_token', mockToken);

    return { user: result.user };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

/**
 * Perform user logout.
 */
async function logout(): Promise<any> {
  try {
    // Clear local storage
    localStorage.removeItem('betrace_auth_token');
    localStorage.removeItem('betrace_user_data');

    // Notify WorkOS in production
    if (import.meta.env.VITE_DEMO_MODE !== 'true') {
      const workosAuth = new WorkOSAuthService();
      await workosAuth.logout();
    }

    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    // Don't throw error for logout failures
    return { success: false };
  }
}

/**
 * Refresh authentication token.
 */
async function refreshToken(): Promise<any> {
  try {
    const token = localStorage.getItem('betrace_auth_token');
    if (!token) {
      throw new Error('No token to refresh');
    }

    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      // In demo mode, just validate existing token
      const isValid = await validateToken(token);
      if (!isValid) {
        throw new Error('Token validation failed');
      }
      return { token };
    }

    // Use WorkOS for token refresh (simplified for demo)
    const workosAuth = new WorkOSAuthService();
    const result = await workosAuth.getDemoSession();

    const mockToken = generateMockToken();
    localStorage.setItem('betrace_auth_token', mockToken);
    return { token: mockToken, user: result.user };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Validate current session.
 */
async function validateSession(): Promise<boolean> {
  try {
    const token = localStorage.getItem('betrace_auth_token');
    if (!token) {
      return false;
    }

    return await validateToken(token);
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

/**
 * Validate token with backend or WorkOS.
 */
async function validateToken(token: string): Promise<boolean> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      // Simple validation for demo mode
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp > Date.now() / 1000;
    }

    // Validate with WorkOS (simplified for demo)
    const workosAuth = new WorkOSAuthService();
    // For demo, just return true if configured
    return workosAuth.configured;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Extract user data from token.
 */
async function getUserFromToken(token: string): Promise<any> {
  try {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      // Return demo user
      return {
        id: 'demo-user',
        email: 'demo@betrace.example',
        name: 'Demo User',
        role: 'admin',
        permissions: ['signals:read', 'signals:write', 'rules:read', 'rules:write'],
      };
    }

    // Get user from WorkOS (simplified for demo)
    const workosAuth = new WorkOSAuthService();
    const demoSession = await workosAuth.getDemoSession();
    return demoSession.user;
  } catch (error) {
    console.error('Get user from token error:', error);
    throw error;
  }
}

/**
 * Mock login for demo mode.
 */
async function mockLogin(email: string, password: string): Promise<any> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Demo credentials
  if (email === 'demo@betrace.example' && password === 'demo123') {
    const mockToken = generateMockToken();
    const user = {
      id: 'demo-user',
      email: 'demo@betrace.example',
      name: 'Demo User',
      role: 'admin',
      permissions: ['signals:read', 'signals:write', 'rules:read', 'rules:write'],
    };

    return { token: mockToken, user };
  }

  throw new Error('Invalid demo credentials');
}

/**
 * Generate mock JWT token for demo mode.
 */
function generateMockToken(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'demo-user',
    email: 'demo@betrace.example',
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iat: Math.floor(Date.now() / 1000),
  }));
  const signature = 'mock-signature';

  return `${header}.${payload}.${signature}`;
}