import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValidationFeedback } from '../validation-feedback';
import type { ParseResult } from '@/lib/validation/dsl-parser';

describe('ValidationFeedback - Error Recovery UX (PRD-010d Phase 3)', () => {
  describe('Priority Indicators', () => {
    it('shows "FIX THIS FIRST" badge on first error only', () => {
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

      render(<ValidationFeedback validation={validation} isValidating={false} />);

      expect(screen.getByText('🎯 FIX THIS FIRST')).toBeInTheDocument();

      // Should only appear once
      const badges = screen.getAllByText('🎯 FIX THIS FIRST');
      expect(badges).toHaveLength(1);
    });

    it('does not show badge when only one error exists', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Single error',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      render(<ValidationFeedback validation={validation} isValidating={false} />);

      // Badge still shows for single error (helps with consistency)
      expect(screen.getByText('🎯 FIX THIS FIRST')).toBeInTheDocument();
    });

    it('shows tip when multiple errors exist', () => {
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

      render(<ValidationFeedback validation={validation} isValidating={false} />);

      expect(screen.getByText(/Fix errors one at a time/i)).toBeInTheDocument();
      expect(screen.getByText(/Fixing early errors may resolve later ones/i)).toBeInTheDocument();
    });

    it('does not show tip when only one error exists', () => {
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'Single error',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      render(<ValidationFeedback validation={validation} isValidating={false} />);

      expect(screen.queryByText(/Fix errors one at a time/i)).not.toBeInTheDocument();
    });
  });

  describe('Fix This Button', () => {
    it('shows "Fix This" button when onFixError callback provided', () => {
      const onFixError = vi.fn();
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

      render(
        <ValidationFeedback
          validation={validation}
          isValidating={false}
          onFixError={onFixError}
        />
      );

      expect(screen.getByRole('button', { name: /Jump to error/i })).toBeInTheDocument();
    });

    it('does not show "Fix This" button when no callback provided', () => {
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

      render(<ValidationFeedback validation={validation} isValidating={false} />);

      expect(screen.queryByRole('button', { name: /Jump to error/i })).not.toBeInTheDocument();
    });

    it('calls onFixError with line and column when button clicked', async () => {
      const user = userEvent.setup();
      const onFixError = vi.fn();
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 5,
            column: 12,
            endLine: 5,
            endColumn: 20,
            message: 'Test error',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      render(
        <ValidationFeedback
          validation={validation}
          isValidating={false}
          onFixError={onFixError}
        />
      );

      const button = screen.getByRole('button', { name: /Jump to error at line 5, column 12/i });
      await user.click(button);

      expect(onFixError).toHaveBeenCalledWith({ line: 5, column: 12 });
      expect(onFixError).toHaveBeenCalledTimes(1);
    });

    it('shows "Fix This" button for each error', () => {
      const onFixError = vi.fn();
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
          {
            line: 3,
            column: 7,
            endLine: 3,
            endColumn: 15,
            message: 'Error 3',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      render(
        <ValidationFeedback
          validation={validation}
          isValidating={false}
          onFixError={onFixError}
        />
      );

      const buttons = screen.getAllByRole('button', { name: /Jump to error/i });
      expect(buttons).toHaveLength(3);
    });

    it('calls onFixError with correct error data for each button', async () => {
      const user = userEvent.setup();
      const onFixError = vi.fn();
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

      render(
        <ValidationFeedback
          validation={validation}
          isValidating={false}
          onFixError={onFixError}
        />
      );

      // Click second error's button
      const button2 = screen.getByRole('button', { name: /Jump to error at line 2, column 3/i });
      await user.click(button2);

      expect(onFixError).toHaveBeenCalledWith({ line: 2, column: 3 });
    });

    it('has accessible aria-label on button', () => {
      const onFixError = vi.fn();
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 10,
            column: 15,
            endLine: 10,
            endColumn: 20,
            message: 'Test error',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      render(
        <ValidationFeedback
          validation={validation}
          isValidating={false}
          onFixError={onFixError}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Jump to error at line 10, column 15');
    });
  });

  describe('Combined Features', () => {
    it('shows both badge and button for first error', () => {
      const onFixError = vi.fn();
      const validation: ParseResult = {
        valid: false,
        errors: [
          {
            line: 1,
            column: 5,
            endLine: 1,
            endColumn: 10,
            message: 'First error',
            severity: 'error',
          },
          {
            line: 2,
            column: 3,
            endLine: 2,
            endColumn: 8,
            message: 'Second error',
            severity: 'error',
          },
        ],
        warnings: [],
      };

      render(
        <ValidationFeedback
          validation={validation}
          isValidating={false}
          onFixError={onFixError}
        />
      );

      // Badge on first error
      expect(screen.getByText('🎯 FIX THIS FIRST')).toBeInTheDocument();

      // Buttons on all errors
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });

    it('shows tip and buttons together for multiple errors', () => {
      const onFixError = vi.fn();
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

      render(
        <ValidationFeedback
          validation={validation}
          isValidating={false}
          onFixError={onFixError}
        />
      );

      // Tip visible
      expect(screen.getByText(/Fix errors one at a time/i)).toBeInTheDocument();

      // Buttons visible
      expect(screen.getAllByRole('button')).toHaveLength(2);

      // Badge visible
      expect(screen.getByText('🎯 FIX THIS FIRST')).toBeInTheDocument();
    });
  });
});
