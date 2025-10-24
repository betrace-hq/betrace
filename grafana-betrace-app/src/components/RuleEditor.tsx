import React, { useState, useEffect } from 'react';
import {
  Button,
  Field,
  Input,
  TextArea,
  Switch,
  Alert,
  VerticalGroup,
  HorizontalGroup,
} from '@grafana/ui';

interface Rule {
  id?: string;
  name: string;
  description: string;
  pattern: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RuleEditorProps {
  rule?: Rule | null;
  onSave: () => void;
  onCancel: () => void;
  backendUrl?: string;
}

/**
 * RuleEditor - Create or edit BeTrace rules
 *
 * Features:
 * - Form for rule name, description, pattern
 * - Validate pattern syntax (future: Monaco editor)
 * - Save to backend API
 * - Enable/disable toggle
 */
export const RuleEditor: React.FC<RuleEditorProps> = ({
  rule,
  onSave,
  onCancel,
  backendUrl = 'http://localhost:12011',
}) => {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [pattern, setPattern] = useState(rule?.pattern || '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(rule?.id);

  // Form validation
  const isValid = name.trim().length > 0 && pattern.trim().length > 0;

  // Save rule
  const handleSave = async () => {
    if (!isValid) {
      setError('Rule name and pattern are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const ruleData = {
        name: name.trim(),
        description: description.trim(),
        pattern: pattern.trim(),
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
        <h2>{isEdit ? 'Edit Rule' : 'Create New Rule'}</h2>
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

      <Field
        label="Pattern (BeTraceDSL)"
        required
        description="Trace pattern in BeTraceDSL syntax. Future: Monaco editor with syntax highlighting"
      >
        <TextArea
          value={pattern}
          onChange={(e) => setPattern(e.currentTarget.value)}
          placeholder={`trace.has(span.name == "pii.access") and trace.has(span.name == "auth.check")`}
          rows={8}
          style={{ fontFamily: 'monospace', fontSize: '13px' }}
        />
      </Field>

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

      {/* Future Phase 3: Monaco editor integration */}
      <Alert title="Coming in Phase 3" severity="info">
        Monaco editor with BeTraceDSL syntax highlighting, autocomplete, and validation.
      </Alert>
    </VerticalGroup>
  );
};
