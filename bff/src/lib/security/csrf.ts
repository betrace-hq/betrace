/**
 * CSRF Protection utilities
 */

export class CSRFProtection {
  private static TOKEN_HEADER = 'X-CSRF-Token';
  private static TOKEN_STORAGE_KEY = 'fluo_csrf_token';
  private static TOKEN_EXPIRY_KEY = 'fluo_csrf_expiry';

  /**
   * Generate a cryptographically secure CSRF token
   */
  static generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get current CSRF token, generating a new one if needed
   */
  static getToken(): string {
    const stored = sessionStorage.getItem(this.TOKEN_STORAGE_KEY);
    const expiry = sessionStorage.getItem(this.TOKEN_EXPIRY_KEY);

    // Check if token exists and hasn't expired (1 hour)
    if (stored && expiry && Date.now() < parseInt(expiry)) {
      return stored;
    }

    // Generate new token
    const newToken = this.generateToken();
    const newExpiry = Date.now() + (60 * 60 * 1000); // 1 hour

    sessionStorage.setItem(this.TOKEN_STORAGE_KEY, newToken);
    sessionStorage.setItem(this.TOKEN_EXPIRY_KEY, newExpiry.toString());

    return newToken;
  }

  /**
   * Add CSRF token to request headers
   */
  static addTokenToHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return {
      ...headers,
      [this.TOKEN_HEADER]: this.getToken()
    };
  }

  /**
   * Validate CSRF token (client-side validation)
   */
  static validateToken(token: string): boolean {
    const stored = sessionStorage.getItem(this.TOKEN_STORAGE_KEY);
    const expiry = sessionStorage.getItem(this.TOKEN_EXPIRY_KEY);

    if (!stored || !expiry || Date.now() >= parseInt(expiry)) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    return this.constantTimeEqual(token, stored);
  }

  /**
   * Constant-time string comparison
   */
  private static constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Clear CSRF token (on logout)
   */
  static clearToken(): void {
    sessionStorage.removeItem(this.TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }

  /**
   * Rotate CSRF token (periodically for security)
   */
  static rotateToken(): string {
    this.clearToken();
    return this.getToken();
  }
}

/**
 * Content Security Policy utilities
 */
export class CSPManager {
  /**
   * Generate Content Security Policy directives
   */
  static generateCSP(): string {
    const directives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for Vite in development
        'https://cdn.jsdelivr.net', // For external dependencies
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled components
        'https://fonts.googleapis.com'
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:'
      ],
      'connect-src': [
        "'self'",
        'https://api.workos.com', // WorkOS API
        'wss://localhost:*', // WebSocket in development
        'ws://localhost:*'
      ],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
      'upgrade-insecure-requests': []
    };

    return Object.entries(directives)
      .map(([directive, sources]) =>
        sources.length > 0
          ? `${directive} ${sources.join(' ')}`
          : directive
      )
      .join('; ');
  }

  /**
   * Apply CSP via meta tag (for SPA)
   */
  static applyCSP(): void {
    const existingMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingMeta) {
      existingMeta.remove();
    }

    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = this.generateCSP();
    document.head.appendChild(meta);
  }
}

/**
 * Secure headers management
 */
export class SecureHeaders {
  /**
   * Get security headers for API requests
   */
  static getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      ...CSRFProtection.addTokenToHeaders()
    };
  }

  /**
   * Apply security headers to fetch requests
   */
  static applyToFetch(headers: Record<string, string> = {}): Record<string, string> {
    return {
      ...this.getSecurityHeaders(),
      ...headers
    };
  }
}

/**
 * Initialize security measures
 */
export function initializeSecurity(): void {
  // Apply CSP
  CSPManager.applyCSP();

  // Store user agent for session validation
  localStorage.setItem('fluo_user_agent', navigator.userAgent);

  // Generate initial CSRF token
  CSRFProtection.getToken();

  // Set up periodic token rotation (every 30 minutes)
  setInterval(() => {
    CSRFProtection.rotateToken();
  }, 30 * 60 * 1000);

  console.log('Security measures initialized');
}