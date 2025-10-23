import { describe, it, expect } from 'vitest';
import { betraceDslLanguage, registerBeTraceDslLanguage } from '../betrace-dsl-language';

describe('BeTrace DSL Language Configuration', () => {
  it('has correct language ID', () => {
    expect(betraceDslLanguage.id).toBe('betrace-dsl');
  });

  it('includes all keywords', () => {
    const expectedKeywords = ['trace', 'has', 'where', 'count', 'and', 'or', 'not', 'true', 'false'];
    expect(betraceDslLanguage.keywords).toEqual(expectedKeywords);
  });

  it('includes all operators', () => {
    const expectedOperators = ['==', '!=', '>', '>=', '<', '<=', 'in', 'matches'];
    expect(betraceDslLanguage.operators).toEqual(expectedOperators);
  });

  it('includes builtin functions', () => {
    expect(betraceDslLanguage.builtinFunctions).toContain('trace.has');
    expect(betraceDslLanguage.builtinFunctions).toContain('trace.count');
  });

  it('has tokenizer configured', () => {
    expect(betraceDslLanguage.tokenizer).toBeDefined();
    expect(betraceDslLanguage.tokenizer.root).toBeDefined();
    expect(Array.isArray(betraceDslLanguage.tokenizer.root)).toBe(true);
  });

  it('has string tokenizer configured', () => {
    expect(betraceDslLanguage.tokenizer.string_double).toBeDefined();
  });

  it('has bracket pairs configured', () => {
    expect(betraceDslLanguage.brackets).toEqual([
      ['{', '}', 'bracket'],
      ['[', ']', 'bracket'],
      ['(', ')', 'bracket'],
    ]);
  });

  it('has auto-closing pairs configured', () => {
    expect(betraceDslLanguage.autoClosingPairs).toContainEqual({ open: '{', close: '}' });
    expect(betraceDslLanguage.autoClosingPairs).toContainEqual({ open: '[', close: ']' });
    expect(betraceDslLanguage.autoClosingPairs).toContainEqual({ open: '(', close: ')' });
    expect(betraceDslLanguage.autoClosingPairs).toContainEqual({ open: '"', close: '"' });
  });
});

describe('registerBeTraceDslLanguage', () => {
  it('is a function', () => {
    expect(typeof registerBeTraceDslLanguage).toBe('function');
  });

  it('accepts monaco parameter', () => {
    const mockMonaco = {
      languages: {
        register: () => {},
        setMonarchTokensProvider: () => {},
        setLanguageConfiguration: () => {},
      },
    };

    expect(() => registerBeTraceDslLanguage(mockMonaco as any)).not.toThrow();
  });
});
