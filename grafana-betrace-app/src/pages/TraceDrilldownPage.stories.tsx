import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { TraceDrilldownPage } from './TraceDrilldownPage';

const meta: Meta<typeof TraceDrilldownPage> = {
  title: 'Pages/TraceDrilldownPage',
  component: TraceDrilldownPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof TraceDrilldownPage>;

const mockBackendUrl = 'http://localhost:12011';

export const WithViolations: Story = {
  args: {
    traceId: 'abc123def456ghi789',
    backendUrl: mockBackendUrl,
    onBack: () => console.log('Back clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Trace drilldown showing a trace with multiple violations and span hierarchy',
      },
    },
  },
};

export const NoViolations: Story = {
  args: {
    traceId: 'xyz789uvw456rst123',
    backendUrl: mockBackendUrl,
    onBack: () => console.log('Back clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Trace drilldown for a trace with no violations (all invariants satisfied)',
      },
    },
  },
};

export const CriticalViolations: Story = {
  args: {
    traceId: 'critical-trace-001',
    backendUrl: mockBackendUrl,
    onBack: () => console.log('Back clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Trace drilldown showing critical violations requiring immediate attention',
      },
    },
  },
};
