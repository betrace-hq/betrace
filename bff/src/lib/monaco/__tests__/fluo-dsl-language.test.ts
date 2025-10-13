import { describe, it, expect } from 'vitest';
import { fluoDslLanguage, registerFluoDslLanguage } from '../fluo-dsl-language';

describe('FLUO DSL Language Configuration', () => {
  it('has correct language ID', () => {
    expect(fluoDslLanguage.id).toBe('fluo-dsl');
  });

  it('includes all keywords', () => {
    const expectedKeywords = ['trace', 'has', 'where', 'count', 'and', 'or', 'not', 'true', 'false'];
    expect(fluoDslLanguage.keywords).toEqual(expectedKeywords);
  });

  it('includes all operators', () => {
    const expectedOperators = ['==', '!=', '>', '>=', '<', '<=', 'in', 'matches'];
    expect(fluoDslLanguage.operators).toEqual(expectedOperators);
  });

  it('includes builtin functions', () => {
    expect(fluoDslLanguage.builtinFunctions).toContain('trace.has');
    expect(fluoDslLanguage.builtinFunctions).toContain('trace.count');
  });

  it('has tokenizer configured', () => {
    expect(fluoDslLanguage.tokenizer).toBeDefined();
    expect(fluoDslLanguage.tokenizer.root).toBeDefined();
    expect(Array.isArray(fluoDslLanguage.tokenizer.root)).toBe(true);
  });

  it('has string tokenizer configured', () => {
    expect(fluoDslLanguage.tokenizer.string_double).toBeDefined();
  });

  it('has bracket pairs configured', () => {
    expect(fluoDslLanguage.brackets).toEqual([
      ['{', '}', 'bracket'],
      ['[', ']', 'bracket'],
      ['(', ')', 'bracket'],
    ]);
  });

  it('has auto-closing pairs configured', () => {
    expect(fluoDslLanguage.autoClosingPairs).toContainEqual({ open: '{', close: '}' });
    expect(fluoDslLanguage.autoClosingPairs).toContainEqual({ open: '[', close: ']' });
    expect(fluoDslLanguage.autoClosingPairs).toContainEqual({ open: '(', close: ')' });
    expect(fluoDslLanguage.autoClosingPairs).toContainEqual({ open: '"', close: '"' });
  });
});

describe('registerFluoDslLanguage', () => {
  it('is a function', () => {
    expect(typeof registerFluoDslLanguage).toBe('function');
  });

  it('accepts monaco parameter', () => {
    const mockMonaco = {
      languages: {
        register: () => {},
        setMonarchTokensProvider: () => {},
        setLanguageConfiguration: () => {},
      },
    };

    expect(() => registerFluoDslLanguage(mockMonaco as any)).not.toThrow();
  });
});
