/**
 * BeTraceDSL v2.0 Language Definition for Monaco Editor
 *
 * Provides syntax highlighting, autocomplete, and validation for the
 * when-always-never DSL with dotted span names and quoted attributes.
 */

import type * as monaco from 'monaco-editor';

/**
 * Language Configuration
 * Defines brackets, auto-closing pairs, and comments
 */
export const languageConfiguration: monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  folding: {
    markers: {
      start: /^\s*\{\s*$/,
      end: /^\s*\}\s*$/,
    },
  },
};

/**
 * Token Provider
 * Defines syntax highlighting rules for DSL v2.0
 */
export const tokenProvider: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.betrace-dsl',

  // Keywords
  keywords: [
    'when',
    'always',
    'never',
    'and',
    'or',
    'not',
    'where',
    'count',
    'in',
    'matches',
    'contains',
    'true',
    'false',
  ],

  // Operators
  operators: [
    '==', '!=', '<=', '>=', '<', '>', '=',
  ],

  // Token definitions
  tokenizer: {
    root: [
      // Keywords
      [/\b(when|always|never)\b/, 'keyword.control'],
      [/\b(and|or|not)\b/, 'keyword.operator'],
      [/\b(where|count|in|matches|contains)\b/, 'keyword.function'],

      // Booleans
      [/\b(true|false)\b/, 'constant.language.boolean'],

      // Dotted identifiers (operation names like payment.charge_card)
      [/[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+/, 'entity.name.type'],

      // Simple identifiers
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],

      // Numbers
      [/\d+\.?\d*/, 'number'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // Unclosed string
      [/'([^'\\]|\\.)*$/, 'string.invalid'], // Unclosed string
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],

      // Operators
      [/[=!<>]=?/, 'operator'],

      // Delimiters
      [/[{}()\[\]]/, '@brackets'],
      [/[,.]/, 'delimiter'],

      // Whitespace
      [/\s+/, 'white'],

      // Comments
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
    ],

    comment: [
      [/[^\/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[\/*]/, 'comment'],
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],

    string_single: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],
  },
};

/**
 * DSL v2.0 Autocomplete Suggestions
 */
export interface AutocompleteContext {
  position: monaco.Position;
  textBeforeCursor: string;
  currentWord: string;
}

/**
 * Generate autocomplete suggestions based on cursor context
 */
export function getAutocompleteSuggestions(
  monaco: typeof import('monaco-editor'),
  context: AutocompleteContext
): monaco.languages.CompletionItem[] {
  const { textBeforeCursor, currentWord } = context;
  const range = {
    startLineNumber: context.position.lineNumber,
    endLineNumber: context.position.lineNumber,
    startColumn: context.position.column - currentWord.length,
    endColumn: context.position.column,
  };

  const suggestions: monaco.languages.CompletionItem[] = [];

  // Top-level keywords (when, always, never)
  if (!textBeforeCursor.match(/\b(when|always|never)\s*\{/)) {
    suggestions.push(
      {
        label: 'when',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'when { ${1:condition} }',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'When clause: defines the trigger condition',
        range,
      },
      {
        label: 'always',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'always { ${1:condition} }',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Always clause: defines what must always be present',
        range,
      },
      {
        label: 'never',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'never { ${1:condition} }',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Never clause: defines what must never be present',
        range,
      }
    );
  }

  // Boolean operators
  if (textBeforeCursor.match(/\{\s*[a-zA-Z_.][\w.]*\s*$/)) {
    suggestions.push(
      {
        label: 'and',
        kind: monaco.languages.CompletionItemKind.Operator,
        insertText: 'and ',
        documentation: 'Logical AND operator',
        range,
      },
      {
        label: 'or',
        kind: monaco.languages.CompletionItemKind.Operator,
        insertText: 'or ',
        documentation: 'Logical OR operator',
        range,
      },
      {
        label: 'not',
        kind: monaco.languages.CompletionItemKind.Operator,
        insertText: 'not ',
        documentation: 'Logical NOT operator',
        range,
      }
    );
  }

  // Count function
  suggestions.push({
    label: 'count',
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: 'count(${1:span.name})',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Count spans matching the operation name',
    detail: 'count(operation_name) > N',
    range,
  });

  // Where clause
  if (textBeforeCursor.match(/[a-zA-Z_][\w.]*$/)) {
    suggestions.push({
      label: '.where',
      kind: monaco.languages.CompletionItemKind.Method,
      insertText: '.where(${1:condition})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Filter spans by attribute conditions',
      detail: '.where(attribute == value)',
      range,
    });
  }

  // Common operation name patterns
  const operationPatterns = [
    { label: 'http.request', doc: 'HTTP request span' },
    { label: 'http.response', doc: 'HTTP response span' },
    { label: 'database.query', doc: 'Database query span' },
    { label: 'payment.charge_card', doc: 'Payment charge operation' },
    { label: 'payment.fraud_check', doc: 'Fraud check operation' },
    { label: 'auth.check', doc: 'Authentication check' },
    { label: 'audit.log', doc: 'Audit log entry' },
    { label: 'agent.tool_use', doc: 'AI agent tool usage' },
    { label: 'agent.plan.created', doc: 'AI agent plan creation' },
    { label: 'pii.access', doc: 'PII data access' },
  ];

  operationPatterns.forEach((pattern) => {
    suggestions.push({
      label: pattern.label,
      kind: monaco.languages.CompletionItemKind.Class,
      insertText: pattern.label,
      documentation: pattern.doc,
      range,
    });
  });

  // Comparison operators (after where clause or attribute)
  if (textBeforeCursor.match(/where\([^)]*$/) || textBeforeCursor.match(/"[^"]*"\s*$/)) {
    const operators = [
      { op: '==', doc: 'Equal to' },
      { op: '!=', doc: 'Not equal to' },
      { op: '>', doc: 'Greater than' },
      { op: '<', doc: 'Less than' },
      { op: '>=', doc: 'Greater than or equal' },
      { op: '<=', doc: 'Less than or equal' },
      { op: 'in', doc: 'In list' },
      { op: 'matches', doc: 'Regex match' },
      { op: 'contains', doc: 'Substring match' },
    ];

    operators.forEach((operator) => {
      suggestions.push({
        label: operator.op,
        kind: monaco.languages.CompletionItemKind.Operator,
        insertText: operator.op + ' ',
        documentation: operator.doc,
        range,
      });
    });
  }

  // Quoted attribute names (for dotted attributes)
  if (textBeforeCursor.match(/where\(\s*$/)) {
    const quotedAttributes = [
      { attr: '"data.contains_pii"', doc: 'Check if data contains PII' },
      { attr: '"data.sensitive"', doc: 'Check if data is sensitive' },
      { attr: '"user.id"', doc: 'User identifier' },
      { attr: '"http.status_code"', doc: 'HTTP status code' },
      { attr: '"db.system"', doc: 'Database system name' },
    ];

    quotedAttributes.forEach((qa) => {
      suggestions.push({
        label: qa.attr,
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: qa.attr + ' == ',
        documentation: qa.doc,
        range,
      });
    });
  }

  return suggestions;
}

/**
 * Validate DSL v2.0 expression syntax
 * Returns diagnostics (errors/warnings) for the editor
 */
export function validateDSL(
  monaco: typeof import('monaco-editor'),
  text: string
): monaco.editor.IMarkerData[] {
  const markers: monaco.editor.IMarkerData[] = [];

  // Check for balanced braces
  const openBraces = (text.match(/\{/g) || []).length;
  const closeBraces = (text.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    });
  }

  // Check for balanced parentheses
  const openParens = (text.match(/\(/g) || []).length;
  const closeParens = (text.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
    });
  }

  // Check for required when clause
  if (!text.match(/\bwhen\s*\{/)) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Missing required "when" clause',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 10,
    });
  }

  // Check for at least one always or never clause
  const hasAlways = text.match(/\balways\s*\{/);
  const hasNever = text.match(/\bnever\s*\{/);
  if (!hasAlways && !hasNever) {
    markers.push({
      severity: monaco.MarkerSeverity.Warning,
      message: 'Rule should have at least one "always" or "never" clause',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 10,
    });
  }

  // Check for unclosed strings
  const unclosedDoubleQuote = text.match(/"[^"]*$/m);
  if (unclosedDoubleQuote) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: 'Unclosed string (missing closing ")',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 10,
    });
  }

  return markers;
}

/**
 * Register BeTraceDSL v2.0 language with Monaco
 */
export function registerDSLLanguage(monaco: typeof import('monaco-editor')) {
  // Register the language
  monaco.languages.register({ id: 'betrace-dsl' });

  // Set language configuration
  monaco.languages.setLanguageConfiguration('betrace-dsl', languageConfiguration);

  // Set token provider (syntax highlighting)
  monaco.languages.setMonarchTokensProvider('betrace-dsl', tokenProvider);

  // Register completion provider (autocomplete)
  monaco.languages.registerCompletionItemProvider('betrace-dsl', {
    provideCompletionItems: (model, position) => {
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const word = model.getWordUntilPosition(position);
      const currentWord = word.word;

      const suggestions = getAutocompleteSuggestions(monaco, {
        position,
        textBeforeCursor,
        currentWord,
      });

      return { suggestions };
    },
  });

  console.log('[Monaco] BeTraceDSL v2.0 language registered successfully');
}
