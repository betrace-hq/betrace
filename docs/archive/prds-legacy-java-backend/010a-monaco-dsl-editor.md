# PRD-010a: Monaco Editor with BeTrace DSL Syntax Highlighting

**Parent PRD:** PRD-010 (Rule Management UI)
**Unit:** A
**Priority:** P0
**Dependencies:** None (foundation for other units)

## Scope

Replace the current `<Textarea>` rule expression editor with Monaco Editor featuring BeTrace DSL syntax highlighting, autocompletion, and language support.

**Current State:** The existing `rule-editor.tsx` uses a basic textarea with OGNL templates. BeTrace's actual DSL is trace-based (`trace.has()`, `trace.count()`), not OGNL object-graph navigation.

**Goal:** Professional code editor experience with:
- Syntax highlighting for BeTrace DSL keywords (`trace`, `has`, `where`, `count`, `and`, `or`, `not`)
- Auto-completion for operations, attributes, and comparison operators
- Bracket matching and indentation
- Error squiggles for syntax errors (integrated with validation from Unit B)

## Implementation

### Monaco Language Definition

Create BeTrace DSL language definition for Monaco:

```typescript
// src/lib/monaco/fluo-dsl-language.ts
import * as monaco from 'monaco-editor';

export const BeTrace_DSL_LANGUAGE_ID = 'fluo-dsl';

export const BeTrace_DSL_TOKENS: monaco.languages.IMonarchLanguage = {
  keywords: ['trace', 'has', 'where', 'count', 'and', 'or', 'not', 'true', 'false'],
  operators: ['==', '!=', '>', '>=', '<', '<=', 'in', 'matches'],
  tokenizer: {
    root: [
      // Keywords
      [/\b(trace|has|where|count|and|or|not|true|false)\b/, 'keyword'],

      // Operators
      [/==|!=|>=|<=|>|<|in|matches/, 'operator'],

      // Identifiers (operation names, attributes)
      [/[a-zA-Z_][a-zA-Z0-9_.]*/, 'identifier'],

      // Numbers
      [/\d+(\.\d+)?/, 'number'],

      // Strings (for regex patterns)
      [/"([^"\\]|\\.)*"/, 'string'],

      // Lists
      [/\[/, 'delimiter.bracket'],
      [/\]/, 'delimiter.bracket'],
      [/,/, 'delimiter.comma'],

      // Parentheses
      [/[()]/, 'delimiter.parenthesis'],

      // Whitespace
      [/\s+/, 'white'],
    ],
  },
};

export const BeTrace_DSL_THEME: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'C678DD', fontStyle: 'bold' },
    { token: 'operator', foreground: '56B6C2' },
    { token: 'identifier', foreground: 'E06C75' },
    { token: 'number', foreground: 'D19A66' },
    { token: 'string', foreground: '98C379' },
  ],
  colors: {},
};

export const BeTrace_DSL_AUTOCOMPLETE: monaco.languages.CompletionItemProvider = {
  provideCompletionItems: (model, position) => {
    const suggestions: monaco.languages.CompletionItem[] = [
      {
        label: 'trace.has',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'trace.has(${1:operation_name})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Check if trace contains a span with given operation name',
      },
      {
        label: 'trace.count',
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: 'trace.count(${1:operation_pattern})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Count spans matching pattern',
      },
      {
        label: '.where',
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: '.where(${1:attribute} ${2:==} ${3:value})',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Filter spans by attribute conditions',
      },
      // Logical operators
      { label: 'and', kind: monaco.languages.CompletionItemKind.Keyword },
      { label: 'or', kind: monaco.languages.CompletionItemKind.Keyword },
      { label: 'not', kind: monaco.languages.CompletionItemKind.Keyword },
      // Comparison operators
      { label: '==', kind: monaco.languages.CompletionItemKind.Operator },
      { label: '!=', kind: monaco.languages.CompletionItemKind.Operator },
      { label: '>', kind: monaco.languages.CompletionItemKind.Operator },
      { label: '>=', kind: monaco.languages.CompletionItemKind.Operator },
      { label: '<', kind: monaco.languages.CompletionItemKind.Operator },
      { label: '<=', kind: monaco.languages.CompletionItemKind.Operator },
      { label: 'in', kind: monaco.languages.CompletionItemKind.Operator },
      { label: 'matches', kind: monaco.languages.CompletionItemKind.Operator },
    ];

    return { suggestions };
  },
};

export function registerFluoDslLanguage() {
  // Register language
  monaco.languages.register({ id: BeTrace_DSL_LANGUAGE_ID });

  // Register tokens
  monaco.languages.setMonarchTokensProvider(BeTrace_DSL_LANGUAGE_ID, BeTrace_DSL_TOKENS);

  // Register theme
  monaco.editor.defineTheme('fluo-dsl-dark', BeTrace_DSL_THEME);

  // Register autocomplete
  monaco.languages.registerCompletionItemProvider(BeTrace_DSL_LANGUAGE_ID, BeTrace_DSL_AUTOCOMPLETE);
}
```

