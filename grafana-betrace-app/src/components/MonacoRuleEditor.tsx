import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
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

  // Update form when rule prop changes (for edit mode)
  useEffect(() => {
    if (rule) {
      setName(rule.name || '');
      setDescription(rule.description || '');
      setExpression(rule.expression || '');
      setEnabled(rule.enabled ?? true);
      setError(null);
      setTestResult(null);
    } else {
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
          width={50}
        />
      </Field>

      <Field label="Description" description="Human-readable explanation of what this rule checks">
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          placeholder="e.g., Ensures all PII access has corresponding authentication span"
          rows={3}
        />
      </Field>

      <div>
        <Field
          label="Expression (BeTraceDSL)"
          required
          description="Trace expression in BeTraceDSL syntax with Monaco editor"
        >
          <div style={{ border: '1px solid #444', borderRadius: '2px', overflow: 'hidden' }}>
            <Editor
              key={rule?.id || 'new-rule'}
              height="300px"
              defaultLanguage="javascript"
              theme="vs-dark"
              defaultValue={expression}
              onChange={(value) => setExpression(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
              }}
            />
          </div>
        </Field>
        <HorizontalGroup spacing="sm" style={{ marginTop: '8px' }}>
          <Button size="sm" variant="secondary" onClick={handleTest} disabled={testing || !expression.trim()}>
            {testing ? 'Testing...' : 'Test Expression'}
          </Button>
          {testResult && (
            <Badge
              text={testResult.valid ? 'Valid' : 'Invalid'}
              color={testResult.valid ? 'green' : 'red'}
              icon={testResult.valid ? 'check' : 'exclamation-triangle'}
            />
          )}
        </HorizontalGroup>
        {testResult && !testResult.valid && testResult.error && (
          <Alert title="Expression Validation" severity="warning" style={{ marginTop: '8px' }}>
            {testResult.error}
          </Alert>
        )}
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

      <Alert title="BeTraceDSL Examples" severity="info">
        <strong>Common patterns:</strong>
        <pre style={{ fontSize: '12px', marginTop: '8px' }}>
{`// PII access requires authentication
trace.has(span.name == "pii.access") and trace.has(span.name == "auth.check")

// Error rate threshold
trace.spans.filter(s => s.status == "error").length > 5

// Compliance: audit log required
trace.has(span.attributes["data.pii"] == true) and trace.has(span.name == "audit.log")`}
        </pre>
      </Alert>
    </VerticalGroup>
  );
};
