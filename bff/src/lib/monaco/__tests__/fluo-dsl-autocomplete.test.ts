import { describe, it, expect } from 'vitest';
import { betraceDslAutocompleteProvider, registerBeTraceDslAutocomplete } from '../betrace-dsl-autocomplete';

describe('BeTrace DSL Autocomplete Provider', () => {
  const createMockModel = (value: string) => ({
    getValueInRange: () => value,
  });

  const createMockPosition = (lineNumber: number, column: number) => ({
    lineNumber,
    column,
  });

  it('provides keyword suggestions', () => {
    const model = createMockModel('');
    const position = createMockPosition(1, 1);

    const result = betraceDslAutocompleteProvider.provideCompletionItems(model as any, position as any, {} as any, {} as any);

    expect(result.suggestions).toBeDefined();
    const labels = result.suggestions.map((s: any) => s.label);
    expect(labels).toContain('trace');
    expect(labels).toContain('has');
    expect(labels).toContain('where');
    expect(labels).toContain('count');
    expect(labels).toContain('and');
    expect(labels).toContain('or');
    expect(labels).toContain('not');
  });

  it('provides operator suggestions', () => {
    const model = createMockModel('');
    const position = createMockPosition(1, 1);

    const result = betraceDslAutocompleteProvider.provideCompletionItems(model as any, position as any, {} as any, {} as any);

    const labels = result.suggestions.map((s: any) => s.label);
    expect(labels).toContain('==');
    expect(labels).toContain('!=');
    expect(labels).toContain('>');
    expect(labels).toContain('>=');
    expect(labels).toContain('<');
    expect(labels).toContain('<=');
    expect(labels).toContain('in');
    expect(labels).toContain('matches');
  });

  it('provides context-aware suggestions after "trace."', () => {
    const model = createMockModel('trace.');
    const position = createMockPosition(1, 7);

    const result = betraceDslAutocompleteProvider.provideCompletionItems(model as any, position as any, {} as any, {} as any);

    const labels = result.suggestions.map((s: any) => s.label);
    expect(labels).toContain('has');
    expect(labels).toContain('count');
    // Should not contain all keywords when after "trace."
    expect(labels.length).toBeLessThan(20);
  });

  it('provides snippet suggestions', () => {
    const model = createMockModel('');
    const position = createMockPosition(1, 1);

    const result = betraceDslAutocompleteProvider.provideCompletionItems(model as any, position as any, {} as any, {} as any);

    const snippetLabels = result.suggestions.map((s: any) => s.label);
    expect(snippetLabels).toContain('has-span');
    expect(snippetLabels).toContain('has-where');
    expect(snippetLabels).toContain('count-spans');
  });

  it('provides documentation for suggestions', () => {
    const model = createMockModel('trace.');
    const position = createMockPosition(1, 7);

    const result = betraceDslAutocompleteProvider.provideCompletionItems(model as any, position as any, {} as any, {} as any);

    const hasItem = result.suggestions.find((s: any) => s.label === 'has');
    expect(hasItem).toBeDefined();
    expect(hasItem?.documentation).toBeTruthy();
  });
});

describe('registerBeTraceDslAutocomplete', () => {
  it('is a function', () => {
    expect(typeof registerBeTraceDslAutocomplete).toBe('function');
  });

  it('accepts monaco parameter', () => {
    const mockMonaco = {
      languages: {
        registerCompletionItemProvider: () => {},
      },
    };

    expect(() => registerBeTraceDslAutocomplete(mockMonaco as any)).not.toThrow();
  });
});