### Monaco Editor Component

```typescript
// src/components/rules/monaco-dsl-editor.tsx
import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { registerFluoDslLanguage, BeTrace_DSL_LANGUAGE_ID } from '@/lib/monaco/fluo-dsl-language';

interface MonacoDslEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (markers: monaco.editor.IMarker[]) => void;
  height?: string;
  readOnly?: boolean;
  className?: string;
}

export function MonacoDslEditor({
  value,
  onChange,
  onValidate,
  height = '200px',
  readOnly = false,
  className = '',
}: MonacoDslEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Register BeTrace DSL language once
    registerFluoDslLanguage();

    // Create editor
    const editor = monaco.editor.create(containerRef.current, {
      value,
      language: BeTrace_DSL_LANGUAGE_ID,
      theme: 'fluo-dsl-dark',
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      readOnly,
      fontSize: 14,
      fontFamily: 'monospace',
      tabSize: 2,
      insertSpaces: true,
      bracketPairColorization: { enabled: true },
    });

    editorRef.current = editor;

    // Handle value changes
    editor.onDidChangeModelContent(() => {
      const newValue = editor.getValue();
      onChange(newValue);
    });

    // Handle validation markers
    if (onValidate) {
      monaco.editor.onDidChangeMarkers(() => {
        const model = editor.getModel();
        if (model) {
          const markers = monaco.editor.getModelMarkers({ resource: model.uri });
          onValidate(markers);
        }
      });
    }

    // Cleanup
    return () => {
      editor.dispose();
    };
  }, []); // Only run once on mount

  // Update editor value when prop changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  // Update read-only mode
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, border: '1px solid #ccc', borderRadius: '4px' }}
    />
  );
}
```

### Update RuleEditor to Use Monaco

Replace the expression textarea in `rule-editor.tsx`:

```typescript
// In rule-editor.tsx, replace Textarea with MonacoDslEditor
import { MonacoDslEditor } from './monaco-dsl-editor';

// In the Editor tab:
<MonacoDslEditor
  value={formData.expression}
  onChange={(value) => setFormData({ ...formData, expression: value })}
  onValidate={(markers) => {
    // Integration point for Unit B validation
    console.log('Monaco markers:', markers);
  }}
  height="300px"
  className="font-mono"
/>
```

## Success Criteria

- [ ] Monaco editor renders with BeTrace DSL syntax highlighting
- [ ] Keywords (`trace`, `has`, `where`, `and`, `or`, `not`) are highlighted
- [ ] Operators (`==`, `!=`, `>`, `<`, `in`, `matches`) have distinct colors
- [ ] Auto-completion shows `trace.has()`, `trace.count()`, `.where()` suggestions
- [ ] Bracket matching works for parentheses and square brackets
- [ ] Editor is responsive and integrates with existing dark/light themes
- [ ] Validation markers can be set from external validation (Unit B integration point)

