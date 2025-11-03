import React, { useEffect, useState } from 'react';
import {
  EuiBasicTable,
  EuiHealth,
  EuiBadge,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTitle,
  EuiSelect,
  EuiButtonIcon,
  EuiCode,
} from '@elastic/eui';
import type { Violation } from '../types';

export const ViolationsPage: React.FC = () => {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [severityFilter, setSeverityFilter] = useState('all');
  const backendUrl = localStorage.getItem('betrace_backend_url') || 'http://localhost:12011';

  useEffect(() => {
    loadViolations();
  }, [timeRange, severityFilter]);

  const loadViolations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        timeRange,
        ...(severityFilter !== 'all' && { severity: severityFilter }),
      });
      const response = await fetch(`${backendUrl}/api/violations?${params}`);
      const data = await response.json();
      setViolations(data);
    } catch (error) {
      console.error('Failed to load violations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openInKibana = (traceId: string) => {
    // Open APM trace in Kibana
    window.open(`/app/apm/traces/${traceId}`, '_blank');
  };

  const columns = [
    {
      field: 'timestamp',
      name: 'Timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
      sortable: true,
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
      field: 'ruleName',
      name: 'Rule',
      sortable: true,
    },
    {
      field: 'message',
      name: 'Message',
      truncateText: true,
    },
    {
      field: 'traceId',
      name: 'Trace ID',
      render: (traceId: string) => <EuiCode>{traceId.substring(0, 16)}...</EuiCode>,
    },
    {
      name: 'Actions',
      actions: [
        {
          name: 'View in APM',
          description: 'Open trace in Kibana APM',
          type: 'icon',
          icon: 'eye',
          onClick: (violation: Violation) => openInKibana(violation.traceId),
        },
      ],
    },
  ];

  const timeRangeOptions = [
    { value: '1h', text: 'Last 1 hour' },
    { value: '6h', text: 'Last 6 hours' },
    { value: '24h', text: 'Last 24 hours' },
    { value: '7d', text: 'Last 7 days' },
    { value: '30d', text: 'Last 30 days' },
  ];

  const severityOptions = [
    { value: 'all', text: 'All' },
    { value: 'critical', text: 'Critical' },
    { value: 'high', text: 'High' },
    { value: 'medium', text: 'Medium' },
    { value: 'low', text: 'Low' },
  ];

  return (
    <>
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiTitle size="l">
            <h1>Violations</h1>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup gutterSize="s">
            <EuiFlexItem>
              <EuiSelect
                options={timeRangeOptions}
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiSelect
                options={severityOptions}
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiBasicTable
        items={violations}
        columns={columns}
        loading={loading}
        hasActions={true}
        responsive={true}
      />
    </>
  );
};
