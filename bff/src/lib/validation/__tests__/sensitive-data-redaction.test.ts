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

  describe('P2 Security Enhancements (PRD-010d Phase 5)', () => {
    describe('Database Connection Strings', () => {
      it('redacts PostgreSQL connection strings', () => {
        const message = 'Error: postgres://user:password@localhost:5432/mydb';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_DB_CONNECTION***');
        expect(redacted).not.toContain('password');
      });

      it('redacts MongoDB connection strings', () => {
        const message = 'MongoDB URI: mongodb://admin:secret@mongo.example.com:27017/database';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_DB_URI***');
        expect(redacted).not.toContain('secret');
      });

      it('redacts MySQL connection strings', () => {
        const message = 'mysql://root:MySecretPass@db.internal:3306/app';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_DB_URI***');
        expect(redacted).not.toContain('MySecretPass');
      });

      it('redacts Redis connection strings', () => {
        const message = 'redis://default:redispass@cache.local:6379/0';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_DB_URI***');
        expect(redacted).not.toContain('redispass');
      });
    });

    describe('Private Keys and Certificates', () => {
      it('redacts RSA private key headers', () => {
        const message = 'Error in key: -----BEGIN RSA PRIVATE KEY-----';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_PRIVATE_KEY***');
        expect(redacted).not.toContain('BEGIN RSA PRIVATE KEY');
      });

      it('redacts EC private key headers', () => {
        const message = 'Key data: -----BEGIN EC PRIVATE KEY-----';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_PRIVATE_KEY***');
      });

      it('redacts OpenSSH private key headers', () => {
        const message = 'SSH key: -----BEGIN OPENSSH PRIVATE KEY-----';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_PRIVATE_KEY***');
      });

      it('redacts complete certificate blocks', () => {
        const message = `Certificate:
-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHHCgVZU7jQMA0GCSqGSIb3DQEBCwUAMBMxETAPBgNVBAMMCHRl
-----END CERTIFICATE-----`;
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_CERTIFICATE***');
        expect(redacted).not.toContain('MIIBkTCB');
      });
    });

    describe('Azure and GCP Secrets', () => {
      it('redacts Azure secret environment variables', () => {
        const message = 'Config: AZURE_CLIENT_SECRET=AbCdEfGh123456789IjKlMnOpQrStUvWxYz==';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_AZURE_SECRET***');
        expect(redacted).not.toContain('AbCdEfGh123456789IjKlMnOpQrStUvWxYz==');
      });

      it('redacts Azure Storage connection strings', () => {
        const message = 'DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=abc123xyz789==';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_AZURE_CONNECTION***');
        expect(redacted).not.toContain('AccountKey=');
      });

      it('redacts GCP/Google API keys', () => {
        const message = 'Google API key: AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGe';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_GOOGLE_KEY***');
      });

      it('redacts GCP service account JSON snippets', () => {
        const message = '"type": "service_account", "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIE..."';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_GCP_SERVICE_ACCOUNT***');
      });
    });

    describe('OAuth and Authentication Secrets', () => {
      it('redacts OAuth client secrets', () => {
        const message = 'client_secret: abc123xyz789def456ghi';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_CLIENT_SECRET***');
        expect(redacted).not.toContain('abc123xyz789def456ghi');
      });

      it('redacts passwords in configuration strings', () => {
        const message = 'Config password=MySecretPassword123!';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_PASSWORD***');
        expect(redacted).not.toContain('MySecretPassword123!');
      });

      it('redacts passwd in various formats', () => {
        const message = 'Error: passwd="hunter2"';
        const redacted = redactSensitiveData(message);
        expect(redacted).toContain('***REDACTED_PASSWORD***');
        expect(redacted).not.toContain('hunter2');
      });
    });

    describe('Error Message Truncation (DoS Prevention)', () => {
      it('truncates error messages exceeding 10KB', () => {
        const hugeMessage = 'x'.repeat(15000); // 15KB message
        const redacted = redactSensitiveData(hugeMessage);

        // Should be truncated to ~10KB
        expect(redacted.length).toBeLessThan(15000);
        expect(redacted.length).toBeLessThanOrEqual(10100); // 10KB + truncation message
        expect(redacted).toContain('... [Error message truncated for security]');
      });

      it('does not truncate error messages under 10KB', () => {
        const normalMessage = 'x'.repeat(5000); // 5KB message
        const redacted = redactSensitiveData(normalMessage);

        expect(redacted.length).toBe(5000);
        expect(redacted).not.toContain('truncated');
      });

      it('handles exactly 10KB messages without truncation', () => {
        const exactMessage = 'x'.repeat(10000); // Exactly 10KB
        const redacted = redactSensitiveData(exactMessage);

        expect(redacted.length).toBe(10000);
        expect(redacted).not.toContain('truncated');
      });

      it('truncates before applying PII redaction (performance)', () => {
        // Create 20KB message with PII patterns throughout
        const piiPattern = 'email@example.com ';
        const hugeMessageWithPII = piiPattern.repeat(1000); // ~20KB

        const startTime = Date.now();
        const redacted = redactSensitiveData(hugeMessageWithPII);
        const duration = Date.now() - startTime;

        // Should complete quickly (< 100ms) due to truncation before redaction
        expect(duration).toBeLessThan(100);

        // Should be truncated (10KB + truncation message + redacted email length)
        expect(redacted.length).toBeLessThan(20000); // Less than original
        expect(redacted.length).toBeLessThanOrEqual(12000); // ~10KB + redactions
        expect(redacted).toContain('truncated');

        // PII within first 10KB should still be redacted
        expect(redacted).toContain('***REDACTED_EMAIL***');
      });
    });

    describe('Combined P2 Patterns', () => {
      it('handles messages with multiple new P2 patterns', () => {
        const message = `
          Database: postgres://user:pass@host:5432/db
          Private Key: -----BEGIN RSA PRIVATE KEY-----
          Azure Secret: AZURE_CLIENT_SECRET=AbCdEfGh123456789IjKlMnOpQrStUvWxYz==
          GCP Key: AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGe
          OAuth: client_secret=xyz789abcdef123456789
          Password: password=secret123
        `;
        const redacted = redactSensitiveData(message);

        expect(redacted).toContain('***REDACTED_DB_CONNECTION***');
        expect(redacted).toContain('***REDACTED_PRIVATE_KEY***');
        expect(redacted).toContain('***REDACTED_AZURE_SECRET***');
        expect(redacted).toContain('***REDACTED_GOOGLE_KEY***'); // Google/GCP API keys
        expect(redacted).toContain('***REDACTED_CLIENT_SECRET***');
        expect(redacted).toContain('***REDACTED_PASSWORD***');

        // Verify original secrets not present
        expect(redacted).not.toContain('pass@host');
        expect(redacted).not.toContain('AbCdEfGh123456789IjKlMnOpQrStUvWxYz==');
        expect(redacted).not.toContain('xyz789abcdef123456789');
        expect(redacted).not.toContain('secret123');
      });
    });
  });
});