## Testing Requirements

### Unit Tests (Vitest)
```typescript
// src/lib/monaco/fluo-dsl-language.test.ts
describe('BeTrace DSL Language Registration', () => {
  it('registers language with Monaco', () => {
    registerFluoDslLanguage();
    const languages = monaco.languages.getLanguages();
    expect(languages.find(l => l.id === BeTrace_DSL_LANGUAGE_ID)).toBeDefined();
  });

  it('provides autocomplete suggestions', () => {
    const suggestions = BeTrace_DSL_AUTOCOMPLETE.provideCompletionItems(/* mock params */);
    expect(suggestions.suggestions).toContainEqual(
      expect.objectContaining({ label: 'trace.has' })
    );
  });
});

// src/components/rules/monaco-dsl-editor.test.tsx
describe('MonacoDslEditor', () => {
  it('renders Monaco editor', () => {
    render(<MonacoDslEditor value="" onChange={() => {}} />);
    expect(document.querySelector('.monaco-editor')).toBeInTheDocument();
  });

  it('calls onChange when value changes', async () => {
    const onChange = vi.fn();
    render(<MonacoDslEditor value="" onChange={onChange} />);
    // Simulate typing in editor
    // Verify onChange called with new value
  });

  it('updates editor when value prop changes', () => {
    const { rerender } = render(<MonacoDslEditor value="initial" onChange={() => {}} />);
    rerender(<MonacoDslEditor value="updated" onChange={() => {}} />);
    // Verify editor displays "updated"
  });
});
```

### Storybook Stories
```typescript
// src/stories/MonacoDslEditor.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MonacoDslEditor } from '@/components/rules/monaco-dsl-editor';

const meta: Meta<typeof MonacoDslEditor> = {
  title: 'Rules/Monaco DSL Editor',
  component: MonacoDslEditor,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MonacoDslEditor>;

export const Empty: Story = {
  args: {
    value: '',
    onChange: (value) => console.log('Changed:', value),
    height: '300px',
  },
};

export const WithSampleRule: Story = {
  args: {
    value: `trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)`,
    onChange: (value) => console.log('Changed:', value),
    height: '300px',
  },
};

export const ReadOnly: Story = {
  args: {
    value: `trace.has(database.query).where(data.contains_pii == true)
  and trace.has(audit.log)`,
    onChange: () => {},
    readOnly: true,
    height: '300px',
  },
};
```

## Files to Create

- `/Users/sscoble/Projects/fluo/bff/src/lib/monaco/fluo-dsl-language.ts` - Language definition, tokens, theme
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/monaco-dsl-editor.tsx` - Monaco editor wrapper component
- `/Users/sscoble/Projects/fluo/bff/src/lib/monaco/fluo-dsl-language.test.ts` - Unit tests for language registration
- `/Users/sscoble/Projects/fluo/bff/src/components/rules/monaco-dsl-editor.test.tsx` - Component tests
- `/Users/sscoble/Projects/fluo/bff/src/stories/MonacoDslEditor.stories.tsx` - Storybook stories

## Files to Modify

- `/Users/sscoble/Projects/fluo/bff/src/components/rules/rule-editor.tsx` - Replace Textarea with MonacoDslEditor
- `/Users/sscoble/Projects/fluo/bff/package.json` - Add `monaco-editor` dependency

## Dependencies

```json
{
  "dependencies": {
    "monaco-editor": "^0.45.0"
  },
  "devDependencies": {
    "@types/monaco-editor": "^0.45.0"
  }
}
```

## Integration Notes

- **Theme Integration**: Monaco theme should respect BeTrace's light/dark mode (use `useTheme()` hook)
- **Accessibility**: Ensure Monaco editor is keyboard-accessible (built-in Monaco support)
- **Unit B Integration**: `onValidate` prop provides hook for real-time DSL validation
- **Performance**: Monaco loads asynchronously; consider lazy loading for faster initial page load
