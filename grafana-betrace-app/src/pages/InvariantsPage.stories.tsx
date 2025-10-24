import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { InvariantsPage } from './InvariantsPage';

const meta: Meta<typeof InvariantsPage> = {
  title: 'Pages/InvariantsPage',
  component: InvariantsPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof InvariantsPage>;

// Mock backend that returns sample violations
const mockBackendUrl = 'http://localhost:12011';

export const WithViolations: Story = {
  args: {
    backendUrl: mockBackendUrl,
    timeRange: {
      from: Date.now() - 24 * 60 * 60 * 1000,
      to: Date.now(),
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Invariants page showing multiple violations across different services and severity levels',
      },
    },
  },
};

export const NoViolations: Story = {
  args: {
    backendUrl: mockBackendUrl,
    timeRange: {
      from: Date.now() - 24 * 60 * 60 * 1000,
      to: Date.now(),
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Invariants page when all invariants are satisfied (no violations)',
      },
    },
  },
};

export const CriticalViolationsOnly: Story = {
  args: {
    backendUrl: mockBackendUrl,
    timeRange: {
      from: Date.now() - 1 * 60 * 60 * 1000, // Last hour
      to: Date.now(),
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Focused view showing only critical violations from the last hour',
      },
    },
  },
};
