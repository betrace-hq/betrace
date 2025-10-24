import React, { useState, useEffect } from 'react';
import { Button, Icon, InteractiveTable, Alert, Spinner, VerticalGroup, HorizontalGroup, Badge } from '@grafana/ui';
import type { Column } from '@grafana/ui';

interface Rule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RuleListProps {
  onCreateRule: () => void;
  onEditRule: (rule: Rule) => void;
  backendUrl?: string;
}

/**
 * RuleList - Display all BeTrace rules with CRUD operations
 *
 * Features:
 * - Fetch rules from backend API
 * - Display in interactive table
 * - Create/Edit/Delete actions
 * - Enable/disable toggle
 */
export const RuleList: React.FC<RuleListProps> = ({ onCreateRule, onEditRule, backendUrl = 'http://localhost:12011' }) => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch rules from backend
  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/api/rules`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  // Delete rule
  const deleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/rules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete rule: ${response.statusText}`);
      }
      // Refresh list
      await fetchRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  // Toggle rule enabled status
  const toggleRule = async (rule: Rule) => {
    try {
      const response = await fetch(`${backendUrl}/api/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rule,
          enabled: !rule.enabled,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update rule: ${response.statusText}`);
      }
      // Refresh list
      await fetchRules();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle rule');
    }
  };

  useEffect(() => {
    fetchRules();
  }, [backendUrl]);

  // Table columns
  const columns: Array<Column<Rule>> = [
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge
          text={row.original.enabled ? 'Enabled' : 'Disabled'}
          color={row.original.enabled ? 'green' : 'orange'}
        />
      ),
    },
    {
      id: 'name',
      header: 'Rule Name',
      cell: ({ row }) => <strong>{row.original.name}</strong>,
    },
    {
      id: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description || <em>No description</em>,
    },
    {
      id: 'pattern',
      header: 'Pattern',
      cell: ({ row }) => (
        <code style={{ fontSize: '12px', maxWidth: '300px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.original.pattern}
        </code>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <HorizontalGroup spacing="xs">
          <Button
            size="sm"
            variant="secondary"
            icon="edit"
            onClick={() => onEditRule(row.original)}
            tooltip="Edit rule"
          />
          <Button
            size="sm"
            variant={row.original.enabled ? 'secondary' : 'primary'}
            icon={row.original.enabled ? 'eye-slash' : 'eye'}
            onClick={() => toggleRule(row.original)}
            tooltip={row.original.enabled ? 'Disable rule' : 'Enable rule'}
          />
          <Button
            size="sm"
            variant="destructive"
            icon="trash-alt"
            onClick={() => deleteRule(row.original.id)}
            tooltip="Delete rule"
          />
        </HorizontalGroup>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spinner inline /> Loading rules...
      </div>
    );
  }

  if (error) {
    return (
      <Alert title="Failed to load rules" severity="error">
        {error}
        <br /><br />
        <Button onClick={fetchRules}>Retry</Button>
      </Alert>
    );
  }

  return (
    <VerticalGroup spacing="md">
      <HorizontalGroup justify="space-between">
        <h2>BeTrace Rules ({rules.length})</h2>
        <HorizontalGroup spacing="sm">
          <Button onClick={fetchRules} variant="secondary" icon="sync">
            Refresh
          </Button>
          <Button onClick={onCreateRule} variant="primary" icon="plus">
            Create Rule
          </Button>
        </HorizontalGroup>
      </HorizontalGroup>

      {rules.length === 0 ? (
        <Alert title="No rules defined" severity="info">
          Get started by creating your first BeTrace rule.
          <br /><br />
          <Button onClick={onCreateRule} variant="primary" icon="plus">
            Create Your First Rule
          </Button>
        </Alert>
      ) : (
        <InteractiveTable columns={columns} data={rules} getRowId={(row: Rule) => row.id} />
      )}
    </VerticalGroup>
  );
};
