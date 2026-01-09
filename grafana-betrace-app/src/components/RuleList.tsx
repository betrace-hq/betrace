import React from 'react';
import { Button, Icon, InteractiveTable, Alert, Spinner, VerticalGroup, HorizontalGroup, Badge } from '@grafana/ui';
import type { Column } from '@grafana/ui';
import { useEffectQuery, useEffectMutation, useEffectCallback } from '../hooks/useEffect';
import type { Rule } from '../services/BeTraceService';

interface RuleListProps {
  onCreateRule: () => void;
  onEditRule: (rule: Rule) => void;
}

/**
 * RuleList - Display all BeTrace rules with CRUD operations (Effect-based)
 *
 * Features:
 * - Fetch rules using Effect service layer
 * - Display in interactive table
 * - Create/Edit/Delete actions
 * - Enable/disable toggle
 * - Automatic retry and error handling via Effect
 */
export const RuleList: React.FC<RuleListProps> = ({ onCreateRule, onEditRule }) => {
  // Query: Fetch all rules
  const rulesQuery = useEffectQuery(
    (service) => service.listRules(),
    {
      refetchOnMount: true,
    }
  );

  // Mutation: Delete rule
  const deleteRuleMutation = useEffectCallback(
    (service, id: string) => service.deleteRule(id),
    {
      onSuccess: () => rulesQuery.refetch(),
      onError: (error) => alert(`Failed to delete rule: ${error}`),
    }
  );

  // Mutation: Toggle rule (enable/disable)
  const toggleRuleMutation = useEffectCallback(
    (service, rule: Rule) =>
      rule.enabled ? service.disableRule(rule.id!) : service.enableRule(rule.id!),
    {
      onSuccess: () => rulesQuery.refetch(),
      onError: (error) => alert(`Failed to toggle rule: ${error}`),
    }
  );

  // Handlers
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      deleteRuleMutation(id);
    }
  };

  const handleToggle = (rule: Rule) => {
    toggleRuleMutation(rule);
  };

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
      header: 'Expression',
      cell: ({ row }) => (
        <code style={{ fontSize: '12px', maxWidth: '300px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.original.expression}
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
            onClick={() => handleToggle(row.original)}
            tooltip={row.original.enabled ? 'Disable rule' : 'Enable rule'}
          />
          <Button
            size="sm"
            variant="destructive"
            icon="trash-alt"
            onClick={() => handleDelete(row.original.id!)}
            tooltip="Delete rule"
          />
        </HorizontalGroup>
      ),
    },
  ];

  const rules = rulesQuery.data?.rules || [];

  // Render content based on query state
  const renderContent = () => {
    if (rulesQuery.isLoading) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner inline /> Loading rules...
        </div>
      );
    }

    if (rulesQuery.isError) {
      return (
        <Alert title="Failed to load rules" severity="error">
          {rulesQuery.error}
          <br /><br />
          <Button onClick={rulesQuery.refetch}>Retry</Button>
        </Alert>
      );
    }

    if (rules.length === 0) {
      return (
        <Alert title="No rules defined" severity="info">
          Get started by creating your first BeTrace rule.
          <br /><br />
          <Button onClick={onCreateRule} variant="primary" icon="plus">
            Create Your First Rule
          </Button>
        </Alert>
      );
    }

    return (
      <InteractiveTable columns={columns} data={[...rules]} getRowId={(row: Rule) => row.id!} />
    );
  };

  return (
    <VerticalGroup spacing="md">
      <HorizontalGroup justify="space-between">
        <h2 className="rules-list-header">BeTrace Rules ({rulesQuery.isLoading ? '...' : rules.length})</h2>
        <HorizontalGroup spacing="sm">
          <Button onClick={rulesQuery.refetch} variant="secondary" icon="sync" disabled={rulesQuery.isLoading}>
            Refresh
          </Button>
          <Button onClick={onCreateRule} variant="primary" icon="plus" data-testid="create-rule-button">
            Create Rule
          </Button>
        </HorizontalGroup>
      </HorizontalGroup>

      {renderContent()}
    </VerticalGroup>
  );
};
