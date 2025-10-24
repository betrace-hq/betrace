import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { SignalsPage } from './SignalsPage';
import { PluginPage } from '@grafana/runtime';

const meta: Meta<typeof SignalsPage> = {
  title: 'Pages/SignalsPage',
  component: SignalsPage,
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
type Story = StoryObj<typeof SignalsPage>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Signals page showing invariant violations with filtering and drill-down capabilities',
      },
    },
  },
};

export const WithBackendConnected: Story = {
  args: {
    backendUrl: 'http://localhost:12011',
  },
  parameters: {
    docs: {
      description: {
        story: 'Signals page connected to local BeTrace backend',
      },
    },
  },
};
