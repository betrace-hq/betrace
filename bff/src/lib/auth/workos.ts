import type { User, Tenant, AuthSession } from '../types/auth';

// WorkOS configuration
const WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID;
const WORKOS_API_HOSTNAME = import.meta.env.VITE_WORKOS_API_HOSTNAME || 'api.workos.com';

export interface WorkOSUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
}

export interface WorkOSOrganization {
  id: string;
  name: string;
  domains: Array<{
    domain: string;
    id: string;
  }>;
}

export interface WorkOSAuthorizationUrlOptions {
  connection?: string;
  organization?: string;
  domain?: string;
  redirectUri: string;
  state?: string;
}

export class WorkOSAuthService {
  private clientId: string | null;
  private apiHostname: string;
  private isConfigured: boolean;

  constructor() {
    this.clientId = WORKOS_CLIENT_ID || null;
    this.apiHostname = WORKOS_API_HOSTNAME;
    this.isConfigured = !!WORKOS_CLIENT_ID;

    if (!this.isConfigured) {
      console.warn('WorkOS not configured - falling back to demo mode. Set VITE_WORKOS_CLIENT_ID to enable SSO.');
    }
  }

  /**
   * Check if WorkOS is properly configured
   */
  get configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Generate WorkOS authorization URL for SSO
   */
  generateAuthorizationUrl(options: WorkOSAuthorizationUrlOptions): string {
    if (!this.isConfigured || !this.clientId) {
      throw new Error('WorkOS not configured. Use demo login instead.');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: options.redirectUri,
      response_type: 'code',
    });

    if (options.connection) {
      params.set('connection', options.connection);
    }

    if (options.organization) {
      params.set('organization', options.organization);
    }

    if (options.domain) {
      params.set('domain', options.domain);
    }

    if (options.state) {
      params.set('state', options.state);
    }

    return `https://${this.apiHostname}/sso/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for user session
   */
  async exchangeCodeForSession(code: string): Promise<AuthSession> {
    try {
      // In a real implementation, this would be handled by your backend
      // This is a simplified version for demonstration
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for session');
      }

      const data = await response.json();

      // Transform WorkOS user data to our User type
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.firstName && data.user.lastName
          ? `${data.user.firstName} ${data.user.lastName}`
          : data.user.email,
        role: data.user.role || 'member', // Default role
        avatar: data.user.profilePictureUrl,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      // Transform organization data to our Tenant type
      const tenant: Tenant = {
        id: data.organization.id,
        name: data.organization.name,
        slug: data.organization.name.toLowerCase().replace(/\s+/g, '-'),
        plan: 'pro', // Default plan
        features: ['signals', 'rules', 'analytics'], // Default features
        limits: {
          signals: 10000,
          rules: 100,
          users: 50,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return { user, tenant };
    } catch (error) {
      console.error('Failed to exchange code for session:', error);
      throw error;
    }
  }

  /**
   * Initiate SSO login
   */
  initiateSSO(options: Omit<WorkOSAuthorizationUrlOptions, 'redirectUri'> = {}) {
    if (!this.isConfigured) {
      throw new Error('WorkOS not configured. Please use demo mode instead.');
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = this.generateState();

    // Store state for verification
    sessionStorage.setItem('workos_state', state);

    const authUrl = this.generateAuthorizationUrl({
      ...options,
      redirectUri,
      state,
    });

    // Redirect to WorkOS
    window.location.href = authUrl;
  }

  /**
   * Handle SSO callback
   */
  async handleCallback(code: string, state: string): Promise<AuthSession> {
    const storedState = sessionStorage.getItem('workos_state');

    if (!storedState || storedState !== state) {
      throw new Error('Invalid state parameter');
    }

    // Clear stored state
    sessionStorage.removeItem('workos_state');

    try {
      const session = await this.exchangeCodeForSession(code);
      return session;
    } catch (error) {
      console.error('SSO callback error:', error);
      throw error;
    }
  }

  /**
   * Demo login (for development/testing)
   */
  async getDemoSession(): Promise<AuthSession> {
    // Create demo user and tenant
    const demoUser: User = {
      id: 'demo-user-1',
      email: 'demo@fluo.dev',
      name: 'Demo User',
      role: 'admin',
      avatar: `https://ui-avatars.com/api/?name=Demo+User&background=3b82f6&color=fff`,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const demoTenant: Tenant = {
      id: 'demo-tenant-1',
      name: 'Demo Organization',
      slug: 'demo-org',
      plan: 'pro',
      features: ['signals', 'rules', 'analytics', 'webhooks'],
      limits: {
        signals: 10000,
        rules: 100,
        users: 50,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { user: demoUser, tenant: demoTenant };
  }

  /**
   * Logout (handled by auth context)
   */
  async logout(): Promise<void> {
    // In a real implementation, you might also want to
    // revoke tokens on the backend and redirect to WorkOS logout
    // For now, this is just a placeholder as logout is handled by auth context
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// Export singleton instance
export const workosAuth = new WorkOSAuthService();