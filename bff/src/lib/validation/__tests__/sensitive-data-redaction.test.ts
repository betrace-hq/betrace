import { describe, it, expect, vi } from 'vitest';
import {
  redactSensitiveData,
  detectSensitiveData,
  redactAndWarn,
} from '../sensitive-data-redaction';

describe('Sensitive Data Redaction (PRD-010d Security)', () => {
  describe('API Keys', () => {
    it('redacts Stripe API keys', () => {
      const message = 'Invalid token: sk_live_abc123xyz456';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('sk_live_abc123xyz456');
      expect(redacted).toContain('***REDACTED_API_KEY***');
      expect(redacted).toBe('Invalid token: ***REDACTED_API_KEY***');
    });

    it('redacts Stripe test keys', () => {
      const message = 'Test key: sk_test_abc123xyz';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_API_KEY***');
    });

    it('redacts Stripe publishable keys', () => {
      const message = 'Publishable key: pk_live_abc123xyz';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_API_KEY***');
    });

    it('redacts AWS access keys', () => {
      const message = 'AWS key: AKIAIOSFODNN7EXAMPLE';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(redacted).toContain('***REDACTED_AWS_KEY***');
    });

    it('redacts Google API keys', () => {
      const message = 'Google key: AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_GOOGLE_KEY***');
    });
  });

  describe('OAuth Tokens', () => {
    it('redacts GitHub personal access tokens', () => {
      const message = 'Token: ghp_abc123xyz456def789ghi012jkl345';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('ghp_abc123xyz456def789ghi012jkl345');
      expect(redacted).toContain('***REDACTED_GITHUB_TOKEN***');
    });

    it('redacts Slack bot tokens', () => {
      const message = 'Slack token: xoxb-1234567890-1234567890-abcdefghij';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_SLACK_TOKEN***');
    });

    it('redacts Slack user tokens', () => {
      const message = 'User token: xoxp-1234567890-1234567890-abcdefghij';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_SLACK_TOKEN***');
    });
  });

  describe('Credit Cards', () => {
    it('redacts 16-digit card numbers', () => {
      const message = 'Card number: 1234567890123456';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('1234567890123456');
      expect(redacted).toContain('***REDACTED_CARD***');
    });

    it('redacts card numbers with spaces', () => {
      const message = 'Card: 1234 5678 9012 3456';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_CARD***');
    });

    it('redacts card numbers with hyphens', () => {
      const message = 'Card: 1234-5678-9012-3456';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_CARD***');
    });
  });

  describe('Social Security Numbers', () => {
    it('redacts SSNs', () => {
      const message = 'SSN: 123-45-6789';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('123-45-6789');
      expect(redacted).toContain('***REDACTED_SSN***');
    });

    it('does not redact similar patterns (dates)', () => {
      const message = 'Date: 01-15-2025';
      const redacted = redactSensitiveData(message);
      // Should not match SSN pattern (different digit grouping)
      expect(redacted).toBe('Date: 01-15-2025');
    });
  });

  describe('Email Addresses', () => {
    it('redacts email addresses', () => {
      const message = 'Email: user@example.com';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('user@example.com');
      expect(redacted).toContain('***REDACTED_EMAIL***');
    });

    it('redacts emails with subdomains', () => {
      const message = 'Contact: admin@mail.example.co.uk';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_EMAIL***');
    });

    it('redacts emails with + addressing', () => {
      const message = 'Email: user+test@example.com';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_EMAIL***');
    });
  });

  describe('Phone Numbers', () => {
    it('redacts US phone numbers', () => {
      const message = 'Phone: 555-123-4567';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_PHONE***');
    });

    it('redacts phone numbers with parentheses', () => {
      const message = 'Phone: (555) 123-4567';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_PHONE***');
    });

    it('redacts phone numbers with country code', () => {
      const message = 'Phone: +1-555-123-4567';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_PHONE***');
    });
  });

  describe('UUIDs and Identifiers', () => {
    it('redacts UUIDs', () => {
      const message = 'ID: 550e8400-e29b-41d4-a716-446655440000';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('550e8400-e29b-41d4-a716-446655440000');
      expect(redacted).toContain('***REDACTED_UUID***');
    });

    it('redacts long path identifiers', () => {
      const message = 'Path: /api/users/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('/***REDACTED_ID***');
    });
  });

  describe('IP Addresses', () => {
    it('redacts IPv4 addresses', () => {
      const message = 'Server IP: 192.168.1.100';
      const redacted = redactSensitiveData(message);
      expect(redacted).not.toContain('192.168.1.100');
      expect(redacted).toContain('***REDACTED_IP***');
    });

    it('redacts public IP addresses', () => {
      const message = 'Origin: 8.8.8.8';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_IP***');
    });
  });

  describe('JWT Tokens', () => {
    it('redacts JWT tokens', () => {
      const message = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_JWT***');
    });
  });

  describe('Multiple Sensitive Patterns', () => {
    it('redacts multiple different patterns in one message', () => {
      const message = 'User user@example.com with token sk_live_abc123 and card 1234567890123456';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_EMAIL***');
      expect(redacted).toContain('***REDACTED_API_KEY***');
      expect(redacted).toContain('***REDACTED_CARD***');
      expect(redacted).not.toContain('user@example.com');
      expect(redacted).not.toContain('sk_live_abc123');
      expect(redacted).not.toContain('1234567890123456');
    });

    it('preserves message structure after redaction', () => {
      const message = 'Error: Invalid API key sk_live_test123 for user@example.com';
      const redacted = redactSensitiveData(message);
      expect(redacted).toBe('Error: Invalid API key ***REDACTED_API_KEY*** for ***REDACTED_EMAIL***');
    });
  });

  describe('detectSensitiveData', () => {
    it('detects when sensitive data is present', () => {
      const message = 'Token: sk_live_abc123';
      const result = detectSensitiveData(message);
      expect(result.hasSensitiveData).toBe(true);
      expect(result.patterns).toContain('Stripe API keys');
    });

    it('returns false when no sensitive data present', () => {
      const message = 'This is a normal error message';
      const result = detectSensitiveData(message);
      expect(result.hasSensitiveData).toBe(false);
      expect(result.patterns).toHaveLength(0);
    });

    it('identifies multiple pattern types', () => {
      const message = 'Token sk_live_abc and email user@example.com';
      const result = detectSensitiveData(message);
      expect(result.hasSensitiveData).toBe(true);
      expect(result.patterns).toHaveLength(2);
      expect(result.patterns).toContain('Stripe API keys');
      expect(result.patterns).toContain('Email addresses');
    });
  });

  describe('redactAndWarn', () => {
    it('redacts data and logs warning when sensitive data found', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const message = 'Token: sk_live_abc123';
      const redacted = redactAndWarn(message, 'DSL validation');

      expect(redacted).toContain('***REDACTED_API_KEY***');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] Sensitive data detected'),
        expect.stringContaining('Stripe API keys')
      );

      consoleSpy.mockRestore();
    });

    it('does not log warning when no sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const message = 'Normal error message';
      const redacted = redactAndWarn(message, 'DSL validation');

      expect(redacted).toBe('Normal error message');
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty strings', () => {
      const redacted = redactSensitiveData('');
      expect(redacted).toBe('');
    });

    it('handles messages with no sensitive data', () => {
      const message = 'This is a normal error message';
      const redacted = redactSensitiveData(message);
      expect(redacted).toBe(message);
    });

    it('handles special characters', () => {
      const message = 'Token: sk_live_abc123 <script>alert("XSS")</script>';
      const redacted = redactSensitiveData(message);
      expect(redacted).toContain('***REDACTED_API_KEY***');
      // Note: XSS sanitization happens in sanitizeErrorMessage, not here
      expect(redacted).toContain('<script>');
    });

    it('handles repeated sensitive patterns', () => {
      const message = 'Tokens: sk_live_abc123 and sk_live_xyz789';
      const redacted = redactSensitiveData(message);
      const count = (redacted.match(/\*\*\*REDACTED_API_KEY\*\*\*/g) || []).length;
      expect(count).toBe(2);
    });
  });
});
