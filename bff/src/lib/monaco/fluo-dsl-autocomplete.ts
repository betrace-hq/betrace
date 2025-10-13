import type * as Monaco from 'monaco-editor';

/**
 * FLUO DSL Autocomplete Provider
 *
 * Provides context-aware IntelliSense suggestions for the FLUO DSL.
 * Includes keywords, operators, functions, and code snippets.
 */

/**
 * Autocomplete suggestion item
 */
interface CompletionItem {
  label: string;
  kind: Monaco.languages.CompletionItemKind;
  insertText: string;
  insertTextRules?: Monaco.languages.CompletionItemInsertTextRule;
  documentation?: string;
  detail?: string;
}

/**
 * Keyword suggestions
 */
const keywords: CompletionItem[] = [
  {
    label: 'trace',
    kind: 1, // Keyword
    insertText: 'trace',
    documentation: 'Reference to the current trace being evaluated',
  },
  {
    label: 'has',
    kind: 1,
    insertText: 'has',
    documentation: 'Check if trace contains a span matching criteria',
  },
  {
    label: 'where',
    kind: 1,
    insertText: 'where',
    documentation: 'Filter spans by attribute conditions',
  },
  {
    label: 'count',
    kind: 1,
    insertText: 'count',
    documentation: 'Count spans matching criteria',
  },
  {
    label: 'and',
    kind: 1,
    insertText: 'and',
    documentation: 'Logical AND operator',
  },
  {
    label: 'or',
    kind: 1,
    insertText: 'or',
    documentation: 'Logical OR operator',
  },
  {
    label: 'not',
    kind: 1,
    insertText: 'not',
    documentation: 'Logical NOT operator',
  },
  {
    label: 'true',
    kind: 1,
    insertText: 'true',
    documentation: 'Boolean true value',
  },
  {
    label: 'false',
    kind: 1,
    insertText: 'false',
    documentation: 'Boolean false value',
  },
];

/**
 * Operator suggestions
 */
const operators: CompletionItem[] = [
  {
    label: '==',
    kind: 12, // Operator
    insertText: '==',
    documentation: 'Equality comparison',
  },
  {
    label: '!=',
    kind: 12,
    insertText: '!=',
    documentation: 'Inequality comparison',
  },
  {
    label: '>',
    kind: 12,
    insertText: '>',
    documentation: 'Greater than',
  },
  {
    label: '>=',
    kind: 12,
    insertText: '>=',
    documentation: 'Greater than or equal',
  },
  {
    label: '<',
    kind: 12,
    insertText: '<',
    documentation: 'Less than',
  },
  {
    label: '<=',
    kind: 12,
    insertText: '<=',
    documentation: 'Less than or equal',
  },
  {
    label: 'in',
    kind: 12,
    insertText: 'in',
    documentation: 'Check if value exists in collection',
  },
  {
    label: 'matches',
    kind: 12,
    insertText: 'matches',
    documentation: 'Regex pattern matching',
  },
];

/**
 * Function suggestions (context-aware after "trace.")
 */
const traceFunctions: CompletionItem[] = [
  {
    label: 'has',
    kind: 2, // Method
    insertText: 'has($0)',
    insertTextRules: 4, // InsertAsSnippet
    documentation: 'Check if trace contains a span matching criteria',
    detail: 'trace.has(span_type)',
  },
  {
    label: 'count',
    kind: 2,
    insertText: 'count($0)',
    insertTextRules: 4,
    documentation: 'Count spans matching criteria',
    detail: 'trace.count(span_type)',
  },
];

/**
 * Code snippet suggestions
 */
const snippets: CompletionItem[] = [
  {
    label: 'has-span',
    kind: 15, // Snippet
    insertText: 'trace.has(${1:span_name})',
    insertTextRules: 4,
    documentation: 'Check if trace has a specific span',
    detail: 'Snippet: trace.has(span_name)',
  },
  {
    label: 'has-where',
    kind: 15,
    insertText: 'trace.has(${1:span_name}).where(${2:attribute} == "${3:value}")',
    insertTextRules: 4,
    documentation: 'Check if trace has span with attribute condition',
    detail: 'Snippet: trace.has(span_name).where(attr == "value")',
  },
  {
    label: 'count-spans',
    kind: 15,
    insertText: 'trace.count(${1:span_name}) ${2|>,>=,==,!=,<,<=|} ${3:threshold}',
    insertTextRules: 4,
    documentation: 'Count spans and compare to threshold',
    detail: 'Snippet: trace.count(span_name) > threshold',
  },
  {
    label: 'and-condition',
    kind: 15,
    insertText: '${1:condition1} and ${2:condition2}',
    insertTextRules: 4,
    documentation: 'Combine conditions with AND',
    detail: 'Snippet: condition1 and condition2',
  },
  {
    label: 'or-condition',
    kind: 15,
    insertText: '${1:condition1} or ${2:condition2}',
    insertTextRules: 4,
    documentation: 'Combine conditions with OR',
    detail: 'Snippet: condition1 or condition2',
  },
];

/**
 * Monaco Autocomplete Provider for FLUO DSL
 *
 * Provides context-aware suggestions:
 * - After "trace." → only show methods (has, count)
 * - Otherwise → show all keywords, operators, snippets
 */
export const fluoDslAutocompleteProvider: Monaco.languages.CompletionItemProvider = {
  provideCompletionItems: (model, position, _context, _token) => {
    // Get text before cursor to determine context
    const textBeforeCursor = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    const suggestions: CompletionItem[] = [];

    // Context-aware: after "trace." only show methods
    if (textBeforeCursor.endsWith('trace.')) {
      suggestions.push(...traceFunctions);
    } else {
      // Show all suggestions
      suggestions.push(...keywords, ...operators, ...snippets);
    }

    return { suggestions };
  },
};

/**
 * Registers FLUO DSL autocomplete provider with Monaco Editor
 *
 * Call this once when Monaco Editor is initialized.
 *
 * @param monaco - Monaco Editor global instance
 */
export function registerFluoDslAutocomplete(monaco: typeof Monaco): void {
  monaco.languages.registerCompletionItemProvider('fluo-dsl', fluoDslAutocompleteProvider);
}
