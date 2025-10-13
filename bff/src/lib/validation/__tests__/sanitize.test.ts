import { describe, it, expect } from 'vitest';
import {
  sanitizeErrorMessage,
  sanitizeTokenValue,
  OutputContext,
} from '../sanitize';

describe('Context-Aware Sanitization (PRD-010c)', () => {
  describe('HTML Context', () => {
    it('escapes HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      expect(result).not.toContain('<script>');
    });

    it('escapes ampersands', () => {
      const input = 'Tom & Jerry';
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      expect(result).toBe('Tom &amp; Jerry');
    });

    it('escapes single and double quotes', () => {
      const input = `It's a "test"`;
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      expect(result).toBe('It&#x27;s a &quot;test&quot;');
    });

    it('escapes forward slashes (prevent </script> bypass)', () => {
      const input = '</script>';
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      expect(result).toBe('&lt;&#x2F;script&gt;');
    });

    it('handles empty string', () => {
      const result = sanitizeErrorMessage('', OutputContext.HTML);
      expect(result).toBe('');
    });

    it('handles already-escaped entities', () => {
      const input = '&lt;script&gt;';
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      // Should double-escape (not idempotent, by design)
      expect(result).toBe('&amp;lt;script&amp;gt;');
    });
  });

  describe('JavaScript Context', () => {
    it('escapes backslashes', () => {
      const input = 'C:\\Users\\test';
      const result = sanitizeErrorMessage(input, OutputContext.JAVASCRIPT);

      expect(result).toBe('C:\\\\Users\\\\test');
    });

    it('escapes quotes', () => {
      const input = `He said "hello" and 'goodbye'`;
      const result = sanitizeErrorMessage(input, OutputContext.JAVASCRIPT);

      expect(result).toBe('He said \\"hello\\" and \\\'goodbye\\\'');
    });

    it('escapes newlines and control characters', () => {
      const input = 'Line1\nLine2\rLine3\tTab';
      const result = sanitizeErrorMessage(input, OutputContext.JAVASCRIPT);

      expect(result).toBe('Line1\\nLine2\\rLine3\\tTab');
    });

    it('prevents script tag injection', () => {
      const input = '</script>';
      const result = sanitizeErrorMessage(input, OutputContext.JAVASCRIPT);

      expect(result).toBe('<\\/script>');
      expect(result).not.toContain('</script>');
    });

    it('handles empty string', () => {
      const result = sanitizeErrorMessage('', OutputContext.JAVASCRIPT);
      expect(result).toBe('');
    });
  });

  describe('JSON Context', () => {
    it('escapes using JSON.stringify equivalence', () => {
      const input = 'Test "quotes" and \\ backslashes';
      const result = sanitizeErrorMessage(input, OutputContext.JSON);

      // JSON.stringify adds surrounding quotes, which we strip
      const expected = JSON.stringify(input).slice(1, -1);
      expect(result).toBe(expected);
    });

    it('handles newlines', () => {
      const input = 'Line1\nLine2';
      const result = sanitizeErrorMessage(input, OutputContext.JSON);

      expect(result).toBe('Line1\\nLine2');
    });

    it('handles Unicode characters', () => {
      const input = 'Hello 世界 🌍';
      const result = sanitizeErrorMessage(input, OutputContext.JSON);

      const expected = JSON.stringify(input).slice(1, -1);
      expect(result).toBe(expected);
    });

    it('handles empty string', () => {
      const result = sanitizeErrorMessage('', OutputContext.JSON);
      expect(result).toBe('');
    });
  });

  describe('Markdown Context', () => {
    it('escapes Markdown link syntax', () => {
      const input = '[Click here](javascript:alert(1))';
      const result = sanitizeErrorMessage(input, OutputContext.MARKDOWN);

      expect(result).toBe('\\[Click here\\]\\(javascript:alert\\(1\\)\\)');
      expect(result).not.toMatch(/\[.*\]\(.*\)/);
    });

    it('escapes HTML tags', () => {
      const input = '<script>alert(1)</script>';
      const result = sanitizeErrorMessage(input, OutputContext.MARKDOWN);

      expect(result).toContain('&lt;script&gt;');
    });

    it('escapes backslashes first', () => {
      const input = '\\[test\\]';
      const result = sanitizeErrorMessage(input, OutputContext.MARKDOWN);

      expect(result).toBe('\\\\\\[test\\\\\\]');
    });

    it('handles empty string', () => {
      const result = sanitizeErrorMessage('', OutputContext.MARKDOWN);
      expect(result).toBe('');
    });
  });

  describe('Default Context', () => {
    it('defaults to HTML context', () => {
      const input = '<script>alert(1)</script>';
      const resultDefault = sanitizeErrorMessage(input);
      const resultHTML = sanitizeErrorMessage(input, OutputContext.HTML);

      expect(resultDefault).toBe(resultHTML);
    });
  });

  describe('Token Value Sanitization', () => {
    it('truncates tokens longer than 50 characters', () => {
      const longToken = 'a'.repeat(100);
      const result = sanitizeTokenValue(longToken, OutputContext.HTML);

      expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(result).toContain('...');
    });

    it('does not truncate tokens under 50 characters', () => {
      const shortToken = 'a'.repeat(40);
      const result = sanitizeTokenValue(shortToken, OutputContext.HTML);

      expect(result).toBe(shortToken);
      expect(result).not.toContain('...');
    });

    it('sanitizes truncated token based on context', () => {
      const longToken = '<'.repeat(100);
      const result = sanitizeTokenValue(longToken, OutputContext.HTML);

      expect(result).toContain('&lt;');
      expect(result).not.toContain('<');
      expect(result).toContain('...');
    });

    it('handles exactly 50 characters', () => {
      const exactToken = 'a'.repeat(50);
      const result = sanitizeTokenValue(exactToken, OutputContext.HTML);

      expect(result).toBe(exactToken);
      expect(result).not.toContain('...');
    });

    it('handles 51 characters (boundary)', () => {
      const boundaryToken = 'a'.repeat(51);
      const result = sanitizeTokenValue(boundaryToken, OutputContext.HTML);

      expect(result).toBe('a'.repeat(50) + '...');
    });

    it('defaults to HTML context', () => {
      const token = '<script>alert(1)</script>';
      const resultDefault = sanitizeTokenValue(token);
      const resultHTML = sanitizeTokenValue(token, OutputContext.HTML);

      expect(resultDefault).toBe(resultHTML);
    });
  });

  describe('Real-world XSS Attack Vectors', () => {
    it('prevents XSS via event handlers', () => {
      const input = '<img src=x onerror=alert(1)>';
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      // HTML special chars are escaped, but 'onerror' and 'alert' text remain as-is
      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img');
      // The dangerous part is the HTML tags are escaped, preventing execution
    });

    it('prevents XSS via javascript: protocol', () => {
      const input = '[Click](javascript:alert(1))';
      const result = sanitizeErrorMessage(input, OutputContext.MARKDOWN);

      expect(result).not.toMatch(/\[.*\]\(javascript:/);
    });

    it('prevents XSS via data: protocol', () => {
      const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      expect(result).not.toContain('<a href=');
      expect(result).toContain('&lt;a');
    });

    it('prevents XSS via unicode escape sequences', () => {
      const input = '<script>\\u0061lert(1)</script>';
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      expect(result).not.toContain('<script>');
    });

    it('prevents XSS via HTML entity encoding', () => {
      const input = '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">';
      const result = sanitizeErrorMessage(input, OutputContext.HTML);

      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img');
    });
  });

  describe('Performance', () => {
    it('sanitizes large inputs quickly (<10ms)', () => {
      const largeInput = '<script>'.repeat(1000) + 'alert(1)' + '</script>'.repeat(1000);

      const start = Date.now();
      const result = sanitizeErrorMessage(largeInput, OutputContext.HTML);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(result).not.toContain('<script>');
    });

    it('handles 10,000 character inputs quickly', () => {
      const input = 'a'.repeat(10000);

      const start = Date.now();
      sanitizeErrorMessage(input, OutputContext.HTML);
      sanitizeErrorMessage(input, OutputContext.JAVASCRIPT);
      sanitizeErrorMessage(input, OutputContext.JSON);
      sanitizeErrorMessage(input, OutputContext.MARKDOWN);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});
