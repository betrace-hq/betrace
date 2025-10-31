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
import { useEffectMutation, useEffectQuery } from '../hooks/useEffect';
import type { Rule } from '../services/BeTraceService';

// Try to import theme context, fallback if not available (for Grafana runtime)
let useTheme: (() => 'light' | 'dark') | undefined;
try {
  const ThemeContext = require('../../.storybook/ThemeContext');
  useTheme = ThemeContext.useTheme;
} catch (e) {
  // Not in Storybook, will use default theme
}

// Configure Monaco loader to use the webpack-bundled monaco-editor
// This prevents @monaco-editor/react from trying to load from CDN
loader.config({ monaco });

interface MonacoRuleEditorProps {
  rule?: Rule | null;
  onSave: () => void;
  onCancel: () => void;
  onTest?: (expression: string) => Promise<{ valid: boolean; error?: string }>;
}

/**
 * MonacoRuleEditor - Enhanced rule editor with Monaco (Effect-based)
 *
 * Features:
 * - Syntax highlighting for BeTraceDSL
 * - Multi-line editing with Monaco
 * - Expression validation
 * - Effect-based API operations with retry
 */
export const MonacoRuleEditor: React.FC<MonacoRuleEditorProps> = ({
  rule,
  onSave,
  onCancel,
  onTest,
}) => {
  const theme = useTheme ? useTheme() : 'dark';
  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [expression, setExpression] = useState(rule?.expression || '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const isEdit = Boolean(rule?.id);

  // Fetch known span attributes from existing rules (Effect-based)
  const rulesQuery = useEffectQuery(
    (service) => service.listRules(),
    {
      refetchOnMount: true,
    }
  );

  const knownAttributes = React.useMemo(() => {
    if (!rulesQuery.data?.rules) return [];

    const attributeSet = new Set<string>();
    rulesQuery.data.rules.forEach((r) => {
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

    return Array.from(attributeSet).sort();
  }, [rulesQuery.data]);

  // Save mutation (Effect-based)
  const saveMutation = useEffectMutation(
    (service, formData: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => {
      return rule?.id
        ? service.updateRule(rule.id, formData)
        : service.createRule(formData);
    },
    {
      onSuccess: () => onSave(),
    }
  );

  // Update form when rule prop changes (for edit mode)
  useEffect(() => {
    console.log('[MonacoRuleEditor] Rule prop changed:', rule);
    if (rule) {
      console.log('[MonacoRuleEditor] Setting expression:', rule.expression);
      setName(rule.name || '');
      setDescription(rule.description || '');
      setExpression(rule.expression || '');
      setEnabled(rule.enabled ?? true);
      setTestResult(null);
    } else {
      console.log('[MonacoRuleEditor] Resetting form for create mode');
      // Reset form for create mode
      setName('');
      setDescription('');
      setExpression('');
      setEnabled(true);
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

  // Save rule (Effect-based)
  const handleSave = () => {
    if (!isValid) {
      return;
    }

    saveMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      expression: expression.trim(),
      enabled,
    });
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

      {saveMutation.isError && (
        <Alert title="Error" severity="error" onRemove={() => saveMutation.reset()}>
          {saveMutation.error}
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: '20px',
        width: '100%',
        alignItems: 'start'
      }}>
        <div style={{ width: '100%', minWidth: 0 }}>
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
                theme={monacoTheme}
                defaultValue={expression}
                onChange={(value) => setExpression(value || '')}
                onMount={(editor, monaco) => {
                  console.log('[Monaco] Editor mounted successfully', { editor, monaco, defaultValue: expression });

                  // Configure editor options for better bracket handling
                  editor.updateOptions({
                    autoClosingBrackets: 'always',
                    autoClosingQuotes: 'always',
                    autoSurround: 'languageDefined',
                    bracketPairColorization: { enabled: true },
                    formatOnPaste: true,
                    formatOnType: true,
                  });

                  // Register BeTraceDSL autocomplete
                  monaco.languages.registerCompletionItemProvider('javascript', {
                    provideCompletionItems: (model, position) => {
                      // Define common OTel attributes with type metadata FIRST
                      const commonOTelAttributes = [
                        { name: 'http.method', doc: 'HTTP request method (GET, POST, etc.)', type: 'string', values: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] },
                        { name: 'http.status_code', doc: 'HTTP response status code', type: 'number', values: ['200', '201', '400', '401', '403', '404', '500', '502', '503'] },
                        { name: 'http.url', doc: 'Full HTTP request URL', type: 'string' },
                        { name: 'http.route', doc: 'HTTP route pattern', type: 'string' },
                        { name: 'db.system', doc: 'Database system (mysql, postgres, etc.)', type: 'string', values: ['mysql', 'postgres', 'mongodb', 'redis', 'cassandra'] },
                        { name: 'db.statement', doc: 'Database query statement', type: 'string' },
                        { name: 'db.operation', doc: 'Database operation (SELECT, INSERT, etc.)', type: 'string', values: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'] },
                        { name: 'messaging.system', doc: 'Messaging system (kafka, rabbitmq, etc.)', type: 'string', values: ['kafka', 'rabbitmq', 'sqs', 'sns', 'pubsub'] },
                        { name: 'rpc.service', doc: 'RPC service name', type: 'string' },
                        { name: 'error', doc: 'Whether the span represents an error', type: 'boolean', values: ['true', 'false'] },
                        { name: 'error.message', doc: 'Error message', type: 'string' },
                        { name: 'user.id', doc: 'User identifier', type: 'string' },
                        { name: 'session.id', doc: 'Session identifier', type: 'string' }
                      ];

                      const word = model.getWordUntilPosition(position);
                      const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn,
                      };

                      // Get the text before cursor to detect context
                      const textBeforeCursor = model.getValueInRange({
                        startLineNumber: position.lineNumber,
                        startColumn: 1,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                      });

                      // Check if user just typed an attribute - suggest operators and values
                      const attributeMatch = textBeforeCursor.match(/span\.attributes\["([^"]+)"\]\s*$/);
                      if (attributeMatch) {
                        const attrName = attributeMatch[1];
                        const attrMeta = commonOTelAttributes.find(a => a.name === attrName);

                        const operatorSuggestions: any[] = [];

                        if (attrMeta) {
                          // Add operators based on type
                          if (attrMeta.type === 'string') {
                            operatorSuggestions.push(
                              { op: '== "${1:value}"', doc: `Exact match - checks if ${attrName} equals a specific string value.` },
                              { op: '!= "${1:value}"', doc: `Not equal - checks if ${attrName} does not equal a specific string value.` },
                              { op: '.contains("${1:substring}")', doc: `Contains substring - checks if ${attrName} contains the given text anywhere.` },
                              { op: '.startsWith("${1:prefix}")', doc: `Starts with - checks if ${attrName} begins with the given text.` },
                              { op: '.endsWith("${1:suffix}")', doc: `Ends with - checks if ${attrName} ends with the given text.` }
                            );
                          } else if (attrMeta.type === 'number') {
                            operatorSuggestions.push(
                              { op: '== ${1:value}', doc: `Exact match - checks if ${attrName} equals a specific number.` },
                              { op: '!= ${1:value}', doc: `Not equal - checks if ${attrName} does not equal a specific number.` },
                              { op: '> ${1:value}', doc: `Greater than - checks if ${attrName} is greater than the given number.` },
                              { op: '>= ${1:value}', doc: `Greater than or equal - checks if ${attrName} is at least the given number.` },
                              { op: '< ${1:value}', doc: `Less than - checks if ${attrName} is less than the given number.` },
                              { op: '<= ${1:value}', doc: `Less than or equal - checks if ${attrName} is at most the given number.` }
                            );
                          } else if (attrMeta.type === 'boolean') {
                            operatorSuggestions.push(
                              { op: '== true', doc: `Check if ${attrName} is true.` },
                              { op: '== false', doc: `Check if ${attrName} is false.` },
                              { op: '!= true', doc: `Check if ${attrName} is not true (false or unset).` },
                              { op: '!= false', doc: `Check if ${attrName} is not false (true or unset).` }
                            );
                          }
                        }

                        return {
                          suggestions: operatorSuggestions.map(({ op, doc }) => ({
                            label: op,
                            kind: monaco.languages.CompletionItemKind.Operator,
                            insertText: op,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: doc,
                            detail: `${attrName} comparison`,
                            range
                          }))
                        };
                      }

                      const completionItems = [
                        // Trace methods
                        {
                          label: 'trace.has',
                          kind: monaco.languages.CompletionItemKind.Method,
                          insertText: 'trace.has(${1:condition})',
                          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          documentation: 'Check if trace contains at least one span matching the condition.\n\nExamples:\n  trace.has(span.name == "GET /api/users")\n  trace.has(span.attributes["http.status_code"] >= 500)\n  trace.has(span.service == "auth-service" and span.status == "error")',
                          detail: 'BeTraceDSL: Trace assertion'
                        },
                        {
                          label: 'trace.spans',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'trace.spans',
                          documentation: 'Array of all spans in the trace. Use with .filter() to find matching spans.\n\nExamples:\n  trace.spans.filter(s => s.status == "error").length > 0\n  trace.spans.filter(s => s.service == "db").length > 5',
                          detail: 'BeTraceDSL: Span collection'
                        },
                        {
                          label: 'trace.duration_ms',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'trace.duration_ms',
                          documentation: 'Total duration of the trace in milliseconds (from first span start to last span end).\n\nExamples:\n  trace.duration_ms > 5000  // Traces longer than 5 seconds\n  trace.duration_ms < 100   // Fast traces',
                          detail: 'BeTraceDSL: Trace property'
                        },
                        // Span properties
                        {
                          label: 'span.name',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'span.name',
                          documentation: 'Name of the span (e.g., "GET /api/users", "database.query", "http.request").\n\nExamples:\n  span.name == "GET /api/users"\n  span.name.startsWith("POST ")\n  span.name.contains("database")',
                          detail: 'BeTraceDSL: Span property'
                        },
                        {
                          label: 'span.status',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'span.status',
                          documentation: 'Status of the span. Possible values: "ok", "error", "unset".\n\nExamples:\n  span.status == "error"\n  span.status != "ok"',
                          detail: 'BeTraceDSL: Span property'
                        },
                        {
                          label: 'span.service',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'span.service',
                          documentation: 'Service name that produced the span (from resource.service.name attribute).\n\nExamples:\n  span.service == "auth-service"\n  span.service == "payment-gateway"\n  span.service.contains("api")',
                          detail: 'BeTraceDSL: Span property'
                        },
                        {
                          label: 'span.attributes',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'span.attributes["${1:key}"]',
                          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          documentation: 'Access span attributes by key. Attributes contain metadata about the span (HTTP method, status code, user ID, etc.).\n\nExamples:\n  span.attributes["http.method"] == "POST"\n  span.attributes["http.status_code"] >= 400\n  span.attributes["user.id"] == "12345"',
                          detail: 'BeTraceDSL: Span property'
                        },
                        // Operators
                        {
                          label: 'and',
                          kind: monaco.languages.CompletionItemKind.Keyword,
                          insertText: 'and ',
                          documentation: 'Logical AND operator - both conditions must be true.\n\nExample:\n  span.status == "error" and span.service == "payment-gateway"',
                          detail: 'BeTraceDSL: Operator'
                        },
                        {
                          label: 'or',
                          kind: monaco.languages.CompletionItemKind.Keyword,
                          insertText: 'or ',
                          documentation: 'Logical OR operator - at least one condition must be true.\n\nExample:\n  span.status == "error" or span.attributes["http.status_code"] >= 500',
                          detail: 'BeTraceDSL: Operator'
                        },
                        {
                          label: 'not',
                          kind: monaco.languages.CompletionItemKind.Keyword,
                          insertText: 'not ',
                          documentation: 'Logical NOT operator - negates the condition.\n\nExample:\n  not trace.has(span.status == "error")',
                          detail: 'BeTraceDSL: Operator'
                        },
                        // Array methods
                        {
                          label: 'filter',
                          kind: monaco.languages.CompletionItemKind.Method,
                          insertText: 'filter(${1:s} => ${2:condition})',
                          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                          documentation: 'Filter array elements based on a condition. Returns a new array with only matching elements.\n\nExamples:\n  trace.spans.filter(s => s.status == "error")\n  trace.spans.filter(s => s.service == "db" and s.duration_ms > 100)',
                          detail: 'JavaScript: Array method'
                        },
                        {
                          label: 'length',
                          kind: monaco.languages.CompletionItemKind.Property,
                          insertText: 'length',
                          documentation: 'Number of elements in an array.\n\nExamples:\n  trace.spans.length > 10\n  trace.spans.filter(s => s.status == "error").length > 0',
                          detail: 'JavaScript: Array property'
                        }
                      ];

                      // Add common OpenTelemetry semantic conventions (already defined above)
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
        <div style={{ minWidth: 0 }}>
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
        <Button variant="primary" onClick={handleSave} disabled={!isValid || saveMutation.isLoading}>
          {saveMutation.isLoading ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Rule'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saveMutation.isLoading}>
          Cancel
        </Button>
      </HorizontalGroup>
      </VerticalGroup>
    </div>
  );
};
