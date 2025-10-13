import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ValidationFeedback } from '../validation-feedback';
import type { ParseResult } from '@/lib/validation/dsl-parser';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

describe('ValidationFeedback - Accessibility (PRD-010d)', () => {
  describe('ARIA Attributes', () => {
    it('has role="status" and aria-live="polite" for validating state', () => {
      const { container } = render(
        <ValidationFeedback validation={null} isValidating={true} />
      );

      const alert = container.querySelector('[role="status"]');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('aria-live', 'polite');
      expect(alert).toHaveAttribute('aria-label', 'Validating DSL expression');
    });

    it('has role="status" and aria-live="polite" for valid state', () => {
      const validation: ParseResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const alert = container.querySelector('[role="status"]');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('aria-live', 'polite');
      expect(alert).toHaveAttribute('aria-label', 'DSL expression is valid');
    });

    it('has role="alert" and aria-live="assertive" for error state', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Test error',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('marks decorative icons as aria-hidden', () => {
      const validation: ParseResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('provides aria-label for error region with singular error', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Error 1',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const region = container.querySelector('[role="region"]');
      expect(region).toHaveAttribute('aria-label', '1 syntax error found');
    });

    it('provides aria-label for error region with multiple errors', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Error 1',
            severity: 'error',
          },
          {
            line: 2,
            column: 3,
            endLine: 2,
            endColumn: 8,
            message: 'Error 2',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const region = container.querySelector('[role="region"]');
      expect(region).toHaveAttribute('aria-label', '2 syntax errors found');
    });

    it('provides aria-label for warnings summary with singular warning', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [],
        warnings: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Warning 1',
            severity: 'warning',
          },
        ],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const summary = container.querySelector('summary');
      expect(summary).toHaveAttribute('aria-label', '1 warning (click to expand)');
    });

    it('provides aria-label for warnings summary with multiple warnings', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [],
        warnings: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Warning 1',
            severity: 'warning',
          },
          {
            line: 2,
            column: 3,
            endLine: 2,
            endColumn: 8,
            message: 'Warning 2',
            severity: 'warning',
          },
        ],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const summary = container.querySelector('summary');
      expect(summary).toHaveAttribute('aria-label', '2 warnings (click to expand)');
    });

    it('uses role="list" for warnings container', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [],
        warnings: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Warning 1',
            severity: 'warning',
          },
        ],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const list = container.querySelector('[role="list"]');
      expect(list).toBeInTheDocument();
    });

    it('uses role="listitem" for each warning', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [],
        warnings: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Warning 1',
            severity: 'warning',
          },
          {
            line: 2,
            column: 3,
            endLine: 2,
            endColumn: 8,
            message: 'Warning 2',
            severity: 'warning',
          },
        ],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const listitems = container.querySelectorAll('[role="listitem"]');
      expect(listitems).toHaveLength(2);
    });

    it('provides aria-label for code examples', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [],
        warnings: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Warning 1',
            severity: 'warning',
            example: 'trace.has(example)',
          },
        ],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const codeExample = container.querySelector('pre');
      expect(codeExample).toHaveAttribute('aria-label', 'Code example');
    });
  });

  describe('WCAG 2.1 AA Compliance (axe-core)', () => {
    it('passes axe audit for validating state', async () => {
      const { container } = render(
        <ValidationFeedback validation={null} isValidating={true} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe audit for valid state', async () => {
      const validation: ParseResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe audit for error state', async () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Test error',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe audit for multiple errors', async () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Error 1',
            severity: 'error',
          },
          {
            line: 2,
            column: 3,
            endLine: 2,
            endColumn: 8,
            message: 'Error 2',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe audit for warnings', async () => {
      const validation: ParseResult = {
        valid: false,
        errors: [],
        warnings: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Warning 1',
            severity: 'warning',
          },
        ],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe audit for errors and warnings together', async () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Error 1',
            severity: 'error',
          },
        ],
        warnings: [
          {
            line: 2,
            column: 3,
            endLine: 2,
            endColumn: 8,
            message: 'Warning 1',
            severity: 'warning',
          },
        ],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Security Integration (PRD-010d)', () => {
    it('sanitizes and redacts error messages with sensitive data', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Invalid token: sk_live_abc123xyz',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      render(<ValidationFeedback validation={validation} isValidating={false} />);

      // Should not show the actual API key
      expect(screen.queryByText(/sk_live_abc123xyz/)).not.toBeInTheDocument();
      // Should show redacted version
      expect(screen.getByText(/REDACTED_API_KEY/)).toBeInTheDocument();
    });

    it('sanitizes XSS attempts in error messages', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: '<script>alert("XSS")</script>',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      const { container } = render(
        <ValidationFeedback validation={validation} isValidating={false} />
      );

      // Should not contain actual script tag
      expect(container.querySelector('script')).not.toBeInTheDocument();
      // Should contain escaped HTML (React double-escapes: &amp;lt; not &lt;)
      expect(container.innerHTML).toContain('&amp;lt;script&amp;gt;');
    });
  });
});
