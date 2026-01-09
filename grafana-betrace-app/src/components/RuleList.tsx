import React, { useState, useMemo } from 'react';
import { Button, Icon, InteractiveTable, Alert, Spinner, VerticalGroup, HorizontalGroup, Badge, Input, Select } from '@grafana/ui';
import type { Column } from '@grafana/ui';
import type { SelectableValue } from '@grafana/data';
import { useEffectQuery, useEffectMutation, useEffectCallback } from '../hooks/useEffect';
import type { Rule } from '../services/BeTraceService';
import { SeverityLevels } from '../services/BeTraceService';

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
// Severity filter options including "ALL"
const severityFilterOptions: Array<SelectableValue<string>> = [
  { label: 'All Severities', value: 'ALL' },
  ...SeverityLevels.map((level) => ({ label: level, value: level })),
];

export const RuleList: React.FC<RuleListProps> = ({ onCreateRule, onEditRule }) => {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

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

  // Severity badge color mapping
  const getSeverityColor = (severity: string | undefined): 'red' | 'orange' | 'blue' | 'green' => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'red';
      case 'HIGH': return 'orange';
      case 'MEDIUM': return 'blue';
      case 'LOW': return 'green';
      default: return 'blue';
    }
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
      id: 'severity',
      header: 'Severity',
      cell: ({ row }) => (
        <Badge
          text={row.original.severity || 'MEDIUM'}
          color={getSeverityColor(row.original.severity)}
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

  const allRules = rulesQuery.data?.rules || [];

  // Apply filters
  const rules = useMemo(() => {
    return allRules.filter((rule) => {
      // Search filter (name or description)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = rule.name?.toLowerCase().includes(query);
        const matchesDescription = rule.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      // Severity filter
      if (severityFilter !== 'ALL') {
        if (rule.severity?.toUpperCase() !== severityFilter) {
          return false;
        }
      }

      return true;
    });
  }, [allRules, searchQuery, severityFilter]);

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
    <div className="rules-list" data-testid="rules-list">
      <VerticalGroup spacing="md">
        <HorizontalGroup justify="space-between">
          <h2 className="rules-list-header">BeTrace Rules ({rulesQuery.isLoading ? '...' : `${rules.length}${allRules.length !== rules.length ? ` of ${allRules.length}` : ''}`})</h2>
          <HorizontalGroup spacing="sm">
            <Button onClick={rulesQuery.refetch} variant="secondary" icon="sync" disabled={rulesQuery.isLoading}>
              Refresh
            </Button>
            <Button onClick={onCreateRule} variant="primary" icon="plus" data-testid="create-rule-button">
              Create Rule
            </Button>
          </HorizontalGroup>
        </HorizontalGroup>

        {/* Search and Filter Controls */}
        <HorizontalGroup spacing="md">
          <Input
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            prefix={<Icon name="search" />}
            width={30}
            type="search"
            aria-label="Search rules"
          />
          <Select
            options={severityFilterOptions}
            value={severityFilterOptions.find((opt) => opt.value === severityFilter)}
            onChange={(selected) => setSeverityFilter(selected.value || 'ALL')}
            width={20}
            aria-label="Filter by severity"
          />
          {(searchQuery || severityFilter !== 'ALL') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSeverityFilter('ALL');
              }}
            >
              Clear Filters
            </Button>
          )}
        </HorizontalGroup>

        {renderContent()}
      </VerticalGroup>
    </div>
  );
};
