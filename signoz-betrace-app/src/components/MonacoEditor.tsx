/**
 * Monaco Editor Component for BeTraceDSL
 *
 * Features:
 * - Syntax highlighting for BeTraceDSL
 * - Autocomplete for span attributes, operators, functions
 * - Real-time DSL validation
 * - Error markers and diagnostics
 */

import { useEffect, useRef } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

export interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onValidate?: (isValid: boolean, errors: string[]) => void;
  height?: string;
  readOnly?: boolean;
  theme?: 'vs-dark' | 'vs-light';
}

// BeTraceDSL language configuration
const beTraceDSLConfig: monaco.languages.LanguageConfiguration = {
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
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};

// BeTraceDSL syntax highlighting
const beTraceDSLTokensProvider: monaco.languages.IMonarchLanguage = {
  keywords: [
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'CONTAINS', 'MATCHES',
    'true', 'false', 'null',
  ],
  operators: [
    '==', '!=', '>', '<', '>=', '<=',
    '+', '-', '*', '/', '%',
  ],
  tokenizer: {
    root: [
      // Keywords
      [/\b(AND|OR|NOT|IN|EXISTS|CONTAINS|MATCHES)\b/, 'keyword'],

      // Boolean literals
      [/\b(true|false|null)\b/, 'constant.language'],

      // Span attributes (span.*, trace.*, resource.*)
      [/\b(span|trace|resource)\.[a-zA-Z_][a-zA-Z0-9_.]*\b/, 'variable.other'],

      // Numbers
      [/\b\d+\.?\d*\b/, 'number'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],

      // Operators
      [/[=><!~?:&|+\-*\/\^%]+/, 'operator'],

      // Delimiters
      [/[{}()\[\]]/, '@brackets'],
      [/[;,.]/, 'delimiter'],

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

// Autocomplete suggestions
const autocompleteProvider: monaco.languages.CompletionItemProvider = {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    const suggestions: monaco.languages.CompletionItem[] = [
      // Span attributes
      {
        label: 'span.duration',
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: 'span.duration',
        detail: 'Span duration in nanoseconds',
        range,
      },
      {
        label: 'span.name',
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: 'span.name',
        detail: 'Span operation name',
        range,
      },
      {
        label: 'span.status.code',
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: 'span.status.code',
        detail: 'Span status code (0=OK, 1=ERROR, 2=UNSET)',
        range,
      },
      {
        label: 'span.attributes[""]',
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: 'span.attributes["${1:key}"]$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'Span attribute by key',
        range,
      },

      // Common attributes
      {
        label: 'http.status_code',
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: 'span.attributes["http.status_code"]',
        detail: 'HTTP status code (e.g., 200, 404, 500)',
        range,
      },
      {
        label: 'http.method',
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: 'span.attributes["http.method"]',
        detail: 'HTTP method (GET, POST, PUT, etc.)',
        range,
      },
      {
        label: 'db.system',
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: 'span.attributes["db.system"]',
        detail: 'Database system (postgresql, mysql, mongodb, etc.)',
        range,
      },
      {
        label: 'db.statement',
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: 'span.attributes["db.statement"]',
        detail: 'Database query statement',
        range,
      },

      // Operators
      {
        label: 'AND',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'AND ',
        detail: 'Logical AND',
        range,
      },
      {
        label: 'OR',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'OR ',
        detail: 'Logical OR',
        range,
      },
      {
        label: 'NOT',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'NOT ',
        detail: 'Logical NOT',
        range,
      },
      {
        label: 'EXISTS',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'EXISTS',
        detail: 'Check if attribute exists',
        range,
      },
      {
        label: 'CONTAINS',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'CONTAINS "${1:substring}"$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'Check if string contains substring',
        range,
      },
      {
        label: 'MATCHES',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'MATCHES "${1:regex}"$0',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: 'Match against regular expression',
        range,
      },

      // Example patterns
      {
        label: 'slow-query',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'span.duration > 1000 AND span.attributes["db.system"] EXISTS',
        detail: 'Example: Detect slow database queries',
        range,
      },
      {
        label: 'http-error',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'span.attributes["http.status_code"] >= 400',
        detail: 'Example: Detect HTTP errors',
        range,
      },
      {
        label: 'unauthorized',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'span.attributes["http.status_code"] == 401',
        detail: 'Example: Detect unauthorized access',
        range,
      },
    ];

    return { suggestions };
  },
};

export function MonacoEditor({
  value,
  onChange,
  onValidate,
  height = '200px',
  readOnly = false,
  theme = 'vs-light',
}: MonacoEditorProps) {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Validate DSL
  const validateDSL = (code: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Basic validation rules
    if (!code.trim()) {
      return { isValid: false, errors: ['DSL cannot be empty'] };
    }

    // Check for balanced brackets
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack: string[] = [];

    for (const char of code) {
      if (char in brackets) {
        stack.push(brackets[char as keyof typeof brackets]);
      } else if (Object.values(brackets).includes(char)) {
        if (stack.pop() !== char) {
          errors.push('Unbalanced brackets');
          break;
        }
      }
    }

    if (stack.length > 0) {
      errors.push('Unclosed brackets');
    }

    // Check for valid attribute references
    if (code.includes('span.attributes[') && !code.match(/span\.attributes\["[^"]+"\]/)) {
      errors.push('Invalid span.attributes syntax. Use: span.attributes["key"]');
    }

    // Check for unknown keywords
    const validKeywords = ['AND', 'OR', 'NOT', 'IN', 'EXISTS', 'CONTAINS', 'MATCHES', 'true', 'false', 'null'];
    const words = code.split(/\s+/);

    for (const word of words) {
      if (word.match(/^[A-Z]+$/) && !validKeywords.includes(word)) {
        errors.push(`Unknown keyword: ${word}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    // Register BeTraceDSL language
    monaco.languages.register({ id: 'betrace-dsl' });
    monaco.languages.setMonarchTokensProvider('betrace-dsl', beTraceDSLTokensProvider);
    monaco.languages.setLanguageConfiguration('betrace-dsl', beTraceDSLConfig);
    monaco.languages.registerCompletionItemProvider('betrace-dsl', autocompleteProvider);

    // Validate on change
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      const { isValid, errors } = validateDSL(value);

      // Set error markers
      if (!isValid && errors.length > 0) {
        const model = editor.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'betrace-dsl', [
            {
              severity: monaco.MarkerSeverity.Error,
              message: errors.join('; '),
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 1,
              endColumn: 1000,
            },
          ]);
        }
      } else {
        const model = editor.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'betrace-dsl', []);
        }
      }

      onValidate?.(isValid, errors);
    });

    // Initial validation
    const { isValid, errors } = validateDSL(value);
    onValidate?.(isValid, errors);
  };

  const handleEditorChange = (value: string | undefined) => {
    onChange?.(value || '');
  };

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      <Editor
        height={height}
        language="betrace-dsl"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={theme}
        options={{
          minimap: { enabled: false },
          readOnly,
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
        }}
      />
    </div>
  );
}
