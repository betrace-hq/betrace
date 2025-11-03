import React, { useEffect, useState } from 'react';
import {
  EuiBasicTable,
  EuiButton,
  EuiButtonEmpty,
  EuiHealth,
  EuiBadge,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTitle,
} from '@elastic/eui';
import type { Rule } from '../types';

export const RulesPage: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const backendUrl = localStorage.getItem('betrace_backend_url') || 'http://localhost:12011';

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/rules`);
      const data = await response.json();
      setRules(data);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      await fetch(`${backendUrl}/api/rules/${ruleId}`, { method: 'DELETE' });
      loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`${backendUrl}/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const columns = [
    {
      field: 'name',
      name: 'Name',
      sortable: true,
    },
    {
      field: 'description',
      name: 'Description',
      truncateText: true,
    },
    {
      field: 'severity',
      name: 'Severity',
      render: (severity: string) => {
        const color =
          severity === 'critical'
            ? 'danger'
            : severity === 'high'
            ? 'warning'
            : severity === 'medium'
            ? 'primary'
            : 'default';
        return <EuiBadge color={color}>{severity}</EuiBadge>;
      },
    },
    {
      field: 'enabled',
      name: 'Status',
      render: (enabled: boolean) => (
        <EuiHealth color={enabled ? 'success' : 'subdued'}>
          {enabled ? 'Enabled' : 'Disabled'}
        </EuiHealth>
      ),
    },
    {
      name: 'Actions',
      actions: [
        {
          name: 'Toggle',
          description: 'Enable or disable rule',
          type: 'icon',
          icon: 'eye',
          onClick: (rule: Rule) => toggleRule(rule.id, !rule.enabled),
        },
        {
          name: 'Delete',
          description: 'Delete rule',
          type: 'icon',
          icon: 'trash',
          color: 'danger',
          onClick: (rule: Rule) => deleteRule(rule.id),
        },
      ],
    },
  ];

  return (
    <>
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiTitle size="l">
            <h1>Rules</h1>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton fill iconType="plusInCircle">
            Create Rule
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiBasicTable
        items={rules}
        columns={columns}
        loading={loading}
        hasActions={true}
        responsive={true}
      />
    </>
  );
};
