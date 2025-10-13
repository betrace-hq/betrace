import { useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { cn } from '@/lib/utils';
import { registerFluoDslLanguage } from '@/lib/monaco/fluo-dsl-language';
import { registerFluoDslTheme } from '@/lib/monaco/fluo-dsl-theme';
import { registerFluoDslAutocomplete } from '@/lib/monaco/fluo-dsl-autocomplete';
import { useDslValidation } from '@/lib/validation/use-dsl-validation';
import type { ParseResult } from '@/lib/validation/dsl-parser';
import { createSafeErrorMessage } from '@/lib/validation/dsl-parser';
import { OutputContext } from '@/lib/validation/sanitize';

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

  /** Callback when validation completes (optional) */
  onValidationChange?: (validation: ParseResult | null) => void;
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
  onValidationChange,
}: MonacoRuleEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const isRegistered = useRef(false);

  // Real-time validation with debouncing
  const { validation, isValidating } = useDslValidation(value);

  /**
   * Handle editor value changes
   */
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  /**
   * Handle editor mount - register language, theme, autocomplete, and hover provider (PRD-010d Phase 4)
   */
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register FLUO DSL language, theme, autocomplete, and hover (only once)
    if (!isRegistered.current) {
      registerFluoDslLanguage(monaco);
      registerFluoDslTheme(monaco);
      registerFluoDslAutocomplete(monaco);

      // Register hover provider for inline error details (PRD-010d Phase 4)
      monaco.languages.registerHoverProvider('fluo-dsl', {
        provideHover: (model, position) => {
          // Get markers at cursor position
          const markers = monaco.editor.getModelMarkers({
            resource: model.uri,
            owner: 'fluo-dsl-validator',
          });

          // Find marker at cursor position
          const marker = markers.find(
            (m) =>
              m.startLineNumber <= position.lineNumber &&
              m.endLineNumber >= position.lineNumber &&
              m.startColumn <= position.column &&
              m.endColumn >= position.column
          );

          if (!marker) return null;

          // Sanitize message for Markdown context (Monaco hover uses Markdown)
          const safeMessage = createSafeErrorMessage(marker.message, OutputContext.MARKDOWN);

          // Format hover content with markdown
          const severity = marker.severity === monaco.MarkerSeverity.Error ? '❌ Error' : '⚠️ Warning';
          const contents = [
            { value: `**${severity}**` },
            { value: safeMessage },
          ];

          return {
            range: new monaco.Range(
              marker.startLineNumber,
              marker.startColumn,
              marker.endLineNumber,
              marker.endColumn
            ),
            contents,
          };
        },
      });

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

  /**
   * Update Monaco editor markers when validation changes
   */
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !validation) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    // Convert validation errors to Monaco markers
    const markers: Monaco.editor.IMarkerData[] = [
      ...validation.errors.map((error) => ({
        severity: monacoRef.current!.MarkerSeverity.Error,
        startLineNumber: error.line,
        startColumn: error.column,
        endLineNumber: error.endLine,
        endColumn: error.endColumn,
        message: error.message + (error.suggestion ? `\n\n💡 Suggestion: ${error.suggestion}` : ''),
      })),
      ...validation.warnings.map((warning) => ({
        severity: monacoRef.current!.MarkerSeverity.Warning,
        startLineNumber: warning.line,
        startColumn: warning.column,
        endLineNumber: warning.endLine,
        endColumn: warning.endColumn,
        message: warning.message + (warning.suggestion ? `\n\n💡 Suggestion: ${warning.suggestion}` : ''),
      })),
    ];

    // Set markers on the model
    monacoRef.current.editor.setModelMarkers(model, 'fluo-dsl-validator', markers);

    // Notify parent component of validation changes
    if (onValidationChange) {
      onValidationChange(validation);
    }
  }, [validation, onValidationChange]);

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
