import type { Meta, StoryObj } from '@storybook/react';
import { MonacoRuleEditor } from './MonacoRuleEditor';

const meta: Meta<typeof MonacoRuleEditor> = {
  title: 'Components/MonacoRuleEditor',
  component: MonacoRuleEditor,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MonacoRuleEditor>;

export const CreateNewRule: Story = {
  args: {
    rule: null,
    onSave: () => {
      console.log('Save rule');
      alert('Saved rule');
    },
    onCancel: () => {
      console.log('Cancel');
      alert('Cancelled');
    },
  },
};

export const EditExistingRule: Story = {
  args: {
    rule: {
      id: 'rule-123',
      name: 'HTTP 500 Errors',
      description: 'Detect traces with HTTP 500 status codes',
      expression: 'trace.has(span.attributes["http.status_code"] >= 500)',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    onSave: () => {
      console.log('Update rule');
      alert('Updated rule');
    },
    onCancel: () => {
      console.log('Cancel');
      alert('Cancelled');
    },
  },
};

export const ComplexExpression: Story = {
  args: {
    rule: {
      id: 'rule-456',
      name: 'Slow Database Queries',
      description: 'Detect database queries longer than 1 second',
      expression: 'trace.spans.filter(s => s.service == "database" and s.attributes["db.statement"].contains("SELECT")).length > 0 and trace.duration_ms > 1000',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    onSave: () => {
      console.log('Update rule');
      alert('Updated rule');
    },
    onCancel: () => {
      console.log('Cancel');
      alert('Cancelled');
    },
  },
};

export const ErrorInExpression: Story = {
  args: {
    rule: {
      id: 'rule-789',
      name: 'Invalid Expression',
      description: 'Rule with syntax error',
      expression: 'trace.has(span.status == "error" and',
      enabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    onSave: () => {
      console.log('Update rule');
      alert('Updated rule');
    },
    onCancel: () => {
      console.log('Cancel');
      alert('Cancelled');
    },
  },
};
