import { describe, it, expect } from 'vitest';
import { fluoDslTheme, registerFluoDslTheme } from '../fluo-dsl-theme';

describe('FLUO DSL Theme Configuration', () => {
  it('uses vs-dark as base theme', () => {
    expect(fluoDslTheme.base).toBe('vs-dark');
  });

  it('inherits from base theme', () => {
    expect(fluoDslTheme.inherit).toBe(true);
  });

  it('has token color rules defined', () => {
    expect(Array.isArray(fluoDslTheme.rules)).toBe(true);
    expect(fluoDslTheme.rules.length).toBeGreaterThan(0);
  });

  it('has keyword token rule', () => {
    const keywordRule = fluoDslTheme.rules.find((r) => r.token === 'keyword');
    expect(keywordRule).toBeDefined();
    expect(keywordRule?.foreground).toBe('C586C0'); // Purple
    expect(keywordRule?.fontStyle).toBe('bold');
  });

  it('has operator token rule', () => {
    const operatorRule = fluoDslTheme.rules.find((r) => r.token === 'operator');
    expect(operatorRule).toBeDefined();
    expect(operatorRule?.foreground).toBe('D4D4D4'); // Light gray
  });

  it('has string token rule', () => {
    const stringRule = fluoDslTheme.rules.find((r) => r.token === 'string');
    expect(stringRule).toBeDefined();
    expect(stringRule?.foreground).toBe('CE9178'); // Orange
  });

  it('has number token rules', () => {
    const numberRule = fluoDslTheme.rules.find((r) => r.token === 'number');
    expect(numberRule).toBeDefined();
    expect(numberRule?.foreground).toBe('B5CEA8'); // Green
  });

  it('has comment token rule', () => {
    const commentRule = fluoDslTheme.rules.find((r) => r.token === 'comment');
    expect(commentRule).toBeDefined();
    expect(commentRule?.foreground).toBe('6A9955'); // Muted green
    expect(commentRule?.fontStyle).toBe('italic');
  });

  it('has identifier token rule', () => {
    const identifierRule = fluoDslTheme.rules.find((r) => r.token === 'identifier');
    expect(identifierRule).toBeDefined();
    expect(identifierRule?.foreground).toBe('9CDCFE'); // Light blue
  });

  it('has editor colors configured', () => {
    expect(fluoDslTheme.colors).toBeDefined();
    expect(fluoDslTheme.colors['editor.background']).toBe('#1e1e1e');
    expect(fluoDslTheme.colors['editor.foreground']).toBe('#d4d4d4');
  });
});

describe('registerFluoDslTheme', () => {
  it('is a function', () => {
    expect(typeof registerFluoDslTheme).toBe('function');
  });

  it('accepts monaco parameter', () => {
    const mockMonaco = {
      editor: {
        defineTheme: () => {},
      },
    };

    expect(() => registerFluoDslTheme(mockMonaco as any)).not.toThrow();
  });
});
