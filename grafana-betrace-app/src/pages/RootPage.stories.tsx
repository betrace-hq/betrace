import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { RootPage } from './RootPage';
import { PluginPage } from '@grafana/runtime';

const meta: Meta<typeof RootPage> = {
  title: 'Pages/RootPage',
  component: RootPage,
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
type Story = StoryObj<typeof RootPage>;

export const RulesTab: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Rules tab showing list of BeTraceDSL rules with create/edit capabilities',
      },
    },
  },
};

export const InvariantsTab: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Invariants tab showing violation monitoring dashboard',
      },
    },
  },
};

export const CreateRule: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Create new rule view with Monaco editor',
      },
    },
  },
};
