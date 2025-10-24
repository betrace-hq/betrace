import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { HomePage } from './HomePage';
import { PluginPage } from '@grafana/runtime';

const meta: Meta<typeof HomePage> = {
  title: 'Pages/HomePage',
  component: HomePage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <PluginPage>
        <Story />
      </PluginPage>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HomePage>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'BeTrace home page showing operational metrics and quick navigation',
      },
    },
  },
};

export const HighViolationRate: Story = {
  args: {
    mockData: {
      activeRules: 15,
      violations24h: 1247,
      tracesEvaluated: 5200000,
      avgLatency: 5.8,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing high violation rates requiring attention',
      },
    },
  },
};

export const LowActivity: Story = {
  args: {
    mockData: {
      activeRules: 3,
      violations24h: 12,
      tracesEvaluated: 45000,
      avgLatency: 1.2,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Homepage with low activity and minimal violations',
      },
    },
  },
};
