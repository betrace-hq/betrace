import React, { useState, useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import {
  Button,
  Field,
  Input,
  TextArea,
  Switch,
  Alert,
  VerticalGroup,
  HorizontalGroup,
  Badge,
} from '@grafana/ui';

// Configure Monaco loader to use the webpack-bundled monaco-editor
// This prevents @monaco-editor/react from trying to load from CDN
loader.config({ monaco });

interface Rule {
  id?: string;
  name: string;
  description: string;
  expression: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface MonacoRuleEditorProps {
  rule?: Rule | null;
  onSave: () => void;
  onCancel: () => void;
  onTest?: (expression: string) => Promise<{ valid: boolean; error?: string }>;
  backendUrl?: string;
}

/**
 * MonacoRuleEditor - Enhanced rule editor with Monaco
 *
 * Phase 3: Monaco editor integration
 * - Syntax highlighting for BeTraceDSL
 * - Multi-line editing
 * - Expression validation (optional)
 */
export const MonacoRuleEditor: React.FC<MonacoRuleEditorProps> = ({
  rule,
  onSave,
  onCancel,
  onTest,
  backendUrl = 'http://localhost:12011',
}) => {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [expression, setExpression] = useState(rule?.expression || '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const isEdit = Boolean(rule?.id);
  const [knownAttributes, setKnownAttributes] = useState<string[]>([]);

  // Fetch known span attributes from existing rules
  useEffect(() => {
    const fetchKnownAttributes = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/rules`);
        if (response.ok) {
          const rules = await response.json();
          const attributeSet = new Set<string>();

          // Extract attribute names from all rule expressions
          rules.forEach((r: any) => {
            const expr = r.expression || '';
            // Match patterns like: span.attributes["key"] or span.attributes['key']
            const matches = expr.matchAll(/span\.attributes\["([^"]+)"\]|span\.attributes\['([^']+)'\]/g);
            for (const match of matches) {
              const attrName = match[1] || match[2];
              if (attrName) {
                attributeSet.add(attrName);
              }
            }
          });

          setKnownAttributes(Array.from(attributeSet).sort());
          console.log('[Monaco] Found span attributes:', Array.from(attributeSet));
        }
      } catch (err) {
        console.error('[Monaco] Failed to fetch known attributes:', err);
      }
    };

    fetchKnownAttributes();
  }, [backendUrl]);

  // Update form when rule prop changes (for edit mode)
  useEffect(() => {
    console.log('[MonacoRuleEditor] Rule prop changed:', rule);
    if (rule) {
      console.log('[MonacoRuleEditor] Setting expression:', rule.expression);
      setName(rule.name || '');
      setDescription(rule.description || '');
      setExpression(rule.expression || '');
      setEnabled(rule.enabled ?? true);
      setError(null);
      setTestResult(null);
    } else {
      console.log('[MonacoRuleEditor] Resetting form for create mode');
      // Reset form for create mode
      setName('');
      setDescription('');
      setExpression('');
      setEnabled(true);
      setError(null);
      setTestResult(null);
    }
  }, [rule]);

  // Form validation
  const isValid = name.trim().length > 0 && expression.trim().length > 0;

  // Test expression syntax
  const handleTest = async () => {
    if (!expression.trim()) {
      setTestResult({ valid: false, error: 'Expression is empty' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      if (onTest) {
        const result = await onTest(expression);
        setTestResult(result);
      } else {
        // Basic validation - check for common DSL keywords
        const hasKeywords = /trace\.|span\.|has\(|and|or|not/.test(expression);
        setTestResult({
          valid: hasKeywords,
          error: hasKeywords ? undefined : 'Expression should contain BeTraceDSL keywords (trace., span., has(), etc.)',
        });
      }
    } catch (err) {
      setTestResult({
        valid: false,
        error: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  // Save rule
  const handleSave = async () => {
    if (!isValid) {
      setError('Rule name and expression are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const ruleData = {
        name: name.trim(),
        description: description.trim(),
        expression: expression.trim(),
        enabled,
      };

      const url = isEdit ? `${backendUrl}/api/rules/${rule!.id}` : `${backendUrl}/api/rules`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      // Success - call onSave to return to list
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <VerticalGroup spacing="lg">
        <HorizontalGroup justify="space-between">
          <div>
            <h2>{isEdit ? 'Edit Rule' : 'Create New Rule'}</h2>
            <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
              Phase 3: Monaco editor with BeTraceDSL support
            </p>
          </div>
          <Button variant="secondary" icon="arrow-left" onClick={onCancel}>
            Back to List
          </Button>
        </HorizontalGroup>

      {error && (
        <Alert title="Error" severity="error" onRemove={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Field label="Rule Name" required description="Unique identifier for this rule">
        <Input
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="e.g., auth-required-for-pii-access"
          width={0}
          style={{ width: '100%' }}
        />
      </Field>

      <Field label="Description" description="Human-readable explanation of what this rule checks">
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          placeholder="e.g., Ensures all PII access has corresponding authentication span"
          rows={3}
          style={{ width: '100%' }}
        />
      </Field>

      {/* Expression editor and examples side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', width: '100%' }}>
        <div style={{ width: '100%' }}>
          <Field
            label="Expression (BeTraceDSL)"
            required
            description="Trace expression in BeTraceDSL syntax with Monaco editor"
          >
            <div style={{ border: '1px solid #444', borderRadius: '2px', overflow: 'hidden', width: '100%' }}>
              <Editor
                key={rule?.id || 'new-rule'}
                height="250px"
                defaultLanguage="javascript"
                theme="vs-dark"
                defaultValue={expression}
                onChange={(value) => setExpression(value || '')}
                onMount={(editor, monaco) => {
                  console.log('[Monaco] Editor mounted successfully', { editor, monaco, defaultValue: expression });

                  // Register BeTraceDSL autocomplete
                  monaco.languages.registerCompletionItemProvider('javascript', {
                    provideCompletionItems: (model, position) => {
                      const word = model.getWordUntilPosition(position);
                      const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn,
                      };

                      const completionItems = [
                        // Trace methods
                        {
                          label: 'trace.has',
                          kind: monaco.languages.CompletionItemKind.Method,
                          insertText: 'trace.has(${1:condition})',
                          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          documentation: 'Check if trace contains a span matching the condition',
                          detail: 'BeTraceDSL: Trace assertion'
                        },
                        {
                          label: 'trace.spans',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'trace.spans',
                          documentation: 'Array of all spans in the trace',
                          detail: 'BeTraceDSL: Span collection'
                        },
                        {
                          label: 'trace.duration_ms',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'trace.duration_ms',
                          documentation: 'Total duration of the trace in milliseconds',
                          detail: 'BeTraceDSL: Trace property'
                        },
                        // Span properties
                        {
                          label: 'span.name',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'span.name',
                          documentation: 'Name of the span',
                          detail: 'BeTraceDSL: Span property'
                        },
                        {
                          label: 'span.status',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'span.status',
                          documentation: 'Status of the span (ok, error)',
                          detail: 'BeTraceDSL: Span property'
                        },
                        {
                          label: 'span.service',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'span.service',
                          documentation: 'Service name that produced the span',
                          detail: 'BeTraceDSL: Span property'
                        },
                        {
                          label: 'span.attributes',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'span.attributes["${1:key}"]',
                          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          documentation: 'Access span attributes by key',
                          detail: 'BeTraceDSL: Span property'
                        },
                        // Operators
                        {
                          label: 'and',
                          kind: monaco.languages.CompletionItemKind.Keyword,
                          insertText: 'and ',
                          documentation: 'Logical AND operator',
                          detail: 'BeTraceDSL: Operator'
                        },
                        {
                          label: 'or',
                          kind: monaco.languages.CompletionItemKind.Keyword,
                          insertText: 'or ',
                          documentation: 'Logical OR operator',
                          detail: 'BeTraceDSL: Operator'
                        },
                        {
                          label: 'not',
                          kind: monaco.languages.CompletionItemKind.Keyword,
                          insertText: 'not ',
                          documentation: 'Logical NOT operator',
                          detail: 'BeTraceDSL: Operator'
                        },
                        // Array methods
                        {
                          label: 'filter',
                          kind: monaco.languages.CompletionItemKind.Method,
                          insertText: 'filter(${1:s} => ${2:condition})',
                          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          documentation: 'Filter array elements',
                          detail: 'JavaScript: Array method'
                        },
                        {
                          label: 'length',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'length',
                          documentation: 'Number of elements in array',
                          detail: 'JavaScript: Array property'
                        }
                      ];

                      // Add common OpenTelemetry semantic conventions
                      const commonOTelAttributes = [
                        { name: 'http.method', doc: 'HTTP request method (GET, POST, etc.)' },
                        { name: 'http.status_code', doc: 'HTTP response status code' },
                        { name: 'http.url', doc: 'Full HTTP request URL' },
                        { name: 'http.route', doc: 'HTTP route pattern' },
                        { name: 'db.system', doc: 'Database system (mysql, postgres, etc.)' },
                        { name: 'db.statement', doc: 'Database query statement' },
                        { name: 'db.operation', doc: 'Database operation (SELECT, INSERT, etc.)' },
                        { name: 'messaging.system', doc: 'Messaging system (kafka, rabbitmq, etc.)' },
                        { name: 'rpc.service', doc: 'RPC service name' },
                        { name: 'error', doc: 'Whether the span represents an error' },
                        { name: 'error.message', doc: 'Error message' },
                        { name: 'user.id', doc: 'User identifier' },
                        { name: 'session.id', doc: 'Session identifier' }
                      ];

                      commonOTelAttributes.forEach(({ name, doc }) => {
                        completionItems.push({
                          label: `span.attributes["${name}"]`,
                          kind: monaco.languages.CompletionItemKind.Constant,
                          insertText: `span.attributes["${name}"]`,
                          documentation: doc,
                          detail: 'OTel: Semantic convention'
                        });
                      });

                      // Add dynamic span attributes from existing rules
                      knownAttributes.forEach(attrName => {
                        // Don't duplicate common attributes
                        if (!commonOTelAttributes.some(a => a.name === attrName)) {
                          completionItems.push({
                            label: `span.attributes["${attrName}"]`,
                            kind: monaco.languages.CompletionItemKind.Property,
                            insertText: `span.attributes["${attrName}"]`,
                            documentation: `Span attribute: ${attrName} (found in existing rules)`,
                            detail: 'BeTraceDSL: Known attribute'
                          });
                        }
                      });

                      // Add range to all suggestions
                      const suggestions = completionItems.map(item => ({ ...item, range }));

                      return { suggestions };
                    }
                  });
                }}
                loading="Loading Monaco Editor..."
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                }}
              />
            </div>
          </Field>
          <div style={{ marginTop: '8px' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleTest}
              disabled={testing || !expression.trim()}
              aria-label="Test expression syntax"
            >
              {testing ? 'Testing...' : 'Test Expression'}
            </Button>
            {testResult && (
              <div role="status" aria-live="polite" style={{ marginTop: '8px' }}>
                <Badge
                  text={testResult.valid ? '✓ Valid syntax' : '✗ Invalid syntax'}
                  color={testResult.valid ? 'green' : 'red'}
                  icon={testResult.valid ? 'check' : 'exclamation-triangle'}
                />
              </div>
            )}
          </div>
          {testResult && !testResult.valid && testResult.error && (
            <Alert title="Expression Validation" severity="warning" style={{ marginTop: '8px' }}>
              {testResult.error}
            </Alert>
          )}
        </div>

        {/* Examples sidebar */}
        <div>
          <Alert title="BeTraceDSL Examples" severity="info">
            <strong>Common patterns:</strong>
            <pre style={{ fontSize: '11px', marginTop: '8px', overflow: 'auto', maxHeight: '250px' }}>
{`// PII access requires auth
trace.has(span.name == "pii.access")
  and trace.has(span.name == "auth.check")

// Error rate threshold
trace.spans
  .filter(s => s.status == "error")
  .length > 5

// Compliance: audit required
trace.has(
  span.attributes["data.pii"] == true
) and trace.has(
  span.name == "audit.log"
)

// Response time check
trace.duration_ms < 1000

// Service dependency
trace.has(span.service == "auth")
  and trace.has(span.service == "db")`}
            </pre>
          </Alert>
        </div>
      </div>

      <Field label="Status" description="Enable or disable this rule">
        <HorizontalGroup spacing="sm">
          <Switch value={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />
          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
        </HorizontalGroup>
      </Field>

      <HorizontalGroup spacing="sm">
        <Button variant="primary" onClick={handleSave} disabled={!isValid || saving}>
          {saving ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Rule'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </HorizontalGroup>
      </VerticalGroup>
    </div>
  );
};
