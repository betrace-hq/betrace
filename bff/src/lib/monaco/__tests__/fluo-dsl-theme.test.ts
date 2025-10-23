import { describe, it, expect } from 'vitest';
import { betraceDslTheme, registerBeTraceDslTheme } from '../betrace-dsl-theme';

describe('BeTrace DSL Theme Configuration', () => {
  it('uses vs-dark as base theme', () => {
    expect(betraceDslTheme.base).toBe('vs-dark');
  });

  it('inherits from base theme', () => {
    expect(betraceDslTheme.inherit).toBe(true);
  });

  it('has token color rules defined', () => {
    expect(Array.isArray(betraceDslTheme.rules)).toBe(true);
    expect(betraceDslTheme.rules.length).toBeGreaterThan(0);
  });

  it('has keyword token rule', () => {
    const keywordRule = betraceDslTheme.rules.find((r) => r.token === 'keyword');
    expect(keywordRule).toBeDefined();
    expect(keywordRule?.foreground).toBe('C586C0'); // Purple
    expect(keywordRule?.fontStyle).toBe('bold');
  });

  it('has operator token rule', () => {
    const operatorRule = betraceDslTheme.rules.find((r) => r.token === 'operator');
    expect(operatorRule).toBeDefined();
    expect(operatorRule?.foreground).toBe('D4D4D4'); // Light gray
  });

  it('has string token rule', () => {
    const stringRule = betraceDslTheme.rules.find((r) => r.token === 'string');
    expect(stringRule).toBeDefined();
    expect(stringRule?.foreground).toBe('CE9178'); // Orange
  });

  it('has number token rules', () => {
    const numberRule = betraceDslTheme.rules.find((r) => r.token === 'number');
    expect(numberRule).toBeDefined();
    expect(numberRule?.foreground).toBe('B5CEA8'); // Green
  });

  it('has comment token rule', () => {
    const commentRule = betraceDslTheme.rules.find((r) => r.token === 'comment');
    expect(commentRule).toBeDefined();
    expect(commentRule?.foreground).toBe('6A9955'); // Muted green
    expect(commentRule?.fontStyle).toBe('italic');
  });

  it('has identifier token rule', () => {
    const identifierRule = betraceDslTheme.rules.find((r) => r.token === 'identifier');
    expect(identifierRule).toBeDefined();
    expect(identifierRule?.foreground).toBe('9CDCFE'); // Light blue
  });

  it('has editor colors configured', () => {
    expect(betraceDslTheme.colors).toBeDefined();
    expect(betraceDslTheme.colors['editor.background']).toBe('#1e1e1e');
    expect(betraceDslTheme.colors['editor.foreground']).toBe('#d4d4d4');
  });
});

describe('registerBeTraceDslTheme', () => {
  it('is a function', () => {
    expect(typeof registerBeTraceDslTheme).toBe('function');
  });

  it('accepts monaco parameter', () => {
    const mockMonaco = {
      editor: {
        defineTheme: () => {},
      },
    };

    expect(() => registerBeTraceDslTheme(mockMonaco as any)).not.toThrow();
  });
});
