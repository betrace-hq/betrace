import React from 'react';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { Field, Input, Select, VerticalGroup } from '@grafana/ui';
import { BeTraceDataSource } from './DataSource';
import { BeTraceQuery, BeTraceDataSourceOptions, defaultQuery } from './types';

type Props = QueryEditorProps<BeTraceDataSource, BeTraceQuery, BeTraceDataSourceOptions>;

const queryTypeOptions: Array<SelectableValue<string>> = [
  { label: 'Violations', value: 'violations', description: 'Query violation events' },
  { label: 'Statistics', value: 'stats', description: 'Query aggregated statistics' },
  { label: 'Traces', value: 'traces', description: 'Query specific trace data' },
];

const severityOptions: Array<SelectableValue<string>> = [
  { label: 'All Severities', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const statsTypeOptions: Array<SelectableValue<string>> = [
  { label: 'Total Counts', value: 'total' },
  { label: 'By Severity', value: 'by_severity' },
  { label: 'By Service', value: 'by_service' },
  { label: 'By Rule', value: 'by_rule' },
  { label: 'Timeline', value: 'timeline' },
];

export const QueryEditor: React.FC<Props> = ({ query, onChange, onRunQuery }) => {
  const q = { ...defaultQuery, ...query };

  const onQueryTypeChange = (value: SelectableValue<string>) => {
    onChange({ ...q, queryType: value.value as any });
    onRunQuery();
  };

  const onSeverityChange = (value: SelectableValue<string>) => {
    onChange({ ...q, severity: value.value as any });
    onRunQuery();
  };

  const onServiceNameChange = (event: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...q, serviceName: event.currentTarget.value });
  };

  const onRuleIdChange = (event: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...q, ruleId: event.currentTarget.value });
  };

  const onLimitChange = (event: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...q, limit: parseInt(event.currentTarget.value, 10) || 100 });
  };

  const onStatsTypeChange = (value: SelectableValue<string>) => {
    onChange({ ...q, statsType: value.value as any });
    onRunQuery();
  };

  const onTraceIdChange = (event: React.FormEvent<HTMLInputElement>) => {
    onChange({ ...q, traceId: event.currentTarget.value });
  };

  return (
    <VerticalGroup spacing="sm">
      <Field label="Query Type" description="Type of data to query from BeTrace">
        <Select
          options={queryTypeOptions}
          value={queryTypeOptions.find((o) => o.value === q.queryType)}
          onChange={onQueryTypeChange}
          width={30}
        />
      </Field>

      {q.queryType === 'violations' && (
        <>
          <Field label="Severity" description="Filter by violation severity">
            <Select
              options={severityOptions}
              value={severityOptions.find((o) => o.value === q.severity)}
              onChange={onSeverityChange}
              width={20}
            />
          </Field>

          <Field label="Service Name" description="Filter by service (optional)">
            <Input
              placeholder="e.g., auth-service"
              value={q.serviceName || ''}
              onChange={onServiceNameChange}
              onBlur={onRunQuery}
              width={30}
            />
          </Field>

          <Field label="Rule ID" description="Filter by specific rule (optional)">
            <Input
              placeholder="e.g., auth-required-for-pii-access"
              value={q.ruleId || ''}
              onChange={onRuleIdChange}
              onBlur={onRunQuery}
              width={30}
            />
          </Field>

          <Field label="Limit" description="Maximum number of violations to return">
            <Input
              type="number"
              placeholder="100"
              value={q.limit || 100}
              onChange={onLimitChange}
              onBlur={onRunQuery}
              width={10}
            />
          </Field>
        </>
      )}

      {q.queryType === 'stats' && (
        <Field label="Stats Type" description="Type of statistics to query">
          <Select
            options={statsTypeOptions}
            value={statsTypeOptions.find((o) => o.value === q.statsType)}
            onChange={onStatsTypeChange}
            width={20}
          />
        </Field>
      )}

      {q.queryType === 'traces' && (
        <Field label="Trace ID" description="Specific trace ID to query" required>
          <Input
            placeholder="e.g., abc123def456..."
            value={q.traceId || ''}
            onChange={onTraceIdChange}
            onBlur={onRunQuery}
            width={40}
          />
        </Field>
      )}
    </VerticalGroup>
  );
};
