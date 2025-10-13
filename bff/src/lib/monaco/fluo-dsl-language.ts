import type * as Monaco from 'monaco-editor';

/**
 * FLUO DSL Language Definition for Monaco Editor
 *
 * Defines syntax highlighting, tokenization, and language features
 * for the FLUO Domain-Specific Language.
 *
 * @see https://microsoft.github.io/monaco-editor/monarch.html
 */

export interface FluoDslLanguage {
  id: string;
  keywords: string[];
  operators: string[];
  builtinFunctions: string[];
  tokenizer: Monaco.languages.IMonarchLanguage['tokenizer'];
  brackets: Monaco.languages.CharacterPair[];
  autoClosingPairs: Monaco.languages.IAutoClosingPair[];
}

/**
 * FLUO DSL Language Configuration
 *
 * Keywords: trace, has, where, count, and, or, not, true, false
 * Operators: ==, !=, >, >=, <, <=, in, matches
 * Functions: trace.has(), trace.count()
 */
export const fluoDslLanguage: FluoDslLanguage = {
  id: 'fluo-dsl',
  keywords: ['trace', 'has', 'where', 'count', 'and', 'or', 'not', 'true', 'false'],
  operators: ['==', '!=', '>', '>=', '<', '<=', 'in', 'matches'],
  builtinFunctions: ['trace.has', 'trace.count'],
  tokenizer: {
    root: [
      // Comments
      [/\/\/.*$/, 'comment'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // Unterminated string
      [/"/, 'string', '@string_double'],

      // Numbers
      [/\d+\.\d+([eE][-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],

      // Keywords
      [/\b(trace|has|where|count|and|or|not|true|false)\b/, 'keyword'],

      // Operators
      [/==|!=|>=|<=|>|<|in|matches/, 'operator'],

      // Identifiers
      [/[a-zA-Z_]\w*/, 'identifier'],

      // Brackets
      [/[{}()\[\]]/, 'bracket'],

      // Whitespace
      [/\s+/, ''],
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
  },
  brackets: [
    ['{', '}', 'bracket'],
    ['[', ']', 'bracket'],
    ['(', ')', 'bracket'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
};

/**
 * Registers FLUO DSL language with Monaco Editor
 *
 * Call this once when Monaco Editor is initialized.
 *
 * @param monaco - Monaco Editor global instance
 */
export function registerFluoDslLanguage(monaco: typeof Monaco): void {
  // Register the language ID
  monaco.languages.register({ id: fluoDslLanguage.id });

  // Set tokenization provider
  monaco.languages.setMonarchTokensProvider(fluoDslLanguage.id, {
    keywords: fluoDslLanguage.keywords,
    operators: fluoDslLanguage.operators,
    tokenizer: fluoDslLanguage.tokenizer,
  });

  // Set language configuration (brackets, auto-closing)
  monaco.languages.setLanguageConfiguration(fluoDslLanguage.id, {
    brackets: fluoDslLanguage.brackets,
    autoClosingPairs: fluoDslLanguage.autoClosingPairs,
    comments: {
      lineComment: '//',
    },
  });
}
