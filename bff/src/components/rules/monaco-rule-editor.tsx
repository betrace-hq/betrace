import { useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { cn } from '@/lib/utils';
import { registerFluoDslLanguage } from '@/lib/monaco/fluo-dsl-language';
import { registerFluoDslTheme } from '@/lib/monaco/fluo-dsl-theme';
import { registerFluoDslAutocomplete } from '@/lib/monaco/fluo-dsl-autocomplete';

/**
 * Monaco Rule Editor Props
 */
export interface MonacoRuleEditorProps {
  /** Current DSL code value */
  value: string;

  /** Callback when code changes */
  onChange: (value: string) => void;

  /** Editor height (default: 300px) */
  height?: string;

  /** Disable editing (default: false) */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Monaco Rule Editor Component
 *
 * Professional code editor for FLUO DSL with:
 * - Syntax highlighting
 * - Context-aware autocomplete
 * - Bracket matching and auto-closing
 * - Multi-line editing
 * - Custom theme
 *
 * Usage:
 * ```tsx
 * <MonacoRuleEditor
 *   value={dslCode}
 *   onChange={setDslCode}
 *   height="300px"
 * />
 * ```
 */
export function MonacoRuleEditor({
  value,
  onChange,
  height = '300px',
  disabled = false,
  className,
}: MonacoRuleEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const isRegistered = useRef(false);

  /**
   * Handle editor value changes
   */
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  /**
   * Handle editor mount - register language, theme, and autocomplete
   */
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register FLUO DSL language, theme, and autocomplete (only once)
    if (!isRegistered.current) {
      registerFluoDslLanguage(monaco);
      registerFluoDslTheme(monaco);
      registerFluoDslAutocomplete(monaco);
      isRegistered.current = true;
    }

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      lineNumbers: 'on',
      wordWrap: 'on',
      quickSuggestions: true,
      acceptSuggestionOnEnter: 'on',
      tabSize: 2,
      fontSize: 14,
      lineHeight: 20,
      padding: { top: 8, bottom: 8 },
    });

    // Focus editor
    editor.focus();
  };

  return (
    <div className={cn('border rounded-md overflow-hidden bg-[#1e1e1e]', className)}>
      <Editor
        height={height}
        language="fluo-dsl"
        theme="fluo-dsl-dark"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly: disabled,
        }}
        loading={<div className="flex items-center justify-center h-full text-muted-foreground">Loading editor...</div>}
      />
    </div>
  );
}
