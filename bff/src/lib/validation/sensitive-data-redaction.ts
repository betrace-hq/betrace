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
    pattern: /AIza[0-9A-Za-z_-]{30,40}/g,
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

  // P2 Security Enhancements (PRD-010d Phase 5)

  // Database Connection Strings
  {
    pattern: /\w+:\/\/[^:]+:[^@]+@[\w.-]+:\d+\/\w+/g,
    replacement: '***REDACTED_DB_CONNECTION***',
    description: 'Database connection strings',
  },
  {
    pattern: /(mongodb|postgres|mysql|redis):\/\/[^\s"']+/gi,
    replacement: '***REDACTED_DB_URI***',
    description: 'Database URIs',
  },

  // Private Keys (PEM format)
  {
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '***REDACTED_PRIVATE_KEY***',
    description: 'Private keys (PEM format)',
  },
  {
    pattern: /-----BEGIN [\w\s]+-----[\s\S]*?-----END [\w\s]+-----/g,
    replacement: '***REDACTED_CERTIFICATE***',
    description: 'Certificates and key blocks',
  },

  // Azure Secrets and Connection Strings
  {
    pattern: /AZURE_[A-Z_]+=[a-zA-Z0-9+/=]{20,}/g,
    replacement: '***REDACTED_AZURE_SECRET***',
    description: 'Azure secrets and keys',
  },
  {
    pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/g,
    replacement: '***REDACTED_AZURE_CONNECTION***',
    description: 'Azure Storage connection strings',
  },

  // GCP/Google Cloud Secrets (duplicate pattern removed - already defined above)
  {
    pattern: /"type":\s*"service_account"[\s\S]*?"private_key":\s*"[^"]+"/g,
    replacement: '***REDACTED_GCP_SERVICE_ACCOUNT***',
    description: 'GCP service account JSON',
  },

  // OAuth Client Secrets
  {
    pattern: /client_secret["\s:=]+[a-zA-Z0-9_-]{20,}/gi,
    replacement: '***REDACTED_CLIENT_SECRET***',
    description: 'OAuth client secrets',
  },

  // Password-like patterns in URLs/configs
  {
    pattern: /(password|passwd|pwd)["\s:=]+[^\s"',;)]+/gi,
    replacement: '***REDACTED_PASSWORD***',
    description: 'Passwords in configurations',
  },
];

// ============================================================================
// Redaction Functions
// ============================================================================

/**
 * Maximum error message length to prevent DoS via large error messages.
 *
 * P2 Security: Prevents attackers from generating 1MB+ error messages that
 * freeze the UI during redaction/sanitization processing.
 *
 * @see https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS
 */
const MAX_ERROR_MESSAGE_LENGTH = 10000; // 10KB limit

/**
 * Truncates error message if it exceeds maximum length.
 *
 * @param message - The error message to truncate
 * @returns Truncated message with indicator if truncation occurred
 */
function truncateErrorMessage(message: string): string {
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return message;
  }

  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH) + '\n\n... [Error message truncated for security]';
}

/**
 * Redacts sensitive data from error messages before displaying to users.
 *
 * P2 Security Enhancement: Now includes message length truncation to prevent
 * ReDoS (Regular Expression Denial of Service) attacks.
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
 *
 * @example
 * ```typescript
 * const hugeError = 'x'.repeat(20000); // 20KB message
 * const safe = redactSensitiveData(hugeError);
 * // Returns: First 10KB + "... [Error message truncated for security]"
 * ```
 */
export function redactSensitiveData(message: string): string {
  // P2 Security: Truncate before redaction to prevent ReDoS
  let redacted = truncateErrorMessage(message);

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
