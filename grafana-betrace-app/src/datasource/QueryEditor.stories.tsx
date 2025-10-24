import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { QueryEditor } from './QueryEditor';
import { BeTraceQuery, defaultQuery } from './types';

const meta: Meta<typeof QueryEditor> = {
  title: 'Datasource/QueryEditor',
  component: QueryEditor,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof QueryEditor>;

const mockDatasource = {} as any;
const mockOnChange = (query: BeTraceQuery) => console.log('Query changed:', query);
const mockOnRunQuery = () => console.log('Running query');

export const ViolationsQuery: Story = {
  args: {
    datasource: mockDatasource,
    query: {
      ...defaultQuery,
      refId: 'A',
      queryType: 'violations',
      severity: 'all',
      limit: 100,
    } as BeTraceQuery,
    onChange: mockOnChange,
    onRunQuery: mockOnRunQuery,
  },
  parameters: {
    docs: {
      description: {
        story: 'Query editor configured for querying violations with filters',
      },
    },
  },
};

export const CriticalViolationsOnly: Story = {
  args: {
    datasource: mockDatasource,
    query: {
      ...defaultQuery,
      refId: 'A',
      queryType: 'violations',
      severity: 'critical',
      serviceName: 'auth-service',
      limit: 50,
    } as BeTraceQuery,
    onChange: mockOnChange,
    onRunQuery: mockOnRunQuery,
  },
  parameters: {
    docs: {
      description: {
        story: 'Query editor filtering for critical violations from auth-service',
      },
    },
  },
};

export const StatsQuery: Story = {
  args: {
    datasource: mockDatasource,
    query: {
      ...defaultQuery,
      refId: 'A',
      queryType: 'stats',
      statsType: 'by_severity',
    } as BeTraceQuery,
    onChange: mockOnChange,
    onRunQuery: mockOnRunQuery,
  },
  parameters: {
    docs: {
      description: {
        story: 'Query editor configured for statistics queries',
      },
    },
  },
};

export const TraceQuery: Story = {
  args: {
    datasource: mockDatasource,
    query: {
      ...defaultQuery,
      refId: 'A',
      queryType: 'traces',
      traceId: 'abc123def456ghi789',
    } as BeTraceQuery,
    onChange: mockOnChange,
    onRunQuery: mockOnRunQuery,
  },
  parameters: {
    docs: {
      description: {
        story: 'Query editor for fetching specific trace data',
      },
    },
  },
};
