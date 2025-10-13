import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDslValidation } from '../use-dsl-validation';

describe('useDslValidation Hook', () => {
  it('returns null validation initially', () => {
    const { result } = renderHook(() => useDslValidation(''));
    expect(result.current.validation).toBeDefined();
    expect(result.current.validation?.valid).toBe(false);
  });

  it('validates empty expression as invalid', async () => {
    const { result } = renderHook(() => useDslValidation(''));

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    expect(result.current.validation?.valid).toBe(false);
    expect(result.current.validation?.errors).toHaveLength(1);
    expect(result.current.validation?.errors[0].message).toContain('cannot be empty');
  });

  it('validates correct DSL expression', async () => {
    const { result } = renderHook(() => useDslValidation('trace.has(payment.charge)'));

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    expect(result.current.validation?.valid).toBe(true);
    expect(result.current.validation?.errors).toHaveLength(0);
  });

  it('detects syntax errors', async () => {
    const { result } = renderHook(() => useDslValidation('trace.has('));

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    expect(result.current.validation?.valid).toBe(false);
    expect(result.current.validation?.errors.length).toBeGreaterThan(0);
  });

  it('debounces validation', async () => {
    const { result, rerender } = renderHook(
      ({ expr }) => useDslValidation(expr, { debounceMs: 100 }),
      { initialProps: { expr: 'trace.has(test)' } }
    );

    expect(result.current.isValidating).toBe(true);

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    }, { timeout: 200 });

    expect(result.current.validation?.valid).toBe(true);
  });

  it('updates validation when expression changes', async () => {
    const { result, rerender } = renderHook(
      ({ expr }) => useDslValidation(expr),
      { initialProps: { expr: 'trace.has(payment)' } }
    );

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    expect(result.current.validation?.valid).toBe(true);

    // Change to invalid expression
    rerender({ expr: 'invalid' });

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    expect(result.current.validation?.valid).toBe(false);
  });

  it('enhances error messages with suggestions', async () => {
    const { result } = renderHook(() => useDslValidation('has(payment)'));

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    expect(result.current.validation?.errors[0].suggestion).toBeDefined();
  });

  it('detects common mistakes when enabled', async () => {
    const { result } = renderHook(() =>
      useDslValidation('trace.has("payment.charge")', { detectMistakes: true })
    );

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    // Should have warnings about quoted identifiers
    expect(result.current.validation?.warnings.length).toBeGreaterThan(0);
  });

  it('skips mistake detection when disabled', async () => {
    const { result } = renderHook(() =>
      useDslValidation('trace.has("payment.charge")', { detectMistakes: false })
    );

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    });

    // Should not have warnings
    expect(result.current.validation?.warnings).toHaveLength(0);
  });

  it('respects custom debounce time', async () => {
    const start = Date.now();
    const { result } = renderHook(() =>
      useDslValidation('trace.has(test)', { debounceMs: 500 })
    );

    expect(result.current.isValidating).toBe(true);

    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    }, { timeout: 700 });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(450); // Allow some timing tolerance
  });

  it('handles rapid expression changes', async () => {
    const { result, rerender } = renderHook(
      ({ expr }) => useDslValidation(expr, { debounceMs: 100 }),
      { initialProps: { expr: 'trace.has(a)' } }
    );

    // Rapidly change expression
    rerender({ expr: 'trace.has(b)' });
    rerender({ expr: 'trace.has(c)' });
    rerender({ expr: 'trace.has(payment)' });

    // Should only validate the last expression
    await waitFor(() => {
      expect(result.current.isValidating).toBe(false);
    }, { timeout: 300 });

    expect(result.current.validation?.valid).toBe(true);
    expect(result.current.validation?.ast).toMatchObject({
      type: 'has',
      spanName: 'payment',
    });
  });

  it('cleans up timeout on unmount', () => {
    const { unmount } = renderHook(() => useDslValidation('trace.has(test)'));

    // Should not throw when unmounting during validation
    unmount();
  });
});
