import React, { useState, useEffect, useRef } from 'react';
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
import { registerDSLLanguage, validateDSL } from '../lib/monaco-dsl-v2';
import { RuleTemplatePicker } from './RuleTemplatePicker';

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
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const languageRegistered = useRef(false);

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

  // Real-time DSL validation
  useEffect(() => {
    if (editorRef.current && monacoRef.current && expression) {
      const markers = validateDSL(monacoRef.current, expression);
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'betrace-dsl', markers);
      }
    }
  }, [expression]);

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
        // Basic validation - check for DSL v2.0 when-always-never keywords
        const hasWhen = /\bwhen\s*\{/.test(expression);
        const hasAlwaysOrNever = /\b(always|never)\s*\{/.test(expression);
        const isValid = hasWhen && hasAlwaysOrNever;
        setTestResult({
          valid: isValid,
          error: isValid ? undefined : 'Expression should use DSL v2.0 syntax with "when { ... } always/never { ... }" clauses',
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
                defaultLanguage="betrace-dsl"
                theme={monacoTheme}
                defaultValue={expression}
                onChange={(value) => setExpression(value || '')}
                onMount={(editor, monacoInstance) => {
                  console.log('[Monaco] Editor mounted successfully', { editor, monaco: monacoInstance, defaultValue: expression });

                  // Store editor and monaco refs for validation
                  editorRef.current = editor;
                  monacoRef.current = monacoInstance;

                  // Register DSL v2.0 language (only once)
                  if (!languageRegistered.current) {
                    registerDSLLanguage(monacoInstance);
                    languageRegistered.current = true;
                  }

                  // Configure editor options for better bracket handling
                  editor.updateOptions({
                    autoClosingBrackets: 'always',
                    autoClosingQuotes: 'always',
                    autoSurround: 'languageDefined',
                    bracketPairColorization: { enabled: true },
                    formatOnPaste: true,
                    formatOnType: true,
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
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              size="sm"
              variant="primary"
              icon="book"
              onClick={() => setShowTemplatePicker(true)}
              aria-label="Browse rule templates"
            >
              Browse Templates (45)
            </Button>
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
          <Alert title="BeTraceDSL v2.0 Examples" severity="info">
            <strong>Common patterns:</strong>
            <pre style={{ fontSize: '11px', marginTop: '8px', overflow: 'auto', maxHeight: '250px' }}>
{`// Payment fraud check
when { payment.charge.where(amount > 1000) }
always { payment.fraud_check }

// PII access requires auth
when { database.query.where("data.contains_pii" == true) }
always { auth.check }

// AI agent tool approval
when { agent.tool_use.where(tool_requires_approval == true) }
always { human.approval_granted }

// Count mismatch detection
when { count(http.request) != count(http.response) }
always { alert }

// Audit logging
when { pii.access }
always { audit.log }

// Never allow unauthorized access
when { admin.action }
never { unauthorized_access }

// Chained where clauses
when { payment.charge.where(amount > 1000).where(currency == "USD") }
always { verification }`}
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

      {/* Template Library Modal */}
      <RuleTemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelectTemplate={(expression, templateInfo) => {
          setExpression(expression);
          if (templateInfo && !name) {
            setName(templateInfo.name);
            setDescription(templateInfo.description);
          }
          setShowTemplatePicker(false);
        }}
      />
    </div>
  );
};
