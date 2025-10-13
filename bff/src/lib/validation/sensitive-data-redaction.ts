/**
 * Sensitive Data Redaction for DSL Error Messages (PRD-010d)
 *
 * Prevents information disclosure by redacting sensitive patterns from error messages
 * before displaying to users or announcing via screen readers.
 *
 * Protects:
 * - API keys and tokens
 * - Credit card numbers
 * - Email addresses
 * - Social Security Numbers
 * - UUIDs and other identifiers
 */

// ============================================================================
// Sensitive Patterns
// ============================================================================

interface RedactionPattern {
  pattern: RegExp;
  replacement: string;
  description: string;
}

/**
 * Patterns for sensitive data that should be redacted from error messages.
 *
 * Order matters: More specific patterns first to avoid partial redactions.
 */
const SENSITIVE_PATTERNS: RedactionPattern[] = [
  // API Keys (Stripe, AWS, etc.)
  {
    pattern: /(sk_live_|pk_live_|sk_test_|pk_test_)\w+/g,
    replacement: '***REDACTED_API_KEY***',
    description: 'Stripe API keys',
  },
  {
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: '***REDACTED_AWS_KEY***',
    description: 'AWS access keys',
  },
  {
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    replacement: '***REDACTED_GOOGLE_KEY***',
    description: 'Google API keys',
  },

  // OAuth Tokens
  {
    pattern: /ghp_[a-zA-Z0-9]{30,40}/g,
    replacement: '***REDACTED_GITHUB_TOKEN***',
    description: 'GitHub personal access tokens',
  },
  {
    pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
    replacement: '***REDACTED_SLACK_TOKEN***',
    description: 'Slack tokens',
  },

  // Credit Cards (16-digit sequences)
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '***REDACTED_CARD***',
    description: 'Credit card numbers',
  },
  {
    pattern: /\b\d{16}\b/g,
    replacement: '***REDACTED_CARD***',
    description: 'Credit card numbers (no spaces)',
  },

  // Social Security Numbers
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '***REDACTED_SSN***',
    description: 'Social Security Numbers',
  },

  // Email Addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '***REDACTED_EMAIL***',
    description: 'Email addresses',
  },

  // Phone Numbers (US format)
  {
    pattern: /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '***REDACTED_PHONE***',
    description: 'Phone numbers',
  },

  // UUIDs and Long Identifiers
  {
    pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    replacement: '***REDACTED_UUID***',
    description: 'UUIDs',
  },
  {
    pattern: /\/[a-z0-9]{32,}/gi,
    replacement: '/***REDACTED_ID***',
    description: 'Long path identifiers',
  },

  // IP Addresses
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '***REDACTED_IP***',
    description: 'IPv4 addresses',
  },

  // JWT Tokens (basic pattern)
  {
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replacement: '***REDACTED_JWT***',
    description: 'JWT tokens',
  },
];

// ============================================================================
// Redaction Functions
// ============================================================================

/**
 * Redacts sensitive data from error messages before displaying to users.
 *
 * @param message - The error message potentially containing sensitive data
 * @returns Message with sensitive patterns replaced by redaction placeholders
 *
 * @example
 * ```typescript
 * const error = "Invalid token: sk_live_abc123xyz";
 * const safe = redactSensitiveData(error);
 * // Returns: "Invalid token: ***REDACTED_API_KEY***"
 * ```
 *
 * @example
 * ```typescript
 * const error = "User email user@example.com not found";
 * const safe = redactSensitiveData(error);
 * // Returns: "User email ***REDACTED_EMAIL*** not found"
 * ```
 */
export function redactSensitiveData(message: string): string {
  let redacted = message;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

/**
 * Checks if a message contains any sensitive data patterns.
 *
 * Useful for logging/alerting when sensitive data is detected in unexpected places.
 *
 * @param message - The message to check
 * @returns Object with detection results
 *
 * @example
 * ```typescript
 * const result = detectSensitiveData("Token: sk_live_abc123");
 * // Returns: { hasSensitiveData: true, patterns: ['Stripe API keys'] }
 * ```
 */
export function detectSensitiveData(message: string): {
  hasSensitiveData: boolean;
  patterns: string[];
} {
  const matchedPatterns: string[] = [];

  for (const { pattern, description } of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      matchedPatterns.push(description);
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
    }
  }

  return {
    hasSensitiveData: matchedPatterns.length > 0,
    patterns: matchedPatterns,
  };
}

/**
 * Redacts sensitive data and logs a warning if any was found.
 *
 * Use this in contexts where sensitive data should NEVER appear (like error messages).
 *
 * @param message - The message to redact
 * @param context - Context string for logging (e.g., "DSL validation error")
 * @returns Redacted message
 */
export function redactAndWarn(message: string, context: string): string {
  const detection = detectSensitiveData(message);

  if (detection.hasSensitiveData) {
    console.warn(
      `[SECURITY] Sensitive data detected in ${context}:`,
      detection.patterns.join(', ')
    );
  }

  return redactSensitiveData(message);
}
